"""
StreamSignal — Realtime WebSocket Endpoints
Provides WebSocket routes for:
1. /ws/research: Live research evidence workspace events.
2. /ws/citizen/{report_id}: Targeted citizen observation status updates.
"""

import logging
from uuid import UUID
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.realtime import connection_manager

logger = logging.getLogger("streamsignal.realtime.api")
router = APIRouter(tags=["Realtime"])


@router.websocket("/ws/research")
async def websocket_research(websocket: WebSocket):
    """
    WebSocket endpoint for Research Evidence Workspace.
    Broadcasts real-time events: SIGNAL_CASE_CREATED, EVIDENCE_UPDATED,
    TRIAGE_UPDATED, HUMAN_REVIEW_RECORDED.
    """
    await connection_manager.connect_research(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await connection_manager.disconnect_research(websocket)
    except Exception as exc:
        logger.debug("Research WebSocket error: %s", exc)
        await connection_manager.disconnect_research(websocket)


@router.websocket("/ws/citizen/{report_id}")
async def websocket_citizen(websocket: WebSocket, report_id: str):
    """
    WebSocket endpoint for Citizen Aqua App.
    Scoped strictly to report_id. Broadcasts safe CITIZEN_IMPACT_UPDATED events.
    """
    await connection_manager.connect_citizen(report_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await connection_manager.disconnect_citizen(report_id, websocket)
    except Exception as exc:
        logger.debug("Citizen WebSocket error for report %s: %s", report_id, exc)
        await connection_manager.disconnect_citizen(report_id, websocket)
