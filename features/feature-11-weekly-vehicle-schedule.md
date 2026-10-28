# Feature: Weekly Vehicle Schedule

**Feature ID:** 11  
**Branch pattern:** `feature/11-weekly-vehicle-schedule`  
**Status:** Ready  
**Created:** 2026-10-28  
**Input:** Give admins and area admins a weekly calendar of reservation requests with status and vehicle, plus a service queue of requests that still need a vehicle or need check-in after the trip.  
**Depends on:** [Feature 1 — User Authentication & Authorization](feature-1-user-authentication-authorization.md), [Feature 4 — Vehicle Management](feature-4-vehicle-management.md), [Feature 8 — Request Processing in the catalog](README.md#feature-catalog), [Feature 10 — Vehicle Issue Reports in the catalog](README.md#feature-catalog)

---

## User Stories

Every story is P1: each one must ship for the assignment’s weekly schedule and service-queue work.

### US-11.1: View the weekly schedule

**As an** area administrator  
**I want to** see this week’s reservation requests with status and vehicle  
**So that** I know what trips are on the calendar for my area

**Priority:** P1  
**Independent test:** Load a week as admin and as area_admin; verify admin sees every overlapping request and area_admin sees only its area  
**Acceptance scenarios:** see ### US-11.1 under Acceptance Criteria

### US-11.2: View the service queue

**As an** area administrator  
**I want to** see requests that need a vehicle or need check-in  
**So that** I can finish assignment and return work

**Priority:** P1  
**Independent test:** Verify Need vehicle lists Awaiting vehicle requests and Need check-in lists Reserved requests whose end is past, with area scope  
**Acceptance scenarios:** see ### US-11.2 under Acceptance Criteria

### US-11.3: Move between weeks on the schedule

**As an** area administrator  
**I want to** open the previous or next week  
**So that** I can plan around other trip dates

**Priority:** P1  
**Independent test:** Change weekStart and confirm only requests overlapping that week are returned  
**Acceptance scenarios:** see ### US-11.3 under Acceptance Criteria

### US-11.4: Restrict schedule and queue access

**As a** system administrator  
**I want** the schedule and queue limited to admin and area_admin  
**So that** requestors and maintenance cannot open staff planning screens

**Priority:** P1  
**Independent test:** Confirm 401/403 and frontend redirects for signed-out, requestor, and maintenance users  
**Acceptance scenarios:** see ### US-11.4 under Acceptance Criteria

## Requirements

### Functional Requirements

* **FR-001:** This feature MUST reuse Feature 1 authentication and roles, Feature 4 vehicle identity when a request has vehicleId, and the reservation request fields and statuses from Features 7, 8, and 10. It MUST NOT create requests, assign vehicles, mark Returned, or send email.
* **FR-002:** Schedule and queue reads MUST use the existing reservation request rows. This feature MUST NOT add a new table.
* **FR-003:** A schedule entry MUST expose request id, areaId, status, startAt, endAt, requestor display name or requestorUserId, vehicleId, and vehicle label when a vehicle is assigned (make, model, and plateNumber from Feature 4). Missing vehicle fields MUST be null.
* **FR-004:** GET schedule MUST accept `weekStart` as a `YYYY-MM-DD` date that is a Monday. The week runs Monday 00:00:00 through Sunday 23:59:59.999 in the server’s local date handling for that calendar date. Requests that overlap that range MUST be included. Overlap means startAt <= weekEnd AND endAt >= weekStart.
* **FR-005:** Missing weekStart MUST default to the Monday of the current server date. An invalid weekStart or a date that is not a Monday MUST return 400 `Invalid schedule data.`
* **FR-006:** Schedule results MUST sort by startAt ascending, then id ascending. An empty week MUST be 200 with [].
* **FR-007:** The service queue MUST return two arrays in one response: `needVehicle` and `needCheckIn`. `needVehicle` MUST contain requests with status `Awaiting vehicle`. `needCheckIn` MUST contain requests with status `Reserved` whose endAt is earlier than the server’s current time. Other statuses MUST NOT appear in either list.
* **FR-008:** Queue lists MUST sort by startAt ascending, then id ascending. Either array MAY be empty. The response MUST still be 200 with both arrays present.
* **FR-009:** Admin MUST see schedule and queue rows for every area. An area_admin MUST see only rows whose request areaId equals that user’s current database areaId. An area_admin with null areaId MUST receive empty schedule and queue results.
* **FR-010:** Requestor and maintenance MUST receive the Feature 1 403 response for schedule and queue endpoints. Signed-out requests MUST receive 401.
* **FR-011:** Scope MUST use the current database role and areaId. Client area filters MUST NOT widen an area_admin’s results. Admin MAY optionally pass `areaId` as a positive integer to narrow the schedule or queue to one area; an unknown areaId MUST return 404 `Area with id=<id> not found.` Area_admin callers MUST ignore a forged areaId query and keep their own area scope.
* **FR-012:** MenuBar MUST show **Schedule** for admin and area_admin only. The Schedule page MUST show the weekly calendar and the service queue sections described in Screen Requirements.
* **FR-013:** Loading MUST show progress. Empty schedule text MUST be `No reservations this week.` only after a successful empty schedule. Empty queue sections MUST show `No requests need a vehicle.` and `No requests need check-in.` only after a successful response. Load failure MUST show the API message or `Schedule could not be loaded.` / `Service queue could not be loaded.` without those empty claims.
* **FR-014:** Database failures MUST return 500 `Schedule request failed.` for the schedule endpoint and 500 `Service queue request failed.` for the queue endpoint, without SQL details.

## Assumptions

* Features 7 and 8 provide reservation requests with id, requestorUserId, areaId, status, nullable vehicleId, startAt, and endAt. Feature 10 adds status `Returned`. Status values used here are `Requested`, `Awaiting vehicle`, `Reserved`, and `Returned`.
* “Need a vehicle” means status `Awaiting vehicle` from Feature 8. “Need check-in” means the trip end is past and status is still `Reserved`, so staff can mark Returned in Feature 10.
* Requested requests that are not yet Awaiting vehicle stay off the service queue. Returned requests stay off both queue lists and may still appear on the weekly schedule when their dates overlap the week.
* This feature is read-only. Assignment stays in Feature 8. Returned stays in Feature 10.
* Vehicle make, model, and plateNumber come from Feature 4 when vehicleId is set.

## Edge Cases

* A request that starts before the week and ends during or after it still appears on that week’s schedule.
* A week with no overlapping requests returns an empty schedule array, not an error.
* An area admin with no area assignment sees empty schedule and empty queue lists.
* Failed schedule load does not show `No reservations this week.`
* A forged areaId query does not let an area_admin see another area.

## Success Criteria

* **SC-001:** Schedule and queue responses match the documented contract and sort rules.
* **SC-002:** Admin and area-admin scope rules hold for every mapped acceptance case.
* **SC-003:** Need vehicle and Need check-in membership rules exclude the wrong statuses.
* **SC-004:** Week navigation, empty, loading, and error UI cases have matching frontend tests and a manual check.
* **SC-005:** Every scenario has an exact-name test before merge.

## Data Ownership & Isolation

| Operation | admin | area_admin | requestor / maintenance |
|-----------|-------|------------|-------------------------|
| Weekly schedule | All areas; optional areaId filter | Own area only | 403 |
| Service queue | All areas; optional areaId filter | Own area only | 403 |

Authentication comes from [Feature 1](feature-1-user-authentication-authorization.md). Requests come from Features 7, 8, and 10. Vehicles come from [Feature 4](feature-4-vehicle-management.md).

## Key Entities

* **Weekly schedule entry:** a reservation request that overlaps a Monday–Sunday week, shown with status and vehicle.
* **Service queue:** the staff list of requests that still need a vehicle (`Awaiting vehicle`) or need check-in (`Reserved` with endAt in the past).

## API Requirements

All endpoints reuse [Feature 1](feature-1-user-authentication-authorization.md) authentication. No write endpoints are introduced.

| Method | Endpoint | Allowed role | Success |
|--------|----------|--------------|---------|
| GET | `/vehicle-t6/schedule` | admin, area_admin | `200`, `{ "weekStart": "YYYY-MM-DD", "weekEnd": "YYYY-MM-DD", "items": [ ScheduleItem, ... ] }` |
| GET | `/vehicle-t6/service-queue` | admin, area_admin | `200`, `{ "needVehicle": [ ScheduleItem, ... ], "needCheckIn": [ ScheduleItem, ... ] }` |

Query parameters:

* `weekStart` — optional Monday `YYYY-MM-DD` for schedule only.
* `areaId` — optional positive integer for admin only on either endpoint.

ScheduleItem:

```json
{
  "id": 10,
  "areaId": 2,
  "status": "Reserved",
  "startAt": "2026-11-03T09:00:00.000Z",
  "endAt": "2026-11-05T17:00:00.000Z",
  "requestorUserId": 8,
  "requestorName": "Avery Reed",
  "vehicleId": 3,
  "vehicleLabel": "Ford Transit · OC-4521"
}
```

`vehicleId` and `vehicleLabel` are null when no vehicle is assigned. `requestorName` is firstName + space + lastName from the requestor user when available; otherwise null. `weekEnd` is the Sunday of that week as `YYYY-MM-DD`.

| Failure | Status | Message |
|---------|--------|---------|
| No valid session | 401 | Feature 1 `Unauthorized.` |
| Disallowed role | 403 | Feature 1 `Forbidden.` |
| Invalid weekStart or non-Monday weekStart | 400 | `Invalid schedule data.` |
| Invalid areaId shape | 400 | `Area id must be a positive integer.` |
| Admin areaId that does not exist | 404 | `Area with id=<id> not found.` |
| Other database failure on schedule | 500 | `Schedule request failed.` |
| Other database failure on queue | 500 | `Service queue request failed.` |

## Screen Requirements

* `/schedule`, route name `schedule`, heading **Schedule**. MenuBar shows **Schedule** for admin and area_admin only. Signed-out visitors follow Feature 1 Login redirect. Requestor and maintenance are sent Home.
* The page has two sections: **This week** and **Service queue**.
* **This week** shows the current `weekStart`–`weekEnd` label, **Previous week** and **Next week** controls, and a list or day-grouped calendar of schedule items. Each item shows request id or requestor name, status, start and end, and vehicle label or `No vehicle`. Selecting an item may navigate to the existing request detail route from Features 7/8 when that route exists; this feature does not invent a new detail page.
* Admin may use an **Area** filter combo filled from Feature 2. Area_admin does not see an area filter; their list is already scoped.
* **Service queue** has two lists: **Need vehicle** and **Need check-in**. Each row shows the same ScheduleItem fields. Empty each list only after a successful load.
* Schedule and queue each show progress while loading. Schedule empty text is `No reservations this week.` Queue empty texts are `No requests need a vehicle.` and `No requests need check-in.` Failures show the API message or the fallbacks in FR-013.

## Data Model Requirements

No new tables. Read reservation requests from Features 7/8/10 and join Feature 4 vehicles when `vehicleId` is present. requestorName comes from the Feature 1 user row for `requestorUserId`.

## Acceptance Criteria (Gherkin)

### US-11.1 — View the weekly schedule

#### Scenario: Admin lists schedule items for the week
* **Given** reserved and awaiting-vehicle requests overlap the week starting 2026-11-02
* **When** an admin requests GET /vehicle-t6/schedule?weekStart=2026-11-02
* **Then** the response is 200 with weekStart 2026-11-02, weekEnd 2026-11-08, and those overlapping requests sorted by startAt then id

#### Scenario: Area admin lists only its area on the schedule
* **Given** an area_admin has areaId 2 and overlapping requests exist in areas 1 and 2 for the week
* **When** that user requests the schedule for that week
* **Then** the response is 200 with only area 2 items

#### Scenario: Area admin without an assignment gets an empty schedule
* **Given** an area_admin has null areaId and overlapping requests exist
* **When** that user requests the schedule
* **Then** the response is 200 with items []

#### Scenario: Request spanning the week start is included
* **Given** a request starts before 2026-11-02 and ends during that week
* **When** an admin requests the schedule for weekStart 2026-11-02
* **Then** that request is included in items

#### Scenario: Empty week returns an empty schedule
* **Given** no requests overlap weekStart 2026-11-02
* **When** an admin requests that schedule
* **Then** the response is 200 with items []

#### Scenario: Assigned vehicle label is included
* **Given** a overlapping Reserved request has vehicleId for a Ford Transit with plate OC-4521
* **When** an admin requests the schedule
* **Then** that item includes vehicleId and vehicleLabel containing Ford Transit and OC-4521

#### Scenario: Schedule page shows the week’s items
* **Given** GET /schedule returns items for the current week
* **When** an admin or area_admin opens /schedule from MenuBar
* **Then** each item shows status, times, and vehicle label or No vehicle

#### Scenario: Schedule page distinguishes loading empty and failed states
* **Given** the schedule request is pending, then succeeds with items []
* **When** the page renders each state
* **Then** progress appears while pending and No reservations this week. appears only after success

#### Scenario: Schedule failure does not show an empty week
* **Given** GET /schedule fails with an API message or no response message
* **When** the schedule request completes
* **Then** the page shows the message or Schedule could not be loaded. and does not show No reservations this week.

### US-11.2 — View the service queue

#### Scenario: Admin lists requests that need a vehicle
* **Given** requests exist with statuses Awaiting vehicle, Reserved, and Requested
* **When** an admin requests GET /vehicle-t6/service-queue
* **Then** needVehicle contains only Awaiting vehicle requests sorted by startAt then id

#### Scenario: Admin lists requests that need check-in
* **Given** a Reserved request has endAt in the past and another Reserved request has endAt in the future
* **When** an admin requests the service queue
* **Then** needCheckIn contains only the past-end Reserved request

#### Scenario: Returned and requested requests stay off the queue
* **Given** Returned and Requested requests exist
* **When** an admin requests the service queue
* **Then** neither appears in needVehicle or needCheckIn

#### Scenario: Area admin queue is limited to its area
* **Given** an area_admin has areaId 2 and queue-eligible requests exist in areas 1 and 2
* **When** that user requests the service queue
* **Then** both arrays contain only area 2 requests

#### Scenario: Empty service queue arrays are returned
* **Given** no requests need a vehicle or check-in in the caller’s scope
* **When** an admin requests the service queue
* **Then** the response is 200 with needVehicle [] and needCheckIn []

#### Scenario: Service queue section shows both lists
* **Given** GET /service-queue returns rows in both arrays
* **When** the Schedule page loads
* **Then** Need vehicle and Need check-in each show their rows

#### Scenario: Service queue empty and failed states
* **Given** the queue request succeeds with both arrays empty, and separately fails with no message
* **When** each state renders
* **Then** success shows No requests need a vehicle. and No requests need check-in., and failure shows Service queue could not be loaded. without those empty claims

### US-11.3 — Move between weeks on the schedule

#### Scenario: Default weekStart is the current Monday
* **Given** today falls in the week of Monday 2026-11-02
* **When** an admin requests GET /vehicle-t6/schedule with no weekStart
* **Then** the response uses weekStart 2026-11-02

#### Scenario: Next and previous week change the range
* **Given** the Schedule page is showing weekStart 2026-11-02
* **When** the user selects Next week, then Previous week
* **Then** the page requests weekStart 2026-11-09 and then weekStart 2026-11-02

#### Scenario: Non-Monday weekStart is rejected
* **Given** an admin is signed in
* **When** GET /vehicle-t6/schedule?weekStart=2026-11-03 is sent
* **Then** the response is 400 with message Invalid schedule data.

#### Scenario: Admin may filter schedule by area
* **Given** overlapping requests exist in areas 1 and 2
* **When** an admin requests the schedule with areaId 2
* **Then** the response contains only area 2 items

#### Scenario: Unknown admin area filter is rejected
* **Given** no area has id 9999
* **When** an admin requests the schedule with areaId 9999
* **Then** the response is 404 with message Area with id=9999 not found.

#### Scenario: Area admin ignores a forged areaId query
* **Given** an area_admin has areaId 2
* **When** that user requests the schedule with areaId 1
* **Then** the response still contains only area 2 items

### US-11.4 — Restrict schedule and queue access

#### Scenario: Schedule and queue APIs require a session
* **Given** no valid application session is supplied
* **When** GET /schedule or GET /service-queue is sent
* **Then** each response is 401 with the Feature 1 Unauthorized. message

#### Scenario: Requestor cannot open the schedule API
* **Given** a requestor is signed in
* **When** GET /vehicle-t6/schedule is sent
* **Then** the response is 403 with the Feature 1 Forbidden. message

#### Scenario: Maintenance cannot open the service queue API
* **Given** a maintenance user is signed in
* **When** GET /vehicle-t6/service-queue is sent
* **Then** the response is 403 with the Feature 1 Forbidden. message

#### Scenario: Schedule navigation requires an allowed role
* **Given** a signed-out visitor opens /schedule
* **When** the Feature 1 route guard runs
* **Then** the visitor reaches /login

#### Scenario: Requestor and maintenance are sent Home from Schedule
* **Given** a requestor or maintenance user opens /schedule
* **When** the route guard runs
* **Then** the user reaches Home and MenuBar does not show Schedule

## Test Coverage Map

Exact `it(...)` titles. Backend file: `backend/tests/schedule.test.js`. Frontend file: `frontend/tests/Schedule.test.js`.

| Story | Scenario | File | Exact test name |
|-------|----------|------|-----------------|
| US-11.1 | Admin lists schedule items for the week | `backend/tests/schedule.test.js` | `it("Admin lists schedule items for the week")` |
| US-11.1 | Area admin lists only its area on the schedule | `backend/tests/schedule.test.js` | `it("Area admin lists only its area on the schedule")` |
| US-11.1 | Area admin without an assignment gets an empty schedule | `backend/tests/schedule.test.js` | `it("Area admin without an assignment gets an empty schedule")` |
| US-11.1 | Request spanning the week start is included | `backend/tests/schedule.test.js` | `it("Request spanning the week start is included")` |
| US-11.1 | Empty week returns an empty schedule | `backend/tests/schedule.test.js` | `it("Empty week returns an empty schedule")` |
| US-11.1 | Assigned vehicle label is included | `backend/tests/schedule.test.js` | `it("Assigned vehicle label is included")` |
| US-11.1 | Schedule page shows the week’s items | `frontend/tests/Schedule.test.js` | `it("Schedule page shows the week's items")` |
| US-11.1 | Schedule page distinguishes loading empty and failed states | `frontend/tests/Schedule.test.js` | `it("Schedule page distinguishes loading empty and failed states")` |
| US-11.1 | Schedule failure does not show an empty week | `frontend/tests/Schedule.test.js` | `it("Schedule failure does not show an empty week")` |
| US-11.2 | Admin lists requests that need a vehicle | `backend/tests/schedule.test.js` | `it("Admin lists requests that need a vehicle")` |
| US-11.2 | Admin lists requests that need check-in | `backend/tests/schedule.test.js` | `it("Admin lists requests that need check-in")` |
| US-11.2 | Returned and requested requests stay off the queue | `backend/tests/schedule.test.js` | `it("Returned and requested requests stay off the queue")` |
| US-11.2 | Area admin queue is limited to its area | `backend/tests/schedule.test.js` | `it("Area admin queue is limited to its area")` |
| US-11.2 | Empty service queue arrays are returned | `backend/tests/schedule.test.js` | `it("Empty service queue arrays are returned")` |
| US-11.2 | Service queue section shows both lists | `frontend/tests/Schedule.test.js` | `it("Service queue section shows both lists")` |
| US-11.2 | Service queue empty and failed states | `frontend/tests/Schedule.test.js` | `it("Service queue empty and failed states")` |
| US-11.3 | Default weekStart is the current Monday | `backend/tests/schedule.test.js` | `it("Default weekStart is the current Monday")` |
| US-11.3 | Next and previous week change the range | `frontend/tests/Schedule.test.js` | `it("Next and previous week change the range")` |
| US-11.3 | Non-Monday weekStart is rejected | `backend/tests/schedule.test.js` | `it("Non-Monday weekStart is rejected")` |
| US-11.3 | Admin may filter schedule by area | `backend/tests/schedule.test.js` | `it("Admin may filter schedule by area")` |
| US-11.3 | Unknown admin area filter is rejected | `backend/tests/schedule.test.js` | `it("Unknown admin area filter is rejected")` |
| US-11.3 | Area admin ignores a forged areaId query | `backend/tests/schedule.test.js` | `it("Area admin ignores a forged areaId query")` |
| US-11.4 | Schedule and queue APIs require a session | `backend/tests/schedule.test.js` | `it("Schedule and queue APIs require a session")` |
| US-11.4 | Requestor cannot open the schedule API | `backend/tests/schedule.test.js` | `it("Requestor cannot open the schedule API")` |
| US-11.4 | Maintenance cannot open the service queue API | `backend/tests/schedule.test.js` | `it("Maintenance cannot open the service queue API")` |
| US-11.4 | Schedule navigation requires an allowed role | `frontend/tests/Schedule.test.js` | `it("Schedule navigation requires an allowed role")` |
| US-11.4 | Requestor and maintenance are sent Home from Schedule | `frontend/tests/Schedule.test.js` | `it("Requestor and maintenance are sent Home from Schedule")` |

## Agent implementation request

Copy when asking Cursor to implement this feature (`@` this file):

```text
Implement Feature 11 from @features/feature-11-weekly-vehicle-schedule.md on branch `feature/11-weekly-vehicle-schedule`.

Follow layer order in @features/framework.md (models → routes → backend tests → frontend → frontend tests).
Map every Gherkin scenario in the Test Coverage Map; run `npm test` before finishing.
If API routes, payloads, schema, or product rules changed per this spec, update @features/reference/api.md, @features/reference/data-model.md, and/or @features/reference/behavior.md in the same PR to match shipped code.
Complete Definition of Done and the merge checklist in @features/framework.md.
Do not implement behavior not in this spec.
```

**Reference updates for this feature:** `api.md`, `behavior.md` (no new tables expected).

## Definition of Done

* [ ] Backend and frontend implemented per this spec (**FR-001**–**FR-014** satisfied)
* [ ] **Success Criteria (SC-001**–**SC-005)** met
* [ ] All mapped tests pass (`npm test`)
* [ ] Test Coverage Map complete
* [ ] `features/reference/data-model.md` updated (if schema changed)
* [ ] `features/reference/api.md` updated (if API changed)
* [ ] `features/reference/behavior.md` updated (if product rules changed)
* [ ] Agility stories and acceptance tests for Feature 11 are created or updated
* [ ] Application code for this feature is handwritten; automated tests may use AI assistance

## Out of Scope

* Creating or editing reservation requests: [Feature 7 — Reservation Requests in the catalog](README.md#feature-catalog).
* Assigning a vehicle or setting Awaiting vehicle / Reserved: [Feature 8 — Request Processing in the catalog](README.md#feature-catalog).
* Marking Returned or creating issue reports: [Feature 10 — Vehicle Issue Reports in the catalog](README.md#feature-catalog).
* Reservation emails: [Feature 9 — Reservation Emails in the catalog](README.md#feature-catalog).
* Mileage and service logs: [Feature 12 — Mileage & Service Logs in the catalog](README.md#feature-catalog).
* Drag-and-drop calendar editing or printing a PDF schedule.
