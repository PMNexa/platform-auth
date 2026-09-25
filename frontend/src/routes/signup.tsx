import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { useAuthScreenConfig } from "../screens/AuthScreenConfig";
import SignupScreen from "../screens/SignupScreen";
import { setSession } from "../session";
import { nextPath, siblingPath } from "./redirect";
import { useSetupGate } from "./useSetupGate";

/** See `login.tsx`'s own docstring - same shape, for signup. */
// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Sign up" }];
}

export default function SignupRoute() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const location = useLocation();
  const { title } = useAuthScreenConfig();
  if (!useSetupGate("signup")) return null;
  return (
    <SignupScreen
      title={title}
      defaultEmail={search.get("email") ?? undefined}
      footer={
        <>
          Already have an account? <Link to={siblingPath(location, "login")}>Log in</Link>
        </>
      }
      onSuccess={(session) => {
        setSession(session);
        navigate(nextPath(search), { replace: true });
      }}
    />
  );
}
