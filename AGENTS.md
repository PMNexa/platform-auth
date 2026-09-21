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
- `platform_auth/security.py` — argon2 password hashing (with a
  timing-safe dummy-hash check on login), JWT access tokens (PyJWT HS256),
  opaque refresh tokens (SHA-256-hashed at rest).
- `POST /api/v1/auth/login` — the only real endpoint so far. Issues a JWT
  access token in the response body + sets an httpOnly refresh-token
  cookie scoped to `${URL_PREFIX}/api/v1/auth` — `URL_PREFIX` (env,
  defaults empty) must match wherever this module is mounted behind a
  gateway (e.g. `/platform-auth`), or the browser silently never sends
  the cookie back.
- `GET /api/v1/auth/me` — bearer-token-protected, 401s with no token.

Not built yet (deliberately out of scope for "first with login"): signup,
refresh-token rotation endpoint, logout, login rate limiting.

## Frontend (`frontend/`)

React + Vite + TypeScript, and also an **npm package**: `package.json`
has `"name": "platform-auth-frontend"` and an `exports` field
(`src/index.ts`) so another app can add it as a `file:` dependency and
import straight from source (no build step — the consumer's own Vite
processes the TS/TSX). `apps/main` does exactly this; see its own
AGENTS.md for the "apps provide router/screen, packaged as package, main
calls on it" rule this repo follows.

`src/remote/RemoteLogin.tsx` (exported as `RemoteLogin`) is the
package's actual export — self-contained (bundles its own
`AuthProvider`, zero host wiring needed). `pages/Login.tsx` (which it
wraps) deliberately has no `react-router` dependency (no `useNavigate`)
— a consuming app may be on a completely different `react-router` major
version (main: v8; this app's own standalone `App.tsx`: v7) or just a
separate module instance of the same one, either way `useNavigate()`
would throw even though the component renders fine. Routing-dependent
behavior (redirect after login) is passed in via the `onSuccess` prop
instead — see `App.tsx`'s `LoginRoute` wrapper for this repo's own
standalone use, or `apps/main/frontend/app/routes/login.tsx` for the
package-consumer's use.

(This package previously also shipped as a Module Federation remote —
that approach is superseded by the plain package-import rule above; the
`federation()` vite plugin config was removed. `RemoteLogin`'s name is a
leftover from that era, kept because it's still accurate — "the
component a remote/external caller renders" — not because federation is
still in use.)

## Running locally

```
cd backend && source .venv/bin/activate && python manage.py runserver
cd frontend && npm run dev   # standalone dev
```
