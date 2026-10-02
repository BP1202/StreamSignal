"""
StreamSignal — Research Workspace Service
Implements deterministic composition for Evidence Inbox and Case Investigation.
Adheres strictly to scientific safety boundaries and the AGENTS.md contract.
No ML/LLM models, no fake data, no database schema mutations.
"""

from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session, joinedload

from app.models.report import Report
from app.models.media import ReportMedia
from app.models.human_review import HumanReview
from app.models.evidence_lineage import EvidenceLineageEvent
from app.schemas.evidence_quality import EvidenceQualityLevel, EvidenceQualityResponse
from app.schemas.triage import TriageAction, TriageResponse
from app.schemas.research import (
    WhySurfacedCategory,
    WhySurfacedReason,
    ResearchLocationSummary,
    ResearchInboxItem,
    ResearchInboxResponse,
    ResearchCaseDetailResponse,
    HumanReviewResponse,
    HumanReviewOutcome,
    CaseWorkflowStatus,
    OUTCOME_TO_WORKFLOW_STATUS,
)
from app.services.evidence_quality import assess_evidence_quality
from app.services.media_observation import extract_report_media_observations
from app.services.contextual_evidence import evaluate_pattern_echo
from app.services.triage import evaluate_evidence_triage
from app.services.evidence_contract import assemble_evidence_contract
from app.services.storage import get_storage


TRIAGE_ACTION_PRIORITY = {
    TriageAction.EXPERT_REVIEW: 1,
    TriageAction.FIELD_VERIFICATION: 2,
    TriageAction.REQUEST_MORE_EVIDENCE: 3,
    TriageAction.MONITOR: 4,
}


def derive_why_surfaced(
    triage: TriageResponse,
    quality: EvidenceQualityResponse,
    visual_obs_count: int,
    pattern_echo_count: int,
    human_status: str = "AWAITING_REVIEW",
) -> List[WhySurfacedReason]:
    """
    Derives deterministic, structured reasons explaining why this case surfaced in the inbox.
    Strictly auditable; no natural-language LLM hallucinations.
    """
    reasons: List[WhySurfacedReason] = []

    # 1. Triage Action
    action_text = {
        TriageAction.EXPERT_REVIEW: "High-priority expert review recommended",
        TriageAction.FIELD_VERIFICATION: "Physical field verification recommended",
        TriageAction.REQUEST_MORE_EVIDENCE: "Additional evidence needed from citizen interview",
        TriageAction.MONITOR: "Routine monitoring indicated",
    }.get(triage.recommended_action, f"Triage action: {triage.recommended_action.value}")

    reason_codes_str = ", ".join(r.value for r in triage.reason_codes)
    reasons.append(
        WhySurfacedReason(
            category=WhySurfacedCategory.TRIAGE_ACTION,
            summary=action_text,
            details=f"Triggered by triage rules: {reason_codes_str}" if reason_codes_str else None,
        )
    )

    # 2. Visual Evidence
    if visual_obs_count > 0:
        reasons.append(
            WhySurfacedReason(
                category=WhySurfacedCategory.VISUAL_EVIDENCE,
                summary="Visual characteristics detected in uploaded media warrant review",
                details=f"{visual_obs_count} visual observation cue(s) extracted from citizen media.",
            )
        )

    # 3. Contextual Pattern Echo
    if pattern_echo_count > 0:
        plural = "s" if pattern_echo_count > 1 else ""
        reasons.append(
            WhySurfacedReason(
                category=WhySurfacedCategory.HISTORICAL_CONTEXT,
                summary=f"{pattern_echo_count} nearby historical observation{plural} share relevant signals",
                details="Historical recurrence identified within spatial and temporal proximity.",
            )
        )

    # 4. Evidence Completeness
    pct = int(quality.score * 100)
    reasons.append(
        WhySurfacedReason(
            category=WhySurfacedCategory.EVIDENCE_COMPLETENESS,
            summary=f"Evidence completeness is {pct}% ({quality.quality.value})",
            details=f"{len(quality.present)} fields documented, {len(quality.missing)} fields missing.",
        )
    )

    # 5. Human Review State
    is_pending = human_status in ("PENDING", "AWAITING_REVIEW", "SUBMITTED")
    reasons.append(
        WhySurfacedReason(
            category=WhySurfacedCategory.HUMAN_REVIEW_STATE,
            summary=f"Human review status: {human_status}",
            details=(
                "No human decision has been recorded yet. Investigation pending."
                if is_pending
                else f"Active decision recorded: {human_status.replace('_', ' ').title()}."
            ),
        )
    )

    return reasons


def get_research_inbox(
    db: Session,
    action: Optional[TriageAction] = None,
    quality_rating: Optional[EvidenceQualityLevel] = None,
    has_media: Optional[bool] = None,
    has_pattern_echo: Optional[bool] = None,
    limit: int = 20,
    offset: int = 0,
) -> ResearchInboxResponse:
    """
    Retrieves and composes the Research Evidence Inbox.
    Uses deterministic ordering and composable filtering across existing authoritative services.
    """
    storage = get_storage()

    query = db.query(Report)
    if has_media is True:
        query = query.filter(Report.media.any())
    elif has_media is False:
        query = query.filter(~Report.media.any())

    # Bounded candidate pool of recent reports for responsive inbox loading
    candidate_limit = max(50, (offset + limit) * 2)
    reports: List[Report] = (
        query.options(joinedload(Report.media))
        .order_by(Report.observed_at.desc(), Report.id.desc())
        .limit(candidate_limit)
        .all()
    )

    inbox_items: List[ResearchInboxItem] = []

    for report in reports:
        # 1. Evidence Quality
        quality = assess_evidence_quality(report)

        # 2. Triage Recommendation (synthesizes media visual obs and pattern echo)
        triage = evaluate_evidence_triage(db=db, report=report, storage=storage)
        ev_summary = triage.evidence_summary
        media_count = ev_summary.media_count
        total_visual_obs = ev_summary.visual_observation_count
        echo_count = ev_summary.historical_match_count

        # Apply Filters
        if action is not None and triage.recommended_action != action:
            continue
        if quality_rating is not None and quality.quality != quality_rating:
            continue
        if has_pattern_echo is not None:
            if has_pattern_echo and echo_count == 0:
                continue
            if not has_pattern_echo and echo_count > 0:
                continue

        # Status and Evidence State
        has_decision = report.status in [s.value for s in CaseWorkflowStatus] and report.status != "SUBMITTED"
        wf_status = report.status if has_decision else "AWAITING_REVIEW"
        human_status = wf_status if has_decision else "PENDING"
        ev_state = (
            "E4_CORROBORATED" if echo_count > 0 else ("E2_DOCUMENTED" if total_visual_obs > 0 else "E1_REPORTED")
        )

        why_surfaced = derive_why_surfaced(
            triage=triage,
            quality=quality,
            visual_obs_count=total_visual_obs,
            pattern_echo_count=echo_count,
            human_status=human_status,
        )

        item = ResearchInboxItem(
            case_id=report.id,
            observed_at=report.observed_at,
            location=ResearchLocationSummary(
                latitude=report.latitude,
                longitude=report.longitude,
                stream_name=None,
            ),
            description=report.description,
            water_appearance=report.water_appearance,
            flow_condition=report.flow_condition,
            odor=report.odor,
            quality_rating=quality.quality,
            completeness_score=quality.score,
            media_count=media_count,
            pattern_echo_count=echo_count,
            triage_action=triage.recommended_action,
            triage_reasons=triage.reason_codes,
            human_decision_status=human_status,
            workflow_status=wf_status,
            evidence_state=ev_state,
            why_surfaced=why_surfaced,
        )
        inbox_items.append(item)

    # Deterministic Inbox Ordering:
    # 1. Triage Action Priority (EXPERT_REVIEW=1, FIELD_VERIFICATION=2, REQUEST_MORE_EVIDENCE=3, MONITOR=4)
    # 2. Context & Visual Trigger Strength DESC (pattern_echo_count + media_count)
    # 3. Observation timestamp DESC
    # 4. Stable Case UUID
    inbox_items.sort(
        key=lambda item: (
            TRIAGE_ACTION_PRIORITY.get(item.triage_action, 99),
            -(item.pattern_echo_count + item.media_count),
            -item.observed_at.timestamp(),
            str(item.case_id),
        )
    )

    total = len(inbox_items)
    paginated_items = inbox_items[offset : offset + limit]

    return ResearchInboxResponse(
        items=paginated_items,
        total=total,
        limit=limit,
        offset=offset,
    )


def get_research_case_detail(
    db: Session,
    case_id: UUID,
) -> Optional[ResearchCaseDetailResponse]:
    """
    Composes full evidence investigation details for a given SignalCase.
    Aggregates Citizen Evidence, Media Observations, Contextual Evidence,
    Triage, SignalGuard Claims, Human Reviews, and Evidence Lineage.
    """
    report = db.query(Report).filter(Report.id == case_id).first()
    if not report:
        return None

    storage = get_storage()

    # 1. Quality
    quality = assess_evidence_quality(report)

    # 2. Media Observations
    visual_obs_res = extract_report_media_observations(report, storage=storage)
    total_visual_obs = sum(len(m.observations) for m in visual_obs_res.media)

    # 3. Contextual Evidence
    pattern_echo = evaluate_pattern_echo(db=db, report=report, storage=storage)
    echo_count = len(pattern_echo.matches)

    # 4. Triage
    triage = evaluate_evidence_triage(db=db, report=report, storage=storage)

    # 5. SignalGuard Evidence Contract
    contract = assemble_evidence_contract(report=report)

    # 6. Human Review History & Latest Decision
    reviews = (
        db.query(HumanReview)
        .filter(HumanReview.report_id == report.id)
        .order_by(HumanReview.created_at.desc(), HumanReview.id.desc())
        .all()
    )
    latest_review = reviews[0] if reviews else None
    latest_review_dto = (
        HumanReviewResponse(
            id=latest_review.id,
            case_id=latest_review.signal_case_id,
            report_id=latest_review.report_id,
            reviewer_id=latest_review.reviewer_id,
            outcome=HumanReviewOutcome(latest_review.outcome),
            rationale=latest_review.rationale,
            linked_case_id=latest_review.linked_case_id,
            evidence_state_before=latest_review.evidence_state_before,
            evidence_state_after=latest_review.evidence_state_after,
            workflow_status=OUTCOME_TO_WORKFLOW_STATUS.get(
                HumanReviewOutcome(latest_review.outcome), CaseWorkflowStatus.AWAITING_REVIEW
            ),
            created_at=latest_review.created_at,
        )
        if latest_review
        else None
    )

    # 7. Lineage Count
    lineage_count = (
        db.query(EvidenceLineageEvent)
        .filter(EvidenceLineageEvent.signal_case_id == report.id)
        .count()
    )

    has_decision = report.status in [s.value for s in CaseWorkflowStatus] and report.status != "SUBMITTED"
    workflow_status = (
        report.status
        if has_decision
        else ("AWAITING_REVIEW" if not latest_review else OUTCOME_TO_WORKFLOW_STATUS[HumanReviewOutcome(latest_review.outcome)].value)
    )
    human_status = workflow_status if (has_decision or latest_review) else "PENDING"

    evidence_state = (
        "E4_CORROBORATED" if echo_count > 0 else ("E2_DOCUMENTED" if total_visual_obs > 0 else "E1_REPORTED")
    )

    # 8. Why Surfaced
    why_surfaced = derive_why_surfaced(
        triage=triage,
        quality=quality,
        visual_obs_count=total_visual_obs,
        pattern_echo_count=echo_count,
        human_status=human_status,
    )

    return ResearchCaseDetailResponse(
        case_id=report.id,
        observed_at=report.observed_at,
        location=ResearchLocationSummary(
            latitude=report.latitude,
            longitude=report.longitude,
            stream_name=None,
        ),
        description=report.description,
        water_appearance=report.water_appearance,
        flow_condition=report.flow_condition,
        odor=report.odor,
        foam_observed=report.foam_observed,
        litter_observed=report.litter_observed,
        dead_wildlife_observed=report.dead_wildlife_observed,
        human_decision_status=human_status,
        workflow_status=workflow_status,
        evidence_state=evidence_state,
        latest_human_review=latest_review_dto,
        review_count=len(reviews),
        lineage_count=lineage_count,
        why_surfaced=why_surfaced,
        evidence_quality=quality,
        media_observations=visual_obs_res.media,
        contextual_evidence=pattern_echo,
        triage=triage,
        evidence_contract=contract,
    )
