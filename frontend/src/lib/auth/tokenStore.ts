/**
 * Access-token store: plain module-level state, not localStorage/cookie -
 * lost on reload (there's no /refresh endpoint yet to silently restore it,
 * see AGENTS.md). apiFetch is a plain function with no hooks, so it needs a
 * synchronous non-React way to read/write the token; AuthContext subscribes
 * for re-renders. Ported from platform-core's tokenStore.ts.
 */

let accessToken: string | null = null;
const subscribers = new Set<() => void>();

function notify(): void {
  for (const callback of subscribers) callback();
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string): void {
  accessToken = token;
  notify();
}

export function clearAccessToken(): void {
  accessToken = null;
  notify();
}

export function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}
