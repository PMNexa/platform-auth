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
- `accounts/models.py` — `User`, `RefreshToken`. No `Actor`/`AIAgent`
  polymorphism (unlike platform-core) — add that later only if an
  agent-facing module actually needs it.
- `accounts/security.py` — argon2 password hashing (with a timing-safe
  dummy-hash check on login), JWT access tokens (PyJWT HS256), opaque
  refresh tokens (SHA-256-hashed at rest).
- `POST /api/v1/auth/login` — the only real endpoint so far. Issues a JWT
  access token in the response body + sets an httpOnly refresh-token
  cookie scoped to `/api/v1/auth`.
- `GET /api/v1/auth/me` — bearer-token-protected, 401s with no token.

Not built yet (deliberately out of scope for "first with login"): signup,
refresh-token rotation endpoint, logout, login rate limiting.

## Frontend (`frontend/`)

React + Vite + TypeScript, Tabler design system — matching platform-core's
frontend stack so the two modules' UIs compose visually. Login page only.

## Running locally

```
cd backend && source .venv/bin/activate && python manage.py runserver
cd frontend && npm run dev
```
