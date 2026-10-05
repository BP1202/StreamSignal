from datetime import datetime, timezone
from app.models.report import Report
from app.schemas.evidence_case import (
    CitizenEvidence,
    ContextualEvidenceSection,
    EvidenceCaseProvenance,
    EvidenceCaseResponse,
    HumanDecisionSection,
    LocationData,
    MachineAssistanceSection,
)
from app.schemas.media import ReportMediaResponse
from app.services.evidence_quality import assess_evidence_quality


def assemble_evidence_case(report: Report) -> EvidenceCaseResponse:
    """
    Transforms and aggregates existing citizen observations, media evidence,
    deterministic evidence quality assessment, interview state, and provenance
    into a single transparent, read-only Evidence Case view.

    The case strictly separates:
    1. Citizen Evidence (observed facts, descriptions, visual media)
    2. Machine Assistance (currently unpopulated / not_available)
    3. Contextual Evidence (currently unpopulated / not_available)
    4. Human Decision (pending expert review)
    5. Provenance (data origins and compilation timestamp)
    """
    # 1. Authoritative Evidence Quality assessment (Issue 3)
    quality_assessment = assess_evidence_quality(report)

    # 2. Extract media items safely using existing ReportMedia metadata
    media_items = [
        ReportMediaResponse.model_validate(item)
        for item in (getattr(report, "media", []) or [])
    ]

    # 3. Assemble Citizen Evidence
    citizen_evidence = CitizenEvidence(
        observation_time=report.observed_at,
        location=LocationData(
            latitude=report.latitude,
            longitude=report.longitude,
        ),
        description=report.description,
        water_appearance=report.water_appearance,
        odor=report.odor,
        flow_condition=report.flow_condition,
        foam_observed=report.foam_observed,
        litter_observed=report.litter_observed,
        dead_wildlife_observed=report.dead_wildlife_observed,
        media=media_items,
    )

    # 4. Assembled transparent case representation
    return EvidenceCaseResponse(
        case_id=report.id,
        report_id=report.id,
        status="pending_review",
        created_at=report.created_at,
        citizen_evidence=citizen_evidence,
        evidence_quality=quality_assessment,
        machine_assistance=MachineAssistanceSection(
            status="not_available",
            items=[],
        ),
        contextual_evidence=ContextualEvidenceSection(
            status="not_available",
            items=[],
        ),
        human_decision=HumanDecisionSection(
            status="pending",
            decision=None,
            reviewer=None,
            notes=None,
        ),
        provenance=EvidenceCaseProvenance(
            source="streamsignal",
            generated_at=datetime.now(timezone.utc),
            components=[
                "citizen_report",
                "report_media",
                "evidence_quality",
                "evidence_interview",
            ],
        ),
    )
