import { useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useT, type Translate } from "platform-core";
import { useAuth } from "../auth/AuthContext";
import { VerificationPendingError } from "../auth/errors";
import { useAuthConfig } from "../auth/useAuthConfig";
import { CheckEmailNotice } from "../screens/AccountScreens";
import SsoButton from "../screens/SsoButton";
import { ApiError } from "../lib/api/client";
import type { Session } from "../lib/api/auth";
import AuthCard from "./AuthCard";
import messages from "./messages";

// The minimum length is a setting of the instance (`auth/config`); its
// other rules (common passwords) come back as the server's own message.
function signupSchema(minLength: number, t: Translate<(typeof messages)["en"]>) {
  return z.object({
    name: z.string().trim().min(1, t("nameRequired")),
    email: z.string().trim().min(1, t("emailRequired")),
    password: z.string().min(minLength, t("passwordTooShort", { n: minLength })),
  });
}

type SignupFormValues = z.infer<ReturnType<typeof signupSchema>>;

/** The API's message, or its per-field ones (a refused password comes back under `password`). */
function errorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  const fields = (err.body as { field_errors?: Record<string, string[]> | null } | undefined)?.field_errors;
  return fields ? Object.values(fields).flat().join(" ") : err.message;
}

export interface SignupProps {
  // See Login's own docstring for why this has no react-router dependency.
  onSuccess: (session: Session) => void;
  /** The heading above the card - e.g. the host app's name or logo. @default "platform-auth" */
  title?: ReactNode;
  /** Below the card - e.g. a link to the other auth page (the host routes it). */
  footer?: ReactNode;
  /** Prefills the email field - e.g. from an invitation (`?email=`). */
  defaultEmail?: string;
  /** First-run onboarding: creates the first account as the admin (`/setup`) instead of signing up. */
  setup?: boolean;
  /** Where single sign-on returns to afterwards (a same-origin path). */
  next?: string;
}

/** The signup link's `?ref=` (who sent the visitor) - read here, since this page has no router. */
function signupRef(): string | undefined {
  try {
    return new URLSearchParams(window.location.search).get("ref")?.slice(0, 64) || undefined;
  } catch {
    return undefined;
  }
}

function Signup({ onSuccess, title = "platform-auth", setup = false, footer, defaultEmail, next }: SignupProps) {
  const t = useT(messages);
  const auth = useAuth();
  const config = useAuthConfig();
  const minLength = config?.password_min_length ?? 8;
  const resolver = useMemo(() => zodResolver(signupSchema(minLength, t)), [minLength, t]);
  // Single sign-on never creates the first (admin) account - setup keeps its form.
  const sso = setup ? [] : (config?.sso ?? []);
  const ssoOnly = !setup && config !== null && !config.password_login;
  const signup = setup ? auth.setup : auth.signup;
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // The account was created, but its email must be confirmed first.
  const [pending, setPending] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({ resolver, defaultValues: { email: defaultEmail ?? "" } });

  async function onSubmit(values: SignupFormValues) {
    setError(null);
    setSubmitting(true);
    try {
      const session = await signup(values.name, values.email, values.password, { next, ref: signupRef() });
      onSuccess(session);
    } catch (err) {
      if (err instanceof VerificationPendingError) {
        setPending(err.email);
        return;
      }
      setError(errorMessage(err, t("genericError")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title={title} footer={footer}>
      {setup ? (
        <>
          <p className="text-center mb-1 fw-bold">{t("setupWelcome")}</p>
          <p className="text-center text-secondary mb-3">
            {t("setupIntro")}
          </p>
        </>
      ) : (
        <p className="text-center mb-3">{t("signupIntro")}</p>
      )}
      {sso.length > 0 && !pending && (
        <>
          <SsoButton sso={sso} next={next} primary={ssoOnly} />
          {!ssoOnly && <div className="hr-text my-3">{t("or")}</div>}
        </>
      )}
      {pending ? (
        <CheckEmailNotice email={pending} next={next} />
      ) : (
      <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate hidden={ssoOnly}>
        <div className="mb-3">
          <label className="form-label" htmlFor="name">{t("name")}</label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            className={`form-control form-control-sm ${errors.name ? "is-invalid" : ""}`}
            {...register("name")}
          />
          {errors.name && <div className="invalid-feedback">{errors.name.message}</div>}
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="email">{t("email")}</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={`form-control form-control-sm ${errors.email ? "is-invalid" : ""}`}
            {...register("email")}
          />
          {errors.email && <div className="invalid-feedback">{errors.email.message}</div>}
        </div>
        <div className="mb-3">
          <label className="form-label" htmlFor="password">{t("password")}</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className={`form-control form-control-sm ${errors.password ? "is-invalid" : ""}`}
            {...register("password")}
          />
          {errors.password && <div className="invalid-feedback">{errors.password.message}</div>}
          <small className="form-hint">{t("minLength", { n: minLength })}</small>
        </div>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <div className="d-grid gap-2">
          <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
            {submitting ? t("creatingAccount") : setup ? t("createAdmin") : t("signUp")}
          </button>
        </div>
      </form>
      )}
    </AuthCard>
  );
}

export default Signup;
