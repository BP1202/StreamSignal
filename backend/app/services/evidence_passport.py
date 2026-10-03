"""
StreamSignal — Evidence Passport Service (Track 7 Interoperability)
Produces an authoritative, tamper-evident Evidence Passport for a SignalCase.
Strictly separates:
1. Citizen observation (CITIZEN_REPORTED)
2. Quality evaluation (completeness ratio)
3. Media evidence (safe metadata & integrity hashes, no disk paths)
4. Machine observations (MACHINE_OBSERVATION / E3_INFERRED)
5. Contextual corroboration (Pattern Echo)
6. SignalGuard Interpretation Firewall (allowed vs prohibited claims)
7. Human decision (E4 != E5, requests != completed)
8. Authoritative Evidence Lineage audit events
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import NAMESPACE_DNS, UUID, uuid5
from sqlalchemy.orm import Session, joinedload

from app.models.report import Report
from app.schemas.evidence_case import LocationData
from app.schemas.evidence_passport import (
    CitizenEvidencePassportSection,
    ContextualMatchPassportItem,
    ContextualPassportSection,
    EvidencePassportResponse,
    HumanDecisionPassportSection,
    LineagePassportItem,
    LineagePassportSection,
    MachineObservationPassportItem,
    MachineObservationPassportSection,
    MediaPassportItem,
    MediaPassportSection,
    PassportMetadata,
    QualityPassportSection,
    SignalCaseIdentity,
    SignalGuardPassportSection,
)
from app.schemas.research import CaseWorkflowStatus
from app.services.contextual_evidence import evaluate_pattern_echo
from app.services.evidence_contract import assemble_evidence_contract
from app.services.evidence_quality import assess_evidence_quality
from app.services.media_observation import extract_report_media_observations
from app.services.review import determine_current_evidence_state, get_case_lineage, get_case_reviews
from app.services.storage import get_storage


def generate_evidence_passport(db: Session, case_id: UUID) -> Optional[EvidencePassportResponse]:
    """
    Generates a structured, provenance-preserving Evidence Passport for a SignalCase.
    Returns None if the underlying Report/Case does not exist.
    """
    report = (
        db.query(Report)
        .options(joinedload(Report.media))
        .filter(Report.id == case_id)
        .first()
    )
    if not report:
        return None

    storage = get_storage()

    # 1. Deterministic Passport ID
    passport_id = uuid5(NAMESPACE_DNS, f"streamsignal:passport:{report.id}")
    now_utc = datetime.now(timezone.utc)

    # 2. Evidence Quality Assessment
    quality = assess_evidence_quality(report)
    present_dims = quality.present
    missing_dims = quality.missing

    # 3. Media Items (safe metadata only, strictly no server filesystem paths)
    media_items = []
    for item in (getattr(report, "media", []) or []):
        media_items.append(
            MediaPassportItem(
                media_id=item.id,
                original_filename=item.original_filename,
                content_type=item.content_type,
                size_bytes=item.size_bytes,
                sha256_hash=item.sha256,
                safe_reference=f"/api/v1/reports/{report.id}/media/{item.id}",
            )
        )

    # 4. Machine Observations
    media_obs_res = extract_report_media_observations(report=report, storage=storage)
    machine_items = []
    if media_obs_res:
        for media_group in media_obs_res.media:
            for obs in media_group.observations:
                machine_items.append(
                    MachineObservationPassportItem(
                        observation_id=obs.observation_id,
                        media_id=str(media_group.media_id),
                        observation_type=obs.observation_type.value,
                        evidence_class="E3_INFERRED",
                        description=obs.description,
                        uncertainty=obs.uncertainty,
                        sha256_integrity=obs.support.sha256 if hasattr(obs, "support") and obs.support else "",
                    )
                )

    # 5. Contextual Evidence (Pattern Echo)
    pattern_echo = evaluate_pattern_echo(report=report, db=db, storage=storage)
    context_matches = []
    echo_status = "NO_MATCHES"
    echo_count = 0
    echo_summary = "No historical patterns within spatial/temporal threshold."
    radius = 1000
    window = 90
    if pattern_echo:
        echo_status = pattern_echo.status.value
        echo_count = len(pattern_echo.matches)
        echo_summary = pattern_echo.summary
        radius = pattern_echo.search_radius_meters
        window = pattern_echo.historical_window_days
        for m in pattern_echo.matches:
            context_matches.append(
                ContextualMatchPassportItem(
                    report_id=str(m.report_id),
                    observed_at=m.observed_at.isoformat() if hasattr(m.observed_at, "isoformat") else str(m.observed_at),
                    distance_meters=round(m.distance_meters, 1),
                    days_difference=m.days_difference,
                    matched_signals=m.matched_signals,
                    similarity_explanation=m.similarity_explanation,
                )
            )

    # 6. SignalGuard Interpretation Firewall
    contract = assemble_evidence_contract(report=report)
    supported_claims = [c.claim for c in contract.claims]
    prohibited_set = set()
    for c in contract.claims:
        for p in c.prohibited_interpretations:
            prohibited_set.add(p.value if hasattr(p, "value") else str(p))
    if not prohibited_set:
        prohibited_set = {
            "POLLUTION_CONFIRMED",
            "TOXICITY_CONFIRMED",
            "HEALTH_RISK_CONFIRMED",
            "CAUSE_CONFIRMED",
        }
    prohibited_claims = sorted(list(prohibited_set))

    # 7. Human Decision & Workflow Status
    reviews_res = get_case_reviews(db=db, case_id=case_id)
    latest_review = reviews_res.reviews[-1] if reviews_res.reviews else None

    has_decision = report.status in [s.value for s in CaseWorkflowStatus] and report.status != "SUBMITTED"
    workflow_status = (
        report.status
        if has_decision
        else ("AWAITING_REVIEW" if not latest_review else latest_review.workflow_status.value)
    )

    if latest_review:
        human_decision = HumanDecisionPassportSection(
            review_status="REVIEWED",
            outcome=latest_review.outcome.value,
            workflow_status=latest_review.workflow_status.value,
            evidence_state_before=latest_review.evidence_state_before,
            evidence_state_after=latest_review.evidence_state_after,
            reviewer_id=latest_review.reviewer_id,
            rationale=latest_review.rationale,
            linked_case_id=latest_review.linked_case_id,
            reviewed_at=latest_review.created_at,
        )
    else:
        human_decision = HumanDecisionPassportSection(
            review_status="AWAITING_REVIEW",
            outcome=None,
            workflow_status="AWAITING_REVIEW",
            evidence_state_before=None,
            evidence_state_after=None,
            reviewer_id=None,
            rationale=None,
            linked_case_id=None,
            reviewed_at=None,
        )

    # 8. Evidence State
    current_evidence_state = determine_current_evidence_state(db=db, report=report)

    # 9. Lineage Events
    lineage_res = get_case_lineage(db=db, case_id=case_id)
    lineage_items = [
        LineagePassportItem(
            event_id=e.id,
            event_type=e.event_type.value if hasattr(e.event_type, "value") else str(e.event_type),
            actor_type=e.actor_type.value if hasattr(e.actor_type, "value") else str(e.actor_type),
            actor_id=e.actor_id,
            summary=e.summary,
            created_at=e.created_at,
        )
        for e in lineage_res.events
    ]

    return EvidencePassportResponse(
        metadata=PassportMetadata(
            passport_id=passport_id,
            schema_version="1.0.0",
            generated_at=now_utc,
            system_source="StreamSignal Track 7 Interoperability Gateway",
            governance_standard="IEEE OneAquaHealth One Health Evidence Standard",
        ),
        identity=SignalCaseIdentity(
            case_id=report.id,
            report_id=report.id,
            created_at=report.created_at,
            current_evidence_state=current_evidence_state,
            current_workflow_status=workflow_status,
        ),
        citizen_evidence=CitizenEvidencePassportSection(
            evidence_origin="CITIZEN_REPORTED",
            observed_at=report.observed_at,
            location=LocationData(
                latitude=report.latitude,
                longitude=report.longitude,
            ),
            description=report.description,
            water_appearance=report.water_appearance,
            flow_condition=report.flow_condition,
            odor=report.odor,
            foam_observed=report.foam_observed,
            litter_observed=report.litter_observed,
            dead_wildlife_observed=report.dead_wildlife_observed,
        ),
        evidence_quality=QualityPassportSection(
            quality_tier=quality.quality.value,
            completeness_score=quality.score,
            present_dimensions=present_dims,
            missing_dimensions=missing_dims,
            recommendations=quality.recommendations,
            interpretation_boundary="Completeness reflects documented physical dimension density, not scientific truth or contamination certainty.",
        ),
        media_evidence=MediaPassportSection(
            total_media=len(media_items),
            items=media_items,
        ),
        machine_assistance=MachineObservationPassportSection(
            status="AVAILABLE" if machine_items else "NONE_DETECTED",
            evidence_class="E3_INFERRED",
            items=machine_items,
            scientific_limitation="Machine vision observations indicate visible cues only and do not establish biological identity, toxicity, or environmental causation.",
        ),
        contextual_evidence=ContextualPassportSection(
            status=echo_status,
            matches_count=echo_count,
            search_radius_meters=radius,
            historical_window_days=window,
            summary=echo_summary,
            matches=context_matches,
            interpretation_boundary="Historical recurrence indicates spatial/temporal pattern similarity, not environmental causation.",
        ),
        signal_guard=SignalGuardPassportSection(
            contract_version="1.0",
            rules_applied=[
                "SIGNALGUARD_STRICT_EVIDENCE_CLASS",
                "INTERPRETATION_FIREWALL",
                "NO_AUTOMATIC_E5_PROMOTION",
            ],
            guarantees=[
                "Original citizen evidence preserved unchanged",
                "Machine observations labeled E3_INFERRED with uncertainty bounds",
                "Scientific interpretation strictly requires human review",
            ],
            supported_claims=supported_claims,
            prohibited_interpretations=prohibited_claims,
        ),
        human_decision=human_decision,
        lineage=LineagePassportSection(
            total_events=lineage_res.total,
            events=lineage_items,
        ),
    )
