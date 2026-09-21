/**
 * Package entry point - what a consuming app (apps/main) imports.
 *
 * Exports both halves a host needs to wire up a screen: the PAGE
 * (`LoginScreen`/`SignupScreen` - self-contained, bundle their own
 * AuthProvider, no react-router dependency, see each file's own
 * docstring) and the ROUTE (`BASE_PATH` + `LOGIN_PATH`/`SIGNUP_PATH` -
 * this module's own suggested URL segments, so the host doesn't have to
 * hardcode/guess paths that might drift from what this package actually
 * expects). The host still owns registering the routes (react-router
 * framework mode's routes.ts needs real files, not runtime values, for
 * its own components) - see apps/main/frontend/app/routes.ts +
 * app/routes/login.tsx / signup.tsx for the consumer-side wiring this
 * pairs with. `apps/main` mounts both under `BASE_PATH` ("/auth"), giving
 * "/auth/login" and "/auth/signup" - that nesting choice belongs to the
 * host, this package only names its own bare segments.
 */
import { refresh } from "./lib/api/auth";
import type { Session } from "./lib/api/auth";

export { default as LoginScreen } from "./screens/LoginScreen";
export { default as SignupScreen } from "./screens/SignupScreen";
export const BASE_PATH = "auth";
export const LOGIN_PATH = "login";
export const SIGNUP_PATH = "signup";

// Both screens' onSuccess callback receives one of these - the host uses
// it to make its own authenticated calls afterward (e.g. to another
// module's API), without needing to know anything about how this module
// stores/manages the token internally.
export type { Session };

/**
 * Exchanges the httpOnly refresh cookie for a fresh access token -
 * exported as a plain function, not tied to either screen, so a host can
 * call it once at its own app boot (before any screen has even
 * rendered) to restore a session that survived a page reload. The
 * access token itself is memory-only (see `lib/auth/tokenStore.ts`'s own
 * docstring); the refresh cookie is what actually persists. Rejects
 * (throws `ApiError`, status 401) if there's no valid cookie - a host
 * should treat that as "no existing session", not surface it as an
 * error. Returns the same `Session` shape the screens' `onSuccess` does.
 */
export async function refreshSession(): Promise<Session> {
  const response = await refresh();
  return { accessToken: response.access_token, user: response.user };
}
