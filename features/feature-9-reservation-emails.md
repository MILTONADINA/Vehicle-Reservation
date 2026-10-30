# Feature: Reservation Emails

**Feature ID:** 9  
**Branch pattern:** `feature/9-reservation-emails`  
**Status:** Ready  
**Created:** 2026-10-29  
**Input:** Email requestors when reservation status changes and send the area’s pickup/return instructions with trip details the day before a reserved trip.  
**Depends on:** [Feature 2 — Area Management](feature-2-area-management.md), [Feature 4 — Vehicle Management](feature-4-vehicle-management.md), [Feature 8 — Request Processing](feature-8-request-processing.md)

---

## User Stories

### US-9.1: Receive reservation status emails

**As a** requestor  
**I want to** receive an email when my reservation status changes  
**So that** I know whether the trip is waiting for a vehicle, reserved, returned, or cancelled

**Priority:** P1  
**Independent test:** Commit each supported transition through the shared status-change function and inspect its queued message using a fake email transport.  
**Acceptance scenarios:** see ### US-9.1 under Acceptance Criteria

### US-9.2: Receive day-before pickup instructions

**As a** requestor  
**I want to** receive my area’s pickup and return instructions the day before the trip  
**So that** I know which vehicle to collect, where it is parked, and what instructions to follow

**Priority:** P1  
**Independent test:** Use a fixed America/Chicago clock and reserved request fixtures to check reminder selection and the resulting message.  
**Acceptance scenarios:** see ### US-9.2 under Acceptance Criteria

### US-9.3: Recover failed email deliveries

**As the** system  
**I want to** retain pending notifications and retry failed submissions without ordinary duplicate sends  
**So that** temporary email failures do not lose reservation notifications or undo successful reservation changes

**Priority:** P2  
**Independent test:** Replace SMTP with a deterministic fake, fail submissions, restart the dispatcher, and inspect persisted job state and retry times.  
**Acceptance scenarios:** see ### US-9.3 under Acceptance Criteria

### US-9.4: Send due reservation emails now

**As the** system administrator  
**I want to** run due reservation emails from the request-processing page  
**So that** I can trigger the same delivery work without waiting for the next scheduled run

**Priority:** P2  
**Independent test:** Call the trigger as admin and as disallowed callers, verify counts-only responses and unchanged eligibility rules, and exercise the Admin-only control with a mocked API.  
**Acceptance scenarios:** see ### US-9.4 under Acceptance Criteria

## Requirements

### Functional Requirements

* **FR-001:** Reservation Emails MUST reuse Area.noticeEmail from Feature 2, Vehicle fields from Feature 4, and the shared status-change operation and request fields delivered by Feature 8. It MUST NOT redefine authentication, area editing, vehicle management, or request processing.
* **FR-002:** Every committed change of a reservation’s status MUST prepare one status-change notification for the stored requestor. All Feature 8 transitions and Feature 7 requestor cancellation through the shared function MUST use this same hook; separate approve/deny or per-transition email-trigger routes MUST NOT be added. The admin-only batch trigger in FR-021 MUST reuse the shared delivery cycle without introducing another status-change path.
* **FR-003:** Initial creation with status requested and edits that do not change status MUST NOT prepare status-change mail. Rejected, same-status, unauthorized, out-of-scope, or rolled-back operations MUST NOT leave an email job.
* **FR-004:** Status changes and their notification-job inserts MUST commit in one database transaction. A job-insert failure MUST roll back the status/vehicle changes and use the existing 500 Reservation request failed. response. SMTP submission MUST occur only after that transaction commits and MUST NOT hold up the status response.
* **FR-005:** The email recipient MUST be users.email resolved through reservation_requests.requestorUserId. Client-supplied recipient, email, cc, or bcc properties MUST NOT change delivery. Additional recipients, CC, and BCC MUST NOT be added.
* **FR-006:** Status-change messages MUST use the subject and body contract below, containing the committed previous/new status labels, event time, request area, trip dates/times, and assigned vehicle when one exists. A provided cancellation statusReason MUST appear; a null reason MUST have no Reason line.
* **FR-007:** A status notification MUST snapshot its recipient, subject, and body during the source transaction. Later status changes MUST NOT rewrite an earlier pending event; it describes the recorded transition and change time, not a promise of the request’s latest state.
* **FR-008:** Pickup reminders MUST be prepared only for reserved requests whose departureDate is the next local calendar date. Eligibility MUST use America/Chicago and begin at 09:00 on that day-before date, ending at local midnight; it MUST NOT use the server’s default zone or an exact 24-hour lookback.
* **FR-009:** An eligible request first found later in that window, including after scheduler downtime or a late reservation, MUST be considered in the next scheduled or admin-triggered run. Trips departing today, in the past, or later than tomorrow, and all non-reserved statuses, MUST NOT produce a pickup reminder.
* **FR-010:** Reminders MUST combine the request area’s saved noticeEmail text with the system-generated request, schedule, vehicle, designatedParking, passengers, and purpose details below. They MUST NOT derive the area from the requestor’s account, treat noticeEmail as an address, lowercase it, render it as HTML, or invent pickup/return instructions.
* **FR-011:** Whole-day trips MUST show Whole day in place of both null times. Timed trips MUST show the stored HH:mm values and the America/Chicago label without inventing or shifting times.
* **FR-012:** Reminder messages MUST snapshot the current Area and Vehicle records when the job is first prepared, preserving noticeEmail case, internal spaces, and line breaks. The saved message MUST be reused on retries; later catalog edits MUST NOT create additional messages for that same request/departure date.
* **FR-013:** The backend process MUST register one in-process node-cron job using `* * * * *` with timezone America/Chicago. Every minute, at all times of day, it MUST run the shared cycle that prepares eligible reminders and dispatches due notifications and retries. Only reminder preparation is limited to the 09:00 day-before window; status-email dispatch and retries MUST continue outside that window. The admin-only Send now trigger MUST invoke the same cycle with the same eligibility, idempotency, and retry rules. Scheduled-run failures MUST be caught and logged without stopping the HTTP server.
* **FR-014:** Each job MUST have a unique request/kind/notificationKey as specified in Data Model Requirements. Repeated scans, duplicate preparation attempts, or concurrent dispatchers MUST NOT create ordinary duplicate notifications or concurrently submit the same pending job.
* **FR-015:** Before claiming each reminder delivery or retry, the dispatcher MUST recheck that the request is still reserved with a vehicle and still inside its day-before window. If it is no longer eligible, the pending job MUST become skipped without another SMTP submission. A cancellation committed before the claim MUST prevent reminder delivery; separately queued status messages MUST NOT be skipped on that account.
* **FR-016:** SMTP acceptance MUST mark a notification sent and record sentAt. Sent, failed, and skipped jobs MUST NOT be automatically submitted again. Delivery means provider acceptance, not guaranteed inbox placement.
* **FR-017:** A failed submission MUST increase attemptCount, leave the job pending until five minutes after that attempt, and permit at most three total attempts. The third failure MUST mark the job failed. One failed job MUST NOT prevent other due jobs from being processed.
* **FR-018:** Pending jobs and retry state MUST persist across process restarts. Source reservation status and vehicle assignment MUST NOT be rolled back because of an SMTP failure after the source transaction has committed.
* **FR-019:** SMTP settings MUST come from server environment configuration. Missing or invalid required configuration MUST log EMAIL_CONFIGURATION_INVALID and skip that run without creating jobs, consuming attempts, or altering pending jobs. It MUST NOT crash the backend or prevent later scheduled runs. The admin trigger MUST return the documented generic 500 for this failure. Sender passwords and other secrets MUST NOT be committed or returned in an API response.
* **FR-020:** Logs MUST use job ids, delivery state, counts, and fixed error codes only; recipient addresses, bodies, credentials, application tokens, and raw provider errors MUST NOT be logged. Existing request/area/vehicle API payloads MUST NOT expose private email jobs.
* **FR-021:** Only a caller whose current Feature 1 database role is admin MUST be allowed to POST /vehicle-t6/reservation-emails/send-now. A request without a valid session MUST receive 401 Unauthorized.; area_admin, requestor, and maintenance MUST receive 403 Forbidden. before any delivery work starts. An authorized run MUST return 200 with the five numeric counts in API Requirements, including zero counts when no work is due. Request parameters MUST NOT override recipients, eligibility, retry timing, or terminal delivery states. Unexpected run failures MUST return 500 Emails could not be processed. without exposing private delivery data or undoing already-persisted work.
* **FR-022:** The request-processing page MUST show Send now only to admin. A pending trigger MUST show progress and block repeated clicks. Success MUST display only the returned counts; a 500 or network failure MUST display its API message or Emails could not be processed. and allow retry. It MUST NOT clear or modify the request list. Authentication and authorization failures MUST retain Feature 1’s existing client handling.

## Assumptions

* Features 2, 4, and 8, including their transitive dependencies, are implemented before this feature is implemented. Ready specs alone do not supply runtime models or functions.
* This Draft chooses 09:00 America/Chicago for reminders. These are calendar-day reminders, including whole-day trips, not exactly-24-hours-before-departure alerts.
* Scheduling uses node-cron inside the backend process, as agreed by the team. Production startup registers the job once; automated tests do not auto-start it. Scheduler tests explicitly register a stub cron job and invoke its callback with a fake clock and transport.
* SMTP delivery uses a university-approved sender configured for the server. The provider and actual credentials are deployment configuration, not stored in this spec.
* There is no booking-confirmation email for initial requested creation; the interview requires emails when a status changes. Requestor cancellation must still notify through Feature 8’s shared function.
* Feature 8’s transition graph never returns to an earlier status. A request’s next-status value therefore identifies its status event for duplicate prevention; if that graph changes later, event keys must be revised in the same change.
* Area.noticeEmail contains the full area-specific key collection, return, cleaning/fuel, and contact instructions. This feature appends known trip/vehicle facts; it does not invent missing instructions or use that text as a recipient.
* Message text is frozen when its job is prepared. In particular, retries use the same message, and queued historical status events can arrive after a later transition; their event time identifies what changed.
* SMTP and the database do not share a transaction. Duplicate prevention covers repeated scans, concurrent attempts, and successfully recorded deliveries; an ambiguous provider outcome or process crash after acceptance but before recording sent can still lead to a retry. Exactly-once external delivery is not promised.
* Tests use real models from the lower features, the new notification table, a fake clock, and a fake transport. They must not need live SMTP, live Google credentials, or a future feature’s tables.

## Edge Cases

* Initial requested creation or an unsuccessful transition produces no status notification.
* A requestor’s null user.areaId does not prevent using the area selected on the reservation.
* A reserved trip with no times still gets a calendar-day reminder using Whole day labels.
* UTC date boundaries and daylight-saving changes must not select the wrong departure date.
* A newly reserved trip after 09:00 and a restarted scheduler catch up only within the remaining day-before window.
* Cancellation or return before a reminder’s claim causes that reminder to be skipped; accepted email cannot be recalled.
* A provider failure after the reservation commits is a delivery issue, not a failed reservation update.
* Send now before 09:00 may dispatch due status emails but cannot prepare an early pickup reminder or force an early retry.
* An invalid SMTP configuration skips that minute’s work; the HTTP server stays available and the following minute can run again after configuration is corrected.

## Success Criteria

* **SC-001:** Every successful status transition covered by the shared function creates the correct recipient/message job; rejected operations create none.
* **SC-002:** Reminder selection obeys the specified local date, time window, status, whole-day, and cancellation rules under a fixed-clock test.
* **SC-003:** Reminder content preserves the saved area instructions and includes only the specified trip and assigned-vehicle facts.
* **SC-004:** Duplicate preparation, concurrent dispatch, persisted retries, and terminal states behave as the mapped tests specify.
* **SC-005:** No private message content or credentials leak through client API payloads or application logs.
* **SC-006:** Every scenario has an exact-name automated test before completion, and the operator verifies both message types through a controlled test inbox during implementation.
* **SC-007:** The admin trigger and control enforce the documented 401/403/500 behavior, reuse scheduled eligibility rules, and expose only delivery counts on success.

## Data Ownership & Isolation

* Each notification belongs to one existing reservation request. It is addressed only to that request’s stored requestor, regardless of the caller who changed status.
* Feature 8 continues to enforce admin/area_admin processing permissions; Feature 7 continues to authorize requestor cancellation. Hooking a notification must not broaden either endpoint’s permissions.
* Area selection comes from reservation_requests.areaId, not from the caller’s or requestor’s user.areaId. Vehicle details come from the assigned vehicleId.
* Notification rows and the dispatcher remain internal server resources. Admin alone may invoke POST /vehicle-t6/reservation-emails/send-now and receive counts only. No role receives a notification-list, preview, forced-resend, or recipient-override endpoint; area_admin, requestor, and maintenance cannot trigger delivery.
* The SMTP sender comes from configuration; the area’s noticeEmail is message text, not a sender, recipient, or Reply-To address.

## Key Entities

* **Reservation request:** the existing trip and status record delivered by Feature 8; its stored requestor receives notifications.
* **Area:** the existing record from Feature 2 supplying areaName and custom noticeEmail instructions.
* **Vehicle:** the existing assigned fleet unit from Feature 4 supplying its identity and designatedParking.
* **Reservation email:** an internal saved notification with a message snapshot, event key, delivery state, and retry bookkeeping.

## API Requirements

This feature adds one admin-only batch trigger. It otherwise preserves public request payloads and hooks the shared status-change function specified by [Feature 8](feature-8-request-processing.md), including its use by [Feature 7](feature-7-reservation-requests.md) cancellation.

| Method | Endpoint | Allowed role | Request | Success |
|--------|----------|--------------|---------|---------|
| POST | `/vehicle-t6/reservation-emails/send-now` | admin only, checked through Feature 1 | Empty body; request properties and query parameters cannot override the run | `200`, counts object below |

Example success: `{ "queued": 2, "sent": 3, "retryScheduled": 1, "failed": 0, "skipped": 1 }`. Each field is a nonnegative integer counting work performed by this invocation, not lifetime totals:

* queued: new pickup-reminder jobs inserted by this run. Previously queued status jobs are not counted as newly queued.
* sent: messages accepted and recorded as sent by this run.
* retryScheduled: submissions that failed this run and were scheduled for another attempt.
* failed: jobs reaching their third failed submission in this run.
* skipped: pending reminders marked skipped for lost eligibility in this run.

Return all five keys, including zero values. Jobs claimed by another run are not included in these counts. The response MUST NOT contain recipients, subjects, bodies, job records, or credentials.

| Trigger failure | Status | Message |
|-----------------|--------|---------|
| Missing or invalid session | 401 | Feature 1 `Unauthorized.` |
| Current role is area_admin, requestor, or maintenance | 403 | Feature 1 `Forbidden.` |
| Invalid SMTP configuration or an unexpected run/storage failure | 500 | `Emails could not be processed.` |

Individual SMTP submission failures follow the retry policy and appear in the 200 counts; they are not fatal run errors. A fatal error does not undo submissions or job updates already persisted before it occurred. Later scheduled or manual runs retain the same duplicate-prevention and terminal-state rules.

| Existing operation | Feature 9 integration | Response |
|--------------------|-----------------------|----------|
| PUT `/vehicle-t6/reservation-requests/:id/status` | Save one status-event job in the same successful transaction | Existing `200` ReservationRequest; no email-job fields |
| PUT `/vehicle-t6/reservation-requests/:id/cancel` | Use that same shared hook for the requestor’s requested → cancelled transition | Existing `200` ReservationRequest; no email-job fields |
| Failed status or cancel operation | Commit no email job | Existing Feature 7/8 error unchanged |
| Notification insert fails before source commit | Roll back source transaction and job together | `500`, `{ "message": "Reservation request failed." }` |
| SMTP fails after source commit | Retain the committed source result and retry the internal job | No new HTTP response or source rollback |

The backend registers a node-cron callback at startup, with expression `* * * * *` and timezone America/Chicago. Each callback and each admin trigger checks configuration, prepares eligible reminders, and processes due pending jobs through the same delivery cycle. The minute cadence supports five-minute retries throughout the day while the reminder-preparation window remains unchanged. Missing/invalid SMTP configuration logs EMAIL_CONFIGURATION_INVALID and skips that run; other scheduled exceptions log EMAIL_RUN_FAILED. These failures are caught so the HTTP server and future ticks remain available. The admin endpoint translates a fatal failure to the generic 500 above. No external scheduler or standalone command is required.

### Status-change message

* **To:** the job snapshot of the requestor’s verified local email.
* **From:** SMTP_FROM.
* **Subject:** `Reservation #<id> — <new status label>`.
* **Plain-text body lines:** `Reservation: #<id>`, `Status changed: <old label> -> <new label>`, `Changed at: <UTC ISO timestamp>`, `Area: <areaName>`, `Departure: <departureDate> <time or Whole day> (America/Chicago)`, and `Return: <returnDate> <time or Whole day> (America/Chicago)`.
* If vehicleId exists for this committed status, append `Vehicle: <year> <make> <model>, <color>, plate <plateNumber>`; otherwise append `Vehicle: Not assigned`.
* For a cancellation with a non-null statusReason, append `Reason: <statusReason>`; omit the line otherwise. Use the existing Feature 8 display labels, not new statuses.

### Pickup-reminder message

* **To / From:** the same rules as above.
* **Subject:** `Reservation #<id> — vehicle pickup reminder`.
* Start the plain-text body with the request area’s noticeEmail, unchanged after its existing outer trimming, then a blank line.
* Append `Reservation: #<id>`, `Area: <areaName>`, Departure and Return lines in the format above, the assigned Vehicle line, `Pickup parking: <designatedParking>`, `Passengers: <passengers>`, and `Purpose: <purpose>`.
* There is no HTML body, attachment, CC, BCC, recipient override, or new area-template editor.

## Screen Requirements

Continue [Feature 8](feature-8-request-processing.md)’s `/reservation-requests` page; do not add a separate screen, route, or menu link. Add an admin-only **Send now** button beside the page heading, outside the request rows. It processes due emails across requests and must not appear for area_admin, requestor, or maintenance. [Feature 2](feature-2-area-management.md) continues to own custom noticeEmail editing.

Selecting Send now calls POST `/vehicle-t6/reservation-emails/send-now` with no overrides. Disable the button and show progress until it settles; repeated clicks send no additional request. On 200, show **Queued**, **Sent**, **Retry scheduled**, **Failed**, and **Skipped** with their numeric values, including zeros. Do not display recipients, subjects, bodies, or claim that messages reached inboxes.

On a 500, show the API message; on a network failure or error without a message, show `Emails could not be processed.`. Re-enable Send now for another attempt. Reuse Feature 1 handling for 401 and 403. The control and its results must not change or clear the request list or interfere with existing status-change controls. Detailed job monitoring remains internal state and sanitized logs.

## Data Model Requirements

Add `reservation_emails` as internal delivery records:

| Field | Type | Rule |
|-------|------|------|
| id | Integer | Generated primary key |
| reservationRequestId | Integer | Required FK to reservation_requests.id, `ON DELETE RESTRICT` |
| kind | Enum | `status_change` or `pickup_reminder` |
| notificationKey | String(32) | New status for status_change; departureDate `YYYY-MM-DD` for pickup_reminder |
| recipient | String(254) | Required snapshot of the requestor email |
| subject | String(255) | Required message snapshot |
| body | Text | Required plain-text message snapshot |
| deliveryState | Enum | `pending`, `sent`, `failed`, `skipped`; initially pending |
| attemptCount | Integer | Initially 0; at most 3 transport attempts |
| nextAttemptAt | Date/time | UTC; initially creation time, then five minutes after a failed attempt; null for terminal states |
| sentAt | Date/time, nullable | UTC acceptance time once sent; null otherwise |

Use normal createdAt/updatedAt timestamps. Add a unique constraint on `(reservationRequestId, kind, notificationKey)`. Add ReservationRequest hasMany ReservationEmail / ReservationEmail belongsTo ReservationRequest in models/index.js; do not change the existing requestor, area, driver, destination, or vehicle relationships.

No request-delete route exists, so this foreign key introduces no 409 API behavior or 409 scenario in this feature.

The dispatcher must serialize claims and state changes so only one worker attempts a given job at a time. For pickup reminders, eligibility is checked under the same request-state serialization used for a status change; cancellations committed before that claim are observed. This contract does not require a new public lock or queue endpoint.

Status-job snapshots are stored in the status transaction; reminder snapshots are stored when an eligible reminder is first prepared. A unique-key conflict from preparing the same notification uses the existing job without replacing its message or resetting its attempt count. Terminal jobs remain terminal.

Configuration during implementation: SMTP_HOST, SMTP_PORT, SMTP_FROM, SMTP_SECURE, and the matching SMTP_USER/SMTP_PASSWORD credentials required by the approved relay. Host, port, sender, secure-mode shape, and any configured credential pair must be validated before dispatch. Credentials are environment values, never columns. No live secrets or provider account are defined by this spec.

## Acceptance Criteria (Gherkin)

### US-9.1 — Receive reservation status emails

#### Scenario: Status email is prepared for requested to awaiting_vehicle
* **Given** a request is requested and an authorized admin or in-area area_admin supplies a valid Feature 8 transition to awaiting_vehicle
* **When** the shared status-change transaction commits
* **Then** exactly one pending status_change email job describes the transition to Awaiting Vehicle and is addressed to that request’s stored requestor
* **And** the existing status endpoint returns its unchanged 200 ReservationRequest response without waiting for SMTP
* **And** the subject and body follow the Status-change message contract, including the request id, old/new labels, recorded event time, area, schedule, and Vehicle: Not assigned
* **And** the API response exposes no email recipient, body, delivery state, or SMTP configuration

#### Scenario: Status email is prepared for requested to reserved
* **Given** a request is requested and an authorized admin or in-area area_admin supplies a valid Feature 8 transition to reserved
* **When** the shared status-change transaction commits
* **Then** exactly one pending status_change email job describes the transition to Reserved and is addressed to that request’s stored requestor
* **And** the existing status endpoint returns its unchanged 200 ReservationRequest response without waiting for SMTP
* **And** the message contains the assigned vehicle’s year, make, model, color, and plate number

#### Scenario: Status email is prepared for awaiting_vehicle to reserved
* **Given** a request is awaiting_vehicle and an authorized admin or in-area area_admin supplies a valid Feature 8 transition to reserved
* **When** the shared status-change transaction commits
* **Then** exactly one pending status_change email job describes the transition to Reserved and is addressed to that request’s stored requestor
* **And** the existing status endpoint returns its unchanged 200 ReservationRequest response without waiting for SMTP

#### Scenario: Status email is prepared for reserved to returned
* **Given** a request is reserved and an authorized admin or in-area area_admin supplies a valid Feature 8 transition to returned
* **When** the shared status-change transaction commits
* **Then** exactly one pending status_change email job describes the transition to Returned and is addressed to that request’s stored requestor
* **And** the existing status endpoint returns its unchanged 200 ReservationRequest response without waiting for SMTP

#### Scenario: Status email is prepared for requested to cancelled
* **Given** a request is requested and an authorized admin or in-area area_admin supplies a valid Feature 8 transition to cancelled
* **When** the shared status-change transaction commits
* **Then** exactly one pending status_change email job describes the transition to Cancelled and is addressed to that request’s stored requestor
* **And** the existing status endpoint returns its unchanged 200 ReservationRequest response without waiting for SMTP

#### Scenario: Status email is prepared for awaiting_vehicle to cancelled
* **Given** a request is awaiting_vehicle and an authorized admin or in-area area_admin supplies a valid Feature 8 transition to cancelled
* **When** the shared status-change transaction commits
* **Then** exactly one pending status_change email job describes the transition to Cancelled and is addressed to that request’s stored requestor
* **And** the existing status endpoint returns its unchanged 200 ReservationRequest response without waiting for SMTP

#### Scenario: Status email is prepared for reserved to cancelled
* **Given** a request is reserved and an authorized admin or in-area area_admin supplies a valid Feature 8 transition to cancelled
* **When** the shared status-change transaction commits
* **Then** exactly one pending status_change email job describes the transition to Cancelled and is addressed to that request’s stored requestor
* **And** the existing status endpoint returns its unchanged 200 ReservationRequest response without waiting for SMTP

#### Scenario: Requestor cancellation prepares a status email
* **Given** a requestor owns a requested reservation
* **When** the requestor uses Feature 7’s cancel route through Feature 8’s shared status-change function
* **Then** one status_change job for Cancelled is committed for that requestor, and the cancellation keeps its existing 200 response

#### Scenario: Request creation and ordinary edits do not send status emails
* **Given** a requestor creates a requested reservation and later edits its permitted fields without changing status
* **When** those Feature 7 operations succeed
* **Then** no status_change email job is created for either operation

#### Scenario: Rejected status changes prepare no email
* **Given** a status-change attempt is unauthenticated, forbidden, out of scope, invalid, a same-status update, or rolled back
* **When** the applicable Feature 7 or Feature 8 route rejects the operation
* **Then** no notification job is committed and the existing API error and unchanged request are preserved

#### Scenario: Email recipient cannot be overridden by request data
* **Given** a valid transition includes extra recipient, email, cc, and bcc properties supplied by the client
* **When** the authorized transition commits
* **Then** the only recipient is users.email resolved from reservation_requests.requestorUserId, with no CC or BCC

#### Scenario: Status emails retain the committed transition snapshot
* **Given** a request is reserved and then cancelled before its Reserved notification is dispatched
* **When** the pending Reserved job is dispatched
* **Then** its subject and body describe the earlier Requested or Awaiting Vehicle to Reserved event and its recorded change time, not the later Cancelled state
* **And** the separate Cancelled job remains a separate notification

#### Scenario: Cancellation reason is included only when provided
* **Given** admin cancellations are committed with a valid statusReason and with null statusReason
* **When** their email bodies are prepared
* **Then** the supplied reason appears as plain text for the first event and the Reason line is omitted for the null case

#### Scenario: Email preparation failure rolls back the status change
* **Given** a valid transition is being saved but inserting its notification job fails
* **When** the shared transaction completes unsuccessfully
* **Then** the request status and vehicle changes and the email job are all rolled back
* **And** the existing route returns 500 with Reservation request failed.

### US-9.2 — Receive day-before pickup instructions

#### Scenario: Timed trip receives a day-before pickup reminder
* **Given** it is 09:00 America/Chicago and a reserved request with a vehicle departs tomorrow at a stored departureTime
* **When** the scheduled job runs
* **Then** one pickup_reminder job is prepared for its requestor and the due dispatcher offers it to SMTP
* **And** the message includes the saved area instructions, trip dates and times, and the assigned vehicle and designated parking

#### Scenario: Whole-day trip reminder does not invent a departure time
* **Given** a reserved request departs tomorrow with departureTime and returnTime both null
* **When** the scheduled job runs after 09:00 America/Chicago today
* **Then** the reminder displays both dates with Whole day instead of inventing midnight pickup or return times

#### Scenario: Reminder is not prepared before the daily start time
* **Given** a reserved request departs tomorrow and the local clock is 08:59 America/Chicago
* **When** the scheduled job runs
* **Then** no pickup_reminder job is created or sent

#### Scenario: Reminder date uses the campus calendar instead of the UTC date
* **Given** the clock is 2026-10-30T01:00:00Z, which is 20:00 on October 29 in America/Chicago, and reserved trips depart October 30 and October 31
* **When** the scheduled job scans for reminders
* **Then** only the October 30 trip is selected

#### Scenario: Daylight saving changes do not shift the reminder day
* **Given** the fixed clock is 2026-10-31 at 09:00 America/Chicago with a trip departing 2026-11-01, or 2027-03-13 at 09:00 with a trip departing 2027-03-14
* **When** the scheduled job calculates the next local calendar date
* **Then** the corresponding trip is selected once across each daylight-saving boundary using America/Chicago calendar dates rather than an exact 24-hour interval

#### Scenario: Only Reserved trips receive pickup reminders
* **Given** requests departing tomorrow have statuses requested, awaiting_vehicle, reserved, returned, and cancelled
* **When** the scheduled job runs after local 09:00
* **Then** only the reserved request produces a pickup_reminder job

#### Scenario: Trips outside tomorrow are not selected
* **Given** reserved requests depart today, in the past, or two or more local calendar days from today
* **When** the scheduled job scans for reminders
* **Then** no pickup_reminder job is created for those requests

#### Scenario: Reminder uses the request area rather than a user assignment
* **Given** a requestor has null user.areaId and owns a reserved request for area 2
* **When** a reminder is prepared for that request
* **Then** its custom instructions come from area 2 and its recipient comes from that requestor’s email

#### Scenario: Saved reminder instructions are preserved as plain text
* **Given** the request’s area noticeEmail contains mixed case, internal spaces, line breaks, a contact email, and markup-like text
* **When** the reminder is prepared
* **Then** that content remains plain message text with its formatting preserved, never an address, HTML template, subject, or recipient override

#### Scenario: Reminder snapshots the current area and vehicle data when queued
* **Given** area instructions or vehicle designatedParking were edited after booking but before the reminder is prepared
* **When** the scheduled job creates the reminder job
* **Then** the saved message uses those current records and its snapshot is retained unchanged for any later delivery retry

#### Scenario: Late reservation or scheduler restart catches up on the day before
* **Given** it is after 09:00 but before local midnight, and an eligible request was reserved after 09:00 or the scheduler was unavailable earlier
* **When** the scheduled job runs during that same day-before window
* **Then** the unsent reminder is queued once without waiting for the next morning

#### Scenario: Repeated and concurrent reminder scans do not duplicate jobs
* **Given** an eligible request is found by repeated or simultaneous scheduled or admin-triggered runs
* **When** each run prepares the reminder
* **Then** the unique request, kind, and departure-date key permits only one saved pickup_reminder job

#### Scenario: Cancellation before the reminder claim prevents delivery
* **Given** a pickup reminder is pending and the request cancellation commits before the dispatcher claims that reminder
* **When** the dispatcher checks the request before sending
* **Then** the pickup reminder becomes skipped without SMTP submission
* **And** the separate Cancelled status notification is still eligible for delivery

#### Scenario: Reminder retries stop when the trip is no longer eligible
* **Given** a pickup reminder is pending but the request is now returned or cancelled, or the day-before window has ended
* **When** a retry becomes due
* **Then** the reminder becomes skipped without another transport attempt

### US-9.3 — Recover failed email deliveries

#### Scenario: Accepted email is recorded and not sent again
* **Given** a due pending notification has not been accepted by SMTP
* **When** the transport accepts its message and the result is persisted
* **Then** the job becomes sent with sentAt, attemptCount increases by one, and later runs do not submit it again

#### Scenario: Transport failure keeps a committed reservation update
* **Given** a valid status transition already committed with its pending email job
* **When** the first SMTP submission fails
* **Then** the source reservation remains updated and the job stays pending with attemptCount 1 and nextAttemptAt five minutes later
* **And** the original successful HTTP operation is not changed into an email failure response

#### Scenario: Retry waits until its due time
* **Given** a failed delivery has a nextAttemptAt five minutes after its first attempt
* **When** the dispatcher runs before nextAttemptAt and again at nextAttemptAt
* **Then** no early submission occurs and the due run makes exactly one additional attempt

#### Scenario: Three failed submissions stop automatic retries
* **Given** a notification’s transport fails on every submission
* **When** three attempts run with five minutes between failures
* **Then** attemptCount is 3, the job becomes failed, and later runs do not make a fourth attempt

#### Scenario: Pending delivery survives a process restart
* **Given** a due pending status notification was saved before the dispatcher process stopped
* **When** the restarted backend’s scheduled job uses the existing database
* **Then** it submits the pending notification rather than losing it or creating a second job

#### Scenario: Concurrent dispatchers serialize a notification attempt
* **Given** two dispatchers find the same pending job
* **When** they attempt to claim it concurrently
* **Then** only one owns its delivery attempt and the other does not submit a duplicate message

#### Scenario: Missing email configuration preserves pending jobs
* **Given** required SMTP configuration is missing or invalid and notification jobs are pending
* **When** the scheduled job runs
* **Then** it logs EMAIL_CONFIGURATION_INVALID and skips that run without creating jobs or changing pending jobs or attempt counts
* **And** the HTTP server stays available, a valid /auth/me request still succeeds, and later cron ticks can run

#### Scenario: Email logs omit recipients bodies and secrets
* **Given** configured sender credentials and private notification content are present during successful and failed dispatch
* **When** the scheduled job records its outcomes
* **Then** logs contain only notification ids, state, counts, and fixed error codes, not recipient addresses, message bodies, tokens, credentials, or raw provider errors

#### Scenario: One delivery failure does not stop other due notifications
* **Given** two unrelated due notifications exist and the first fails at the transport
* **When** the dispatcher processes the batch
* **Then** the first is rescheduled or failed according to its attempts and the second is still submitted

#### Scenario: Backend registers its in-process email schedule
* **Given** backend startup uses a stub node-cron scheduler and fake email dependencies
* **When** the email schedule is registered for that backend process
* **Then** one job uses cron expression * * * * * and timezone America/Chicago
* **And** its callback invokes the same delivery cycle as Send now, with status dispatch and due retries active outside the 09:00 reminder window

#### Scenario: Unexpected scheduled failure keeps the server available
* **Given** SMTP configuration is valid but the scheduled cycle raises an unexpected database error
* **When** the cron callback runs
* **Then** it catches the failure and logs EMAIL_RUN_FAILED without a raw error, recipient, or body
* **And** the HTTP server remains available and the next scheduled callback can run

### US-9.4 — Send due reservation emails now

#### Scenario: Admin triggers due emails with counts only
* **Given** an admin has a valid session and the shared cycle has eligible reminders and due notifications
* **When** POST /vehicle-t6/reservation-emails/send-now is sent with no overrides
* **Then** the shared cycle runs once and the response is 200 with exactly queued, sent, retryScheduled, failed, and skipped as nonnegative integer counts for that invocation
* **And** an invocation with no due work returns all five counts as zero
* **And** eligibility, reminder time windows, retry timing, and terminal-state protection are the same as for a scheduled run
* **And** no recipient, subject, body, credentials, or job record appears in the response

#### Scenario: Trigger parameters cannot override the email run
* **Given** an admin has a valid session and the trigger request carries recipient, email, cc, bcc, status, nextAttemptAt, and attemptCount properties in its body and query string
* **When** POST /vehicle-t6/reservation-emails/send-now is sent with those properties
* **Then** the run ignores them: each message still goes to its stored requestor, reminder eligibility and retry timing are unchanged, terminal jobs stay terminal, and the response is the same five counts

#### Scenario: Signed-out caller cannot trigger emails
* **Given** no valid Feature 1 session is supplied
* **When** POST /vehicle-t6/reservation-emails/send-now is sent
* **Then** the response is 401 with message Unauthorized. and no delivery work starts

#### Scenario: Non-admin roles cannot trigger emails
* **Given** a valid session has role area_admin, requestor, or maintenance
* **When** each role sends POST /vehicle-t6/reservation-emails/send-now
* **Then** each response is 403 with message Forbidden. and no delivery work starts

#### Scenario: Fatal admin email run returns a safe error
* **Given** an admin is authenticated and the shared cycle encounters invalid SMTP configuration or an unexpected run failure
* **When** POST /vehicle-t6/reservation-emails/send-now is sent
* **Then** the response is 500 with message Emails could not be processed. and no private delivery data
* **And** the backend remains available and already-persisted notification outcomes and reservation changes are not rolled back

#### Scenario: Send now control is visible only to admin
* **Given** the application is opened with admin, area_admin, requestor, and maintenance sessions in turn
* **When** each role reaches the pages its existing guards permit
* **Then** only admin sees Send now beside the heading on /reservation-requests, outside the request rows
* **And** no separate email screen or menu link is added

#### Scenario: Send now shows progress and returned counts
* **Given** an admin opens /reservation-requests and the trigger API will return the five counts
* **When** the admin selects Send now and clicks again while the first request is pending
* **Then** only one POST is sent, progress is shown, and the control stays disabled until the response
* **And** after 200, Queued, Sent, Retry scheduled, Failed, and Skipped show their returned numeric values including zeros
* **And** the control is enabled again and the request list remains unchanged without displaying private message details or an inbox-delivery claim

#### Scenario: Send now failure allows another attempt
* **Given** an admin triggers emails and the API returns a 500 message or a network failure without a message
* **When** the request fails
* **Then** the page displays the API message or Emails could not be processed. and enables Send now again
* **And** the request list and existing status-change controls remain intact

## Test Coverage Map

Tests are written during implementation after spec approval. They use lower-feature database fixtures, the new reservation_emails table, a fake clock, a stub node-cron scheduler, and a fake SMTP transport. Frontend tests mock the trigger API and verify the existing processing-page control. Automated tests do not start a live cron schedule or send live email.

| Story | Scenario | Test file | Test name |
|-------|----------|-----------|-----------|
| US-9.1 | Status email is prepared for requested to awaiting_vehicle | `backend/tests/reservationEmails.test.js` | `it("Status email is prepared for requested to awaiting_vehicle")` |
| US-9.1 | Status email is prepared for requested to reserved | `backend/tests/reservationEmails.test.js` | `it("Status email is prepared for requested to reserved")` |
| US-9.1 | Status email is prepared for awaiting_vehicle to reserved | `backend/tests/reservationEmails.test.js` | `it("Status email is prepared for awaiting_vehicle to reserved")` |
| US-9.1 | Status email is prepared for reserved to returned | `backend/tests/reservationEmails.test.js` | `it("Status email is prepared for reserved to returned")` |
| US-9.1 | Status email is prepared for requested to cancelled | `backend/tests/reservationEmails.test.js` | `it("Status email is prepared for requested to cancelled")` |
| US-9.1 | Status email is prepared for awaiting_vehicle to cancelled | `backend/tests/reservationEmails.test.js` | `it("Status email is prepared for awaiting_vehicle to cancelled")` |
| US-9.1 | Status email is prepared for reserved to cancelled | `backend/tests/reservationEmails.test.js` | `it("Status email is prepared for reserved to cancelled")` |
| US-9.1 | Requestor cancellation prepares a status email | `backend/tests/reservationEmails.test.js` | `it("Requestor cancellation prepares a status email")` |
| US-9.1 | Request creation and ordinary edits do not send status emails | `backend/tests/reservationEmails.test.js` | `it("Request creation and ordinary edits do not send status emails")` |
| US-9.1 | Rejected status changes prepare no email | `backend/tests/reservationEmails.test.js` | `it("Rejected status changes prepare no email")` |
| US-9.1 | Email recipient cannot be overridden by request data | `backend/tests/reservationEmails.test.js` | `it("Email recipient cannot be overridden by request data")` |
| US-9.1 | Status emails retain the committed transition snapshot | `backend/tests/reservationEmails.test.js` | `it("Status emails retain the committed transition snapshot")` |
| US-9.1 | Cancellation reason is included only when provided | `backend/tests/reservationEmails.test.js` | `it("Cancellation reason is included only when provided")` |
| US-9.1 | Email preparation failure rolls back the status change | `backend/tests/reservationEmails.test.js` | `it("Email preparation failure rolls back the status change")` |
| US-9.2 | Timed trip receives a day-before pickup reminder | `backend/tests/reservationEmailSchedule.test.js` | `it("Timed trip receives a day-before pickup reminder")` |
| US-9.2 | Whole-day trip reminder does not invent a departure time | `backend/tests/reservationEmailSchedule.test.js` | `it("Whole-day trip reminder does not invent a departure time")` |
| US-9.2 | Reminder is not prepared before the daily start time | `backend/tests/reservationEmailSchedule.test.js` | `it("Reminder is not prepared before the daily start time")` |
| US-9.2 | Reminder date uses the campus calendar instead of the UTC date | `backend/tests/reservationEmailSchedule.test.js` | `it("Reminder date uses the campus calendar instead of the UTC date")` |
| US-9.2 | Daylight saving changes do not shift the reminder day | `backend/tests/reservationEmailSchedule.test.js` | `it("Daylight saving changes do not shift the reminder day")` |
| US-9.2 | Only Reserved trips receive pickup reminders | `backend/tests/reservationEmailSchedule.test.js` | `it("Only Reserved trips receive pickup reminders")` |
| US-9.2 | Trips outside tomorrow are not selected | `backend/tests/reservationEmailSchedule.test.js` | `it("Trips outside tomorrow are not selected")` |
| US-9.2 | Reminder uses the request area rather than a user assignment | `backend/tests/reservationEmailSchedule.test.js` | `it("Reminder uses the request area rather than a user assignment")` |
| US-9.2 | Saved reminder instructions are preserved as plain text | `backend/tests/reservationEmailSchedule.test.js` | `it("Saved reminder instructions are preserved as plain text")` |
| US-9.2 | Reminder snapshots the current area and vehicle data when queued | `backend/tests/reservationEmailSchedule.test.js` | `it("Reminder snapshots the current area and vehicle data when queued")` |
| US-9.2 | Late reservation or scheduler restart catches up on the day before | `backend/tests/reservationEmailSchedule.test.js` | `it("Late reservation or scheduler restart catches up on the day before")` |
| US-9.2 | Repeated and concurrent reminder scans do not duplicate jobs | `backend/tests/reservationEmailSchedule.test.js` | `it("Repeated and concurrent reminder scans do not duplicate jobs")` |
| US-9.2 | Cancellation before the reminder claim prevents delivery | `backend/tests/reservationEmailSchedule.test.js` | `it("Cancellation before the reminder claim prevents delivery")` |
| US-9.2 | Reminder retries stop when the trip is no longer eligible | `backend/tests/reservationEmailSchedule.test.js` | `it("Reminder retries stop when the trip is no longer eligible")` |
| US-9.3 | Accepted email is recorded and not sent again | `backend/tests/reservationEmailDelivery.test.js` | `it("Accepted email is recorded and not sent again")` |
| US-9.3 | Transport failure keeps a committed reservation update | `backend/tests/reservationEmailDelivery.test.js` | `it("Transport failure keeps a committed reservation update")` |
| US-9.3 | Retry waits until its due time | `backend/tests/reservationEmailDelivery.test.js` | `it("Retry waits until its due time")` |
| US-9.3 | Three failed submissions stop automatic retries | `backend/tests/reservationEmailDelivery.test.js` | `it("Three failed submissions stop automatic retries")` |
| US-9.3 | Pending delivery survives a process restart | `backend/tests/reservationEmailDelivery.test.js` | `it("Pending delivery survives a process restart")` |
| US-9.3 | Concurrent dispatchers serialize a notification attempt | `backend/tests/reservationEmailDelivery.test.js` | `it("Concurrent dispatchers serialize a notification attempt")` |
| US-9.3 | Missing email configuration preserves pending jobs | `backend/tests/reservationEmailDelivery.test.js` | `it("Missing email configuration preserves pending jobs")` |
| US-9.3 | Email logs omit recipients bodies and secrets | `backend/tests/reservationEmailDelivery.test.js` | `it("Email logs omit recipients bodies and secrets")` |
| US-9.3 | One delivery failure does not stop other due notifications | `backend/tests/reservationEmailDelivery.test.js` | `it("One delivery failure does not stop other due notifications")` |
| US-9.3 | Backend registers its in-process email schedule | `backend/tests/reservationEmailDelivery.test.js` | `it("Backend registers its in-process email schedule")` |
| US-9.3 | Unexpected scheduled failure keeps the server available | `backend/tests/reservationEmailDelivery.test.js` | `it("Unexpected scheduled failure keeps the server available")` |
| US-9.4 | Admin triggers due emails with counts only | `backend/tests/reservationEmails.test.js` | `it("Admin triggers due emails with counts only")` |
| US-9.4 | Trigger parameters cannot override the email run | `backend/tests/reservationEmails.test.js` | `it("Trigger parameters cannot override the email run")` |
| US-9.4 | Signed-out caller cannot trigger emails | `backend/tests/reservationEmails.test.js` | `it("Signed-out caller cannot trigger emails")` |
| US-9.4 | Non-admin roles cannot trigger emails | `backend/tests/reservationEmails.test.js` | `it("Non-admin roles cannot trigger emails")` |
| US-9.4 | Fatal admin email run returns a safe error | `backend/tests/reservationEmails.test.js` | `it("Fatal admin email run returns a safe error")` |
| US-9.4 | Send now control is visible only to admin | `frontend/tests/ReservationEmails.test.js` | `it("Send now control is visible only to admin")` |
| US-9.4 | Send now shows progress and returned counts | `frontend/tests/ReservationEmails.test.js` | `it("Send now shows progress and returned counts")` |
| US-9.4 | Send now failure allows another attempt | `frontend/tests/ReservationEmails.test.js` | `it("Send now failure allows another attempt")` |

## Agent implementation request

Copy when asking Cursor to implement this feature (`@` this file):

```text
Implement Feature 9 from @features/feature-9-reservation-emails.md on branch `feature/9-reservation-emails`.

Follow layer order in @features/framework.md (models → routes → backend tests → frontend → frontend tests).
Map every Gherkin scenario in the Test Coverage Map; run `npm test` before finishing.
If API routes, payloads, schema, or product rules changed per this spec, update @features/reference/api.md, @features/reference/data-model.md, and/or @features/reference/behavior.md in the same PR to match shipped code.
Complete Definition of Done and the merge checklist in @features/framework.md.
Do not implement behavior not in this spec.
```

**Reference updates for this feature:** `api.md`, `data-model.md`, `behavior.md`.

## Definition of Done

* [ ] Backend and frontend implemented per this spec (**FR-001**–**FR-022** satisfied)
* [ ] **Success Criteria (SC-001**–**SC-007)** met
* [ ] All mapped tests pass (`npm test`)
* [ ] Test Coverage Map complete
* [ ] `features/reference/data-model.md` updated (if schema changed)
* [ ] `features/reference/api.md` updated (if API changed)
* [ ] `features/reference/behavior.md` updated (if product rules changed)

## Out of Scope

* Sign-in, role changes, account maintenance, or local passwords: [Feature 1](feature-1-user-authentication-authorization.md) and [Feature 3](feature-3-user-management.md).
* Editing area reminder text or uploading logos: [Feature 2](feature-2-area-management.md). This feature reads the saved text without adding an editor.
* Vehicle details and designatedParking maintenance: [Feature 4](feature-4-vehicle-management.md).
* Initial requests, ordinary request edits, and requestor cancellation authorization: [Feature 7](feature-7-reservation-requests.md). Cancellation email preparation uses the shared function, not a second cancellation implementation.
* Allowed status transitions, vehicle selection, and mark Returned: [Feature 8](feature-8-request-processing.md). No separate approve/deny endpoints or new statuses.
* Dedicated mail-management screens beyond the admin-only Send now control, notification-list/preview/forced-resend endpoints, manual recipient entry, HTML branding, attachments, CC/BCC, reminder opt-outs, and automatic retry beyond three failed attempts.
* Follow-up reminders on the departure day, after-trip surveys, issue-report messages, mileage/service notices, bounce tracking, inbox-placement guarantees, and exactly-once provider delivery after an ambiguous crash/transport outcome.
