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

