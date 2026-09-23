import { apiRequest } from "./client";

export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserSummary;
}

/** What a host app needs to make its own authenticated calls afterward. */
export interface Session {
  accessToken: string;
  user: UserSummary;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    withCredentials: true,
    skipAuthRedirect: true,
    data: { email, password },
  });
}

export async function signup(name: string, email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/v1/auth/signup", {
    method: "POST",
    withCredentials: true,
    skipAuthRedirect: true,
    data: { name, email, password },
  });
}

export async function me(): Promise<UserSummary> {
  return apiRequest<UserSummary>("/api/v1/auth/me");
}

// The backend ROTATES the refresh token on every call (single-use) - two
// concurrent callers would race for the same cookie, and exactly one
// would get a legitimate 401 (not a bug in the rotation logic, but not
// something callers should have to reason about either). React 18+'s
// StrictMode double-invokes effects in dev specifically to catch exactly
// this class of "non-idempotent side effect on mount" issue - a host
// calling this once at app boot (see apps/main/frontend/app/root.tsx)
// would otherwise hit it immediately. Sharing one in-flight promise
// across every concurrent caller, regardless of how many there are or
// why, is the correct fix.
let refreshPromise: Promise<LoginResponse> | null = null;

export function refresh(): Promise<LoginResponse> {
  if (!refreshPromise) {
    refreshPromise = apiRequest<LoginResponse>("/api/v1/auth/refresh", {
      method: "POST",
      withCredentials: true,
      skipAuthRedirect: true,
    }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** Revokes the refresh token server-side and clears its cookie. */
export async function logout(): Promise<void> {
  await apiRequest<void>("/api/v1/auth/logout", {
    method: "POST",
    withCredentials: true,
    skipAuthRedirect: true,
  });
}
