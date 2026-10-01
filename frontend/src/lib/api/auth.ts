import { apiRequest } from "./client";

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  /** Set while an admin is viewing as this user ("view as", read-only). */
  impersonated_by?: { id: string; name?: string; email?: string };
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

/** Signup's answer when the instance requires email verification: no session yet - a link was emailed. */
export interface VerificationPending {
  verification_required: true;
  email: string;
}

export async function signup(name: string, email: string, password: string): Promise<LoginResponse | VerificationPending> {
  return apiRequest<LoginResponse | VerificationPending>("/api/v1/auth/signup", {
    method: "POST",
    withCredentials: true,
    skipAuthRedirect: true,
    data: { name, email, password },
  });
}

/** First-run onboarding: `required` until the first account exists. */
export async function setupStatus(): Promise<{ required: boolean }> {
  return apiRequest<{ required: boolean }>("/api/v1/auth/setup", { skipAuthRedirect: true });
}

/** Creates the first account and makes it the admin; refused once any user exists. */
export async function setup(name: string, email: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/v1/auth/setup", {
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

/** Confirms the email from a signup link, and logs in. */
export async function verifyEmail(token: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/v1/auth/verify-email", {
    method: "POST",
    withCredentials: true,
    skipAuthRedirect: true,
    data: { token },
  });
}

/** Emails a new verification link (answers the same whether or not the account exists). */
export async function resendVerification(email: string): Promise<void> {
  await apiRequest<void>("/api/v1/auth/resend-verification", { method: "POST", skipAuthRedirect: true, data: { email } });
}

/** Emails a password reset link (answers the same whether or not the account exists). */
export async function forgotPassword(email: string): Promise<void> {
  await apiRequest<void>("/api/v1/auth/password/forgot", { method: "POST", skipAuthRedirect: true, data: { email } });
}

/** Sets a new password from a reset (or invitation) link, and logs in. */
export async function resetPassword(token: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/v1/auth/password/reset", {
    method: "POST",
    withCredentials: true,
    skipAuthRedirect: true,
    data: { token, password },
  });
}

/** The signed-in user's own data, as the JSON the browser downloads. */
export async function exportMyData(accessToken: string): Promise<Blob> {
  return apiRequest<Blob>("/api/v1/auth/me/export", {
    responseType: "blob",
    skipAuthRedirect: true,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/** Deletes the signed-in user's account and everything they own. */
export async function deleteMyAccount(accessToken: string, password: string): Promise<void> {
  await apiRequest<void>("/api/v1/auth/me/delete", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    withCredentials: true,
    skipAuthRedirect: true,
    data: { password },
  });
}
