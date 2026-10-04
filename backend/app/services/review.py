"""
StreamSignal — Human Review & Evidence Trust Loop Service
Handles recording auditable human review decisions, deterministic workflow status transitions,
evidence state boundaries (preserving E1-E4 without false promotion to E5),
and immutable audit lineage event persistence.
"""

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.report import Report
from app.models.human_review import HumanReview
from app.models.evidence_lineage import EvidenceLineageEvent
from app.schemas.research import (
    ActorType,
    CaseWorkflowStatus,
    CitizenImpactStatusResponse,
    EvidenceLineageEventResponse,
    EvidenceLineageListResponse,
    HumanReviewCreate,
    HumanReviewListResponse,
    HumanReviewOutcome,
    HumanReviewResponse,
    LineageEventType,
    OUTCOME_TO_WORKFLOW_STATUS,
    CITIZEN_IMPACT_DESCRIPTIONS,
)
from app.services.contextual_evidence import evaluate_pattern_echo
from app.services.media_observation import extract_report_media_observations
from app.services.storage import get_storage
from app.services.realtime import connection_manager, RealtimeEventType


def determine_current_evidence_state(db: Session, report: Report) -> str:
    """
    Deterministically evaluates the report's current evidence state:
    - E4_CORROBORATED: Supported by independent historical matches (Pattern Echo)
    - E2_DOCUMENTED: Supported by observable visual evidence cues in media
    - E1_REPORTED: Baseline citizen-reported observational evidence
    Never automatically returns E5_VERIFIED for desktop triage.
    """
    storage = get_storage()

    # Check for historical corroboration (Pattern Echo)
    pattern_echo = evaluate_pattern_echo(report=report, db=db, storage=storage)
    if pattern_echo and len(pattern_echo.matches) > 0:
        return "E4_CORROBORATED"

    # Check for directly observable media cues
    media_obs = extract_report_media_observations(report=report, storage=storage)
    if media_obs and any(len(m.observations) > 0 for m in media_obs.media):
        return "E2_DOCUMENTED"

    return "E1_REPORTED"


def create_human_review(
    db: Session,
    case_id: UUID,
    review_in: HumanReviewCreate,
    reviewer_id: str,
) -> HumanReviewResponse:
    """
    Records a human review decision transactionally with:
    1. Validation of case existence and linked case constraints
    2. Deterministic workflow status assignment
    3. Evidence state preservation (E4 does not become E5)
    4. Exactly one immutable HUMAN_REVIEW_RECORDED lineage event
    """
    report = db.query(Report).filter(Report.id == case_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SignalCase with id '{case_id}' not found.",
        )

    outcome = review_in.outcome
    linked_case_id = review_in.linked_case_id

    # Linked Case Validation
    if outcome in (HumanReviewOutcome.MARK_RELATED_CASE, HumanReviewOutcome.MARK_POTENTIAL_DUPLICATE):
        if not linked_case_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"linked_case_id is required for outcome '{outcome.value}'.",
            )
        if linked_case_id == case_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Cannot link a case to itself.",
            )
        target_case = db.query(Report).filter(Report.id == linked_case_id).first()
        if not target_case:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Target linked_case_id '{linked_case_id}' not found.",
            )
    else:
        if linked_case_id is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"linked_case_id must be null for outcome '{outcome.value}'.",
            )

    # Determine Evidence State Before and After
    evidence_state_before = determine_current_evidence_state(db=db, report=report)
    # Critical Rule: A human triage review never automatically promotes E4 to E5.
    evidence_state_after = evidence_state_before

    # Map Workflow Status
    new_workflow_status = OUTCOME_TO_WORKFLOW_STATUS[outcome]
    prev_status = report.status or "AWAITING_REVIEW"

    # Transactional execution
    try:
        now = datetime.now(timezone.utc)
        review = HumanReview(
            report_id=report.id,
            signal_case_id=report.id,
            reviewer_id=reviewer_id,
            outcome=outcome.value,
            rationale=review_in.rationale,
            linked_case_id=linked_case_id,
            evidence_state_before=evidence_state_before,
            evidence_state_after=evidence_state_after,
            created_at=now,
            updated_at=now,
        )
        db.add(review)

        # Update case report workflow status
        report.status = new_workflow_status.value
        report.updated_at = now

        # Exactly 1 immutable lineage event
        summary_text = (
            f"Researcher recorded decision: {outcome.value.replace('_', ' ').title()}."
        )
        lineage_event = EvidenceLineageEvent(
            signal_case_id=report.id,
            event_type=LineageEventType.HUMAN_REVIEW_RECORDED.value,
            actor_type=ActorType.RESEARCHER.value,
            actor_id=reviewer_id,
            source_service="research_workspace",
            summary=summary_text,
            structured_payload_json={
                "outcome": outcome.value,
                "previous_status": prev_status,
                "new_status": new_workflow_status.value,
                "evidence_state_before": evidence_state_before,
                "evidence_state_after": evidence_state_after,
                "linked_case_id": str(linked_case_id) if linked_case_id else None,
                "rationale_preview": review_in.rationale[:150],
            },
            created_at=now,
        )
        db.add(lineage_event)

        db.commit()
        db.refresh(review)

        # 1. Publish HUMAN_REVIEW_RECORDED to research workspace
        connection_manager.publish_event(
            event_type=RealtimeEventType.HUMAN_REVIEW_RECORDED,
            case_id=report.id,
            report_id=report.id,
            payload={
                "outcome": outcome.value,
                "workflow_status": new_workflow_status.value,
                "previous_status": prev_status,
                "evidence_state_before": evidence_state_before,
                "evidence_state_after": evidence_state_after,
            },
        )

        # 2. Targeted CITIZEN_IMPACT_UPDATED to citizen socket (strictly safe citizen-facing payload)
        status_key = new_workflow_status.value
        status_label = status_key.replace("_", " ").title()
        safe_description = CITIZEN_IMPACT_DESCRIPTIONS.get(
            status_key,
            "Your observation was reviewed as part of a research evidence workflow.",
        )
        connection_manager.publish_event(
            event_type=RealtimeEventType.CITIZEN_IMPACT_UPDATED,
            case_id=report.id,
            report_id=report.id,
            payload={
                "workflow_status": status_key,
                "citizen_label": status_label,
                "safe_description": safe_description,
            },
        )

        return HumanReviewResponse(
            id=review.id,
            case_id=review.signal_case_id,
            report_id=review.report_id,
            reviewer_id=review.reviewer_id,
            outcome=HumanReviewOutcome(review.outcome),
            rationale=review.rationale,
            linked_case_id=review.linked_case_id,
            evidence_state_before=review.evidence_state_before,
            evidence_state_after=review.evidence_state_after,
            workflow_status=new_workflow_status,
            created_at=review.created_at,
        )
    except Exception:
        db.rollback()
        raise


def get_case_reviews(db: Session, case_id: UUID) -> HumanReviewListResponse:
    """
    Returns deterministic chronological list of reviews for a case (created_at ASC, id ASC).
    """
    report = db.query(Report).filter(Report.id == case_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SignalCase with id '{case_id}' not found.",
        )

    reviews = (
        db.query(HumanReview)
        .filter(HumanReview.report_id == case_id)
        .order_by(HumanReview.created_at.asc(), HumanReview.id.asc())
        .all()
    )

    items = [
        HumanReviewResponse(
            id=r.id,
            case_id=r.signal_case_id,
            report_id=r.report_id,
            reviewer_id=r.reviewer_id,
            outcome=HumanReviewOutcome(r.outcome),
            rationale=r.rationale,
            linked_case_id=r.linked_case_id,
            evidence_state_before=r.evidence_state_before,
            evidence_state_after=r.evidence_state_after,
            workflow_status=OUTCOME_TO_WORKFLOW_STATUS.get(
                HumanReviewOutcome(r.outcome), CaseWorkflowStatus.AWAITING_REVIEW
            ),
            created_at=r.created_at,
        )
        for r in reviews
    ]

    return HumanReviewListResponse(reviews=items, total=len(items))


def get_case_lineage(db: Session, case_id: UUID) -> EvidenceLineageListResponse:
    """
    Returns deterministic chronological list of immutable lineage events for a case.
    """
    report = db.query(Report).filter(Report.id == case_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SignalCase with id '{case_id}' not found.",
        )

    events = (
        db.query(EvidenceLineageEvent)
        .filter(EvidenceLineageEvent.signal_case_id == case_id)
        .order_by(EvidenceLineageEvent.created_at.asc(), EvidenceLineageEvent.id.asc())
        .all()
    )

    items = [
        EvidenceLineageEventResponse(
            id=e.id,
            signal_case_id=e.signal_case_id,
            event_type=e.event_type,
            actor_type=ActorType(e.actor_type),
            actor_id=e.actor_id,
            source_service=e.source_service,
            summary=e.summary,
            structured_payload_json=e.structured_payload_json,
            created_at=e.created_at,
        )
        for e in events
    ]

    return EvidenceLineageListResponse(events=items, total=len(items))


def get_citizen_impact_status(db: Session, case_id: UUID) -> CitizenImpactStatusResponse:
    """
    Returns safe, non-sensitive impact status for citizen viewing.
    Excludes researcher identity, internal rationales, sensitive coordinates,
    and private case relationships.
    """
    report = db.query(Report).filter(Report.id == case_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report with id '{case_id}' not found.",
        )

    raw_status = report.status or "AWAITING_REVIEW"
    current_status = "AWAITING_REVIEW" if raw_status == "SUBMITTED" else raw_status
    status_label = current_status.replace("_", " ").title()
    description = CITIZEN_IMPACT_DESCRIPTIONS.get(
        current_status,
        "Your observation was received and is part of the research evidence workflow.",
    )

    return CitizenImpactStatusResponse(
        case_id=report.id,
        status=current_status,
        status_label=status_label,
        description=description,
        updated_at=report.updated_at,
    )
