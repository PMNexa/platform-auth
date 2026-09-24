import { useNavigate, useSearchParams } from "react-router";
import { useAuthScreenConfig } from "../screens/AuthScreenConfig";
import LoginScreen from "../screens/LoginScreen";
import { setSession } from "../session";
import { nextPath } from "./redirect";
import { useSetupGate } from "./useSetupGate";

/**
 * Route module registered by `createAuthRoutes()` (see `../authRoutes.ts`)
 * - wraps `LoginScreen`, stores the resulting session in this module's
 * own store (`../session.ts`) and redirects to `?next=` (see
 * `./redirect.ts`). Imports `react-router` directly (the one file type in
 * this package allowed to) - the host's `resolve.dedupe` makes that
 * resolve to the HOST's own copy.
 */
// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Log in" }];
}

export default function LoginRoute() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { title } = useAuthScreenConfig();
  if (!useSetupGate("login")) return null;
  return (
    <LoginScreen
      title={title}
      onSuccess={(session) => {
        setSession(session);
        navigate(nextPath(search), { replace: true });
      }}
    />
  );
}
