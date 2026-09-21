# platform-auth

Standalone authentication module: own backend, own frontend, own Postgres
database. First of the `platform-*` family of small, independently
deployable modules (successor to trying to build one big `platform-core`
monolith for auth+orgs+RBAC+CRUD — that work is parked; this repo only
does login, scoped deliberately narrow).

No source-level dependency on platform-core or any other module. Modules
in this architecture share nothing at the source/DB level, only HTTP
contracts.

## Backend (`backend/`)

Django 5.2 + Django REST Framework, sync (psycopg), matching
platform-core's byte-identical wire-contract conventions:
`{code, message, field_errors}` error shape, bearer-JWT auth via a custom
`BaseAuthentication` subclass (never `SessionAuthentication` — keeps DRF
from enforcing CSRF).

- **Migrations: use Django's own migration system (`manage.py makemigrations` /
  `manage.py migrate`), not Alembic.** Every model change goes through
  `makemigrations` — do not hand-write SQL migrations unless doing
  something `makemigrations` can't express (e.g. a data migration).
- Django project config lives in `config/` (settings/urls/wsgi/asgi); the
  actual app is `platform_auth/` — named after the module itself, not
  `accounts`, since this repo does nothing else.
- `platform_auth/models/`, `serializers/`, `views/` — one class per file,
  re-exported from each package's `__init__.py`. Follow this layout for
  new models/serializers/views rather than growing a flat `models.py`.
- `platform_auth/models/user.py`, `refresh_token.py` — `User`,
  `RefreshToken`. No `Actor`/`AIAgent` polymorphism (unlike platform-core)
  — add that later only if an agent-facing module actually needs it.
  `User.is_authenticated` is a fixed-`True` property (Django's own
  convention — only `AnonymousUser` is `False`), needed because DRF's
  built-in `IsAuthenticated` permission class checks that attribute
  directly; this app's own views never needed it (they do their own
  `request.user is None` check), but a module imported alongside this one
  (e.g. `platform-org`, which declares `permission_classes =
  [IsAuthenticated]` explicitly) hits it the moment `ActorAuthentication`
  resolves a real `User` instance. Same class of gap as `platform-org`'s
  own `ActorStub` needing it — check for `'<Model>' object has no
  attribute 'is_authenticated'` if you add a model that a permission
  class might see as `request.user`.
- `platform_auth/security.py` — argon2 password hashing (with a
  timing-safe dummy-hash check on login), JWT access tokens (PyJWT HS256),
  opaque refresh tokens (SHA-256-hashed at rest).
- `POST /api/v1/auth/login`, `POST /api/v1/auth/signup` — both issue the
  same session shape (`views/_session.py`'s `issue_session_response`,
  shared so the two views don't duplicate the JWT-issuing/refresh-cookie
  logic): JWT access token in the body, httpOnly refresh-token cookie
  scoped to `${URL_PREFIX}/api/v1/auth` — `URL_PREFIX` (env, defaults
  empty) must match wherever this module is mounted behind a gateway
  (e.g. `/platform-auth`), or the browser silently never sends the cookie
  back. Signup 409s `email_taken` on a duplicate email (relies on the
  `User.email` unique constraint + `IntegrityError`, not a pre-check —
  avoids a check-then-insert race).
- `GET /api/v1/auth/me` — bearer-token-protected, 401s with no token.

Not built yet (deliberately out of scope): refresh-token rotation
endpoint, logout, login rate limiting.

Also an **importable pip package**: `pyproject.toml` at this directory's
root packages `platform_auth` (the Django app) and `core_api` (the
error-contract/exception-handler support it needs) as importable units
— no build step, `pip install -e .` symlinks straight to this source.
`apps/main/backend` does exactly this (editable-installs it, adds
`"platform_auth"` to its own `INSTALLED_APPS`, mounts `platform_auth.urls`
at the same `api/v1/auth/` prefix this repo's own `config/urls.py` uses)
— see its own AGENTS.md for the backend half of the "module packaged,
main imports it" rule. Because the prefix matches exactly, this app's
own `settings.URL_PREFIX`-based cookie-path logic needs no changes to
work correctly when imported this way.

## Frontend (`frontend/`)

React + Vite + TypeScript, and also an **npm package**: `package.json`
has `"name": "platform-auth-frontend"` and an `exports` field
(`src/index.ts`) so another app can add it as a `file:` dependency and
import straight from source (no build step — the consumer's own Vite
processes the TS/TSX). `apps/main` does exactly this; see its own
AGENTS.md for the "apps provide router/screen, packaged as package, main
calls on it" rule this repo follows.

`src/screens/LoginScreen.tsx` / `SignupScreen.tsx` (exported alongside
`BASE_PATH`/`LOGIN_PATH`/`SIGNUP_PATH`) are the package's actual
exports — self-contained (bundle their own `AuthProvider`, zero host
wiring needed). `pages/Login.tsx`/`Signup.tsx` (which they wrap)
deliberately have no `react-router` dependency (no `useNavigate`) — a
consuming app may be on a completely different `react-router` major
version (main: v8; this app's own standalone `App.tsx`: v7) or just a
separate module instance of the same one, either way `useNavigate()`
would throw even though the component renders fine. Routing-dependent
behavior (redirect after success) is passed in via the `onSuccess` prop
instead — see `App.tsx`'s `LoginRoute`/`SignupRoute` wrappers for this
repo's own standalone use, or `apps/main/frontend/app/routes/login.tsx` /
`signup.tsx` for the package-consumer's use. `apps/main` mounts both
under `BASE_PATH` ("auth") itself — this package only names its own
bare segments, nesting is the host's call.

Both screens' `onSuccess` callback receives a `Session`
(`{accessToken, user}`, also exported from `index.ts`) — a host captures
this to make its own authenticated calls afterward against a *different*
module (e.g. passing the token into `platform-org-frontend`'s
`OrgsScreen`, which takes it as a plain prop rather than owning any auth
state itself). This module never needs to know that happens; it just
hands back what it already has.

(This package previously also shipped as a Module Federation remote,
exported as `RemoteLogin` — that approach is superseded by the plain
package-import rule above; the `federation()` vite plugin config was
removed and the component renamed to `LoginScreen` since "remote"
stopped being accurate.)

## Running locally

```
cd backend && source .venv/bin/activate && python manage.py runserver
cd frontend && npm run dev   # standalone dev
```
