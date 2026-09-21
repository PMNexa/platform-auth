import { useState } from "react";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import Login from "../pages/Login";

/**
 * The module-federation-exposed entry point (see vite.config.ts's
 * `exposes` map) - self-contained on purpose: bundles its own
 * AuthProvider so a host app doesn't need to know anything about this
 * module's internal auth state to render it. No react-router-dom
 * dependency (see Login's own docstring for why that matters for
 * federation specifically).
 */
function RemoteLoginInner({ onSuccess }: { onSuccess?: () => void }) {
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
      onSuccess={() => {
        setJustLoggedIn(true);
        onSuccess?.();
      }}
    />
  );
}

export default function RemoteLogin(props: { onSuccess?: () => void }) {
  return (
    <AuthProvider>
      <RemoteLoginInner {...props} />
    </AuthProvider>
  );
}
