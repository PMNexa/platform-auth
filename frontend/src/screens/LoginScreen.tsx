import { useState } from "react";
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
function LoginScreenInner({ onSuccess }: { onSuccess?: (session: Session) => void }) {
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
      onSuccess={(session) => {
        setJustLoggedIn(true);
        onSuccess?.(session);
      }}
    />
  );
}

export default function LoginScreen(props: { onSuccess?: (session: Session) => void }) {
  return (
    <AuthProvider>
      <LoginScreenInner {...props} />
    </AuthProvider>
  );
}
