import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../lib/api/client";
import type { Session } from "../lib/api/auth";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().min(1, "Email is required."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export interface SignupProps {
  // See Login's own docstring for why this has no react-router dependency.
  onSuccess: (session: Session) => void;
}

function Signup({ onSuccess }: SignupProps) {
  const { signup } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(values: SignupFormValues) {
    setError(null);
    setSubmitting(true);
    try {
      const session = await signup(values.name, values.email, values.password);
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
                <p className="text-center mb-3">Create your account</p>
                <form method="post" onSubmit={handleSubmit(onSubmit)} noValidate>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="name">Name</label>
                    <input
                      id="name"
                      type="text"
                      autoComplete="name"
                      className={`form-control ${errors.name ? "is-invalid" : ""}`}
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
                      autoComplete="new-password"
                      className={`form-control ${errors.password ? "is-invalid" : ""}`}
                      {...register("password")}
                    />
                    {errors.password && <div className="invalid-feedback">{errors.password.message}</div>}
                  </div>
                  {error && <div className="alert alert-danger" role="alert">{error}</div>}
                  <div className="d-grid gap-2">
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                      {submitting ? "Creating account..." : "Sign Up"}
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

export default Signup;
