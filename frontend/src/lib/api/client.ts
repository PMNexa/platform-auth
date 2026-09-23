import axios from "axios";
import type { AxiosRequestConfig } from "axios";
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

export interface ApiRequestOptions extends AxiosRequestConfig {
  /** Opts a call (login) out of the 401 -> clear-token -> redirect behavior. */
  skipAuthRedirect?: boolean;
}

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && !config.headers.has("Authorization")) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

export async function apiRequest<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  const { skipAuthRedirect, ...config } = options ?? {};
  try {
    const response = await client.request<T>({ url: path, ...config });
    return (response.status === 204 ? undefined : response.data) as T;
  } catch (error) {
    if (!axios.isAxiosError(error)) throw error;
    if (!error.response) throw new ApiError(error.message || "Network request failed", 0);

    const { status, data: body } = error.response;
    const message =
      body !== null &&
      typeof body === "object" &&
      "message" in body &&
      typeof (body as { message?: unknown }).message === "string"
        ? (body as { message: string }).message
        : `Request to ${API_BASE_URL}${path} failed with status ${status}`;

    if (status === 401 && !skipAuthRedirect) {
      clearAccessToken();
      // BASE_URL always has a trailing slash (Vite's `base` config) - this
      // stays correct whether this app is served at "/" standalone or
      // under a path prefix like "/platform-auth/" behind a gateway.
      window.location.assign(`${import.meta.env.BASE_URL}login`);
    }

    throw new ApiError(message, status, body);
  }
}
