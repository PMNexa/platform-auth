import { clearAccessToken, getAccessToken } from "../auth/tokenStore";

export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export interface ApiFetchOptions extends RequestInit {
  /** Opts a call (login) out of the 401 -> clear-token -> redirect behavior. */
  skipAuthRedirect?: boolean;
}

export async function apiFetch<T>(path: string, init?: ApiFetchOptions): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const token = getAccessToken();

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed";
    throw new ApiError(message, 0);
  }

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      // Non-JSON or empty error body.
    }

    const message =
      body !== null &&
      typeof body === "object" &&
      "message" in body &&
      typeof (body as { message?: unknown }).message === "string"
        ? (body as { message: string }).message
        : `Request to ${url} failed with status ${response.status}`;

    if (response.status === 401 && !init?.skipAuthRedirect) {
      clearAccessToken();
      // BASE_URL always has a trailing slash (Vite's `base` config) - this
      // stays correct whether this app is served at "/" standalone or
      // under a path prefix like "/platform-auth/" behind a gateway.
      window.location.assign(`${import.meta.env.BASE_URL}login`);
    }

    throw new ApiError(message, response.status, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
