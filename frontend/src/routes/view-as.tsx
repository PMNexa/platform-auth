import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { startImpersonation } from "../session";
import AuthCard from "../pages/AuthCard";
import { useAuthScreenConfig } from "../screens/AuthScreenConfig";

// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "View as user" }];
}

/**
 * Where an admin's "View as" opens (`#<token>` - the fragment never
 * reaches a server or a log): starts the read-only view in this tab, then
 * goes to the app.
 */
export default function ViewAsRoute() {
  const navigate = useNavigate();
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
      setError("This link has no token - open it from the user's page.");
      return;
    }
    startImpersonation(token)
      .then(() => navigate("/", { replace: true }))
      .catch(() => setError("This view has expired - start it again from the user's page."));
  }, [navigate]);

  return (
    <AuthCard title={title}>
      {error ? <div className="alert alert-danger mb-0">{error}</div> : <p className="text-center mb-0">Opening the read-only view…</p>}
    </AuthCard>
  );
}
