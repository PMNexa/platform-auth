import { useMemo, useState, type FormEvent } from "react";
import { Button, Card, CardBody, CopyButton } from "platform-core";
import { usersApi } from "../lib/api/admin";
import { ApiError } from "../lib/api/client";

/**
 * "Invite user" above the users list: creates the account and emails a
 * link to set its password (3 days). The link is shown too, for an
 * instance without email. `onInvited` lets the host refresh the list.
 */
export default function InviteUserCard({ accessToken, onInvited }: { accessToken: string; onInvited?: () => void }) {
  const api = useMemo(() => usersApi(accessToken), [accessToken]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await api.invite(name.trim(), email.trim());
      setLink({ email: user.email, url: user.set_password_url });
      setName("");
      setEmail("");
      onInvited?.();
    } catch (thrown) {
      setError(thrown instanceof ApiError ? thrown.message : String(thrown));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-3">
      <CardBody>
        {!open ? (
          <Button variant="primary" onClick={() => setOpen(true)}>
            Invite user
          </Button>
        ) : (
          <form className="row g-2 align-items-end" onSubmit={submit}>
            <div className="col-12 col-md-4">
              <label className="form-label" htmlFor="invite-name">Name</label>
              <input id="invite-name" className="form-control" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="col-12 col-md-5">
              <label className="form-label" htmlFor="invite-email">Email</label>
              <input id="invite-email" type="email" className="form-control" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="col-12 col-md-3 d-flex gap-2">
              <Button type="submit" variant="primary" disabled={busy || !name.trim() || !email.trim()}>
                Send invitation
              </Button>
              <Button variant="secondary" outline onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </form>
        )}
        {error && <div className="alert alert-danger mt-3 mb-0" role="alert">{error}</div>}
        {link && (
          <div className="mt-3">
            <div className="small text-secondary mb-1">
              Invited {link.email} - we emailed them this link to set a password (valid 3 days):
            </div>
            <div className="input-group">
              <input className="form-control form-control-sm font-monospace" readOnly value={link.url} aria-label="Set-password link" />
              <CopyButton text={link.url} />
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
