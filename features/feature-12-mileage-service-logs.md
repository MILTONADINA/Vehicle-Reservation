# Feature: Mileage & Service Logs

**Feature ID:** 12  
**Branch pattern:** `feature/12-mileage-service-logs`  
**Status:** Ready  
**Created:** 2026-10-28  
**Input:** Let maintenance staff (and admins) see the vehicle list, log mileage with a date and odometer reading, and log services such as repair, oil change, or tire replacement.  
**Depends on:** [Feature 1 — User Authentication & Authorization](feature-1-user-authentication-authorization.md), [Feature 4 — Vehicle Management](feature-4-vehicle-management.md)

---

## User Stories

Every story is P1: each one must ship for the assignment’s mileage and service-log work.

### US-12.1: View vehicles for logging

**As a** maintenance person  
**I want to** see the fleet vehicles  
**So that** I can open one and record mileage or service work

**Priority:** P1  
**Independent test:** List vehicles as maintenance and as admin; reject requestor and area_admin  
**Acceptance scenarios:** see ### US-12.1 under Acceptance Criteria

### US-12.2: Log vehicle mileage

**As a** maintenance person  
**I want to** save a mileage reading with a date  
**So that** the odometer history for that vehicle stays current

**Priority:** P1  
**Independent test:** Create a valid mileage log, reject a lower reading than the latest log, and reject disallowed roles  
**Acceptance scenarios:** see ### US-12.2 under Acceptance Criteria

### US-12.3: Log a vehicle service

**As a** maintenance person  
**I want to** record repair, oil change, or tire replacement on a vehicle  
**So that** service history is available later

**Priority:** P1  
**Independent test:** Create each service type with a date, list them newest first, and reject invalid types  
**Acceptance scenarios:** see ### US-12.3 under Acceptance Criteria

### US-12.4: Restrict mileage and service log access

**As a** system administrator  
**I want** only admin and maintenance to use these logs  
**So that** requestors and area admins cannot change fleet service records

**Priority:** P1  
**Independent test:** Confirm 401/403 and frontend redirects for signed-out, requestor, and area_admin users  
**Acceptance scenarios:** see ### US-12.4 under Acceptance Criteria

## Requirements

### Functional Requirements

* **FR-001:** This feature MUST reuse Feature 1 authentication and roles and the Vehicle records from Feature 4. It MUST NOT create vehicles, assign areas, create reservation requests, or send email.
* **FR-002:** A mileage log MUST store vehicleId, logDate, mileage, loggedByUserId, and createdAt. The server MUST generate id. logDate MUST be a calendar date in `YYYY-MM-DD` form. mileage MUST be an integer from 0 through 2,000,000.
* **FR-003:** When the vehicle already has mileage logs, a new mileage value MUST be greater than or equal to the latest log’s mileage for that vehicle (latest by logDate, then id). A lower reading MUST return 409 `Mileage cannot be lower than the latest reading.` without saving.
* **FR-004:** A service log MUST store vehicleId, serviceDate, serviceType, optional note, loggedByUserId, and createdAt. The server MUST generate id. serviceDate MUST be `YYYY-MM-DD`. serviceType MUST be one of `repair`, `oil_change`, or `tire_replacement`.
* **FR-005:** note MUST be optional. When present it MUST be at most 1,000 characters after trimming outer spaces and MUST keep its letter case and internal spaces. A blank or whitespace-only note MUST be stored as null. Request-body properties outside the allowed fields MUST be ignored on create.
* **FR-006:** Admin and maintenance MUST list every vehicle for logging, create mileage logs, create service logs, and list mileage and service history for any vehicle. Requestor and area_admin MUST receive the Feature 1 403 response for every Feature 12 endpoint. Signed-out requests MUST receive 401.
* **FR-007:** Create and list routes MUST use a positive safe-integer vehicle id. Invalid ids MUST return 400 `Vehicle id must be a positive integer.` A missing vehicle MUST return 404 `Vehicle with id=<id> not found.`
* **FR-008:** Mileage lists for a vehicle MUST sort by logDate descending, then id descending. Service lists MUST sort by serviceDate descending, then id descending. Empty lists MUST be 200 with [].
* **FR-009:** The maintenance vehicle list MUST reuse Feature 4 vehicle fields needed to identify a unit (id, make, model, year, plateNumber, color, areaId) sorted by make, then model, then id. It MUST NOT expose create/edit/delete vehicle actions from Feature 4.
* **FR-010:** loggedByUserId MUST be the current authenticated user id from the database session. Clients MUST NOT choose loggedByUserId.
* **FR-011:** MenuBar MUST show **Maintenance** for admin and maintenance only. The Maintenance page and vehicle log detail behavior MUST match Screen Requirements. Signed-out visitors MUST go to Login. Requestor and area_admin MUST be sent Home.
* **FR-012:** Add mileage and add service dialogs MUST validate before submit, show progress, block duplicate saves, close and refresh on success, and keep values with the API message or the specified fallback on failure. Cancel MUST send no write.
* **FR-013:** List loading MUST show progress. Empty texts MUST appear only after successful empty responses. Load failures MUST show the API message or fallback without claiming the list is empty.
* **FR-014:** Database failures MUST return 500 `Mileage request failed.` for mileage endpoints and 500 `Service log request failed.` for service endpoints, without SQL details or partial writes.
* **FR-015:** Viewing Feature 10 `maintenance_need` issues stays on the Feature 10 Issues page. This feature MUST NOT re-implement that list.
* **FR-016:** Foreign keys from `mileage_logs` and `service_logs` MUST use `ON DELETE RESTRICT` for vehicleId and loggedByUserId. Deleting a vehicle that still has mileage or service logs MUST return 409 `Vehicle is in use.` Deleting a user who logged a mileage or service entry MUST return 409 `User is in use.` This feature owns those 409 tests because it adds the references.

## Assumptions

* North’s maintenance person views vehicles, logs mileage (date, current mileage), and logs services (repair, oil change, tire replacement). Admin can do the same so fleet oversight is not blocked when maintenance is offline.
* Area admins manage area fleet records in Feature 4 but do not write mileage or service logs in this feature.
* Odometer readings do not go backward relative to the latest stored reading for that vehicle.
* Feature 10 already lets maintenance read `maintenance_need` issue reports. This feature does not duplicate that API.
* Deleting or editing past logs is out of scope.

## Edge Cases

* The first mileage log on a vehicle may use any mileage in range; there is no prior reading to compare.
* Two logs on the same date are allowed when mileage does not go backward.
* A blank service note is stored as null.
* Failed creates leave prior logs unchanged.
* A forged loggedByUserId in the body does not change the saved reporter.
* Deleting a referenced vehicle or logger user is blocked with 409; existing logs stay.

## Success Criteria

* **SC-001:** Mileage and service create/list contracts match this spec, including non-decreasing mileage.
* **SC-002:** Only admin and maintenance succeed on every mapped access case.
* **SC-003:** Invalid dates, types, vehicle ids, and lower mileage readings do not change data.
* **SC-004:** Dialog, loading, empty, and error UI cases have matching frontend tests and a manual check.
* **SC-005:** Referenced vehicle and logger deletion returns the documented 409 responses, and every scenario has an exact-name test before merge.

## Data Ownership & Isolation

| Operation | admin | maintenance | area_admin / requestor |
|-----------|-------|-------------|------------------------|
| List vehicles for logging | All vehicles | All vehicles | 403 |
| List/create mileage logs | Any vehicle | Any vehicle | 403 |
| List/create service logs | Any vehicle | Any vehicle | 403 |

Authentication comes from [Feature 1](feature-1-user-authentication-authorization.md). Vehicles come from [Feature 4](feature-4-vehicle-management.md).

## Key Entities

* **Mileage log:** one odometer reading for a vehicle on a date.
* **Service log:** one service event for a vehicle on a date, typed as repair, oil change, or tire replacement.

## API Requirements

All endpoints reuse [Feature 1](feature-1-user-authentication-authorization.md) authentication. No GET-by-id for a single log is introduced. No update or delete log endpoints are introduced.

| Method | Endpoint | Allowed role | Success |
|--------|----------|--------------|---------|
| GET | `/vehicle-t6/maintenance/vehicles` | admin, maintenance | `200`, array of vehicle summary objects |
| GET | `/vehicle-t6/vehicles/:vehicleId/mileage-logs` | admin, maintenance | `200`, array of MileageLog objects |
| POST | `/vehicle-t6/vehicles/:vehicleId/mileage-logs` | admin, maintenance | `201`, new MileageLog object |
| GET | `/vehicle-t6/vehicles/:vehicleId/service-logs` | admin, maintenance | `200`, array of ServiceLog objects |
| POST | `/vehicle-t6/vehicles/:vehicleId/service-logs` | admin, maintenance | `201`, new ServiceLog object |

Vehicle summary object: `{ "id", "make", "model", "year", "plateNumber", "color", "areaId" }`.

POST mileage body:

```json
{
  "logDate": "2026-10-28",
  "mileage": 45210
}
```

MileageLog object:

```json
{
  "id": 1,
  "vehicleId": 3,
  "logDate": "2026-10-28",
  "mileage": 45210,
  "loggedByUserId": 12,
  "createdAt": "2026-10-28T15:00:00.000Z"
}
```

POST service body:

```json
{
  "serviceDate": "2026-10-28",
  "serviceType": "oil_change",
  "note": "Synthetic oil, filter replaced."
}
```

ServiceLog object:

```json
{
  "id": 1,
  "vehicleId": 3,
  "serviceDate": "2026-10-28",
  "serviceType": "oil_change",
  "note": "Synthetic oil, filter replaced.",
  "loggedByUserId": 12,
  "createdAt": "2026-10-28T15:05:00.000Z"
}
```

| Failure | Status | Message |
|---------|--------|---------|
| No valid session | 401 | Feature 1 `Unauthorized.` |
| Disallowed role | 403 | Feature 1 `Forbidden.` |
| Invalid mileage body or date | 400 | `Invalid mileage data.` |
| Invalid service body, type, or date | 400 | `Invalid service log data.` |
| Invalid vehicle route id | 400 | `Vehicle id must be a positive integer.` |
| Missing vehicle | 404 | `Vehicle with id=<id> not found.` |
| Mileage lower than latest reading | 409 | `Mileage cannot be lower than the latest reading.` |
| Delete of vehicle that still has mileage or service logs | 409 | `Vehicle is in use.` |
| Delete of user who logged a mileage or service entry | 409 | `User is in use.` |
| Other database failure on mileage | 500 | `Mileage request failed.` |
| Other database failure on service logs | 500 | `Service log request failed.` |

## Screen Requirements

* `/maintenance`, route name `maintenance`, heading **Maintenance**. MenuBar shows **Maintenance** for admin and maintenance only. Signed-out visitors follow Feature 1 Login redirect. Requestor and area_admin are sent Home.
* The Maintenance page lists every vehicle summary: make, model, year, plate, color. Choosing a row opens `/maintenance/vehicles/:vehicleId`, route name `maintenance-vehicle`, heading with that vehicle’s make, model, and plate.
* The vehicle log page has **Mileage** and **Services** sections, each with its list and an add action: **Add mileage** and **Add service**.
* **Add mileage** dialog: **Date**, **Mileage**, **Save**, **Cancel**. Success closes and refreshes the mileage list. Failure keeps values and shows the API message or `Mileage could not be saved.`
* **Add service** dialog: **Date**, **Service type** (combo: Repair, Oil change, Tire replacement), optional **Note**, **Save**, **Cancel**. Success closes and refreshes the service list. Failure keeps values and shows the API message or `Service log could not be saved.`
* Mileage rows show date, mileage, and logger when available. Service rows show date, type label, and note. Empty mileage text: `No mileage logs found.` Empty services text: `No service logs found.` Only after successful empty loads. Vehicle list empty text: `No vehicles found.` Load failures show the API message or `Vehicles could not be loaded.` / `Mileage could not be loaded.` / `Service logs could not be loaded.`
* A short link or note may point maintainers to Feature 10 **Issues** for `maintenance_need` reports. This page does not embed that list.

## Data Model Requirements

Add `mileage_logs`:

| Field | Type | Rule |
|-------|------|------|
| id | Integer | Auto-generated primary key |
| vehicleId | Integer | Required foreign key to `vehicles.id`, `ON DELETE RESTRICT` |
| logDate | Date only | Required; `YYYY-MM-DD` |
| mileage | Integer | Required; 0 through 2,000,000 |
| loggedByUserId | Integer | Required foreign key to `users.id`, `ON DELETE RESTRICT` |
| createdAt | DateTime | Server-generated create timestamp |

Add `service_logs`:

| Field | Type | Rule |
|-------|------|------|
| id | Integer | Auto-generated primary key |
| vehicleId | Integer | Required foreign key to `vehicles.id`, `ON DELETE RESTRICT` |
| serviceDate | Date only | Required; `YYYY-MM-DD` |
| serviceType | Enum | `repair`, `oil_change`, `tire_replacement` |
| note | String(1000) | Nullable; trimmed; blank becomes null |
| loggedByUserId | Integer | Required foreign key to `users.id`, `ON DELETE RESTRICT` |
| createdAt | DateTime | Server-generated create timestamp |

Register MileageLog and ServiceLog belongsTo Vehicle and belongsTo User as logger in `models/index.js`. This feature does not add columns to `vehicles`.

## Acceptance Criteria (Gherkin)

### US-12.1 — View vehicles for logging

#### Scenario: Maintenance lists every vehicle for logging
* **Given** vehicles exist in more than one area
* **When** a maintenance user requests GET /vehicle-t6/maintenance/vehicles
* **Then** the response is 200 with every vehicle summary sorted by make, then model, then id

#### Scenario: Admin lists every vehicle for logging
* **Given** vehicles exist
* **When** an admin requests GET /vehicle-t6/maintenance/vehicles
* **Then** the response is 200 with every vehicle summary

#### Scenario: Empty maintenance vehicle list is returned
* **Given** there are no vehicles
* **When** a maintenance user lists maintenance vehicles
* **Then** the response is 200 with []

#### Scenario: Maintenance page shows vehicle rows
* **Given** GET /maintenance/vehicles returns vehicle summaries
* **When** a maintenance user opens /maintenance from MenuBar
* **Then** each vehicle shows make, model, year, and plate

#### Scenario: Maintenance page distinguishes loading empty and failed states
* **Given** the vehicle list is pending, then succeeds with []
* **When** the page renders each state
* **Then** progress appears while pending and No vehicles found. appears only after success

#### Scenario: Maintenance vehicle list failure does not show empty
* **Given** GET /maintenance/vehicles fails with an API message or no response message
* **When** the list request completes
* **Then** the page shows the message or Vehicles could not be loaded. and does not show No vehicles found.

### US-12.2 — Log vehicle mileage

#### Scenario: Maintenance creates a mileage log
* **Given** vehicle id 3 exists
* **When** a maintenance user posts logDate 2026-10-28 and mileage 45210
* **Then** the response is 201 with generated id, vehicleId 3, the saved date and mileage, and loggedByUserId of that user

#### Scenario: First mileage log accepts any reading in range
* **Given** vehicle id 3 has no mileage logs
* **When** a maintenance user posts mileage 10
* **Then** the response is 201 with mileage 10

#### Scenario: Mileage equal to the latest reading is allowed
* **Given** vehicle id 3 latest mileage log is 45210
* **When** a maintenance user posts mileage 45210 on a new date
* **Then** the response is 201

#### Scenario: Mileage lower than the latest reading is rejected
* **Given** vehicle id 3 latest mileage log is 45210
* **When** a maintenance user posts mileage 45000
* **Then** the response is 409 with message Mileage cannot be lower than the latest reading. and no log is stored

#### Scenario: Invalid mileage data is rejected
* **Given** vehicle id 3 exists
* **When** a mileage log is posted with a missing date, negative mileage, or non-integer mileage
* **Then** the response is 400 with message Invalid mileage data.

#### Scenario: Client cannot choose the logger
* **Given** vehicle id 3 exists and the signed-in maintenance user has id 12
* **When** a mileage log is posted with body loggedByUserId 1
* **Then** the saved loggedByUserId is 12

#### Scenario: Mileage logs list newest first
* **Given** vehicle id 3 has two mileage logs on different dates
* **When** GET /vehicle-t6/vehicles/3/mileage-logs is sent
* **Then** the response is 200 with logs sorted by logDate descending, then id descending

#### Scenario: Add mileage opens the specified form
* **Given** a maintenance user is on a vehicle log page
* **When** the user selects Add mileage
* **Then** the Add mileage dialog shows Date, Mileage, Save, and Cancel

#### Scenario: Saving mileage refreshes the list
* **Given** valid mileage fields are entered and POST succeeds
* **When** the user selects Save
* **Then** the dialog shows progress while pending, closes on success, and the mileage list shows the new row

#### Scenario: Failed mileage save keeps the dialog open
* **Given** Save is pressed and the API returns an error message or no message
* **When** the create request finishes
* **Then** the dialog stays open with the entered values and shows the API message or Mileage could not be saved.

### US-12.3 — Log a vehicle service

#### Scenario: Maintenance creates an oil change service log
* **Given** vehicle id 3 exists
* **When** a maintenance user posts serviceDate 2026-10-28, serviceType oil_change, and a note
* **Then** the response is 201 with the saved type, note, and loggedByUserId of that user

#### Scenario: Repair and tire replacement service types are accepted
* **Given** vehicle id 3 exists
* **When** service logs are created with serviceType repair and tire_replacement
* **Then** each response is 201 with the matching serviceType

#### Scenario: Optional service note may be omitted
* **Given** vehicle id 3 exists
* **When** a service log is created with no note
* **Then** the response is 201 with note null

#### Scenario: Blank service note is stored as null
* **Given** vehicle id 3 exists
* **When** a service log is created with note made of only spaces
* **Then** the saved note is null

#### Scenario: Unknown service type is rejected
* **Given** vehicle id 3 exists
* **When** a service log is posted with serviceType wash
* **Then** the response is 400 with message Invalid service log data. and no log is stored

#### Scenario: Service logs list newest first
* **Given** vehicle id 3 has two service logs on different dates
* **When** GET /vehicle-t6/vehicles/3/service-logs is sent
* **Then** the response is 200 with logs sorted by serviceDate descending, then id descending

#### Scenario: Add service opens the specified form
* **Given** a maintenance user is on a vehicle log page
* **When** the user selects Add service
* **Then** the Add service dialog shows Date, Service type, optional Note, Save, and Cancel

#### Scenario: Saving a service log refreshes the list
* **Given** valid service fields are entered and POST succeeds
* **When** the user selects Save
* **Then** the dialog shows progress while pending, closes on success, and the service list shows the new row

#### Scenario: Failed service save keeps the dialog open
* **Given** Save is pressed and the API returns an error message or no message
* **When** the create request finishes
* **Then** the dialog stays open with the entered values and shows the API message or Service log could not be saved.

### US-12.4 — Restrict mileage and service log access

#### Scenario: Maintenance log APIs require a session
* **Given** no valid application session is supplied
* **When** any Feature 12 vehicle list, mileage, or service route is sent
* **Then** each response is 401 with the Feature 1 Unauthorized. message and nothing changes

#### Scenario: Requestor cannot use maintenance logging
* **Given** a requestor is signed in
* **When** GET /maintenance/vehicles or a mileage or service create is sent
* **Then** each response is 403 with the Feature 1 Forbidden. message

#### Scenario: Area admin cannot use maintenance logging
* **Given** an area_admin is signed in
* **When** GET /maintenance/vehicles or a mileage or service create is sent
* **Then** each response is 403 with the Feature 1 Forbidden. message

#### Scenario: Missing vehicle is rejected for logs
* **Given** no vehicle has id 9999
* **When** an admin lists or creates mileage or service logs for vehicle 9999
* **Then** the response is 404 with message Vehicle with id=9999 not found.

#### Scenario: Invalid vehicle id is rejected for logs
* **Given** an admin is signed in
* **When** a mileage or service route is called with vehicle id abc, 0, -1, or an unsafe integer
* **Then** each response is 400 with message Vehicle id must be a positive integer.

#### Scenario: Referenced vehicle cannot be deleted while logs exist
* **Given** vehicle id 3 has a mileage log or a service log
* **When** an admin deletes vehicle 3
* **Then** the response is 409 with message Vehicle is in use. and the vehicle and logs remain

#### Scenario: Referenced logger user cannot be deleted while in use
* **Given** user id 12 logged a mileage or service entry
* **When** an admin deletes user 12
* **Then** the response is 409 with message User is in use. and the user and logs remain

#### Scenario: Maintenance navigation requires an allowed role
* **Given** a signed-out visitor opens /maintenance
* **When** the Feature 1 route guard runs
* **Then** the visitor reaches /login

#### Scenario: Requestor and area admin are sent Home from Maintenance
* **Given** a requestor or area_admin opens /maintenance
* **When** the route guard runs
* **Then** the user reaches Home and MenuBar does not show Maintenance

## Test Coverage Map

Exact `it(...)` titles. Backend file: `backend/tests/maintenanceLogs.test.js`. Frontend file: `frontend/tests/MaintenanceLogs.test.js`.

| Story | Scenario | File | Exact test name |
|-------|----------|------|-----------------|
| US-12.1 | Maintenance lists every vehicle for logging | `backend/tests/maintenanceLogs.test.js` | `it("Maintenance lists every vehicle for logging")` |
| US-12.1 | Admin lists every vehicle for logging | `backend/tests/maintenanceLogs.test.js` | `it("Admin lists every vehicle for logging")` |
| US-12.1 | Empty maintenance vehicle list is returned | `backend/tests/maintenanceLogs.test.js` | `it("Empty maintenance vehicle list is returned")` |
| US-12.1 | Maintenance page shows vehicle rows | `frontend/tests/MaintenanceLogs.test.js` | `it("Maintenance page shows vehicle rows")` |
| US-12.1 | Maintenance page distinguishes loading empty and failed states | `frontend/tests/MaintenanceLogs.test.js` | `it("Maintenance page distinguishes loading empty and failed states")` |
| US-12.1 | Maintenance vehicle list failure does not show empty | `frontend/tests/MaintenanceLogs.test.js` | `it("Maintenance vehicle list failure does not show empty")` |
| US-12.2 | Maintenance creates a mileage log | `backend/tests/maintenanceLogs.test.js` | `it("Maintenance creates a mileage log")` |
| US-12.2 | First mileage log accepts any reading in range | `backend/tests/maintenanceLogs.test.js` | `it("First mileage log accepts any reading in range")` |
| US-12.2 | Mileage equal to the latest reading is allowed | `backend/tests/maintenanceLogs.test.js` | `it("Mileage equal to the latest reading is allowed")` |
| US-12.2 | Mileage lower than the latest reading is rejected | `backend/tests/maintenanceLogs.test.js` | `it("Mileage lower than the latest reading is rejected")` |
| US-12.2 | Invalid mileage data is rejected | `backend/tests/maintenanceLogs.test.js` | `it("Invalid mileage data is rejected")` |
| US-12.2 | Client cannot choose the logger | `backend/tests/maintenanceLogs.test.js` | `it("Client cannot choose the logger")` |
| US-12.2 | Mileage logs list newest first | `backend/tests/maintenanceLogs.test.js` | `it("Mileage logs list newest first")` |
| US-12.2 | Add mileage opens the specified form | `frontend/tests/MaintenanceLogs.test.js` | `it("Add mileage opens the specified form")` |
| US-12.2 | Saving mileage refreshes the list | `frontend/tests/MaintenanceLogs.test.js` | `it("Saving mileage refreshes the list")` |
| US-12.2 | Failed mileage save keeps the dialog open | `frontend/tests/MaintenanceLogs.test.js` | `it("Failed mileage save keeps the dialog open")` |
| US-12.3 | Maintenance creates an oil change service log | `backend/tests/maintenanceLogs.test.js` | `it("Maintenance creates an oil change service log")` |
| US-12.3 | Repair and tire replacement service types are accepted | `backend/tests/maintenanceLogs.test.js` | `it("Repair and tire replacement service types are accepted")` |
| US-12.3 | Optional service note may be omitted | `backend/tests/maintenanceLogs.test.js` | `it("Optional service note may be omitted")` |
| US-12.3 | Blank service note is stored as null | `backend/tests/maintenanceLogs.test.js` | `it("Blank service note is stored as null")` |
| US-12.3 | Unknown service type is rejected | `backend/tests/maintenanceLogs.test.js` | `it("Unknown service type is rejected")` |
| US-12.3 | Service logs list newest first | `backend/tests/maintenanceLogs.test.js` | `it("Service logs list newest first")` |
| US-12.3 | Add service opens the specified form | `frontend/tests/MaintenanceLogs.test.js` | `it("Add service opens the specified form")` |
| US-12.3 | Saving a service log refreshes the list | `frontend/tests/MaintenanceLogs.test.js` | `it("Saving a service log refreshes the list")` |
| US-12.3 | Failed service save keeps the dialog open | `frontend/tests/MaintenanceLogs.test.js` | `it("Failed service save keeps the dialog open")` |
| US-12.4 | Maintenance log APIs require a session | `backend/tests/maintenanceLogs.test.js` | `it("Maintenance log APIs require a session")` |
| US-12.4 | Requestor cannot use maintenance logging | `backend/tests/maintenanceLogs.test.js` | `it("Requestor cannot use maintenance logging")` |
| US-12.4 | Area admin cannot use maintenance logging | `backend/tests/maintenanceLogs.test.js` | `it("Area admin cannot use maintenance logging")` |
| US-12.4 | Missing vehicle is rejected for logs | `backend/tests/maintenanceLogs.test.js` | `it("Missing vehicle is rejected for logs")` |
| US-12.4 | Invalid vehicle id is rejected for logs | `backend/tests/maintenanceLogs.test.js` | `it("Invalid vehicle id is rejected for logs")` |
| US-12.4 | Referenced vehicle cannot be deleted while logs exist | `backend/tests/maintenanceLogs.test.js` | `it("Referenced vehicle cannot be deleted while logs exist")` |
| US-12.4 | Referenced logger user cannot be deleted while in use | `backend/tests/maintenanceLogs.test.js` | `it("Referenced logger user cannot be deleted while in use")` |
| US-12.4 | Maintenance navigation requires an allowed role | `frontend/tests/MaintenanceLogs.test.js` | `it("Maintenance navigation requires an allowed role")` |
| US-12.4 | Requestor and area admin are sent Home from Maintenance | `frontend/tests/MaintenanceLogs.test.js` | `it("Requestor and area admin are sent Home from Maintenance")` |

## Agent implementation request

Copy when asking Cursor to implement this feature (`@` this file):

```text
Implement Feature 12 from @features/feature-12-mileage-service-logs.md on branch `feature/12-mileage-service-logs`.

Follow layer order in @features/framework.md (models → routes → backend tests → frontend → frontend tests).
Map every Gherkin scenario in the Test Coverage Map; run `npm test` before finishing.
If API routes, payloads, schema, or product rules changed per this spec, update @features/reference/api.md, @features/reference/data-model.md, and/or @features/reference/behavior.md in the same PR to match shipped code.
Complete Definition of Done and the merge checklist in @features/framework.md.
Do not implement behavior not in this spec.
```

**Reference updates for this feature:** `api.md`, `data-model.md`, `behavior.md`.

## Definition of Done

* [ ] Backend and frontend implemented per this spec (**FR-001**–**FR-016** satisfied)
* [ ] **Success Criteria (SC-001**–**SC-005)** met
* [ ] All mapped tests pass (`npm test`)
* [ ] Test Coverage Map complete
* [ ] `features/reference/data-model.md` updated (if schema changed)
* [ ] `features/reference/api.md` updated (if API changed)
* [ ] `features/reference/behavior.md` updated (if product rules changed)
* [ ] Agility stories and acceptance tests for Feature 12 are created or updated
* [ ] Application code for this feature is handwritten; automated tests may use AI assistance

## Out of Scope

* Creating or editing vehicles: [Feature 4 — Vehicle Management](feature-4-vehicle-management.md).
* Creating `maintenance_need` issue reports: [Feature 10 — Vehicle Issue Reports in the catalog](README.md#feature-catalog).
* Weekly schedule and service queue: [Feature 11 — Weekly Vehicle Schedule in the catalog](README.md#feature-catalog).
* Editing or deleting past mileage or service logs.
* Parts inventory, vendor invoices, or work-order workflows.
