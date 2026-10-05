import { getAccessToken } from "../auth/accessToken";

export interface ApiErrorDetail {
  loc?: (string | number)[];
  msg: string;
  type?: string;
}

export class ApiError extends Error {
  public status: number;
  public details?: ApiErrorDetail[] | string;

  constructor(status: number, message: string, details?: ApiErrorDetail[] | string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

function requiresResearcherAccess(endpoint: string, method: string): boolean {
  const isResearchEndpoint = endpoint.startsWith("/api/v1/research");
  const isMediaBinary = method.toUpperCase() === "GET" &&
    /^\/api\/v1\/reports\/[^/]+\/media\/[^/?]+(?:\?|$)/.test(endpoint);
  return isResearchEndpoint || isMediaBinary;
}

function supportsOptionalCitizenSession(endpoint: string, method: string): boolean {
  return endpoint.startsWith("/api/v1/citizen") ||
    (method.toUpperCase() === "POST" && /^\/api\/v1\/reports(?:\/[^/]+\/media)?(?:\?|$)/.test(endpoint));
}

async function addAuthorization(headers: Headers, endpoint: string, method: string): Promise<void> {
  const protectedResearchRequest = requiresResearcherAccess(endpoint, method);
  const optionalCitizenSession = supportsOptionalCitizenSession(endpoint, method);
  if (!protectedResearchRequest && !optionalCitizenSession) return;
  try {
    const token = await getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
      return;
    }
  } catch {
    if (protectedResearchRequest && !import.meta.env.DEV) {
      throw new ApiError(401, "Sign in with an authorized researcher account to access this evidence.");
    }
  }

  if (!protectedResearchRequest) return;

  // This shortcut is intentionally development-only; production authorization is OIDC-only.
  if (import.meta.env.DEV && !headers.has("Authorization")) {
    headers.set("X-Role", "RESEARCHER");
  }

  // Ensure reviewer identity header is provided for review/research operations
  if (endpoint.startsWith("/api/v1/research") && !headers.has("X-Reviewer-Id")) {
    const storedReviewer =
      typeof window !== "undefined"
        ? localStorage.getItem("streamsignal_reviewer_id") ||
          localStorage.getItem("streamsignal_researcher_email")
        : null;
    const reviewerId =
      storedReviewer && storedReviewer.trim()
        ? storedReviewer.trim()
        : "REV-RESEARCHER-001";
    headers.set("X-Reviewer-Id", reviewerId);
  }
}

export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  // Set Content-Type only if body is not FormData
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  await addAuthorization(headers, endpoint, options.method || "GET");

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: unknown) {
    throw new ApiError(
      0,
      "We couldn't reach StreamSignal. Check your connection and try again.",
      err instanceof Error ? err.message : String(err)
    );
  }

  if (!response.ok) {
    let errorDetail: any = null;
    try {
      errorDetail = await response.json();
    } catch {
      // Non-JSON response
      errorDetail = await response.text().catch(() => null);
    }

    if (response.status === 422 && errorDetail?.detail && Array.isArray(errorDetail.detail)) {
      const messages = errorDetail.detail.map((d: ApiErrorDetail) => d.msg).join("; ");
      throw new ApiError(
        422,
        `Please check the information you entered: ${messages}`,
        errorDetail.detail
      );
    }

    if (response.status === 404) {
      const msg = typeof errorDetail?.detail === "string" ? errorDetail.detail : "The requested resource was not found.";
      throw new ApiError(404, msg, errorDetail);
    }

    if (response.status === 400) {
      const msg = typeof errorDetail?.detail === "string" ? errorDetail.detail : "Invalid request data.";
      throw new ApiError(400, msg, errorDetail);
    }

    if (response.status >= 500) {
      throw new ApiError(
        response.status,
        "Something went wrong while processing your observation. Please try again.",
        "Internal server error"
      );
    }

    const fallbackMsg = typeof errorDetail?.detail === "string"
      ? errorDetail.detail
      : `Request failed with status ${response.status}`;
    throw new ApiError(response.status, fallbackMsg, errorDetail);
  }

  // Handle empty 204 or no-content responses
  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export async function requestBlob(endpoint: string): Promise<Blob> {
  const url = `${BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const headers = new Headers({ Accept: "image/*, video/*" });
  await addAuthorization(headers, endpoint, "GET");

  let response: Response;
  try {
    response = await fetch(url, { method: "GET", headers });
  } catch (err: unknown) {
    throw new ApiError(
      0,
      "We couldn't load this media. Check your connection and try again.",
      err instanceof Error ? err.message : String(err)
    );
  }

  if (!response.ok) {
    let detail: unknown;
    try {
      detail = (await response.json())?.detail;
    } catch {
      detail = null;
    }
    const message = typeof detail === "string"
      ? detail
      : response.status === 403 || response.status === 401
      ? "You are not authorized to view this media."
      : response.status === 404
      ? "This media file is no longer available."
      : "This media file could not be loaded.";
    throw new ApiError(response.status, message);
  }

  return response.blob();
}
