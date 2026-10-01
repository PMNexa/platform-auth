import { useState } from "react";
import { CrudListScreen, type LinkComponentProps } from "platform-core";
import { Link as RouterLink, useLocation, useOutletContext } from "react-router";
import InviteUserCard from "../screens/InviteUserCard";

// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Users" }];
}

function CrudLink({ to, className, children, ...rest }: LinkComponentProps) {
  return (
    <RouterLink to={`/${to}`} className={className} {...rest}>
      {children}
    </RouterLink>
  );
}

/** The users list (`createRbacRoutes`' `listFile`): "Invite user" above platform-core's generic list. */
export default function UserListRoute() {
  const accessToken = useOutletContext<string>();
  const { pathname } = useLocation();
  const basePath = pathname.split("/").filter(Boolean).join("/");
  // Bumped after an invitation, so the list shows the new account.
  const [version, setVersion] = useState(0);
  return (
    <>
      <InviteUserCard accessToken={accessToken} onInvited={() => setVersion((v) => v + 1)} />
      <CrudListScreen
        key={version}
        baseUrl="/api/v1/users"
        basePath={basePath}
        accessToken={accessToken}
        linkComponent={CrudLink}
      />
    </>
  );
}
