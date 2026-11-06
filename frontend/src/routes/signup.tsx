import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { useAuthScreenConfig } from "../screens/AuthScreenConfig";
import { useT } from "platform-core";
import messages from "./messages";
import SignupScreen from "../screens/SignupScreen";
import { setSession } from "../session";
import { nextPath, siblingPath } from "./redirect";
import { useSetupGate } from "./useSetupGate";
import { localeFromMatches, translator } from "platform-core";
import titles from "./titles.messages";

/** See `login.tsx`'s own docstring - same shape, for signup. */
// oxlint-disable-next-line react/only-export-components
export function meta({ matches }: { matches?: readonly unknown[] }) {
  return [{ title: translator(titles, localeFromMatches(matches))("signUp") }];
}

export default function SignupRoute() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const location = useLocation();
  const t = useT(messages);
  const { title } = useAuthScreenConfig();
  if (!useSetupGate("signup")) return null;
  return (
    <SignupScreen
      title={title}
      defaultEmail={search.get("email") ?? undefined}
      next={nextPath(search)}
      footer={
        <>
          {t("haveAccount")} <Link to={siblingPath(location, "login")}>{t("logIn")}</Link>
        </>
      }
      onSuccess={(session) => {
        setSession(session);
        navigate(nextPath(search), { replace: true });
      }}
    />
  );
}
