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

Account payload: `{ "userId": 1, "email": "user@oc.edu", "firstName": "Avery", "lastName": "Reed", "role": "requestor", "areaId": null }`. Login adds `"token": "<application JWT>"`. `areaId` is the account's current area assignment from `users.areaId` (Feature 2), null for every role except an assigned area admin. Responses never include `googleSub`, the Google credential, or any secret.

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

## Areas

| Method | Endpoint | Allowed role | Request | Success |
|--------|----------|--------------|---------|---------|
| GET | `/vehicle-t6/areas` | every signed-in role | none | `200`, array of Area objects sorted by `areaName`, then `id` |
| POST | `/vehicle-t6/areas` | admin | Area fields | `201`, new Area object |
| PUT | `/vehicle-t6/areas/:id` | admin, or the area admin assigned to `:id` | Area fields (complete replacement) | `200`, updated Area object |
| DELETE | `/vehicle-t6/areas/:id` | admin | none | `200`, `{ "message": "Area deleted." }` |

Area fields: `{ "areaName": "Athletics", "areaLogo": "https://example.org/logo.png", "noticeEmail": "Collect keys from Athletics. Return the vehicle clean with a full tank." }`. Area object: those three fields plus `id`. Other body properties are ignored. `noticeEmail` is plain reminder text (not an address): outer whitespace is trimmed, case, internal spaces and line breaks are kept, up to 5,000 characters. `areaLogo` must be an absolute `https` URL with a host. No GET-by-id endpoint exists.

| Condition | Status | Message |
|-----------|--------|---------|
| Missing, blank, non-string, over-length field, or non-HTTPS logo | 400 | `Invalid area data.` |
| Route id not a positive safe integer | 400 | `Area id must be a positive integer.` |
| Area missing, or outside an area admin's own assignment | 404 | `Area with id=<id> not found.` |
| Area name already used (case-insensitive) by another area | 409 | `Area name is already in use.` |
| Area still referenced (assigned users, later vehicles) | 409 | `Area is in use.` |
| Database failure | 500 | `Area request failed.` |

## Vehicles

| Method | Endpoint | Allowed role | Request | Success |
|--------|----------|--------------|---------|---------|
| GET | `/vehicle-t6/vehicles/options` | admin, area_admin | none | `200`, `{ "makes": [...], "modelsByMake": { ... } }` |
| GET | `/vehicle-t6/vehicles` | admin, area_admin | none | `200`, array of Vehicle objects in the caller's scope, sorted by `make`, then `model`, then `id` |
| POST | `/vehicle-t6/vehicles` | admin, area_admin | Vehicle fields | `201`, new Vehicle object |
| PUT | `/vehicle-t6/vehicles/:id` | admin, or area_admin for an in-scope vehicle | Vehicle fields (complete replacement) | `200`, updated Vehicle object |
| DELETE | `/vehicle-t6/vehicles/:id` | admin, or area_admin for an in-scope vehicle | none | `200`, `{ "message": "Vehicle deleted." }` |

Vehicle fields: `{ "make", "model", "year", "vin", "purchasedDate", "color", "passengers", "plateNumber", "plateExpireMonth", "designatedParking", "areaId" }`. Vehicle object: those fields plus generated `id`. `vin` is returned uppercase. Other body properties are ignored. Make and model must come from the standard lists; model must belong to the selected make. No GET-by-id endpoint exists.

| Condition | Status | Message |
|-----------|--------|---------|
| Invalid field, make/model pair, date, month, year, or passengers | 400 | `Invalid vehicle data.` |
| Route id not a positive safe integer | 400 | `Vehicle id must be a positive integer.` |
| Disallowed role, or area_admin writing another area on create/update body | 403 | `Forbidden.` |
| Missing area on create/update | 404 | `Area with id=<id> not found.` |
| Missing or out-of-scope vehicle | 404 | `Vehicle with id=<id> not found.` |
| VIN already used (case-insensitive) by another vehicle | 409 | `VIN is already in use.` |
| Database failure | 500 | `Vehicle request failed.` |

## Provenance

| Area | Introduced |
|------|------------|
| Login, current account, logout | Feature 1 |
| Areas list, create, update, delete | Feature 2 |
| Vehicles options, list, create, update, delete | Feature 4 |
