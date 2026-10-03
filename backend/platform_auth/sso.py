"""Single sign-on with OpenID Connect providers (Google, Authentik,
Keycloak, Entra ID, ...) - the authorization code flow with PKCE, the
server being the client. One provider or several, each with its own
button.

Configured by the host's settings, from the environment (the client
secret is a secret, so never a system setting). One provider:
`OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` (all three = on;
its id is "default"), and optionally `OIDC_SCOPES` (default "openid
email profile") and `OIDC_TRUST_EMAIL` (treat the provider's email as
verified when it sends no `email_verified` claim - Entra ID). More:
`OIDC_PROVIDERS`, a list of `{"id", "label", "issuer", "client_id",
"client_secret"}` plus optional `"scopes"`/`"trust_email"` (`providers()`
- a bad entry stops the app at startup, `check_config`). They all share
one redirect URI: `OIDC_REDIRECT_URI`, default the address the request
came in on + `/api/v1/auth/sso/callback` - which provider a sign-in is
with travels in the signed state cookie. Two system settings (apps.py):
`auth.sso_label` (the "default" provider's button: "Sign in with
<label>") and `auth.password_login` (off = SSO only; it only applies
while SSO is on, and its env variable `AUTH_PASSWORD_LOGIN` overrides
the saved value - the way back in if the provider breaks).

Who signs in (`resolve_user`): the account already linked to the
provider's `(issuer, sub)` (`SsoIdentity`); else the account with the
provider's email, which must be verified there - linked from then on;
else a new account, under the same signup policy as the signup form.
So every configured provider can sign in as any account whose email it
vouches for: only list providers you trust that far.

Network calls are the three module-level functions at the bottom
(`fetch_json`, `post_form`, `signing_key`) - tests replace them.
"""

import base64
import hashlib
import hmac
import json
import re
import secrets
import urllib.error
import urllib.parse
import urllib.request

from dataclasses import dataclass

import jwt
from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ImproperlyConfigured
from django.db import IntegrityError, transaction
from django.utils import timezone

from core_api.system import audit, get_setting
from platform_auth.models import UNUSABLE_PASSWORD, SsoIdentity, User

#: Asymmetric only - an `HS256`/`none` id token must never be accepted.
SIGNING_ALGORITHMS = ["RS256", "RS384", "RS512", "PS256", "ES256", "ES384", "EdDSA"]
DISCOVERY_TTL = 3600
TIMEOUT = 10
DEFAULT_SCOPES = "openid email profile"
#: The provider set with the plain `OIDC_ISSUER`/... settings.
DEFAULT_ID = "default"
_ID = re.compile(r"[a-z0-9][a-z0-9-]{0,31}")


@dataclass(frozen=True)
class Provider:
    id: str
    label: str
    issuer: str
    client_id: str
    client_secret: str
    scopes: str = DEFAULT_SCOPES
    trust_email: bool = False


class SsoError(Exception):
    """A sign-in that can't complete; `code` goes to the login page (`?sso_error=`)."""

    def __init__(self, code: str, detail: str = ""):
        self.code = code
        super().__init__(detail or code)


def _setting(name: str, default=""):
    return getattr(settings, name, default) or default


def _listed() -> list[Provider]:
    """`OIDC_PROVIDERS`, checked - a typo there must not quietly drop a way in."""
    entries = _setting("OIDC_PROVIDERS", [])
    if not isinstance(entries, (list, tuple)):
        raise ImproperlyConfigured("OIDC_PROVIDERS must be a list of providers.")
    found: list[Provider] = []
    for entry in entries:
        if not isinstance(entry, dict):
            raise ImproperlyConfigured("OIDC_PROVIDERS: each provider is an object.")
        provider_id = str(entry.get("id") or "")
        if not _ID.fullmatch(provider_id) or provider_id == DEFAULT_ID:
            raise ImproperlyConfigured(
                f'OIDC_PROVIDERS: "id" {provider_id!r} must be lowercase letters, digits and dashes, and not "{DEFAULT_ID}".'
            )
        if any(p.id == provider_id for p in found):
            raise ImproperlyConfigured(f'OIDC_PROVIDERS: two providers have the id "{provider_id}".')
        missing = [k for k in ("issuer", "client_id", "client_secret") if not isinstance(entry.get(k), str) or not entry[k]]
        if missing:
            raise ImproperlyConfigured(f'OIDC_PROVIDERS: "{provider_id}" is missing {", ".join(missing)}.')
        if not _is_http_url(entry["issuer"]):
            raise ImproperlyConfigured(f'OIDC_PROVIDERS: "{provider_id}" has an issuer that isn\'t a URL.')
        found.append(Provider(
            id=provider_id,
            label=str(entry.get("label") or provider_id).strip(),
            issuer=entry["issuer"].rstrip("/"),
            client_id=entry["client_id"],
            client_secret=entry["client_secret"],
            scopes=str(entry.get("scopes") or DEFAULT_SCOPES),
            trust_email=entry.get("trust_email") is True,
        ))
    return found


def check_config() -> None:
    """Raises `ImproperlyConfigured` on a bad `OIDC_PROVIDERS` (apps.py, at startup)."""
    _listed()


def _default_set() -> bool:
    return bool(_setting("OIDC_ISSUER") and _setting("OIDC_CLIENT_ID") and _setting("OIDC_CLIENT_SECRET"))


def providers() -> list[Provider]:
    """Every provider people can sign in with, in button order."""
    found: list[Provider] = []
    if _default_set():
        found.append(Provider(
            id=DEFAULT_ID,
            label=(get_setting("auth.sso_label") or "").strip() or "SSO",
            issuer=_setting("OIDC_ISSUER").rstrip("/"),
            client_id=_setting("OIDC_CLIENT_ID"),
            client_secret=_setting("OIDC_CLIENT_SECRET"),
            scopes=_setting("OIDC_SCOPES", DEFAULT_SCOPES),
            trust_email=bool(_setting("OIDC_TRUST_EMAIL", False)),
        ))
    return found + _listed()


def provider(provider_id: str | None) -> Provider | None:
    """The provider with that id; with no id, the first one."""
    found = providers()
    if not provider_id:
        return found[0] if found else None
    return next((p for p in found if p.id == provider_id), None)


#: Providers whose own logo the button shows (by the issuer's host); others get a neutral key icon.
BRAND_ICONS = {"accounts.google.com": "google", "login.microsoftonline.com": "microsoft"}


def icon(provider: Provider) -> str:
    """"google", "microsoft" or "" - which logo the login page's button shows."""
    return BRAND_ICONS.get(urllib.parse.urlsplit(provider.issuer).hostname or "", "")


def configured() -> bool:
    return _default_set() or bool(_listed())


def label() -> str:
    """For a sentence: "Google", "Google or Acme"."""
    return " or ".join(p.label for p in providers()) or "SSO"


def password_login_enabled() -> bool:
    """Email + password login - always on unless SSO can take its place."""
    return not configured() or bool(get_setting("auth.password_login"))


def discovery(provider: Provider) -> dict:
    issuer = provider.issuer
    key = "platform_auth.oidc." + hashlib.sha256(issuer.encode()).hexdigest()[:32]
    document = cache.get(key)
    if document is None:
        try:
            document = fetch_json(f"{issuer}/.well-known/openid-configuration")
        except (OSError, ValueError) as exc:
            raise SsoError("provider_unreachable", str(exc)) from exc
        if str(document.get("issuer", "")).rstrip("/") != issuer:
            raise SsoError("provider_misconfigured", "The provider's issuer doesn't match the configured one.")
        for name in ("authorization_endpoint", "token_endpoint", "jwks_uri"):
            if not _is_http_url(document.get(name)):
                raise SsoError("provider_misconfigured", f"The provider's {name} is missing.")
        cache.set(key, document, DISCOVERY_TTL)
    return document


def redirect_uri(request) -> str:
    return _setting("OIDC_REDIRECT_URI") or (
        request.build_absolute_uri("/").rstrip("/") + f"{settings.URL_PREFIX}/api/v1/auth/sso/callback"
    )


def begin(request, provider: Provider) -> tuple[str, dict]:
    """(the provider's URL to send the browser to, what the callback must get back - kept in a signed cookie)."""
    state, nonce, verifier = secrets.token_urlsafe(24), secrets.token_urlsafe(24), secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    endpoint = discovery(provider)["authorization_endpoint"]
    query = urllib.parse.urlencode({
        "response_type": "code",
        "client_id": provider.client_id,
        "redirect_uri": redirect_uri(request),
        "scope": provider.scopes,
        "state": state,
        "nonce": nonce,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    })
    pending = {"s": state, "n": nonce, "v": verifier, "p": provider.id}
    return f"{endpoint}{'&' if '?' in endpoint else '?'}{query}", pending


def complete(request, provider: Provider, code: str, pending: dict) -> dict:
    """Exchanges the callback's `code` and returns the verified claims (`sub`, `email`, `email_verified`, `name`)."""
    document = discovery(provider)
    form = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri(request),
        "code_verifier": pending["v"],
    }
    client_id, client_secret = provider.client_id, provider.client_secret
    methods = document.get("token_endpoint_auth_methods_supported") or ["client_secret_basic"]
    basic = None
    if "client_secret_basic" in methods:
        basic = (client_id, client_secret)
    else:
        form.update(client_id=client_id, client_secret=client_secret)
    try:
        tokens = post_form(document["token_endpoint"], form, basic=basic)
    except (OSError, ValueError) as exc:
        raise SsoError("exchange_failed", str(exc)) from exc
    id_token = tokens.get("id_token")
    if not id_token:
        raise SsoError("exchange_failed", "The provider returned no id_token.")

    offered = document.get("id_token_signing_alg_values_supported") or ["RS256"]
    try:
        claims = jwt.decode(
            id_token,
            signing_key(document["jwks_uri"], id_token),
            algorithms=[a for a in SIGNING_ALGORITHMS if a in offered] or ["RS256"],
            audience=client_id,
            issuer=document["issuer"],
            leeway=60,
            options={"require": ["exp", "iat", "sub"]},
        )
    except (jwt.PyJWTError, OSError, ValueError) as exc:
        raise SsoError("invalid_token", str(exc)) from exc
    if not hmac.compare_digest(str(claims.get("nonce", "")), pending["n"]):
        raise SsoError("invalid_token", "The id token's nonce doesn't match.")

    # Some providers only give the email at the userinfo endpoint.
    if not claims.get("email") and tokens.get("access_token") and _is_http_url(document.get("userinfo_endpoint")):
        try:
            info = fetch_json(document["userinfo_endpoint"], bearer=tokens["access_token"])
        except (OSError, ValueError):
            info = {}
        if info.get("sub") == claims["sub"]:
            claims = {**claims, **{k: info[k] for k in ("email", "email_verified", "name") if k in info}}
    return claims


def _email_verified(claims: dict, provider: Provider) -> bool:
    if "email_verified" not in claims:
        return provider.trust_email
    value = claims["email_verified"]
    return value is True or str(value).lower() == "true"


def resolve_user(claims: dict, request, provider: Provider) -> User:
    """The account these claims sign in as - linking or creating it the first time."""
    # Imported here: these modules import this one.
    from platform_auth.accounts import signup_refusal
    from platform_auth.views.setup import setup_required

    issuer, subject = provider.issuer, str(claims["sub"])
    email = str(claims.get("email") or "").strip().lower()
    identity = SsoIdentity.objects.select_related("user").filter(issuer=issuer, subject=subject).first()
    if identity is not None:
        user = identity.user
    else:
        if not email:
            raise SsoError("no_email")
        if not _email_verified(claims, provider):
            raise SsoError("email_unverified")
        user = User.objects.filter(email=email).first()
        if user is None:
            # The first account goes through setup, which makes it the admin.
            if setup_required():
                raise SsoError("setup_required")
            refusal = signup_refusal(email)
            if refusal:
                raise SsoError(refusal[0])
            name = str(claims.get("name") or "").strip() or email.split("@")[0]
            try:
                with transaction.atomic():
                    user = User.objects.create(
                        name=name[:255], email=email, password_hash=UNUSABLE_PASSWORD, email_verified_at=timezone.now()
                    )
                audit("auth.signup", request=request, actor=user, target=user, method="sso")
            except IntegrityError:
                user = User.objects.get(email=email)
        try:
            with transaction.atomic():
                identity = SsoIdentity.objects.create(user=user, issuer=issuer, subject=subject, email=email)
            audit("auth.sso_linked", request=request, actor=user, target=user, issuer=issuer)
        except IntegrityError:
            identity = SsoIdentity.objects.select_related("user").get(issuer=issuer, subject=subject)
            user = identity.user

    if not user.is_active:
        audit("auth.login_failed", request=request, actor=user, target=user, reason="disabled", method="sso")
        raise SsoError("account_disabled")
    now = timezone.now()
    # The provider vouched for the address; a lock from wrong passwords doesn't apply here.
    User.objects.filter(id=user.id).update(
        last_login_at=now, email_verified_at=user.email_verified_at or now, failed_login_count=0, locked_until=None
    )
    SsoIdentity.objects.filter(id=identity.id).update(last_login_at=now, **({"email": email} if email else {}))
    audit("auth.login", request=request, actor=user, target=user, method="sso", provider=provider.id)
    return user


# --- network ---------------------------------------------------------------


def _is_http_url(value) -> bool:
    return isinstance(value, str) and value.startswith(("https://", "http://"))


def _read(request: urllib.request.Request) -> dict:
    if not _is_http_url(request.full_url):
        raise ValueError("Not an http(s) URL.")
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:  # noqa: S310 - scheme checked above
            return json.load(response)
    except urllib.error.HTTPError as exc:
        raise OSError(f"{request.full_url} answered {exc.code}: {exc.read(300).decode(errors='replace')}") from exc


def fetch_json(url: str, *, bearer: str | None = None) -> dict:
    headers = {"Accept": "application/json", **({"Authorization": f"Bearer {bearer}"} if bearer else {})}
    return _read(urllib.request.Request(url, headers=headers))


def post_form(url: str, form: dict, *, basic: tuple[str, str] | None = None) -> dict:
    headers = {"Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"}
    if basic:
        pair = ":".join(urllib.parse.quote(part, safe="") for part in basic)
        headers["Authorization"] = "Basic " + base64.b64encode(pair.encode()).decode()
    return _read(urllib.request.Request(url, data=urllib.parse.urlencode(form).encode(), headers=headers, method="POST"))


_jwk_clients: dict[str, jwt.PyJWKClient] = {}


def signing_key(jwks_uri: str, id_token: str):
    """The provider's public key for this token (its key set is cached per process)."""
    client = _jwk_clients.setdefault(jwks_uri, jwt.PyJWKClient(jwks_uri, timeout=TIMEOUT))
    return client.get_signing_key_from_jwt(id_token).key
