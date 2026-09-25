import { useState, type ReactNode } from "react";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import Login from "../pages/Login";
import type { Session } from "../lib/api/auth";

/**
 * This package's exported login screen (see src/index.ts) - self-
 * contained on purpose: bundles its own AuthProvider so a host app
 * doesn't need to know anything about this module's internal auth state
 * to render it. No react-router-dom dependency, deliberately - a
 * consuming app owns all routing/paths itself (see Login's own
 * docstring); this is a screen, not a router.
 */
function LoginScreenInner({ onSuccess, title, footer }: LoginScreenProps) {
  const { user } = useAuth();
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  if (user && justLoggedIn) {
    return (
      <p>
        Signed in as {user.name} ({user.email}).
      </p>
    );
  }

  return (
    <Login
      title={title}
      footer={footer}
      onSuccess={(session) => {
        setJustLoggedIn(true);
        onSuccess?.(session);
      }}
    />
  );
}

export interface LoginScreenProps {
  onSuccess?: (session: Session) => void;
  /** The heading above the card; overrides `AuthScreenProvider`'s. @default "platform-auth" */
  title?: ReactNode;
  /** Below the card - e.g. a link to the other auth page (the host routes it). */
  footer?: ReactNode;
}

export default function LoginScreen(props: LoginScreenProps) {
  return (
    <AuthProvider>
      <LoginScreenInner {...props} />
    </AuthProvider>
  );
}
