import { useCallback } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import type { Session } from "../lib/api/auth";
import { useAuthScreenConfig } from "../screens/AuthScreenConfig";
import { VerifyEmailScreen } from "../screens/AccountScreens";
import { setSession } from "../session";
import { nextPath, siblingPath } from "./redirect";

// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Confirm email" }];
}

/** Where a signup's confirmation link lands (`?token=`) - confirms, then signs in. */
export default function VerifyRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();
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
      footer={<Link to={siblingPath({ ...location, search: "" }, "login")}>Back to log in</Link>}
      onSuccess={onSuccess}
    />
  );
}
