/**
 * Package entry point - what a consuming app (apps/main) imports.
 *
 * Exports both halves a host needs to wire up one screen: the PAGE
 * (`LoginScreen` - self-contained, bundles its own AuthProvider, no
 * react-router dependency, see that file's own docstring) and the ROUTE
 * (`LOGIN_PATH` - this module's own suggested URL segment, so the host
 * doesn't have to hardcode/guess a path that might drift from what this
 * package actually expects). The host still owns registering the route
 * (react-router framework mode's routes.ts needs a real file, not a
 * runtime value, for its own component) - see
 * apps/main/frontend/app/routes.ts + app/routes/login.tsx for the
 * consumer-side wiring this pairs with.
 */
export { default as LoginScreen } from "./screens/LoginScreen";
export const LOGIN_PATH = "login";
