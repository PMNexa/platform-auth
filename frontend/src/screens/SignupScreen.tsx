import { useState } from "react";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import Signup from "../pages/Signup";
import type { Session } from "../lib/api/auth";

/**
 * This package's exported signup screen (see src/index.ts) - self-
 * contained on purpose, same shape as LoginScreen: bundles its own
 * AuthProvider, no react-router dependency (see Signup's own docstring).
 */
function SignupScreenInner({ onSuccess }: { onSuccess?: (session: Session) => void }) {
  const { user } = useAuth();
  const [justSignedUp, setJustSignedUp] = useState(false);

  if (user && justSignedUp) {
    return (
      <p>
        Account created for {user.name} ({user.email}).
      </p>
    );
  }

  return (
    <Signup
      onSuccess={(session) => {
        setJustSignedUp(true);
        onSuccess?.(session);
      }}
    />
  );
}

export default function SignupScreen(props: { onSuccess?: (session: Session) => void }) {
  return (
    <AuthProvider>
      <SignupScreenInner {...props} />
    </AuthProvider>
  );
}
