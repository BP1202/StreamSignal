"""
StreamSignal — In-Process Realtime Event Service
Manages WebSocket connections for Research Workspace and Citizen Aqua App.
Adheres strictly to the architectural constraints of Issue 14:
- In-process ConnectionManager (no Redis, Kafka, or Socket.IO).
- Event publishing strictly post-transaction-commit.
- Notification transport only (database and REST remain source of truth).
- Strict citizen data privacy (no reviewer notes, rationales, or coordinates to citizen sockets).
- Tolerates 0, 1, or N connected clients without disrupting persistence.
"""

import asyncio
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional, Set, Union
from uuid import UUID
from fastapi import WebSocket

logger = logging.getLogger("streamsignal.realtime")


class RealtimeEventType(str, Enum):
    SIGNAL_CASE_CREATED = "SIGNAL_CASE_CREATED"
    EVIDENCE_UPDATED = "EVIDENCE_UPDATED"
    TRIAGE_UPDATED = "TRIAGE_UPDATED"
    HUMAN_REVIEW_RECORDED = "HUMAN_REVIEW_RECORDED"
    CITIZEN_IMPACT_UPDATED = "CITIZEN_IMPACT_UPDATED"
    MISSION_CREATED = "MISSION_CREATED"
    MISSION_UPDATED = "MISSION_UPDATED"
    MISSION_SUBMITTED = "MISSION_SUBMITTED"


class ConnectionManager:
    """
    In-memory connection manager for WebSocket clients.
    Partitioned into:
    1. Research workspace connections (receives global SignalCase events)
    2. Citizen connections keyed by report_id (receives only safe citizen impact updates)
    """

    def __init__(self) -> None:
        self._research_connections: Set[WebSocket] = set()
        self._citizen_connections: Dict[str, Set[WebSocket]] = {}
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def register_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Stores a reference to the active event loop for cross-thread scheduling."""
        self._loop = loop

    async def connect_research(self, websocket: WebSocket) -> None:
        """Accepts and tracks a research workspace WebSocket."""
        await websocket.accept()
        self._research_connections.add(websocket)
        self.register_loop(asyncio.get_running_loop())
        logger.info("Research WebSocket connected. Total active: %d", len(self._research_connections))

    async def disconnect_research(self, websocket: WebSocket) -> None:
        """Removes a disconnected research WebSocket."""
        self._research_connections.discard(websocket)
        logger.info("Research WebSocket disconnected. Total active: %d", len(self._research_connections))

    async def connect_citizen(self, report_id: str, websocket: WebSocket) -> None:
        """Accepts and tracks a citizen WebSocket scoped strictly to report_id."""
        await websocket.accept()
        if report_id not in self._citizen_connections:
            self._citizen_connections[report_id] = set()
        self._citizen_connections[report_id].add(websocket)
        self.register_loop(asyncio.get_running_loop())
        logger.info(
            "Citizen WebSocket connected for report %s. Active on report: %d",
            report_id,
            len(self._citizen_connections[report_id]),
        )

    async def disconnect_citizen(self, report_id: str, websocket: WebSocket) -> None:
        """Removes a citizen WebSocket."""
        if report_id in self._citizen_connections:
            self._citizen_connections[report_id].discard(websocket)
            if not self._citizen_connections[report_id]:
                del self._citizen_connections[report_id]
        logger.info("Citizen WebSocket disconnected for report %s", report_id)

    async def _broadcast_research(self, event_dict: Dict[str, Any]) -> None:
        """Sends an event to all active research connections, pruning dead sockets."""
        dead_sockets: Set[WebSocket] = set()
        for ws in list(self._research_connections):
            try:
                await ws.send_json(event_dict)
            except Exception as exc:
                logger.warning("Failed sending to research socket: %s. Pruning.", exc)
                dead_sockets.add(ws)

        for dead in dead_sockets:
            self._research_connections.discard(dead)

    async def _send_citizen(self, report_id: str, event_dict: Dict[str, Any]) -> None:
        """Sends a scoped event to citizen sockets listening for report_id, pruning dead sockets."""
        connections = self._citizen_connections.get(report_id, set())
        dead_sockets: Set[WebSocket] = set()
        for ws in list(connections):
            try:
                await ws.send_json(event_dict)
            except Exception as exc:
                logger.warning("Failed sending to citizen socket for report %s: %s. Pruning.", report_id, exc)
                dead_sockets.add(ws)

        for dead in dead_sockets:
            connections.discard(dead)

        if report_id in self._citizen_connections and not self._citizen_connections[report_id]:
            del self._citizen_connections[report_id]

    def publish_event(
        self,
        event_type: RealtimeEventType,
        case_id: Union[UUID, str],
        report_id: Union[UUID, str],
        payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Thread-safe entry point to publish a domain event post-database-commit.
        Constructs the authoritative event envelope and schedules transmission.
        Failure to publish never interrupts or rolls back database state.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        event_data: Dict[str, Any] = {
            "event_type": event_type.value,
            "case_id": str(case_id),
            "report_id": str(report_id),
            "occurred_at": now_iso,
            "payload": payload or {},
        }

        async def _dispatch() -> None:
            if event_type == RealtimeEventType.CITIZEN_IMPACT_UPDATED:
                # Scoped to the specific citizen's observation socket
                await self._send_citizen(str(report_id), event_data)
            else:
                # Global signal case / research inbox notification
                await self._broadcast_research(event_data)

        # Determine how to run the coroutine
        target_loop = self._loop
        try:
            running_loop = asyncio.get_running_loop()
        except RuntimeError:
            running_loop = None

        if running_loop and running_loop.is_running():
            asyncio.create_task(_dispatch())
        elif target_loop and target_loop.is_running():
            asyncio.run_coroutine_threadsafe(_dispatch(), target_loop)
        else:
            logger.debug(
                "No active event loop available to publish event %s. Buffered or dropped cleanly.",
                event_type.value,
            )


# Global singleton connection manager instance
connection_manager = ConnectionManager()
