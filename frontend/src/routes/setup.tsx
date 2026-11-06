import { useNavigate, useSearchParams } from "react-router";
import { useAuthScreenConfig } from "../screens/AuthScreenConfig";
import SignupScreen from "../screens/SignupScreen";
import { setSession } from "../session";
import { nextPath } from "./redirect";
import { useSetupGate } from "./useSetupGate";
import { localeFromMatches, translator } from "platform-core";
import titles from "./titles.messages";

/**
 * First-run onboarding (see `login.tsx`'s docstring for the shape): the
 * signup form in setup mode - the account it creates becomes the admin.
 * Only reachable until the first account exists (`useSetupGate`).
 */
// oxlint-disable-next-line react/only-export-components
export function meta({ matches }: { matches?: readonly unknown[] }) {
  return [{ title: translator(titles, localeFromMatches(matches))("setUp") }];
}

export default function SetupRoute() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { title } = useAuthScreenConfig();
  if (!useSetupGate("setup")) return null;
  return (
    <SignupScreen
      title={title}
      setup
      onSuccess={(session) => {
        setSession(session);
        navigate(nextPath(search), { replace: true });
      }}
    />
  );
}
