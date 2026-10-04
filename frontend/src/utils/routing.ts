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

export type CitizenNavTab = "home" | "observe" | "missions" | "impact";

export interface AppRouteState {
  mode: "citizen" | "missions" | "research";
  caseId: string | null;
  citizenTab: CitizenNavTab;
}

/**
 * Parses current window.location into AppRouteState.
 */
export function getRouteState(): AppRouteState {
  if (typeof window === "undefined") {
    return { mode: "citizen", caseId: null, citizenTab: "home" };
  }

  const pathname = window.location.pathname.replace(/\/$/, "");
  const searchParams = new URLSearchParams(window.location.search);
  const queryCaseId = searchParams.get("caseId");

  // Research routes
  if (pathname.startsWith("/research/cases/")) {
    const caseId = pathname.slice("/research/cases/".length);
    return { mode: "research", caseId: caseId || null, citizenTab: "home" };
  }

  if (pathname === "/research" || pathname === "/research/inbox") {
    return { mode: "research", caseId: queryCaseId, citizenTab: "home" };
  }

  // Missions route
  if (pathname === "/missions" || pathname === "/citizen/missions") {
    return { mode: "missions", caseId: null, citizenTab: "missions" };
  }

  // Citizen sub-routes
  if (pathname === "/citizen/observe" || pathname === "/observe") {
    return { mode: "citizen", caseId: null, citizenTab: "observe" };
  }

  if (pathname === "/citizen/impact" || pathname === "/impact") {
    return { mode: "citizen", caseId: null, citizenTab: "impact" };
  }

  // Citizen case routes
  if (pathname.startsWith("/citizen/")) {
    const caseId = pathname.slice("/citizen/".length);
    return { mode: "citizen", caseId: caseId || null, citizenTab: "observe" };
  }

  if (pathname === "/citizen" || pathname === "") {
    if (queryCaseId) {
      return { mode: "citizen", caseId: queryCaseId, citizenTab: "observe" };
    }
    return { mode: "citizen", caseId: null, citizenTab: "home" };
  }

  // Fallback to query params if pathname is root
  if (queryCaseId) {
    const mode = searchParams.get("mode") === "research" ? "research" : "citizen";
    return { mode, caseId: queryCaseId, citizenTab: "observe" };
  }

  return { mode: "citizen", caseId: null, citizenTab: "home" };
}

/**
 * Navigates to a specific route using window.history.pushState and dispatches popstate event.
 */
export function navigateTo(
  mode: "citizen" | "missions" | "research",
  caseId?: string | null,
  citizenTab?: CitizenNavTab
): void {
  if (typeof window === "undefined") return;

  let targetUrl = "/";
  if (mode === "research") {
    if (caseId) {
      targetUrl = `/research/cases/${encodeURIComponent(caseId)}`;
    } else {
      targetUrl = "/research";
    }
  } else if (mode === "missions" || citizenTab === "missions") {
    targetUrl = "/missions";
  } else {
    if (caseId) {
      targetUrl = `/citizen?caseId=${encodeURIComponent(caseId)}`;
    } else if (citizenTab === "observe") {
      targetUrl = "/citizen/observe";
    } else if (citizenTab === "impact") {
      targetUrl = "/citizen/impact";
    } else {
      targetUrl = "/citizen";
    }
  }

  if (window.location.pathname + window.location.search !== targetUrl) {
    window.history.pushState({ mode, caseId, citizenTab }, "", targetUrl);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}
