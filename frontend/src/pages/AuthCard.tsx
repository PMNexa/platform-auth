import type { ReactNode } from "react";

/** The centered card every auth page sits in (login, signup, reset, ...). */
export default function AuthCard({ title, footer, children }: { title?: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-vh-100 d-flex align-items-center">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-4">
            <h1 className="h1 text-center mb-4">{title}</h1>
            <div className="card">
              <div className="card-body p-4">{children}</div>
            </div>
            {footer && <div className="text-center text-secondary mt-3">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
