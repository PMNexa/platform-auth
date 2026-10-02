import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import AuthCard from "../pages/AuthCard";
import { useAuthScreenConfig } from "../screens/AuthScreenConfig";
import { refreshSession, setSession } from "../session";
import { nextPath, siblingPath } from "./redirect";

// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Signing in" }];
}

/**
 * Where single sign-on lands after the provider: the backend's callback
 * already set the refresh cookie, so this trades it for a session - the
 * same exchange a page reload does - and goes to `?next=`.
 */
export default function SsoRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();
  const { title } = useAuthScreenConfig();
  const [failed, setFailed] = useState(false);
  // StrictMode runs effects twice in dev - `refreshSession` shares one request, navigate once.
  const done = useRef(false);

  useEffect(() => {
    refreshSession()
      .then((session) => {
        if (done.current) return;
        done.current = true;
        setSession(session);
        navigate(nextPath(search), { replace: true });
      })
      .catch(() => setFailed(true));
  }, [navigate, search]);

  return (
    <AuthCard title={title} footer={failed ? <Link to={siblingPath(location, "login")}>Back to log in</Link> : undefined}>
      {failed ? (
        <div className="alert alert-danger mb-0" role="alert">Signing in didn't finish. Try again.</div>
      ) : (
        <p className="text-center mb-0">Signing you in…</p>
      )}
    </AuthCard>
  );
}
