import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ApiError } from "../lib/api/client";
import { forgotPassword, resendVerification, resetPassword, verifyEmail, type Session } from "../lib/api/auth";
import { setAccessToken } from "../lib/auth/tokenStore";
import { useAuthConfig } from "../auth/useAuthConfig";
import AuthCard from "../pages/AuthCard";
import { useT } from "platform-core";
import messages from "./AccountScreens.messages";

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

function message(thrown: unknown, fallback: string): string {
  if (!(thrown instanceof ApiError)) return fallback;
  // A refused password comes back per field (`password`).
  const fields = (thrown.body as { field_errors?: Record<string, string[]> | null } | undefined)?.field_errors;
  return fields ? Object.values(fields).flat().join(" ") : thrown.message;
}

function toSession(response: { access_token: string; user: Session["user"] }): Session {
  setAccessToken(response.access_token);
  return { accessToken: response.access_token, user: response.user };
}

export function ForgotPasswordScreen({ title, footer, defaultEmail = "" }: CommonProps & { defaultEmail?: string }) {
  const t = useT(messages);
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
      setError(message(thrown, t("genericError")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title={title} footer={footer}>
      {sent ? (
        <p className="mb-0">{t.rich("forgotSent", { email })}</p>
      ) : (
        <form onSubmit={submit} noValidate>
          <p className="text-center mb-3">{t("forgotIntro")}</p>
          <label className="form-label" htmlFor="forgot-email">{t("email")}</label>
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
              {busy ? t("sending") : t("emailMeLink")}
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
  const t = useT(messages);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mismatch = confirm !== "" && confirm !== password;
  const minLength = useAuthConfig()?.password_min_length ?? 8;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < minLength || mismatch) return;
    setBusy(true);
    setError(null);
    try {
      onSuccess(toSession(await resetPassword(token, password)));
    } catch (thrown) {
      setError(message(thrown, t("genericError")));
      setBusy(false);
    }
  }

  return (
    <AuthCard title={title} footer={footer}>
      <form onSubmit={submit} noValidate>
        <p className="text-center mb-3">{t("resetIntro")}</p>
        <label className="form-label" htmlFor="reset-password">{t("newPassword")}</label>
        <input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          className="form-control form-control-sm mb-1"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <small className="form-hint mb-3">{t("minLength", { n: minLength })}</small>
        <label className="form-label" htmlFor="reset-confirm">{t("repeatIt")}</label>
        <input
          id="reset-confirm"
          type="password"
          autoComplete="new-password"
          className={`form-control form-control-sm mb-3 ${mismatch ? "is-invalid" : ""}`}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
        {mismatch && <div className="invalid-feedback d-block mb-2">{t("mismatch")}</div>}
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <div className="d-grid">
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy || password.length < minLength || confirm !== password}>
            {busy ? t("saving") : t("saveAndSignIn")}
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
  const t = useT(messages);
  const [error, setError] = useState<string | null>(null);
  // StrictMode runs effects twice in dev - verify once.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    verifyEmail(token)
      .then((response) => onSuccess(toSession(response)))
      .catch((thrown: unknown) => setError(message(thrown, t("genericError"))));
  }, [token, onSuccess, t]);

  return (
    <AuthCard title={title} footer={footer}>
      {error ? (
        <div className="alert alert-danger mb-0" role="alert">{error}</div>
      ) : (
        <p className="text-center mb-0">{t("confirming")}</p>
      )}
    </AuthCard>
  );
}

/** After a signup that needs confirming: where the link went, and a way to send another. */
export function CheckEmailNotice({ email, next }: { email: string; next?: string }) {
  const t = useT(messages);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  return (
    <div>
      <p>{t.rich("checkEmail", { email })}</p>
      <button
        type="button"
        className="btn btn-link btn-sm p-0"
        disabled={state !== "idle"}
        onClick={() => {
          setState("sending");
          void resendVerification(email, next).finally(() => setState("sent"));
        }}
      >
        {state === "sent" ? t("sentAgain") : t("sendAgain")}
      </button>
    </div>
  );
}
