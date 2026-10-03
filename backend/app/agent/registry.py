"""
StreamSignal — Approved Mission Registry
Defines allowlisted, scientifically bounded mission templates.
Prevents the agent from inventing arbitrary or unvetted mission types.
"""

from typing import Any, Dict, List
from app.schemas.mission import MissionType

APPROVED_MISSION_TEMPLATES: Dict[MissionType, Dict[str, Any]] = {
    MissionType.AFTER_RAIN_STREAM_CHECK: {
        "title": "After-Rain Stream Check",
        "purpose": "Collect structured observations and media of a stream after rainfall to improve temporal evidence coverage.",
        "research_need": "Temporal comparison of stream conditions during and after precipitation events.",
        "research_need_source": "TEMPLATE",
        "required_evidence": ["photo", "flow_condition", "water_appearance", "foam_observed"],
        "micro_learning": "Flow and surface observations recorded after precipitation help researchers understand runoff dynamics and distinguish natural turbidity from persistent discharge.",
        "estimated_effort_minutes": 3,
    },
    MissionType.EVIDENCE_CLARIFICATION: {
        "title": "Evidence Clarification Mission",
        "purpose": "Collect targeted observations required to resolve an identified evidence gap in an existing SignalCase.",
        "research_need": "Fill documented missing physical dimensions to elevate evidence completeness.",
        "research_need_source": "SIGNAL_CASE_EVIDENCE_GAP",
        "required_evidence": ["flow_condition", "photo"],
        "micro_learning": "Clarifying missing physical dimensions like flow or context photos helps researchers evaluate spatial-temporal patterns without making speculative assumptions.",
        "estimated_effort_minutes": 2,
    },
    MissionType.PLACE_EVIDENCE_SNAPSHOT: {
        "title": "Place Evidence Snapshot",
        "purpose": "Collect current photographic media and structured observations from a specific freshwater monitoring site.",
        "research_need": "Baseline spatial evidence collection at designated freshwater monitoring coordinates.",
        "research_need_source": "RESEARCHER_REQUIREMENT",
        "required_evidence": ["photo", "water_appearance", "location"],
        "micro_learning": "Spot checks at specific geographic coordinates establish an auditable visual baseline for longitudinal One Health monitoring.",
        "estimated_effort_minutes": 3,
    },
}


def get_template_for_type(mission_type: MissionType) -> Dict[str, Any]:
    """Retrieves authoritative template for an approved mission type."""
    if mission_type not in APPROVED_MISSION_TEMPLATES:
        raise ValueError(f"Mission type '{mission_type}' is not in the approved mission registry.")
    return APPROVED_MISSION_TEMPLATES[mission_type]


def list_approved_templates() -> List[Dict[str, Any]]:
    """Returns list of all allowlisted mission templates with type keys."""
    return [
        {"mission_type": m_type.value, **template}
        for m_type, template in APPROVED_MISSION_TEMPLATES.items()
    ]
