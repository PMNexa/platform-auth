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
export { default as LoginScreen } from "./screens/LoginScreen";
export { default as SignupScreen } from "./screens/SignupScreen";
export const BASE_PATH = "auth";
export const LOGIN_PATH = "login";
export const SIGNUP_PATH = "signup";
