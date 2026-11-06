import { useCallback } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import type { Session } from "../lib/api/auth";
import { useAuthScreenConfig } from "../screens/AuthScreenConfig";
import { useT } from "platform-core";
import messages from "./messages";
import { VerifyEmailScreen } from "../screens/AccountScreens";
import { setSession } from "../session";
import { nextPath, siblingPath } from "./redirect";
import { localeFromMatches, translator } from "platform-core";
import titles from "./titles.messages";

// oxlint-disable-next-line react/only-export-components
export function meta({ matches }: { matches?: readonly unknown[] }) {
  return [{ title: translator(titles, localeFromMatches(matches))("confirmEmail") }];
}

/** Where a signup's confirmation link lands (`?token=`) - confirms, then signs in. */
export default function VerifyRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();
  const t = useT(messages);
  const { title } = useAuthScreenConfig();
  const onSuccess = useCallback(
    (session: Session) => {
      setSession(session);
      navigate(nextPath(search), { replace: true });
    },
    [navigate, search],
  );
  return (
    <VerifyEmailScreen
      title={title}
      token={search.get("token") ?? ""}
      footer={<Link to={siblingPath({ ...location, search: "" }, "login")}>{t("backToLogin")}</Link>}
      onSuccess={onSuccess}
    />
  );
}
