from typing import Any, Dict, List
from uuid import UUID
from app.schemas.evidence_quality import EvidenceQualityLevel, EvidenceQualityResponse

# Core evidence required for an observation to be considered actionable
CORE_DIMENSIONS: List[str] = [
    "observation_time",
    "location",
    "description",
]

# Qualitative contextual dimensions expected for full observational context
CONTEXTUAL_DIMENSIONS: List[str] = [
    "water_appearance",
    "flow_condition",
    "odor",
]

# Baseline dimensions evaluated for completeness scoring (3 core + 3 contextual = 6)
BASELINE_DIMENSIONS: List[str] = CORE_DIMENSIONS + CONTEXTUAL_DIMENSIONS

# Deterministic recommendations tied directly to missing evidence dimensions.
# Recommendations guide further citizen evidence documentation without making
# claims of contamination, toxicity, causation, or disease risk.
RECOMMENDATIONS_MAP: Dict[str, str] = {
    "observation_time": "Record the date and time when the observation occurred.",
    "location": "Provide valid GPS coordinates (latitude and longitude) for the observation site.",
    "description": "Provide a clear description of what changed or what you observed.",
    "water_appearance": "Describe the visible appearance of the water, including unusual color, surface material, or clarity.",
    "flow_condition": "Document whether the water is flowing, stagnant, or unusually slow.",
    "odor": "Document whether any unusual odor was noticed.",
}


def assess_evidence_quality(report: Any) -> EvidenceQualityResponse:
    """
    Deterministically assesses the evidence completeness of a citizen report.

    Evaluation Dimensions:
    1. Core Evidence:
       - observation_time (observed_at is valid datetime)
       - location (latitude and longitude are non-null within valid coordinates)
       - description (non-empty description string >= 3 characters)
    2. Contextual Observation Evidence:
       - water_appearance (non-empty string)
       - flow_condition (non-empty string)
       - odor (non-empty string)
    3. Positive Indicator Observations:
       - foam_observation (explicitly documented when foam_observed is True)
       - litter_observation (explicitly documented when litter_observed is True)
       - dead_wildlife_observation (explicitly documented when dead_wildlife_observed is True)

    Important Schema Limitation & Boolean Semantics:
    In the current relational schema, foam_observed, litter_observed, and
    dead_wildlife_observed default to False (non-nullable boolean).
    A False value does NOT signify that a citizen verified the absence of foam,
    litter, or dead wildlife; it indicates only that the flag was not affirmed.
    Consequently, False is not counted as verified absence in 'present', nor is it
    penalized as 'missing baseline evidence'. Only affirmative observations (True)
    are added to 'present' as documented evidence.

    Quality Tiers:
    - INSUFFICIENT: One or more core evidence requirements are missing.
    - PARTIAL: All core evidence exists, but one or more contextual fields are missing.
    - COMPLETE: Core evidence exists and all standard contextual fields are documented.

    Score:
    A deterministic evidence completeness ratio in [0.0, 1.0] representing
    the proportion of baseline observational dimensions documented.
    This score measures evidence documentation completeness and must NEVER be
    interpreted as scientific certainty, probability of contamination, or disease risk.
    """
    present: List[str] = []

    # 1. Evaluate Core Evidence
    observed_at = getattr(report, "observed_at", None)
    if observed_at is not None:
        present.append("observation_time")

    lat = getattr(report, "latitude", None)
    lon = getattr(report, "longitude", None)
    if lat is not None and lon is not None and -90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0:
        present.append("location")

    desc = getattr(report, "description", None)
    if desc is not None and isinstance(desc, str) and len(desc.strip()) >= 3:
        present.append("description")

    # 2. Evaluate Contextual Evidence
    water_app = getattr(report, "water_appearance", None)
    if water_app is not None and isinstance(water_app, str) and len(water_app.strip()) > 0:
        present.append("water_appearance")

    flow_cond = getattr(report, "flow_condition", None)
    if flow_cond is not None and isinstance(flow_cond, str) and len(flow_cond.strip()) > 0:
        present.append("flow_condition")

    odor = getattr(report, "odor", None)
    if odor is not None and isinstance(odor, str) and len(odor.strip()) > 0:
        present.append("odor")

    # 3. Evaluate Affirmative Indicator Observations
    if getattr(report, "foam_observed", False) is True:
        present.append("foam_observation")

    if getattr(report, "litter_observed", False) is True:
        present.append("litter_observation")

    if getattr(report, "dead_wildlife_observed", False) is True:
        present.append("dead_wildlife_observation")

    # Determine missing baseline dimensions
    missing = [dim for dim in BASELINE_DIMENSIONS if dim not in present]

    # Deterministic recommendations mapped directly from missing dimensions
    recommendations = [RECOMMENDATIONS_MAP[dim] for dim in missing if dim in RECOMMENDATIONS_MAP]

    # Evaluate completeness quality tier
    core_missing = [dim for dim in CORE_DIMENSIONS if dim not in present]
    contextual_missing = [dim for dim in CONTEXTUAL_DIMENSIONS if dim not in present]

    if core_missing:
        quality = EvidenceQualityLevel.INSUFFICIENT
    elif contextual_missing:
        quality = EvidenceQualityLevel.PARTIAL
    else:
        quality = EvidenceQualityLevel.COMPLETE

    # Completeness score: proportion of the 6 baseline dimensions present
    baseline_present_count = len([dim for dim in BASELINE_DIMENSIONS if dim in present])
    score = round(baseline_present_count / len(BASELINE_DIMENSIONS), 2)

    report_id = getattr(report, "id", None)
    if isinstance(report_id, str):
        report_id = UUID(report_id)

    return EvidenceQualityResponse(
        report_id=report_id,
        quality=quality,
        score=score,
        present=present,
        missing=missing,
        recommendations=recommendations,
    )
