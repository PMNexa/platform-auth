import { apiRequest } from "./client";

/**
 * The admin's account actions on `/api/v1/users` (platform-auth's
 * `UserViewSet`). The token is passed in (the host's session), not read
 * from this package's store - same as the CRUD screens.
 */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  email_verified_at: string | null;
  last_login_at: string | null;
  /** Set while the account is locked after too many wrong passwords. */
  locked_until: string | null;
  created_at: string;
}

export interface UserSessions {
  logins: { id: string; started_at: string; expires_at: string; ip: string; user_agent: string }[];
  other: {
    kind: string;
    label: string;
    items: { id: string; label: string; created_at: string; last_used_at: string | null; expires_at: string | null }[];
  }[];
}

export function usersApi(accessToken: string) {
  const auth = { headers: { Authorization: `Bearer ${accessToken}` }, skipAuthRedirect: true };
  const post = <T,>(path: string, data?: unknown) => apiRequest<T>(path, { ...auth, method: "POST", data });
  return {
    get: (id: string) => apiRequest<AdminUser>(`/api/v1/users/${id}`, auth),
    list: () => apiRequest<{ items: AdminUser[] }>("/api/v1/users?page_size=100&sort=name", auth).then((r) => r.items),
    invite: (name: string, email: string) =>
      post<AdminUser & { set_password_url: string }>("/api/v1/users/invite", { name, email }),
    disable: (id: string) => post<AdminUser>(`/api/v1/users/${id}/disable`),
    enable: (id: string) => post<AdminUser>(`/api/v1/users/${id}/enable`),
    unlock: (id: string) => post<AdminUser>(`/api/v1/users/${id}/unlock`),
    resetLink: (id: string) => post<{ url: string; expires_in_hours: number }>(`/api/v1/users/${id}/reset-link`),
    sessions: (id: string) => apiRequest<UserSessions>(`/api/v1/users/${id}/sessions`, auth),
    revokeSessions: (id: string) => post<{ revoked: number }>(`/api/v1/users/${id}/revoke-sessions`),
    impersonate: (id: string) => post<{ access_token: string; expires_in: number }>(`/api/v1/users/${id}/impersonate`),
    exportData: (id: string) => apiRequest<Blob>(`/api/v1/users/${id}/export`, { ...auth, responseType: "blob" }),
    remove: (id: string, transferTo: string | null) =>
      apiRequest<void>(`/api/v1/users/${id}${transferTo ? `?transfer_to=${transferTo}` : ""}`, { ...auth, method: "DELETE" }),
  };
}
