import { Link, useLocation, useSearchParams } from "react-router";
import { useAuthScreenConfig } from "../screens/AuthScreenConfig";
import { ForgotPasswordScreen } from "../screens/AccountScreens";
import { siblingPath } from "./redirect";

// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Forgot password" }];
}

/** `createAuthRoutes()`' forgot-password page - see `login.tsx`. */
export default function ForgotRoute() {
  const location = useLocation();
  const [search] = useSearchParams();
  const { title } = useAuthScreenConfig();
  return (
    <ForgotPasswordScreen
      title={title}
      defaultEmail={search.get("email") ?? ""}
      footer={<Link to={siblingPath(location, "login")}>Back to log in</Link>}
    />
  );
}
