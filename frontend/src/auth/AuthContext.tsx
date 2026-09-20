import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { login as loginRequest } from "../lib/api/auth";
import type { UserSummary } from "../lib/api/auth";
import { clearAccessToken, getAccessToken, setAccessToken as setStoredAccessToken, subscribe } from "../lib/auth/tokenStore";

interface AuthContextValue {
  accessToken: string | null;
  user: UserSummary | null;
  login: (email: string, password: string) => Promise<void>;
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
  }, []);

  const logout = useCallback(() => {
    clearAccessToken();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ accessToken, user, login, logout }),
    [accessToken, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
