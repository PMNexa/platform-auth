/**
 * Package entry point - what a consuming app (apps/main) imports.
 *
 * - `createAuthRoutes(basePath)` - the whole `/auth/*` subtree (login,
 *   signup, first-run setup), registered once by the host (see `authRoutes.ts`).
 * - The session store (`getSession`/`subscribeSession`/`initSession`/...,
 *   see `session.ts`) - this module owns who's logged in; the host reads
 *   it (e.g. to hand the access token to other modules' screens).
 * - `createRbacRoutes(basePath)` + `useMyPermissions`/`hasPermission` -
 *   role-based access control's screens and checks (see `rbac.ts`).
 * - `LoginScreen`/`SignupScreen` - the bare screens (self-contained,
 *   bundle their own AuthProvider, no react-router dependency), for a
 *   host that wants to mount one somewhere custom instead.
 */
export { default as LoginScreen } from "./screens/LoginScreen";
export { default as SignupScreen } from "./screens/SignupScreen";
export type { LoginScreenProps } from "./screens/LoginScreen";
export type { SignupScreenProps } from "./screens/SignupScreen";

// Customizes the pages `createAuthRoutes` mounts (e.g. their title) -
// the host wraps its app in it, since it can't pass those pages props.
export { AuthScreenProvider } from "./screens/AuthScreenConfig";
export type { AuthScreenConfig } from "./screens/AuthScreenConfig";

// Both screens' onSuccess callback receives one of these; so does
// `getSession()`.
export type { Session } from "./lib/api/auth";

export { createAuthRoutes } from "./authRoutes";

// RBAC: its CRUD screens (users/roles/role assignments/permissions) and
// the signed-in user's permissions, for hiding what they can't open.
export { createRbacRoutes, fetchMyPermissions, filterNavByPermissions, hasPermission, useMyPermissions } from "./rbac";
// Its sidebar entries (the "Access control" group) - same `basePath` as
// `createRbacRoutes`.
export { createRbacNavItems } from "./rbacNav";
export type { AuthRouteConfigEntry } from "./authRoutes";

export {
  clearSession,
  getSession,
  initSession,
  isSessionInitialized,
  logout,
  refreshSession,
  setSession,
  subscribeSession,
} from "./session";
