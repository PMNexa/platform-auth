import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../lib/api/client";
import type { Session } from "../lib/api/auth";

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
}

function Login({ onSuccess }: LoginProps) {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginFormValues) {
    setError(null);
    setSubmitting(true);
    try {
      const session = await login(values.email, values.password);
      onSuccess(session);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-vh-100 d-flex align-items-center">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-4">
            <h1 className="h1 text-center mb-4">platform-auth</h1>
            <div className="card">
              <div className="card-body p-4">
                <p className="text-center mb-3">Sign in to start your session</p>
                <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="email">Email</label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      className={`form-control ${errors.email ? "is-invalid" : ""}`}
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
                      className={`form-control ${errors.password ? "is-invalid" : ""}`}
                      {...register("password")}
                    />
                    {errors.password && <div className="invalid-feedback">{errors.password.message}</div>}
                  </div>
                  {error && <div className="alert alert-danger" role="alert">{error}</div>}
                  <div className="d-grid gap-2">
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                      {submitting ? "Signing in..." : "Sign In"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
