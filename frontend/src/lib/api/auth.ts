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

/**
 * `origin.next`: where the signup page is heading (its `?next=`) - the
 * confirmation email's link lands there. `origin.ref`: the page's `?ref=`.
 */
export async function signup(
  name: string,
  email: string,
  password: string,
  origin: { next?: string; ref?: string } = {},
): Promise<LoginResponse | VerificationPending> {
  return apiRequest<LoginResponse | VerificationPending>("/api/v1/auth/signup", {
    method: "POST",
    withCredentials: true,
    skipAuthRedirect: true,
    data: { name, email, password, ...origin },
  });
}

/** The instance's public auth settings - what the auth pages need before anyone is signed in. */
export interface AuthConfig {
  /** False: single sign-on is the only way in - no password form, no signup form. */
  password_login: boolean;
  password_min_length: number;
  /** Set when a single sign-on provider is configured: its button's label and where the button goes. */
  sso: { label: string; start_url: string } | null;
}

let configPromise: Promise<AuthConfig> | null = null;

/** One request per page load, shared by every screen that asks. */
export function authConfig(): Promise<AuthConfig> {
  configPromise ??= apiRequest<AuthConfig>("/api/v1/auth/config", { skipAuthRedirect: true }).catch((error: unknown) => {
    configPromise = null;
    throw error;
  });
  return configPromise;
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
export async function resendVerification(email: string, next?: string): Promise<void> {
  await apiRequest<void>("/api/v1/auth/resend-verification", {
    method: "POST",
    skipAuthRedirect: true,
    data: { email, ...(next ? { next } : {}) },
  });
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

/** Changes the signed-in user's password; every other session ends, this one gets a new session back. */
export async function changeMyPassword(accessToken: string, currentPassword: string, newPassword: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/v1/auth/me/password", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    withCredentials: true,
    skipAuthRedirect: true,
    data: { current_password: currentPassword, new_password: newPassword },
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
