/**
 * platform-auth's OWN route list - every auth page this module has
 * (`login`, `signup`, first-run `setup`, and the email-link pages
 * `forgot`, `reset`, `verify`), nested under a HOST-chosen mount. A host
 * registers the whole module ONCE:
 * ```ts
 * // apps/main/frontend/app/routes.ts
 * import { createAuthRoutes } from "platform-auth-frontend";
 * ...
 * ...createAuthRoutes("auth"),   // -> /auth/login, /auth/signup, /auth/setup
 * ```
 * Same `createXRoutes(basePath)` shape as `platform-org-frontend`'s
 * `createOrgsRoutes`. No host-side layout/route file needed: the route
 * files store the session in this module's own store (`session.ts`) and
 * redirect to `?next=` themselves (`routes/redirect.ts`) - the host
 * controls the destination by putting `?next=` on its login links.
 *
 * Exported from the main `"."` entry, which IS client-bundled (the host's
 * root.tsx imports `initSession` from it) - so this file must stay
 * browser-safe: no `node:path`/`node:url`, no `@react-router/dev/routes`
 * import, and nothing computed at module load. The file paths are only
 * built when `createAuthRoutes()` runs, which only happens in Node (the
 * host's `routes.ts`, read by react-router's tooling). Deliberately
 * string ops on `import.meta.url` rather than `new URL(..., import.meta.url)`
 * - Vite rewrites that pattern into a bundled asset reference.
 *
 * Plain route-config objects, NOT `@react-router/dev/routes`'s helpers:
 * that package's v8 peer-depends on `react-router@^8`, while this
 * module's own standalone app is still on `react-router-dom@7` - the
 * object shape is all they build anyway, and the host's own
 * `satisfies RouteConfig` still type-checks it.
 */
export interface AuthRouteConfigEntry {
  id: string;
  path: string;
  file: string;
}

// Absolute filesystem path of `src/routes/<name>` - `import.meta.url` is
// this file's own `file://` URL (Node), so the result never depends on
// the CALLER's directory depth.
function routeFile(name: string): string {
  const dir = import.meta.url.slice(0, import.meta.url.lastIndexOf("/"));
  return decodeURIComponent(`${dir}/routes/${name}`.replace(/^file:\/\//, ""));
}

export function createAuthRoutes(basePath: string): AuthRouteConfigEntry[] {
  const base = basePath.replace(/^\/+|\/+$/g, "");
  // Explicit `id`s - react-router otherwise derives one from `file`,
  // which here is an absolute filesystem path.
  return [
    { id: "platform-auth-login", path: `${base}/login`, file: routeFile("login.tsx") },
    { id: "platform-auth-signup", path: `${base}/signup`, file: routeFile("signup.tsx") },
    { id: "platform-auth-setup", path: `${base}/setup`, file: routeFile("setup.tsx") },
    // Email links: forgot password, set a new one (reset/invitation), confirm an email.
    { id: "platform-auth-forgot", path: `${base}/forgot`, file: routeFile("forgot.tsx") },
    { id: "platform-auth-reset", path: `${base}/reset`, file: routeFile("reset.tsx") },
    { id: "platform-auth-verify", path: `${base}/verify`, file: routeFile("verify.tsx") },
    // An admin's read-only "view as" tab.
    { id: "platform-auth-view-as", path: `${base}/view-as`, file: routeFile("view-as.tsx") },
  ];
}

/**
 * The signed-in user's own account page (download my data, delete my
 * account) at a host-chosen path - mount it INSIDE the host's signed-in
 * layout: `...createAccountRoutes("account")`.
 */
export function createAccountRoutes(basePath: string): AuthRouteConfigEntry[] {
  return [{ id: "platform-auth-account", path: basePath.replace(/^\/+|\/+$/g, ""), file: routeFile("account.tsx") }];
}
