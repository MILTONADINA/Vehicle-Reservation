# Feature: Request Processing

**Feature ID:** 8  
**Branch pattern:** `feature/8-request-processing`  
**Status:** Ready  
**Created:** 2026-10-28  
**Input:** Let admins and area admins process reservation requests through one shared status-change operation—moving trips among Awaiting Vehicle, Reserved, Returned, and Cancelled, assigning an in-area vehicle when reserving—so Feature 9 can hook emails to that same status change.  
**Depends on:** [Feature 4 — Vehicle Management](feature-4-vehicle-management.md), [Feature 7 — Reservation Requests](feature-7-reservation-requests.md)

---

## User Stories

Every story is P1: each one must ship for the assignment’s Request Processing feature.

### US-8.1: View requests for processing

**As a** fleet administrator  
**I want to** see the reservation requests I am allowed to process  
**So that** I can change their status and assign vehicles for my areas

**Priority:** P1  
**Independent test:** Sign in as admin and area_admin, list requests, verify scope and that requestor and maintenance cannot call processing endpoints.  
**Acceptance scenarios:** see ### US-8.1 under Acceptance Criteria

### US-8.2: List candidate vehicles for reserving a request

**As a** fleet administrator  
**I want to** see vehicles that can cover a request being reserved  
**So that** I can choose a valid vehicle before status becomes Reserved

**Priority:** P1  
**Independent test:** Load candidate vehicles for an in-scope request in `requested` or `awaiting_vehicle` and verify area, capacity, and overlap filtering.  
**Acceptance scenarios:** see ### US-8.2 under Acceptance Criteria

### US-8.3: Change reservation request status

**As a** fleet administrator  
**I want to** change a request’s status through one status-change operation, including assigning a vehicle when moving to Reserved and marking Returned  
**So that** processing stays consistent and Feature 9 can email on the same transitions

**Priority:** P1  
**Independent test:** Drive each allowed transition through the status-change endpoint, reject illegal transitions and bad vehicles, and leave vehicleId/statusReason correct.  
**Acceptance scenarios:** see ### US-8.3 under Acceptance Criteria

## Requirements

### Functional Requirements

* **FR-001:** Request processing MUST reuse Feature 1 authentication, Feature 4 Vehicle records, and Feature 7 Reservation Request records. It MUST NOT implement sign-in, vehicle CRUD, requestor create/edit, or email sending.
* **FR-002:** Shared statuses are exactly `requested`, `awaiting_vehicle`, `reserved`, `returned`, and `cancelled` (labels Requested / Awaiting Vehicle / Reserved / Returned / Cancelled). Feature 7 creates `requested` and may cancel own `requested` rows. This feature owns every other status change, including mark Returned.
* **FR-003:** This feature MUST extend `reservation_requests` with nullable vehicleId and nullable statusReason. vehicleId is required when status is `reserved` or `returned` and MUST be null for `requested`, `awaiting_vehicle`, and `cancelled`. statusReason is optional text for admin/area_admin cancellations and MUST be null unless status is `cancelled` by this feature.
* **FR-004:** All processing status updates MUST go through one operation: PUT `/vehicle-t6/reservation-requests/:id/status`. Feature 9 MUST hook emails to this same status-change function/endpoint, not to separate approve/deny routes. This feature MUST NOT expose separate approve or deny endpoints.
* **FR-005:** Allowed transitions for admin/area_admin are: `requested` → `awaiting_vehicle`; `requested` → `reserved`; `requested` → `cancelled`; `awaiting_vehicle` → `reserved`; `awaiting_vehicle` → `cancelled`; `reserved` → `returned`; `reserved` → `cancelled`. All other transitions MUST return 400 `Invalid reservation request data.`
* **FR-006:** Body for the status-change endpoint MUST accept `{ "status": "<next>", "vehicleId": <id>|null, "statusReason": "<text>"|null }`. Properties outside those fields MUST be ignored. When status is `reserved`, vehicleId MUST be a valid candidate vehicle. When status is `awaiting_vehicle` or `returned`, vehicleId MUST be omitted or null except `returned` keeps the existing vehicleId. When status is `cancelled` through this feature, vehicleId MUST become null and statusReason MAY be provided (trimmed, at most 500 characters; blank becomes null).
* **FR-007:** Admin MUST list every reservation request. Area_admin MUST list only requests whose areaId equals that user’s current database areaId. An area_admin with null areaId MUST receive 200 with []. Requestor and maintenance MUST receive 403 for candidate-vehicles and status-change endpoints. Signed-out requests MUST receive 401. Requestor Feature 7 list may still show processed outcomes read-only.
* **FR-008:** List responses MUST include Feature 7 fields plus vehicleId and statusReason. Sort remains departureDate ascending, departureTime ascending with nulls first, then id ascending.
* **FR-009:** GET `/vehicle-t6/reservation-requests/:id/candidate-vehicles` MUST return vehicles the caller may assign when moving that request to `reserved`. A missing or out-of-scope request MUST return 404 `Reservation request with id=<id> not found.` A request whose status is not `requested` or `awaiting_vehicle` MUST return 400 `Invalid reservation request data.`
* **FR-010:** Candidate vehicles MUST satisfy all of: same areaId as the request; passengers greater than or equal to the request’s passengers; and no time overlap with another `reserved` or `returned` request that already has that vehicleId. Overlap uses each request’s departureDate/departureTime and returnDate/returnTime, treating null times as whole-day bounds (00:00 start, 23:59 end). Results MUST sort by make, model, then id. Empty lists MUST be 200 with [].
* **FR-011:** Area_admin candidate and status-change actions MUST stay inside that user’s areaId. Admin may use any vehicle that otherwise meets FR-010. Scope MUST come from the database, not client claims.
* **FR-012:** Moving to `reserved` MUST set status `reserved` and vehicleId. Moving to `awaiting_vehicle` MUST set that status and keep vehicleId null. Moving to `returned` MUST require current status `reserved`, keep vehicleId, and set status `returned`. Moving to `cancelled` through this feature MUST set status `cancelled`, clear vehicleId, and store statusReason when provided.
* **FR-013:** A missing vehicle on reserve MUST return 404 `Vehicle with id=<id> not found.` A vehicle that fails area, capacity, or overlap rules MUST return 400 `Invalid reservation request data.` Concurrent overlap between candidate load and status change MUST also return 400.
* **FR-014:** Route ids MUST be positive safe integers; invalid ids MUST return 400 `Reservation request id must be a positive integer.` or `Vehicle id must be a positive integer.` as applicable. Missing or out-of-scope requests on status change MUST return 404 `Reservation request with id=<id> not found.`
* **FR-015:** Foreign key from reservation_requests.vehicleId to vehicles.id MUST use `ON DELETE RESTRICT`. Deleting a vehicle still referenced by a `reserved` or `returned` request MUST return 409 `Vehicle is in use.` This feature owns that 409 test because it adds the vehicle reference.
* **FR-016:** Service queue behavior stays in Feature 11. This feature MUST NOT implement a service queue.
* **FR-017:** The processing UI continues on `/reservation-requests` for admin and area_admin. This feature adds status-change actions (including Mark returned) on in-scope rows and shows Vehicle and Status reason columns when present. Requestors do not get those actions.
* **FR-018:** Status-change dialogs MUST collect the next status, vehicle when reserving, and optional reason when cancelling; validate before submit; show progress; block duplicate submit; close and refresh on success; keep values and show API message or fallback on failure. Cancel/Keep on dialogs MUST send no write.
* **FR-019:** Database failures MUST return 500 `Reservation request failed.` without SQL details or partial status/vehicle writes.

## Assumptions

* Features 4 and 7 are on `dev` before this feature is implemented.
* Area admins process only their area’s requests and may assign only that area’s vehicles.
* Passenger capacity uses Feature 4 `vehicles.passengers` compared to Feature 7 `reservation_requests.passengers`.
* Feature 9 sends emails by observing the same status-change operation; this feature does not send mail.
* Requestor cancel of `requested` remains Feature 7; admin/area_admin cancel of `requested`, `awaiting_vehicle`, or `reserved` uses this feature’s status-change operation (clearing vehicleId when cancelling a reserved trip).

## Edge Cases

* An area admin with no area assignment sees an empty list and cannot change status.
* A vehicle that seats enough people but belongs to another area cannot be reserved.
* A vehicle already on an overlapping reserved/returned trip cannot be reserved again.
* Candidate list can be empty; reserve must still validate server-side.
* Illegal status transitions leave the row unchanged.

## Success Criteria

* **SC-001:** Candidate and status-change contracts match this spec, including vehicleId and the five shared statuses.
* **SC-002:** Role and area scope rules hold for every mapped acceptance case.
* **SC-003:** Invalid vehicles, overlap conflicts, and illegal transitions do not change data.
* **SC-004:** Status-change dialogs and list columns have matching frontend tests and a manual check.
* **SC-005:** Every scenario has an exact-name test before merge.

## Data Ownership & Isolation

| Operation | admin | area_admin | requestor / maintenance |
|-----------|-------|------------|-------------------------|
| List for processing | All requests | Own-area requests only; [] if areaId null | 403 on processing endpoints |
| Candidate vehicles | Any qualifying vehicle for an in-scope request | Qualifying vehicles in own area for an own-area request | 403 |
| Status change | Any in-scope request per allowed transitions | Own-area only; otherwise 404 | 403 |

Authentication comes from [Feature 1](feature-1-user-authentication-authorization.md). Vehicles come from [Feature 4](feature-4-vehicle-management.md). Requests come from [Feature 7](feature-7-reservation-requests.md).

## Key Entities

* **Reservation request:** Feature 7 trip request; this feature advances shared status values, optional statusReason, and optional vehicle assignment.
* **Vehicle:** Feature 4 fleet unit chosen when status becomes `reserved`; must match request area and seat capacity and must not overlap another reserved/returned assignment.

## API Requirements

All endpoints reuse [Feature 1](feature-1-user-authentication-authorization.md) authentication.

| Method | Endpoint | Allowed role | Success |
|--------|----------|--------------|---------|
| GET | `/vehicle-t6/reservation-requests` | admin; area_admin (scoped) | `200`, array including `vehicleId` and `statusReason` |
| GET | `/vehicle-t6/reservation-requests/:id/candidate-vehicles` | admin; area_admin (scoped) | `200`, array of Vehicle objects |
| PUT | `/vehicle-t6/reservation-requests/:id/status` | admin; area_admin (scoped) | `200`, updated ReservationRequest |

Status-change examples:

```json
{ "status": "awaiting_vehicle" }
{ "status": "reserved", "vehicleId": 12 }
{ "status": "returned" }
{ "status": "cancelled", "statusReason": "No vehicle available that weekend." }
```

| Failure | Status | Message |
|---------|--------|---------|
| No valid session | 401 | Feature 1 `Unauthorized.` |
| Disallowed role | 403 | Feature 1 `Forbidden.` |
| Invalid body, illegal transition, capacity/area/overlap failure | 400 | `Invalid reservation request data.` ; bad ids use `Reservation request id must be a positive integer.` / `Vehicle id must be a positive integer.` |
| Missing or out-of-scope request | 404 | `Reservation request with id=<id> not found.` |
| Missing vehicle when reserving | 404 | `Vehicle with id=<id> not found.` |
| Delete of Vehicle still referenced by reserved/returned request | 409 | `Vehicle is in use.` |
| Other database failure | 500 | `Reservation request failed.` |

## Screen Requirements

* Continue `/reservation-requests` from Feature 7. Admin and area_admin see status-change actions on in-scope rows, including **Mark returned** when status is Reserved.
* List columns add **Vehicle** and **Status reason** alongside Feature 7 columns.
* Status-change dialog collects next status, Vehicle combo (from candidates) when choosing Reserved, and optional Status reason when choosing Cancelled; validates; shows progress; refreshes on success.
* Requestor list may show Status, Vehicle, and Status reason as read-only after processing with no processing actions.

## Data Model Requirements

Alter `reservation_requests` from Feature 7:

| Field | Type | Rule |
|-------|------|------|
| vehicleId | Integer | Nullable FK to `vehicles.id`, `ON DELETE RESTRICT`; set for `reserved`/`returned`; null otherwise |
| statusReason | String(500) | Nullable; optional when this feature cancels; null for other statuses |
| status | String(32) | Required; `requested`, `awaiting_vehicle`, `reserved`, `returned`, or `cancelled` |

Register ReservationRequest belongsTo Vehicle. Do not remove Feature 7 associations. No email or service-queue tables are added here.

## Acceptance Criteria (Gherkin)

### US-8.1 — View requests for processing

#### Scenario: Admin lists every reservation request for processing
* **Given** requests in multiple statuses and areas exist
* **When** an admin requests GET /vehicle-t6/reservation-requests
* **Then** every request is returned in departure order including status, vehicleId, and statusReason

#### Scenario: Area admin lists only its area requests for processing
* **Given** an area_admin has areaId 2 and requests exist for areas 1 and 2
* **When** that user lists reservation requests
* **Then** the response is 200 with only area 2 requests

#### Scenario: Area admin without an assignment gets an empty processing list
* **Given** an area_admin has null areaId and requests exist
* **When** that user lists reservation requests
* **Then** the response is 200 with []

#### Scenario: Requestor and maintenance cannot call processing endpoints
* **Given** the signed-in role is requestor or maintenance
* **When** each role calls candidate-vehicles or status change for a request
* **Then** each response is 403 with the Feature 1 Forbidden. message and nothing changes

#### Scenario: Processing API requires a session
* **Given** no valid application session is supplied
* **When** candidate-vehicles or status change is sent
* **Then** each response is 401 with the Feature 1 Unauthorized. message and nothing changes

#### Scenario: Processing page shows status actions on in-scope rows
* **Given** an admin or area_admin has in-scope requests
* **When** the user opens /reservation-requests
* **Then** status-change actions appear for allowed transitions, including Mark returned on reserved rows, and Vehicle and Status reason columns appear

#### Scenario: Requestor sees processed outcomes without processing actions
* **Given** a requestor owns reserved and cancelled requests
* **When** the requestor opens /reservation-requests
* **Then** status, vehicle, and status reason are visible as read-only and processing actions are not available

### US-8.2 — List candidate vehicles for reserving a request

#### Scenario: Admin lists candidate vehicles for a request awaiting reservation
* **Given** request id 1 is requested or awaiting_vehicle, needs 4 passengers in area 2, and qualifying vehicles exist
* **When** an admin requests GET /vehicle-t6/reservation-requests/1/candidate-vehicles
* **Then** the response is 200 with only area 2 vehicles whose passengers are at least 4, sorted by make, model, then id

#### Scenario: Area admin lists candidate vehicles in its area
* **Given** an area_admin has areaId 2 and request id 1 belongs to area 2 with a reservable status
* **When** that user requests candidate vehicles
* **Then** the response is 200 with only qualifying area 2 vehicles

#### Scenario: Vehicles below passenger capacity are omitted
* **Given** request id 1 needs 8 passengers and a same-area vehicle seats 6
* **When** candidate vehicles are requested
* **Then** that vehicle is not included

#### Scenario: Vehicles with overlapping reserved trips are omitted
* **Given** vehicle 9 is reserved on another request that overlaps request id 1
* **When** candidate vehicles are requested for request 1
* **Then** vehicle 9 is not included

#### Scenario: Candidate vehicles for a missing request are rejected
* **Given** no reservation request has id 9999
* **When** an admin requests candidate vehicles for 9999
* **Then** the response is 404 with message Reservation request with id=9999 not found.

#### Scenario: Candidate vehicles for a non-reservable status are rejected
* **Given** reservation request id 4 is returned
* **When** an admin requests candidate vehicles for request 4
* **Then** the response is 400 with message Invalid reservation request data.

#### Scenario: Area admin cannot load candidates for another area request
* **Given** an area_admin has areaId 2 and request id 3 belongs to area 1
* **When** that user requests candidate vehicles for request 3
* **Then** the response is 404 with message Reservation request with id=3 not found.

#### Scenario: Reserve dialog loads candidate vehicles
* **Given** an admin views an in-scope request in requested or awaiting_vehicle
* **When** the admin chooses status Reserved
* **Then** the status-change dialog loads candidate vehicles into the Vehicle combo box

### US-8.3 — Change reservation request status

#### Scenario: Admin moves a requested trip to awaiting vehicle
* **Given** request id 1 has status requested
* **When** an admin sends PUT /vehicle-t6/reservation-requests/1/status with status awaiting_vehicle
* **Then** the response is 200 with status awaiting_vehicle and vehicleId null

#### Scenario: Admin reserves a requested trip with a valid vehicle
* **Given** request id 1 has status requested and vehicle 12 is a valid candidate
* **When** an admin sends status reserved with vehicleId 12
* **Then** the response is 200 with status reserved and vehicleId 12

#### Scenario: Admin reserves a trip with a valid vehicle
* **Given** request id 1 is awaiting_vehicle and vehicle 12 is a valid candidate
* **When** an admin sends status reserved with vehicleId 12
* **Then** the response is 200 with status reserved and vehicleId 12

#### Scenario: Area admin reserves a trip in its area
* **Given** an area_admin has areaId 2, request id 1 belongs to area 2, and vehicle 12 is a valid candidate
* **When** that user sends status reserved with vehicleId 12
* **Then** the response is 200 with status reserved and vehicleId 12

#### Scenario: Admin marks a reserved trip returned
* **Given** request id 1 has status reserved and vehicleId 12
* **When** an admin sends status returned
* **Then** the response is 200 with status returned and vehicleId 12 unchanged

#### Scenario: Admin cancels an awaiting vehicle trip with a reason
* **Given** request id 1 has status awaiting_vehicle
* **When** an admin sends status cancelled with statusReason No vehicle available that weekend.
* **Then** the response is 200 with status cancelled, vehicleId null, and the stored statusReason

#### Scenario: Admin cancels a reserved trip and clears the vehicle
* **Given** request id 1 has status reserved and vehicleId 12
* **When** an admin sends status cancelled with statusReason Traveler withdrew after assignment.
* **Then** the response is 200 with status cancelled, vehicleId null, and the stored statusReason

#### Scenario: Illegal status transition is rejected
* **Given** request id 1 has status requested
* **When** an admin sends status returned
* **Then** the response is 400 with message Invalid reservation request data. and the request is unchanged

#### Scenario: Reserve rejects a vehicle from another area
* **Given** request id 1 belongs to area 2 and vehicle 8 belongs to area 1
* **When** an admin sends status reserved with vehicleId 8
* **Then** the response is 400 with message Invalid reservation request data. and the request is unchanged

#### Scenario: Reserve rejects an undersized vehicle
* **Given** request id 1 needs 10 passengers and vehicle 7 seats 6
* **When** an admin sends status reserved with vehicleId 7
* **Then** the response is 400 with message Invalid reservation request data. and the request is unchanged

#### Scenario: Reserve rejects an overlapping vehicle assignment
* **Given** vehicle 9 is already reserved on an overlapping request
* **When** an admin sends status reserved with vehicleId 9 for request id 1
* **Then** the response is 400 with message Invalid reservation request data. and request 1 is unchanged

#### Scenario: Reserve rejects a missing vehicle
* **Given** no vehicle has id 9999
* **When** an admin sends status reserved with vehicleId 9999
* **Then** the response is 404 with message Vehicle with id=9999 not found. and the request is unchanged

#### Scenario: Area admin cannot change status for another area request
* **Given** an area_admin has areaId 2 and request id 3 belongs to area 1
* **When** that user sends any status change for request 3
* **Then** the response is 404 with message Reservation request with id=3 not found. and the request is unchanged

#### Scenario: Referenced vehicle cannot be deleted while in use
* **Given** a reserved or returned request references vehicle id 12
* **When** an admin sends DELETE /vehicle-t6/vehicles/12
* **Then** the response is 409 with message Vehicle is in use. and both records remain

#### Scenario: Invalid reservation request route id is rejected on status change
* **Given** an admin is signed in
* **When** status change is sent with route id abc, 0, -1, or an unsafe integer
* **Then** each response is 400 with message Reservation request id must be a positive integer.

#### Scenario: Saving a status change refreshes the list
* **Given** a valid status-change dialog submission succeeds
* **When** the admin confirms the change
* **Then** the dialog shows progress while pending, closes on success, and reloads the list with the new status

#### Scenario: Failed status change keeps the dialog open
* **Given** status change is submitted and the API returns an error message or no message
* **When** the request finishes
* **Then** the dialog stays open and shows the API message or Reservation request could not be updated.

#### Scenario: Cancel closes status change without a request
* **Given** the status-change dialog is open
* **When** the user selects Cancel
* **Then** no status-change request is sent and the reservation request is unchanged

## Test Coverage Map

Exact `it(...)` titles. Backend file: `backend/tests/requestProcessing.test.js`. Frontend file: `frontend/tests/RequestProcessing.test.js`.

| Story | Scenario | File | Exact test name |
|-------|----------|------|-----------------|
| US-8.1 | Admin lists every reservation request for processing | `backend/tests/requestProcessing.test.js` | `it("Admin lists every reservation request for processing")` |
| US-8.1 | Area admin lists only its area requests for processing | `backend/tests/requestProcessing.test.js` | `it("Area admin lists only its area requests for processing")` |
| US-8.1 | Area admin without an assignment gets an empty processing list | `backend/tests/requestProcessing.test.js` | `it("Area admin without an assignment gets an empty processing list")` |
| US-8.1 | Requestor and maintenance cannot call processing endpoints | `backend/tests/requestProcessing.test.js` | `it("Requestor and maintenance cannot call processing endpoints")` |
| US-8.1 | Processing API requires a session | `backend/tests/requestProcessing.test.js` | `it("Processing API requires a session")` |
| US-8.1 | Processing page shows status actions on in-scope rows | `frontend/tests/RequestProcessing.test.js` | `it("Processing page shows status actions on in-scope rows")` |
| US-8.1 | Requestor sees processed outcomes without processing actions | `frontend/tests/RequestProcessing.test.js` | `it("Requestor sees processed outcomes without processing actions")` |
| US-8.2 | Admin lists candidate vehicles for a request awaiting reservation | `backend/tests/requestProcessing.test.js` | `it("Admin lists candidate vehicles for a request awaiting reservation")` |
| US-8.2 | Area admin lists candidate vehicles in its area | `backend/tests/requestProcessing.test.js` | `it("Area admin lists candidate vehicles in its area")` |
| US-8.2 | Vehicles below passenger capacity are omitted | `backend/tests/requestProcessing.test.js` | `it("Vehicles below passenger capacity are omitted")` |
| US-8.2 | Vehicles with overlapping reserved trips are omitted | `backend/tests/requestProcessing.test.js` | `it("Vehicles with overlapping reserved trips are omitted")` |
| US-8.2 | Candidate vehicles for a missing request are rejected | `backend/tests/requestProcessing.test.js` | `it("Candidate vehicles for a missing request are rejected")` |
| US-8.2 | Candidate vehicles for a non-reservable status are rejected | `backend/tests/requestProcessing.test.js` | `it("Candidate vehicles for a non-reservable status are rejected")` |
| US-8.2 | Area admin cannot load candidates for another area request | `backend/tests/requestProcessing.test.js` | `it("Area admin cannot load candidates for another area request")` |
| US-8.2 | Reserve dialog loads candidate vehicles | `frontend/tests/RequestProcessing.test.js` | `it("Reserve dialog loads candidate vehicles")` |
| US-8.3 | Admin moves a requested trip to awaiting vehicle | `backend/tests/requestProcessing.test.js` | `it("Admin moves a requested trip to awaiting vehicle")` |
| US-8.3 | Admin reserves a requested trip with a valid vehicle | `backend/tests/requestProcessing.test.js` | `it("Admin reserves a requested trip with a valid vehicle")` |
| US-8.3 | Admin reserves a trip with a valid vehicle | `backend/tests/requestProcessing.test.js` | `it("Admin reserves a trip with a valid vehicle")` |
| US-8.3 | Area admin reserves a trip in its area | `backend/tests/requestProcessing.test.js` | `it("Area admin reserves a trip in its area")` |
| US-8.3 | Admin marks a reserved trip returned | `backend/tests/requestProcessing.test.js` | `it("Admin marks a reserved trip returned")` |
| US-8.3 | Admin cancels an awaiting vehicle trip with a reason | `backend/tests/requestProcessing.test.js` | `it("Admin cancels an awaiting vehicle trip with a reason")` |
| US-8.3 | Admin cancels a reserved trip and clears the vehicle | `backend/tests/requestProcessing.test.js` | `it("Admin cancels a reserved trip and clears the vehicle")` |
| US-8.3 | Illegal status transition is rejected | `backend/tests/requestProcessing.test.js` | `it("Illegal status transition is rejected")` |
| US-8.3 | Reserve rejects a vehicle from another area | `backend/tests/requestProcessing.test.js` | `it("Reserve rejects a vehicle from another area")` |
| US-8.3 | Reserve rejects an undersized vehicle | `backend/tests/requestProcessing.test.js` | `it("Reserve rejects an undersized vehicle")` |
| US-8.3 | Reserve rejects an overlapping vehicle assignment | `backend/tests/requestProcessing.test.js` | `it("Reserve rejects an overlapping vehicle assignment")` |
| US-8.3 | Reserve rejects a missing vehicle | `backend/tests/requestProcessing.test.js` | `it("Reserve rejects a missing vehicle")` |
| US-8.3 | Area admin cannot change status for another area request | `backend/tests/requestProcessing.test.js` | `it("Area admin cannot change status for another area request")` |
| US-8.3 | Referenced vehicle cannot be deleted while in use | `backend/tests/requestProcessing.test.js` | `it("Referenced vehicle cannot be deleted while in use")` |
| US-8.3 | Invalid reservation request route id is rejected on status change | `backend/tests/requestProcessing.test.js` | `it("Invalid reservation request route id is rejected on status change")` |
| US-8.3 | Saving a status change refreshes the list | `frontend/tests/RequestProcessing.test.js` | `it("Saving a status change refreshes the list")` |
| US-8.3 | Failed status change keeps the dialog open | `frontend/tests/RequestProcessing.test.js` | `it("Failed status change keeps the dialog open")` |
| US-8.3 | Cancel closes status change without a request | `frontend/tests/RequestProcessing.test.js` | `it("Cancel closes status change without a request")` |

## Agent implementation request

Copy when asking Cursor to implement this feature (`@` this file):

```text
Implement Feature 8 from @features/feature-8-request-processing.md on branch `feature/8-request-processing`.

Follow layer order in @features/framework.md (models → routes → backend tests → frontend → frontend tests).
Map every Gherkin scenario in the Test Coverage Map; run `npm test` before finishing.
If API routes, payloads, schema, or product rules changed per this spec, update @features/reference/api.md, @features/reference/data-model.md, and/or @features/reference/behavior.md in the same PR to match shipped code.
Complete Definition of Done and the merge checklist in @features/framework.md.
Do not implement behavior not in this spec.
```

**Reference updates for this feature:** `api.md`, `data-model.md`, `behavior.md`.

## Definition of Done

* [ ] Backend and frontend implemented per this spec (**FR-001**–**FR-019** satisfied)
* [ ] **Success Criteria (SC-001**–**SC-005)** met
* [ ] All mapped tests pass (`npm test`)
* [ ] Test Coverage Map complete
* [ ] `features/reference/data-model.md` updated (if schema changed)
* [ ] `features/reference/api.md` updated (if API changed)
* [ ] `features/reference/behavior.md` updated (if product rules changed)
* [ ] Agility stories and acceptance tests for Feature 8 are created or updated
* [ ] Application code for this feature is handwritten; automated tests may use AI assistance

## Out of Scope

* Creating reservation requests and requestor cancel of `requested`: [Feature 7](feature-7-reservation-requests.md).
* Creating or editing vehicles: [Feature 4](feature-4-vehicle-management.md).
* Sending reservation emails: [Feature 9 — Reservation Emails in the catalog](README.md#feature-catalog). Feature 9 hooks the status-change operation defined here.
* Service queue: [Feature 11 — Weekly Vehicle Schedule in the catalog](README.md#feature-catalog).
* Vehicle issue reports and mileage/service logs: Features 10 and 12 in the [catalog](README.md#feature-catalog).
