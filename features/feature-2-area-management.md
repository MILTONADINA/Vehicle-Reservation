# Feature: Area Management

**Feature ID:** 2  
**Branch pattern:** `feature/2-area-management`  
**Status:** Shipped  
**Created:** 2026-10-26  
**Input:** Maintain OC areas with an area name, logo, and custom day-before-trip reminder text, while limiting area administrators’ edits to their own area.  
**Depends on:** [Feature 1 — User Authentication & Authorization](feature-1-user-authentication-authorization.md)  

---

## User Stories

### US-2.1: View areas

**As a** signed-in user  
**I want to** see all areas  
**So that** I can identify the area responsible for vehicles

**Priority:** P1  
**Independent test:** Verify every signed-in role receives every area in the same order, regardless of its assignment.  
**Acceptance scenarios:** see ### US-2.1 under Acceptance Criteria

### US-2.2: Create an area

**As a** system administrator  
**I want to** add an area with its logo and custom reminder text  
**So that** the fleet can be managed by the responsible OC area

**Priority:** P1  
**Independent test:** Create an area as admin and verify its fields, uniqueness, and disallowed roles.  
**Acceptance scenarios:** see ### US-2.2 under Acceptance Criteria

### US-2.3: Update an area

**As the** area administrator  
**I want to** maintain the details of my assigned area  
**So that** its logo and trip reminder instructions stay correct

**Priority:** P1  
**Independent test:** Update the assigned area and attempt a different area ID without changing either assignment.  
**Acceptance scenarios:** see ### US-2.3 under Acceptance Criteria

### US-2.4: Delete an unused area

**As a** system administrator  
**I want to** remove an area that has no linked records  
**So that** obsolete areas do not remain available for new work

**Priority:** P2  
**Independent test:** Delete an unused area and reject deletion of an area with an assigned user.  
**Acceptance scenarios:** see ### US-2.4 under Acceptance Criteria

## Requirements

### Functional Requirements

* **FR-001:** The feature MUST reuse Feature 1 authentication and its database role checks for every area endpoint; it MUST NOT implement another sign-in flow.
* **FR-002:** Area MUST contain areaName, areaLogo, and noticeEmail. Required values MUST be strings, trimmed, nonblank, and within the Data Model limits; areaLogo MUST be an absolute HTTPS URL. noticeEmail MUST be plain custom reminder text, not an email address, with a maximum of 5,000 characters after trimming. It supplies the area’s instructions for the day-before-trip email; Feature 9 adds the trip details and sends that email.
* **FR-003:** Area names MUST be unique ignoring case and surrounding spaces. A duplicate create or update MUST return 409 without changing data; keeping the same name on the same record MUST be allowed.
* **FR-004:** An admin MUST be able to create, list, update, and delete areas. An area_admin MUST be able to list every area but MUST only edit its own assigned area and MUST NOT create or delete areas.
* **FR-005:** Every signed-in role MUST receive the complete area list regardless of its own areaId, so reservation requestors can choose any area. Requestor and maintenance roles MUST NOT create, edit, or delete areas. Area lists MUST be sorted by areaName ascending, then id ascending; an empty result MUST be 200 with [].
* **FR-006:** Area-admin edit scope MUST come from the current database user.areaId, not URL queries, request bodies, token claims, or localStorage. A null assignment MUST allow the same complete list but no editable record.
* **FR-007:** An area-admin update outside that scope MUST return the same 404 as a missing record. Disallowed operations for other roles MUST use the Feature 1 403 response before accessing a target record.
* **FR-008:** Create MUST generate its own id and accept only the three area fields. PUT MUST be a complete replacement of those fields while preserving id. areaName case MUST be retained; noticeEmail MUST preserve its letter case, internal spaces, and line breaks after outer whitespace is trimmed. Email-address validation or lowercasing MUST NOT be applied to noticeEmail.
* **FR-009:** PUT and DELETE MUST validate positive safe-integer route IDs and return the specified 400 or 404 messages.
* **FR-010:** DELETE MUST reject a referenced area with 409 Area is in use. instead of cascading deletion or clearing assignments. Successful deletion MUST return 200 Area deleted.
* **FR-011:** This feature MUST add nullable users.areaId referencing Area without reassigning existing users. The areaId property already supplied by Feature 1 in login, /auth/me, and authenticated request context MUST now use the current stored assignment or null; this feature MUST NOT rename or remove any part of that contract.
* **FR-012:** The Areas screen MUST show the complete list and the role-specific actions stated in Screen Requirements, and MenuBar MUST link signed-in users to Areas.
* **FR-013:** Add and Edit MUST use dialogs with the documented fields, Save, and Cancel; form validation MUST block invalid submissions. Save MUST show progress, block duplicate submission, close on success, and refresh the list.
* **FR-014:** Cancel MUST send no write and MUST discard unsaved values and errors. A failed save MUST preserve the dialog values and show the API message or the specified fallback.
* **FR-015:** Deletion MUST use a Delete area confirmation dialog. Cancel MUST make no request; confirming MUST show progress and block duplicate deletion, close and refresh on success, and preserve the row and show an error on failure.
* **FR-016:** List loading MUST show progress. The empty state MUST appear only after a successful empty response; a failed load MUST display the API message or fallback without claiming the list is empty.
* **FR-017:** Database failures MUST return 500 Area request failed. without SQL details or partially saved writes.

## Assumptions

* areaLogo is an HTTPS URL rather than an uploaded image file.
* Area admins may edit their own area name, logo, and custom reminder text. Only global admins may create or delete areas.
* Only area admins have an assigned area, and each must have exactly one. Admin, requestor, and maintenance accounts have null areaId. Feature 1 supplies the areaId contract; this feature adds its nullable database relationship, and Feature 3 validates and maintains role/area combinations.
* All three Area fields are required, and area names are unique within the application.
* The team’s Notice Email field is stored as noticeEmail and means the area’s custom reminder instructions. Feature 9 combines this text with system-generated trip details and sends the reminder the day before the trip; it is not a destination email address.
* Area-admin assignments in feature tests are fixtures. Feature 3 provides the assignment UI; Feature 2 does not duplicate it.
* Later features referencing Area must retain restrictive foreign-key deletion. This feature only knows the links already introduced on dev and must not query nonexistent future tables.


## Edge Cases

* No areas yields an empty list. A legacy area-admin record without an assignment can still list all areas but cannot edit one until the admin assigns it an area.
* Case variants and whitespace do not bypass area-name uniqueness.
* A forged area selector does not widen an area admin’s edit permission; area lists are already visible to all signed-in roles.
* Deleting an assigned area does not silently orphan users.
* Failed loading does not show No areas found.; failed saving or deletion preserves the record.


## Success Criteria

* **SC-001:** Create, list, update, and delete produce exactly the documented area contract.
* **SC-002:** All role and cross-area acceptance cases enforce the specified boundaries.
* **SC-003:** No invalid field, duplicate name, or referenced-area deletion changes data.
* **SC-004:** Dialog, loading, empty, error, and role-specific navigation scenarios have matching frontend tests and a manual check.
* **SC-005:** Every scenario has an exact-name test before merge.


## Data Ownership & Isolation

| Operation | admin | area_admin | requestor / maintenance |
|-----------|-------|------------|-------------------------|
| List | All areas | All areas | All areas |
| Create | Allowed | 403 | 403 |
| Update | Any existing area | Own area only; otherwise 404 | 403 |
| Delete | Unused areas only | 403 | 403 |

Authentication and role identity are owned by [Feature 1](feature-1-user-authentication-authorization.md). This feature applies area scope only to area-admin edits; reading the area list is global for all signed-in roles. No resource belongs to a client-selected area simply because an areaId is supplied.


## Key Entities

* **Area:** an OC unit that handles a group of vehicles, identified by a name and carrying its logo and custom day-before-trip reminder text.
* **Area-admin assignment:** a relationship between an area-admin User and exactly one Area. Other user roles have no assigned area. This feature introduces the nullable database relationship; Feature 3 maintains the assignments and role/area validation.


## API Requirements

All endpoints reuse [Feature 1](feature-1-user-authentication-authorization.md) authentication. No GET-by-id endpoint is introduced.

| Method | Endpoint | Allowed role | Success |
|--------|----------|--------------|---------|
| GET | `/vehicle-t6/areas` | All signed-in roles; complete list | `200`, array of Area objects |
| POST | `/vehicle-t6/areas` | admin | `201`, new Area object |
| PUT | `/vehicle-t6/areas/:id` | admin or the assigned area_admin | `200`, updated Area object |
| DELETE | `/vehicle-t6/areas/:id` | admin | `200`, `{ "message": "Area deleted." }` |

POST/PUT body: `{ "areaName": "Athletics", "areaLogo": "https://example.org/logo.png", "noticeEmail": "Collect keys from Athletics. Return the vehicle clean with a full tank." }`.
Area object: the three fields above plus generated `id`. Request-body properties outside those fields are ignored.

noticeEmail is a plain-text reminder body. Preserve its case, internal spaces, and line breaks; trim outer whitespace only. Feature 9 reads this saved text, adds the trip details, and sends the day-before-trip reminder. Saving an area does not send an email.

| Failure | Status | Message |
|---------|--------|---------|
| No valid session | 401 | Feature 1 `Unauthorized.` |
| Disallowed operation for role | 403 | Feature 1 `Forbidden.` |
| Invalid required field, length, reminder text, or logo URL | 400 | `Invalid area data.` |
| Invalid route ID | 400 | `Area id must be a positive integer.` |
| Missing or out-of-scope area | 404 | `Area with id=<id> not found.` |
| Duplicate area name | 409 | `Area name is already in use.` |
| Referenced area | 409 | `Area is in use.` |
| Other database failure | 500 | `Area request failed.` |

Feature 1 already includes areaId in login, `/auth/me`, and the authenticated request context. This feature populates that property from users.areaId once the Area relationship exists. It introduces no assignment endpoint.


## Screen Requirements

* `/areas`, route name `areas`, heading **Areas**. MenuBar links every signed-in role to this page. Signed-out users follow Feature 1’s Login redirect.
* List columns: **Area name**, **Logo** (render areaLogo with areaName as its accessible label), **Notice email**, and permitted **Actions**. Notice email displays the saved reminder as plain text with line breaks. The page uses only server-returned records.
* Admin sees **Add area**, **Edit**, and **Delete**. An area admin sees every row but only **Edit** on its assigned row. Requestors and maintenance users see every row without write actions.
* Add/edit dialogs: **Add area** or **Edit area**; fields **Area name**, **Logo URL**, and a multiline **Notice email** text area; buttons **Save** and **Cancel**. Notice email has the help text `Your area's day-before-trip instructions. Trip details are added automatically.` and a 5,000-character limit, not an email-address input. Edit starts with the chosen row’s values. The client applies the same validity/length rules and uses `Invalid area data.` when invalid.
* A pending save shows progress and disables repeated Save. Success closes the dialog and reloads the list. Failure preserves the values and shows the API message or `Area could not be saved.`. Cancel sends no write and discards values and errors.
* **Delete area** confirmation asks `Delete this area?` and offers **Delete** and **Cancel**. Pending deletion suppresses resubmission. Failure keeps the dialog and row and shows the API message or `Area could not be deleted.`; success closes it and refreshes the list.
* The list shows progress while loading and `No areas found.` only after a successful empty result. Load failure shows the API message or `Areas could not be loaded.` and no empty-state message.


## Data Model Requirements

Add `areas`:

| Field | Type | Rule |
|-------|------|------|
| id | Integer | Auto-generated primary key |
| areaName | String(100) | Required, trimmed, unique with case-insensitive comparison |
| areaLogo | String(2048) | Required, trimmed, absolute HTTPS URL with a host |
| noticeEmail | Text | Required plain reminder text, 1–5,000 characters after outer trimming; preserve case, internal spaces, and line breaks |

Add `users.areaId`: nullable integer foreign key to areas.id, initially null for existing users. Only area-admin accounts are assigned an area; other roles remain null. Feature 3 requires one valid area when granting or editing the area_admin role. Area hasMany User and User belongsTo Area are registered in models/index.js. On-delete behavior is RESTRICT, not CASCADE or SET NULL. Feature 1 already exposes the areaId property; this feature supplies the stored relationship without altering User identity or role fields. Assignment editing is delegated to Feature 3.

## Acceptance Criteria (Gherkin)

### US-2.1 — View areas

#### Scenario: Admin lists every area in name order
* **Given** areas Athletics and Maintenance exist
* **When** an admin requests GET /vehicle-t6/areas
* **Then** both areas are returned in areaName ascending order with id as the tie-breaker

#### Scenario: Area admin lists every area
* **Given** an area_admin has areaId 2 and areas 1 and 2 exist
* **When** that user lists areas
* **Then** both areas are returned in areaName order regardless of the caller’s areaId

#### Scenario: Area admin without an assignment still lists every area
* **Given** an area_admin has null areaId and areas 1 and 2 exist
* **When** that user lists areas
* **Then** the response is 200 with both areas, without granting permission to edit either

#### Scenario: Requestor and maintenance users can read the area list
* **Given** areas exist and the signed-in role is requestor or maintenance
* **When** each role lists areas
* **Then** the response is 200 with all areas and no write permission is granted

#### Scenario: Empty area list is returned
* **Given** there are no areas
* **When** an admin lists areas
* **Then** the response is 200 with []

#### Scenario: Area API requires a session
* **Given** no valid application session is supplied
* **When** GET, POST, PUT, or DELETE is sent to the applicable area route
* **Then** each response is 401 with the Feature 1 Unauthorized. message and nothing changes

#### Scenario: Account session exposes its current area assignment
* **Given** an area_admin has a valid application session and areaId 2
* **When** the user signs in or requests /auth/me
* **Then** the Feature 1 account payload includes areaId 2 without changing its other fields
* **And** a protected request receives req.user with the current database id, role, and areaId 2 rather than a client-supplied assignment

#### Scenario: Areas page shows all records and permitted actions
* **Given** GET /areas returns every area and the user has any signed-in role
* **When** the user follows Areas in MenuBar to /areas
* **Then** every area appears with its saved reminder text and line breaks; admin sees Add area, Edit, and Delete, area_admin sees Edit only on its assigned row, and other roles see no write actions

#### Scenario: Areas navigation requires sign-in
* **Given** a signed-out visitor opens /areas
* **When** the Feature 1 route guard runs
* **Then** the visitor reaches /login and no area records appear

#### Scenario: Areas page distinguishes loading empty and failed states
* **Given** the area list is pending, then succeeds with []
* **When** the page renders each state
* **Then** progress appears while pending and No areas found. appears only after success

#### Scenario: Area list failure does not show an empty list
* **Given** GET /areas fails with an API message or no response message
* **When** the list request completes
* **Then** the page shows the message or Areas could not be loaded. and does not show No areas found.

### US-2.2 — Create an area

#### Scenario: Admin creates an area
* **Given** an admin supplies areaName Athletics, areaLogo https://example.org/logo.png, and noticeEmail Collect keys from Athletics. Return the vehicle clean with a full tank.
* **When** POST /vehicle-t6/areas is sent
* **Then** the response is 201 with generated id and saved area fields
* **And** saving the reminder text sends no email

#### Scenario: Area values are trimmed without changing their meaning
* **Given** an admin surrounds valid area fields with spaces and uses mixed-case reminder text containing internal spaces and line breaks
* **When** the area is created
* **Then** only outer whitespace is trimmed, areaName retains its letter case, and noticeEmail retains its letter case, internal spaces, and line breaks

#### Scenario: Duplicate area name is rejected
* **Given** area Athletics exists
* **When** an admin creates athletics with optional surrounding spaces
* **Then** the response is 409 with message Area name is already in use. and no extra area is stored

#### Scenario: Non-admin cannot create an area
* **Given** the signed-in user is area_admin, requestor, or maintenance
* **When** each role posts valid area data
* **Then** each response is 403 with the Feature 1 Forbidden. message and no area is created

#### Scenario: Client cannot select an area primary key
* **Given** an admin sends valid area data plus id 99 and an unrelated property
* **When** the area is created
* **Then** the server generates its own id and persists only the allowed area fields

#### Scenario: Add area opens the specified form
* **Given** an admin is on Areas
* **When** the admin selects Add area
* **Then** the Add area dialog shows Area name, Logo URL, a multiline Notice email text area limited to 5,000 characters with the specified reminder help text, Save, and Cancel

#### Scenario: Saving an area updates the list
* **Given** valid area fields are entered and POST succeeds
* **When** the admin selects Save
* **Then** the dialog shows progress while pending, suppresses duplicate saves, closes on success, and reloads the complete list

#### Scenario: Cancel leaves area records unchanged
* **Given** an add or edit area dialog contains unsaved changes
* **When** the user selects Cancel
* **Then** the dialog closes without a write request and reopening it shows the correct initial values without the previous error

#### Scenario: Area form rejects invalid fields before submitting
* **Given** a required field is missing, whitespace-only, too long, or has an invalid logo URL
* **When** the user selects Save for each invalid value
* **Then** the form shows the validation message from API Requirements and sends no write request

#### Scenario: Failed area save retains entered values
* **Given** POST or PUT fails with an API message or without one
* **When** the user submits the area dialog
* **Then** the dialog remains open with entered values and displays that message or Area could not be saved.

#### Scenario: Area areaName rejects invalid values
* **Given** an admin prepares missing, null, non-string, blank, and over-length values for areaName
* **When** POST and authorized PUT are sent for each invalid areaName
* **Then** each response is 400 with Invalid area data. and no record is created or changed

#### Scenario: Area areaLogo rejects invalid values
* **Given** an admin prepares missing, null, non-string, blank, and over-length values for areaLogo and invalid HTTPS URLs
* **When** POST and authorized PUT are sent for each invalid areaLogo
* **Then** each response is 400 with Invalid area data. and no record is created or changed

#### Scenario: Area reminder text rejects invalid values
* **Given** an admin prepares missing, null, non-string, blank, and more-than-5,000-character values for noticeEmail
* **When** POST and authorized PUT are sent for each invalid noticeEmail
* **Then** each response is 400 with Invalid area data. and no record is created or changed

### US-2.3 — Update an area


#### Scenario: Area edit scope comes from the database
* **Given** an area_admin has areaId 2 but submits query areaId 1 and client role admin
* **When** that user sends a valid PUT for its own area 2 with forged areaId 1 and client role admin fields
* **Then** only area 2 is updated and area 1 remains unchanged

#### Scenario: Admin updates any area
* **Given** an admin supplies a complete valid replacement for area 2
* **When** PUT /vehicle-t6/areas/2 is sent
* **Then** the response is 200 with the updated fields and unchanged id
* **And** saving the reminder text sends no email

#### Scenario: Area admin updates the assigned area
* **Given** an area_admin belongs to area 2
* **When** that user submits a valid PUT /vehicle-t6/areas/2
* **Then** the response is 200 and only area 2 changes

#### Scenario: Area admin cannot update another area
* **Given** an area_admin belongs to area 2 and area 1 exists
* **When** that user submits PUT /vehicle-t6/areas/1
* **Then** the response is 404 with message Area with id=1 not found. and neither area changes

#### Scenario: Area admin without an area cannot edit a record
* **Given** an area_admin has null areaId
* **When** that user submits a PUT for an existing area
* **Then** the response is 404 using the requested area id and nothing changes

#### Scenario: Read-only roles cannot update an area
* **Given** the signed-in role is requestor or maintenance
* **When** each role sends PUT with valid area data
* **Then** each response is 403 with Forbidden. and the area is unchanged

#### Scenario: Updating to a duplicate name is rejected
* **Given** Athletics and Maintenance exist
* **When** an admin renames Maintenance to athletics
* **Then** the response is 409 with Area name is already in use. and Maintenance is unchanged

#### Scenario: Unchanged area name can be saved
* **Given** area Athletics exists
* **When** an authorized editor saves its current name with changed reminder text
* **Then** the response is 200 without a false duplicate conflict

#### Scenario: Edit area shows current data and refreshes after saving
* **Given** an authorized user views a visible area
* **When** the user selects Edit and saves valid changes
* **Then** the Edit area dialog starts with that row’s values and success closes it and refreshes the list

#### Scenario: Invalid area IDs are rejected
* **Given** an admin supplies a non-integer, zero, negative, or unsafe-integer id
* **When** PUT and DELETE are sent for each invalid id
* **Then** each response is 400 with message Area id must be a positive integer. and no record changes

#### Scenario: Missing area IDs return not found
* **Given** an admin supplies a valid positive id 999 that does not exist
* **When** PUT and DELETE /vehicle-t6/areas/999 are sent
* **Then** each response is 404 with message Area with id=999 not found.

#### Scenario: Area storage failures return a safe error
* **Given** an authorized list, create, update, or delete encounters a database failure
* **When** each operation is attempted
* **Then** each response is 500 with message Area request failed. and unsuccessful writes leave existing records unchanged

### US-2.4 — Delete an unused area

#### Scenario: Admin deletes an unused area
* **Given** area 2 has no linked records
* **When** an admin sends DELETE /vehicle-t6/areas/2
* **Then** the response is 200 with message Area deleted. and that area is absent from a subsequent list

#### Scenario: Area with assigned users cannot be deleted
* **Given** an area_admin has areaId 2
* **When** an admin deletes area 2
* **Then** the response is 409 with message Area is in use. and both the user and area remain

#### Scenario: Non-admin cannot delete an area
* **Given** the signed-in role is area_admin, requestor, or maintenance
* **When** each role sends DELETE for an existing area
* **Then** each response is 403 with Forbidden. and the area remains

#### Scenario: Delete area requires confirmation
* **Given** an admin views an unused area
* **When** the admin selects Delete and then Cancel in Delete area
* **Then** no deletion request is sent

#### Scenario: Confirmed deletion refreshes the list
* **Given** the Delete area dialog is open and DELETE succeeds
* **When** the admin selects Delete
* **Then** the pending action cannot submit twice and success closes the dialog and reloads the list

#### Scenario: Failed area deletion preserves the dialog and row
* **Given** DELETE returns an API message or fails without one
* **When** the admin confirms deletion
* **Then** the row remains and the dialog displays that message or Area could not be deleted.

## Test Coverage Map

Each scenario below must have an automated test with the exact scenario title. Frontend tests mock the API and Google sign-in; backend tests mock Google verification rather than contacting Google.

| Story | Scenario | Test file | Test name |
|-------|----------|-----------|-----------|
| US-2.1 | Admin lists every area in name order | `backend/tests/areas.test.js` | `it("Admin lists every area in name order")` |
| US-2.1 | Area admin lists every area | `backend/tests/areas.test.js` | `it("Area admin lists every area")` |
| US-2.1 | Area admin without an assignment still lists every area | `backend/tests/areas.test.js` | `it("Area admin without an assignment still lists every area")` |
| US-2.1 | Requestor and maintenance users can read the area list | `backend/tests/areas.test.js` | `it("Requestor and maintenance users can read the area list")` |
| US-2.1 | Empty area list is returned | `backend/tests/areas.test.js` | `it("Empty area list is returned")` |
| US-2.1 | Area API requires a session | `backend/tests/areas.test.js` | `it("Area API requires a session")` |
| US-2.1 | Account session exposes its current area assignment | `backend/tests/areas.test.js` | `it("Account session exposes its current area assignment")` |
| US-2.1 | Areas page shows all records and permitted actions | `frontend/tests/Areas.test.js` | `it("Areas page shows all records and permitted actions")` |
| US-2.1 | Areas navigation requires sign-in | `frontend/tests/Areas.test.js` | `it("Areas navigation requires sign-in")` |
| US-2.1 | Areas page distinguishes loading empty and failed states | `frontend/tests/Areas.test.js` | `it("Areas page distinguishes loading empty and failed states")` |
| US-2.1 | Area list failure does not show an empty list | `frontend/tests/Areas.test.js` | `it("Area list failure does not show an empty list")` |
| US-2.2 | Admin creates an area | `backend/tests/areas.test.js` | `it("Admin creates an area")` |
| US-2.2 | Area values are trimmed without changing their meaning | `backend/tests/areas.test.js` | `it("Area values are trimmed without changing their meaning")` |
| US-2.2 | Duplicate area name is rejected | `backend/tests/areas.test.js` | `it("Duplicate area name is rejected")` |
| US-2.2 | Non-admin cannot create an area | `backend/tests/areas.test.js` | `it("Non-admin cannot create an area")` |
| US-2.2 | Client cannot select an area primary key | `backend/tests/areas.test.js` | `it("Client cannot select an area primary key")` |
| US-2.2 | Add area opens the specified form | `frontend/tests/Areas.test.js` | `it("Add area opens the specified form")` |
| US-2.2 | Saving an area updates the list | `frontend/tests/Areas.test.js` | `it("Saving an area updates the list")` |
| US-2.2 | Cancel leaves area records unchanged | `frontend/tests/Areas.test.js` | `it("Cancel leaves area records unchanged")` |
| US-2.2 | Area form rejects invalid fields before submitting | `frontend/tests/Areas.test.js` | `it("Area form rejects invalid fields before submitting")` |
| US-2.2 | Failed area save retains entered values | `frontend/tests/Areas.test.js` | `it("Failed area save retains entered values")` |
| US-2.2 | Area areaName rejects invalid values | `backend/tests/areas.test.js` | `it("Area areaName rejects invalid values")` |
| US-2.2 | Area areaLogo rejects invalid values | `backend/tests/areas.test.js` | `it("Area areaLogo rejects invalid values")` |
| US-2.2 | Area reminder text rejects invalid values | `backend/tests/areas.test.js` | `it("Area reminder text rejects invalid values")` |
| US-2.3 | Area edit scope comes from the database | `backend/tests/areas.test.js` | `it("Area edit scope comes from the database")` |
| US-2.3 | Admin updates any area | `backend/tests/areas.test.js` | `it("Admin updates any area")` |
| US-2.3 | Area admin updates the assigned area | `backend/tests/areas.test.js` | `it("Area admin updates the assigned area")` |
| US-2.3 | Area admin cannot update another area | `backend/tests/areas.test.js` | `it("Area admin cannot update another area")` |
| US-2.3 | Area admin without an area cannot edit a record | `backend/tests/areas.test.js` | `it("Area admin without an area cannot edit a record")` |
| US-2.3 | Read-only roles cannot update an area | `backend/tests/areas.test.js` | `it("Read-only roles cannot update an area")` |
| US-2.3 | Updating to a duplicate name is rejected | `backend/tests/areas.test.js` | `it("Updating to a duplicate name is rejected")` |
| US-2.3 | Unchanged area name can be saved | `backend/tests/areas.test.js` | `it("Unchanged area name can be saved")` |
| US-2.3 | Edit area shows current data and refreshes after saving | `frontend/tests/Areas.test.js` | `it("Edit area shows current data and refreshes after saving")` |
| US-2.3 | Invalid area IDs are rejected | `backend/tests/areas.test.js` | `it("Invalid area IDs are rejected")` |
| US-2.3 | Missing area IDs return not found | `backend/tests/areas.test.js` | `it("Missing area IDs return not found")` |
| US-2.3 | Area storage failures return a safe error | `backend/tests/areas.test.js` | `it("Area storage failures return a safe error")` |
| US-2.4 | Admin deletes an unused area | `backend/tests/areas.test.js` | `it("Admin deletes an unused area")` |
| US-2.4 | Area with assigned users cannot be deleted | `backend/tests/areas.test.js` | `it("Area with assigned users cannot be deleted")` |
| US-2.4 | Non-admin cannot delete an area | `backend/tests/areas.test.js` | `it("Non-admin cannot delete an area")` |
| US-2.4 | Delete area requires confirmation | `frontend/tests/Areas.test.js` | `it("Delete area requires confirmation")` |
| US-2.4 | Confirmed deletion refreshes the list | `frontend/tests/Areas.test.js` | `it("Confirmed deletion refreshes the list")` |
| US-2.4 | Failed area deletion preserves the dialog and row | `frontend/tests/Areas.test.js` | `it("Failed area deletion preserves the dialog and row")` |

## Agent implementation request

Copy when asking Cursor to implement this feature (`@` this file):

```text
Implement Feature 2 from @features/feature-2-area-management.md on branch `feature/2-area-management`.

Follow layer order in @features/framework.md (models → routes → backend tests → frontend → frontend tests).
Map every Gherkin scenario in the Test Coverage Map; run `npm test` before finishing.
If API routes, payloads, schema, or product rules changed per this spec, update @features/reference/api.md, @features/reference/data-model.md, and/or @features/reference/behavior.md in the same PR to match shipped code.
Complete Definition of Done and the merge checklist in @features/framework.md.
Do not implement behavior not in this spec.
```

**Reference updates for this feature:** `api.md`, `data-model.md`, `behavior.md`.

## Definition of Done

* [x] Backend and frontend implemented per this spec (**FR-001**–**FR-017** satisfied)
* [x] **Success Criteria (SC-001**–**SC-005)** met
* [x] All mapped tests pass (`npm test`)
* [x] Test Coverage Map complete
* [x] `features/reference/data-model.md` updated (if schema changed)
* [x] `features/reference/api.md` updated (if API changed)
* [x] `features/reference/behavior.md` updated (if product rules changed)


## Out of Scope

* Creating or editing user-to-area assignments: [Feature 3 — User Management](feature-3-user-management.md).
* Vehicle-to-area assignment: [Feature 4 — Vehicle Management in the catalog](README.md#feature-catalog); no vehicle endpoints or fields are specified here.
* Logo uploads and multiple-area membership.
* Composing and sending reservation emails, including appending trip details and scheduling day-before-trip reminders, belongs to [Feature 9 — Reservation Emails in the catalog](README.md#feature-catalog). Editing the area's custom reminder text is included in this feature.
