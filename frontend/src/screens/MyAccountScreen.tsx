import { useState, type FormEvent } from "react";
import { Button, Card, CardBody, CardHeader, CardTitle } from "platform-core";
import { changeMyPassword, deleteMyAccount, exportMyData } from "../lib/api/auth";
import { ApiError } from "../lib/api/client";
import { clearSession, getSession, setSession } from "../session";

/**
 * The signed-in user's own account page: download everything the
 * instance holds about them (JSON), change their password, and delete
 * their account with all they own. `accessToken` is the host's session token.
 */
export default function MyAccountScreen({ accessToken, onDeleted }: { accessToken: string; onDeleted?: () => void }) {
  const user = getSession()?.user;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordChanged, setPasswordChanged] = useState(false);

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordChanged(false);
    if (newPassword.length < 8) return setPasswordError("The new password must be at least 8 characters.");
    if (newPassword !== repeatPassword) return setPasswordError("The new passwords don't match.");
    setBusy(true);
    setPasswordError(null);
    try {
      const response = await changeMyPassword(accessToken, currentPassword, newPassword);
      setSession({ accessToken: response.access_token, user: response.user });
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");
      setPasswordChanged(true);
    } catch (thrown) {
      setPasswordError(thrown instanceof ApiError ? thrown.message : String(thrown));
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const blob = await exportMyData(accessToken);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `goalnexa-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (thrown) {
      setError(thrown instanceof ApiError ? thrown.message : String(thrown));
    } finally {
      setBusy(false);
    }
  }

  async function remove(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await deleteMyAccount(accessToken, password);
      clearSession();
      onDeleted?.();
    } catch (thrown) {
      setError(thrown instanceof ApiError ? thrown.message : String(thrown));
      setBusy(false);
    }
  }

  return (
    <div className="row g-3">
      <div className="col-12">
        <Card>
          <CardHeader>
            <CardTitle>Your data</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-secondary">
              {user ? `${user.name} · ${user.email}. ` : ""}Download everything this instance holds about you - your
              goals with their metrics and check-ins, cycles, comments, organizations, sign-ins and AI access - as a JSON
              file.
            </p>
            <Button variant="primary" disabled={busy} onClick={() => void download()}>
              Download my data
            </Button>
          </CardBody>
        </Card>
      </div>
      <div className="col-12">
        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={changePassword}>
              <p className="text-secondary">Changing your password logs you out everywhere else.</p>
              <label className="form-label" htmlFor="current-password">Current password</label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                className="form-control mb-2"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
              <label className="form-label" htmlFor="new-password">New password</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                className="form-control"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <small className="form-hint mb-2">At least 8 characters.</small>
              <label className="form-label" htmlFor="repeat-password">Repeat new password</label>
              <input
                id="repeat-password"
                type="password"
                autoComplete="new-password"
                className="form-control mb-3"
                value={repeatPassword}
                onChange={(event) => setRepeatPassword(event.target.value)}
              />
              {passwordError && <div className="alert alert-danger" role="alert">{passwordError}</div>}
              {passwordChanged && <div className="alert alert-success" role="status">Password changed.</div>}
              <Button type="submit" variant="primary" disabled={busy || !currentPassword || !newPassword || !repeatPassword}>
                Change password
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
      <div className="col-12">
        <Card className="border-danger">
          <CardHeader>
            <CardTitle>Delete my account</CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={remove}>
              <p className="text-secondary">
                Deletes your account, your goals and personal cycles, and your comments. Organizations you're the only
                member of are deleted; in others, the longest-standing admin becomes owner.
              </p>
              <label className="form-label" htmlFor="delete-password">Your password</label>
              <input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                className="form-control mb-2"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <label className="form-check">
                <input className="form-check-input" type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
                <span className="form-check-label">I understand this can't be undone.</span>
              </label>
              <Button type="submit" variant="danger" disabled={busy || !confirm || !password}>
                Delete my account
              </Button>
            </form>
          </CardBody>
        </Card>
        {error && <div className="alert alert-danger mt-3" role="alert">{error}</div>}
      </div>
    </div>
  );
}
