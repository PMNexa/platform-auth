/**
 * Package entry point - what a consuming app (apps/main) imports.
 *
 * - `createAuthRoutes(basePath)` - the whole `/auth/*` subtree (login,
 *   signup), registered once by the host (see `authRoutes.ts`).
 * - The session store (`getSession`/`subscribeSession`/`initSession`/...,
 *   see `session.ts`) - this module owns who's logged in; the host reads
 *   it (e.g. to hand the access token to other modules' screens).
 * - `LoginScreen`/`SignupScreen` - the bare screens (self-contained,
 *   bundle their own AuthProvider, no react-router dependency), for a
 *   host that wants to mount one somewhere custom instead.
 */
export { default as LoginScreen } from "./screens/LoginScreen";
export { default as SignupScreen } from "./screens/SignupScreen";

// Both screens' onSuccess callback receives one of these; so does
// `getSession()`.
export type { Session } from "./lib/api/auth";

export { createAuthRoutes } from "./authRoutes";
export type { AuthRouteConfigEntry } from "./authRoutes";

export {
  clearSession,
  getSession,
  initSession,
  isSessionInitialized,
  refreshSession,
  setSession,
  subscribeSession,
} from "./session";
