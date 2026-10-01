from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.report import Report
from app.schemas.evidence_quality import EvidenceQualityLevel
from app.schemas.media_observation import VisualObservationType
from app.schemas.triage import (
    TriageAction,
    TriageEvidenceSummary,
    TriageReasonCode,
    TriageResponse,
)
from app.services.contextual_evidence import evaluate_pattern_echo
from app.services.evidence_quality import assess_evidence_quality
from app.services.media_observation import extract_media_observations
from app.services.storage import StorageBackend, get_storage

MEANINGFUL_VISUAL_TYPES = {
    VisualObservationType.GREEN_VISUAL_REGION,
    VisualObservationType.DARK_OR_BROWN_DISCOLORATION,
    VisualObservationType.FOAM_LIKE_SURFACE_PATTERN,
    VisualObservationType.VISIBLE_LITTER,
    VisualObservationType.WATER_SURFACE_VISIBLE,
}


def evaluate_evidence_triage(
    report: Report,
    db: Session,
    storage: Optional[StorageBackend] = None,
) -> TriageResponse:
    """
    Deterministically evaluates the multi-dimensional evidence available for a report
    and recommends the next evidence-handling workflow action.

    Inputs synthesized:
    - Evidence completeness quality tier (Issue 3)
    - Attached media count and structured visual signals (Issues 4 & 8)
    - Pattern Echo nearby historical matches (Issue 9)
    - SignalGuard trust bounds and human decision status (Issues 6 & 7)

    Decision rules follow strict priority:
    1. INSUFFICIENT core evidence -> REQUEST_MORE_EVIDENCE
    2. Meaningful evidence + >= 2 historical matches -> EXPERT_REVIEW
    3. Meaningful visual observations needing human interpretation -> EXPERT_REVIEW
    4. PARTIAL contextual evidence without triggers -> REQUEST_MORE_EVIDENCE
    5. COMPLETE evidence with no triggers -> MONITOR
    """
    if storage is None:
        storage = get_storage()

    # 1. Authoritative Evidence Quality Assessment (Issue 3)
    quality_assessment = assess_evidence_quality(report)
    quality_str = quality_assessment.quality.value
    quality_score = quality_assessment.score

    # 2. Media and Visual Observations (Issues 4 & 8)
    media_items = getattr(report, "media", []) or []
    media_count = len(media_items)

    all_visual_observations = []
    for media in media_items:
        obs_list = extract_media_observations(media, storage=storage)
        all_visual_observations.extend(obs_list)

    visual_observation_count = len(all_visual_observations)
    has_meaningful_visual = any(
        obs.observation_type in MEANINGFUL_VISUAL_TYPES for obs in all_visual_observations
    )

    # 3. Pattern Echo Historical Context (Issue 9)
    pattern_echo = evaluate_pattern_echo(report=report, db=db, storage=storage)
    historical_match_count = len(pattern_echo.matches)

    # 4. Human Decision Status (Read-only baseline)
    human_review_status = "PENDING"

    # Evidence summary breakdown
    evidence_summary = TriageEvidenceSummary(
        quality=quality_str,
        quality_score=quality_score,
        media_count=media_count,
        visual_observation_count=visual_observation_count,
        historical_match_count=historical_match_count,
        human_review_status=human_review_status,
    )

    # 5. Deterministic Decision Logic
    recommended_action: TriageAction
    reason_codes: List[TriageReasonCode] = []
    explanation: List[str] = []

    # Priority 1: Core observational evidence missing
    if quality_assessment.quality == EvidenceQualityLevel.INSUFFICIENT:
        recommended_action = TriageAction.REQUEST_MORE_EVIDENCE
        reason_codes.append(TriageReasonCode.INSUFFICIENT_CORE_EVIDENCE)
        explanation.append("Core observational evidence is incomplete.")
        explanation.append("Additional citizen reporting or follow-up details are required before proceeding.")

    # Priority 2: Repeated historical context (>= 2 matches)
    elif historical_match_count >= 2:
        recommended_action = TriageAction.EXPERT_REVIEW
        reason_codes.append(TriageReasonCode.REPEATED_HISTORICAL_CONTEXT)
        reason_codes.append(TriageReasonCode.HUMAN_VERIFICATION_REQUIRED)
        if visual_observation_count > 0:
            reason_codes.append(TriageReasonCode.VISUAL_EVIDENCE_REQUIRES_REVIEW)
        explanation.append(
            f"{historical_match_count} similar historical observations were previously reported nearby."
        )
        explanation.append(
            "Available evidence indicates recurring characteristics that warrant human evaluation."
        )
        explanation.append("The available evidence has not been verified by a human expert.")

    # Priority 3: Structured visual evidence requiring expert interpretation
    elif visual_observation_count > 0 and has_meaningful_visual:
        recommended_action = TriageAction.EXPERT_REVIEW
        reason_codes.append(TriageReasonCode.VISUAL_EVIDENCE_REQUIRES_REVIEW)
        reason_codes.append(TriageReasonCode.HUMAN_VERIFICATION_REQUIRED)
        explanation.append("Current media evidence contains structured visual observations.")
        explanation.append(
            "Visual features warrant human expert evaluation to interpret visible surface characteristics."
        )
        explanation.append("The available evidence has not been verified by a human expert.")

    # Priority 4: Partial contextual evidence (recoverable via interview)
    elif quality_assessment.quality == EvidenceQualityLevel.PARTIAL:
        recommended_action = TriageAction.REQUEST_MORE_EVIDENCE
        reason_codes.append(TriageReasonCode.MISSING_CONTEXTUAL_EVIDENCE)
        explanation.append("Contextual observation fields are partially missing.")
        explanation.append(
            "Targeted follow-up interview questions can collect missing observational details."
        )

    # Priority 5: Complete evidence with no actionable gaps -> Routine monitoring
    else:
        recommended_action = TriageAction.MONITOR
        reason_codes.append(TriageReasonCode.NO_ACTIONABLE_GAP_IDENTIFIED)
        explanation.append("Core and contextual observations are fully documented.")
        explanation.append("No immediate human review or additional evidence is currently indicated.")
        explanation.append("Ongoing routine monitoring is recommended.")

    return TriageResponse(
        report_id=report.id,
        recommended_action=recommended_action,
        reason_codes=reason_codes,
        evidence_summary=evidence_summary,
        explanation=explanation,
        limitations=[
            "This recommendation concerns evidence handling only.",
            "Historical similarity does not establish environmental cause.",
            "Visual observations do not establish pollution, toxicity, health risk, or contamination.",
            "Human or instrument verification is required for environmental conclusions.",
        ],
    )
