"""
StreamSignal — FHIR R4 Bundle Export Service (Track 7 Interoperability)
Maps authentic StreamSignal SignalCases into a standards-compliant FHIR R4 Bundle.
Preserves strict scientific and semantic boundaries:
1. Citizen observation is isolated as QuestionnaireResponse and E1 Observation.
2. Machine vision cues are isolated as E3 Observations with explicit uncertainty bounds.
3. Historical corroboration (Pattern Echo) is isolated as E4 Observation.
4. Human review actions are mapped to Task (e.g. REQUEST_FIELD_VERIFICATION -> status='requested').
5. Evidence lineage is mapped to Provenance with auditable agent attribution.
6. Zero hallucination / no clinical claims / no server disk path leaks.
"""

from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional
from uuid import NAMESPACE_DNS, UUID, uuid5
from sqlalchemy.orm import Session, joinedload

from app.models.report import Report
from app.schemas.fhir import (
    FHIRAnnotation,
    FHIRAttachment,
    FHIRBundle,
    FHIRBundleEntry,
    FHIRCodeableConcept,
    FHIRCoding,
    FHIRLocation,
    FHIRMedia,
    FHIRObservation,
    FHIRPosition,
    FHIRProvenance,
    FHIRProvenanceAgent,
    FHIRQuestionAnswer,
    FHIRQuestionItem,
    FHIRQuestionnaireResponse,
    FHIRReference,
    FHIRTask,
)
from app.schemas.research import HumanReviewOutcome
from app.services.contextual_evidence import evaluate_pattern_echo
from app.services.media_observation import extract_report_media_observations
from app.services.review import get_case_lineage, get_case_reviews
from app.services.storage import get_storage


def generate_fhir_bundle(db: Session, case_id: UUID) -> Optional[FHIRBundle]:
    """
    Generates a deterministic FHIR R4 collection bundle for the given SignalCase.
    Returns None if the report is not found.
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
    bundle_entries: List[FHIRBundleEntry] = []
    bundle_id = f"bundle-{report.id}"
    now_utc = datetime.now(timezone.utc).isoformat()

    # 1. Location Resource
    loc_id = f"loc-{report.id}"
    loc_ref = f"Location/{loc_id}"
    location_resource = FHIRLocation(
        id=loc_id,
        status="active",
        name="Freshwater Observation Site",
        description="Geographic site of reported citizen freshwater observation",
        position=FHIRPosition(
            latitude=float(report.latitude),
            longitude=float(report.longitude),
        ),
    )
    bundle_entries.append(
        FHIRBundleEntry(
            fullUrl=f"urn:uuid:{uuid5(NAMESPACE_DNS, f'Location/{loc_id}')}",
            resource=location_resource.model_dump(exclude_none=True),
        )
    )

    # 2. QuestionnaireResponse Resource (Raw Citizen Survey)
    qr_id = f"qr-{report.id}"
    qr_ref = f"QuestionnaireResponse/{qr_id}"
    qr_items: List[FHIRQuestionItem] = [
        FHIRQuestionItem(
            linkId="description",
            text="Citizen Narrative Observation",
            answer=[FHIRQuestionAnswer(valueString=report.description)],
        )
    ]
    if report.water_appearance:
        qr_items.append(
            FHIRQuestionItem(
                linkId="water_appearance",
                text="Water Appearance",
                answer=[FHIRQuestionAnswer(valueString=report.water_appearance)],
            )
        )
    if report.flow_condition:
        qr_items.append(
            FHIRQuestionItem(
                linkId="flow_condition",
                text="Flow Condition",
                answer=[FHIRQuestionAnswer(valueString=report.flow_condition)],
            )
        )
    if report.odor:
        qr_items.append(
            FHIRQuestionItem(
                linkId="odor",
                text="Odor Description",
                answer=[FHIRQuestionAnswer(valueString=report.odor)],
            )
        )
    qr_items.extend(
        [
            FHIRQuestionItem(
                linkId="foam_observed",
                text="Surface Foam Observed",
                answer=[FHIRQuestionAnswer(valueBoolean=bool(report.foam_observed))],
            ),
            FHIRQuestionItem(
                linkId="litter_observed",
                text="Litter Observed",
                answer=[FHIRQuestionAnswer(valueBoolean=bool(report.litter_observed))],
            ),
            FHIRQuestionItem(
                linkId="dead_wildlife_observed",
                text="Dead Wildlife Observed",
                answer=[FHIRQuestionAnswer(valueBoolean=bool(report.dead_wildlife_observed))],
            ),
        ]
    )

    qr_resource = FHIRQuestionnaireResponse(
        id=qr_id,
        status="completed",
        subject=FHIRReference(reference=loc_ref, display="Observation Site"),
        authored=report.observed_at.isoformat(),
        author=FHIRReference(reference="Practitioner/citizen-reporter", display="Citizen Reporter"),
        item=qr_items,
    )
    bundle_entries.append(
        FHIRBundleEntry(
            fullUrl=f"urn:uuid:{uuid5(NAMESPACE_DNS, f'QuestionnaireResponse/{qr_id}')}",
            resource=qr_resource.model_dump(exclude_none=True),
        )
    )

    # 3. Primary Citizen Observation (E1_REPORTED)
    citizen_obs_id = f"obs-citizen-{report.id}"
    citizen_obs_ref = f"Observation/{citizen_obs_id}"
    citizen_obs_resource = FHIRObservation(
        id=citizen_obs_id,
        status="preliminary",
        category=[
            FHIRCodeableConcept(
                coding=[
                    FHIRCoding(
                        system="http://terminology.hl7.org/CodeSystem/observation-category",
                        code="survey",
                        display="Survey",
                    )
                ],
                text="Citizen Environmental Survey",
            )
        ],
        code=FHIRCodeableConcept(
            coding=[
                FHIRCoding(
                    system="https://streamsignal.org/fhir/codes",
                    code="citizen-freshwater-observation",
                    display="Citizen Freshwater Observation",
                )
            ],
            text="Citizen Reported Freshwater Narrative",
        ),
        subject=FHIRReference(reference=loc_ref, display="Observation Site"),
        effectiveDateTime=report.observed_at.isoformat(),
        performer=[FHIRReference(reference="Practitioner/citizen-reporter", display="Citizen Observer")],
        valueString=report.description,
        interpretation=[
            FHIRCodeableConcept(
                coding=[
                    FHIRCoding(
                        system="https://streamsignal.org/fhir/evidence-class",
                        code="E1_REPORTED",
                        display="Citizen Reported Observational Evidence",
                    )
                ],
                text="Baseline citizen observation; unconfirmed by laboratory or clinical testing.",
            )
        ],
        derivedFrom=[FHIRReference(reference=qr_ref, display="Citizen Survey QuestionnaireResponse")],
    )
    bundle_entries.append(
        FHIRBundleEntry(
            fullUrl=f"urn:uuid:{uuid5(NAMESPACE_DNS, f'Observation/{citizen_obs_id}')}",
            resource=citizen_obs_resource.model_dump(exclude_none=True),
        )
    )

    # 4. Media Resources (Safe metadata only, no server disk path leaks)
    media_references: Dict[UUID, str] = {}
    for item in (getattr(report, "media", []) or []):
        media_id_str = f"med-{item.id}"
        media_ref = f"Media/{media_id_str}"
        media_references[item.id] = media_ref

        media_resource = FHIRMedia(
            id=media_id_str,
            status="completed",
            type=FHIRCodeableConcept(
                coding=[
                    FHIRCoding(
                        system="http://terminology.hl7.org/CodeSystem/media-type",
                        code="image",
                        display="Image",
                    )
                ]
            ),
            subject=FHIRReference(reference=loc_ref, display="Observation Site"),
            createdDateTime=item.created_at.isoformat() if hasattr(item, "created_at") and item.created_at else report.created_at.isoformat(),
            content=FHIRAttachment(
                contentType=item.content_type,
                url=f"/api/v1/reports/{report.id}/media/{item.id}",
                size=item.size_bytes,
                hash=item.sha256,
                title=item.original_filename,
            ),
        )
        bundle_entries.append(
            FHIRBundleEntry(
                fullUrl=f"urn:uuid:{uuid5(NAMESPACE_DNS, f'Media/{media_id_str}')}",
                resource=media_resource.model_dump(exclude_none=True),
            )
        )

    # 5. Machine Observation Resources (E3_INFERRED)
    media_obs_res = extract_report_media_observations(report=report, storage=storage)
    if media_obs_res:
        for media_group in media_obs_res.media:
            parent_media_ref = media_references.get(media_group.media_id)
            for obs in media_group.observations:
                obs_id_str = f"obs-machine-{obs.observation_id}"
                machine_obs_resource = FHIRObservation(
                    id=obs_id_str,
                    status="preliminary",
                    category=[
                        FHIRCodeableConcept(
                            coding=[
                                FHIRCoding(
                                    system="http://terminology.hl7.org/CodeSystem/observation-category",
                                    code="imaging",
                                    display="Imaging",
                                )
                            ],
                            text="Automated Visual Feature Inference",
                        )
                    ],
                    code=FHIRCodeableConcept(
                        coding=[
                            FHIRCoding(
                                system="https://streamsignal.org/fhir/observation-type",
                                code=obs.observation_type.value,
                                display=obs.observation_type.value.replace("_", " ").title(),
                            )
                        ],
                        text=f"Detected Visual Cue: {obs.observation_type.value}",
                    ),
                    subject=FHIRReference(reference=loc_ref, display="Observation Site"),
                    effectiveDateTime=report.observed_at.isoformat(),
                    performer=[
                        FHIRReference(
                            reference="Device/streamsignal-vision-pipeline",
                            display="StreamSignal Automated Visual Feature Extractor",
                        )
                    ],
                    valueString=obs.description,
                    interpretation=[
                        FHIRCodeableConcept(
                            coding=[
                                FHIRCoding(
                                    system="https://streamsignal.org/fhir/evidence-class",
                                    code="E3_INFERRED",
                                    display="Machine Inferred Visual Cue",
                                )
                            ],
                            text="Visual cue only; does not establish biological identity or toxicity.",
                        )
                    ],
                    note=[
                        FHIRAnnotation(
                            text=f"Uncertainty: {obs.uncertainty}. Machine vision observations indicate visible cues only and do not establish biological identity, toxicity, or environmental causation."
                        )
                    ],
                    derivedFrom=[FHIRReference(reference=parent_media_ref)] if parent_media_ref else [],
                )
                bundle_entries.append(
                    FHIRBundleEntry(
                        fullUrl=f"urn:uuid:{uuid5(NAMESPACE_DNS, f'Observation/{obs_id_str}')}",
                        resource=machine_obs_resource.model_dump(exclude_none=True),
                    )
                )

    # 6. Contextual Corroboration Resource (E4_CORROBORATED)
    pattern_echo = evaluate_pattern_echo(report=report, db=db, storage=storage)
    if pattern_echo and len(pattern_echo.matches) > 0:
        context_obs_id = f"obs-context-{report.id}"
        context_obs_resource = FHIRObservation(
            id=context_obs_id,
            status="preliminary",
            category=[
                FHIRCodeableConcept(
                    coding=[
                        FHIRCoding(
                            system="http://terminology.hl7.org/CodeSystem/observation-category",
                            code="spatial-temporal-pattern",
                            display="Pattern Echo",
                        )
                    ]
                )
            ],
            code=FHIRCodeableConcept(
                coding=[
                    FHIRCoding(
                        system="https://streamsignal.org/fhir/codes",
                        code="contextual-pattern-echo",
                        display="Historical Spatial/Temporal Pattern Corroboration",
                    )
                ],
                text="Historical Spatial/Temporal Pattern Recurrence",
            ),
            subject=FHIRReference(reference=loc_ref, display="Observation Site"),
            effectiveDateTime=report.observed_at.isoformat(),
            performer=[
                FHIRReference(
                    reference="Device/streamsignal-pattern-echo",
                    display="StreamSignal Pattern Echo Engine",
                )
            ],
            valueString=pattern_echo.summary,
            interpretation=[
                FHIRCodeableConcept(
                    coding=[
                        FHIRCoding(
                            system="https://streamsignal.org/fhir/evidence-class",
                            code="E4_CORROBORATED",
                            display="Contextually Corroborated Pattern",
                        )
                    ],
                    text="Corroborated by independent historical reports in vicinity; not confirmed clinical or environmental causation.",
                )
            ],
            note=[
                FHIRAnnotation(
                    text="Historical recurrence indicates spatial/temporal pattern similarity, not environmental causation."
                )
            ],
            derivedFrom=[FHIRReference(reference=citizen_obs_ref)],
        )
        bundle_entries.append(
            FHIRBundleEntry(
                fullUrl=f"urn:uuid:{uuid5(NAMESPACE_DNS, f'Observation/{context_obs_id}')}",
                resource=context_obs_resource.model_dump(exclude_none=True),
            )
        )

    # 7. Human Review Task Resources (Preserving E4 != E5, requested != completed)
    reviews_res = get_case_reviews(db=db, case_id=case_id)
    for review in reviews_res.reviews:
        task_id = f"task-{review.id}"
        # Determine Task status and intent according to outcome
        is_requested = review.outcome == HumanReviewOutcome.REQUEST_FIELD_VERIFICATION
        task_status = "requested" if is_requested else "completed"
        task_intent = "order"

        task_resource = FHIRTask(
            id=task_id,
            status=task_status,
            intent=task_intent,
            code=FHIRCodeableConcept(
                coding=[
                    FHIRCoding(
                        system="https://streamsignal.org/fhir/review-outcome",
                        code=review.outcome.value,
                        display=review.outcome.value.replace("_", " ").title(),
                    )
                ],
                text=f"Human Decision Outcome: {review.outcome.value}",
            ),
            description=review.rationale or f"Human review outcome: {review.outcome.value}",
            focus=FHIRReference(reference=citizen_obs_ref, display="Citizen Observation"),
            authoredOn=review.created_at.isoformat(),
            lastModified=review.created_at.isoformat(),
            requester=FHIRReference(
                reference=f"Practitioner/{review.reviewer_id}" if review.reviewer_id else "Practitioner/expert-reviewer",
                display=f"Expert Reviewer: {review.reviewer_id or 'Unknown'}",
            ),
        )
        bundle_entries.append(
            FHIRBundleEntry(
                fullUrl=f"urn:uuid:{uuid5(NAMESPACE_DNS, f'Task/{task_id}')}",
                resource=task_resource.model_dump(exclude_none=True),
            )
        )

    # 8. Provenance Resources (Directly from immutable Evidence Lineage)
    lineage_res = get_case_lineage(db=db, case_id=case_id)
    for ev in lineage_res.events:
        prov_id = f"prov-{ev.id}"
        event_type_str = ev.event_type.value if hasattr(ev.event_type, "value") else str(ev.event_type)
        actor_type_str = ev.actor_type.value if hasattr(ev.actor_type, "value") else str(ev.actor_type)
        agent_type = actor_type_str.lower()
        who_ref = (
            f"Practitioner/{ev.actor_id}"
            if actor_type_str in ["HUMAN", "EXPERT", "CITIZEN"]
            else f"Device/{ev.actor_id}"
        )

        prov_resource = FHIRProvenance(
            id=prov_id,
            target=[FHIRReference(reference=citizen_obs_ref)],
            recorded=ev.created_at.isoformat(),
            activity=FHIRCodeableConcept(
                coding=[
                    FHIRCoding(
                        system="https://streamsignal.org/fhir/lineage-event",
                        code=event_type_str,
                        display=ev.summary,
                    )
                ],
                text=ev.summary,
            ),
            agent=[
                FHIRProvenanceAgent(
                    type=FHIRCodeableConcept(
                        coding=[
                            FHIRCoding(
                                system="http://terminology.hl7.org/CodeSystem/provenance-participant-type",
                                code=agent_type,
                            )
                        ]
                    ),
                    who=FHIRReference(reference=who_ref, display=f"{actor_type_str}: {ev.actor_id}"),
                )
            ],
        )
        bundle_entries.append(
            FHIRBundleEntry(
                fullUrl=f"urn:uuid:{uuid5(NAMESPACE_DNS, f'Provenance/{prov_id}')}",
                resource=prov_resource.model_dump(exclude_none=True),
            )
        )

    # 9. Assemble Bundle
    return FHIRBundle(
        id=bundle_id,
        type="collection",
        timestamp=now_utc,
        total=len(bundle_entries),
        entry=bundle_entries,
    )


def validate_fhir_bundle(bundle: FHIRBundle) -> List[str]:
    """
    Validates the generated FHIR Bundle for standards compliance,
    internal reference resolution, and zero security / disk path leaks.
    Returns a list of error strings; an empty list indicates full validity.
    """
    errors: List[str] = []

    if bundle.resourceType != "Bundle":
        errors.append(f"Expected resourceType 'Bundle', found '{bundle.resourceType}'")
    if bundle.type != "collection":
        errors.append(f"Expected bundle type 'collection', found '{bundle.type}'")
    if bundle.total != len(bundle.entry):
        errors.append(f"Bundle total ({bundle.total}) does not match entry count ({len(bundle.entry)})")

    # Collect all available resource relative identifiers in bundle
    available_refs = set()
    for e in bundle.entry:
        r = e.resource
        r_type = r.get("resourceType")
        r_id = r.get("id")
        if not r_type or not r_id:
            errors.append(f"Entry {e.fullUrl} is missing resourceType or id")
        else:
            available_refs.add(f"{r_type}/{r_id}")

    # Regex to catch windows or unix disk paths
    path_regex = re.compile(r"([A-Za-z]:\\[^ \t\n\r\"]+|/(?:tmp|var|home|usr|etc)/[^ \t\n\r\"]+)")

    def inspect_item(item: Any, path: str = ""):
        if isinstance(item, str):
            # Check for path leaks
            if path_regex.search(item):
                errors.append(f"Security leak detected at {path}: raw filesystem path '{item}'")
        elif isinstance(item, dict):
            # Check references
            if "reference" in item and isinstance(item["reference"], str):
                ref_str = item["reference"]
                # If it's an internal reference, verify it's resolved or in well-known external sets
                if "/" in ref_str:
                    res_prefix = ref_str.split("/")[0]
                    if res_prefix in ["Location", "QuestionnaireResponse", "Observation", "Media", "Task", "Provenance"]:
                        if ref_str not in available_refs:
                            errors.append(f"Unresolved internal reference at {path}: '{ref_str}'")
            for k, v in item.items():
                inspect_item(v, f"{path}.{k}" if path else k)
        elif isinstance(item, list):
            for i, elem in enumerate(item):
                inspect_item(elem, f"{path}[{i}]")

    for idx, e in enumerate(bundle.entry):
        inspect_item(e.resource, f"entry[{idx}]")

    return errors
