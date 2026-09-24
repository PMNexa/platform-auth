import { useNavigate, useSearchParams } from "react-router";
import { useAuthScreenConfig } from "../screens/AuthScreenConfig";
import SignupScreen from "../screens/SignupScreen";
import { setSession } from "../session";
import { nextPath } from "./redirect";

/** See `login.tsx`'s own docstring - same shape, for signup. */
// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Sign up" }];
}

export default function SignupRoute() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { title } = useAuthScreenConfig();
  return (
    <SignupScreen
      title={title}
      onSuccess={(session) => {
        setSession(session);
        navigate(nextPath(search), { replace: true });
      }}
    />
  );
}
