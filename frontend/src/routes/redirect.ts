/**
 * Where to go after a successful login/signup: the `?next=` query param
 * the host put on the link/redirect (e.g. `apps/main`'s
 * `useRequireAccessToken` sends `?next=<page the user was on>`), or `/`.
 * Same-origin paths only - anything else (`//evil.com`, `https://...`)
 * falls back to `/`, so `?next=` can't be used as an open redirect.
 */
export function nextPath(search: URLSearchParams): string {
  const next = search.get("next");
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

/**
 * The other auth page next to this one (`/auth/login` -> `/auth/signup`),
 * keeping the query - so `?next=` survives switching between the two
 * (e.g. an invited user who has no account yet).
 */
export function siblingPath(location: { pathname: string; search: string }, page: string): string {
  return `${location.pathname.replace(/[^/]*\/?$/, page)}${location.search}`;
}
