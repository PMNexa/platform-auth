import type { NavEntry } from "platform-core";

/** Tabler Icons "shield-lock" (outline, MIT) - inlined, no icon font. */
function AccessIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="icon"
      aria-hidden="true"
    >
      <path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" />
      <path d="M12 11m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M12 12l0 2.5" />
    </svg>
  );
}

/**
 * RBAC's sidebar entries - an "Access control" group (Users, Roles) for
 * the host's AppShell. Pass the SAME `basePath` as
 * `createRbacRoutes(basePath)` so the links point where the pages are
 * mounted. Each link carries the `permission` it needs; run the host's
 * list through `filterNavByPermissions` and the group disappears for a
 * user who can open neither.
 */
export function createRbacNavItems(basePath: string): NavEntry[] {
  const prefix = basePath.replace(/^\/+|\/+$/g, "");
  const path = (resource: string) => `/${prefix ? `${prefix}/` : ""}${resource}`;
  return [
    {
      label: "Access control",
      icon: <AccessIcon />,
      children: [
        { label: "Users", to: path("users"), permission: "users.view" },
        { label: "Roles", to: path("roles"), permission: "roles.view" },
      ],
    },
  ];
}
