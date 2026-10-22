# Feature: User Profile Management

**Feature ID:** 4
**Branch pattern:** `feature/4-user-profile-management`
**Status:** Ready
**Created:** 2026-03-01
**Input:** Signed-in users view and edit their profile from a menu-bar dropdown; logout moves to profile menu
**Depends on:** [Feature 1 — User Authentication](feature-1-user-auth.md), [Feature 2 — Todo List Management](feature-2-todo-list-management.md), [Feature 3 — Todo List Item Management](feature-3-todo-list-item-management.md)

---

## User Stories

### US-4.1: View profile from the menu bar
**As a** signed-in user  
**I want to** open a profile dropdown from a user icon on the menu bar  
**So that** I can see my name, username, and email at a glance

**Priority:** P1  
**Independent test:** Open profile dropdown; name, username, and email are visible  
**Acceptance scenarios:** see ### US-4.1 under Acceptance Criteria

### US-4.2: Edit profile
**As a** signed-in user  
**I want to** edit my profile  
**So that** I can change my name, username, email, and password

**Priority:** P1  
**Independent test:** Save valid profile changes; API and `localStorage` reflect updates  
**Acceptance scenarios:** see ### US-4.2 under Acceptance Criteria

### US-4.3: Log out from profile
**As a** signed-in user  
**I want to** see a **Log out** action in the profile dropdown  
**So that** I can end my session

**Priority:** P2  
**Independent test:** Log out from dropdown clears session and redirects to login  
**Acceptance scenarios:** see ### US-4.3 under Acceptance Criteria

### US-4.4: Single logout entry point
**As a** signed-in user  
**I want** the menu bar **Sign out** button removed  
**So that** logout lives in one consistent place (the profile dropdown)

**Priority:** P2  
**Independent test:** Menu bar has no standalone **Sign out** button  
**Acceptance scenarios:** see ### US-4.4 under Acceptance Criteria

---

## Requirements

### Functional Requirements

- **FR-001**: All profile endpoints MUST require a valid session (`authenticate` middleware).
- **FR-002**: A user MAY read and update only their own profile row (`id` MUST match `req.user.id`).
- **FR-003**: Cross-user profile access MUST return `404` — never `403`.
- **FR-004**: Profile fields MUST be trimmed before save; empty required strings MUST be rejected.
- **FR-005**: Password updates MUST be optional on `PUT`; when provided, enforce minimum 8 characters and bcrypt hash before save.
- **FR-006**: Username MUST be normalized on save: `trim().toLowerCase()`.
- **FR-007**: Responses MUST never include the password hash.
- **FR-008**: After successful profile update, the frontend MUST refresh `localStorage` key `user` and dispatch `user-logged-in` so `MenuBar` reflects the new display name.
- **FR-009**: Edit Profile MUST use shared `emailRules` from `frontend/src/config/validation.js` (same as registration).
- **FR-010**: Dashboard list and todo behavior MUST remain unchanged (Features 2–3).

---

## Assumptions

- Features 1–3 MUST be merged to `dev` before implementing this feature.
- No new database tables — profile uses existing `users` from Feature 1.
- Role is read-only; no admin user management.

## Edge Cases

- Fetch or update another user's profile → `404`.
- Duplicate username or email on update → `400`.
- Optional password omitted on update → existing password unchanged.
- Invalid email format or short password → client block and/or `400`.
- Unauthenticated profile API → `401`.

## Success Criteria

- **SC-001**: Every Gherkin scenario has at least one automated test before merge.
- **SC-002**: User can view profile, edit fields, and log out from the profile dropdown only.
- **SC-003**: `npm test` passes for `users.test.js` and `MenuBar.test.js`.

---

## Data Ownership & Isolation

Each user manages their own profile exclusively.

| Rule | Requirement |
|------|-------------|
| **Read scope** | `GET /todo/users/:id` succeeds only when `:id = req.user.id`. |
| **Write scope** | `PUT /todo/users/:id` applies only when `:id = req.user.id`. |
| **Cross-user access** | If `:id` belongs to another user, respond with `404` — do not confirm the user exists. |
| **Implementation** | Use a shared helper (e.g. `getAccessibleUserOrNull(req, userId)`) in `app/authorization/` — do not duplicate scope logic in controllers. |

---

## API Requirements

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `GET` | `/todo/users/:id` | Yes | Fetch the authenticated user's profile |
| `PUT` | `/todo/users/:id` | Yes | Update the authenticated user's profile |

All endpoints enforce **self-access only**. Cross-user access attempts return `404`.

**Update profile request body:**
```json
{
  "fName": "Jane",
  "lName": "Doe",
  "email": "jane@example.com",
  "username": "jdoe",
  "password": "newpassword123"
}
```

`password` is optional. Omit it to leave the current password unchanged.

**Profile success response** (`200`):
```json
{
  "id": 42,
  "fName": "Jane",
  "lName": "Doe",
  "email": "jane@example.com",
  "username": "jdoe",
  "role": "worker",
  "createdAt": "2026-07-02T12:00:00.000Z",
  "updatedAt": "2026-07-02T12:05:00.000Z"
}
```

**Error response:** `{ "message": "Human-readable explanation." }` with appropriate HTTP status.  
**Not found / not owned:** `404` (do not use `403`).

---

## Screen Requirements

### [Component: MenuBar] — all authenticated routes
Extends the Feature 2 `MenuBar`. Dashboard lists view is unchanged.

**Menu bar changes (this feature)**
*   Replace the inline display name + **Sign out** button with a **user icon** (`mdi-account-circle` or similar).
*   Clicking the user icon opens a `<v-menu>` profile dropdown.
*   **Remove** the standalone **Sign out** button from the app bar.

**Profile dropdown (`<v-menu>`)**
*   Read-only display of **full name** (`fName` + `lName`), **username**, and **email**.
*   Use `<v-list-item>` with the full name as the title and username/email as subtitle lines.
*   **Edit Profile** button opens the edit dialog. Use class `oc-cta` — this is the reference label size for peer CTAs (**+ New List**, **Add**).
*   **Log out** list item or button — reuses existing logout flow (`authServices.logoutUser()`).

**Frontend services**
*   Add `userServices.js` with `getUser(userId)` and `updateUser(userId, payload)`.

**Edit Profile dialog (`<v-dialog>`)**
*   `<v-text-field>` for first name, last name, email, username.
*   Optional `<v-text-field type="password">` for new password and confirm password.
*   Pre-fill all fields except passwords from the current session / `GET /todo/users/:id`.
*   **Save** / **Cancel** actions.
*   Client-side validation mirrors `Register.vue` rules (required fields, email format via shared `emailRules`, password length, password match).
*   **Loading state:** `:loading` on **Save** while the API request is in flight.
*   **Error state:** `<v-alert type="error">` for API failures.

**Logout**
*   **Log out** in the profile dropdown replaces menu-bar **Sign out** (same API and redirect behavior as Feature 1).

---

## Key Entities

- **User**: same entity as Feature 1; profile fields editable via API (no new tables).

---

## Data Model Requirements

No new tables. This feature uses the existing `users` table from Feature 1.

| Field | Notes for this feature |
|-------|------------------------|
| `fName`, `lName`, `email`, `username` | Editable via `PUT /todo/users/:id` |
| `password` | Optional on update; hashed when provided |
| `role` | Read-only in API responses; not editable in this feature |

---

## Acceptance Criteria (Gherkin)

### US-4.1 — View profile from the menu bar

#### Scenario: User opens the profile dropdown from the menu bar
*   **Given** I am signed in on the dashboard
*   **When** I click the user icon on the menu bar
*   **Then** the profile dropdown is displayed
*   **And** the dropdown shows my full name (`fName` + `lName`)
*   **And** the dropdown shows my username
*   **And** the dropdown shows my email
*   **And** an **Edit Profile** button is displayed
*   **And** a **Log out** action is displayed

---

### US-4.2 — Edit profile

#### Scenario: User opens the edit profile dialog
*   **Given** I am signed in
*   **And** the profile dropdown is displayed
*   **When** I click **Edit Profile**
*   **Then** the Edit Profile dialog is displayed
*   **And** fields are pre-filled with my current first name, last name, email, and username

#### Scenario: User cancels the edit profile dialog
*   **Given** I am signed in
*   **And** the Edit Profile dialog is displayed
*   **When** I change one or more fields
*   **And** I click **Cancel**
*   **Then** the Edit Profile dialog closes
*   **And** no profile update API request is sent
*   **And** my stored profile data is unchanged

#### Scenario: User saves profile changes
*   **Given** I am signed in
*   **And** the Edit Profile dialog is displayed
*   **When** I update my first name, last name, email, or username with valid values
*   **And** I click **Save**
*   **Then** the API returns `200` with the updated user object (no password hash)
*   **And** the Edit Profile dialog closes
*   **And** `localStorage` key `user` is updated
*   **And** reopening the profile dropdown shows my updated full name, username, and email

#### Scenario: User saves profile with invalid email format
*   **Given** I am signed in
*   **And** the Edit Profile dialog is displayed
*   **When** I enter a value that is not a valid email address (e.g. `notanemail`)
*   **And** I click **Save**
*   **Then** inline validation blocks the request
*   **And** I see the message **"Enter a valid email address."**
*   **And** no profile update API request is sent

#### Scenario: User saves profile with mismatched passwords
*   **Given** I am signed in
*   **And** the Edit Profile dialog is displayed
*   **When** I enter a new password and a non-matching confirmation
*   **And** I click **Save**
*   **Then** inline validation blocks the request
*   **And** I see the message **"Passwords do not match."**
*   **And** no profile update API request is sent

#### Scenario: User saves profile with a password that is too short
*   **Given** I am signed in
*   **And** the Edit Profile dialog is displayed
*   **When** I enter a new password shorter than 8 characters with a matching confirmation
*   **And** I click **Save**
*   **Then** inline validation blocks the request
*   **And** I see the message **"Password must be at least 8 characters."**
*   **And** no profile update API request is sent

#### Scenario: Profile update API returns an error
*   **Given** I am signed in
*   **And** the Edit Profile dialog is displayed
*   **When** I click **Save**
*   **And** the API returns `400` with `{ "message": "..." }`
*   **Then** the error is displayed in a `<v-alert type="error">`
*   **And** the Edit Profile dialog remains open

#### Scenario: User fetches their own profile
*   **Given** I am signed in as user A
*   **When** I request `GET /todo/users/:id` with my user ID
*   **Then** the API returns `200` with my profile fields
*   **And** the response does not include a password hash

#### Scenario: User attempts to fetch another user's profile
*   **Given** I am signed in as user A
*   **And** user B exists
*   **When** I request `GET /todo/users/:id` with user B's ID
*   **Then** the API returns `404` with `{ "message": "User with id=<id> not found." }`

#### Scenario: User attempts to update another user's profile
*   **Given** I am signed in as user A
*   **And** user B exists
*   **When** I send `PUT /todo/users/:id` with user B's ID
*   **Then** the API returns `404` with `{ "message": "User with id=<id> not found." }`
*   **And** user B's profile is unchanged in the database

#### Scenario: Unauthenticated profile API request
*   **Given** I have no valid session token
*   **When** I request `GET /todo/users/1`
*   **Then** the API returns `401` with an unauthorized message

#### Scenario: Profile update rejects a password that is too short
*   **Given** I am signed in as user A
*   **When** I send `PUT /todo/users/:id` with body `{ "password": "short" }`
*   **Then** the API returns `400` with `{ "message": "Password must be at least 8 characters." }`

#### Scenario: Profile update rejects missing required fields
*   **Given** I am signed in as user A
*   **When** I send `PUT /todo/users/:id` with a body that omits a required field (e.g. first name)
*   **Then** the API returns `400` with `{ "message": "First name is required." }`
*   **And** my stored profile is unchanged

#### Scenario: Profile update rejects a duplicate username
*   **Given** I am signed in as user A
*   **And** user B exists with username `userb`
*   **When** I send `PUT /todo/users/:id` with body `{ "username": "userb" }` (and other valid fields)
*   **Then** the API returns `400` with `{ "message": "Username is already taken." }`
*   **And** user B's username remains `userb`

#### Scenario: Profile update rejects a duplicate email
*   **Given** I am signed in as user A
*   **And** user B exists with email `b@example.com`
*   **When** I send `PUT /todo/users/:id` with body `{ "email": "b@example.com" }` (and other valid fields)
*   **Then** the API returns `400` with `{ "message": "Email is already registered." }`
*   **And** user B's email remains `b@example.com`

#### Scenario: Unauthenticated profile update API request
*   **Given** I have no valid session token
*   **When** I send `PUT /todo/users/1` with a valid profile body
*   **Then** the API returns `401` with an unauthorized message

---

### US-4.3 — Log out from profile

#### Scenario: User logs out from the profile dropdown
*   **Given** I am signed in on the dashboard
*   **And** the profile dropdown is open
*   **When** I click **Log out**
*   **Then** the API invalidates my session token on the server
*   **And** `localStorage` key `user` is removed
*   **And** I am redirected to the login page

---

### US-4.4 — Single logout entry point

#### Scenario: Menu bar does not show Sign out
*   **Given** I am signed in on the dashboard
*   **When** I view the menu bar
*   **Then** I do not see a **Sign out** button on the menu bar

---

## Test Coverage Map

Each scenario above must map to at least one automated test.

| Story | Scenario | Test file | Test name |
|-------|----------|-----------|-----------|
| US-4.1 | User opens the profile dropdown from the menu bar | `frontend/tests/MenuBar.test.js` | `User opens the profile dropdown from the menu bar` |
| US-4.2 | User opens the edit profile dialog | `frontend/tests/MenuBar.test.js` | `User opens the edit profile dialog` |
| US-4.2 | User cancels the edit profile dialog | `frontend/tests/MenuBar.test.js` | `User cancels the edit profile dialog` |
| US-4.2 | User saves profile changes | `backend/tests/users.test.js`, `frontend/tests/MenuBar.test.js` | `User saves profile changes` |
| US-4.2 | User saves profile with invalid email format | `frontend/tests/MenuBar.test.js` | `User saves profile with invalid email format` |
| US-4.2 | User saves profile with mismatched passwords | `frontend/tests/MenuBar.test.js` | `User saves profile with mismatched passwords` |
| US-4.2 | User saves profile with a password that is too short | `frontend/tests/MenuBar.test.js` | `User saves profile with a password that is too short` |
| US-4.2 | Profile update API returns an error | `frontend/tests/MenuBar.test.js` | `Profile update API returns an error` |
| US-4.2 | User fetches their own profile | `backend/tests/users.test.js` | `User fetches their own profile` |
| US-4.2 | User attempts to fetch another user's profile | `backend/tests/users.test.js` | `User attempts to fetch another user's profile` |
| US-4.2 | User attempts to update another user's profile | `backend/tests/users.test.js` | `User attempts to update another user's profile` |
| US-4.2 | Unauthenticated profile API request | `backend/tests/users.test.js` | `Unauthenticated profile API request` |
| US-4.2 | Profile update rejects a password that is too short | `backend/tests/users.test.js` | `Profile update rejects a password that is too short` |
| US-4.2 | Profile update rejects missing required fields | `backend/tests/users.test.js` | `Profile update rejects missing required fields` |
| US-4.2 | Profile update rejects a duplicate username | `backend/tests/users.test.js` | `Profile update rejects a duplicate username` |
| US-4.2 | Profile update rejects a duplicate email | `backend/tests/users.test.js` | `Profile update rejects a duplicate email` |
| US-4.2 | Unauthenticated profile update API request | `backend/tests/users.test.js` | `Unauthenticated profile update API request` |
| US-4.3 | User logs out from the profile dropdown | `frontend/tests/MenuBar.test.js` | `User logs out from the profile dropdown` |
| US-4.4 | Menu bar does not show Sign out | `frontend/tests/MenuBar.test.js` | `Menu bar does not show Sign out` |

---

## Agent implementation request

Copy when asking Cursor to implement this feature (`@` this file):

```text
Implement Feature 4 from @features/feature-4-user-profile-management.md on branch `feature/4-user-profile-management`.

Follow layer order in @features/framework.md (models → routes → backend tests → frontend → frontend tests).
Map every Gherkin scenario in the Test Coverage Map; run `npm test` before finishing.
If API routes, payloads, schema, or product rules changed per this spec, update @features/reference/api.md, @features/reference/data-model.md, and/or @features/reference/behavior.md in the same PR to match shipped code.
Complete Definition of Done and the merge checklist in @features/framework.md.
Do not implement behavior not in this spec.
```

**Reference updates for this feature:** `features/reference/data-model.md`, `features/reference/api.md`, `features/reference/behavior.md`

---

## Definition of Done

*   [ ] Backend and frontend implemented per this spec (**FR-00N** satisfied)
*   [ ] **Success Criteria (SC-00N)** met
*   [ ] All mapped tests pass (`npm test`)
*   [ ] Test Coverage Map complete
*   [ ] `features/reference/data-model.md` updated (if schema changed)
*   [ ] `features/reference/api.md` updated (if API changed)
*   [ ] `features/reference/behavior.md` updated (if product rules changed)

---

## Out of Scope

*   Admin user management or role changes
*   Avatar or profile photo upload
*   Email verification workflow
*   Changes to list or todo CRUD (Features 2–3)
*   Password reset / forgot-password flow
