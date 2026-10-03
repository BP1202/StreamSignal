/**
 * StreamSignal — Realtime WebSocket Client & Hooks (Issue 14)
 * Provides robust WebSocket connection lifecycle management:
 * - Deterministic connection states (CONNECTING, CONNECTED, DISCONNECTED, RECONNECTING)
 * - Bounded exponential backoff reconnection (1s -> 2s -> 4s -> max 8s)
 * - Auto-refresh trigger on reconnection
 * - Typed events for Research Workspace and Citizen Aqua App
 * - Notification-only transport (REST APIs remain authoritative source of truth)
 */

import { useEffect, useRef, useState, useCallback } from "react";

export type ConnectionState = "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "RECONNECTING";

export type RealtimeEventType =
  | "SIGNAL_CASE_CREATED"
  | "EVIDENCE_UPDATED"
  | "TRIAGE_UPDATED"
  | "HUMAN_REVIEW_RECORDED"
  | "CITIZEN_IMPACT_UPDATED";

export interface RealtimeEvent<T = any> {
  event_type: RealtimeEventType;
  case_id: string;
  report_id: string;
  occurred_at: string;
  payload: T;
}

export interface SignalCaseCreatedPayload {
  title: string;
  description?: string | null;
  media_count?: number;
  completeness_score?: number | null;
  quality_tier?: string | null;
}

export interface CitizenImpactUpdatedPayload {
  workflow_status: string;
  citizen_label: string;
  safe_description: string;
}

export interface HumanReviewRecordedPayload {
  outcome: string;
  workflow_status: string;
  previous_status: string;
  evidence_state_before: string;
  evidence_state_after: string;
}

export function getWebSocketBaseUrl(): string {
  const wsEnv = import.meta.env.VITE_WS_BASE_URL;
  if (wsEnv) return wsEnv.replace(/\/$/, "");

  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
  return apiBase.replace(/^http/i, "ws").replace(/\/$/, "");
}

// Bounded exponential backoff delay table: 1s, 2s, 4s, 8s max
const BACKOFF_INTERVALS = [1000, 2000, 4000, 8000];

export interface ResearchRealtimeCallbacks {
  onSignalCaseCreated?: (event: RealtimeEvent<SignalCaseCreatedPayload>) => void;
  onEvidenceUpdated?: (event: RealtimeEvent) => void;
  onHumanReviewRecorded?: (event: RealtimeEvent<HumanReviewRecordedPayload>) => void;
  onReconnect?: () => void;
}

/**
 * Hook managing Research Workspace WebSocket connection to /ws/research.
 */
export function useResearchRealtime(callbacks: ResearchRealtimeCallbacks = {}) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>("CONNECTING");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const callbacksRef = useRef<ResearchRealtimeCallbacks>(callbacks);
  callbacksRef.current = callbacks;

  const connect = useCallback(() => {
    if (typeof WebSocket === "undefined") return;

    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    const wsUrl = `${getWebSocketBaseUrl()}/ws/research`;
    setConnectionStatus((prev) => (prev === "DISCONNECTED" ? "RECONNECTING" : "CONNECTING"));

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setConnectionStatus("CONNECTED");
        const hadPriorAttempts = reconnectAttemptRef.current > 0;
        reconnectAttemptRef.current = 0;
        if (hadPriorAttempts) {
          // Fire onReconnect callback to trigger state refresh from REST API
          callbacksRef.current.onReconnect?.();
        }
      };

      socket.onmessage = (event) => {
        if (event.data === "pong") return;
        try {
          const parsed: RealtimeEvent = JSON.parse(event.data);
          switch (parsed.event_type) {
            case "SIGNAL_CASE_CREATED":
              callbacksRef.current.onSignalCaseCreated?.(parsed as RealtimeEvent<SignalCaseCreatedPayload>);
              break;
            case "EVIDENCE_UPDATED":
              callbacksRef.current.onEvidenceUpdated?.(parsed);
              break;
            case "HUMAN_REVIEW_RECORDED":
              callbacksRef.current.onHumanReviewRecorded?.(parsed as RealtimeEvent<HumanReviewRecordedPayload>);
              break;
          }
        } catch (err) {
          console.warn("[ResearchRealtime] Error parsing event:", err);
        }
      };

      socket.onerror = () => {
        // Socket close event will handle reconnection
      };

      socket.onclose = () => {
        setConnectionStatus("RECONNECTING");
        const attempt = reconnectAttemptRef.current;
        const delay = BACKOFF_INTERVALS[Math.min(attempt, BACKOFF_INTERVALS.length - 1)];
        reconnectAttemptRef.current = attempt + 1;

        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, delay);
      };
    } catch {
      setConnectionStatus("DISCONNECTED");
    }
  }, []);

  useEffect(() => {
    connect();

    // Periodic heartbeat ping every 25s
    const pingInterval = window.setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send("ping");
      }
    }, 25000);

    return () => {
      window.clearInterval(pingInterval);
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect loop on intentional unmount
        wsRef.current.close();
      }
      setConnectionStatus("DISCONNECTED");
    };
  }, [connect]);

  return { connectionStatus };
}

export interface CitizenRealtimeCallbacks {
  onCitizenImpactUpdated?: (event: RealtimeEvent<CitizenImpactUpdatedPayload>) => void;
  onReconnect?: () => void;
}

/**
 * Hook managing Citizen Aqua App WebSocket connection scoped to /ws/citizen/{reportId}.
 */
export function useCitizenRealtime(
  reportId: string | null | undefined,
  callbacks: CitizenRealtimeCallbacks = {}
) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>("CONNECTING");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const callbacksRef = useRef<CitizenRealtimeCallbacks>(callbacks);
  callbacksRef.current = callbacks;

  const connect = useCallback(() => {
    if (!reportId || typeof WebSocket === "undefined") return;

    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    const wsUrl = `${getWebSocketBaseUrl()}/ws/citizen/${reportId}`;
    setConnectionStatus((prev) => (prev === "DISCONNECTED" ? "RECONNECTING" : "CONNECTING"));

    try {
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setConnectionStatus("CONNECTED");
        const hadPriorAttempts = reconnectAttemptRef.current > 0;
        reconnectAttemptRef.current = 0;
        if (hadPriorAttempts) {
          callbacksRef.current.onReconnect?.();
        }
      };

      socket.onmessage = (event) => {
        if (event.data === "pong") return;
        try {
          const parsed: RealtimeEvent = JSON.parse(event.data);
          if (parsed.event_type === "CITIZEN_IMPACT_UPDATED") {
            callbacksRef.current.onCitizenImpactUpdated?.(parsed as RealtimeEvent<CitizenImpactUpdatedPayload>);
          }
        } catch (err) {
          console.warn("[CitizenRealtime] Error parsing event:", err);
        }
      };

      socket.onerror = () => {
        // Socket close event will handle reconnection
      };

      socket.onclose = () => {
        setConnectionStatus("RECONNECTING");
        const attempt = reconnectAttemptRef.current;
        const delay = BACKOFF_INTERVALS[Math.min(attempt, BACKOFF_INTERVALS.length - 1)];
        reconnectAttemptRef.current = attempt + 1;

        reconnectTimerRef.current = window.setTimeout(() => {
          connect();
        }, delay);
      };
    } catch {
      setConnectionStatus("DISCONNECTED");
    }
  }, [reportId]);

  useEffect(() => {
    if (!reportId) return;

    connect();

    const pingInterval = window.setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send("ping");
      }
    }, 25000);

    return () => {
      window.clearInterval(pingInterval);
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      setConnectionStatus("DISCONNECTED");
    };
  }, [reportId, connect]);

  return { connectionStatus };
}
