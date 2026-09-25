import { useState, type ReactNode } from "react";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import Signup from "../pages/Signup";
import type { Session } from "../lib/api/auth";

/**
 * This package's exported signup screen (see src/index.ts) - self-
 * contained on purpose, same shape as LoginScreen: bundles its own
 * AuthProvider, no react-router dependency (see Signup's own docstring).
 */
function SignupScreenInner({ onSuccess, title, setup, footer, defaultEmail }: SignupScreenProps) {
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
      title={title}
      setup={setup}
      defaultEmail={defaultEmail}
      footer={footer}
      onSuccess={(session) => {
        setJustSignedUp(true);
        onSuccess?.(session);
      }}
    />
  );
}

export interface SignupScreenProps {
  onSuccess?: (session: Session) => void;
  /** The heading above the card; overrides `AuthScreenProvider`'s. @default "platform-auth" */
  title?: ReactNode;
  /** First-run onboarding: create the first account as the admin instead. */
  setup?: boolean;
  /** Below the card - e.g. a link to the other auth page (the host routes it). */
  footer?: ReactNode;
  /** Prefills the email field - e.g. from an invitation (`?email=`). */
  defaultEmail?: string;
}

export default function SignupScreen(props: SignupScreenProps) {
  return (
    <AuthProvider>
      <SignupScreenInner {...props} />
    </AuthProvider>
  );
}
