import { useState, type ReactNode } from "react";
import { AuthProvider, useAuth } from "../auth/AuthContext";
import Signup from "../pages/Signup";
import type { Session } from "../lib/api/auth";
import { useT } from "platform-core";
import messages from "./AccountScreens.messages";

/**
 * This package's exported signup screen (see src/index.ts) - self-
 * contained on purpose, same shape as LoginScreen: bundles its own
 * AuthProvider, no react-router dependency (see Signup's own docstring).
 */
function SignupScreenInner({ onSuccess, title, setup, footer, defaultEmail, next }: SignupScreenProps) {
  const t = useT(messages);
  const { user } = useAuth();
  const [justSignedUp, setJustSignedUp] = useState(false);

  if (user && justSignedUp) {
    return (
      <p>{t("accountCreated", { name: user.name, email: user.email })}</p>
    );
  }

  return (
    <Signup
      title={title}
      setup={setup}
      defaultEmail={defaultEmail}
      footer={footer}
      next={next}
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
  /** Where single sign-on returns to afterwards (a same-origin path). */
  next?: string;
}

export default function SignupScreen(props: SignupScreenProps) {
  return (
    <AuthProvider>
      <SignupScreenInner {...props} />
    </AuthProvider>
  );
}
