# platform-auth

Standalone authentication module: own backend, own frontend, own Postgres
database. First of the `platform-*` family of small, independently
deployable modules (successor to trying to build one big `platform-core`
monolith for auth+orgs+RBAC+CRUD — that work is parked; this repo only
does login, scoped deliberately narrow).

No source-level dependency on any OTHER module (platform-org, etc.) -
those still share nothing but HTTP contracts. **`platform-core` is the
one exception**: this repo used to vendor its own copy of `core_api`
(errors/exceptions/utils), a deliberate "share nothing" choice from
platform-core's Module-Federation-era, not-in-active-use period. Now that
platform-core owns real, nontrivial shared code (`BaseSerializer`/
`BaseViewSet` - see its own AGENTS.md) worth NOT re-vendoring everywhere,
this repo depends on it for real: `core_api/` was deleted from here, and
whoever installs this package must also `pip install -e` a checkout of
`apps/platform-core/backend` (`apps/main`'s `docker-compose.yml` does
this; this repo's own `Dockerfile` does too, see below).

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
- `POST /api/v1/auth/refresh` — exchanges the httpOnly refresh cookie for
  a new access token + a NEW rotated refresh cookie (single-use: the old
  one is revoked via an atomic conditional `UPDATE`, `revoked_at__isnull=True`
  in the `WHERE`, checking the row count — two concurrent requests
  presenting the same cookie: exactly one wins, the other 401s). Every
  new refresh token gets a fresh `JWT_REFRESH_TTL_DAYS` window (sliding
  expiry): a session lasts until logout as long as it's used at least
  once per window - only an idle one expires. This is what makes "stay
  logged in across a reload" work — see the frontend section below.
- `POST /api/v1/auth/logout` — revokes the refresh token behind the
  cookie (`revoked_reason="logout"`) and deletes the cookie. Needs no
  access token (it may have expired); 204 even with no/unknown cookie.

Not built yet (deliberately out of scope): login rate limiting.

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

**Rate limits** (`platform_auth/throttling.py`): login per client IP
(`auth_login`) and per account email (`auth_login_email`), signup and
first-run setup per IP (`auth_signup`), POST only. Rates are the
host's `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]`, read per request; a
scope without a rate isn't limited, so a host opts in. The counts live
in the `default` cache - give a multi-worker host a shared one - and
the client IP is DRF's (`NUM_PROXIES` from the end of
`X-Forwarded-For`). Over the limit: 429 `rate_limited` with
`Retry-After`, shown by the login/signup screens as-is.

## RBAC (role-based access control)

Enforced on EVERY `BaseViewSet` resource of the host, not just this
module's: `platform_auth.rbac.policy.RBACPolicy` plugs into platform-core's
access-policy hook (`core_api/access.py`) once the host sets
`CORE_API_ACCESS_POLICY = "platform_auth.rbac.policy.RBACPolicy"`. Nothing
else in the host changes; unset, the module's RBAC tables just sit idle.

- **Model** (`models/rbac.py`): `Permission` (`<resource>.<verb>`, verbs
  `view/create/update/delete`, resource = last segment of the endpoint
  registered with `register_model_endpoint`), `Role` (a set of
  permissions, or `grants_all`; `is_default` roles go to every new user
  app-wide - `rbac/signals.py`), `RoleAssignment` (user + role +
  `scope_id`: empty = app-wide, set = only within that scope).
- **Scopes**: what a scope IS is the host's call. A resource opts in with
  `scope_field` on its viewset - a lookup path to the scope id (goalnexa:
  goals `org_id`, metrics `goal__org_id`, check-ins
  `metric__goal__org_id`; platform-org: orgs `id`). A scoped role then
  applies to rows whose `scope_field` holds that id; unscoped rows (no
  `scope_field`, or empty - a personal goal) need an app-wide role.
  `RBAC_SCOPE_ENDPOINT`/`RBAC_SCOPE_LABEL` give `scope_id` a picker/label.
- **Rules** (`rbac/policy.py`): rights are the union of every role held;
  lists show only rows the user may `view` (a row they can't view is a
  404 for other verbs too); create and update are re-checked against the
  SAVED row inside a transaction (rolled back on denial), so nothing can
  be created in, or moved into, a scope without rights there. Layered on
  top of each viewset's own scoping (owner-only goals stay owner-only).
- **Catalog** (`rbac/catalog.py`): permissions are synced from the
  registered resources after every `migrate` (post_migrate) or
  `manage.py sync_rbac` - never created by hand (the API is read-only).
  `RBAC_DEFAULT_ROLES` (host settings) are created when missing; their
  `permissions` patterns (`"goals.*"`) apply when the role is created and
  to permissions that appear later, never re-applied - admin edits stick.
  Migration 0003 gave every pre-RBAC user the default roles once.
- **First-run onboarding** (`views/setup.py`): until the first user
  exists, `GET /api/v1/auth/setup` says `{"required": true}` and `POST`
  (name/email/password, like signup) seeds the catalog (`sync_catalog`),
  creates that user and gives them `RBAC_ADMIN_ROLE` (default "Admin",
  created grants_all if missing) app-wide, then logs them in. Refused
  (`409 setup_done`) once any user exists; signup is refused
  (`409 setup_required`) until then, so the first account is always the
  admin. Concurrent setups serialize on the admin role's row lock. The
  frontend's `setup` page (in `createAuthRoutes`) is the signup form in
  setup mode; login/signup/setup redirect among themselves by the status
  (`routes/useSetupGate.ts`). Note a publicly reachable fresh install
  lets whoever gets there first become admin - finish setup before
  exposing it.
  A host where strangers sign up (hosted/SaaS) sets
  `AUTH_FIRST_RUN_SETUP = False`: setup is never required, `POST` is
  refused (`409 setup_disabled`), signup works from the first account
  on, and the operator's admin comes from `grant_role` (below).
- **Bootstrap** (or recovery): `manage.py grant_role <email> <role> [--scope <id>]`.
- **API** (`rbac_urls.py`): `users` (list/rename - explicit field list,
  never `password_hash`), `roles`, `role-assignments`, `permissions`
  (read-only). Mounted at `api/v1/` - NOT under `auth/` - because
  platform-core's generic CRUD pages find a resource's API at
  `/api/v1/<its URL segment>`. `GET /api/v1/auth/me` adds `permissions`
  (app-wide codenames, `["*"]` for grants_all).
- **Delegation caveat**: someone holding `role-assignments.*` within a
  scope can assign any role there (including a grants_all one) - scoped
  to that scope only, but grant it knowingly. Picking a user/role in the
  form still needs app-wide `users.view`/`roles.view`.
- **Tests**: `tests.py` - run in a host with the policy on
  (`apps/main`: `python manage.py test platform_auth`). A module whose
  tests use role-less stand-in actors (goalnexa's) turns the policy off
  with `override_settings(CORE_API_ACCESS_POLICY=None)`.

Frontend: `createRbacNavItems(basePath)` (`src/rbacNav.tsx` - the
"Access control" sidebar group, Users + Roles, each with its
`permission`; same `basePath` as the routes; apps/main spreads it into
`app-shell.tsx`'s `NAV_ITEMS` and filters with `filterNavByPermissions`),
`createRbacRoutes(basePath)` (users/roles/role-assignments/
permissions via platform-core's `createCrudRoutes` - role permissions are
a many-to-many tab, a user's assignments a one-to-many tab; nothing
hand-written), `useMyPermissions()`/`hasPermission()` to hide what a user
can't open (apps/main's sidebar). `fetchMyPermissions` sends the
session's token explicitly: after a reload `initSession` restores the
session before `apiRequest`'s own token store, and `apiRequest`'s 401
handling would otherwise redirect to the standalone app's `/login`.

## Frontend (`frontend/`)

React + Vite + TypeScript, and also an **npm package**: `package.json`
has `"name": "platform-auth-frontend"` and an `exports` field
(`src/index.ts`) so another app can add it as a `file:` dependency and
import straight from source (no build step — the consumer's own Vite
processes the TS/TSX). `apps/main` does exactly this; see its own
AGENTS.md for the "apps provide router/screen, packaged as package, main
calls on it" rule this repo follows.

`src/screens/LoginScreen.tsx` / `SignupScreen.tsx` are the package's
screen exports — self-contained (bundle their own `AuthProvider`, zero host
wiring needed). `pages/Login.tsx`/`Signup.tsx` (which they wrap)
deliberately have no `react-router` dependency (no `useNavigate`) — a
consuming app may be on a completely different `react-router` major
version (main: v8; this app's own standalone `App.tsx`: v7) or just a
separate module instance of the same one, either way `useNavigate()`
would throw even though the component renders fine. Routing-dependent
behavior (redirect after success) is passed in via the `onSuccess` prop
instead — see `App.tsx`'s `LoginRoute`/`SignupRoute` wrappers for this
repo's own standalone use.

**Centralized routes for a host (`createAuthRoutes(basePath)`,
`src/authRoutes.ts`, exported from the main `"."` entry):** every auth
page (`login`, `signup` → `src/routes/login.tsx`/`signup.tsx`) nested
under a host-chosen mount - `apps/main` registers the whole module with
`...createAuthRoutes("auth")` and has no auth route file of its own. On
success, the route files store the session in this module's own store
and redirect to `?next=` (same-origin paths only, else `/` - see
`src/routes/redirect.ts`, which blocks `//host`-style open redirects);
the host steers the destination by putting `?next=` on its links. Login
and signup link to each other under the card (the screens' `footer`
prop), keeping the query (`siblingPath`) - so an invited user without an
account signs up and still lands back on the invitation. Signup also
prefills the email from `?email=` (`defaultEmail`). Add a
new auth page (forgot-password, etc.) with a file under `src/routes/` +
an entry in `createAuthRoutes()`; the host needs no change. A host
customizes those pages (it can't pass them props) by wrapping its app in
`AuthScreenProvider` (`title` = the heading above the card; `apps/main`'s
`root.tsx` sets "GoalNexa"); `LoginScreen`/`SignupScreen` also take
`title` directly. Notes:
- `src/routes/*.tsx` are the only files here allowed to import
  `react-router` (`useNavigate`/`useSearchParams`); in the host,
  `resolve.dedupe` resolves it to the host's copy (v8). This package
  itself declares `react-router@^7` (matching its standalone
  `react-router-dom@7`) - only APIs common to v7/v8 are used.
- `authRoutes.ts` rides in the host's CLIENT bundle (the `"."` entry is
  imported by `root.tsx`), so it must stay browser-safe: no `node:*`
  imports, nothing computed at module load, paths built by string ops on
  `import.meta.url` only when called (Node-side, from the host's
  `routes.ts`). Not `new URL(..., import.meta.url)` - Vite rewrites that
  into an asset reference. (It doesn't use `platform-core`'s
  `routeFilePath` helper only because this package has no
  `platform-core` frontend dependency.)
- Plain route-config objects rather than `@react-router/dev/routes`'s
  helpers: that package's v8 peer-depends on `react-router@^8`, which
  would clash with the standalone app's v7.

**Session store (`src/session.ts`, exported from `"."`)** - this module
owns who's logged in: `getSession`/`subscribeSession`/
`isSessionInitialized`/`clearSession` for the host to read (e.g.
`apps/main`'s `app-shell.tsx` hands the access token to other modules'
screens as a plain prop), `setSession` (written by the login/signup
routes), and `initSession()` - a host calls it ONCE at app boot (root
effect) to restore a session that survived a page reload (the access
token is memory-only, the httpOnly refresh cookie persists), then marks
the store initialized either way. Protected host routes must wait for
`isSessionInitialized()` before redirecting to login. Separate from
`lib/auth/tokenStore.ts` (this module's own API client's token) on
purpose - that one also backs the standalone app.

`refreshSession()` (raw; `initSession` wraps it) **deduplicates
concurrent calls into one shared in-flight promise** (`lib/api/auth.ts`'s
`refresh()`) - the backend's refresh token is single-use/rotating, so
two callers hitting it around the same moment would otherwise race for
the same cookie, one legitimately 401ing. This isn't hypothetical:
React's `StrictMode` (on by default in `create-react-router`'s scaffold)
double-invokes effects in dev, so the host's boot effect calls
`initSession()` twice.

**The store keeps the access token fresh on its own** (the token lives
`JWT_ACCESS_TTL_MINUTES`, 15 by default): while a session is held it
checks every 30s, and on window focus / tab visible / back online,
whether the token is within 2 minutes of expiring, and refreshes if so.
"Expiring" is measured on the client's clock (received-at + `exp - iat`),
not by comparing `exp` to the client's clock - a skewed client clock
would otherwise refresh nonstop.
A periodic check rather than one timer set for `exp`, because timers
pause while the machine sleeps - after a wake the token would already
be dead. A network error just waits for the next check; a 401 gets one
retry 2s later (another tab may have rotated the shared cookie at that
moment) before `clearSession()`. The host keeps passing
`getSession().accessToken` down as before - it just changes over time.
`logout()` (also exported) calls the backend's logout, then clears the
store.

The API client (`lib/api/client.ts`'s `apiRequest`) is axios.

(This package previously also shipped as a Module Federation remote,
exported as `RemoteLogin` — that approach is superseded by the plain
package-import rule above; the `federation()` vite plugin config was
removed and the component renamed to `LoginScreen` since "remote"
stopped being accurate.)

## Running locally

```
cd backend && source .venv/bin/activate && pip install -r requirements.txt -e ../../platform-core/backend && python manage.py runserver
cd frontend && npm run dev   # standalone dev
```

The standalone `Dockerfile` now builds from the **repo root**, not this
directory, since it needs `apps/platform-core/backend` alongside its own
files:
```
docker build -f apps/platform-auth/backend/Dockerfile -t platform-auth-backend .
```
