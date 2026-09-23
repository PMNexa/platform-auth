/**
 * Package entry point - what a consuming app (apps/main) imports.
 *
 * Just the PAGE components (`LoginScreen`/`SignupScreen` - self-
 * contained, bundle their own AuthProvider, no react-router dependency,
 * see each file's own docstring) plus `refreshSession`/`Session`. No
 * `BASE_PATH`/`LOGIN_PATH`/`SIGNUP_PATH` here - those used to be this
 * module's "suggested" URL segments, but `apps/main` is the only host
 * and it already owns every actual URL itself (`app/routes.ts`
 * registers `"auth/login"`/`"auth/signup"` as plain literals, matching
 * `useRequireAccessToken.ts`'s/`home.tsx`'s own hardcoded `"/auth/login"`
 * redirect target) - exporting a "suggested" path nobody actually
 * varies just adds a layer of indirection for a link that never
 * changes. See root `AGENTS.md`'s routing section for the same call
 * made for `platform-org-frontend`/`goalnexa-frontend`.
 */
import { refresh } from "./lib/api/auth";
import type { Session } from "./lib/api/auth";

export { default as LoginScreen } from "./screens/LoginScreen";
export { default as SignupScreen } from "./screens/SignupScreen";

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
