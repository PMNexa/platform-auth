import { useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../auth/AuthContext";
import { VerificationPendingError } from "../auth/errors";
import { useAuthConfig } from "../auth/useAuthConfig";
import { CheckEmailNotice } from "../screens/AccountScreens";
import SsoButton from "../screens/SsoButton";
import { ApiError } from "../lib/api/client";
import type { Session } from "../lib/api/auth";

// The minimum length is a setting of the instance (`auth/config`); its
// other rules (common passwords) come back as the server's own message.
function signupSchema(minLength: number) {
  return z.object({
    name: z.string().trim().min(1, "Name is required."),
    email: z.string().trim().min(1, "Email is required."),
    password: z.string().min(minLength, `Password must be at least ${minLength} characters.`),
  });
}

type SignupFormValues = z.infer<ReturnType<typeof signupSchema>>;

/** The API's message, or its per-field ones (a refused password comes back under `password`). */
function errorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return "Something went wrong. Please try again.";
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
  const auth = useAuth();
  const config = useAuthConfig();
  const minLength = config?.password_min_length ?? 8;
  const resolver = useMemo(() => zodResolver(signupSchema(minLength)), [minLength]);
  // Single sign-on never creates the first (admin) account - setup keeps its form.
  const sso = setup ? null : config?.sso;
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
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-vh-100 d-flex align-items-center">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-4">
            <h1 className="h1 text-center mb-4">{title}</h1>
            <div className="card">
              <div className="card-body p-4">
                {setup ? (
                  <>
                    <p className="text-center mb-1 fw-bold">Welcome - let's set things up</p>
                    <p className="text-center text-secondary mb-3">
                      Create the first account. It becomes the administrator, with full access including users and roles.
                    </p>
                  </>
                ) : (
                  <p className="text-center mb-3">Create your account</p>
                )}
                {sso && !pending && (
                  <>
                    <SsoButton sso={sso} next={next} primary={ssoOnly} />
                    {!ssoOnly && <div className="hr-text my-3">or</div>}
                  </>
                )}
                {pending ? (
                  <CheckEmailNotice email={pending} next={next} />
                ) : (
                <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate hidden={ssoOnly}>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="name">Name</label>
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
                    <label className="form-label" htmlFor="email">Email</label>
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
                    <label className="form-label" htmlFor="password">Password</label>
                    <input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      className={`form-control form-control-sm ${errors.password ? "is-invalid" : ""}`}
                      {...register("password")}
                    />
                    {errors.password && <div className="invalid-feedback">{errors.password.message}</div>}
                    <small className="form-hint">At least {minLength} characters.</small>
                  </div>
                  {error && <div className="alert alert-danger" role="alert">{error}</div>}
                  <div className="d-grid gap-2">
                    <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                      {submitting ? "Creating account..." : setup ? "Create admin account" : "Sign Up"}
                    </button>
                  </div>
                </form>
                )}
              </div>
            </div>
            {footer && <div className="text-center text-secondary mt-3">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Signup;
