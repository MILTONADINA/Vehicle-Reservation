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

## Areas

| Rule | Enforcement | Introduced |
|------|-------------|------------|
| Every signed-in role reads the complete area list, sorted by `areaName` then `id`; an empty list is `[]` | `area.controller.js` `list` | Feature 2 |
| Only admins create and delete areas; admins update any area; an area admin updates only the area stored on its own account (`users.areaId`), never one chosen by the request; other roles get 403 before any record is read | `area.routes.js` (`requireRole`) and the scope check in `controller.update` | Feature 2 |
| An area admin editing another area, or one with no assignment, gets the same 404 as a missing area | `controller.update` | Feature 2 |
| The three fields are required strings within their limits; outer whitespace is trimmed; `areaLogo` must be an absolute HTTPS URL; `noticeEmail` is reminder text, never validated or lowercased as an address | `validAreaFields()` | Feature 2 |
| Area names are unique ignoring case and surrounding spaces; keeping a record's own name is allowed | `nameTaken()` plus the unique index | Feature 2 |
| Route ids must be positive safe integers; PUT replaces the three fields and keeps the id; a request may not choose an id | `parseAreaId()`, `areaPayload()` | Feature 2 |
| Deleting an area that is still referenced is refused with 409 `Area is in use.`; nothing cascades or is cleared | `onDelete: RESTRICT` and the foreign-key catch in `controller.remove` | Feature 2 |
| Saving reminder text never sends an email; Feature 9 owns email | scope | Feature 2 |

## Areas screen

| Rule | Enforcement | Introduced |
|------|-------------|------------|
| `/areas` (heading **Areas**) is linked from MenuBar for every signed-in role and protected by the Feature 1 guard | `router.js`, `MenuBar.vue` | Feature 2 |
| Columns: Area name, Logo (image with the area name as alt text), Notice email shown as plain text with line breaks, Actions. Admin sees **Add area**, **Edit**, **Delete**; an area admin sees **Edit** only on its assigned row; other roles see no write actions | `views/Areas.vue` | Feature 2 |
| The list shows progress while loading; `No areas found.` appears only after a successful empty response; a failed load shows the API message or `Areas could not be loaded.` | `Areas.vue` `load()` | Feature 2 |
| Add and Edit use one dialog (**Add area** / **Edit area**) with Area name, Logo URL, a multiline Notice email limited to 5,000 characters with the help text `Your area's day-before-trip instructions. Trip details are added automatically.`, **Save** and **Cancel**; the client applies the API's rules and shows `Invalid area data.` without sending a write | `Areas.vue` dialog, `validAreaFields()` | Feature 2 |
| Save shows progress and blocks a second submit; success closes the dialog and reloads the list; failure keeps the values and shows the API message or `Area could not be saved.`; Cancel sends nothing and discards values and errors | `Areas.vue` `save()`, `cancelDialog()` | Feature 2 |
| Delete opens **Delete area** asking `Delete this area?` with **Delete** and **Cancel**; Cancel sends nothing; a pending delete cannot be resubmitted; failure keeps the dialog and row and shows the API message or `Area could not be deleted.`; success closes it and reloads | `Areas.vue` `confirmDelete()` | Feature 2 |

## Users

| Rule | Enforcement | Introduced |
|------|-------------|------------|
| Admin and area admin read every account's public record (id, email, names, role, areaId), sorted by `lastName`, `firstName`, then `id`; `googleSub` and sessions are never returned | `user.controller.js` `publicRecord()`, `list` | Feature 3 |
| Only an admin creates accounts. Both manager roles update and delete, but an area admin may touch only requestor and maintenance accounts and may assign only those two roles (403 otherwise); requestor and maintenance get 403 before any record is read | `user.routes.js` (`requireRole`), `controller.update`, `controller.remove` | Feature 3 |
| An admin cannot change their own role or delete their own account (409 `You cannot remove your own admin access.`) | `controller.update`, `controller.remove` | Feature 3 |
| A provisioned email is trimmed, lowercased, well formed, at most 254 characters, inside `oc.edu` / `eagles.oc.edu`, and unique; email never changes after creation (a PUT body's `email` is ignored) | `normalizedEmail()`, the unique index, `controller.update` | Feature 3 |
| Names are trimmed, nonblank, at most 100 characters; role is one of the four roles; `area_admin` requires an existing area id and every other role requires `areaId: null` | `trimmedName()`, `accessFields()`, `areaExists()` | Feature 3 |
| A created account has `googleSub` null and keeps its id, role, and area when that person first signs in with Google (Feature 1 linking) | `controller.create` | Feature 3 |
| Changing a target's role or area deletes all of that user's sessions in the same transaction as the update, so the old permissions end at once; deleting a user deletes its sessions in the same transaction | `controller.update`, `controller.remove` | Feature 3 |
| PUT replaces names, role, and area; id, email, and `googleSub` never change through this API | `controller.update` | Feature 3 |

## Users screen

| Rule | Enforcement | Introduced |
|------|-------------|------------|
| `/users` (heading **Users**) is linked from MenuBar only for admin and area admin; the route guard sends other signed-in roles Home (`meta.roles`) and signed-out visitors to `/login` | `router.js`, `MenuBar.vue` | Feature 3 |
| Columns: Email, First name, Last name, Role, Area, Actions. Area shows the area name, `Unassigned` for a null assignment, and `Unavailable` when the area list could not be loaded. Admin sees **Add user**, **Edit** on every row, and **Delete** on every row but its own; an area admin sees **Edit** and **Delete** only on requestor and maintenance rows | `views/Users.vue` | Feature 3 |
| Users and areas load together and progress shows until both answer; `No users found.` appears only after a successful empty response; a failed user load shows the API message or `Users could not be loaded.`. A failed area load keeps the loaded users visible, shows the API message or `Area options could not be loaded.`, and disables **Add user** and **Edit** until a reload succeeds (the page, or the reload after a successful save or delete) | `Users.vue` `loadUsers()`, `loadAreas()` | Feature 3 |
| One dialog (**Add user** / **Edit user**) with Email (read-only when editing), First name, Last name, Role, Area, **Save**, **Cancel**. Admin chooses any of the four roles; Area is enabled and required only while the role is `area_admin`, otherwise locked and showing `Unassigned`; an admin's own role control is locked. An area admin's dialog offers only requestor and maintenance and Area stays locked at `Unassigned`. The client applies the API rules (OC-domain email, names, role and area pairing) and shows `Invalid user data.` without sending a write | `Users.vue` `validUserFields()`, `rules` | Feature 3 |
| Save shows progress and blocks a second submit; success closes the dialog and reloads users and areas; failure keeps the values and shows the API message or `User could not be saved.`; Cancel sends nothing and discards values and errors | `Users.vue` `save()`, `cancelDialog()` | Feature 3 |
| Delete opens **Delete user** asking `Delete this user?` with **Delete** and **Cancel**; Cancel sends nothing; a pending delete cannot be resubmitted; failure keeps the dialog and row and shows the API message or `User could not be deleted.`; success closes it and reloads | `Users.vue` `confirmDelete()` | Feature 3 |

## Vehicles

| Rule | Enforcement | Introduced |
|------|-------------|------------|
| Only admin and area_admin may call vehicle endpoints; requestor and maintenance get 403 | `vehicle.routes.js` `requireRole` | Feature 4 |
| Admin lists every vehicle; area_admin lists only vehicles for its current database `areaId`; null assignment yields `[]` | `vehicle.controller.js` `list` / `scopeWhere` | Feature 4 |
| Lists sort by `make`, then `model`, then `id` | `controller.list` | Feature 4 |
| Admin may create/update/delete any vehicle for an existing area; area_admin may only write vehicles for its assigned area; a different body `areaId` is 403; out-of-scope update/delete is the same 404 as missing | controller create/update/remove | Feature 4 |
| Make/model must match the standard lists; VIN is trimmed, uppercased, unique ignoring case; string fields trim outer spaces; year, passengers, plate expire month, and purchased date follow the documented ranges | `validVehicleFields()`, `vinTaken()`, `/vehicles/options` | Feature 4 |
| Route ids must be positive safe integers; PUT replaces the editable fields and keeps `id`; clients cannot choose an id | `parseVehicleId()`, `vehiclePayload()` | Feature 4 |

## Vehicles screen

| Rule | Enforcement | Introduced |
|------|-------------|------------|
| `/vehicles` (heading **Vehicles**) is linked from MenuBar for admin and area_admin only; signed-out visitors go to Login; requestor and maintenance are sent Home | `router.js` `meta.roles`, `MenuBar.vue` | Feature 4 |
| Columns: Make, Model, Year, Color, Passengers, Plate, Plate expires, Parking, Area (Feature 2 name), Actions; Add vehicle, Edit, and Delete are available for the caller's allowed rows | `views/Vehicles.vue` | Feature 4 |
| The list shows progress while loading; `No vehicles found.` appears only after a successful empty response; a failed load shows the API message or `Vehicles could not be loaded.` | `Vehicles.vue` `load()` | Feature 4 |
| Add/Edit dialogs use Make and Model combo boxes from `/vehicles/options`, Area from Feature 2 (fixed for area_admin), Save and Cancel; client validation shows `Invalid vehicle data.` without a write | `Vehicles.vue` | Feature 4 |
| Save shows progress and blocks a second submit; success closes and reloads; failure keeps values and shows the API message or `Vehicle could not be saved.`; Cancel discards values and errors | `Vehicles.vue` `save()`, `cancelDialog()` | Feature 4 |
| Delete asks `Delete this vehicle?`; Cancel sends nothing; pending delete cannot be resubmitted; failure keeps dialog and row and shows the API message or `Vehicle could not be deleted.` | `Vehicles.vue` `confirmDelete()` | Feature 4 |

## Drivers

| Rule | Enforcement | Introduced |
|------|-------------|------------|
| Every signed-in role may list drivers and call `/drivers/options`; only admin and area_admin may create, update, or delete | `driver.routes.js` | Feature 5 |
| Drivers are global with no area filtering; lists sort by `lastName`, then `firstName`, then `id` | `driver.controller.js` `list` | Feature 5 |
| Names trim outer spaces and keep case; `licenseState` is uppercased and must be on the standard USPS/DC list; dates are `YYYY-MM-DD`; status is `approved` or `inactive`; past expire dates may be saved | `validDriverFields()`, `licenseStates.js` | Feature 5 |
| Route ids must be positive safe integers; PUT replaces editable fields and keeps `id`; clients cannot choose an id | `parseDriverId()`, `driverPayload()` | Feature 5 |

## Drivers screen

| Rule | Enforcement | Introduced |
|------|-------------|------------|
| `/drivers` (heading **Drivers**) is linked from MenuBar for admin and area_admin only; signed-out visitors go to Login; requestor and maintenance are sent Home | `router.js` `meta.roles`, `MenuBar.vue` | Feature 5 |
| Columns: First name, Last name, License state, License expires, Approved, Status, Actions; Add driver, Edit, and Delete for managers | `views/Drivers.vue` | Feature 5 |
| Progress while loading; `No drivers found.` only after a successful empty response; failure shows the API message or `Drivers could not be loaded.` | `Drivers.vue` `load()` | Feature 5 |
| Add/Edit dialogs use License state from `/drivers/options`, Status `approved`/`inactive`, Save and Cancel; client validation shows `Invalid driver data.` without a write | `Drivers.vue` | Feature 5 |
| Save shows progress and blocks a second submit; success closes and reloads; failure keeps values and shows the API message or `Driver could not be saved.`; Cancel discards values and errors | `Drivers.vue` `save()`, `cancelDialog()` | Feature 5 |
| Delete asks `Delete this driver?`; Cancel sends nothing; pending delete cannot be resubmitted; failure keeps dialog and row and shows the API message or `Driver could not be deleted.` | `Drivers.vue` `confirmDelete()` | Feature 5 |

## Destinations

| Rule | Enforcement | Introduced |
|------|-------------|------------|
| Every signed-in role may list destinations and call `/destinations/options`; only admin and area_admin may create, update, or delete | `destination.routes.js` | Feature 6 |
| Destinations are global with no area filtering; lists sort by `destinationName`, then `id` | `destination.controller.js` `list` | Feature 6 |
| Names are unique ignoring case; address fields trim outer spaces and keep case; `state` is uppercased and must be on the standard USPS/DC list; `zipCode` is exactly 5 digits; `roundTripMiles` is `(0, 9999.9]` with at most one decimal digit; status is `active` or `inactive` | `validDestinationFields()`, `states.js` | Feature 6 |
| Route ids must be positive safe integers; PUT replaces editable fields and keeps `id`; clients cannot choose an id | `parseDestinationId()`, `destinationPayload()` | Feature 6 |

## Destinations screen

| Rule | Enforcement | Introduced |
|------|-------------|------------|
| `/destinations` (heading **Destinations**) is linked from MenuBar for admin and area_admin only; signed-out visitors go to Login; requestor and maintenance are sent Home | `router.js` `meta.roles`, `MenuBar.vue` | Feature 6 |
| Columns: Name, Address, City, State, Zip, Round-trip miles, Status, Actions; Add destination, Edit, and Delete for managers | `views/Destinations.vue` | Feature 6 |
| Progress while loading; `No destinations found.` only after a successful empty response; failure shows the API message or `Destinations could not be loaded.` | `Destinations.vue` `load()` | Feature 6 |
| Add/Edit dialogs use State from `/destinations/options`, Status `active`/`inactive`, Save and Cancel; client validation shows `Invalid destination data.` without a write | `Destinations.vue` | Feature 6 |
| Save shows progress and blocks a second submit; success closes and reloads; failure keeps values and shows the API message or `Destination could not be saved.`; Cancel discards values and errors | `Destinations.vue` `save()`, `cancelDialog()` | Feature 6 |
| Delete asks `Delete this destination?`; Cancel sends nothing; pending delete cannot be resubmitted; failure keeps dialog and row and shows the API message or `Destination could not be deleted.` | `Destinations.vue` `confirmDelete()` | Feature 6 |

## Reservation requests

| Rule | Enforcement | Introduced |
|------|-------------|------------|
| Only requestor, admin, and area_admin may access reservation-request endpoints; maintenance gets 403 | `reservationRequest.routes.js` `requireRole` | Feature 7 |
| List scope: requestor sees only own requests (`requestorUserId = session user`); area_admin sees only requests for own database `areaId` (empty `[]` if null); admin sees all; sorted by `departureDate` ASC, `departureTime` ASC (nulls first), then `id` ASC | `reservationRequest.controller.js` `list` | Feature 7 |
| Only requestor may create, update, or cancel; admin and area_admin get 403 for POST, PUT, and cancel | `reservationRequest.routes.js` `requireRole("requestor")` | Feature 7 |
| Create sets `requestorUserId` from the session and `status` to `requested`; client-supplied values for both are ignored | `controller.create` | Feature 7 |
| Update and cancel are allowed only for the requestor's own `requested` rows; non-owned or non-requested targets return 404 without revealing other users' data | `controller.update`, `controller.cancel` | Feature 7 |
| Cancel uses the shared status-change function (`changeReservationRequestStatus`) defined in Feature 8, so it also saves the Feature 9 status email; the row is kept with status `cancelled` | `controller.cancel` calls `changeReservationRequestStatus(id, "cancelled", ...)` | Feature 7 |
| Destination mode: exactly one of (a) catalog `destinationId` with null `destinationCity`/`estimatedMiles`, or (b) free-text `destinationCity`/`estimatedMiles` with null `destinationId`; mixed or absent is 400 | `validateWritableFields()` | Feature 7 |
| Catalog destination must be `active`; driver must be `approved`; area must exist; inactive/missing references are rejected | `validateWritableFields()` | Feature 7 |
| Schedule: dates required `YYYY-MM-DD`; times optional as a pair (both null for whole-day, both present as `HH:mm` for timed); whole-day requires `returnDate >= departureDate`; timed requires combined return strictly after combined departure | `validateWritableFields()` | Feature 7 |
| Passengers 1–15; purpose trimmed nonblank ≤ 500 chars; notes optional pair (`noteType` + `noteText`); noteType in `general`, `special_instructions`, `other`; noteText trimmed nonblank ≤ 1000 chars | `validateWritableFields()` | Feature 7 |
| Route ids must be positive safe integers; PUT replaces writable fields and keeps `id`, `requestorUserId`, `status` | `controller.update` | Feature 7 |
| Foreign keys from `reservation_requests` to users, areas, drivers, and destinations use `ON DELETE RESTRICT`; deleting a referenced record returns 409 `Area is in use.` / `Driver is in use.` / `Destination is in use.` | `models/index.js` associations | Feature 7 |
| Status-change endpoint PUT `/reservation-requests/:id/status` accepts `{ status, vehicleId, statusReason }` for admin/area_admin; transitions: requested→awaiting_vehicle/reserved/cancelled, awaiting_vehicle→reserved/cancelled, reserved→returned/cancelled; all other transitions return 400 | `reservationRequest.controller.js` `changeStatus`, `changeReservationRequestStatus()` | Feature 8 |
| Candidate vehicles GET `/reservation-requests/:id/candidate-vehicles` returns qualifying vehicles (same area, passengers ≥ request, no time overlap with reserved/returned assignments); sorted by make, model, id; only for requested/awaiting_vehicle status | `reservationRequest.controller.js` `candidateVehicles` | Feature 8 |
| Area_admin scoping: candidate-vehicles and status-change are limited to requests and vehicles in the admin's own areaId; out-of-scope requests return 404 | `controller.candidateVehicles`, `controller.changeStatus` | Feature 8 |
| Moving to `reserved` sets vehicleId (must be valid candidate); moving to `returned` keeps existing vehicleId; moving to `cancelled` clears vehicleId and may store statusReason (trimmed, ≤ 500 chars); moving to `awaiting_vehicle` keeps vehicleId null | `changeReservationRequestStatus()` | Feature 8 |
| Reserve candidate check and status write run in one transaction that locks the reservation-request row and the chosen vehicle row (`LOCK.UPDATE`) so concurrent reserves cannot double-book; a vehicle that ceases to be a candidate returns 400 | `controller.changeStatus` reserved branch | Feature 8 |
| Foreign key from `reservation_requests.vehicleId` to `vehicles.id` uses `ON DELETE RESTRICT`; deleting a vehicle referenced by a reserved/returned request returns 409 `Vehicle is in use.` | `models/index.js` associations | Feature 8 |

## Reservation requests screen

| Rule | Enforcement | Introduced |
|------|-------------|------------|
| `/reservation-requests` (heading **Reservation requests**) is linked from MenuBar (**Requests**) for requestor, admin, and area_admin; signed-out visitors go to Login; maintenance is sent Home | `router.js` `meta.roles`, `MenuBar.vue` | Feature 7 |
| Columns: Departure, Return, Area, Driver, Destination, Miles, Passengers, Purpose, Notes, Status, Vehicle, Status reason, Actions; Destination shows `destinationName` (catalog) or `destinationCity` (free-text); Miles shows `roundTripMiles` (catalog) or `estimatedMiles` (free-text); Area and Driver names resolved client-side from loaded catalogs; Vehicle shows `vehicleId`; Status reason shows `statusReason` | `views/ReservationRequests.vue` | Feature 7, Feature 8 |
| Requestor sees **Add request** and **Edit** / **Cancel** on own `requested` rows only; admin and area_admin see status-change actions on in-scope rows | `ReservationRequests.vue` `isRequestor`, `isProcessor` computed | Feature 7, Feature 8 |
| Progress while loading; `No reservation requests found.` only after a successful empty response; failure shows the API message or `Reservation requests could not be loaded.` | `ReservationRequests.vue` `load()` | Feature 7 |
| Add/Edit dialog includes Area (from Feature 2 areas), Driver (approved only from Feature 5), destination mode (catalog active destinations from Feature 6, or free-text city + estimated miles), departure/return date and optional time, passengers, purpose, optional note type and text, Save and Cancel | `ReservationRequests.vue` dialog | Feature 7 |
| Client validation mirrors backend rules; invalid fields show `Invalid reservation request data.` without a write | `ReservationRequests.vue` `validRequestFields()` | Feature 7 |
| Save shows progress and blocks duplicate submission; success closes dialog and reloads; failure keeps values and shows the API message or `Reservation request could not be saved.`; Cancel discards values and errors | `ReservationRequests.vue` `save()`, `cancelDialog()` | Feature 7 |
| Cancel confirmation asks `Cancel this reservation request?` with **Cancel request** and **Keep**; Keep sends nothing; confirming shows progress, blocks duplicate, closes on success and reloads; failure keeps dialog and shows the API message or `Reservation request could not be canceled.` | `ReservationRequests.vue` `confirmCancel()`, `keepCancel()` | Feature 7 |
| Admin/area_admin see **Change status** on rows with allowed transitions and **Mark returned** on reserved rows; requestor sees no processing actions | `ReservationRequests.vue` `isProcessor`, `allowedTransitions()` | Feature 8 |
| Status-change dialog collects next status (from allowed transitions), Vehicle combo (from candidate-vehicles when choosing Reserved), and optional Status reason (when choosing Cancelled); shows progress; blocks duplicate submit; closes and refreshes on success; keeps values and shows API message or `Reservation request could not be updated.` on failure; Cancel sends no write | `ReservationRequests.vue` `statusDialog`, `saveStatus()`, `cancelStatusDialog()` | Feature 8 |
| Selecting Reserved in the status-change dialog loads candidate vehicles via `getCandidateVehicles(id)` into the Vehicle combo | `ReservationRequests.vue` `watch` on `statusDialog.form.status`, `loadCandidates()` | Feature 8 |
| Admin alone sees **Send now** beside the heading; while pending it shows progress and blocks repeat clicks; success shows Queued, Sent, Retry scheduled, Failed, and Skipped counts (zeros included); a 500 or network failure shows the API message or `Emails could not be processed.` and re-enables the button; 401/403 keep the app-wide handling; the request list is not reloaded or changed | `ReservationRequests.vue` `sendDueEmails()`, `reservationEmailServices.js` | Feature 9 |

## Reservation emails

| Rule | Enforcement | Introduced |
|------|-------------|------------|
| Every committed status change (Feature 8 endpoint and Feature 7 requestor cancel) saves one pending `status_change` job in the same transaction; a failed insert rolls back the status and vehicle change and returns 500 `Reservation request failed.`; creation, ordinary edits, and rejected or same-status changes save none | `changeReservationRequestStatus()` (own transaction and row lock when the caller has none), `statusEmail.js` | Feature 9 |
| The recipient is always the request's stored requestor (`users.email` via `requestorUserId`); client recipient, cc, and bcc fields are ignored; no CC, BCC, HTML, or attachments | `statusEmail.js`, `emailCycle.js` | Feature 9 |
| Status message: subject `Reservation #<id> — <new label>`; body lines Reservation, `Status changed: <old> -> <new>`, `Changed at: <UTC ISO>`, Area, Departure, Return (`HH:mm` or `Whole day`, `(America/Chicago)`), Vehicle (or `Vehicle: Not assigned`), and `Reason:` only for a cancellation with a reason; the snapshot is frozen when saved | `messages.js` `statusChangeMessage()` | Feature 9 |
| Pickup reminders: only `reserved` requests with a vehicle whose departureDate is the next America/Chicago calendar date, prepared from 09:00 local until midnight on the day before; later scans in that window catch up; one job per request and departure date | `emailCycle.js` `prepareReminders()`, `campusClock.js` | Feature 9 |
| Reminder message: the request area's `noticeEmail` unchanged, a blank line, then Reservation, Area, Departure, Return, Vehicle, `Pickup parking`, `Passengers`, and `Purpose`; area and vehicle values are snapshotted when the job is first saved | `messages.js` `pickupReminderMessage()` | Feature 9 |
| Dispatch: due `pending` jobs are claimed under row locks (request row first for reminders), recording the attempt and a retry time five minutes later before SMTP; a reminder whose trip is no longer reserved with a vehicle or is outside its window becomes `skipped`; acceptance marks `sent` with `sentAt`; the third failure marks `failed`; a final attempt whose outcome was never recorded (process stopped) is marked `failed` once its claim expires; each submission times out after 2 minutes (SMTP stage timeouts 30–60 s), inside the five-minute claim, so a slow provider cannot cause a second concurrent submission; one failure does not stop the batch | `emailCycle.js` `claimJob()`, `dispatchDue()`, `emailConfig.js` `smtpTransportOptions()` | Feature 9 |
| One node-cron job (`* * * * *`, America/Chicago) per backend process runs the same cycle as Send now; tests never start it | `server.js`, `emailSchedule.js` `registerEmailSchedule()` | Feature 9 |
| SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM`, and the `SMTP_USER`/`SMTP_PASSWORD` pair) are read from the environment on every run; missing or invalid values log `EMAIL_CONFIGURATION_INVALID` and skip the run without touching jobs; other scheduled failures log `EMAIL_RUN_FAILED`; neither stops the server | `emailConfig.js` `readSmtpConfig()`, `emailSchedule.js` `runScheduledCycle()` | Feature 9 |
| Email logs carry only fixed codes, job ids, states, attempts, and counts; never recipients, bodies, credentials, or provider errors | `emailCycle.js`, `emailSchedule.js`, `reservationEmail.controller.js` | Feature 9 |
| Only admin may POST `/reservation-emails/send-now`; body and query are ignored | `reservationEmail.routes.js` `requireRole("admin")` | Feature 9 |

