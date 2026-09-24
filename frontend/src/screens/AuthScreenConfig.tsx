import { createContext, useContext, type ReactNode } from "react";

export interface AuthScreenConfig {
  /** The heading above the login/signup card - e.g. the host app's name or logo. @default "platform-auth" */
  title?: ReactNode;
}

const AuthScreenConfigContext = createContext<AuthScreenConfig>({});

/**
 * How a host customizes the login/signup pages `createAuthRoutes` mounts -
 * those route modules are this package's own, so a host can't pass them
 * props; it wraps its app in this instead (e.g. main's `root.tsx`). A host
 * rendering `LoginScreen`/`SignupScreen` itself can pass `title` directly.
 */
export function AuthScreenProvider({ children, ...config }: AuthScreenConfig & { children: ReactNode }) {
  return <AuthScreenConfigContext.Provider value={config}>{children}</AuthScreenConfigContext.Provider>;
}

export function useAuthScreenConfig(): AuthScreenConfig {
  return useContext(AuthScreenConfigContext);
}
