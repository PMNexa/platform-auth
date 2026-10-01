import { useNavigate, useOutletContext } from "react-router";
import MyAccountScreen from "../screens/MyAccountScreen";

// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "My account" }];
}

/** `createAccountRoutes()`' page - inside the host's app shell (signed in). */
export default function AccountRoute() {
  const navigate = useNavigate();
  const accessToken = useOutletContext<string>();
  return <MyAccountScreen accessToken={accessToken} onDeleted={() => navigate("/", { replace: true })} />;
}
