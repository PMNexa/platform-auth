import { Link, useLocation, useSearchParams } from "react-router";
import { useAuthScreenConfig } from "../screens/AuthScreenConfig";
import { useT } from "platform-core";
import messages from "./messages";
import { ForgotPasswordScreen } from "../screens/AccountScreens";
import { siblingPath } from "./redirect";
import { localeFromMatches, translator } from "platform-core";
import titles from "./titles.messages";

// oxlint-disable-next-line react/only-export-components
export function meta({ matches }: { matches?: readonly unknown[] }) {
  return [{ title: translator(titles, localeFromMatches(matches))("forgotPassword") }];
}

/** `createAuthRoutes()`' forgot-password page - see `login.tsx`. */
export default function ForgotRoute() {
  const location = useLocation();
  const [search] = useSearchParams();
  const t = useT(messages);
  const { title } = useAuthScreenConfig();
  return (
    <ForgotPasswordScreen
      title={title}
      defaultEmail={search.get("email") ?? ""}
      footer={<Link to={siblingPath(location, "login")}>{t("backToLogin")}</Link>}
    />
  );
}
