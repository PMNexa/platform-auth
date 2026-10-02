import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../lib/api/client";
import type { Session } from "../lib/api/auth";
import { useAuthConfig } from "../auth/useAuthConfig";
import { CheckEmailNotice } from "../screens/AccountScreens";
import SsoButton, { ssoErrorMessage } from "../screens/SsoButton";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required."),
  password: z.string().min(1, "Password is required."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export interface LoginProps {
  /**
   * Deliberately no react-router-dom dependency in this component (no
   * useNavigate) - a consuming app (this package's own App.tsx for
   * standalone dev, or a host app like apps/main importing LoginScreen)
   * may be on a different react-router major version entirely, or a
   * separate module instance of the same one; either way useNavigate()
   * would throw even though the component visually renders fine.
   * Callers that need routing provide it via this prop instead.
   */
  onSuccess: (session: Session) => void;
  /** The heading above the card - e.g. the host app's name or logo. @default "platform-auth" */
  title?: ReactNode;
  /** Below the card - e.g. a link to the other auth page (the host routes it). */
  footer?: ReactNode;
  /** Under the password field - a "Forgot password?" link (the host routes it). */
  forgotPassword?: ReactNode;
  /** Where single sign-on returns to afterwards (a same-origin path). */
  next?: string;
  /** Why a single sign-on attempt came back here (`?sso_error=`). */
  ssoError?: string | null;
}

function Login({ onSuccess, title = "platform-auth", footer, forgotPassword, next, ssoError }: LoginProps) {
  const { login } = useAuth();
  const config = useAuthConfig();
  const [error, setError] = useState<string | null>(ssoErrorMessage(ssoError));
  // Set when the account exists but its email isn't confirmed yet - offers a new link.
  const [unverified, setUnverified] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginFormValues) {
    setError(null);
    setUnverified(null);
    setSubmitting(true);
    try {
      const session = await login(values.email, values.password);
      onSuccess(session);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      const code = err instanceof ApiError ? (err.body as { code?: string } | undefined)?.code : undefined;
      if (code === "email_unverified") setUnverified(values.email);
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
                <p className="text-center mb-3">Sign in to start your session</p>
                {config?.sso && (
                  <>
                    <SsoButton sso={config.sso} next={next} primary={!config.password_login} />
                    {config.password_login && <div className="hr-text my-3">or</div>}
                  </>
                )}
                {config && !config.password_login && error && (
                  <div className="alert alert-danger mt-3 mb-0" role="alert">{error}</div>
                )}
                {/* Hidden only once the server says single sign-on is the only way in. */}
                <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate hidden={config ? !config.password_login : false}>
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
                      autoComplete="current-password"
                      className={`form-control form-control-sm ${errors.password ? "is-invalid" : ""}`}
                      {...register("password")}
                    />
                    {errors.password && <div className="invalid-feedback">{errors.password.message}</div>}
                    {forgotPassword && <div className="mt-1 small">{forgotPassword}</div>}
                  </div>
                  {error && <div className="alert alert-danger" role="alert">{error}</div>}
                  {unverified && (
                    <div className="mb-3">
                      <CheckEmailNotice email={unverified} next={next} />
                    </div>
                  )}
                  <div className="d-grid gap-2">
                    <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                      {submitting ? "Signing in..." : "Sign In"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
            {footer && <div className="text-center text-secondary mt-3">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
