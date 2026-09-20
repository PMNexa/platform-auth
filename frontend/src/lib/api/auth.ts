import { apiFetch } from "./client";

export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserSummary;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    credentials: "include",
    skipAuthRedirect: true,
    body: JSON.stringify({ email, password }),
  });
}

export async function me(): Promise<UserSummary> {
  return apiFetch<UserSummary>("/api/v1/auth/me");
}
