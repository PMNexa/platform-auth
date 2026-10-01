import { useState } from "react";
import { CrudDetailScreen, useResourcePath, type LinkComponentProps } from "platform-core";
import { Link as RouterLink, useLocation, useNavigate, useOutletContext, useParams } from "react-router";
import UserAdminPanel from "../screens/UserAdminPanel";

// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "User" }];
}

function CrudLink({ to, className, children, ...rest }: LinkComponentProps) {
  return (
    <RouterLink to={`/${to}`} className={className} {...rest}>
      {children}
    </RouterLink>
  );
}

/** A user's page (`createRbacRoutes`' `detailFile`): the generic detail (name, role assignments), then the admin's account actions. */
export default function UserDetailRoute() {
  const accessToken = useOutletContext<string>();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const resourcePath = useResourcePath();
  const basePath = pathname.split("/").filter(Boolean).slice(0, -1).join("/");
  const [version, setVersion] = useState(0);
  return (
    <div key={id}>
      <CrudDetailScreen
        key={version}
        baseUrl="/api/v1/users"
        accessToken={accessToken}
        id={id}
        basePath={basePath}
        linkComponent={CrudLink}
        resourcePath={resourcePath}
        onDeleted={() => navigate(`/${basePath}`)}
      />
      <UserAdminPanel
        accessToken={accessToken}
        userId={id}
        onChanged={() => setVersion((v) => v + 1)}
        onDeleted={() => navigate(`/${basePath}`)}
      />
    </div>
  );
}
