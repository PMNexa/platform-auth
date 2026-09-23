import { logout as logoutRequest, refresh } from "./lib/api/auth";
import type { Session } from "./lib/api/auth";
import { ApiError } from "./lib/api/client";

/**
 * The host-facing session store - who's logged in, for any host screen
 * or other module that needs the access token (e.g. `apps/main`'s
 * `app-shell.tsx` hands it to `platform-core`'s CRUD screens). Written by
 * this module's own login/signup routes (see `routes/login.tsx`) and by
 * `initSession()`; the host only reads/subscribes (and `clearSession()`s
 * on logout). Moved here from `apps/main`'s own `lib/session.ts` - auth
 * owning the session is what lets the whole `/auth/*` subtree live in
 * this package with no host-side layout.
 *
 * Plain module-level singleton, not React state - resets on every full
 * page load, same as `lib/auth/tokenStore.ts`. `initSession()` (called
 * once from the host's root on boot) restores it from the httpOnly
 * refresh cookie, which DOES survive a reload. Client-only; always
 * null/uninitialized during SSR.
 *
 * The access token is short-lived (`JWT_ACCESS_TTL_MINUTES`), so while a
 * session is held this store swaps it for a fresh one shortly before it
 * expires (see `keepAlive`) - the session only ends on `logout()`, or
 * when the refresh token itself is rejected (revoked, or idle past its
 * sliding `JWT_REFRESH_TTL_DAYS` window).
 */
let session: Session | null = null;
// False until the boot-time `initSession()` has resolved, success or
// failure. A protected route MUST wait for this before deciding "no
// session -> redirect to login" - checking `session === null` alone
// would redirect every fresh page load before the boot refresh even had
// a chance to run.
let initialized = false;
const subscribers = new Set<() => void>();

function notify(): void {
  for (const callback of subscribers) callback();
}

export function getSession(): Session | null {
  return session;
}

export function isSessionInitialized(): boolean {
  return initialized;
}

export function setSession(next: Session): void {
  session = next;
  scheduleRefresh(next.accessToken);
  startKeepAlive();
  // A fresh login/signup is definitive - no need to wait for the boot-
  // time refresh (which may not have finished yet if the user reached a
  // login form directly).
  initialized = true;
  notify();
}

export function clearSession(): void {
  session = null;
  notify();
}

export function subscribeSession(callback: () => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

/**
 * Ends the session for real: revokes the refresh token server-side (so a
 * reload can't restore it) and clears the local store. The local store is
 * cleared even if the request fails - the user asked to be logged out.
 */
export async function logout(): Promise<void> {
  try {
    await logoutRequest();
  } finally {
    clearSession();
  }
}

// Refresh this long before the access token expires.
const REFRESH_AHEAD_MS = 2 * 60_000;
// A plain interval, not one timer set for `exp - REFRESH_AHEAD_MS`: a
// timer is paused or throttled while the machine sleeps or the tab is in
// the background, so it can fire long after the token died. A short
// periodic check (plus focus/visibility/online, for waking up) catches
// that the moment the page is live again.
const CHECK_EVERY_MS = 30_000;
let keepAliveStarted = false;
let checking: Promise<void> | null = null;

// When the held access token needs replacing, on THIS machine's clock:
// received-at + the token's own lifetime (`exp - iat`). Not `exp` itself -
// that's the server's clock, and a client clock running ahead of it
// would see every fresh token as nearly expired and refresh nonstop.
let refreshDueAt: number | null = null;

function scheduleRefresh(token: string): void {
  refreshDueAt = null;
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp, iat } = JSON.parse(atob(payload)) as { exp?: unknown; iat?: unknown };
    if (typeof exp === "number" && typeof iat === "number") {
      refreshDueAt = Date.now() + (exp - iat) * 1000 - REFRESH_AHEAD_MS;
    }
  } catch {
    // Unreadable token - leave it; a request with it 401s like before.
  }
}

// Only swaps the token in if the session wasn't cleared meanwhile.
function replaceToken(next: Session): void {
  if (!session) return;
  session = next;
  scheduleRefresh(next.accessToken);
  notify();
}

async function refreshIfExpiring(): Promise<void> {
  if (!session || refreshDueAt === null || Date.now() < refreshDueAt) return;
  try {
    replaceToken(await refreshSession());
  } catch (error) {
    // A network error is left for the next check to retry. A 401 means
    // the refresh token is gone - unless another tab rotated the shared
    // cookie at the same moment (refresh tokens are single-use), so give
    // it one retry, which picks up that tab's new cookie, before giving up.
    if (!(error instanceof ApiError && error.status === 401)) return;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    if (!session) return;
    try {
      replaceToken(await refreshSession());
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401) clearSession();
    }
  }
}

function keepAlive(): void {
  checking ??= refreshIfExpiring().finally(() => {
    checking = null;
  });
}

function startKeepAlive(): void {
  if (keepAliveStarted || typeof window === "undefined") return;
  keepAliveStarted = true;
  window.setInterval(keepAlive, CHECK_EVERY_MS);
  window.addEventListener("focus", keepAlive);
  window.addEventListener("online", keepAlive);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") keepAlive();
  });
}

/**
 * Exchanges the httpOnly refresh cookie for a fresh access token -
 * rejects (throws `ApiError`, status 401) if there's no valid cookie. A
 * host normally wants `initSession()` instead; this is the raw call.
 */
export async function refreshSession(): Promise<Session> {
  const response = await refresh();
  return { accessToken: response.access_token, user: response.user };
}

/**
 * Call once at the host's app boot (a root-level effect) - restores a
 * session that survived a page reload, then marks the store initialized
 * either way (no cookie just means "not logged in", not an error).
 * Idempotent: a second call (React StrictMode's double-invoked effects)
 * is a no-op once initialized, and `refresh()` itself dedupes concurrent
 * calls (the backend's refresh token is single-use).
 */
export async function initSession(): Promise<void> {
  if (initialized) return;
  try {
    setSession(await refreshSession());
  } catch {
    // No valid refresh cookie - not logged in.
  } finally {
    initialized = true;
    notify();
  }
}
