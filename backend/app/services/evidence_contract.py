from datetime import datetime, timezone
from typing import List

from app.models.report import Report
from app.schemas.evidence_contract import (
    AllowedAction,
    EvidenceClaim,
    EvidenceClass,
    EvidenceContractProvenance,
    EvidenceContractResponse,
    ProhibitedInterpretation,
)

STANDARD_PROHIBITED = [
    ProhibitedInterpretation.POLLUTION_CONFIRMED,
    ProhibitedInterpretation.TOXICITY_CONFIRMED,
    ProhibitedInterpretation.HEALTH_RISK_CONFIRMED,
    ProhibitedInterpretation.CAUSE_CONFIRMED,
]

STANDARD_E1_ACTIONS = [
    AllowedAction.MONITOR,
    AllowedAction.REQUEST_MORE_EVIDENCE,
    AllowedAction.EXPERT_REVIEW,
]


def assemble_evidence_contract(report: Report) -> EvidenceContractResponse:
    """
    Evaluates authoritative application records for a report and produces
    the deterministic SignalGuard Evidence Trust Contract.

    Explicitly bounds:
    - Evidence classification (E1_REPORTED vs E2_OBSERVED; no premature E3/E4/E5)
    - Provenance source field
    - Explicit uncertainty boundaries
    - Permitted follow-up actions
    - Strictly prohibited interpretations (anti-hallucination / anti-overinterpretation)
    """
    claims: List[EvidenceClaim] = []

    # 1. Citizen Description
    if report.description:
        claims.append(
            EvidenceClaim(
                claim_id=f"{report.id}-citizen-description",
                claim=f'Citizen reported: "{report.description}"',
                evidence_class=EvidenceClass.E1_REPORTED,
                source="report.description",
                support=["citizen_report"],
                uncertainty=["Citizen-reported observation; independent verification is unavailable."],
                allowed_actions=STANDARD_E1_ACTIONS,
                prohibited_interpretations=STANDARD_PROHIBITED,
            )
        )

    # 2. Water Appearance
    if report.water_appearance:
        formatted_appearance = report.water_appearance.replace("_", " ")
        claims.append(
            EvidenceClaim(
                claim_id=f"{report.id}-water-appearance",
                claim=f"Citizen reported water appearance: {formatted_appearance}.",
                evidence_class=EvidenceClass.E1_REPORTED,
                source="report.water_appearance",
                support=["citizen_report"],
                uncertainty=["Citizen-reported observation; independent verification is unavailable."],
                allowed_actions=STANDARD_E1_ACTIONS,
                prohibited_interpretations=STANDARD_PROHIBITED,
            )
        )

    # 3. Flow Condition
    if report.flow_condition:
        formatted_flow = report.flow_condition.replace("_", " ")
        claims.append(
            EvidenceClaim(
                claim_id=f"{report.id}-flow-condition",
                claim=f"Citizen reported flow condition: {formatted_flow}.",
                evidence_class=EvidenceClass.E1_REPORTED,
                source="report.flow_condition",
                support=["citizen_report"],
                uncertainty=["Citizen-reported observation; independent verification is unavailable."],
                allowed_actions=STANDARD_E1_ACTIONS,
                prohibited_interpretations=STANDARD_PROHIBITED,
            )
        )

    # 4. Odor
    if report.odor:
        formatted_odor = report.odor.replace("_", " ")
        claims.append(
            EvidenceClaim(
                claim_id=f"{report.id}-odor",
                claim=f"Citizen reported odor: {formatted_odor}.",
                evidence_class=EvidenceClass.E1_REPORTED,
                source="report.odor",
                support=["citizen_report"],
                uncertainty=["Citizen-reported observation; independent verification is unavailable."],
                allowed_actions=STANDARD_E1_ACTIONS,
                prohibited_interpretations=STANDARD_PROHIBITED,
            )
        )

    # 5. Foam Observation (Affirmative true only)
    if report.foam_observed is True:
        claims.append(
            EvidenceClaim(
                claim_id=f"{report.id}-foam-observed",
                claim="Citizen reported observing unnatural foam on the water surface.",
                evidence_class=EvidenceClass.E1_REPORTED,
                source="report.foam_observed",
                support=["citizen_report"],
                uncertainty=["Citizen-reported observation; independent verification is unavailable."],
                allowed_actions=STANDARD_E1_ACTIONS,
                prohibited_interpretations=STANDARD_PROHIBITED,
            )
        )

    # 6. Litter Observation (Affirmative true only)
    if report.litter_observed is True:
        claims.append(
            EvidenceClaim(
                claim_id=f"{report.id}-litter-observed",
                claim="Citizen reported observing visible trash or debris in or near the water.",
                evidence_class=EvidenceClass.E1_REPORTED,
                source="report.litter_observed",
                support=["citizen_report"],
                uncertainty=["Citizen-reported observation; independent verification is unavailable."],
                allowed_actions=STANDARD_E1_ACTIONS,
                prohibited_interpretations=STANDARD_PROHIBITED,
            )
        )

    # 7. Dead Wildlife Observation (Affirmative true only)
    if report.dead_wildlife_observed is True:
        claims.append(
            EvidenceClaim(
                claim_id=f"{report.id}-dead-wildlife-observed",
                claim="Citizen reported observing dead aquatic life or wildlife.",
                evidence_class=EvidenceClass.E1_REPORTED,
                source="report.dead_wildlife_observed",
                support=["citizen_report"],
                uncertainty=["Citizen-reported observation; independent verification is unavailable."],
                allowed_actions=[
                    AllowedAction.MONITOR,
                    AllowedAction.REQUEST_MORE_EVIDENCE,
                    AllowedAction.EXPERT_REVIEW,
                    AllowedAction.FIELD_VERIFICATION,
                ],
                prohibited_interpretations=STANDARD_PROHIBITED,
            )
        )

    # 8. Media Evidence (Deterministic ordering by created_at, id)
    media_items = sorted(
        getattr(report, "media", []) or [],
        key=lambda m: (m.created_at or datetime.min.replace(tzinfo=timezone.utc), str(m.id)),
    )
    for media in media_items:
        claims.append(
            EvidenceClaim(
                claim_id=f"{report.id}-media-{media.id}",
                claim=f"Visual media evidence was submitted with this report ({media.original_filename}, {media.content_type}).",
                evidence_class=EvidenceClass.E2_OBSERVED,
                source="report_media",
                support=[
                    f"media_id:{media.id}",
                    f"sha256:{media.sha256}",
                    f"content_type:{media.content_type}",
                ],
                uncertainty=[
                    "Media presence does not establish the environmental meaning, cause, or chemical identity of the image."
                ],
                allowed_actions=STANDARD_E1_ACTIONS,
                prohibited_interpretations=STANDARD_PROHIBITED,
            )
        )

    return EvidenceContractResponse(
        report_id=report.id,
        case_id=report.id,
        status="pending_review",
        claims=claims,
        provenance=EvidenceContractProvenance(
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
