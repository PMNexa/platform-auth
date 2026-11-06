import type { ReactNode } from "react";
import { LanguageSelect } from "platform-core";
import { setUserLanguage } from "../session";

/**
 * The centered card every auth page sits in (login, signup, reset, ...),
 * with a small language picker under it - these pages come before
 * signing in, so this is where a visitor picks their language (saved on
 * the account once there is one, see `setUserLanguage`).
 */
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
            <div className="d-flex justify-content-center mt-3">
              <LanguageSelect className="form-select form-select-sm w-auto" onChange={(code) => void setUserLanguage(code)} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
