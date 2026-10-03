import { API_BASE_URL } from "../lib/api/client";
import type { SsoProvider } from "../lib/api/auth";

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
 * "Continue with <provider>", one button per provider - plain links: the
 * backend redirects to the provider and back
 * (`platform_auth/views/sso.py`), ending on the `sso` page. `next` is
 * where to go after (a same-origin path). Styled after Google's own
 * sign-in button (white, grey outline, the brand's logo) -
 * Google asks for that look, and the other providers match it. `primary`:
 * these are the only way in, so a provider without a brand logo gets the
 * page's main-button colour instead. Styles ship as a string through
 * React 19's `<style href precedence>` (a `.css` import would break the
 * host's route-config loader).
 */
export default function SsoButton({ sso, next, primary }: { sso: SsoProvider[]; next?: string; primary?: boolean }) {
  const query = next && next !== "/" ? `next=${encodeURIComponent(next)}` : "";
  return (
    <div className="d-grid gap-2">
      <style href="platform-auth-sso-button" precedence="default">
        {SSO_BUTTON_CSS}
      </style>
      {sso.map((provider) => {
        const Logo = LOGOS[provider.icon ?? ""] ?? KeyIcon;
        const filled = primary && !LOGOS[provider.icon ?? ""];
        return (
          <a
            key={provider.id}
            className={`pa-sso${filled ? " pa-sso--filled" : ""}`}
            href={`${API_BASE_URL}${provider.start_url}${query && (provider.start_url.includes("?") ? "&" : "?")}${query}`}
          >
            <Logo />
            <span>Continue with {provider.label}</span>
          </a>
        );
      })}
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg className="pa-sso__icon" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function MicrosoftLogo() {
  return (
    <svg className="pa-sso__icon" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

function KeyIcon() {
  return (
    <svg className="pa-sso__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16.555 3.843l3.602 3.602a2.877 2.877 0 0 1 0 4.069l-2.643 2.643a2.877 2.877 0 0 1 -4.069 0l-.301 -.301l-6.558 6.558a2 2 0 0 1 -1.239 .578l-.175 .008h-1.172a1 1 0 0 1 -.993 -.883l-.007 -.117v-1.172a2 2 0 0 1 .467 -1.284l.119 -.13l.414 -.414h2v-2h2v-2l2.144 -2.144l-.301 -.301a2.877 2.877 0 0 1 0 -4.069l2.643 -2.643a2.877 2.877 0 0 1 4.069 0z" />
      <path d="M15 9h.01" />
    </svg>
  );
}

const LOGOS: Record<string, () => React.JSX.Element> = { google: GoogleLogo, microsoft: MicrosoftLogo };

const SSO_BUTTON_CSS = `
.pa-sso {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  width: 100%; height: 36px; padding: 0 16px;
  border: 1px solid #747775; border-radius: 6px;
  background: #fff; color: #1f1f1f;
  font: 500 14px/1 Roboto, Inter, system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing: .25px;
  text-decoration: none; white-space: nowrap;
  transition: background-color .15s ease, box-shadow .15s ease;
}
.pa-sso:hover {
  background: #f8fafd; color: #1f1f1f; text-decoration: none;
  box-shadow: 0 1px 2px rgba(60, 64, 67, .3), 0 1px 3px 1px rgba(60, 64, 67, .15);
}
.pa-sso:active { background: #eef1f6; box-shadow: none; }
.pa-sso:focus-visible { outline: 2px solid var(--tblr-primary, #206bc4); outline-offset: 2px; }
.pa-sso__icon { width: 18px; height: 18px; flex: none; }
.pa-sso--filled { background: var(--tblr-primary, #206bc4); border-color: var(--tblr-primary, #206bc4); color: #fff; }
.pa-sso--filled:hover { background: var(--tblr-primary, #206bc4); color: #fff; filter: brightness(.95); }
`;
