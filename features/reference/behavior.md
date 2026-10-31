# Behavior & Rules Reference

**Living snapshot** of product rules currently in force on `dev`.

These files answer: *"What rules does the app enforce right now?"*  
They do **not** authorize new scope — implement only from `features/feature-*.md`.

| File | Role |
|------|------|
| [api.md](./api.md) | Routes / payloads |
| [data-model.md](./data-model.md) | Tables / columns |
| **This file** | Ownership, sort, validation, UI rules |

## Authentication and sessions

| Rule | Enforcement | Introduced |
|------|-------------|------------|
| Only Google sign-in exists; there is no local password, registration, or reset | `backend/app/routes/auth.routes.js` exposes login, auth/me, logout only | Feature 1 |
| A Google credential is accepted only when its signature, issuer, audience (`GOOGLE_CLIENT_ID`), and expiry verify, the email is verified, and both the hosted domain and the email domain are exactly `oc.edu` or `eagles.oc.edu` | `googleVerifier` + `approvedIdentity()` in `auth.controller.js` | Feature 1 |
| A first verified OC sign-in creates one `requestor`; identity and role values in the request body are ignored | `findOrLinkUser()` uses verified Google claims only | Feature 1 |
| A provisioned account (no `googleSub`) links to its verified Google subject on first sign-in without changing its names or role; a subject or email already linked to a different account is refused with 409 | `findOrLinkUser()` inside one transaction | Feature 1 |
| Missing Google names are stored as empty strings, never invented | `approvedIdentity()` | Feature 1 |
| A session is a signed JWT (`AUTH_SECRET`, 24 hours) stored in `sessions` with `expirationDate` equal to the JWT expiry; login deletes the user's expired sessions, reuses an unexpired session whose token still verifies, otherwise issues a new one | `reuseOrCreateSession()` | Feature 1 |
| Login user and session writes are atomic: a storage failure returns 500 and commits nothing | `db.sequelize.transaction()` in `controller.login` | Feature 1 |
| Every protected request loads the user from the database; `req.user = { id, role, areaId }` (areaId null until Feature 2). Missing, malformed, tampered, expired, unknown, or deleted-user tokens get 401 `Unauthorized.` | `authenticate` in `backend/app/authorization/authorization.js` | Feature 1 |
| A route allows only the roles it names; other authenticated roles get 403 `Forbidden.` and the handler does not run | `requireRole(...roles)` | Feature 1 |
| Logout deletes only the presented session; other sessions stay valid | `controller.logout` | Feature 1 |
| The initial administrator is provisioned by `npm run seed:admin` from `ADMIN_EMAIL`, `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME` (OC domains only); re-running leaves an existing admin unchanged and never promotes a non-admin; no first-login rule grants admin | `backend/app/scripts/seed-admin.mjs` | Feature 1 |
| Application logs never contain Google credentials, application tokens, or `AUTH_SECRET` | controllers log outcomes only; `safeMessage()` masks tokens in error text | Feature 1 |

## Frontend session rules

| Rule | Enforcement | Introduced |
|------|-------------|------------|
| The Login screen (`/login`) shows the heading **Sign in** and a Google button rendered by Google Identity Services with `VITE_GOOGLE_CLIENT_ID`; no password or registration fields. If the Google script has not loaded after 5 seconds the screen shows `Google sign-in could not be loaded. Reload the page.`; without a configured `VITE_GOOGLE_CLIENT_ID` it shows `Google sign-in is not configured.` | `frontend/src/views/Login.vue` | Feature 1 |
| A successful login response is stored as localStorage key `user` via `Utils`; API calls attach `Authorization: Bearer` from it | `Login.vue`, `services/services.js` | Feature 1 |
| While a login request is pending a loading indicator shows and repeated credentials are ignored; a failed login shows the API message or `Sign-in could not be completed.` and stores nothing | `Login.vue` | Feature 1 |
| Signed-out navigation to a protected route opens `/login` | `router.beforeEach` in `frontend/src/router.js` | Feature 1 |
| A protected route renders only after `GET /auth/me` succeeds; returned fields are merged into the stored user without dropping the token; a failed check shows `Session could not be checked.` with **Retry** | `frontend/src/components/SessionGate.vue` | Feature 1 |
| A 401 clears the stored user and opens `/login`; a 403 shows `Forbidden.` without signing out | `handleResponseError` in `services/services.js`, alert in `App.vue` | Feature 1 |
| Home (`/`) shows the heading **Vehicle Reservations**; MenuBar shows the signed-in email and **Sign out** | `views/Home.vue`, `components/MenuBar.vue` | Feature 1 |
| Sign out calls the API; 200 or 401 clears the stored user and opens `/login`; any other failure keeps the session and shows `Sign-out could not be completed. Try again.` | `MenuBar.vue` | Feature 1 |
