import { API_BASE_URL } from "../lib/api/client";
import type { AuthConfig } from "../lib/api/auth";

/** Why a single sign-on attempt came back to the login page (`?sso_error=<code>`, set by the backend). */
const SSO_ERRORS: Record<string, string> = {
  expired: "That sign-in took too long or was started in another browser. Try again.",
  denied: "The sign-in was cancelled.",
  email_unverified: "Your email address isn't verified with the sign-in provider yet.",
  no_email: "The sign-in provider didn't share an email address.",
  account_disabled: "This account is disabled. Contact an administrator.",
  signup_closed: "Sign-ups are closed. Ask an administrator for an account.",
  signup_domain: "Your email address isn't from a domain that can sign up here.",
  signup_invite_only: "Sign-ups are by invitation only. Use the link from your invitation.",
  setup_required: "This app isn't set up yet - create the admin account first.",
  provider_unreachable: "The sign-in provider can't be reached right now. Try again in a moment.",
};

// oxlint-disable-next-line react/only-export-components
export function ssoErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return SSO_ERRORS[code] ?? "Signing in didn't work. Try again, or contact an administrator.";
}

/**
 * "Sign in with <provider>" - a plain link: the backend redirects to the
 * provider and back (`platform_auth/views/sso.py`), ending on the `sso`
 * page. `next` is where to go after (a same-origin path).
 */
export default function SsoButton({ sso, next, primary }: { sso: NonNullable<AuthConfig["sso"]>; next?: string; primary?: boolean }) {
  const query = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return (
    <div className="d-grid">
      <a className={`btn btn-sm ${primary ? "btn-primary" : "btn-outline-secondary"}`} href={`${API_BASE_URL}${sso.start_url}${query}`}>
        Sign in with {sso.label}
      </a>
    </div>
  );
}
