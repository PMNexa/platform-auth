import { useState, type FormEvent } from "react";
import { Button, Card, CardBody, CardHeader, CardTitle, FormCheck, FormControl, FormLabel, LanguageSelect, useT, type Locale } from "platform-core";
import { changeMyPassword, deleteMyAccount, exportMyData } from "../lib/api/auth";
import messages from "./MyAccountScreen.messages";
import { ApiError } from "../lib/api/client";
import { useAuthConfig } from "../auth/useAuthConfig";
import { clearSession, getSession, setSession, setUserLanguage } from "../session";

/**
 * The signed-in user's own account page: pick the UI language (saved on
 * the account), download everything the
 * instance holds about them (JSON), change their password, and delete
 * their account with all they own. `accessToken` is the host's session token.
 */
export default function MyAccountScreen({ accessToken, onDeleted }: { accessToken: string; onDeleted?: () => void }) {
  const t = useT(messages);
  const user = getSession()?.user;
  const [languageError, setLanguageError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const minLength = useAuthConfig()?.password_min_length ?? 8;

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordChanged(false);
    if (newPassword.length < minLength) return setPasswordError(t("tooShort", { n: minLength }));
    if (newPassword !== repeatPassword) return setPasswordError(t("mismatch"));
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
      // A refused password comes back per field (`new_password`).
      const fields = thrown instanceof ApiError ? (thrown.body as { field_errors?: Record<string, string[]> | null } | undefined)?.field_errors : null;
      setPasswordError(fields ? Object.values(fields).flat().join(" ") : thrown instanceof ApiError ? thrown.message : String(thrown));
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

  async function saveLanguage(language: Locale) {
    setLanguageError(null);
    try {
      await setUserLanguage(language);
    } catch (thrown) {
      setLanguageError(t("languageSaveFailed", { error: thrown instanceof ApiError ? thrown.message : String(thrown) }));
    }
  }

  return (
    <div className="row g-3">
      <div className="col-12">
        <Card>
          <CardHeader>
            <CardTitle>{t("languageTitle")}</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-secondary">{t("languageHint")}</p>
            <LanguageSelect id="account-language" className="form-select w-auto" onChange={(language) => void saveLanguage(language)} />
            {languageError && <div className="alert alert-danger mt-3" role="alert">{languageError}</div>}
          </CardBody>
        </Card>
      </div>
      <div className="col-12">
        <Card>
          <CardHeader>
            <CardTitle>{t("dataTitle")}</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-secondary">
              {user ? `${user.name} · ${user.email}. ` : ""}
              {t("dataIntro")}
            </p>
            <Button variant="primary" disabled={busy} onClick={() => void download()}>
              {t("download")}
            </Button>
          </CardBody>
        </Card>
      </div>
      <div className="col-12">
        <Card>
          <CardHeader>
            <CardTitle>{t("passwordTitle")}</CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={changePassword}>
              <p className="text-secondary">{t("passwordIntro")}</p>
              <FormLabel htmlFor="current-password">{t("currentPassword")}</FormLabel>
              <FormControl
                id="current-password"
                type="password"
                autoComplete="current-password"
                className="mb-2"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
              <FormLabel htmlFor="new-password">{t("newPassword")}</FormLabel>
              <FormControl
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <small className="form-hint mb-2">{t("minLength", { n: minLength })}</small>
              <FormLabel htmlFor="repeat-password">{t("repeatPassword")}</FormLabel>
              <FormControl
                id="repeat-password"
                type="password"
                autoComplete="new-password"
                className="mb-3"
                value={repeatPassword}
                onChange={(event) => setRepeatPassword(event.target.value)}
              />
              {passwordError && <div className="alert alert-danger" role="alert">{passwordError}</div>}
              {passwordChanged && <div className="alert alert-success" role="status">{t("passwordChanged")}</div>}
              <Button type="submit" variant="primary" disabled={busy || !currentPassword || !newPassword || !repeatPassword}>
                {t("passwordTitle")}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
      <div className="col-12">
        <Card className="border-danger">
          <CardHeader>
            <CardTitle>{t("deleteTitle")}</CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={remove}>
              <p className="text-secondary">
                {t("deleteIntro")}
              </p>
              <FormLabel htmlFor="delete-password">{t("yourPassword")}</FormLabel>
              <FormControl
                id="delete-password"
                type="password"
                autoComplete="current-password"
                className="mb-2"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <FormCheck
                label={t("understand")}
                checked={confirm}
                onChange={(event) => setConfirm(event.target.checked)}
              />
              <Button type="submit" variant="danger" disabled={busy || !confirm || !password}>
                {t("deleteTitle")}
              </Button>
            </form>
          </CardBody>
        </Card>
        {error && <div className="alert alert-danger mt-3" role="alert">{error}</div>}
      </div>
    </div>
  );
}
