import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { useAuthScreenConfig } from "../screens/AuthScreenConfig";
import { useT } from "platform-core";
import messages from "./messages";
import LoginScreen from "../screens/LoginScreen";
import { setSession } from "../session";
import { nextPath, siblingPath } from "./redirect";
import { useSetupGate } from "./useSetupGate";
import { localeFromMatches, translator } from "platform-core";
import titles from "./titles.messages";

/**
 * Route module registered by `createAuthRoutes()` (see `../authRoutes.ts`)
 * - wraps `LoginScreen`, stores the resulting session in this module's
 * own store (`../session.ts`) and redirects to `?next=` (see
 * `./redirect.ts`). Imports `react-router` directly (the one file type in
 * this package allowed to) - the host's `resolve.dedupe` makes that
 * resolve to the HOST's own copy.
 */
// oxlint-disable-next-line react/only-export-components
export function meta({ matches }: { matches?: readonly unknown[] }) {
  return [{ title: translator(titles, localeFromMatches(matches))("logIn") }];
}

export default function LoginRoute() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const location = useLocation();
  const t = useT(messages);
  const { title } = useAuthScreenConfig();
  if (!useSetupGate("login")) return null;
  return (
    <LoginScreen
      title={title}
      footer={
        <>
          {t("noAccount")} <Link to={siblingPath(location, "signup")}>{t("signUp")}</Link>
        </>
      }
      forgotPassword={<Link to={siblingPath({ ...location, search: "" }, "forgot")}>{t("forgotPassword")}</Link>}
      next={nextPath(search)}
      ssoError={search.get("sso_error")}
      onSuccess={(session) => {
        setSession(session);
        navigate(nextPath(search), { replace: true });
      }}
    />
  );
}
