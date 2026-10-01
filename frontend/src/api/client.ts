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
