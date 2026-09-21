/**
 * Package entry point - what a consuming app (apps/main) imports.
 * `RemoteLogin` is deliberately self-contained (bundles its own
 * AuthProvider, no react-router-dom dependency) so a host can drop it
 * into any page/route with zero wiring - see that file's own docstring.
 */
export { default as RemoteLogin } from "./remote/RemoteLogin";
