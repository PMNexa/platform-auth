import { useState, type FormEvent } from "react";
import { Button, Card, CardBody, CardHeader, CardTitle } from "platform-core";
import { deleteMyAccount, exportMyData } from "../lib/api/auth";
import { ApiError } from "../lib/api/client";
import { clearSession, getSession } from "../session";

/**
 * The signed-in user's own account page: download everything the
 * instance holds about them (JSON), and delete their account with all
 * they own. `accessToken` is the host's session token.
 */
export default function MyAccountScreen({ accessToken, onDeleted }: { accessToken: string; onDeleted?: () => void }) {
  const user = getSession()?.user;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <div className="col-12 col-lg-8">
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
      <div className="col-12 col-lg-8">
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
