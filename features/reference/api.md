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

## Users

| Method | Endpoint | Allowed role | Request | Success |
|--------|----------|--------------|---------|---------|
| GET | `/vehicle-t6/users` | admin, area_admin | none | `200`, array of User objects sorted by `lastName`, `firstName`, then `id` |
| POST | `/vehicle-t6/users` | admin | User fields | `201`, new User object |
| PUT | `/vehicle-t6/users/:id` | admin; area_admin only for requestor and maintenance targets | Update fields (complete replacement) | `200`, updated User object |
| DELETE | `/vehicle-t6/users/:id` | admin; area_admin only for requestor and maintenance targets | none | `200`, `{ "message": "User deleted." }` |

User fields: `{ "email": "avery.reed@oc.edu", "firstName": "Avery", "lastName": "Reed", "role": "requestor", "areaId": null }`. Update fields: the same without `email`; an `email` in a PUT body is ignored, as are other properties. User object: the fields plus `id`, never `googleSub`, sessions, or tokens. `email` is trimmed and lowercased, at most 254 characters, well formed, inside `oc.edu` / `eagles.oc.edu`, and unique. Names are trimmed, nonblank, at most 100 characters. `role` is `admin`, `area_admin`, `requestor`, or `maintenance`; `areaId` is an existing area id for `area_admin` and must be exactly `null` for every other role. A created account has no Google link until that person signs in (Feature 1 links it and keeps the id, role, and area). Changing a target's role or area ends all of that user's sessions in the same transaction; deleting a user deletes its sessions in the same transaction. No GET-by-id endpoint exists.

| Condition | Status | Message |
|-----------|--------|---------|
| Missing, blank, non-string, over-length, or malformed field; unsupported role; role and area that do not match | 400 | `Invalid user data.` |
| Route id not a positive safe integer | 400 | `User id must be a positive integer.` |
| Area admin targeting an admin or area_admin account, or requesting one of those roles | 403 | `Forbidden.` |
| Target user missing | 404 | `User with id=<id> not found.` |
| `areaId` names no existing area | 404 | `Area with id=<id> not found.` |
| Email already used by another account | 409 | `Email is already in use.` |
| Admin changing their own role or deleting their own account | 409 | `You cannot remove your own admin access.` |
| Database failure | 500 | `User request failed.` |

PUT checks in this order: route id, target exists, area-admin limits, own admin access, field validation, area exists. POST checks field validation, then the email, then the area.

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

## Drivers

| Method | Endpoint | Allowed role | Request | Success |
|--------|----------|--------------|---------|---------|
| GET | `/vehicle-t6/drivers/options` | every signed-in role | none | `200`, `{ "licenseStates": ["AL", "AK", …] }` |
| GET | `/vehicle-t6/drivers` | every signed-in role | none | `200`, array of Driver objects sorted by `lastName`, then `firstName`, then `id` |
| POST | `/vehicle-t6/drivers` | admin, area_admin | Driver fields | `201`, new Driver object |
| PUT | `/vehicle-t6/drivers/:id` | admin, area_admin | Driver fields (complete replacement) | `200`, updated Driver object |
| DELETE | `/vehicle-t6/drivers/:id` | admin, area_admin | none | `200`, `{ "message": "Driver deleted." }` |

Driver fields: `{ "firstName": "Jordan", "lastName": "Lee", "licenseState": "OK", "licenseExpireDate": "2028-06-30", "approvedDate": "2026-01-15", "status": "approved" }`. Driver object: those fields plus generated `id`. `licenseState` is returned uppercase. Other body properties are ignored. Names are trimmed, nonblank, at most 100 characters, case kept. `licenseState` must be a two-letter USPS state or DC code from the standard list. Dates are required `YYYY-MM-DD` calendar dates (past, present, or future). `status` is `approved` or `inactive`. Drivers are global with no area. No GET-by-id endpoint exists.

| Condition | Status | Message |
|-----------|--------|---------|
| Invalid field, date, status, or license state | 400 | `Invalid driver data.` |
| Route id not a positive safe integer | 400 | `Driver id must be a positive integer.` |
| Disallowed role for create, update, or delete | 403 | `Forbidden.` |
| Missing driver | 404 | `Driver with id=<id> not found.` |
| Database failure | 500 | `Driver request failed.` |

## Destinations

| Method | Endpoint | Allowed role | Request | Success |
|--------|----------|--------------|---------|---------|
| GET | `/vehicle-t6/destinations/options` | every signed-in role | none | `200`, `{ "states": ["AL", "AK", …] }` |
| GET | `/vehicle-t6/destinations` | every signed-in role | none | `200`, array of Destination objects sorted by `destinationName`, then `id` |
| POST | `/vehicle-t6/destinations` | admin, area_admin | Destination fields | `201`, new Destination object |
| PUT | `/vehicle-t6/destinations/:id` | admin, area_admin | Destination fields (complete replacement) | `200`, updated Destination object |
| DELETE | `/vehicle-t6/destinations/:id` | admin, area_admin | none | `200`, `{ "message": "Destination deleted." }` |

Destination fields: `{ "destinationName": "Oklahoma City Airport", "addressLine": "7100 Terminal Drive", "city": "Oklahoma City", "state": "OK", "zipCode": "73159", "roundTripMiles": 120.5, "status": "active" }`. Destination object: those fields plus generated `id`. `state` is returned uppercase. Other body properties are ignored. `destinationName` is trimmed, nonblank, at most 100 characters, case kept, unique ignoring case. `addressLine` and `city` are trimmed, nonblank, at most 200 and 100 characters. `state` must be a two-letter USPS state or DC code from the standard list. `zipCode` is exactly 5 digits. `roundTripMiles` is greater than 0 and at most 9999.9 with at most one decimal digit. `status` is `active` or `inactive`. Destinations are global with no area. No GET-by-id endpoint exists.

| Condition | Status | Message |
|-----------|--------|---------|
| Invalid field, zip, round-trip miles, status, or state | 400 | `Invalid destination data.` |
| Route id not a positive safe integer | 400 | `Destination id must be a positive integer.` |
| Disallowed role for create, update, or delete | 403 | `Forbidden.` |
| Missing destination | 404 | `Destination with id=<id> not found.` |
| Duplicate destination name | 409 | `Destination name is already in use.` |
| Database failure | 500 | `Destination request failed.` |

## Reservation Requests

| Method | Endpoint | Allowed role | Request | Success |
|--------|----------|--------------|---------|---------|
| GET | `/vehicle-t6/reservation-requests` | admin, area_admin (scoped), requestor (own) | none | `200`, array of ReservationRequest objects sorted by `departureDate` ASC, `departureTime` ASC (nulls first), then `id` ASC |
| POST | `/vehicle-t6/reservation-requests` | requestor | ReservationRequest writable fields | `201`, new ReservationRequest with status `requested` |
| PUT | `/vehicle-t6/reservation-requests/:id` | requestor (own `requested`) | ReservationRequest writable fields (complete replacement) | `200`, updated ReservationRequest |
| PUT | `/vehicle-t6/reservation-requests/:id/cancel` | requestor (own `requested`) | empty body | `200`, ReservationRequest with status `cancelled` (via shared status-change function) |

Writable fields: `{ "areaId", "driverId", "destinationId", "destinationCity", "estimatedMiles", "departureDate", "departureTime", "returnDate", "returnTime", "passengers", "purpose", "noteType", "noteText" }`. ReservationRequest object: writable fields plus generated `id`, `requestorUserId` (from session), and `status`. Client-supplied `requestorUserId` and `status` are ignored on write. `destinationId` (catalog mode) and `destinationCity`/`estimatedMiles` (free-text mode) are mutually exclusive; providing both or neither is rejected. `departureTime` and `returnTime` are optional as a pair (both null for whole-day trips, or both present as `HH:mm`). `noteType` and `noteText` are optional as a pair. `passengers` is 1–15. `purpose` is trimmed, nonblank, at most 500 characters. No GET-by-id endpoint exists.

List scope: requestor sees only own requests; area_admin sees only requests for own database `areaId` (empty if null); admin sees all. Maintenance gets 403 for every reservation-request endpoint.

Cancel uses the shared status-change function (Feature 8) so Feature 9 can email on requestor cancels. Cancel does not delete the row.

| Condition | Status | Message |
|-----------|--------|---------|
| No valid session | 401 | `Unauthorized.` |
| Disallowed role or maintenance access | 403 | `Forbidden.` |
| Invalid field, schedule, destination mode, notes, passengers, or purpose | 400 | `Invalid reservation request data.` |
| Route id not a positive safe integer | 400 | `Reservation request id must be a positive integer.` |
| Missing area | 404 | `Area with id=<id> not found.` |
| Missing driver | 404 | `Driver with id=<id> not found.` |
| Missing destination | 404 | `Destination with id=<id> not found.` |
| Missing, non-owned, or non-`requested` target on PUT/cancel | 404 | `Reservation request with id=<id> not found.` |
| Delete of Area/Driver/Destination still referenced by a reservation request | 409 | `Area is in use.` / `Driver is in use.` / `Destination is in use.` |
| Database failure | 500 | `Reservation request failed.` |

## Provenance

| Area | Introduced |
|------|------------|
| Login, current account, logout | Feature 1 |
| Areas list, create, update, delete | Feature 2 |
| Users list, create, update, delete | Feature 3 |
| Vehicles options, list, create, update, delete | Feature 4 |
| Drivers options, list, create, update, delete | Feature 5 |
| Destinations options, list, create, update, delete | Feature 6 |
| Reservation requests list, create, update, cancel | Feature 7 |
