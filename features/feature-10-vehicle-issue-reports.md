# Feature: Vehicle Issue Reports

**Feature ID:** 10  
**Branch pattern:** `feature/10-vehicle-issue-reports`  
**Status:** Ready  
**Created:** 2026-10-27  
**Input:** Let a requestor report Low gas, Dirty, or Maintenance need on a reservation request before, during, or after the trip, and let admin, area admin, and maintenance view the issue lists they are allowed to see.  
**Depends on:** [Feature 1 — User Authentication & Authorization](feature-1-user-authentication-authorization.md), [Feature 4 — Vehicle Management](feature-4-vehicle-management.md), [Feature 7 — Reservation Requests](feature-7-reservation-requests.md), [Feature 8 — Request Processing in the catalog](README.md#feature-catalog)

---

## User Stories

Every story is P1: each one must ship for the assignment’s issue-report work.

### US-10.1: Report a vehicle issue

**As a** requestor  
**I want to** report Low gas, Dirty, or a Maintenance need on my reservation  
**So that** the area knows about a problem before, during, or after the trip

**Priority:** P1  
**Independent test:** Sign in as the requestor who owns a request, create each issue type with a timing value, and reject another requestor’s request  
**Acceptance scenarios:** see ### US-10.1 under Acceptance Criteria

### US-10.2: View issue reports

**As a** signed-in user with access to a request  
**I want to** see the issue reports for that request  
**So that** I know what was reported

**Priority:** P1  
**Independent test:** Verify the requestor sees only issues on their own requests, admin sees all, area_admin sees only their area, and maintenance sees maintenance_need issues in scope  
**Acceptance scenarios:** see ### US-10.2 under Acceptance Criteria

### US-10.3: Restrict issue actions

**As a** system administrator  
**I want** issue reports limited to the right roles  
**So that** other users cannot invent reports or read issues outside their scope

**Priority:** P1  
**Independent test:** Confirm 401/403 cases for signed-out users and disallowed roles on issue create and issue list  
**Acceptance scenarios:** see ### US-10.3 under Acceptance Criteria

## Requirements

### Functional Requirements

* **FR-001:** This feature MUST reuse Feature 1 authentication and roles. It MUST reuse the reservation request identity and fields from Features 7 and 8 (including requestorUserId, areaId, status, and nullable vehicleId from Feature 8). It MUST NOT create another sign-in flow, vehicle CRUD screen, full request-create screen, or status-change endpoint. Mark Returned and every other status change belong to Feature 8’s shared `PUT /vehicle-t6/reservation-requests/:id/status` operation.
* **FR-002:** An issue report MUST store requestId, issueType, timing, optional note, reportedByUserId, and createdAt. The server MUST generate id. issueType MUST be one of `low_gas`, `dirty`, or `maintenance_need`. timing MUST be one of `before`, `during`, or `after`.
* **FR-003:** note MUST be optional. When present it MUST be a string of at most 1,000 characters after trimming outer spaces, and MUST keep its letter case and internal spaces. A blank or whitespace-only note MUST be stored as null. Request-body properties outside issueType, timing, and note MUST be ignored on create.
* **FR-004:** A requestor MUST create an issue only for a reservation request they own (request.requestorUserId equals the current user id). Ownership MUST come from the database request row, not from a client-supplied user id.
* **FR-005:** Admin MUST create an issue on any existing request. An area_admin MUST create an issue only when the request’s areaId equals that user’s current database areaId. Maintenance MUST NOT create issue reports through this feature.
* **FR-006:** Create MUST require a valid existing reservation request id. A missing request MUST return 404. An out-of-scope request for an area_admin or a non-owner requestor MUST return the same 404. Invalid issueType, timing, note length, or route id shape MUST return 400 without saving.
* **FR-007:** When the request has an assigned vehicleId, the saved issue MUST also store that vehicleId for later maintenance work. When vehicleId is null, the issue MUST still save with null vehicleId. Clients MUST NOT pick a different vehicleId on create.
* **FR-008:** Listing issues for one request MUST return that request’s issues sorted by createdAt ascending, then id ascending. An empty list MUST be 200 with []. The same ownership and area rules as create apply to who may list that request’s issues.
* **FR-009:** Admin MUST list every issue through GET `/vehicle-t6/issues`. An area_admin MUST list only issues whose request areaId matches their areaId. Maintenance MUST list only issues whose issueType is `maintenance_need`. Requestor MUST receive 403 on that open list and MUST use the per-request list on their own requests instead. Maintenance MUST receive 403 on the per-request list.
* **FR-010:** Scope and ownership MUST use the current database user id, role, and areaId. Client role, areaId, requestorUserId, or vehicleId values MUST NOT widen access.
* **FR-011:** The request detail UI from Features 7/8 MUST gain the issue report actions described in Screen Requirements. This feature MUST NOT replace Feature 8 status changes, the weekly schedule (Feature 11), or mileage/service logging (Feature 12).
* **FR-012:** Report actions MUST show progress, block duplicate submits, refresh on success, and keep values or the dialog open on failure with the API message or the specified fallback.
* **FR-013:** Foreign keys from `issue_reports` MUST use `ON DELETE RESTRICT` for requestId, vehicleId, and reportedByUserId. Deleting a user who reported an issue MUST return 409 `User is in use.` Deleting a vehicle that still has issue reports MUST return 409 `Vehicle is in use.` This feature owns those 409 tests because it adds the references.
* **FR-014:** Database failures MUST return 500 `Issue request failed.` without SQL details or partial writes.

## Assumptions

* Features 7 and 8 own the reservation request row. This feature references request id, requestorUserId, areaId, status, and nullable vehicleId. Shared status values are exactly those in Features 7 and 8: `requested`, `awaiting_vehicle`, `reserved`, `returned`, `cancelled`. This feature does not redefine them and does not set status.
* Issue types match North’s notes: Low gas, Dirty, and Maintenance need. Timing matches before, during, or after the trip.
* A requestor may report an issue on their request regardless of current status. Reporting does not change the request status by itself.
* Mark Returned is owned only by Feature 8. Feature 9 may email on that status change.
* Maintenance reads `maintenance_need` issues here so Feature 12 can focus on mileage and service logs against vehicles.

## Edge Cases

* Reporting on another requestor’s request does not succeed and does not reveal whether that request exists beyond the shared 404.
* An area admin with null areaId cannot create issues or list other areas’ issues.
* A blank note is stored as null, not as spaces.
* Failed create keeps existing issues unchanged.
* Deleting a referenced reporter user or vehicle is blocked with 409; issue rows stay.

## Success Criteria

* **SC-001:** Create and list issue reports match the documented contract, including type and timing values.
* **SC-002:** Ownership and area rules hold for every mapped acceptance case.
* **SC-003:** Dialog, progress, error, and role-specific UI cases have matching frontend tests and a manual check.
* **SC-004:** Referenced user and vehicle deletion returns the documented 409 responses.
* **SC-005:** Every scenario has an exact-name test before merge.

## Data Ownership & Isolation

| Operation | admin | area_admin | requestor | maintenance |
|-----------|-------|------------|-----------|-------------|
| Create issue | Any request | Own-area request only; otherwise 404 | Own request only; otherwise 404 | 403 |
| List issues for one request | Any request | Own-area request only; otherwise 404 | Own request only; otherwise 404 | 403 |
| List open issues | All issues | Issues for own-area requests | 403 | `maintenance_need` issues only |

Authentication comes from [Feature 1](feature-1-user-authentication-authorization.md). Request rows come from Features 7 and 8. Vehicles come from Feature 4 when assigned.

## Key Entities

* **Issue report:** a notice on a reservation request that the vehicle or trip had Low gas, Dirty, or a Maintenance need, with a before/during/after timing and an optional note.

## API Requirements

All endpoints reuse [Feature 1](feature-1-user-authentication-authorization.md) authentication. No GET-by-id for a single issue is introduced. No return or status-change endpoint is introduced.

| Method | Endpoint | Allowed role | Success |
|--------|----------|--------------|---------|
| POST | `/vehicle-t6/reservation-requests/:requestId/issues` | admin; area_admin for own-area request; requestor for own request | `201`, new Issue object |
| GET | `/vehicle-t6/reservation-requests/:requestId/issues` | admin; area_admin for own-area request; requestor for own request | `200`, array of Issue objects |
| GET | `/vehicle-t6/issues` | admin; area_admin (own area); maintenance (`maintenance_need` only) | `200`, array of Issue objects |

POST issue body:

```json
{
  "issueType": "low_gas",
  "timing": "after",
  "note": "Tank was near empty on return."
}
```

Issue object:

```json
{
  "id": 1,
  "requestId": 10,
  "vehicleId": 3,
  "issueType": "low_gas",
  "timing": "after",
  "note": "Tank was near empty on return.",
  "reportedByUserId": 8,
  "createdAt": "2026-10-27T18:00:00.000Z"
}
```

`vehicleId` is copied from the request at create time and may be null. `createdAt` is server-generated.

| Failure | Status | Message |
|---------|--------|---------|
| No valid session | 401 | Feature 1 `Unauthorized.` |
| Disallowed role | 403 | Feature 1 `Forbidden.` |
| Invalid issueType, timing, note, or route id shape | 400 | `Invalid issue data.` for issue bodies; `Reservation request id must be a positive integer.` for a bad request id |
| Missing or out-of-scope request | 404 | `Reservation request with id=<id> not found.` |
| Delete of user who reported an issue | 409 | `User is in use.` |
| Delete of vehicle that still has issue reports | 409 | `Vehicle is in use.` |
| Other database failure on issues | 500 | `Issue request failed.` |

## Screen Requirements

* Request detail (from Features 7/8) shows an **Issues** section listing that request’s reports: type label (Low gas / Dirty / Maintenance need), timing (Before / During / After), note, reporter name when available, and created time.
* A requestor on their own request, and an admin or in-scope area_admin, see **Report issue**. Maintenance does not see Report issue.
* **Report issue** dialog fields: **Issue type** (combo: Low gas, Dirty, Maintenance need), **When** (combo: Before, During, After), optional **Note**, buttons **Save** and **Cancel**. Save posts to the create endpoint, shows progress, blocks duplicate saves, closes and refreshes the issue list on success, and keeps values with the API message or `Issue could not be saved.` on failure. Cancel sends no write.
* This feature does not add Mark returned. Returned stays on Feature 8’s status-change UI.
* MenuBar may add **Issues** for admin, area_admin, and maintenance at `/issues`, route name `issues`, heading **Issues**. The page lists open issues allowed for that role with request id, type, timing, vehicle id when present, and created time. Requestor does not see this menu link. Loading shows progress; `No issues found.` only after a successful empty list; load failure shows the API message or `Issues could not be loaded.`
* Signed-out visitors hitting `/issues` follow Feature 1 Login redirect. Requestor opening `/issues` is sent Home.

## Data Model Requirements

Add `issue_reports`:

| Field | Type | Rule |
|-------|------|------|
| id | Integer | Auto-generated primary key |
| requestId | Integer | Required foreign key to the Feature 7/8 reservation request, `ON DELETE RESTRICT` |
| vehicleId | Integer | Nullable foreign key to `vehicles.id`, `ON DELETE RESTRICT` |
| issueType | Enum | `low_gas`, `dirty`, `maintenance_need` |
| timing | Enum | `before`, `during`, `after` |
| note | String(1000) | Nullable; trimmed; blank becomes null |
| reportedByUserId | Integer | Required foreign key to `users.id`, `ON DELETE RESTRICT` |
| createdAt | DateTime | Server-generated create timestamp |

This feature does not add columns to `vehicles` or change reservation request status. Register IssueReport belongsTo ReservationRequest, belongsTo User as reporter, and optional belongsTo Vehicle in `models/index.js`.

## Acceptance Criteria (Gherkin)

### US-10.1 — Report a vehicle issue

#### Scenario: Requestor reports low gas after a trip
* **Given** reservation request id 10 belongs to the signed-in requestor and has vehicleId 3
* **When** POST /vehicle-t6/reservation-requests/10/issues is sent with issueType low_gas, timing after, and a note
* **Then** the response is 201 with generated id, requestId 10, vehicleId 3, the saved type and timing, reportedByUserId of the requestor, and createdAt

#### Scenario: Requestor reports dirty and maintenance need with each timing
* **Given** the requestor owns reservation request id 10
* **When** issues are created for dirty during and maintenance_need before
* **Then** each response is 201 with the matching issueType and timing

#### Scenario: Optional note may be omitted
* **Given** the requestor owns reservation request id 10
* **When** an issue is created with valid type and timing and no note
* **Then** the response is 201 with note null

#### Scenario: Blank note is stored as null
* **Given** the requestor owns reservation request id 10
* **When** an issue is created with note made of only spaces
* **Then** the saved note is null

#### Scenario: Requestor cannot report on another users request
* **Given** reservation request id 11 belongs to a different requestor
* **When** the signed-in requestor posts an issue to request 11
* **Then** the response is 404 with message Reservation request with id=11 not found. and no issue is stored

#### Scenario: Area admin reports an issue in its area
* **Given** an area_admin has areaId 2 and reservation request id 10 has areaId 2
* **When** that user posts a valid issue to request 10
* **Then** the response is 201 with reportedByUserId of that area_admin

#### Scenario: Area admin cannot report on another areas request
* **Given** an area_admin has areaId 2 and reservation request id 9 has areaId 1
* **When** that user posts an issue to request 9
* **Then** the response is 404 with message Reservation request with id=9 not found. and no issue is stored

#### Scenario: Invalid issue type or timing is rejected
* **Given** the requestor owns reservation request id 10
* **When** an issue is posted with an unknown issueType or timing
* **Then** the response is 400 with message Invalid issue data. and no issue is stored

#### Scenario: Client cannot choose vehicle id or reporter
* **Given** the requestor owns reservation request id 10 with vehicleId 3
* **When** an issue is posted with body vehicleId 99 and reportedByUserId 1
* **Then** the saved issue uses vehicleId 3 and the signed-in user’s id

#### Scenario: Report issue opens the specified form
* **Given** the requestor is on their request detail page
* **When** the user selects Report issue
* **Then** the Report issue dialog shows Issue type, When, optional Note, Save, and Cancel

#### Scenario: Saving an issue refreshes the list
* **Given** valid issue fields are entered and POST succeeds
* **When** the user selects Save
* **Then** the dialog shows progress while pending, closes on success, and the Issues section shows the new report

#### Scenario: Failed issue save keeps the dialog open
* **Given** Save is pressed and the API returns an error message or no message
* **When** the create request finishes
* **Then** the dialog stays open with the entered values and shows the API message or Issue could not be saved.

### US-10.2 — View issue reports

#### Scenario: Requestor lists issues on their request
* **Given** reservation request id 10 belongs to the requestor and has two issues
* **When** GET /vehicle-t6/reservation-requests/10/issues is sent
* **Then** the response is 200 with both issues in createdAt order

#### Scenario: Empty issue list is returned
* **Given** reservation request id 10 belongs to the requestor and has no issues
* **When** the requestor lists issues for request 10
* **Then** the response is 200 with []

#### Scenario: Admin lists every open issue
* **Given** issues exist on requests in areas 1 and 2
* **When** an admin requests GET /vehicle-t6/issues
* **Then** the response is 200 with every issue

#### Scenario: Area admin lists only issues for its area
* **Given** an area_admin has areaId 2 and issues exist for areas 1 and 2
* **When** that user requests GET /vehicle-t6/issues
* **Then** the response is 200 with only area 2 issues

#### Scenario: Maintenance lists only maintenance need issues
* **Given** low_gas and maintenance_need issues exist
* **When** a maintenance user requests GET /vehicle-t6/issues
* **Then** the response is 200 with only maintenance_need issues

#### Scenario: Requestor cannot use the open issues list
* **Given** a requestor is signed in
* **When** GET /vehicle-t6/issues is sent
* **Then** the response is 403 with the Feature 1 Forbidden. message

#### Scenario: Issues page shows allowed rows
* **Given** GET /issues returns the caller’s allowed issues
* **When** an admin, area_admin, or maintenance user opens /issues from MenuBar
* **Then** each allowed issue appears with its type, timing, request id, and vehicle id when present

#### Scenario: Requestor is sent Home from Issues
* **Given** a requestor opens /issues
* **When** the route guard runs
* **Then** the user reaches Home and MenuBar does not show Issues

#### Scenario: Issues page distinguishes loading empty and failed states
* **Given** the open issue list is pending, then succeeds with []
* **When** the page renders each state
* **Then** progress appears while pending and No issues found. appears only after success

#### Scenario: Issue list failure does not show an empty list
* **Given** GET /issues fails with an API message or no response message
* **When** the list request completes
* **Then** the page shows the message or Issues could not be loaded. and does not show No issues found.

### US-10.3 — Restrict issue actions

#### Scenario: Issue APIs require a session
* **Given** no valid application session is supplied
* **When** issue create, per-request issue list, or open issues is sent
* **Then** each response is 401 with the Feature 1 Unauthorized. message and nothing changes

#### Scenario: Maintenance cannot create an issue
* **Given** a maintenance user is signed in and reservation request id 10 exists
* **When** that user posts an issue to request 10
* **Then** the response is 403 with the Feature 1 Forbidden. message and no issue is stored

#### Scenario: Invalid reservation request route id is rejected for issues
* **Given** an admin is signed in
* **When** an issue route is called with request id abc, 0, -1, or an unsafe integer
* **Then** each response is 400 with message Reservation request id must be a positive integer.

#### Scenario: Missing reservation request is rejected for issues
* **Given** no reservation request has id 9999
* **When** an admin creates an issue on request 9999
* **Then** the response is 404 with message Reservation request with id=9999 not found.

#### Scenario: Referenced reporter user cannot be deleted while in use
* **Given** user id 8 reported an issue
* **When** an admin deletes user 8
* **Then** the response is 409 with message User is in use. and both the user and issue remain

#### Scenario: Referenced vehicle cannot be deleted while issues exist
* **Given** vehicle id 3 is stored on an issue report
* **When** an admin deletes vehicle 3
* **Then** the response is 409 with message Vehicle is in use. and both the vehicle and issue remain

## Test Coverage Map

Exact `it(...)` titles. Backend file: `backend/tests/issues.test.js`. Frontend files: `frontend/tests/RequestIssues.test.js` and `frontend/tests/Issues.test.js`.

| Story | Scenario | File | Exact test name |
|-------|----------|------|-----------------|
| US-10.1 | Requestor reports low gas after a trip | `backend/tests/issues.test.js` | `it("Requestor reports low gas after a trip")` |
| US-10.1 | Requestor reports dirty and maintenance need with each timing | `backend/tests/issues.test.js` | `it("Requestor reports dirty and maintenance need with each timing")` |
| US-10.1 | Optional note may be omitted | `backend/tests/issues.test.js` | `it("Optional note may be omitted")` |
| US-10.1 | Blank note is stored as null | `backend/tests/issues.test.js` | `it("Blank note is stored as null")` |
| US-10.1 | Requestor cannot report on another users request | `backend/tests/issues.test.js` | `it("Requestor cannot report on another users request")` |
| US-10.1 | Area admin reports an issue in its area | `backend/tests/issues.test.js` | `it("Area admin reports an issue in its area")` |
| US-10.1 | Area admin cannot report on another areas request | `backend/tests/issues.test.js` | `it("Area admin cannot report on another areas request")` |
| US-10.1 | Invalid issue type or timing is rejected | `backend/tests/issues.test.js` | `it("Invalid issue type or timing is rejected")` |
| US-10.1 | Client cannot choose vehicle id or reporter | `backend/tests/issues.test.js` | `it("Client cannot choose vehicle id or reporter")` |
| US-10.1 | Report issue opens the specified form | `frontend/tests/RequestIssues.test.js` | `it("Report issue opens the specified form")` |
| US-10.1 | Saving an issue refreshes the list | `frontend/tests/RequestIssues.test.js` | `it("Saving an issue refreshes the list")` |
| US-10.1 | Failed issue save keeps the dialog open | `frontend/tests/RequestIssues.test.js` | `it("Failed issue save keeps the dialog open")` |
| US-10.2 | Requestor lists issues on their request | `backend/tests/issues.test.js` | `it("Requestor lists issues on their request")` |
| US-10.2 | Empty issue list is returned | `backend/tests/issues.test.js` | `it("Empty issue list is returned")` |
| US-10.2 | Admin lists every open issue | `backend/tests/issues.test.js` | `it("Admin lists every open issue")` |
| US-10.2 | Area admin lists only issues for its area | `backend/tests/issues.test.js` | `it("Area admin lists only issues for its area")` |
| US-10.2 | Maintenance lists only maintenance need issues | `backend/tests/issues.test.js` | `it("Maintenance lists only maintenance need issues")` |
| US-10.2 | Requestor cannot use the open issues list | `backend/tests/issues.test.js` | `it("Requestor cannot use the open issues list")` |
| US-10.2 | Issues page shows allowed rows | `frontend/tests/Issues.test.js` | `it("Issues page shows allowed rows")` |
| US-10.2 | Requestor is sent Home from Issues | `frontend/tests/Issues.test.js` | `it("Requestor is sent Home from Issues")` |
| US-10.2 | Issues page distinguishes loading empty and failed states | `frontend/tests/Issues.test.js` | `it("Issues page distinguishes loading empty and failed states")` |
| US-10.2 | Issue list failure does not show an empty list | `frontend/tests/Issues.test.js` | `it("Issue list failure does not show an empty list")` |
| US-10.3 | Issue APIs require a session | `backend/tests/issues.test.js` | `it("Issue APIs require a session")` |
| US-10.3 | Maintenance cannot create an issue | `backend/tests/issues.test.js` | `it("Maintenance cannot create an issue")` |
| US-10.3 | Invalid reservation request route id is rejected for issues | `backend/tests/issues.test.js` | `it("Invalid reservation request route id is rejected for issues")` |
| US-10.3 | Missing reservation request is rejected for issues | `backend/tests/issues.test.js` | `it("Missing reservation request is rejected for issues")` |
| US-10.3 | Referenced reporter user cannot be deleted while in use | `backend/tests/issues.test.js` | `it("Referenced reporter user cannot be deleted while in use")` |
| US-10.3 | Referenced vehicle cannot be deleted while issues exist | `backend/tests/issues.test.js` | `it("Referenced vehicle cannot be deleted while issues exist")` |

## Agent implementation request

Copy when asking Cursor to implement this feature (`@` this file):

```text
Implement Feature 10 from @features/feature-10-vehicle-issue-reports.md on branch `feature/10-vehicle-issue-reports`.

Follow layer order in @features/framework.md (models → routes → backend tests → frontend → frontend tests).
Map every Gherkin scenario in the Test Coverage Map; run `npm test` before finishing.
If API routes, payloads, schema, or product rules changed per this spec, update @features/reference/api.md, @features/reference/data-model.md, and/or @features/reference/behavior.md in the same PR to match shipped code.
Complete Definition of Done and the merge checklist in @features/framework.md.
Do not implement behavior not in this spec.
```

**Reference updates for this feature:** `api.md`, `data-model.md`, `behavior.md`.

## Definition of Done

* [ ] Backend and frontend implemented per this spec (**FR-001**–**FR-014** satisfied)
* [ ] **Success Criteria (SC-001**–**SC-005)** met
* [ ] All mapped tests pass (`npm test`)
* [ ] Test Coverage Map complete
* [ ] `features/reference/data-model.md` updated (if schema changed)
* [ ] `features/reference/api.md` updated (if API changed)
* [ ] `features/reference/behavior.md` updated (if product rules changed)
* [ ] Agility stories and acceptance tests for Feature 10 are created or updated
* [ ] Application code for this feature is handwritten; automated tests may use AI assistance

## Out of Scope

* Creating reservation requests or assigning vehicles: [Feature 7 — Reservation Requests](README.md#feature-catalog) and [Feature 8 — Request Processing](README.md#feature-catalog).
* Mark Returned and every other reservation status change: [Feature 8 — Request Processing](README.md#feature-catalog).
* Day-before pickup emails and status-change emails: [Feature 9 — Reservation Emails](README.md#feature-catalog).
* Weekly calendar of requests: [Feature 11 — Weekly Vehicle Schedule](README.md#feature-catalog).
* Mileage logs and service logs (repair, oil change, tires): [Feature 12 — Mileage & Service Logs](README.md#feature-catalog).
* Vehicle create/edit screens: [Feature 4 — Vehicle Management](feature-4-vehicle-management.md).
* Editing or deleting an existing issue report after create.
