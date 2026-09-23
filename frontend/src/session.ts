import { refresh } from "./lib/api/auth";
import type { Session } from "./lib/api/auth";

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
