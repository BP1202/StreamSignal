/**
 * StreamSignal — URL Routing & Browser Navigation
 * Native HTML5 History API routing without heavy third-party routing dependencies.
 *
 * Supported Routes:
 * - / or /citizen                          -> { mode: "citizen", caseId: null }
 * - /citizen?caseId=:id or /citizen/:id    -> { mode: "citizen", caseId: ":id" }
 * - /research or /research/inbox           -> { mode: "research", caseId: null }
 * - /research/cases/:caseId or /research?caseId=:id -> { mode: "research", caseId: ":caseId" }
 */

export interface AppRouteState {
  mode: "citizen" | "missions" | "research";
  caseId: string | null;
}

/**
 * Parses current window.location into AppRouteState.
 */
export function getRouteState(): AppRouteState {
  if (typeof window === "undefined") {
    return { mode: "citizen", caseId: null };
  }

  const pathname = window.location.pathname.replace(/\/$/, "");
  const searchParams = new URLSearchParams(window.location.search);
  const queryCaseId = searchParams.get("caseId");

  // Research routes
  if (pathname.startsWith("/research/cases/")) {
    const caseId = pathname.slice("/research/cases/".length);
    return { mode: "research", caseId: caseId || null };
  }

  if (pathname === "/research" || pathname === "/research/inbox") {
    return { mode: "research", caseId: queryCaseId };
  }

  // Missions route
  if (pathname === "/missions" || pathname === "/citizen/missions") {
    return { mode: "missions", caseId: null };
  }

  // Citizen routes
  if (pathname.startsWith("/citizen/")) {
    const caseId = pathname.slice("/citizen/".length);
    return { mode: "citizen", caseId: caseId || null };
  }

  if (pathname === "/citizen" || pathname === "") {
    return { mode: "citizen", caseId: queryCaseId };
  }

  // Fallback to query params if pathname is root
  if (queryCaseId) {
    const mode = searchParams.get("mode") === "research" ? "research" : "citizen";
    return { mode, caseId: queryCaseId };
  }

  return { mode: "citizen", caseId: null };
}

/**
 * Navigates to a specific route using window.history.pushState and dispatches popstate event.
 */
export function navigateTo(mode: "citizen" | "missions" | "research", caseId?: string | null): void {
  if (typeof window === "undefined") return;

  let targetUrl = "/";
  if (mode === "research") {
    if (caseId) {
      targetUrl = `/research/cases/${encodeURIComponent(caseId)}`;
    } else {
      targetUrl = "/research";
    }
  } else if (mode === "missions") {
    targetUrl = "/missions";
  } else {
    if (caseId) {
      targetUrl = `/citizen?caseId=${encodeURIComponent(caseId)}`;
    } else {
      targetUrl = "/citizen";
    }
  }

  if (window.location.pathname + window.location.search !== targetUrl) {
    window.history.pushState({ mode, caseId }, "", targetUrl);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}
