import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { startImpersonation } from "../session";
import AuthCard from "../pages/AuthCard";
import { useAuthScreenConfig } from "../screens/AuthScreenConfig";
import { useT } from "platform-core";
import messages from "./messages";
import { localeFromMatches, translator } from "platform-core";
import titles from "./titles.messages";

// oxlint-disable-next-line react/only-export-components
export function meta({ matches }: { matches?: readonly unknown[] }) {
  return [{ title: translator(titles, localeFromMatches(matches))("viewAsUser") }];
}

/**
 * Where an admin's "View as" opens (`#<token>` - the fragment never
 * reaches a server or a log): starts the read-only view in this tab, then
 * goes to the app.
 */
export default function ViewAsRoute() {
  const navigate = useNavigate();
  const t = useT(messages);
  const { title } = useAuthScreenConfig();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = window.location.hash.slice(1);
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) {
      // oxlint-disable-next-line react/set-state-in-effect
      setError(t("viewAsNoToken"));
      return;
    }
    startImpersonation(token)
      .then(() => navigate("/", { replace: true }))
      .catch(() => setError(t("viewAsExpired")));
  }, [navigate, t]);

  return (
    <AuthCard title={title}>
      {error ? <div className="alert alert-danger mb-0">{error}</div> : <p className="text-center mb-0">{t("viewAsOpening")}</p>}
    </AuthCard>
  );
}
