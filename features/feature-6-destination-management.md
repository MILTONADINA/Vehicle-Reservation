# Feature: Destination Management

**Feature ID:** 6  
**Branch pattern:** `feature/6-destination-management`  
**Status:** Ready  
**Created:** 2026-10-28  
**Input:** Maintain the list of trip destinations with a name, street address, city, state, zip code, round-trip miles, and active or inactive status so reservation requests can choose where a vehicle is going and estimate mileage.  
**Depends on:** [Feature 1 — User Authentication & Authorization](feature-1-user-authentication-authorization.md)

---

## User Stories

Every story is P1: each one must ship for the assignment’s Destination Management feature.

### US-6.1: View destinations

**As a** signed-in user  
**I want to** see the destination records I am allowed to read  
**So that** I know which places can be used on a reservation request

**Priority:** P1  
**Independent test:** Sign in as each role, list destinations, and verify every signed-in role receives the full sorted list while only admin and area_admin reach the Destinations page.  
**Acceptance scenarios:** see ### US-6.1 under Acceptance Criteria

### US-6.2: Add a destination

**As a** fleet administrator  
**I want to** add a destination with the required address fields, round-trip miles, and status  
**So that** requestors can later choose that place on a reservation request

**Priority:** P1  
**Independent test:** Create a valid destination as admin and as area_admin, verify saved fields and uniqueness, and reject requestor and maintenance creates.  
**Acceptance scenarios:** see ### US-6.2 under Acceptance Criteria

### US-6.3: Edit a destination

**As a** fleet administrator  
**I want to** update a destination’s details and status  
**So that** trip destination records stay accurate

**Priority:** P1  
**Independent test:** Update an existing destination and reject invalid fields, duplicate names, and disallowed roles.  
**Acceptance scenarios:** see ### US-6.3 under Acceptance Criteria

### US-6.4: Delete a destination

**As a** fleet administrator  
**I want to** remove a destination that is not needed  
**So that** obsolete places leave the destination list

**Priority:** P1  
**Independent test:** Delete an existing destination as admin or area_admin and reject deletion by requestor and maintenance.  
**Acceptance scenarios:** see ### US-6.4 under Acceptance Criteria

## Requirements

### Functional Requirements

* **FR-001:** Destination management MUST reuse Feature 1 authentication and role checks. It MUST NOT add another sign-in flow.
* **FR-002:** A destination MUST store destinationName, addressLine, city, state, zipCode, roundTripMiles, and status. The server MUST generate id. Request-body properties outside those fields MUST be ignored on create and update.
* **FR-003:** destinationName MUST be a required nonblank string after trimming outer spaces, at most 100 characters, unique ignoring case and surrounding spaces, and MUST keep its letter case after trimming. A duplicate create or update MUST return 409 without changing data; keeping the same name on the same record MUST be allowed.
* **FR-004:** addressLine and city MUST be required nonblank strings after trimming outer spaces, at most 200 and 100 characters respectively, and MUST keep their letter case after trimming.
* **FR-005:** state MUST be a two-letter code from the standard USPS state and DC list in this spec. Values MUST be stored uppercase. Values outside that list MUST return 400.
* **FR-006:** zipCode MUST be a required string of exactly 5 digits after trimming outer spaces. Other shapes MUST return 400.
* **FR-007:** roundTripMiles MUST be a required number greater than 0 and at most 9999.9, with at most one digit after the decimal point. It is the stored round-trip mileage estimate used when a reservation selects this destination. Invalid values MUST return 400.
* **FR-008:** status MUST be exactly one of `active` or `inactive`. Other values MUST return 400.
* **FR-009:** An admin and an area_admin MUST list, create, update, and delete any destination. Requestor and maintenance MUST be able to list destinations and MUST receive the Feature 1 403 response for create, update, and delete. Signed-out requests MUST receive the Feature 1 401 response.
* **FR-010:** Destinations are global. This feature MUST NOT introduce areaId or area filtering on destinations. Area-admin write access does not depend on users.areaId.
* **FR-011:** Destination lists MUST sort by destinationName ascending, then id ascending. An empty result MUST be 200 with [].
* **FR-012:** PUT MUST replace the editable destination fields while preserving id. Route ids on PUT and DELETE MUST be positive safe integers; invalid ids MUST return 400 and missing destinations MUST return 404.
* **FR-013:** DELETE MUST return 200 with message `Destination deleted.` This feature MUST NOT create reservation tables. When a later feature references Destination with ON DELETE RESTRICT, that later feature owns the 409 in-use test.
* **FR-014:** GET `/vehicle-t6/destinations/options` MUST return the standard state list used by the form. Only signed-in roles MAY call it.
* **FR-015:** The Destinations page MUST be available to admin and area_admin only. MenuBar MUST show Destinations for those roles. Signed-out visitors MUST go to Login. Requestor and maintenance MUST be sent Home.
* **FR-016:** Add and Edit MUST use dialogs with the documented fields, Save, and Cancel. State MUST be a combo box filled from the options endpoint. Status MUST be a combo box of `active` and `inactive`. Round-trip miles MUST be a numeric field.
* **FR-017:** Form validation MUST block invalid submissions before a write. Save MUST show progress, block duplicate submission, close on success, and refresh the list. Cancel MUST send no write and MUST discard unsaved values and errors. A failed save MUST keep the dialog values and show the API message or the specified fallback.
* **FR-018:** Deletion MUST use a confirmation dialog. Cancel MUST make no request. Confirming MUST show progress, block duplicate deletion, close and refresh on success, and keep the row and show an error on failure.
* **FR-019:** List loading MUST show progress. `No destinations found.` MUST appear only after a successful empty response. A failed load MUST show the API message or fallback and MUST NOT claim the list is empty.
* **FR-020:** Database failures MUST return 500 `Destination request failed.` without SQL details or partial writes.

## Assumptions

* Destinations are organization-wide place records for later Feature 7 reservation requests. They are not scoped to an Area in this feature.
* Admin and area_admin share the same write access to every destination. Requestor and maintenance may read the list for later Feature 7 selection but do not use the Destinations management page.
* Feature 7 chooses among destinations for a reservation request and may later enforce active-only rules. This feature stores status without those reservation checks.
* roundTripMiles is the catalog mileage estimate for a destination. Feature 7 may also allow a free-text city with typed mileage when no catalog destination is used.
* State uses the fixed USPS state and DC list in this feature. The team does not upload an outside state catalog file.
* Zip codes are US 5-digit postal codes only in this feature (no ZIP+4).

## Edge Cases

* Case variants and whitespace do not bypass destination-name uniqueness.
* Case variants of state are normalized to uppercase and do not create invalid codes when they match a listed state.
* Failed loading does not show `No destinations found.`
* Failed saving or deletion keeps the current record on screen.
* A forged client id does not become the stored primary key.

## Success Criteria

* **SC-001:** Create, list, update, delete, and options match the documented destination contract, including roundTripMiles.
* **SC-002:** Role rules hold for every mapped acceptance case.
* **SC-003:** Invalid fields, unknown states, and duplicate names do not change data.
* **SC-004:** Dialog, loading, empty, error, and role-specific navigation cases have matching frontend tests and a manual check.
* **SC-005:** Every scenario has an exact-name test before merge.

## Data Ownership & Isolation

| Operation | admin | area_admin | requestor / maintenance |
|-----------|-------|------------|-------------------------|
| List | All destinations | All destinations | All destinations |
| Options | Allowed | Allowed | Allowed |
| Create | Allowed | Allowed | 403 |
| Update | Any existing destination | Any existing destination | 403 |
| Delete | Any destination | Any destination | 403 |

Authentication and roles come from [Feature 1](feature-1-user-authentication-authorization.md). No client-supplied role claim expands those permissions. Destinations have no area ownership in this feature.

## Key Entities

* **Destination:** one active or inactive trip place with a unique name, a US street address (line, city, state, zip), and a round-trip mileage estimate.
* **Standard state list:** the fixed USPS state and DC combo-box values this feature validates and returns from the options endpoint.

## Standard state list

These two-letter codes are the only allowed state values. Store and return them uppercase.

AL, AK, AZ, AR, CA, CO, CT, DE, DC, FL, GA, HI, ID, IL, IN, IA, KS, KY, LA, ME, MD, MA, MI, MN, MS, MO, MT, NE, NV, NH, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN, TX, UT, VT, VA, WA, WV, WI, WY

## API Requirements

All endpoints reuse [Feature 1](feature-1-user-authentication-authorization.md) authentication. No GET-by-id endpoint is introduced.

| Method | Endpoint | Allowed role | Success |
|--------|----------|--------------|---------|
| GET | `/vehicle-t6/destinations/options` | All signed-in roles | `200`, `{ "states": ["AL", "AK", …] }` |
| GET | `/vehicle-t6/destinations` | All signed-in roles | `200`, array of Destination objects |
| POST | `/vehicle-t6/destinations` | admin, area_admin | `201`, new Destination object |
| PUT | `/vehicle-t6/destinations/:id` | admin, area_admin | `200`, updated Destination object |
| DELETE | `/vehicle-t6/destinations/:id` | admin, area_admin | `200`, `{ "message": "Destination deleted." }` |

POST/PUT body:

```json
{
  "destinationName": "Oklahoma City Airport",
  "addressLine": "7100 Terminal Drive",
  "city": "Oklahoma City",
  "state": "OK",
  "zipCode": "73159",
  "roundTripMiles": 120.5,
  "status": "active"
}
```

Destination object: the body fields above plus generated `id`. `state` is returned uppercase. Request-body properties outside those fields are ignored.

| Failure | Status | Message |
|---------|--------|---------|
| No valid session | 401 | Feature 1 `Unauthorized.` |
| Disallowed role for create, update, or delete | 403 | Feature 1 `Forbidden.` |
| Invalid field, zip, round-trip miles, status, or state | 400 | `Invalid destination data.` for body fields; `Destination id must be a positive integer.` for a bad route id |
| Missing destination | 404 | `Destination with id=<id> not found.` |
| Duplicate destination name | 409 | `Destination name is already in use.` |
| Other database failure | 500 | `Destination request failed.` |

## Screen Requirements

* `/destinations`, route name `destinations`, heading **Destinations**. MenuBar shows **Destinations** for admin and area_admin only. Signed-out users follow Feature 1 Login redirect. Requestor and maintenance are sent Home.
* List columns: **Name**, **Address**, **City**, **State**, **Zip**, **Round-trip miles**, **Status**, and permitted **Actions**. The page uses only server-returned records.
* Admin and area_admin see **Add destination**, **Edit**, and **Delete**.
* Add/edit dialogs: **Add destination** or **Edit destination**; fields **Name**, **Address**, **City**, **State**, **Zip**, **Round-trip miles**, and **Status**; buttons **Save** and **Cancel**. State is a combo box from `/destinations/options`. Status is a combo box of `active` and `inactive`. Edit starts with the chosen row’s values. The client applies the same validity rules and uses `Invalid destination data.` when invalid.
* A pending save shows progress and disables repeated Save. Success closes the dialog and reloads the list. Failure keeps the values and shows the API message or `Destination could not be saved.`. Cancel sends no write and discards values and errors.
* **Delete destination** confirmation asks `Delete this destination?` and offers **Delete** and **Cancel**. Pending deletion suppresses resubmission. Failure keeps the dialog and row and shows the API message or `Destination could not be deleted.`; success closes it and refreshes the list.
* The list shows progress while loading and `No destinations found.` only after a successful empty result. Load failure shows the API message or `Destinations could not be loaded.` and no empty-state message.

## Data Model Requirements

Add `destinations`:

| Field | Type | Rule |
|-------|------|------|
| id | Integer | Auto-generated primary key |
| destinationName | String(100) | Required; trimmed; nonblank; unique with case-insensitive comparison; case kept |
| addressLine | String(200) | Required; trimmed; nonblank; case kept |
| city | String(100) | Required; trimmed; nonblank; case kept |
| state | String(2) | Required; uppercase USPS state or DC code from the standard list |
| zipCode | String(5) | Required; trimmed; exactly 5 digits |
| roundTripMiles | Decimal(6,1) | Required; greater than 0 and at most 9999.9; at most one decimal digit |
| status | String(20) | Required; `active` or `inactive` |

Register the Destination model in `models/index.js`. This feature does not add a foreign key to users, areas, vehicles, drivers, or reservations.

## Acceptance Criteria (Gherkin)

### US-6.1 — View destinations

#### Scenario: Admin lists every destination in name order
* **Given** destinations Oklahoma City Airport and Tulsa Downtown exist
* **When** an admin requests GET /vehicle-t6/destinations
* **Then** both destinations are returned sorted by destinationName, then id

#### Scenario: Area admin lists every destination
* **Given** destinations exist and the signed-in role is area_admin
* **When** that user lists destinations
* **Then** the response is 200 with every destination in the same sort order

#### Scenario: Requestor and maintenance can read the destination list
* **Given** destinations exist and the signed-in role is requestor or maintenance
* **When** each role lists destinations
* **Then** each response is 200 with every destination and no write permission is granted

#### Scenario: Empty destination list is returned
* **Given** there are no destinations
* **When** an admin lists destinations
* **Then** the response is 200 with []

#### Scenario: Destination API requires a session
* **Given** no valid application session is supplied
* **When** GET, POST, PUT, or DELETE is sent to an applicable destination route
* **Then** each response is 401 with the Feature 1 Unauthorized. message and nothing changes

#### Scenario: Options returns the standard state list
* **Given** a signed-in user of any role
* **When** GET /vehicle-t6/destinations/options is sent
* **Then** the response is 200 with the documented states values

#### Scenario: Destinations page shows allowed records and actions
* **Given** GET /destinations returns destinations
* **When** an admin or area_admin opens /destinations from MenuBar
* **Then** each destination appears with name, address, city, state, zip, round-trip miles, and status, and Add destination, Edit, and Delete are available

#### Scenario: Destinations navigation requires an allowed role
* **Given** a signed-out visitor opens /destinations
* **When** the Feature 1 route guard runs
* **Then** the visitor reaches /login and no destination records appear

#### Scenario: Requestor and maintenance are sent Home from Destinations
* **Given** a requestor or maintenance user opens /destinations
* **When** the route guard runs
* **Then** the user reaches Home and MenuBar does not show Destinations

#### Scenario: Destinations page distinguishes loading empty and failed states
* **Given** the destination list is pending, then succeeds with []
* **When** the page renders each state
* **Then** progress appears while pending and No destinations found. appears only after success

#### Scenario: Destination list failure does not show an empty list
* **Given** GET /destinations fails with an API message or no response message
* **When** the list request completes
* **Then** the page shows the message or Destinations could not be loaded. and does not show No destinations found.

### US-6.2 — Add a destination

#### Scenario: Admin creates a destination
* **Given** an admin supplies valid Oklahoma City Airport fields with state OK, roundTripMiles 120.5, and status active
* **When** POST /vehicle-t6/destinations is sent
* **Then** the response is 201 with generated id and the saved destination fields, including uppercase state and roundTripMiles 120.5

#### Scenario: Area admin creates a destination
* **Given** an area_admin supplies valid destination fields
* **When** POST /vehicle-t6/destinations is sent
* **Then** the response is 201 with the saved destination fields

#### Scenario: Destination values trim outer spaces
* **Given** an admin surrounds a valid destinationName, addressLine, city, zipCode, and lowercase state ok with spaces
* **When** the destination is created
* **Then** outer spaces are removed, names and address fields keep their letter case, and state is stored as OK

#### Scenario: Duplicate destination name is rejected
* **Given** a destination named Oklahoma City Airport exists
* **When** an admin creates another destination with the same name in different letter case
* **Then** the response is 409 with message Destination name is already in use. and no extra destination is stored

#### Scenario: Unknown state is rejected
* **Given** an admin posts state XX or a non-two-letter value
* **When** POST /vehicle-t6/destinations is sent
* **Then** the response is 400 with message Invalid destination data. and no destination is stored

#### Scenario: Invalid zip code is rejected
* **Given** an admin posts zipCode 7315, 731590, or 73A59
* **When** POST /vehicle-t6/destinations is sent
* **Then** the response is 400 with message Invalid destination data. and no destination is stored

#### Scenario: Invalid destination status is rejected
* **Given** an admin posts status pending or an empty status
* **When** POST /vehicle-t6/destinations is sent
* **Then** the response is 400 with message Invalid destination data. and no destination is stored

#### Scenario: Invalid destination round-trip miles are rejected
* **Given** an admin posts roundTripMiles 0, -1, 10000, or 12.34
* **When** POST /vehicle-t6/destinations is sent
* **Then** the response is 400 with message Invalid destination data. and no destination is stored

#### Scenario: Requestor and maintenance cannot create a destination
* **Given** the signed-in role is requestor or maintenance
* **When** each role posts valid destination data
* **Then** each response is 403 with the Feature 1 Forbidden. message and no destination is created

#### Scenario: Client cannot select a destination primary key
* **Given** an admin sends valid destination data plus id 99 and an unrelated property
* **When** the destination is created
* **Then** the server generates its own id and persists only the allowed destination fields

#### Scenario: Add destination opens the specified form
* **Given** an admin is on Destinations
* **When** the admin selects Add destination
* **Then** the Add destination dialog shows Name, Address, City, State, Zip, Round-trip miles, Status, Save, and Cancel

#### Scenario: Saving a destination updates the list
* **Given** valid destination fields are entered and POST succeeds
* **When** the admin selects Save
* **Then** the dialog shows progress while pending, suppresses duplicate saves, closes on success, and reloads the list

#### Scenario: Cancel leaves destination records unchanged
* **Given** an add or edit destination dialog contains unsaved changes
* **When** the user selects Cancel
* **Then** the dialog closes without a write request and reopening it shows the correct initial values without the previous error

#### Scenario: Destination form rejects invalid fields before submitting
* **Given** a required destination field is blank or outside the allowed values
* **When** the user selects Save
* **Then** no write request is sent and Invalid destination data. is shown

#### Scenario: Failed destination save keeps the dialog open
* **Given** Save is pressed and the API returns an error message or no message
* **When** the create request finishes
* **Then** the dialog stays open with the entered values and shows the API message or Destination could not be saved.

### US-6.3 — Edit a destination

#### Scenario: Admin updates a destination
* **Given** destination id 1 exists
* **When** an admin sends PUT /vehicle-t6/destinations/1 with valid replacement fields
* **Then** the response is 200 with the updated destination fields and the same id

#### Scenario: Area admin updates a destination
* **Given** destination id 1 exists
* **When** an area_admin sends PUT /vehicle-t6/destinations/1 with valid replacement fields
* **Then** the response is 200 with the updated destination fields

#### Scenario: Admin can set a destination inactive
* **Given** destination id 1 has status active
* **When** an admin sends PUT with status inactive and otherwise valid fields
* **Then** the response is 200 with status inactive

#### Scenario: Updating to a duplicate destination name is rejected
* **Given** destinations Oklahoma City Airport and Tulsa Downtown exist
* **When** an admin updates Tulsa Downtown to the name Oklahoma City Airport in different letter case
* **Then** the response is 409 with message Destination name is already in use. and Tulsa Downtown is unchanged

#### Scenario: Unchanged destination name can be saved
* **Given** destination id 1 is named Oklahoma City Airport
* **When** an admin saves valid updates that keep the same destinationName
* **Then** the response is 200 with the updated fields

#### Scenario: Requestor and maintenance cannot update a destination
* **Given** the signed-in role is requestor or maintenance and destination id 1 exists
* **When** each role sends PUT /vehicle-t6/destinations/1
* **Then** each response is 403 with the Feature 1 Forbidden. message and the destination is unchanged

#### Scenario: Updating a missing destination is rejected
* **Given** no destination has id 9999
* **When** an admin sends PUT /vehicle-t6/destinations/9999 with valid fields
* **Then** the response is 404 with message Destination with id=9999 not found.

#### Scenario: Invalid destination route id is rejected
* **Given** an admin is signed in
* **When** PUT or DELETE is sent with route id abc, 0, -1, or an unsafe integer
* **Then** each response is 400 with message Destination id must be a positive integer.

#### Scenario: Edit destination opens with the current values
* **Given** an allowed destination row is shown on Destinations
* **When** the user selects Edit
* **Then** the Edit destination dialog shows that row’s current values, Save, and Cancel

#### Scenario: Saving an edited destination refreshes the list
* **Given** valid edited fields are entered and PUT succeeds
* **When** the user selects Save
* **Then** the dialog shows progress while pending, closes on success, and reloads the list

### US-6.4 — Delete a destination

#### Scenario: Admin deletes a destination
* **Given** destination id 3 exists
* **When** an admin sends DELETE /vehicle-t6/destinations/3
* **Then** the response is 200 with message Destination deleted. and the destination is gone

#### Scenario: Area admin deletes a destination
* **Given** destination id 3 exists
* **When** an area_admin sends DELETE /vehicle-t6/destinations/3
* **Then** the response is 200 with message Destination deleted.

#### Scenario: Requestor and maintenance cannot delete a destination
* **Given** the signed-in role is requestor or maintenance and destination id 3 exists
* **When** each role sends DELETE /vehicle-t6/destinations/3
* **Then** each response is 403 with the Feature 1 Forbidden. message and the destination remains

#### Scenario: Deleting a missing destination is rejected
* **Given** no destination has id 9999
* **When** an admin sends DELETE /vehicle-t6/destinations/9999
* **Then** the response is 404 with message Destination with id=9999 not found.

#### Scenario: Delete destination requires confirmation
* **Given** an allowed destination row is shown on Destinations
* **When** the user selects Delete
* **Then** a Delete destination dialog asks Delete this destination? and offers Delete and Cancel

#### Scenario: Confirmed destination deletion refreshes the list
* **Given** the delete confirmation is open and DELETE succeeds
* **When** the user selects Delete
* **Then** the dialog shows progress while pending, closes on success, and reloads the list

#### Scenario: Failed destination deletion preserves the dialog and row
* **Given** the delete confirmation is open and DELETE fails
* **When** the delete request finishes
* **Then** the dialog and row remain and the page shows the API message or Destination could not be deleted.

#### Scenario: Cancel closes destination delete without a request
* **Given** the delete confirmation is open
* **When** the user selects Cancel
* **Then** no delete request is sent and the destination remains on the list

## Test Coverage Map

Exact `it(...)` titles. Backend file: `backend/tests/destinations.test.js`. Frontend file: `frontend/tests/Destinations.test.js`.

| Story | Scenario | File | Exact test name |
|-------|----------|------|-----------------|
| US-6.1 | Admin lists every destination in name order | `backend/tests/destinations.test.js` | `it("Admin lists every destination in name order")` |
| US-6.1 | Area admin lists every destination | `backend/tests/destinations.test.js` | `it("Area admin lists every destination")` |
| US-6.1 | Requestor and maintenance can read the destination list | `backend/tests/destinations.test.js` | `it("Requestor and maintenance can read the destination list")` |
| US-6.1 | Empty destination list is returned | `backend/tests/destinations.test.js` | `it("Empty destination list is returned")` |
| US-6.1 | Destination API requires a session | `backend/tests/destinations.test.js` | `it("Destination API requires a session")` |
| US-6.1 | Options returns the standard state list | `backend/tests/destinations.test.js` | `it("Options returns the standard state list")` |
| US-6.1 | Destinations page shows allowed records and actions | `frontend/tests/Destinations.test.js` | `it("Destinations page shows allowed records and actions")` |
| US-6.1 | Destinations navigation requires an allowed role | `frontend/tests/Destinations.test.js` | `it("Destinations navigation requires an allowed role")` |
| US-6.1 | Requestor and maintenance are sent Home from Destinations | `frontend/tests/Destinations.test.js` | `it("Requestor and maintenance are sent Home from Destinations")` |
| US-6.1 | Destinations page distinguishes loading empty and failed states | `frontend/tests/Destinations.test.js` | `it("Destinations page distinguishes loading empty and failed states")` |
| US-6.1 | Destination list failure does not show an empty list | `frontend/tests/Destinations.test.js` | `it("Destination list failure does not show an empty list")` |
| US-6.2 | Admin creates a destination | `backend/tests/destinations.test.js` | `it("Admin creates a destination")` |
| US-6.2 | Area admin creates a destination | `backend/tests/destinations.test.js` | `it("Area admin creates a destination")` |
| US-6.2 | Destination values trim outer spaces | `backend/tests/destinations.test.js` | `it("Destination values trim outer spaces")` |
| US-6.2 | Duplicate destination name is rejected | `backend/tests/destinations.test.js` | `it("Duplicate destination name is rejected")` |
| US-6.2 | Unknown state is rejected | `backend/tests/destinations.test.js` | `it("Unknown state is rejected")` |
| US-6.2 | Invalid zip code is rejected | `backend/tests/destinations.test.js` | `it("Invalid zip code is rejected")` |
| US-6.2 | Invalid destination status is rejected | `backend/tests/destinations.test.js` | `it("Invalid destination status is rejected")` |
| US-6.2 | Invalid destination round-trip miles are rejected | `backend/tests/destinations.test.js` | `it("Invalid destination round-trip miles are rejected")` |
| US-6.2 | Requestor and maintenance cannot create a destination | `backend/tests/destinations.test.js` | `it("Requestor and maintenance cannot create a destination")` |
| US-6.2 | Client cannot select a destination primary key | `backend/tests/destinations.test.js` | `it("Client cannot select a destination primary key")` |
| US-6.2 | Add destination opens the specified form | `frontend/tests/Destinations.test.js` | `it("Add destination opens the specified form")` |
| US-6.2 | Saving a destination updates the list | `frontend/tests/Destinations.test.js` | `it("Saving a destination updates the list")` |
| US-6.2 | Cancel leaves destination records unchanged | `frontend/tests/Destinations.test.js` | `it("Cancel leaves destination records unchanged")` |
| US-6.2 | Destination form rejects invalid fields before submitting | `frontend/tests/Destinations.test.js` | `it("Destination form rejects invalid fields before submitting")` |
| US-6.2 | Failed destination save keeps the dialog open | `frontend/tests/Destinations.test.js` | `it("Failed destination save keeps the dialog open")` |
| US-6.3 | Admin updates a destination | `backend/tests/destinations.test.js` | `it("Admin updates a destination")` |
| US-6.3 | Area admin updates a destination | `backend/tests/destinations.test.js` | `it("Area admin updates a destination")` |
| US-6.3 | Admin can set a destination inactive | `backend/tests/destinations.test.js` | `it("Admin can set a destination inactive")` |
| US-6.3 | Updating to a duplicate destination name is rejected | `backend/tests/destinations.test.js` | `it("Updating to a duplicate destination name is rejected")` |
| US-6.3 | Unchanged destination name can be saved | `backend/tests/destinations.test.js` | `it("Unchanged destination name can be saved")` |
| US-6.3 | Requestor and maintenance cannot update a destination | `backend/tests/destinations.test.js` | `it("Requestor and maintenance cannot update a destination")` |
| US-6.3 | Updating a missing destination is rejected | `backend/tests/destinations.test.js` | `it("Updating a missing destination is rejected")` |
| US-6.3 | Invalid destination route id is rejected | `backend/tests/destinations.test.js` | `it("Invalid destination route id is rejected")` |
| US-6.3 | Edit destination opens with the current values | `frontend/tests/Destinations.test.js` | `it("Edit destination opens with the current values")` |
| US-6.3 | Saving an edited destination refreshes the list | `frontend/tests/Destinations.test.js` | `it("Saving an edited destination refreshes the list")` |
| US-6.4 | Admin deletes a destination | `backend/tests/destinations.test.js` | `it("Admin deletes a destination")` |
| US-6.4 | Area admin deletes a destination | `backend/tests/destinations.test.js` | `it("Area admin deletes a destination")` |
| US-6.4 | Requestor and maintenance cannot delete a destination | `backend/tests/destinations.test.js` | `it("Requestor and maintenance cannot delete a destination")` |
| US-6.4 | Deleting a missing destination is rejected | `backend/tests/destinations.test.js` | `it("Deleting a missing destination is rejected")` |
| US-6.4 | Delete destination requires confirmation | `frontend/tests/Destinations.test.js` | `it("Delete destination requires confirmation")` |
| US-6.4 | Confirmed destination deletion refreshes the list | `frontend/tests/Destinations.test.js` | `it("Confirmed destination deletion refreshes the list")` |
| US-6.4 | Failed destination deletion preserves the dialog and row | `frontend/tests/Destinations.test.js` | `it("Failed destination deletion preserves the dialog and row")` |
| US-6.4 | Cancel closes destination delete without a request | `frontend/tests/Destinations.test.js` | `it("Cancel closes destination delete without a request")` |

## Agent implementation request

Copy when asking Cursor to implement this feature (`@` this file):

```text
Implement Feature 6 from @features/feature-6-destination-management.md on branch `feature/6-destination-management`.

Follow layer order in @features/framework.md (models → routes → backend tests → frontend → frontend tests).
Map every Gherkin scenario in the Test Coverage Map; run `npm test` before finishing.
If API routes, payloads, schema, or product rules changed per this spec, update @features/reference/api.md, @features/reference/data-model.md, and/or @features/reference/behavior.md in the same PR to match shipped code.
Complete Definition of Done and the merge checklist in @features/framework.md.
Do not implement behavior not in this spec.
```

**Reference updates for this feature:** `api.md`, `data-model.md`, `behavior.md`.

## Definition of Done

* [ ] Backend and frontend implemented per this spec (**FR-001**–**FR-020** satisfied)
* [ ] **Success Criteria (SC-001**–**SC-005)** met
* [ ] All mapped tests pass (`npm test`)
* [ ] Test Coverage Map complete
* [ ] `features/reference/data-model.md` updated (if schema changed)
* [ ] `features/reference/api.md` updated (if API changed)
* [ ] `features/reference/behavior.md` updated (if product rules changed)
* [ ] Agility stories and acceptance tests for Feature 6 are created or updated
* [ ] Application code for this feature is handwritten; automated tests may use AI assistance

## Out of Scope

* Google sign-in and roles: [Feature 1](feature-1-user-authentication-authorization.md).
* Choosing a destination on a reservation request, including free-text city with typed mileage when no catalog destination is used: [Feature 7 — Reservation Requests in the catalog](README.md#feature-catalog).
* Blocking inactive destinations during request processing: [Feature 7](README.md#feature-catalog) / [Feature 8](README.md#feature-catalog).
* Area assignment for destinations, map coordinates, and international addresses.
