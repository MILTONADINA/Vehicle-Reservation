# API Reference

**Living snapshot** of the REST API on `dev`. API mount path is `/vehicle-t6` (see `backend/server.js`). Update this file when endpoints merge to `dev`.

## Conventions

- Flat JSON responses (no `{ success, data }` envelope).
- Errors: `{ "message": "..." }`.
- Authenticated routes: `Authorization: Bearer <token>`, where the token is the application session JWT returned by login.
- Any route behind `authenticate`: no valid session → `401` `Unauthorized.`; session lookup failure → `500` `Session could not be checked.`. Behind `requireRole(...)`: role not allowed → `403` `Forbidden.`

## Authentication

| Method | Endpoint | Auth | Request | Success |
|--------|----------|------|---------|---------|
| POST | `/vehicle-t6/login` | Google ID token | `{ "credential": "<Google ID token>" }` | `200`, account payload + `token` |
| GET | `/vehicle-t6/auth/me` | Bearer session | none | `200`, account payload |
| POST | `/vehicle-t6/logout` | Bearer session | none | `200`, `{ "message": "Signed out." }` |

Account payload: `{ "userId": 1, "email": "user@oc.edu", "firstName": "Avery", "lastName": "Reed", "role": "requestor", "areaId": null }`. Login adds `"token": "<application JWT>"`. `areaId` is `null` until Feature 2 adds the area relationship. Responses never include `googleSub`, the Google credential, or any secret.

| Condition | Status | Message |
|-----------|--------|---------|
| Missing, empty, or non-string credential | 400 | `Google credential is required.` |
| Invalid Google signature, issuer, audience, or expiry | 401 | `Google sign-in failed.` |
| Unverified email or domain outside oc.edu / eagles.oc.edu | 403 | `Use your OC Google account.` |
| Google subject or email already linked to another account | 409 | `Google account could not be linked.` |
| Google verification unavailable, or `GOOGLE_CLIENT_ID` not configured | 503 | `Google sign-in is unavailable. Try again.` |
| Login storage failure | 500 | `Sign-in could not be completed.` |
| No valid application session, including on logout | 401 | `Unauthorized.` |
| Authenticated role not permitted | 403 | `Forbidden.` |
| Session lookup failure | 500 | `Session could not be checked.` |
| Logout storage failure | 500 | `Sign-out could not be completed. Try again.` |

The initial administrator is provisioned by the operator command `npm run seed:admin` (backend), not by an endpoint.

## Provenance

| Area | Introduced |
|------|------------|
| Login, current account, logout | Feature 1 |
