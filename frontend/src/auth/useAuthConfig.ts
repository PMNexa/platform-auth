import { useEffect, useState } from "react";
import { authConfig, type AuthConfig } from "../lib/api/auth";

/** What the auth pages show before the server has answered: the plain email + password form. */
export const DEFAULT_AUTH_CONFIG: AuthConfig = { password_login: true, password_min_length: 8, sso: [] };

/**
 * The instance's public auth settings (`GET auth/config`) - single
 * sign-on, whether password login is on, the minimum password length.
 * `null` while loading; the defaults if the request fails.
 */
export function useAuthConfig(): AuthConfig | null {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  useEffect(() => {
    let cancelled = false;
    authConfig()
      .then((value) => !cancelled && setConfig(value))
      .catch(() => !cancelled && setConfig(DEFAULT_AUTH_CONFIG));
    return () => {
      cancelled = true;
    };
  }, []);
  return config;
}
