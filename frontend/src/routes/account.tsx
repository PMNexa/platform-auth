import { useNavigate, useOutletContext } from "react-router";
import MyAccountScreen from "../screens/MyAccountScreen";
import { localeFromMatches, translator } from "platform-core";
import titles from "./titles.messages";

// oxlint-disable-next-line react/only-export-components
export function meta({ matches }: { matches?: readonly unknown[] }) {
  return [{ title: translator(titles, localeFromMatches(matches))("myAccount") }];
}

/** `createAccountRoutes()`' page - inside the host's app shell (signed in). */
export default function AccountRoute() {
  const navigate = useNavigate();
  const accessToken = useOutletContext<string>();
  return <MyAccountScreen accessToken={accessToken} onDeleted={() => navigate("/", { replace: true })} />;
}
