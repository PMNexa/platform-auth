import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { useAuthScreenConfig } from "../screens/AuthScreenConfig";
import { ResetPasswordScreen } from "../screens/AccountScreens";
import { setSession } from "../session";
import { nextPath, siblingPath } from "./redirect";

// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Choose a password" }];
}

/** Where a reset or invitation link lands (`?token=`) - sets the password, then signs in. */
export default function ResetRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();
  const { title } = useAuthScreenConfig();
  return (
    <ResetPasswordScreen
      title={title}
      token={search.get("token") ?? ""}
      footer={<Link to={siblingPath({ ...location, search: "" }, "forgot")}>Need a new link?</Link>}
      onSuccess={(session) => {
        setSession(session);
        navigate(nextPath(search), { replace: true });
      }}
    />
  );
}
