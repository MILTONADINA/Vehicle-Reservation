# Feature: Driver Management

**Feature ID:** 5  
**Branch pattern:** `feature/5-driver-management`  
**Status:** Ready  
**Created:** 2026-10-28  
**Input:** Maintain the list of approved OC drivers with first and last name, license state, license expire date, approved date, and status, separate from User accounts.  
**Depends on:** [Feature 1 — User Authentication & Authorization](feature-1-user-authentication-authorization.md)

---

## User Stories

Every story is P1: each one must ship for the assignment’s Driver Management feature.

### US-5.1: View drivers

**As a** signed-in user  
**I want to** see the driver records I am allowed to read  
**So that** I know who is an approved driver for later reservation work

**Priority:** P1  
**Independent test:** Sign in as each role, list drivers, and verify every signed-in role receives the full sorted list while only admin and area_admin reach the Drivers page.  
**Acceptance scenarios:** see ### US-5.1 under Acceptance Criteria

### US-5.2: Add a driver

**As a** fleet administrator  
**I want to** add a driver with the required license and approval fields  
**So that** the driver can later be chosen on a reservation request

**Priority:** P1  
**Independent test:** Create a valid driver as admin and as area_admin, verify saved fields, and reject requestor and maintenance creates.  
**Acceptance scenarios:** see ### US-5.2 under Acceptance Criteria

### US-5.3: Edit a driver

**As a** fleet administrator  
**I want to** update a driver’s details and status  
**So that** license and approval records stay accurate

**Priority:** P1  
**Independent test:** Update an existing driver and reject invalid fields and disallowed roles.  
**Acceptance scenarios:** see ### US-5.3 under Acceptance Criteria

### US-5.4: Delete a driver

**As a** fleet administrator  
**I want to** remove a driver that is not needed  
**So that** obsolete driver rows leave the list

**Priority:** P1  
**Independent test:** Delete an existing driver as admin or area_admin and reject deletion by requestor and maintenance.  
**Acceptance scenarios:** see ### US-5.4 under Acceptance Criteria

## Requirements

### Functional Requirements

* **FR-001:** Driver management MUST reuse Feature 1 authentication and role checks. It MUST NOT add another sign-in flow or treat a User as an automatic Driver.
* **FR-002:** A driver MUST store firstName, lastName, licenseState, licenseExpireDate, approvedDate, and status. The server MUST generate id. Request-body properties outside those fields MUST be ignored on create and update.
* **FR-003:** firstName and lastName MUST be required nonblank strings after trimming outer spaces, at most 100 characters each, and MUST keep their letter case after trimming.
* **FR-004:** licenseState MUST be a two-letter code from the standard USPS state and DC list in this spec. Values MUST be stored uppercase. Values outside that list MUST return 400.
* **FR-005:** licenseExpireDate and approvedDate MUST be required calendar dates in `YYYY-MM-DD` form. This feature MUST accept past, present, and future dates; it MUST NOT block a driver solely because the license expire date is in the past.
* **FR-006:** status MUST be exactly one of `approved` or `inactive`. Other values MUST return 400.
* **FR-007:** An admin and an area_admin MUST list, create, update, and delete any driver. Requestor and maintenance MUST be able to list drivers and MUST receive the Feature 1 403 response for create, update, and delete. Signed-out requests MUST receive the Feature 1 401 response.
* **FR-008:** Drivers are global. This feature MUST NOT introduce areaId or area filtering on drivers. Area-admin write access does not depend on users.areaId.
* **FR-009:** Driver lists MUST sort by lastName ascending, then firstName ascending, then id ascending. An empty result MUST be 200 with [].
* **FR-010:** PUT MUST replace the editable driver fields while preserving id. Route ids on PUT and DELETE MUST be positive safe integers; invalid ids MUST return 400 and missing drivers MUST return 404.
* **FR-011:** DELETE MUST return 200 with message `Driver deleted.` This feature MUST NOT create reservation tables or refuse deletion based on future reservation links.
* **FR-012:** GET `/vehicle-t6/drivers/options` MUST return the standard license-state list used by the form. Only signed-in roles MAY call it.
* **FR-013:** The Drivers page MUST be available to admin and area_admin only. MenuBar MUST show Drivers for those roles. Signed-out visitors MUST go to Login. Requestor and maintenance MUST be sent Home.
* **FR-014:** Add and Edit MUST use dialogs with the documented fields, Save, and Cancel. License state MUST be a combo box filled from the options endpoint. Status MUST be a combo box of `approved` and `inactive`.
* **FR-015:** Form validation MUST block invalid submissions before a write. Save MUST show progress, block duplicate submission, close on success, and refresh the list. Cancel MUST send no write and MUST discard unsaved values and errors. A failed save MUST keep the dialog values and show the API message or the specified fallback.
* **FR-016:** Deletion MUST use a confirmation dialog. Cancel MUST make no request. Confirming MUST show progress, block duplicate deletion, close and refresh on success, and keep the row and show an error on failure.
* **FR-017:** List loading MUST show progress. `No drivers found.` MUST appear only after a successful empty response. A failed load MUST show the API message or fallback and MUST NOT claim the list is empty.
* **FR-018:** Database failures MUST return 500 `Driver request failed.` without SQL details or partial writes.

## Assumptions

* A Driver is a separate record from a User. Feature 3 does not create drivers when provisioning accounts.
* Drivers are organization-wide. They are not scoped to an Area in this feature.
* Admin and area_admin share the same write access to every driver. Requestor and maintenance may read the list for later Feature 7 selection but do not use the Drivers management page.
* Feature 7 chooses among drivers for a reservation request and may later enforce approved-only or non-expired license rules. This feature stores status and dates without those reservation checks.
* License state uses the fixed USPS state and DC list in this feature. The team does not upload an outside state catalog file.

## Edge Cases

* An expired licenseExpireDate can still be saved; this feature does not auto-set status to inactive.
* Case variants of licenseState are normalized to uppercase and do not create invalid codes when they match a listed state.
* Failed loading does not show `No drivers found.`
* Failed saving or deletion keeps the current record on screen.
* A forged client id does not become the stored primary key.

## Success Criteria

* **SC-001:** Create, list, update, delete, and options match the documented driver contract.
* **SC-002:** Role rules hold for every mapped acceptance case.
* **SC-003:** Invalid fields and unknown license states do not change data.
* **SC-004:** Dialog, loading, empty, error, and role-specific navigation cases have matching frontend tests and a manual check.
* **SC-005:** Every scenario has an exact-name test before merge.

## Data Ownership & Isolation

| Operation | admin | area_admin | requestor / maintenance |
|-----------|-------|------------|-------------------------|
| List | All drivers | All drivers | All drivers |
| Options | Allowed | Allowed | Allowed |
| Create | Allowed | Allowed | 403 |
| Update | Any existing driver | Any existing driver | 403 |
| Delete | Any driver | Any driver | 403 |

Authentication and roles come from [Feature 1](feature-1-user-authentication-authorization.md). No client-supplied role claim expands those permissions. Drivers have no area ownership in this feature.

## Key Entities

* **Driver:** one approved or inactive OC driver record with name, license state, license expire date, approved date, and status. Not a User account.
* **Standard license-state list:** the fixed USPS state and DC combo-box values this feature validates and returns from the options endpoint.

## Standard license-state list

These two-letter codes are the only allowed licenseState values. Store and return them uppercase.

AL, AK, AZ, AR, CA, CO, CT, DE, DC, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN, TX, UT, VT, VA, WA, WV, WI, WY

## API Requirements

All endpoints reuse [Feature 1](feature-1-user-authentication-authorization.md) authentication. No GET-by-id endpoint is introduced.

| Method | Endpoint | Allowed role | Success |
|--------|----------|--------------|---------|
| GET | `/vehicle-t6/drivers/options` | All signed-in roles | `200`, `{ "licenseStates": ["AL", "AK", …] }` |
| GET | `/vehicle-t6/drivers` | All signed-in roles | `200`, array of Driver objects |
| POST | `/vehicle-t6/drivers` | admin, area_admin | `201`, new Driver object |
| PUT | `/vehicle-t6/drivers/:id` | admin, area_admin | `200`, updated Driver object |
| DELETE | `/vehicle-t6/drivers/:id` | admin, area_admin | `200`, `{ "message": "Driver deleted." }` |

POST/PUT body:

```json
{
  "firstName": "Jordan",
  "lastName": "Lee",
  "licenseState": "OK",
  "licenseExpireDate": "2028-06-30",
  "approvedDate": "2026-01-15",
  "status": "approved"
}
```

Driver object: the body fields above plus generated `id`. `licenseState` is returned uppercase. Request-body properties outside those fields are ignored.

| Failure | Status | Message |
|---------|--------|---------|
| No valid session | 401 | Feature 1 `Unauthorized.` |
| Disallowed role for create, update, or delete | 403 | Feature 1 `Forbidden.` |
| Invalid field, date, status, or license state | 400 | `Invalid driver data.` for body fields; `Driver id must be a positive integer.` for a bad route id |
| Missing driver | 404 | `Driver with id=<id> not found.` |
| Other database failure | 500 | `Driver request failed.` |

## Screen Requirements

* `/drivers`, route name `drivers`, heading **Drivers**. MenuBar shows **Drivers** for admin and area_admin only. Signed-out users follow Feature 1 Login redirect. Requestor and maintenance are sent Home.
* List columns: **First name**, **Last name**, **License state**, **License expires**, **Approved**, **Status**, and permitted **Actions**. The page uses only server-returned records.
* Admin and area_admin see **Add driver**, **Edit**, and **Delete**.
* Add/edit dialogs: **Add driver** or **Edit driver**; fields **First name**, **Last name**, **License state**, **License expire date**, **Approved date**, and **Status**; buttons **Save** and **Cancel**. License state is a combo box from `/drivers/options`. Status is a combo box of `approved` and `inactive`. Edit starts with the chosen row’s values. The client applies the same validity rules and uses `Invalid driver data.` when invalid.
* A pending save shows progress and disables repeated Save. Success closes the dialog and reloads the list. Failure keeps the values and shows the API message or `Driver could not be saved.`. Cancel sends no write and discards values and errors.
* **Delete driver** confirmation asks `Delete this driver?` and offers **Delete** and **Cancel**. Pending deletion suppresses resubmission. Failure keeps the dialog and row and shows the API message or `Driver could not be deleted.`; success closes it and refreshes the list.
* The list shows progress while loading and `No drivers found.` only after a successful empty result. Load failure shows the API message or `Drivers could not be loaded.` and no empty-state message.

## Data Model Requirements

Add `drivers`:

| Field | Type | Rule |
|-------|------|------|
| id | Integer | Auto-generated primary key |
| firstName | String(100) | Required; trimmed; nonblank; case kept |
| lastName | String(100) | Required; trimmed; nonblank; case kept |
| licenseState | String(2) | Required; uppercase USPS state or DC code from the standard list |
| licenseExpireDate | Date only | Required; `YYYY-MM-DD` |
| approvedDate | Date only | Required; `YYYY-MM-DD` |
| status | String(20) | Required; `approved` or `inactive` |

Register the Driver model in `models/index.js`. This feature does not add a foreign key to users, areas, vehicles, or reservations.

## Acceptance Criteria (Gherkin)

### US-5.1 — View drivers

#### Scenario: Admin lists every driver in name order
* **Given** drivers Jordan Lee and Avery Smith exist
* **When** an admin requests GET /vehicle-t6/drivers
* **Then** both drivers are returned sorted by lastName, then firstName, then id

#### Scenario: Area admin lists every driver
* **Given** drivers exist and the signed-in role is area_admin
* **When** that user lists drivers
* **Then** the response is 200 with every driver in the same sort order

#### Scenario: Requestor and maintenance can read the driver list
* **Given** drivers exist and the signed-in role is requestor or maintenance
* **When** each role lists drivers
* **Then** each response is 200 with every driver and no write permission is granted

#### Scenario: Empty driver list is returned
* **Given** there are no drivers
* **When** an admin lists drivers
* **Then** the response is 200 with []

#### Scenario: Driver API requires a session
* **Given** no valid application session is supplied
* **When** GET, POST, PUT, or DELETE is sent to an applicable driver route
* **Then** each response is 401 with the Feature 1 Unauthorized. message and nothing changes

#### Scenario: Options returns the standard license-state list
* **Given** a signed-in user of any role
* **When** GET /vehicle-t6/drivers/options is sent
* **Then** the response is 200 with the documented licenseStates values

#### Scenario: Drivers page shows allowed records and actions
* **Given** GET /drivers returns drivers
* **When** an admin or area_admin opens /drivers from MenuBar
* **Then** each driver appears with first name, last name, license state, license expire date, approved date, and status, and Add driver, Edit, and Delete are available

#### Scenario: Drivers navigation requires an allowed role
* **Given** a signed-out visitor opens /drivers
* **When** the Feature 1 route guard runs
* **Then** the visitor reaches /login and no driver records appear

#### Scenario: Requestor and maintenance are sent Home from Drivers
* **Given** a requestor or maintenance user opens /drivers
* **When** the route guard runs
* **Then** the user reaches Home and MenuBar does not show Drivers

#### Scenario: Drivers page distinguishes loading empty and failed states
* **Given** the driver list is pending, then succeeds with []
* **When** the page renders each state
* **Then** progress appears while pending and No drivers found. appears only after success

#### Scenario: Driver list failure does not show an empty list
* **Given** GET /drivers fails with an API message or no response message
* **When** the list request completes
* **Then** the page shows the message or Drivers could not be loaded. and does not show No drivers found.

### US-5.2 — Add a driver

#### Scenario: Admin creates a driver
* **Given** an admin supplies valid Jordan Lee driver fields with licenseState OK and status approved
* **When** POST /vehicle-t6/drivers is sent
* **Then** the response is 201 with generated id and the saved driver fields, including uppercase licenseState

#### Scenario: Area admin creates a driver
* **Given** an area_admin supplies valid driver fields
* **When** POST /vehicle-t6/drivers is sent
* **Then** the response is 201 with the saved driver fields

#### Scenario: Driver string values trim outer spaces
* **Given** an admin surrounds a valid firstName, lastName, and lowercase licenseState ok with spaces
* **When** the driver is created
* **Then** outer spaces are removed, names keep their letter case, and licenseState is stored as OK

#### Scenario: Unknown license state is rejected
* **Given** an admin posts licenseState XX or a non-two-letter value
* **When** POST /vehicle-t6/drivers is sent
* **Then** the response is 400 with message Invalid driver data. and no driver is stored

#### Scenario: Invalid status is rejected
* **Given** an admin posts status pending or an empty status
* **When** POST /vehicle-t6/drivers is sent
* **Then** the response is 400 with message Invalid driver data. and no driver is stored

#### Scenario: Invalid dates are rejected
* **Given** an admin posts a licenseExpireDate or approvedDate that is not YYYY-MM-DD
* **When** POST /vehicle-t6/drivers is sent
* **Then** the response is 400 with message Invalid driver data. and no driver is stored

#### Scenario: Past license expire date can still be saved
* **Given** an admin posts a valid driver whose licenseExpireDate is before today and status is approved
* **When** POST /vehicle-t6/drivers is sent
* **Then** the response is 201 with the saved dates and status unchanged by this feature

#### Scenario: Requestor and maintenance cannot create a driver
* **Given** the signed-in role is requestor or maintenance
* **When** each role posts valid driver data
* **Then** each response is 403 with the Feature 1 Forbidden. message and no driver is created

#### Scenario: Client cannot select a driver primary key
* **Given** an admin sends valid driver data plus id 99 and an unrelated property
* **When** the driver is created
* **Then** the server generates its own id and persists only the allowed driver fields

#### Scenario: Add driver opens the specified form
* **Given** an admin is on Drivers
* **When** the admin selects Add driver
* **Then** the Add driver dialog shows First name, Last name, License state, License expire date, Approved date, Status, Save, and Cancel

#### Scenario: Saving a driver updates the list
* **Given** valid driver fields are entered and POST succeeds
* **When** the admin selects Save
* **Then** the dialog shows progress while pending, suppresses duplicate saves, closes on success, and reloads the list

#### Scenario: Cancel leaves driver records unchanged
* **Given** an add or edit driver dialog contains unsaved changes
* **When** the user selects Cancel
* **Then** the dialog closes without a write request and reopening it shows the correct initial values without the previous error

#### Scenario: Driver form rejects invalid fields before submitting
* **Given** a required driver field is blank or outside the allowed values
* **When** the user selects Save
* **Then** no write request is sent and Invalid driver data. is shown

#### Scenario: Failed driver save keeps the dialog open
* **Given** Save is pressed and the API returns an error message or no message
* **When** the create request finishes
* **Then** the dialog stays open with the entered values and shows the API message or Driver could not be saved.

### US-5.3 — Edit a driver

#### Scenario: Admin updates a driver
* **Given** driver id 1 exists
* **When** an admin sends PUT /vehicle-t6/drivers/1 with valid replacement fields
* **Then** the response is 200 with the updated driver fields and the same id

#### Scenario: Area admin updates a driver
* **Given** driver id 1 exists
* **When** an area_admin sends PUT /vehicle-t6/drivers/1 with valid replacement fields
* **Then** the response is 200 with the updated driver fields

#### Scenario: Admin can set a driver inactive
* **Given** driver id 1 has status approved
* **When** an admin sends PUT with status inactive and otherwise valid fields
* **Then** the response is 200 with status inactive

#### Scenario: Requestor and maintenance cannot update a driver
* **Given** the signed-in role is requestor or maintenance and driver id 1 exists
* **When** each role sends PUT /vehicle-t6/drivers/1
* **Then** each response is 403 with the Feature 1 Forbidden. message and the driver is unchanged

#### Scenario: Updating a missing driver is rejected
* **Given** no driver has id 9999
* **When** an admin sends PUT /vehicle-t6/drivers/9999 with valid fields
* **Then** the response is 404 with message Driver with id=9999 not found.

#### Scenario: Invalid driver route id is rejected
* **Given** an admin is signed in
* **When** PUT or DELETE is sent with route id abc, 0, -1, or an unsafe integer
* **Then** each response is 400 with message Driver id must be a positive integer.

#### Scenario: Edit driver opens with the current values
* **Given** an allowed driver row is shown on Drivers
* **When** the user selects Edit
* **Then** the Edit driver dialog shows that row’s current values, Save, and Cancel

#### Scenario: Saving an edited driver refreshes the list
* **Given** valid edited fields are entered and PUT succeeds
* **When** the user selects Save
* **Then** the dialog shows progress while pending, closes on success, and reloads the list

### US-5.4 — Delete a driver

#### Scenario: Admin deletes a driver
* **Given** driver id 3 exists
* **When** an admin sends DELETE /vehicle-t6/drivers/3
* **Then** the response is 200 with message Driver deleted. and the driver is gone

#### Scenario: Area admin deletes a driver
* **Given** driver id 3 exists
* **When** an area_admin sends DELETE /vehicle-t6/drivers/3
* **Then** the response is 200 with message Driver deleted.

#### Scenario: Requestor and maintenance cannot delete a driver
* **Given** the signed-in role is requestor or maintenance and driver id 3 exists
* **When** each role sends DELETE /vehicle-t6/drivers/3
* **Then** each response is 403 with the Feature 1 Forbidden. message and the driver remains

#### Scenario: Deleting a missing driver is rejected
* **Given** no driver has id 9999
* **When** an admin sends DELETE /vehicle-t6/drivers/9999
* **Then** the response is 404 with message Driver with id=9999 not found.

#### Scenario: Delete driver requires confirmation
* **Given** an allowed driver row is shown on Drivers
* **When** the user selects Delete
* **Then** a Delete driver dialog asks Delete this driver? and offers Delete and Cancel

#### Scenario: Confirmed driver deletion refreshes the list
* **Given** the delete confirmation is open and DELETE succeeds
* **When** the user selects Delete
* **Then** the dialog shows progress while pending, closes on success, and reloads the list

#### Scenario: Failed driver deletion preserves the dialog and row
* **Given** the delete confirmation is open and DELETE fails
* **When** the delete request finishes
* **Then** the dialog and row remain and the page shows the API message or Driver could not be deleted.

#### Scenario: Cancel closes driver delete without a request
* **Given** the delete confirmation is open
* **When** the user selects Cancel
* **Then** no delete request is sent and the driver remains on the list

## Test Coverage Map

Exact `it(...)` titles. Backend file: `backend/tests/drivers.test.js`. Frontend file: `frontend/tests/Drivers.test.js`.

| Story | Scenario | File | Exact test name |
|-------|----------|------|-----------------|
| US-5.1 | Admin lists every driver in name order | `backend/tests/drivers.test.js` | `it("Admin lists every driver in name order")` |
| US-5.1 | Area admin lists every driver | `backend/tests/drivers.test.js` | `it("Area admin lists every driver")` |
| US-5.1 | Requestor and maintenance can read the driver list | `backend/tests/drivers.test.js` | `it("Requestor and maintenance can read the driver list")` |
| US-5.1 | Empty driver list is returned | `backend/tests/drivers.test.js` | `it("Empty driver list is returned")` |
| US-5.1 | Driver API requires a session | `backend/tests/drivers.test.js` | `it("Driver API requires a session")` |
| US-5.1 | Options returns the standard license-state list | `backend/tests/drivers.test.js` | `it("Options returns the standard license-state list")` |
| US-5.1 | Drivers page shows allowed records and actions | `frontend/tests/Drivers.test.js` | `it("Drivers page shows allowed records and actions")` |
| US-5.1 | Drivers navigation requires an allowed role | `frontend/tests/Drivers.test.js` | `it("Drivers navigation requires an allowed role")` |
| US-5.1 | Requestor and maintenance are sent Home from Drivers | `frontend/tests/Drivers.test.js` | `it("Requestor and maintenance are sent Home from Drivers")` |
| US-5.1 | Drivers page distinguishes loading empty and failed states | `frontend/tests/Drivers.test.js` | `it("Drivers page distinguishes loading empty and failed states")` |
| US-5.1 | Driver list failure does not show an empty list | `frontend/tests/Drivers.test.js` | `it("Driver list failure does not show an empty list")` |
| US-5.2 | Admin creates a driver | `backend/tests/drivers.test.js` | `it("Admin creates a driver")` |
| US-5.2 | Area admin creates a driver | `backend/tests/drivers.test.js` | `it("Area admin creates a driver")` |
| US-5.2 | Driver string values trim outer spaces | `backend/tests/drivers.test.js` | `it("Driver string values trim outer spaces")` |
| US-5.2 | Unknown license state is rejected | `backend/tests/drivers.test.js` | `it("Unknown license state is rejected")` |
| US-5.2 | Invalid status is rejected | `backend/tests/drivers.test.js` | `it("Invalid status is rejected")` |
| US-5.2 | Invalid dates are rejected | `backend/tests/drivers.test.js` | `it("Invalid dates are rejected")` |
| US-5.2 | Past license expire date can still be saved | `backend/tests/drivers.test.js` | `it("Past license expire date can still be saved")` |
| US-5.2 | Requestor and maintenance cannot create a driver | `backend/tests/drivers.test.js` | `it("Requestor and maintenance cannot create a driver")` |
| US-5.2 | Client cannot select a driver primary key | `backend/tests/drivers.test.js` | `it("Client cannot select a driver primary key")` |
| US-5.2 | Add driver opens the specified form | `frontend/tests/Drivers.test.js` | `it("Add driver opens the specified form")` |
| US-5.2 | Saving a driver updates the list | `frontend/tests/Drivers.test.js` | `it("Saving a driver updates the list")` |
| US-5.2 | Cancel leaves driver records unchanged | `frontend/tests/Drivers.test.js` | `it("Cancel leaves driver records unchanged")` |
| US-5.2 | Driver form rejects invalid fields before submitting | `frontend/tests/Drivers.test.js` | `it("Driver form rejects invalid fields before submitting")` |
| US-5.2 | Failed driver save keeps the dialog open | `frontend/tests/Drivers.test.js` | `it("Failed driver save keeps the dialog open")` |
| US-5.3 | Admin updates a driver | `backend/tests/drivers.test.js` | `it("Admin updates a driver")` |
| US-5.3 | Area admin updates a driver | `backend/tests/drivers.test.js` | `it("Area admin updates a driver")` |
| US-5.3 | Admin can set a driver inactive | `backend/tests/drivers.test.js` | `it("Admin can set a driver inactive")` |
| US-5.3 | Requestor and maintenance cannot update a driver | `backend/tests/drivers.test.js` | `it("Requestor and maintenance cannot update a driver")` |
| US-5.3 | Updating a missing driver is rejected | `backend/tests/drivers.test.js` | `it("Updating a missing driver is rejected")` |
| US-5.3 | Invalid driver route id is rejected | `backend/tests/drivers.test.js` | `it("Invalid driver route id is rejected")` |
| US-5.3 | Edit driver opens with the current values | `frontend/tests/Drivers.test.js` | `it("Edit driver opens with the current values")` |
| US-5.3 | Saving an edited driver refreshes the list | `frontend/tests/Drivers.test.js` | `it("Saving an edited driver refreshes the list")` |
| US-5.4 | Admin deletes a driver | `backend/tests/drivers.test.js` | `it("Admin deletes a driver")` |
| US-5.4 | Area admin deletes a driver | `backend/tests/drivers.test.js` | `it("Area admin deletes a driver")` |
| US-5.4 | Requestor and maintenance cannot delete a driver | `backend/tests/drivers.test.js` | `it("Requestor and maintenance cannot delete a driver")` |
| US-5.4 | Deleting a missing driver is rejected | `backend/tests/drivers.test.js` | `it("Deleting a missing driver is rejected")` |
| US-5.4 | Delete driver requires confirmation | `frontend/tests/Drivers.test.js` | `it("Delete driver requires confirmation")` |
| US-5.4 | Confirmed driver deletion refreshes the list | `frontend/tests/Drivers.test.js` | `it("Confirmed driver deletion refreshes the list")` |
| US-5.4 | Failed driver deletion preserves the dialog and row | `frontend/tests/Drivers.test.js` | `it("Failed driver deletion preserves the dialog and row")` |
| US-5.4 | Cancel closes driver delete without a request | `frontend/tests/Drivers.test.js` | `it("Cancel closes driver delete without a request")` |

## Agent implementation request

Copy when asking Cursor to implement this feature (`@` this file):

```text
Implement Feature 5 from @features/feature-5-driver-management.md on branch `feature/5-driver-management`.

Follow layer order in @features/framework.md (models → routes → backend tests → frontend → frontend tests).
Map every Gherkin scenario in the Test Coverage Map; run `npm test` before finishing.
If API routes, payloads, schema, or product rules changed per this spec, update @features/reference/api.md, @features/reference/data-model.md, and/or @features/reference/behavior.md in the same PR to match shipped code.
Complete Definition of Done and the merge checklist in @features/framework.md.
Do not implement behavior not in this spec.
```

**Reference updates for this feature:** `api.md`, `data-model.md`, `behavior.md`.

## Definition of Done

* [ ] Backend and frontend implemented per this spec (**FR-001**–**FR-018** satisfied)
* [ ] **Success Criteria (SC-001**–**SC-005)** met
* [ ] All mapped tests pass (`npm test`)
* [ ] Test Coverage Map complete
* [ ] `features/reference/data-model.md` updated (if schema changed)
* [ ] `features/reference/api.md` updated (if API changed)
* [ ] `features/reference/behavior.md` updated (if product rules changed)
* [ ] Agility stories and acceptance tests for Feature 5 are created or updated
* [ ] Application code for this feature is handwritten; automated tests may use AI assistance

## Out of Scope

* Google sign-in and roles: [Feature 1](feature-1-user-authentication-authorization.md).
* Creating or editing User accounts: [Feature 3](feature-3-user-management.md). A User is not automatically a Driver.
* Vehicle fleet records: [Feature 4](feature-4-vehicle-management.md).
* Choosing a driver on a reservation request: [Feature 7 — Reservation Requests in the catalog](README.md#feature-catalog).
* Blocking expired or inactive drivers during request processing: [Feature 7](README.md#feature-catalog) / [Feature 8](README.md#feature-catalog).
* Area assignment for drivers, driver photos, and linking a Driver row to a User login.
