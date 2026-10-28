# Feature: Reservation Requests

**Feature ID:** 7  
**Branch pattern:** `feature/7-reservation-requests`  
**Status:** Ready  
**Created:** 2026-10-28  
**Input:** Let requestors submit vehicle reservation requests that name an area, approved driver, destination or free-text city with typed mileage, trip dates with optional times, passengers, purpose, and optional notes, then view, edit, or cancel their own requested trips before Feature 8 processes them.  
**Depends on:** [Feature 1 — User Authentication & Authorization](feature-1-user-authentication-authorization.md), [Feature 2 — Area Management](feature-2-area-management.md), [Feature 5 — Driver Management](feature-5-driver-management.md), [Feature 6 — Destination Management](feature-6-destination-management.md)

---

## User Stories

Every story is P1: each one must ship for the assignment’s Reservation Requests feature.

### US-7.1: View reservation requests

**As a** signed-in user with request access  
**I want to** see the reservation requests I am allowed to read  
**So that** I know what is requested or already submitted

**Priority:** P1  
**Independent test:** Sign in as requestor, area_admin, and admin; verify each sees only the documented request scope and that maintenance is denied.  
**Acceptance scenarios:** see ### US-7.1 under Acceptance Criteria

### US-7.2: Submit a reservation request

**As a** requestor  
**I want to** submit a reservation request with area, driver, destination or city mileage, schedule, passengers, purpose, and optional notes  
**So that** an area can later process and assign a vehicle

**Priority:** P1  
**Independent test:** Create a valid requested trip as a requestor, reject invalid references and disallowed roles, and confirm the requestor is taken from the session.  
**Acceptance scenarios:** see ### US-7.2 under Acceptance Criteria

### US-7.3: Edit a requested reservation request

**As a** requestor  
**I want to** update my own requested reservation request  
**So that** I can correct trip details before it is processed

**Priority:** P1  
**Independent test:** Update an own requested trip, reject edits to other users’ requests and non-requested statuses, and reject disallowed roles.  
**Acceptance scenarios:** see ### US-7.3 under Acceptance Criteria

### US-7.4: Cancel a requested reservation request

**As a** requestor  
**I want to** cancel my own requested reservation request  
**So that** a trip I no longer need is marked Cancelled

**Priority:** P1  
**Independent test:** Cancel an own requested trip to status `cancelled`, reject canceling another user’s or non-requested trip, and reject disallowed roles.  
**Acceptance scenarios:** see ### US-7.4 under Acceptance Criteria

## Requirements

### Functional Requirements

* **FR-001:** Reservation requests MUST reuse Feature 1 authentication and role checks, Feature 2 Area records, Feature 5 Driver records, and Feature 6 Destination records. This feature MUST NOT implement sign-in, area/driver/destination CRUD, or vehicle assignment. Requestor cancel MUST use Feature 8’s shared status-change function so Feature 9 can email on cancels.
* **FR-002:** A reservation request MUST store requestorUserId, areaId, driverId, destinationId (nullable), destinationCity (nullable), estimatedMiles (nullable), departureDate, departureTime (nullable), returnDate, returnTime (nullable), passengers, purpose, noteType (nullable), noteText (nullable), and status. The server MUST generate id. Request-body properties outside the writable fields below MUST be ignored.
* **FR-003:** On create and update, the writable body fields are areaId, driverId, destinationId, destinationCity, estimatedMiles, departureDate, departureTime, returnDate, returnTime, passengers, purpose, noteType, and noteText. requestorUserId MUST come from the authenticated user id and MUST NOT be taken from the client body. status MUST be set to `requested` on create and MUST NOT be set by the client on create or update.
* **FR-004:** Shared trip statuses for the product are exactly: `requested`, `awaiting_vehicle`, `reserved`, `returned`, `cancelled` (display labels Requested / Awaiting Vehicle / Reserved / Returned / Cancelled). This feature creates `requested` and may change an own `requested` row to `cancelled` only through Feature 8’s shared status-change function. Feature 8 owns the status-change implementation and all other status transitions.
* **FR-005:** areaId MUST be a positive integer for an existing Area. Missing areas MUST return 404 `Area with id=<id> not found.` Invalid areaId shape MUST return 400.
* **FR-006:** driverId MUST be a positive integer for an existing Driver whose status is `approved`. A missing driver MUST return 404 `Driver with id=<id> not found.` An inactive or otherwise non-approved driver MUST return 400 `Invalid reservation request data.` Invalid driverId shape MUST return 400.
* **FR-007:** The request MUST use exactly one destination mode: (a) destinationId for an existing Destination whose status is `active`, with destinationCity and estimatedMiles null, or (b) destinationCity and estimatedMiles filled and destinationId null. Mixing both modes or providing neither MUST return 400 `Invalid reservation request data.` A missing destinationId MUST return 404 `Destination with id=<id> not found.` An inactive destination MUST return 400.
* **FR-008:** destinationCity MUST be a nonblank trimmed string at most 100 characters when mode (b) is used. estimatedMiles MUST be a number greater than 0 and at most 9999.9 with at most one decimal digit when mode (b) is used. Free-text city mileage is the requestor-typed estimate; catalog destination miles live on Feature 6 `roundTripMiles`.
* **FR-009:** departureDate and returnDate MUST be required calendar dates in `YYYY-MM-DD` form. departureTime and returnTime MAY be null for whole-day trips. When both times are null, the trip is a whole-day range and returnDate MUST be on or after departureDate. When either time is present, both times MUST be present as 24-hour `HH:mm` values and the combined return date-time MUST be strictly after the combined departure date-time. Invalid shapes or ordering MUST return 400 `Invalid reservation request data.`
* **FR-010:** passengers MUST be an integer from 1 through 15. purpose MUST be a required nonblank string after trimming outer spaces, at most 500 characters, keeping letter case and internal spaces after outer trimming.
* **FR-011:** noteType and noteText are optional as a pair. If either is present, both MUST be present. noteType MUST be one of `general`, `special_instructions`, or `other`. noteText MUST be a nonblank trimmed string at most 1000 characters. Invalid note pairs MUST return 400.
* **FR-012:** Only the requestor role MAY create reservation requests. Admin, area_admin, and maintenance MUST receive the Feature 1 403 response for POST. Signed-out requests MUST receive 401.
* **FR-013:** GET list scope MUST be: requestor sees only requests where requestorUserId equals the current user id; area_admin sees only requests whose areaId equals that user’s current database areaId; admin sees every request. An area_admin with null areaId MUST receive 200 with []. Maintenance MUST receive 403 for every reservation-request endpoint. List sort MUST be departureDate ascending, departureTime ascending with nulls first, then id ascending. Empty allowed results MUST be 200 with [].
* **FR-014:** Only a requestor MAY update or cancel, and only when the target request belongs to that user and status is `requested`. Updates or cancels of another user’s request or of a non-`requested` status MUST return 404 `Reservation request with id=<id> not found.` without revealing other users’ data. Admin and area_admin MUST receive 403 for PUT and cancel in this feature.
* **FR-015:** PUT MUST replace the writable body fields while preserving id, requestorUserId, and status. Route ids MUST be positive safe integers; invalid ids MUST return 400 `Reservation request id must be a positive integer.`
* **FR-016:** Cancel MUST use PUT `/vehicle-t6/reservation-requests/:id/cancel` with an empty body. That route MUST call the same shared status-change function Feature 8 defines for `PUT /vehicle-t6/reservation-requests/:id/status` (transition `requested` → `cancelled`), so Feature 9 can email on requestor cancels too. Cancel MUST keep the row and return 200 with the updated ReservationRequest. Cancel MUST NOT delete the row or bypass the shared status-change function.
* **FR-017:** Foreign keys from reservation_requests to users, areas, drivers, and destinations MUST use `ON DELETE RESTRICT`. Attempting to delete a referenced Area, Driver, or Destination through its owning API MUST return 409 with a clear in-use message and leave both records unchanged. This feature owns those 409 acceptance tests because it adds the references.
* **FR-018:** This feature MUST NOT assign vehicles, move a request to `awaiting_vehicle`, `reserved`, or `returned`, or send emails.
* **FR-019:** The Reservation requests page MUST be available to requestor, admin, and area_admin. MenuBar MUST show **Requests** for those roles. Signed-out visitors MUST go to Login. Maintenance MUST be sent Home.
* **FR-020:** Requestor Add and Edit MUST use dialogs with Area, Driver, Destination mode controls, Departure date, optional Departure time, Return date, optional Return time, Passengers, Purpose, optional Note type and Note text, Save, and Cancel. Area options come from Feature 2. Driver options MUST list only approved Feature 5 drivers. Destination options MUST list only active Feature 6 destinations. Admin and area_admin see the list without Add/Edit/Cancel actions in this feature.
* **FR-021:** Form validation MUST block invalid submissions before a write. Save MUST show progress, block duplicate submission, close on success, and refresh the list. Dialog Cancel MUST send no write and MUST discard unsaved values and errors. A failed save MUST keep the dialog values and show the API message or the specified fallback.
* **FR-022:** Canceling MUST use a confirmation dialog asking `Cancel this reservation request?` Confirming MUST show progress, block duplicate submission, close and refresh on success, and keep the row and show an error on failure. Dialog Keep MUST make no request.
* **FR-023:** List loading MUST show progress. `No reservation requests found.` MUST appear only after a successful empty response. A failed load MUST show the API message or fallback and MUST NOT claim the list is empty.
* **FR-024:** Database failures MUST return 500 `Reservation request failed.` without SQL details or partial writes.

## Assumptions

* Features 5 and 6 are on `dev` before this feature is implemented.
* Requestors choose any Area from Feature 2. Area admins later process requests for their assigned area in Feature 8.
* Only approved drivers may be selected. Catalog destinations must be active; otherwise the requestor enters free-text city and typed mileage.
* Date-only trips omit both times and mean whole calendar days.
* Vehicle assignment and statuses `awaiting_vehicle`, `reserved`, and `returned` belong to Feature 8. Requestor cancel uses Feature 8’s shared status-change function so Feature 9 can email on cancels.
* Maintenance users do not submit or browse reservation requests in this feature.

## Edge Cases

* An area admin with no area assignment sees an empty request list and cannot write in this feature.
* A requestor cannot discover another user’s request through 404-vs-403 differences on update or cancel.
* Client-supplied requestorUserId or status values are ignored on create and update.
* Providing both a catalog destination and free-text city/miles is rejected.
* Failed loading does not show `No reservation requests found.`

## Success Criteria

* **SC-001:** Create, list, update, and cancel match the documented reservation-request contract, including optional times, notes, and destination modes.
* **SC-002:** Role and ownership rules hold for every mapped acceptance case.
* **SC-003:** Invalid fields and disallowed area, driver, or destination references do not change data.
* **SC-004:** Dialog, loading, empty, error, and role-specific navigation cases have matching frontend tests and a manual check.
* **SC-005:** Every scenario has an exact-name test before merge.

## Data Ownership & Isolation

| Operation | admin | area_admin | requestor | maintenance |
|-----------|-------|------------|-----------|-------------|
| List | All requests | Requests for own areaId only; [] if areaId null | Own requests only | 403 |
| Create | 403 | 403 | Allowed; requestorUserId = self; status `requested` | 403 |
| Update | 403 | 403 | Own `requested` only; otherwise 404 | 403 |
| Cancel | 403 | 403 | Own `requested` only → `cancelled`; otherwise 404 | 403 |

Authentication and roles come from [Feature 1](feature-1-user-authentication-authorization.md). Area scope for area_admin list comes from the current database `users.areaId`, not from the client.

## Key Entities

* **Reservation request:** one trip request owned by a requestor User, naming one Area, one approved Driver, either one active Destination or a free-text city with typed mileage, a departure/return schedule, passenger count, purpose, optional notes, and a shared status value.
* **Area / Driver / Destination:** existing Feature 2 / 5 / 6 records selected by id when used; this feature does not redefine them.

## API Requirements

All endpoints reuse [Feature 1](feature-1-user-authentication-authorization.md) authentication. No GET-by-id endpoint is introduced.

| Method | Endpoint | Allowed role | Success |
|--------|----------|--------------|---------|
| GET | `/vehicle-t6/reservation-requests` | admin, area_admin (scoped), requestor (own) | `200`, array of ReservationRequest objects |
| POST | `/vehicle-t6/reservation-requests` | requestor | `201`, new ReservationRequest with status `requested` |
| PUT | `/vehicle-t6/reservation-requests/:id` | requestor (own `requested`) | `200`, updated ReservationRequest |
| PUT | `/vehicle-t6/reservation-requests/:id/cancel` | requestor (own `requested`) | `200`, ReservationRequest with status `cancelled` (via Feature 8 shared status-change function) |

POST/PUT body example (catalog destination, timed trip):

```json
{
  "areaId": 2,
  "driverId": 5,
  "destinationId": 3,
  "destinationCity": null,
  "estimatedMiles": null,
  "departureDate": "2026-11-10",
  "departureTime": "08:30",
  "returnDate": "2026-11-10",
  "returnTime": "17:00",
  "passengers": 4,
  "purpose": "Conference shuttle",
  "noteType": "special_instructions",
  "noteText": "Need wheelchair access"
}
```

Whole-day free-text example uses `"departureTime": null`, `"returnTime": null`, `"destinationId": null`, `"destinationCity": "Norman"`, `"estimatedMiles": 40.5`.

ReservationRequest object: the body fields above plus generated `id`, `requestorUserId`, and `status`. Request-body `requestorUserId` and `status` are ignored on write.

| Failure | Status | Message |
|---------|--------|---------|
| No valid session | 401 | Feature 1 `Unauthorized.` |
| Disallowed role or maintenance access | 403 | Feature 1 `Forbidden.` |
| Invalid field, schedule, destination mode, notes, passengers, or purpose | 400 | `Invalid reservation request data.` for body fields; `Reservation request id must be a positive integer.` for a bad route id |
| Missing area | 404 | `Area with id=<id> not found.` |
| Missing driver | 404 | `Driver with id=<id> not found.` |
| Missing destination | 404 | `Destination with id=<id> not found.` |
| Missing, non-owned, or non-`requested` target on PUT/cancel | 404 | `Reservation request with id=<id> not found.` |
| Delete of Area/Driver/Destination still referenced by a reservation request | 409 | `Area is in use.` / `Driver is in use.` / `Destination is in use.` |
| Other database failure | 500 | `Reservation request failed.` |

## Screen Requirements

* `/reservation-requests`, route name `reservation-requests`, heading **Reservation requests**. MenuBar shows **Requests** for requestor, admin, and area_admin. Signed-out users follow Feature 1 Login redirect. Maintenance is sent Home.
* List columns: **Departure**, **Return**, **Area**, **Driver**, **Destination**, **Miles**, **Passengers**, **Purpose**, **Notes**, **Status**, and permitted **Actions**. Destination shows destinationName or destinationCity. Miles shows Feature 6 roundTripMiles when a catalog destination is used, otherwise estimatedMiles.
* Requestor sees **Add request**, and **Edit** / **Cancel** on own `requested` rows only. Admin and area_admin see the allowed list without write actions in this feature.
* Add/edit dialogs include destination mode: choose a catalog Destination or enter City and Estimated miles; optional times; optional Note type and Note text; Save and Cancel.
* Cancel confirmation asks `Cancel this reservation request?` and offers **Cancel request** and **Keep**.

## Data Model Requirements

Add `reservation_requests`:

| Field | Type | Rule |
|-------|------|------|
| id | Integer | Auto-generated primary key |
| requestorUserId | Integer | Required FK to `users.id`, `ON DELETE RESTRICT` |
| areaId | Integer | Required FK to `areas.id`, `ON DELETE RESTRICT` |
| driverId | Integer | Required FK to `drivers.id`, `ON DELETE RESTRICT` |
| destinationId | Integer | Nullable FK to `destinations.id`, `ON DELETE RESTRICT` |
| destinationCity | String(100) | Nullable; required in free-text mode |
| estimatedMiles | Decimal(6,1) | Nullable; required in free-text mode; > 0 and ≤ 9999.9 |
| departureDate | Date only | Required; `YYYY-MM-DD` |
| departureTime | String(5) | Nullable; `HH:mm` when timed |
| returnDate | Date only | Required; `YYYY-MM-DD` |
| returnTime | String(5) | Nullable; `HH:mm` when timed |
| passengers | Integer | Required; 1 through 15 |
| purpose | String(500) | Required; trimmed; nonblank |
| noteType | String(32) | Nullable; `general`, `special_instructions`, or `other` |
| noteText | String(1000) | Nullable; paired with noteType |
| status | String(32) | Required; one of the five shared statuses; created as `requested` |

Register associations in `models/index.js`. This feature does not add vehicleId; Feature 8 adds processing fields.

## Acceptance Criteria (Gherkin)

### US-7.1 — View reservation requests

#### Scenario: Requestor lists only own reservation requests
* **Given** requestor A owns request 1 and requestor B owns request 2
* **When** requestor A requests GET /vehicle-t6/reservation-requests
* **Then** the response is 200 with only request 1 sorted by departureDate, departureTime, then id

#### Scenario: Admin lists every reservation request
* **Given** reservation requests exist for multiple requestors and areas
* **When** an admin lists reservation requests
* **Then** the response is 200 with every request in departure order

#### Scenario: Area admin lists only requests for its area
* **Given** an area_admin has areaId 2 and requests exist for areas 1 and 2
* **When** that user lists reservation requests
* **Then** the response is 200 with only area 2 requests

#### Scenario: Area admin without an assignment gets an empty reservation request list
* **Given** an area_admin has null areaId and requests exist
* **When** that user lists reservation requests
* **Then** the response is 200 with []

#### Scenario: Empty reservation request list is returned
* **Given** there are no requests in the caller’s scope
* **When** a requestor lists reservation requests
* **Then** the response is 200 with []

#### Scenario: Maintenance cannot access reservation requests
* **Given** the signed-in role is maintenance
* **When** GET, POST, PUT, or cancel is sent to an applicable reservation-request route
* **Then** each response is 403 with the Feature 1 Forbidden. message and nothing changes

#### Scenario: Reservation request API requires a session
* **Given** no valid application session is supplied
* **When** GET, POST, PUT, or cancel is sent to an applicable reservation-request route
* **Then** each response is 401 with the Feature 1 Unauthorized. message and nothing changes

#### Scenario: Requests page shows allowed records and actions
* **Given** GET /reservation-requests returns the caller’s allowed requests
* **When** a requestor, admin, or area_admin opens /reservation-requests from MenuBar
* **Then** each allowed request appears with schedule, area, driver, destination or city, miles, passengers, purpose, notes, and status, and only the requestor sees Add request plus Edit and Cancel on own requested rows

#### Scenario: Requests navigation requires an allowed role
* **Given** a signed-out visitor opens /reservation-requests
* **When** the Feature 1 route guard runs
* **Then** the visitor reaches /login and no reservation requests appear

#### Scenario: Maintenance is sent Home from Requests
* **Given** a maintenance user opens /reservation-requests
* **When** the route guard runs
* **Then** the user reaches Home and MenuBar does not show Requests

#### Scenario: Requests page distinguishes loading empty and failed states
* **Given** the request list is pending, then succeeds with []
* **When** the page renders each state
* **Then** progress appears while pending and No reservation requests found. appears only after success

#### Scenario: Reservation request list failure does not show an empty list
* **Given** GET /reservation-requests fails with an API message or no response message
* **When** the list request completes
* **Then** the page shows the message or Reservation requests could not be loaded. and does not show No reservation requests found.

### US-7.2 — Submit a reservation request

#### Scenario: Requestor creates a requested reservation with a catalog destination
* **Given** a requestor supplies a valid area, approved driver, active destination, timed schedule, passengers, and purpose
* **When** POST /vehicle-t6/reservation-requests is sent
* **Then** the response is 201 with generated id, requestorUserId equal to that user, status requested, and the saved fields

#### Scenario: Requestor creates a whole-day request with free-text city mileage
* **Given** a requestor supplies destinationCity Norman, estimatedMiles 40.5, null destinationId, and null times with valid dates
* **When** POST /vehicle-t6/reservation-requests is sent
* **Then** the response is 201 with status requested and those destination and schedule fields saved

#### Scenario: Requestor identity comes from the session
* **Given** a requestor sends valid body fields plus a different requestorUserId and status reserved
* **When** POST /vehicle-t6/reservation-requests is sent
* **Then** the stored request uses the session user id and status requested

#### Scenario: Mixed destination modes are rejected
* **Given** a requestor posts both destinationId and destinationCity with estimatedMiles
* **When** POST /vehicle-t6/reservation-requests is sent
* **Then** the response is 400 with message Invalid reservation request data. and no request is stored

#### Scenario: Non-approved driver is rejected
* **Given** driver id 5 has status inactive
* **When** a requestor posts an otherwise valid request with driverId 5
* **Then** the response is 400 with message Invalid reservation request data. and no request is stored

#### Scenario: Inactive destination is rejected
* **Given** destination id 3 has status inactive
* **When** a requestor posts an otherwise valid catalog-destination request with destinationId 3
* **Then** the response is 400 with message Invalid reservation request data. and no request is stored

#### Scenario: Missing area on reservation request is rejected
* **Given** no area has id 9999
* **When** a requestor posts an otherwise valid request with areaId 9999
* **Then** the response is 404 with message Area with id=9999 not found. and no request is stored

#### Scenario: Return before departure is rejected
* **Given** a requestor posts a timed return earlier than departure
* **When** POST /vehicle-t6/reservation-requests is sent
* **Then** the response is 400 with message Invalid reservation request data. and no request is stored

#### Scenario: One-sided times are rejected
* **Given** a requestor posts departureTime without returnTime or the reverse
* **When** POST /vehicle-t6/reservation-requests is sent
* **Then** the response is 400 with message Invalid reservation request data. and no request is stored

#### Scenario: Invalid passengers on reservation request are rejected
* **Given** a requestor posts passengers 0 or 16
* **When** POST /vehicle-t6/reservation-requests is sent
* **Then** the response is 400 with message Invalid reservation request data. and no request is stored

#### Scenario: Optional notes require both type and text
* **Given** a requestor posts noteType without noteText or the reverse
* **When** POST /vehicle-t6/reservation-requests is sent
* **Then** the response is 400 with message Invalid reservation request data. and no request is stored

#### Scenario: Admin and area admin cannot create a reservation request
* **Given** the signed-in role is admin or area_admin
* **When** each role posts valid reservation request data
* **Then** each response is 403 with the Feature 1 Forbidden. message and no request is created

#### Scenario: Referenced destination cannot be deleted while in use
* **Given** a reservation request references destination id 3
* **When** an admin sends DELETE /vehicle-t6/destinations/3
* **Then** the response is 409 with message Destination is in use. and both records remain

#### Scenario: Referenced driver cannot be deleted while in use
* **Given** a reservation request references driver id 5
* **When** an admin sends DELETE /vehicle-t6/drivers/5
* **Then** the response is 409 with message Driver is in use. and both records remain

#### Scenario: Referenced area cannot be deleted while in use
* **Given** a reservation request references area id 2
* **When** an admin sends DELETE /vehicle-t6/areas/2
* **Then** the response is 409 with message Area is in use. and both records remain

#### Scenario: Add request opens the specified form
* **Given** a requestor is on Reservation requests
* **When** the requestor selects Add request
* **Then** the Add request dialog shows the documented fields including destination mode, optional times, optional notes, Save, and Cancel

#### Scenario: Saving a reservation request updates the list
* **Given** valid request fields are entered and POST succeeds
* **When** the requestor selects Save
* **Then** the dialog shows progress while pending, suppresses duplicate saves, closes on success, and reloads the list

#### Scenario: Cancel leaves reservation form changes unchanged
* **Given** an add or edit request dialog contains unsaved changes
* **When** the user selects Cancel
* **Then** the dialog closes without a write request and reopening it shows the correct initial values without the previous error

#### Scenario: Reservation request form rejects invalid fields before submitting
* **Given** a required request field is blank or the schedule is out of order
* **When** the user selects Save
* **Then** no write request is sent and Invalid reservation request data. is shown

#### Scenario: Failed reservation request save keeps the dialog open
* **Given** Save is pressed and the API returns an error message or no message
* **When** the create request finishes
* **Then** the dialog stays open with the entered values and shows the API message or Reservation request could not be saved.

### US-7.3 — Edit a requested reservation request

#### Scenario: Requestor updates own requested reservation request
* **Given** requestor A owns requested request id 1
* **When** that user sends PUT /vehicle-t6/reservation-requests/1 with valid replacement fields
* **Then** the response is 200 with the updated fields, the same id, the same requestorUserId, and status requested

#### Scenario: Requestor cannot update another users reservation request
* **Given** requestor B owns requested request id 2
* **When** requestor A sends PUT /vehicle-t6/reservation-requests/2
* **Then** the response is 404 with message Reservation request with id=2 not found. and request 2 is unchanged

#### Scenario: Requestor cannot update a non-requested reservation request
* **Given** requestor A owns request id 4 whose status is not requested
* **When** that user sends PUT /vehicle-t6/reservation-requests/4
* **Then** the response is 404 with message Reservation request with id=4 not found. and the request is unchanged

#### Scenario: Admin and area admin cannot update a reservation request
* **Given** requested request id 1 exists
* **When** an admin or area_admin sends PUT /vehicle-t6/reservation-requests/1
* **Then** each response is 403 with the Feature 1 Forbidden. message and the request is unchanged

#### Scenario: Invalid reservation request route id is rejected
* **Given** a requestor is signed in
* **When** PUT or cancel is sent with route id abc, 0, -1, or an unsafe integer
* **Then** each response is 400 with message Reservation request id must be a positive integer.

#### Scenario: Edit request opens with the current values
* **Given** an own requested row is shown for a requestor
* **When** the requestor selects Edit
* **Then** the Edit request dialog shows that row’s current values, Save, and Cancel

#### Scenario: Saving an edited reservation request refreshes the list
* **Given** valid edited fields are entered and PUT succeeds
* **When** the requestor selects Save
* **Then** the dialog shows progress while pending, closes on success, and reloads the list

### US-7.4 — Cancel a requested reservation request

#### Scenario: Requestor cancels own requested reservation request
* **Given** requestor A owns requested request id 3
* **When** that user sends PUT /vehicle-t6/reservation-requests/3/cancel
* **Then** the response is 200 with status cancelled, the row still exists, and the change goes through Feature 8’s shared status-change function

#### Scenario: Missing reservation request id returns not found on put or cancel
* **Given** no reservation request has id 9999
* **When** a requestor sends PUT or cancel for /vehicle-t6/reservation-requests/9999
* **Then** each response is 404 with message Reservation request with id=9999 not found.

#### Scenario: Requestor cannot cancel another users reservation request
* **Given** requestor B owns requested request id 2
* **When** requestor A sends cancel for request 2
* **Then** the response is 404 with message Reservation request with id=2 not found. and request 2 remains requested

#### Scenario: Requestor cannot cancel a non-requested reservation request
* **Given** requestor A owns request id 4 whose status is not requested
* **When** that user sends cancel for request 4
* **Then** the response is 404 with message Reservation request with id=4 not found. and the request is unchanged

#### Scenario: Admin and area admin cannot cancel a reservation request in Feature 7
* **Given** requested request id 3 exists
* **When** an admin or area_admin sends cancel for request 3
* **Then** each response is 403 with the Feature 1 Forbidden. message and the request remains requested

#### Scenario: Cancel request requires confirmation
* **Given** an own requested row is shown for a requestor
* **When** the requestor selects Cancel
* **Then** a Cancel request dialog asks Cancel this reservation request? and offers Cancel request and Keep

#### Scenario: Confirmed reservation request cancel refreshes the list
* **Given** the cancel confirmation is open and cancel succeeds
* **When** the requestor selects Cancel request
* **Then** the dialog shows progress while pending, closes on success, and reloads the list showing status cancelled

#### Scenario: Failed reservation request cancel preserves the dialog and row
* **Given** the cancel confirmation is open and cancel fails
* **When** the cancel request finishes
* **Then** the dialog and row remain and the page shows the API message or Reservation request could not be canceled.

#### Scenario: Keep closes cancel without a request
* **Given** the cancel confirmation is open
* **When** the requestor selects Keep
* **Then** no cancel request is sent and the reservation request remains requested

## Test Coverage Map

Exact `it(...)` titles. Backend file: `backend/tests/reservationRequests.test.js`. Frontend file: `frontend/tests/ReservationRequests.test.js`.

| Story | Scenario | File | Exact test name |
|-------|----------|------|-----------------|
| US-7.1 | Requestor lists only own reservation requests | `backend/tests/reservationRequests.test.js` | `it("Requestor lists only own reservation requests")` |
| US-7.1 | Admin lists every reservation request | `backend/tests/reservationRequests.test.js` | `it("Admin lists every reservation request")` |
| US-7.1 | Area admin lists only requests for its area | `backend/tests/reservationRequests.test.js` | `it("Area admin lists only requests for its area")` |
| US-7.1 | Area admin without an assignment gets an empty reservation request list | `backend/tests/reservationRequests.test.js` | `it("Area admin without an assignment gets an empty reservation request list")` |
| US-7.1 | Empty reservation request list is returned | `backend/tests/reservationRequests.test.js` | `it("Empty reservation request list is returned")` |
| US-7.1 | Maintenance cannot access reservation requests | `backend/tests/reservationRequests.test.js` | `it("Maintenance cannot access reservation requests")` |
| US-7.1 | Reservation request API requires a session | `backend/tests/reservationRequests.test.js` | `it("Reservation request API requires a session")` |
| US-7.1 | Requests page shows allowed records and actions | `frontend/tests/ReservationRequests.test.js` | `it("Requests page shows allowed records and actions")` |
| US-7.1 | Requests navigation requires an allowed role | `frontend/tests/ReservationRequests.test.js` | `it("Requests navigation requires an allowed role")` |
| US-7.1 | Maintenance is sent Home from Requests | `frontend/tests/ReservationRequests.test.js` | `it("Maintenance is sent Home from Requests")` |
| US-7.1 | Requests page distinguishes loading empty and failed states | `frontend/tests/ReservationRequests.test.js` | `it("Requests page distinguishes loading empty and failed states")` |
| US-7.1 | Reservation request list failure does not show an empty list | `frontend/tests/ReservationRequests.test.js` | `it("Reservation request list failure does not show an empty list")` |
| US-7.2 | Requestor creates a requested reservation with a catalog destination | `backend/tests/reservationRequests.test.js` | `it("Requestor creates a requested reservation with a catalog destination")` |
| US-7.2 | Requestor creates a whole-day request with free-text city mileage | `backend/tests/reservationRequests.test.js` | `it("Requestor creates a whole-day request with free-text city mileage")` |
| US-7.2 | Requestor identity comes from the session | `backend/tests/reservationRequests.test.js` | `it("Requestor identity comes from the session")` |
| US-7.2 | Mixed destination modes are rejected | `backend/tests/reservationRequests.test.js` | `it("Mixed destination modes are rejected")` |
| US-7.2 | Non-approved driver is rejected | `backend/tests/reservationRequests.test.js` | `it("Non-approved driver is rejected")` |
| US-7.2 | Inactive destination is rejected | `backend/tests/reservationRequests.test.js` | `it("Inactive destination is rejected")` |
| US-7.2 | Missing area on reservation request is rejected | `backend/tests/reservationRequests.test.js` | `it("Missing area on reservation request is rejected")` |
| US-7.2 | Return before departure is rejected | `backend/tests/reservationRequests.test.js` | `it("Return before departure is rejected")` |
| US-7.2 | One-sided times are rejected | `backend/tests/reservationRequests.test.js` | `it("One-sided times are rejected")` |
| US-7.2 | Invalid passengers on reservation request are rejected | `backend/tests/reservationRequests.test.js` | `it("Invalid passengers on reservation request are rejected")` |
| US-7.2 | Optional notes require both type and text | `backend/tests/reservationRequests.test.js` | `it("Optional notes require both type and text")` |
| US-7.2 | Admin and area admin cannot create a reservation request | `backend/tests/reservationRequests.test.js` | `it("Admin and area admin cannot create a reservation request")` |
| US-7.2 | Referenced destination cannot be deleted while in use | `backend/tests/reservationRequests.test.js` | `it("Referenced destination cannot be deleted while in use")` |
| US-7.2 | Referenced driver cannot be deleted while in use | `backend/tests/reservationRequests.test.js` | `it("Referenced driver cannot be deleted while in use")` |
| US-7.2 | Referenced area cannot be deleted while in use | `backend/tests/reservationRequests.test.js` | `it("Referenced area cannot be deleted while in use")` |
| US-7.2 | Add request opens the specified form | `frontend/tests/ReservationRequests.test.js` | `it("Add request opens the specified form")` |
| US-7.2 | Saving a reservation request updates the list | `frontend/tests/ReservationRequests.test.js` | `it("Saving a reservation request updates the list")` |
| US-7.2 | Cancel leaves reservation form changes unchanged | `frontend/tests/ReservationRequests.test.js` | `it("Cancel leaves reservation form changes unchanged")` |
| US-7.2 | Reservation request form rejects invalid fields before submitting | `frontend/tests/ReservationRequests.test.js` | `it("Reservation request form rejects invalid fields before submitting")` |
| US-7.2 | Failed reservation request save keeps the dialog open | `frontend/tests/ReservationRequests.test.js` | `it("Failed reservation request save keeps the dialog open")` |
| US-7.3 | Requestor updates own requested reservation request | `backend/tests/reservationRequests.test.js` | `it("Requestor updates own requested reservation request")` |
| US-7.3 | Requestor cannot update another users reservation request | `backend/tests/reservationRequests.test.js` | `it("Requestor cannot update another users reservation request")` |
| US-7.3 | Requestor cannot update a non-requested reservation request | `backend/tests/reservationRequests.test.js` | `it("Requestor cannot update a non-requested reservation request")` |
| US-7.3 | Admin and area admin cannot update a reservation request | `backend/tests/reservationRequests.test.js` | `it("Admin and area admin cannot update a reservation request")` |
| US-7.3 | Invalid reservation request route id is rejected | `backend/tests/reservationRequests.test.js` | `it("Invalid reservation request route id is rejected")` |
| US-7.3 | Edit request opens with the current values | `frontend/tests/ReservationRequests.test.js` | `it("Edit request opens with the current values")` |
| US-7.3 | Saving an edited reservation request refreshes the list | `frontend/tests/ReservationRequests.test.js` | `it("Saving an edited reservation request refreshes the list")` |
| US-7.4 | Requestor cancels own requested reservation request | `backend/tests/reservationRequests.test.js` | `it("Requestor cancels own requested reservation request")` |
| US-7.4 | Missing reservation request id returns not found on put or cancel | `backend/tests/reservationRequests.test.js` | `it("Missing reservation request id returns not found on put or cancel")` |
| US-7.4 | Requestor cannot cancel another users reservation request | `backend/tests/reservationRequests.test.js` | `it("Requestor cannot cancel another users reservation request")` |
| US-7.4 | Requestor cannot cancel a non-requested reservation request | `backend/tests/reservationRequests.test.js` | `it("Requestor cannot cancel a non-requested reservation request")` |
| US-7.4 | Admin and area admin cannot cancel a reservation request in Feature 7 | `backend/tests/reservationRequests.test.js` | `it("Admin and area admin cannot cancel a reservation request in Feature 7")` |
| US-7.4 | Cancel request requires confirmation | `frontend/tests/ReservationRequests.test.js` | `it("Cancel request requires confirmation")` |
| US-7.4 | Confirmed reservation request cancel refreshes the list | `frontend/tests/ReservationRequests.test.js` | `it("Confirmed reservation request cancel refreshes the list")` |
| US-7.4 | Failed reservation request cancel preserves the dialog and row | `frontend/tests/ReservationRequests.test.js` | `it("Failed reservation request cancel preserves the dialog and row")` |
| US-7.4 | Keep closes cancel without a request | `frontend/tests/ReservationRequests.test.js` | `it("Keep closes cancel without a request")` |

## Agent implementation request

Copy when asking Cursor to implement this feature (`@` this file):

```text
Implement Feature 7 from @features/feature-7-reservation-requests.md on branch `feature/7-reservation-requests`.

Follow layer order in @features/framework.md (models → routes → backend tests → frontend → frontend tests).
Map every Gherkin scenario in the Test Coverage Map; run `npm test` before finishing.
If API routes, payloads, schema, or product rules changed per this spec, update @features/reference/api.md, @features/reference/data-model.md, and/or @features/reference/behavior.md in the same PR to match shipped code.
Complete Definition of Done and the merge checklist in @features/framework.md.
Do not implement behavior not in this spec.
```

**Reference updates for this feature:** `api.md`, `data-model.md`, `behavior.md`.

## Definition of Done

* [ ] Backend and frontend implemented per this spec (**FR-001**–**FR-024** satisfied)
* [ ] **Success Criteria (SC-001**–**SC-005)** met
* [ ] All mapped tests pass (`npm test`)
* [ ] Test Coverage Map complete
* [ ] `features/reference/data-model.md` updated (if schema changed)
* [ ] `features/reference/api.md` updated (if API changed)
* [ ] `features/reference/behavior.md` updated (if product rules changed)
* [ ] Agility stories and acceptance tests for Feature 7 are created or updated
* [ ] Application code for this feature is handwritten; automated tests may use AI assistance

## Out of Scope

* Google sign-in and roles: [Feature 1](feature-1-user-authentication-authorization.md).
* Creating or editing areas, drivers, or destinations: Features 2, 5, and 6.
* Status changes to `awaiting_vehicle`, `reserved`, or `returned`, vehicle assignment, and mark Returned: [Feature 8 — Request Processing in the catalog](README.md#feature-catalog).
* Reservation emails: [Feature 9 — Reservation Emails in the catalog](README.md#feature-catalog).
* Service queue: [Feature 11 — Weekly Vehicle Schedule in the catalog](README.md#feature-catalog).
