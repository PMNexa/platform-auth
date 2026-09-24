import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { setupStatus } from "../lib/api/auth";

/**
 * First-run onboarding gate for the auth pages: until the first account
 * exists, login/signup send the user to the sibling `setup` page (which
 * creates it as the admin); once it exists, `setup` sends them to
 * `login`. `?next=` is carried over. Returns whether the page may render
 * - `false` while the status is loading or a redirect is under way, so
 * the wrong form never flashes. A failed status check shows the page.
 */
export function useSetupGate(page: "setup" | "login" | "signup"): boolean {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setupStatus()
      .then(({ required }) => {
        if (cancelled) return;
        const target = required && page !== "setup" ? "setup" : !required && page === "setup" ? "login" : null;
        if (target) navigate({ pathname: `../${target}`, search }, { relative: "path", replace: true });
        else setReady(true);
      })
      .catch(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [navigate, page, search]);

  return ready;
}
