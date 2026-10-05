"""
StreamSignal — Contact Request Service (Issue 36)
Implements business logic, consent verification, IDOR authorization,
and immutable lineage audit logging for researcher-contributor contact workflows.
"""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.contact_request import ContactRequest
from app.models.contributor import Contributor
from app.models.evidence_lineage import EvidenceLineageEvent
from app.models.mission import Mission
from app.models.report import Report
from app.schemas.contact_request import (
    CitizenContactInitiate,
    ContactRequestCreate,
    ContactRequestResponse,
    ContactResponseSubmit,
)
from app.services.realtime import connection_manager, RealtimeEventType


def _serialize_request(req: ContactRequest, mask_details: bool = False) -> ContactRequestResponse:
    """Safely serializes ContactRequest, masking contact details unless accepted."""
    handle = None
    if req.contributor:
        handle = req.contributor.display_name

    show_contact = (req.status == "ACCEPTED") and not mask_details

    return ContactRequestResponse(
        id=req.id,
        signal_case_id=req.signal_case_id,
        contributor_id=req.contributor_id,
        contributor_handle=handle,
        initiated_by=req.initiated_by,
        researcher_id=req.researcher_id,
        reason=req.reason,
        message=req.message,
        status=req.status,
        shared_email=req.shared_email if show_contact else None,
        shared_phone=req.shared_phone if show_contact else None,
        preferred_method=req.preferred_method if show_contact else None,
        contributor_note=req.contributor_note,
        responded_at=req.responded_at,
        created_at=req.created_at,
        updated_at=req.updated_at,
    )


def create_researcher_contact_request(
    db: Session,
    case_id: UUID,
    researcher_id: str,
    payload: ContactRequestCreate,
) -> ContactRequestResponse:
    """Creates a researcher-initiated contact request for a SignalCase."""
    report = db.query(Report).filter(Report.id == case_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SignalCase '{case_id}' not found.",
        )

    # Resolve contributor
    contributor_id = report.contributor_id
    if not contributor_id:
        # Check if linked through mission
        linked_mission = (
            db.query(Mission)
            .filter(Mission.signal_case_id == report.id, Mission.contributor_id.isnot(None))
            .first()
        )
        if linked_mission:
            contributor_id = linked_mission.contributor_id

    req = ContactRequest(
        signal_case_id=report.id,
        contributor_id=contributor_id,
        initiated_by="RESEARCHER",
        researcher_id=researcher_id,
        reason=payload.reason,
        message=payload.message,
        status="PENDING",
    )
    db.add(req)

    # Immutable lineage event
    lineage = EvidenceLineageEvent(
        signal_case_id=report.id,
        event_type="CONTACT_REQUEST_CREATED",
        actor_type="RESEARCHER",
        actor_id=researcher_id,
        source_service="ResearcherContactGateway",
        summary=f"Researcher initiated contact request for reason '{payload.reason}'",
        structured_payload_json={
            "request_id": str(req.id),
            "reason": payload.reason,
            "has_assigned_contributor": bool(contributor_id),
        },
    )
    db.add(lineage)
    db.commit()
    db.refresh(req)

    connection_manager.publish_event(
        event_type=RealtimeEventType.EVIDENCE_UPDATED,
        case_id=report.id,
        report_id=report.id,
        payload={"action": "CONTACT_REQUEST_CREATED", "request_id": str(req.id)},
    )

    return _serialize_request(req)


def get_case_contact_requests(
    db: Session,
    case_id: UUID,
) -> List[ContactRequestResponse]:
    """Retrieves all contact requests for a given SignalCase."""
    requests = (
        db.query(ContactRequest)
        .filter(ContactRequest.signal_case_id == case_id)
        .order_by(ContactRequest.created_at.desc())
        .all()
    )
    return [_serialize_request(r) for r in requests]


def get_contributor_contact_requests(
    db: Session,
    contributor: Contributor,
) -> List[ContactRequestResponse]:
    """Retrieves pending/active contact requests relevant to a citizen contributor."""
    # Find all report IDs owned by this contributor
    contributor_report_ids = [
        r.id for r in db.query(Report.id).filter(Report.contributor_id == contributor.id).all()
    ]
    mission_report_ids = [
        m.signal_case_id
        for m in db.query(Mission.signal_case_id)
        .filter(Mission.contributor_id == contributor.id, Mission.signal_case_id.isnot(None))
        .all()
    ]
    all_report_ids = set(contributor_report_ids + mission_report_ids)

    requests = (
        db.query(ContactRequest)
        .filter(
            (ContactRequest.contributor_id == contributor.id)
            | (ContactRequest.signal_case_id.in_(all_report_ids))
        )
        .order_by(ContactRequest.created_at.desc())
        .all()
    )
    return [_serialize_request(r) for r in requests]


def respond_to_contact_request(
    db: Session,
    request_id: UUID,
    contributor: Contributor,
    payload: ContactResponseSubmit,
) -> ContactRequestResponse:
    """Handles citizen response (ACCEPT or DECLINE) with strict IDOR verification."""
    req = db.query(ContactRequest).filter(ContactRequest.id == request_id).first()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contact request '{request_id}' not found.",
        )

    # IDOR Check
    if req.contributor_id and req.contributor_id != contributor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You are not authorized to respond to this contact request.",
        )

    # Check report ownership
    report = db.query(Report).filter(Report.id == req.signal_case_id).first()
    if report and report.contributor_id and report.contributor_id != contributor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You are not authorized to respond to this contact request.",
        )

    # Associate contributor if previously unclaimed
    if not req.contributor_id:
        req.contributor_id = contributor.id
    if report and not report.contributor_id:
        report.contributor_id = contributor.id

    now_utc = datetime.now(timezone.utc)
    req.responded_at = now_utc

    if payload.action == "ACCEPT":
        req.status = "ACCEPTED"
        req.shared_email = payload.shared_email
        req.shared_phone = payload.shared_phone
        req.preferred_method = payload.preferred_method
        req.contributor_note = payload.contributor_note

        lineage = EvidenceLineageEvent(
            signal_case_id=req.signal_case_id,
            event_type="CONTACT_REQUEST_ACCEPTED",
            actor_type="CITIZEN",
            actor_id=contributor.contributor_id,
            source_service="CitizenContactGateway",
            summary="Citizen accepted contact request and consented to direct follow-up.",
            structured_payload_json={
                "request_id": str(req.id),
                "preferred_method": payload.preferred_method,
                "has_email": bool(payload.shared_email),
                "has_phone": bool(payload.shared_phone),
            },
        )
        db.add(lineage)
    else:
        req.status = "DECLINED"
        req.shared_email = None
        req.shared_phone = None
        req.contributor_note = payload.contributor_note

        lineage = EvidenceLineageEvent(
            signal_case_id=req.signal_case_id,
            event_type="CONTACT_REQUEST_DECLINED",
            actor_type="CITIZEN",
            actor_id=contributor.contributor_id,
            source_service="CitizenContactGateway",
            summary="Citizen declined direct contact request; investigation remains within platform evidence bounds.",
            structured_payload_json={
                "request_id": str(req.id),
            },
        )
        db.add(lineage)

    db.commit()
    db.refresh(req)

    connection_manager.publish_event(
        event_type=RealtimeEventType.EVIDENCE_UPDATED,
        case_id=req.signal_case_id,
        report_id=req.signal_case_id,
        payload={"action": f"CONTACT_REQUEST_{req.status}", "request_id": str(req.id)},
    )

    return _serialize_request(req)


def create_citizen_initiated_contact(
    db: Session,
    case_id: UUID,
    contributor: Contributor,
    payload: CitizenContactInitiate,
) -> ContactRequestResponse:
    """Allows a citizen to initiate contact with the research team for their case."""
    report = db.query(Report).filter(Report.id == case_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"SignalCase '{case_id}' not found.",
        )

    # Claim or verify ownership
    if report.contributor_id and report.contributor_id != contributor.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Cannot initiate contact on an observation submitted by another contributor.",
        )
    if not report.contributor_id:
        report.contributor_id = contributor.id

    now_utc = datetime.now(timezone.utc)
    req = ContactRequest(
        signal_case_id=report.id,
        contributor_id=contributor.id,
        initiated_by="CONTRIBUTOR",
        reason=payload.reason,
        message=payload.message,
        status="ACCEPTED",  # Citizen voluntarily provided direct information
        shared_email=payload.shared_email,
        shared_phone=payload.shared_phone,
        preferred_method=payload.preferred_method,
        contributor_note=payload.note,
        responded_at=now_utc,
    )
    db.add(req)

    lineage = EvidenceLineageEvent(
        signal_case_id=report.id,
        event_type="CITIZEN_CONTACT_INITIATED",
        actor_type="CITIZEN",
        actor_id=contributor.contributor_id,
        source_service="CitizenContactGateway",
        summary=f"Citizen initiated follow-up contact for reason '{payload.reason}'.",
        structured_payload_json={
            "request_id": str(req.id),
            "reason": payload.reason,
            "has_email": bool(payload.shared_email),
            "has_phone": bool(payload.shared_phone),
        },
    )
    db.add(lineage)
    db.commit()
    db.refresh(req)

    connection_manager.publish_event(
        event_type=RealtimeEventType.EVIDENCE_UPDATED,
        case_id=report.id,
        report_id=report.id,
        payload={"action": "CITIZEN_CONTACT_INITIATED", "request_id": str(req.id)},
    )

    return _serialize_request(req)
