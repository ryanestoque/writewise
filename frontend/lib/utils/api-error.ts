export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class ApiError extends Error implements ApiErrorPayload {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(error: ApiErrorPayload) {
    super(error.message);
    this.name = "ApiError";
    this.code = error.code;
    this.details = error.details;

    // Restore prototype chain when extending built-in Error in TypeScript
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/**
 * Parses and verifies an API fetch Response.
 * Normalizes backend error envelopes into an ApiError instance,
 * preventing unformatted object logging from triggering dev overlays.
 */
export async function handleApiResponse<T = unknown>(response: Response): Promise<T> {
  let data: Record<string, unknown> | null = null;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    // Response body is not valid JSON (e.g. gateway timeout or proxy error)
  }

  if (!response.ok) {
    const errorPayload = (data?.error as ApiErrorPayload | undefined) ?? {
      code: "INTERNAL_ERROR",
      message:
        (typeof data?.message === "string" ? data.message : null) ||
        (Array.isArray(data?.detail)
          ? data.detail.map((d: { msg?: string }) => d.msg).join(", ")
          : typeof data?.detail === "string"
          ? data.detail
          : null) ||
        `Request failed with status ${response.status}`,
      details: (data?.details as Record<string, unknown> | undefined) ?? (data ?? {}),
    };

    throw new ApiError(errorPayload);
  }

  return data as T;
}
