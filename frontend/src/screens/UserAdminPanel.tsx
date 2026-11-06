import { useEffect, useMemo, useState } from "react";
import { Button, Card, CardBody, CardHeader, CardTitle, CopyButton, formatDateTime, useT, type Locale, type Translate } from "platform-core";
import messages from "./UserAdminPanel.messages";
import { usersApi, type AdminUser, type UserSessions } from "../lib/api/admin";
import { ApiError } from "../lib/api/client";

export interface UserAdminPanelProps {
  accessToken: string;
  userId: string;
  /** Fires after a change the detail view above should show (status). */
  onChanged?: () => void;
  /** Fires after the account was deleted - the host navigates away. */
  onDeleted?: () => void;
  /** Where `createAuthRoutes` mounted "view as". @default "/auth/view-as" */
  viewAsPath?: string;
}

function when(iso: string | null, locale: Locale): string {
  return iso ? formatDateTime(iso, { dateStyle: "medium", timeStyle: "short" }, locale) : "—";
}

function browser(userAgent: string, t: Translate<(typeof messages)["en"]>): string {
  if (!userAgent) return t("unknownDevice");
  const name = /Edg\//.test(userAgent) ? "Edge" : /Chrome\//.test(userAgent) ? "Chrome" : /Firefox\//.test(userAgent)
    ? "Firefox" : /Safari\//.test(userAgent) ? "Safari" : /curl|python|axios|node/i.test(userAgent) ? t("script") : t("browser");
  const os = /Mac OS X/.test(userAgent) ? "macOS" : /Windows/.test(userAgent) ? "Windows" : /Android/.test(userAgent)
    ? "Android" : /iPhone|iPad/.test(userAgent) ? "iOS" : /Linux/.test(userAgent) ? "Linux" : "";
  return os ? t("browserOn", { browser: name, os }) : name;
}

function message(thrown: unknown): string {
  if (thrown instanceof ApiError) {
    const fields = (thrown.body as { field_errors?: Record<string, string[]> } | undefined)?.field_errors;
    if (fields) return Object.values(fields).flat().join(" ");
    return thrown.message;
  }
  return thrown instanceof Error ? thrown.message : String(thrown);
}

/**
 * An admin's actions on one account, under the user's page: status
 * (active / disabled / locked, email confirmed, last login), disable / enable, unlock, a
 * password link to hand over, every place they're signed in (logins, MCP
 * tokens, connected AI apps) with "sign out everywhere", and deleting the
 * account - handing what they own to another user, or erasing it. The
 * backend guards yourself and the last admin, and audits each action.
 */
function UserAdminPanel({ accessToken, userId, onChanged, onDeleted, viewAsPath = "/auth/view-as" }: UserAdminPanelProps) {
  const t = useT(messages);
  const at = (iso: string | null) => when(iso, t.locale);
  const api = useMemo(() => usersApi(accessToken), [accessToken]);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [sessions, setSessions] = useState<UserSessions | null>(null);
  const [others, setOthers] = useState<AdminUser[]>([]);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [transferTo, setTransferTo] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Read once: a lock that runs out while the page is open shows after the next action.
  const [openedAt] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.get(userId), api.sessions(userId), api.list()])
      .then(([row, userSessions, everyone]) => {
        if (cancelled) return;
        setUser(row);
        setSessions(userSessions);
        setOthers(everyone.filter((u) => u.id !== userId && u.is_active));
      })
      .catch((thrown: unknown) => !cancelled && setError(message(thrown)));
    return () => {
      cancelled = true;
    };
  }, [api, userId, version]);

  async function run(action: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      if (done) setNotice(done);
      setVersion((v) => v + 1);
      onChanged?.();
    } catch (thrown) {
      setError(message(thrown));
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <Card className="mt-3">
        <CardBody>{error ? <div className="text-danger">{error}</div> : <div className="text-secondary">{t("loading")}</div>}</CardBody>
      </Card>
    );
  }

  const locked = user.locked_until !== null && new Date(user.locked_until).getTime() > openedAt;
  const otherCount = sessions?.other.reduce((sum, group) => sum + group.items.length, 0) ?? 0;

  return (
    <div className="d-flex flex-column gap-3 mt-3">
      <Card>
        <CardHeader>
          <CardTitle>{t("account")}</CardTitle>
          <span className={`badge ms-2 ${user.is_active ? "bg-green-lt" : "bg-red-lt"}`}>
            {user.is_active ? t("active") : t("disabled")}
          </span>
          {!user.email_verified_at && <span className="badge bg-yellow-lt ms-2">{t("emailNotConfirmed")}</span>}
          {locked && (
            <span className="badge bg-orange-lt ms-2" title={t("lockedTitle")}>
              {t("lockedUntil", { when: at(user.locked_until) })}
            </span>
          )}
        </CardHeader>
        <CardBody>
          <div className="row mb-3">
            <div className="col-6 col-md-4">
              <div className="text-secondary small">{t("lastLogin")}</div>
              {at(user.last_login_at)}
            </div>
            <div className="col-6 col-md-4">
              <div className="text-secondary small">{t("emailConfirmed")}</div>
              {at(user.email_verified_at)}
            </div>
            <div className="col-6 col-md-4">
              <div className="text-secondary small">{t("joined")}</div>
              {at(user.created_at)}
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2">
            {user.is_active ? (
              <Button variant="warning" outline disabled={busy} onClick={() => void run(() => api.disable(userId), t("disableDone"))}>
                {t("disable")}
              </Button>
            ) : (
              <Button variant="success" outline disabled={busy} onClick={() => void run(() => api.enable(userId), t("enableDone"))}>
                {t("enable")}
              </Button>
            )}
            {locked && (
              <Button variant="warning" outline disabled={busy} onClick={() => void run(() => api.unlock(userId), t("unlockDone"))}>
                {t("unlock")}
              </Button>
            )}
            <Button
              variant="secondary"
              outline
              disabled={busy || !user.is_active}
              onClick={() => void run(async () => setResetUrl((await api.resetLink(userId)).url))}
            >
              {t("passwordLink")}
            </Button>
            <Button
              variant="secondary"
              outline
              disabled={busy || !user.is_active}
              title={t("viewAsTitle")}
              onClick={() =>
                void run(async () => {
                  // Opened first (a popup blocker allows it during the click), filled in once the token is back.
                  const tab = window.open("", "_blank");
                  const { access_token } = await api.impersonate(userId);
                  const url = `${viewAsPath}#${access_token}`;
                  if (tab) tab.location.href = url;
                  else window.location.href = url;
                })
              }
            >
              {t("viewAs", { name: user.name.split(" ")[0] })}
            </Button>
            <Button
              variant="secondary"
              outline
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const blob = await api.exportData(userId);
                  const link = document.createElement("a");
                  link.href = URL.createObjectURL(blob);
                  link.download = `goalnexa-${user.email}.json`;
                  link.click();
                  URL.revokeObjectURL(link.href);
                })
              }
            >
              {t("exportData")}
            </Button>
          </div>
          {resetUrl && (
            <div className="mt-3">
              <div className="small text-secondary mb-1">{t("resetLinkHint", { name: user.name })}</div>
              <div className="input-group">
                <input className="form-control form-control-sm font-monospace" readOnly value={resetUrl} aria-label={t("passwordLinkLabel")} />
                <CopyButton text={resetUrl} />
              </div>
            </div>
          )}
          {notice && <div className="alert alert-success mt-3 mb-0">{notice}</div>}
          {error && <div className="alert alert-danger mt-3 mb-0" role="alert">{error}</div>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("signedInTitle")}</CardTitle>
          <div className="ms-auto">
            <Button
              variant="danger"
              outline
              disabled={busy || ((sessions?.logins.length ?? 0) === 0 && otherCount === 0)}
              onClick={() => void run(() => api.revokeSessions(userId), t("signOutDone"))}
            >
              {t("signOutEverywhere")}
            </Button>
          </div>
        </CardHeader>
        <div className="table-responsive">
          <table className="table table-vcenter card-table">
            <thead>
              <tr>
                <th>{t("session")}</th>
                <th>{t("started")}</th>
                <th>{t("from")}</th>
              </tr>
            </thead>
            <tbody>
              {sessions?.logins.map((login) => (
                <tr key={login.id}>
                  <td>{login.client === "native" ? (login.device_name ? t("appOn", { device: login.device_name }) : t("app")) : browser(login.user_agent, t)}</td>
                  <td>{at(login.started_at)}</td>
                  <td className="text-secondary">{login.ip || "—"}</td>
                </tr>
              ))}
              {sessions?.other.flatMap((group) =>
                group.items.map((item) => (
                  <tr key={`${group.kind}-${item.id}`}>
                    <td>
                      {item.label} <span className="badge bg-secondary-lt ms-1">{group.label}</span>
                    </td>
                    <td>{at(item.created_at)}</td>
                    <td className="text-secondary">{t("lastUsed", { when: at(item.last_used_at) })}</td>
                  </tr>
                )),
              )}
              {(sessions?.logins.length ?? 0) === 0 && otherCount === 0 && (
                <tr>
                  <td colSpan={3} className="text-secondary">{t("notSignedIn")}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="border-danger">
        <CardHeader>
          <CardTitle>{t("deleteTitle")}</CardTitle>
        </CardHeader>
        <CardBody>
          <label className="form-label" htmlFor="delete-transfer">{t("transferLabel")}</label>
          <select id="delete-transfer" className="form-select mb-2" value={transferTo} onChange={(event) => setTransferTo(event.target.value)}>
            <option value="">{t("deleteThemToo")}</option>
            {others.map((other) => (
              <option key={other.id} value={other.id}>
                {t("giveTo", { name: other.name, email: other.email })}
              </option>
            ))}
          </select>
          <small className="form-hint mb-3">
            {transferTo
              ? t("transferHint")
              : t("eraseHint")}
          </small>
          <label className="form-check">
            <input className="form-check-input" type="checkbox" checked={confirmDelete} onChange={(event) => setConfirmDelete(event.target.checked)} />
            <span className="form-check-label">{t("understand")}</span>
          </label>
          <Button
            variant="danger"
            disabled={busy || !confirmDelete}
            onClick={() =>
              void run(async () => {
                await api.remove(userId, transferTo || null);
                onDeleted?.();
              })
            }
          >
            {t("deleteUser", { name: user.name })}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}

export default UserAdminPanel;
