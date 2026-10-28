# Feature: User Management

**Feature ID:** 3  
**Branch pattern:** `feature/3-user-management`  
**Status:** Ready  
**Created:** 2026-10-26  
**Input:** Allow admins to manage all OC accounts and area admins to view all users and edit or delete requestor and maintenance accounts.  
**Depends on:** [Feature 1 — User Authentication & Authorization](feature-1-user-authentication-authorization.md), [Feature 2 — Area Management](feature-2-area-management.md)  

---

## User Stories

### US-3.1: View users

**As a** user administrator  
**I want to** view all user accounts  
**So that** I can identify accounts and the actions my role permits

**Priority:** P1  
**Independent test:** Verify that admin and area_admin both list every account, while requestor and maintenance are denied.  
**Acceptance scenarios:** see ### US-3.1 under Acceptance Criteria

### US-3.2: Create an OC user account

**As a** system administrator  
**I want to** provision a user with the correct role and area  
**So that** the account is ready when that person signs in through Google

**Priority:** P2  
**Independent test:** Create a pending OC account, verify its role and area, and sign in through Feature 1 without a duplicate account.  
**Acceptance scenarios:** see ### US-3.2 under Acceptance Criteria

### US-3.3: Update user details and access

**As a** user administrator  
**I want to** change permitted names, roles, and area assignments  
**So that** users retain appropriate access as responsibilities change

**Priority:** P1  
**Independent test:** Verify admin role/area changes and session revocation, and permit area-admin edits only for requestor and maintenance accounts without assigning an area.  
**Acceptance scenarios:** see ### US-3.3 under Acceptance Criteria

### US-3.4: Delete a user account

**As a** user administrator  
**I want to** remove a local account I am allowed to manage  
**So that** the local user directory stays current

**Priority:** P2  
**Independent test:** Delete an allowed target and its sessions; reject an area admin deleting a privileged target or an admin deleting their own account.  
**Acceptance scenarios:** see ### US-3.4 under Acceptance Criteria

## Requirements

### Functional Requirements

* **FR-001:** User management MUST reuse the User identity, roles, session handling, and authentication of Feature 1 and the Area relationship introduced by Feature 2. It MUST NOT introduce another authentication or area-management feature.
* **FR-002:** Global admins MUST be able to list all users and create, update, or delete permitted target accounts. User lists MUST sort by lastName, firstName, and id ascending and MUST return 200 [] for an empty result.
* **FR-003:** Area admins MUST be able to list every user, regardless of any area assignment. They MUST be able to edit or delete requestor and maintenance accounts without an area-based filter.
* **FR-004:** Only the global admin MUST be permitted to create accounts through POST /users. Area admins MUST NOT create accounts, grant admin or area_admin roles, or edit/delete existing admin or area_admin accounts.
* **FR-005:** Requestor and maintenance roles MUST receive the Feature 1 403 response for every user-management endpoint. Signed-out requests MUST receive its 401 response.
* **FR-006:** Management permissions MUST use the caller’s current database role and the target’s current role. Client-supplied role, user identity, or area fields MUST NOT expand those permissions.
* **FR-007:** Public user records MUST contain only id, email, firstName, lastName, role, and areaId. Responses MUST NOT expose Google subjects, tokens, session rows, OAuth credentials, or passwords.
* **FR-008:** POST MUST provision a pending user from email, firstName, lastName, role, and areaId. googleSub MUST remain null until Feature 1 verifies the matching Google identity; ids and authentication fields in a body MUST be ignored.
* **FR-009:** Provisioned email MUST be trimmed, lowercase, unique, valid, and in the approved OC email domains from Feature 1. Duplicate email MUST return 409. Google sign-in MUST retain the pending account’s id, assigned role, and area.
* **FR-010:** Names MUST be trimmed, nonblank strings within the Feature 1 column limits. Role MUST be a supported Feature 1 role. Invalid management data MUST return 400 without saving.
* **FR-011:** An area_admin account MUST have an areaId identifying exactly one existing Area. Admin, requestor, and maintenance accounts MUST have null areaId. Invalid identifiers or role/area combinations MUST return 400; a valid positive areaId for an area_admin that does not exist MUST return 404.
* **FR-012:** Area-admin edits MUST retain a null areaId and restrict the target role to requestor or maintenance. A requested privileged role MUST return 403 before assignment validation; a non-null areaId for an ordinary target MUST return 400.
* **FR-013:** PUT MUST replace the editable names, role, and area assignment while preserving id, email, and googleSub. Other properties MUST be ignored.
* **FR-014:** An admin MUST NOT remove their own global-admin role or delete their own account. Such requests MUST return 409 without changes. An admin MAY correct their own names. Attempting to assign an area while retaining the admin role MUST follow FR-011 and return 400, including for the caller’s own account.
* **FR-015:** Changing a target role or area MUST revoke all target sessions in the same transaction. Name-only updates MUST keep sessions valid. Authentication after revocation MUST remain Feature 1 behavior.
* **FR-016:** DELETE MUST remove an authorized target and its sessions atomically and return 200 User deleted. This feature MUST NOT add or query future business-reference tables.
* **FR-017:** PUT and DELETE MUST reject IDs that are not positive safe integers with the specified 400 and missing users with the specified 404.
* **FR-018:** The Users page and MenuBar link MUST be available only to admin and area_admin. Signed-out visitors MUST follow Feature 1 Login navigation; other signed-in roles MUST return Home.
* **FR-019:** The Users screen MUST show every public user record to both manager roles and only their permitted actions. Area names and options MUST come from Feature 2; unavailable area data MUST show an error and block visible Add/Edit controls until a successful page reload.
* **FR-020:** Add/Edit MUST use the specified dialogs, prefilled edit values, role-filtered controls, Save, and Cancel. Validation MUST block invalid requests; pending writes MUST suppress duplicates, and successful writes MUST close and reload the user list.
* **FR-021:** Cancel MUST discard unsaved values and form errors without sending a write. Failed saves MUST retain values and display the API message or fallback.
* **FR-022:** Delete MUST use a confirmation with Delete and Cancel, suppress duplicate pending requests, refresh on success, and preserve the account/dialog on failure.
* **FR-023:** Loading MUST show progress; No users found. MUST appear only after a successful empty response. Failed loads MUST display the API message or fallback without an empty-state claim.
* **FR-024:** Database or session-write failures MUST return 500 User request failed. without leaking database details; failed transactions MUST leave original users and sessions intact.

## Assumptions

* Only global admins may provision accounts and grant privileged roles. Area admins see all users and may edit/delete only requestor and maintenance accounts, regardless of the caller’s area.
* Only area_admin users have an assigned area, and exactly one is required. Admin, requestor, and maintenance users have no assigned area. A requestor chooses a reservation’s area in Feature 7; that choice does not become a user-account assignment.
* Local email is immutable after provisioning. Google identity migration and account merging are outside this feature.
* Deleting a user removes the local account; it does not permanently bar Google sign-in. Under Feature 1’s account-creation rule, that identity can later return as a new requestor without recovering any previous role or assignment.
* User profile names maintained here are not overwritten on subsequent Feature 1 sign-in. Linking a pending account uses Feature 1, not a second linking endpoint.
* Features 1–3 introduce no business table referencing users apart from sessions, which are deleted with their user. The first later feature that adds such a reference must specify and test its own deletion policy; do not add placeholder tables here.


## Edge Cases

* Both manager roles can find newly signed-in requestors with null areaId. An area admin’s own area does not filter user-management access.
* Email case and surrounding spaces cannot bypass uniqueness.
* Role and area changes take effect immediately by revoking sessions; a forged token claim cannot preserve old permissions.
* Failed deletion or access updates leave the user and existing sessions intact.
* Unavailable area options block editing without falsely showing an empty user directory.


## Success Criteria

* **SC-001:** Both manager roles see all users, and each sees only the actions allowed by Data Ownership & Isolation.
* **SC-002:** All create, update, delete, validation, and conflict scenarios match their documented status and public fields.
* **SC-003:** No area admin can create accounts, grant privileged roles, or change admin and area_admin accounts.
* **SC-004:** Privilege changes revoke the target sessions atomically and name-only changes do not.
* **SC-005:** All screen scenarios have exact-name frontend tests and a manual check before completion.


## Data Ownership & Isolation

| Operation | admin | area_admin | requestor / maintenance |
|-----------|-------|------------|-------------------------|
| List | All users | All users | 403 |
| Create | Any supported role with valid area combination | 403 | 403 |
| Update | Any account, except own role cannot change | Existing requestor/maintenance only; target role stays ordinary and areaId stays null | 403 |
| Delete | Other accounts; never self | Requestor/maintenance accounts only | 403 |

Use the id, role, and areaId context from [Feature 1](feature-1-user-authentication-authorization.md), with the area relationship introduced by [Feature 2](feature-2-area-management.md). User management does not filter records by area. Only the global admin assigns areas to area-admin users and grants privileged roles; an area admin’s own assignment grants no authority over privileged user accounts. Missing target IDs return 404; existing privileged targets return 403 to an area admin.

## Key Entities

* **User:** the existing Google-backed account from Feature 1; this feature adds its management operations, not a second user entity.
* **Area:** the existing unit from Feature 2. User management selects existing Areas and never creates them.
* **Session:** the existing application session; management revokes it on access changes or removes it with a deleted User.


## API Requirements

Every endpoint uses [Feature 1](feature-1-user-authentication-authorization.md) authentication and the ownership table above. There is no GET-by-id or password endpoint.

| Method | Endpoint | Success |
|--------|----------|---------|
| GET | `/vehicle-t6/users` | `200`, array of all public user records |
| POST | `/vehicle-t6/users` | `201`, public record of pending account |
| PUT | `/vehicle-t6/users/:id` | `200`, updated public record |
| DELETE | `/vehicle-t6/users/:id` | `200`, `{ "message": "User deleted." }` |

POST example: `{ "email": "person@oc.edu", "firstName": "Avery", "lastName": "Reed", "role": "requestor", "areaId": null }`.
PUT example: `{ "firstName": "Avery", "lastName": "Reed", "role": "maintenance", "areaId": null }`.
Public record: `{ "id": 7, "email": "person@oc.edu", "firstName": "Avery", "lastName": "Reed", "role": "requestor", "areaId": null }`.
POST is admin-only. Admin POST/PUT must explicitly send areaId: a valid area ID for area_admin, or null for every other role. Area-admin PUT must target a current requestor/maintenance user, keep the role requestor/maintenance, and explicitly send areaId null. POST/PUT ignore properties outside their respective allowed fields.

| Failure | Status | Message |
|---------|--------|---------|
| No session or disallowed role | 401 / 403 | Feature 1 `Unauthorized.` / `Forbidden.` |
| Invalid fields, role, or role/area combination | 400 | `Invalid user data.` |
| Invalid user route ID | 400 | `User id must be a positive integer.` |
| Missing user | 404 | `User with id=<id> not found.` |
| Nonexistent assigned area | 404 | Feature 2 `Area with id=<id> not found.` |
| Duplicate email | 409 | `Email is already in use.` |
| Own admin role change or own admin deletion | 409 | `You cannot remove your own admin access.` |
| Other storage or session-write failure | 500 | `User request failed.` |

Validate authentication and endpoint role first. For record operations validate the route ID and load the target. If an area admin targets an existing admin or area_admin, return 403; if the user does not exist, return 404. Return 403 for area-admin attempts to grant a privileged role before validating areaId. Check admin self-demotion and self-deletion before ordinary field validation and return 409. Assigning a non-null area while retaining role admin returns 400 even when editing oneself. Unknown role names or non-null area assignments for ordinary roles return 400. Area assignments are resolved through Feature 2, not a new lookup route.


## Screen Requirements

* `/users`, route name `users`, heading **Users**; MenuBar link for admin and area_admin only. Feature 1 handles signed-out navigation; other signed-in roles return Home.
* Columns: **Email**, **First name**, **Last name**, **Role**, **Area**, **Actions**. Area uses the existing areaName; a null assignment displays `Unassigned`.
* An admin sees **Add user**, **Edit**, and **Delete** except Delete on their own account. Their own role control is locked. The Area control follows the role-based rule below for all accounts. An area admin sees every account, has no Add user control, and sees Edit/Delete only on requestor/maintenance rows. All admin/area_admin rows, including their own, are read-only to them.
* Both manager roles load Feature 2’s complete GET `/areas` list to display area names. Only the admin has an editable Area selector. If the area request fails, keep successfully loaded users visible, show its API message or `Area options could not be loaded.`, and disable visible Add/Edit controls until reloading succeeds.
* **Add user** dialog: **Email**, **First name**, **Last name**, **Role**, **Area**, **Save**, **Cancel**. **Edit user** shows the existing Email read-only and prefills the other values. Admin selects any supported role and area; the form enforces null area for admin and a required area for area_admin. Admin, requestor, and maintenance require Unassigned. The Area selector is enabled and required only when the admin selects area_admin. An area admin’s Edit dialog offers only requestor/maintenance and displays Area as read-only Unassigned.
* Invalid management input displays `Invalid user data.` and sends no write. Save shows progress and suppresses duplicates. Success closes the dialog and reloads users; failure keeps values and displays the API message or `User could not be saved.`. Cancel discards edits and errors.
* **Delete user** asks `Delete this user?`, with **Delete** and **Cancel**. Cancel sends no DELETE. Pending deletion suppresses duplicates; success closes the dialog and reloads; failure retains dialog and row with the API message or `User could not be deleted.`.
* Show progress while loading and `No users found.` only on a successful empty user response. Failed load shows the API message or `Users could not be loaded.` without claiming no users exist.


## Data Model Requirements

No new table or identity columns. Reuse the User and Session schema of [Feature 1](feature-1-user-authentication-authorization.md) and users.areaId / Area foreign key from [Feature 2](feature-2-area-management.md).

* `email`, `firstName`, and `lastName` use Feature 1’s column limits. Management writes require nonblank first/last names even though Google sign-in can initially provide empty names.
* `role` uses Feature 1’s enum. A newly auto-created requestor has null areaId and remains unassigned while its role is requestor. Only an admin changing its role to area_admin may assign it an area.
* A pending managed account has null googleSub. Only Feature 1 can attach a verified subject.
* Preserve the unique email constraint for concurrent Google sign-in and provisioning. A conflict must return the duplicate-email response rather than leave duplicate records.
* Update access and revoke affected sessions in one transaction. Delete an authorized User and its Sessions in one transaction. Deletion restrictions involving future business records are not implemented or tested in this feature.

## Acceptance Criteria (Gherkin)

### US-3.1 — View users

#### Scenario: Admin lists all users
* **Given** users from multiple areas and an unassigned user exist
* **When** an admin requests GET /vehicle-t6/users
* **Then** all users are returned sorted by lastName, firstName, and id, with only the public user fields

#### Scenario: Area admin lists all users
* **Given** an area_admin belongs to area 2, other area admins belong to areas 1 and 2, and ordinary users have null areaId
* **When** that user lists users
* **Then** all users are returned, including admins, other area admins, requestors, and maintenance accounts

#### Scenario: Requestor and maintenance cannot manage users
* **Given** a signed-in user has role requestor or maintenance
* **When** GET, POST, PUT, and DELETE are sent to the applicable users route
* **Then** each response is 403 using Feature 1 Forbidden. and no write occurs

#### Scenario: User endpoints require authentication
* **Given** no valid application session is supplied
* **When** GET, POST, PUT, and DELETE are sent to the applicable users route
* **Then** each response is 401 using Feature 1 Unauthorized. and no write occurs

#### Scenario: User records omit authentication secrets
* **Given** linked Google users with sessions exist
* **When** an authorized manager lists, creates, or updates a user
* **Then** only id, email, firstName, lastName, role, and areaId are returned, without googleSub or any session token

#### Scenario: Users page shows all records and permitted actions
* **Given** an admin or area_admin opens /users
* **When** the user list and any required admin area options load successfully
* **Then** all records and the Users heading and Email, First name, Last name, Role, Area, Actions columns appear; admin has Add/Edit/Delete except self-delete, and area_admin has only Edit/Delete on ordinary users

#### Scenario: User management navigation respects role boundaries
* **Given** a signed-out visitor, requestor, or maintenance user attempts /users
* **When** the route guard evaluates the current Feature 1 account
* **Then** the visitor reaches Login and the signed-in disallowed roles reach Home; their menu has no Users link

#### Scenario: Users page distinguishes loading and empty results
* **Given** the user list is pending and then returns []
* **When** the page renders each state
* **Then** progress appears while loading and No users found. appears only after success

#### Scenario: User list failure shows an error without an empty message
* **Given** GET /users fails with an API message or without one
* **When** the request completes
* **Then** the page displays the message or Users could not be loaded. and does not show No users found.

#### Scenario: Unavailable area options block user writes
* **Given** an admin or area_admin loads users successfully but Feature 2 area data fails to load
* **When** the Users page renders
* **Then** the page displays the area API message or Area options could not be loaded. and disables visible Add/Edit controls until a successful reload

### US-3.2 — Create an OC user account

#### Scenario: Admin provisions a user
* **Given** an admin supplies valid OC email, firstName, lastName, role, and permitted areaId
* **When** POST /vehicle-t6/users is sent
* **Then** the response is 201 with the public user record and googleSub remains null

#### Scenario: Provisioned user signs in without losing assigned permissions
* **Given** a pending local user has a configured role and areaId
* **When** the same verified OC Google identity signs in using Feature 1
* **Then** the existing userId, role, and areaId are retained and no second account is created

#### Scenario: Area admin cannot create a user
* **Given** an area_admin supplies valid requestor or maintenance account data with null areaId
* **When** POST /vehicle-t6/users is sent both with ordinary client data and with a forged caller role admin and different caller userId
* **Then** both responses are 403 with Forbidden. and no account is created

#### Scenario: Duplicate OC email is rejected
* **Given** user person@oc.edu already exists
* **When** an admin creates PERSON@OC.EDU with surrounding spaces
* **Then** the response is 409 with message Email is already in use. and the original account is unchanged

#### Scenario: User values are normalized
* **Given** an admin supplies valid names and email with surrounding spaces
* **When** a user is created
* **Then** names are trimmed with letter case retained and email is trimmed and lowercase

#### Scenario: Create cannot link an unverified Google identity
* **Given** an admin supplies valid user fields plus googleSub, id, token, or password properties
* **When** the account is created
* **Then** the server generates id, keeps googleSub null, and stores no submitted credential or password

#### Scenario: Add user form offers permitted roles and areas
* **Given** an admin selects Add user
* **When** the dialog opens
* **Then** Email, First name, Last name, Role, and Area fields appear; all four roles are offered, and Area is selectable and required only for area_admin

#### Scenario: Create user success refreshes the list
* **Given** the user dialog is valid and POST succeeds
* **When** the manager selects Save
* **Then** progress appears, duplicate Save is blocked, the dialog closes, and the user list reloads

#### Scenario: Invalid user form does not submit
* **Given** a user-management form has invalid required names, email, role, or area data
* **When** the manager selects Save for each invalid input
* **Then** Invalid user data. is displayed and no write request is sent

#### Scenario: Cancel user form discards changes and errors
* **Given** an add or edit dialog has unsaved values or an error
* **When** the manager selects Cancel and later reopens the dialog
* **Then** no write was sent and the reopened dialog has correct initial values without the old error

#### Scenario: User save failure preserves form data
* **Given** POST or PUT fails with an API message or without one
* **When** the manager saves the dialog
* **Then** the dialog remains open with entered values and displays the message or User could not be saved.

#### Scenario: User firstName rejects invalid values
* **Given** a manager supplies missing, null, non-string, blank, or over-length firstName
* **When** POST and authorized PUT are sent for each invalid firstName
* **Then** each response is 400 with Invalid user data. and no account is created or changed

#### Scenario: User lastName rejects invalid values
* **Given** a manager supplies missing, null, non-string, blank, or over-length lastName
* **When** POST and authorized PUT are sent for each invalid lastName
* **Then** each response is 400 with Invalid user data. and no account is created or changed

#### Scenario: Invalid provisioned email is rejected
* **Given** the email is missing, blank, non-string, malformed, too long, or outside the Feature 1 OC domains
* **When** an admin creates a user for each invalid input
* **Then** each response is 400 with Invalid user data. and no user is created

#### Scenario: Invalid or omitted role is rejected
* **Given** a requested role is absent or outside the Feature 1 role enum
* **When** POST and PUT are sent with each invalid role
* **Then** each response is 400 with Invalid user data. and no user changes

#### Scenario: Role and area must be consistent
* **Given** an admin assigns area_admin without an area, any other role with a non-null area, or an area ID that is not a positive safe integer
* **When** a user is created or updated for each mismatch
* **Then** each response is 400 with Invalid user data. and nothing changes
* **And** assigning a non-null area to the caller’s own account while keeping role admin also returns 400 rather than 409

#### Scenario: Missing assigned area is rejected
* **Given** an admin assigns role area_admin with a positive areaId 999 that does not exist
* **When** a user is created or updated
* **Then** the response is 404 with Area with id=999 not found. and nothing changes

### US-3.3 — Update user details and access

#### Scenario: Admin updates user details
* **Given** an admin selects another user and valid complete firstName, lastName, role, areaId values
* **When** PUT /vehicle-t6/users/:id is sent
* **Then** the response is 200 with the updated public record while id, email, and googleSub stay unchanged

#### Scenario: Area admin updates an ordinary user without area filtering
* **Given** an area_admin belongs to area 2 and the target requestor or maintenance account has null areaId
* **When** the area admin updates its names or switches it between requestor and maintenance while keeping areaId null
* **Then** the response is 200 and only the target account changes

#### Scenario: Area admin cannot modify a privileged account
* **Given** an area_admin targets their own account, another area_admin in any area, or a global admin
* **When** the area admin updates or deletes that privileged account
* **Then** the response is 403 with Forbidden. and the target remains unchanged

#### Scenario: Admin cannot remove its own administration access
* **Given** an admin targets its own id
* **When** a PUT changes its role or a DELETE targets that account
* **Then** the response is 409 with You cannot remove your own admin access. and nothing changes

#### Scenario: Admin can correct its own names
* **Given** an admin retains its current role and null area
* **When** the admin updates only its own names through a complete PUT
* **Then** the response is 200 and its session remains usable

#### Scenario: Role or area changes revoke target sessions
* **Given** a target user has valid Feature 1 sessions
* **When** an authorized update changes that user role or area
* **Then** the public record is returned and all target sessions are deleted atomically
* **And** an old token now receives the Feature 1 401 response and subsequent Google sign-in uses the new access values

#### Scenario: Name-only changes keep target sessions
* **Given** a target user has valid sessions
* **When** an authorized update changes names while keeping role and area
* **Then** the update succeeds and the sessions remain valid

#### Scenario: Email and Google identity cannot be changed by user editing
* **Given** a manager sends valid update fields with changed email and googleSub extras
* **When** the target is updated
* **Then** id, email, and googleSub are unchanged and only allowed update fields are saved

#### Scenario: Edit user form preserves immutable identity
* **Given** a manager selects Edit on a manageable user
* **When** the Edit user dialog opens
* **Then** the current names, role, and area are prefilled while email is displayed read-only and the permitted role and area options match the caller

#### Scenario: User update refreshes the list
* **Given** an authorized manager submits valid changes and PUT succeeds
* **When** the save completes
* **Then** the dialog closes and the user list reloads with the saved user values

#### Scenario: Invalid user IDs are rejected
* **Given** a manager supplies a non-integer, zero, negative, or unsafe-integer id
* **When** PUT and DELETE are sent for each invalid id
* **Then** each response is 400 with User id must be a positive integer. and nothing changes

#### Scenario: Missing user IDs return not found
* **Given** an admin supplies user id 999 that does not exist
* **When** PUT and DELETE /vehicle-t6/users/999 are sent
* **Then** each response is 404 with User with id=999 not found.

#### Scenario: User storage failures do not partially change access
* **Given** an authorized list or write encounters a database or session-deletion failure
* **When** the operation is attempted
* **Then** the response is 500 with User request failed. and failed writes preserve user data and existing sessions

#### Scenario: Area admin cannot assign a privileged role
* **Given** an area_admin tries to give an existing requestor or maintenance account role admin or area_admin
* **When** PUT /vehicle-t6/users/:id is sent
* **Then** the response is 403 with Forbidden. and the target’s role and sessions remain unchanged

#### Scenario: Area admin cannot assign an area to an ordinary account
* **Given** an area_admin edits a requestor or maintenance account and supplies a non-null areaId
* **When** PUT /vehicle-t6/users/:id is sent
* **Then** the response is 400 with Invalid user data. and the account remains unassigned


### US-3.4 — Delete a user account

#### Scenario: Admin deletes another user
* **Given** the target is an existing account other than the caller
* **When** an admin sends DELETE /vehicle-t6/users/:id
* **Then** the response is 200 with User deleted. and the user and its sessions are removed atomically

#### Scenario: Area admin deletes an ordinary user without area filtering
* **Given** an area_admin belongs to area 2 and the target requestor or maintenance account has null areaId
* **When** that area admin deletes the account
* **Then** the response is 200 with User deleted. and unrelated users remain

#### Scenario: User deletion requires confirmation
* **Given** a manager selects Delete on a manageable user
* **When** Cancel is chosen in Delete user
* **Then** the dialog closes without a DELETE request

#### Scenario: Successful user deletion refreshes the list
* **Given** the Delete user dialog is open and DELETE succeeds
* **When** the manager chooses Delete
* **Then** progress blocks duplicate submission, the dialog closes, and the user disappears after the list reloads

#### Scenario: Failed user deletion preserves the account
* **Given** DELETE fails with an API message or without one
* **When** the manager confirms deletion
* **Then** the row and dialog remain and display that message or User could not be deleted.

## Test Coverage Map

Each scenario below must have an automated test with the exact scenario title. Frontend tests mock the API and Google sign-in; backend tests mock Google verification rather than contacting Google.

| Story | Scenario | Test file | Test name |
|-------|----------|-----------|-----------|
| US-3.1 | Admin lists all users | `backend/tests/users.test.js` | `it("Admin lists all users")` |
| US-3.1 | Area admin lists all users | `backend/tests/users.test.js` | `it("Area admin lists all users")` |
| US-3.1 | Requestor and maintenance cannot manage users | `backend/tests/users.test.js` | `it("Requestor and maintenance cannot manage users")` |
| US-3.1 | User endpoints require authentication | `backend/tests/users.test.js` | `it("User endpoints require authentication")` |
| US-3.1 | User records omit authentication secrets | `backend/tests/users.test.js` | `it("User records omit authentication secrets")` |
| US-3.1 | Users page shows all records and permitted actions | `frontend/tests/Users.test.js` | `it("Users page shows all records and permitted actions")` |
| US-3.1 | User management navigation respects role boundaries | `frontend/tests/Users.test.js` | `it("User management navigation respects role boundaries")` |
| US-3.1 | Users page distinguishes loading and empty results | `frontend/tests/Users.test.js` | `it("Users page distinguishes loading and empty results")` |
| US-3.1 | User list failure shows an error without an empty message | `frontend/tests/Users.test.js` | `it("User list failure shows an error without an empty message")` |
| US-3.1 | Unavailable area options block user writes | `frontend/tests/Users.test.js` | `it("Unavailable area options block user writes")` |
| US-3.2 | Admin provisions a user | `backend/tests/users.test.js` | `it("Admin provisions a user")` |
| US-3.2 | Provisioned user signs in without losing assigned permissions | `backend/tests/users.test.js` | `it("Provisioned user signs in without losing assigned permissions")` |
| US-3.2 | Area admin cannot create a user | `backend/tests/users.test.js` | `it("Area admin cannot create a user")` |
| US-3.2 | Duplicate OC email is rejected | `backend/tests/users.test.js` | `it("Duplicate OC email is rejected")` |
| US-3.2 | User values are normalized | `backend/tests/users.test.js` | `it("User values are normalized")` |
| US-3.2 | Create cannot link an unverified Google identity | `backend/tests/users.test.js` | `it("Create cannot link an unverified Google identity")` |
| US-3.2 | Add user form offers permitted roles and areas | `frontend/tests/Users.test.js` | `it("Add user form offers permitted roles and areas")` |
| US-3.2 | Create user success refreshes the list | `frontend/tests/Users.test.js` | `it("Create user success refreshes the list")` |
| US-3.2 | Invalid user form does not submit | `frontend/tests/Users.test.js` | `it("Invalid user form does not submit")` |
| US-3.2 | Cancel user form discards changes and errors | `frontend/tests/Users.test.js` | `it("Cancel user form discards changes and errors")` |
| US-3.2 | User save failure preserves form data | `frontend/tests/Users.test.js` | `it("User save failure preserves form data")` |
| US-3.2 | User firstName rejects invalid values | `backend/tests/users.test.js` | `it("User firstName rejects invalid values")` |
| US-3.2 | User lastName rejects invalid values | `backend/tests/users.test.js` | `it("User lastName rejects invalid values")` |
| US-3.2 | Invalid provisioned email is rejected | `backend/tests/users.test.js` | `it("Invalid provisioned email is rejected")` |
| US-3.2 | Invalid or omitted role is rejected | `backend/tests/users.test.js` | `it("Invalid or omitted role is rejected")` |
| US-3.2 | Role and area must be consistent | `backend/tests/users.test.js` | `it("Role and area must be consistent")` |
| US-3.2 | Missing assigned area is rejected | `backend/tests/users.test.js` | `it("Missing assigned area is rejected")` |
| US-3.3 | Admin updates user details | `backend/tests/users.test.js` | `it("Admin updates user details")` |
| US-3.3 | Area admin updates an ordinary user without area filtering | `backend/tests/users.test.js` | `it("Area admin updates an ordinary user without area filtering")` |
| US-3.3 | Area admin cannot modify a privileged account | `backend/tests/users.test.js` | `it("Area admin cannot modify a privileged account")` |
| US-3.3 | Admin cannot remove its own administration access | `backend/tests/users.test.js` | `it("Admin cannot remove its own administration access")` |
| US-3.3 | Admin can correct its own names | `backend/tests/users.test.js` | `it("Admin can correct its own names")` |
| US-3.3 | Role or area changes revoke target sessions | `backend/tests/users.test.js` | `it("Role or area changes revoke target sessions")` |
| US-3.3 | Name-only changes keep target sessions | `backend/tests/users.test.js` | `it("Name-only changes keep target sessions")` |
| US-3.3 | Email and Google identity cannot be changed by user editing | `backend/tests/users.test.js` | `it("Email and Google identity cannot be changed by user editing")` |
| US-3.3 | Edit user form preserves immutable identity | `frontend/tests/Users.test.js` | `it("Edit user form preserves immutable identity")` |
| US-3.3 | User update refreshes the list | `frontend/tests/Users.test.js` | `it("User update refreshes the list")` |
| US-3.3 | Invalid user IDs are rejected | `backend/tests/users.test.js` | `it("Invalid user IDs are rejected")` |
| US-3.3 | Missing user IDs return not found | `backend/tests/users.test.js` | `it("Missing user IDs return not found")` |
| US-3.3 | User storage failures do not partially change access | `backend/tests/users.test.js` | `it("User storage failures do not partially change access")` |
| US-3.3 | Area admin cannot assign a privileged role | `backend/tests/users.test.js` | `it("Area admin cannot assign a privileged role")` |
| US-3.3 | Area admin cannot assign an area to an ordinary account | `backend/tests/users.test.js` | `it("Area admin cannot assign an area to an ordinary account")` |
| US-3.4 | Admin deletes another user | `backend/tests/users.test.js` | `it("Admin deletes another user")` |
| US-3.4 | Area admin deletes an ordinary user without area filtering | `backend/tests/users.test.js` | `it("Area admin deletes an ordinary user without area filtering")` |
| US-3.4 | User deletion requires confirmation | `frontend/tests/Users.test.js` | `it("User deletion requires confirmation")` |
| US-3.4 | Successful user deletion refreshes the list | `frontend/tests/Users.test.js` | `it("Successful user deletion refreshes the list")` |
| US-3.4 | Failed user deletion preserves the account | `frontend/tests/Users.test.js` | `it("Failed user deletion preserves the account")` |

## Agent implementation request

Copy when asking Cursor to implement this feature (`@` this file):

```text
Implement Feature 3 from @features/feature-3-user-management.md on branch `feature/3-user-management`.

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


## Out of Scope

* Google verification, sign-in, session lifetime, and logout are owned by [Feature 1](feature-1-user-authentication-authorization.md); no duplicate auth implementation.
* Creating/editing Area records is owned by [Feature 2](feature-2-area-management.md); this feature only assigns an existing area to an area-admin account.
* Password management, Google email migration, permanent account bans, multiple roles per user, multiple-area memberships, bulk imports, and audit-log screens.
* Driver approval and driver licence fields belong to [Feature 5 — Driver Management in the catalog](README.md#feature-catalog). A User is not automatically an approved Driver.
* Reservation area selection belongs to [Feature 7 — Reservation Requests in the catalog](README.md#feature-catalog); it does not assign an area to the requestor’s account. The first feature introducing business records linked to users must specify and test any new deletion restriction, without adding placeholder tables here.
* Vehicle, reservation, email, issue-report, schedule, mileage, and service workflows remain with their owners in the [feature catalog](README.md#feature-catalog).
