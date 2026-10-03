"""
StreamSignal — Evidence Mission Agent Architecture
Urban Freshwater Evidence Collection & Provenance System

A bounded, state-machine-driven autonomous agent architecture for targeted
citizen evidence collection in urban freshwater ecosystems.

Key Architectural Guarantees:
1. Bounded State Machine: Enforces valid state transitions (DISCOVERING -> RESEARCH_REVIEW).
2. Tool Execution Firewall: Restricts agent operations to ALLOWED_AGENT_TOOLS.
3. StreamSignal Evidence Model: Preserves E1 to E5 provenance separation; never claims causation.
4. Local-First & Zero-Cost: Runs Ollama with JSON schema constraints or DeterministicRuleProvider.
5. Immutable Audit Trail: Every agent step is persisted in PostgreSQL agent_action_audits.
"""

from app.agent.orchestrator import EvidenceMissionAgent
from app.agent.providers import AgentModelProvider, get_agent_provider
from app.agent.registry import APPROVED_MISSION_TEMPLATES, list_approved_templates
from app.agent.state_machine import can_transition, enforce_transition
from app.agent.tools import (
    ALLOWED_AGENT_TOOLS,
    tool_get_evidence_gap,
    tool_plan_mission,
    tool_start_mission,
    tool_submit_mission_evidence,
    tool_validate_evidence,
)

__all__ = [
    "EvidenceMissionAgent",
    "AgentModelProvider",
    "get_agent_provider",
    "APPROVED_MISSION_TEMPLATES",
    "list_approved_templates",
    "can_transition",
    "enforce_transition",
    "ALLOWED_AGENT_TOOLS",
    "tool_get_evidence_gap",
    "tool_plan_mission",
    "tool_start_mission",
    "tool_validate_evidence",
    "tool_submit_mission_evidence",
]
