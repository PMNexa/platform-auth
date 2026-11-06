import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { useAuthScreenConfig } from "../screens/AuthScreenConfig";
import { useT } from "platform-core";
import messages from "./messages";
import { ResetPasswordScreen } from "../screens/AccountScreens";
import { setSession } from "../session";
import { nextPath, siblingPath } from "./redirect";
import { localeFromMatches, translator } from "platform-core";
import titles from "./titles.messages";

// oxlint-disable-next-line react/only-export-components
export function meta({ matches }: { matches?: readonly unknown[] }) {
  return [{ title: translator(titles, localeFromMatches(matches))("chooseAPassword") }];
}

/** Where a reset or invitation link lands (`?token=`) - sets the password, then signs in. */
export default function ResetRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();
  const t = useT(messages);
  const { title } = useAuthScreenConfig();
  return (
    <ResetPasswordScreen
      title={title}
      token={search.get("token") ?? ""}
      footer={<Link to={siblingPath({ ...location, search: "" }, "forgot")}>{t("needNewLink")}</Link>}
      onSuccess={(session) => {
        setSession(session);
        navigate(nextPath(search), { replace: true });
      }}
    />
  );
}
