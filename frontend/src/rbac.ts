import { useEffect, useState } from "react";
import { createCrudRoutes, isNavGroup, prefixRoutes, type NavEntry, type NavItem, type RouteEntry } from "platform-core";
import { apiRequest } from "./lib/api/client";
import { getSession, subscribeSession } from "./session";

/**
 * RBAC's screens: users, roles, role assignments, permissions - all
 * platform-core's generic CRUD (schema-driven list/detail/edit, the
 * role's permissions as a many-to-many tab, a user's role assignments as
 * a one-to-many tab), nested under the host's `basePath`
 * (`createRbacRoutes("platform-auth")` -> `/platform-auth/roles`, ...).
 * Browser-safe route config, same as `createAuthRoutes`.
 */
export function createRbacRoutes(basePath: string): RouteEntry[] {
  return prefixRoutes(basePath, [
    ...createCrudRoutes("/api/v1/users"),
    ...createCrudRoutes("/api/v1/roles"),
    ...createCrudRoutes("/api/v1/role-assignments"),
    ...createCrudRoutes("/api/v1/permissions"),
  ]);
}

/** The signed-in user's app-wide permission codenames (`GET /me`); `["*"]` = everything. */
export async function fetchMyPermissions(): Promise<string[]> {
  // The session's token, explicitly: after a reload the session is
  // restored by `initSession` before `apiRequest`'s own token store is.
  // No auth redirect either - that's the host's job, not a permission
  // lookup's.
  const accessToken = getSession()?.accessToken;
  const me = await apiRequest<{ permissions?: string[] }>("/api/v1/auth/me", {
    skipAuthRedirect: true,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  return me.permissions ?? [];
}

/** Whether `permissions` (from `fetchMyPermissions`/`useMyPermissions`) include `codename`. */
export function hasPermission(permissions: string[] | null | undefined, codename: string): boolean {
  return Boolean(permissions && (permissions.includes("*") || permissions.includes(codename)));
}

/**
 * The signed-in user's app-wide permissions, refetched when the user
 * changes (not on every token refresh); `null` until known. For hiding
 * UI a user can't use - the API enforces regardless.
 */
export function useMyPermissions(): string[] | null {
  const [userId, setUserId] = useState(() => getSession()?.user.id ?? null);
  const [permissions, setPermissions] = useState<string[] | null>(null);

  useEffect(() => subscribeSession(() => setUserId(getSession()?.user.id ?? null)), []);

  useEffect(() => {
    let cancelled = false;
    // oxlint-disable-next-line react/set-state-in-effect
    setPermissions(null);
    if (!userId) return;
    fetchMyPermissions()
      .then((result) => {
        if (!cancelled) setPermissions(result);
      })
      .catch(() => {
        if (!cancelled) setPermissions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return permissions;
}

/**
 * `entries` (a host's sidebar - links and `children` groups, e.g. from
 * each module's `create*NavItems`) minus the links whose `permission` the
 * user lacks; a group left empty is dropped. `null` permissions (still
 * loading) hide every permission-gated link.
 */
export function filterNavByPermissions(entries: NavEntry[], permissions: string[] | null): NavEntry[] {
  const allowed = (item: NavItem) => !item.permission || hasPermission(permissions, item.permission);
  return entries.flatMap((entry): NavEntry[] => {
    if (!isNavGroup(entry)) return allowed(entry) ? [entry] : [];
    const children = entry.children.filter(allowed);
    return children.length ? [{ ...entry, children }] : [];
  });
}
