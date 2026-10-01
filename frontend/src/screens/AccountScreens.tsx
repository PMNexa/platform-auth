import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ApiError } from "../lib/api/client";
import { forgotPassword, resendVerification, resetPassword, verifyEmail, type Session } from "../lib/api/auth";
import { setAccessToken } from "../lib/auth/tokenStore";
import AuthCard from "../pages/AuthCard";

/**
 * The email-link screens - forgot password, set a new one (a reset or
 * invitation link), confirm an email, and "check your inbox" after a
 * signup that needs confirming. Self-contained like `LoginScreen`: no
 * router; the host passes the link's `token`, an `onSuccess` that stores
 * the session and navigates, and `footer` links.
 */
interface CommonProps {
  title?: ReactNode;
  footer?: ReactNode;
}

function message(thrown: unknown): string {
  return thrown instanceof ApiError ? thrown.message : "Something went wrong. Please try again.";
}

function toSession(response: { access_token: string; user: Session["user"] }): Session {
  setAccessToken(response.access_token);
  return { accessToken: response.access_token, user: response.user };
}

export function ForgotPasswordScreen({ title, footer, defaultEmail = "" }: CommonProps & { defaultEmail?: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (thrown) {
      setError(message(thrown));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title={title} footer={footer}>
      {sent ? (
        <p className="mb-0">
          If an account uses <strong>{email}</strong>, a link to reset its password is on its way. It works for 2 hours.
        </p>
      ) : (
        <form onSubmit={submit} noValidate>
          <p className="text-center mb-3">Forgot your password? We'll email you a link to choose a new one.</p>
          <label className="form-label" htmlFor="forgot-email">Email</label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            className="form-control form-control-sm mb-3"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          <div className="d-grid">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !email.trim()}>
              {busy ? "Sending..." : "Email me a link"}
            </button>
          </div>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPasswordScreen({
  title,
  footer,
  token,
  onSuccess,
}: CommonProps & { token: string; onSuccess: (session: Session) => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mismatch = confirm !== "" && confirm !== password;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8 || mismatch) return;
    setBusy(true);
    setError(null);
    try {
      onSuccess(toSession(await resetPassword(token, password)));
    } catch (thrown) {
      setError(message(thrown));
      setBusy(false);
    }
  }

  return (
    <AuthCard title={title} footer={footer}>
      <form onSubmit={submit} noValidate>
        <p className="text-center mb-3">Choose a password for your account.</p>
        <label className="form-label" htmlFor="reset-password">New password</label>
        <input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          className="form-control form-control-sm mb-1"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <small className="form-hint mb-3">At least 8 characters.</small>
        <label className="form-label" htmlFor="reset-confirm">Repeat it</label>
        <input
          id="reset-confirm"
          type="password"
          autoComplete="new-password"
          className={`form-control form-control-sm mb-3 ${mismatch ? "is-invalid" : ""}`}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
        {mismatch && <div className="invalid-feedback d-block mb-2">The passwords don't match.</div>}
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <div className="d-grid">
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || password.length < 8 || confirm !== password}>
            {busy ? "Saving..." : "Save password and sign in"}
          </button>
        </div>
      </form>
    </AuthCard>
  );
}

export function VerifyEmailScreen({
  title,
  footer,
  token,
  onSuccess,
}: CommonProps & { token: string; onSuccess: (session: Session) => void }) {
  const [error, setError] = useState<string | null>(null);
  // StrictMode runs effects twice in dev - verify once.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    verifyEmail(token)
      .then((response) => onSuccess(toSession(response)))
      .catch((thrown: unknown) => setError(message(thrown)));
  }, [token, onSuccess]);

  return (
    <AuthCard title={title} footer={footer}>
      {error ? (
        <div className="alert alert-danger mb-0" role="alert">{error}</div>
      ) : (
        <p className="text-center mb-0">Confirming your email…</p>
      )}
    </AuthCard>
  );
}

/** After a signup that needs confirming: where the link went, and a way to send another. */
export function CheckEmailNotice({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  return (
    <div>
      <p>
        We sent a link to <strong>{email}</strong>. Open it to confirm your address and sign in - it works for 7 days.
      </p>
      <button
        type="button"
        className="btn btn-link btn-sm p-0"
        disabled={state !== "idle"}
        onClick={() => {
          setState("sending");
          void resendVerification(email).finally(() => setState("sent"));
        }}
      >
        {state === "sent" ? "Sent again" : "Send it again"}
      </button>
    </div>
  );
}
