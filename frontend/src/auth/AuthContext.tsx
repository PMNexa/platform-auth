import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { login as loginRequest, setup as setupRequest, signup as signupRequest } from "../lib/api/auth";
import type { Session, UserSummary } from "../lib/api/auth";
import { clearAccessToken, getAccessToken, setAccessToken as setStoredAccessToken, subscribe } from "../lib/auth/tokenStore";

interface AuthContextValue {
  accessToken: string | null;
  user: UserSummary | null;
  login: (email: string, password: string) => Promise<Session>;
  signup: (name: string, email: string, password: string) => Promise<Session>;
  /** First-run onboarding - creates the first account as the admin. */
  setup: (name: string, email: string, password: string) => Promise<Session>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => getAccessToken());
  const [user, setUser] = useState<UserSummary | null>(null);

  useEffect(() => subscribe(() => setAccessToken(getAccessToken())), []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await loginRequest(email, password);
    setStoredAccessToken(response.access_token);
    setUser(response.user);
    return { accessToken: response.access_token, user: response.user };
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const response = await signupRequest(name, email, password);
    setStoredAccessToken(response.access_token);
    setUser(response.user);
    return { accessToken: response.access_token, user: response.user };
  }, []);

  const setup = useCallback(async (name: string, email: string, password: string) => {
    const response = await setupRequest(name, email, password);
    setStoredAccessToken(response.access_token);
    setUser(response.user);
    return { accessToken: response.access_token, user: response.user };
  }, []);

  const logout = useCallback(() => {
    clearAccessToken();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ accessToken, user, login, signup, setup, logout }),
    [accessToken, user, login, signup, setup, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
