# Feature: Todo List Management

**Feature ID:** 2
**Branch pattern:** `feature/2-todo-list-management`
**Status:** Ready
**Created:** 2026-02-01
**Input:** Signed-in users manage private named todo lists on one dashboard view; new lists are added via a dialog
**Depends on:** [Feature 1 — User Authentication](feature-1-user-auth.md)

---

## User Stories

### US-2.1: Create todo lists
**As a** signed-in user  
**I want to** create named todo lists (e.g. "Work", "Groceries")  
**So that** I can organize tasks into separate groups

**Priority:** P1  
**Independent test:** Open add-list dialog, create a list; it appears in the lists view  
**Acceptance scenarios:** see ### US-2.1 under Acceptance Criteria

### US-2.2: View my lists
**As a** signed-in user  
**I want to** see all of my todo lists on one screen  
**So that** I can see what groups I have created

**Priority:** P1  
**Independent test:** Dashboard loads a single list of owned lists (no sidebar split)  
**Acceptance scenarios:** see ### US-2.2 under Acceptance Criteria

### US-2.3: Manage list rows
**As a** signed-in user  
**I want** each list row to show **edit** and **delete** actions  
**So that** I can manage lists without leaving the lists view (todo **items** open in a dialog — Feature 3)

**Priority:** P1  
**Independent test:** Each list row exposes edit and delete icon actions  
**Acceptance scenarios:** see ### US-2.3 under Acceptance Criteria

### US-2.4: Rename and delete lists
**As a** signed-in user  
**I want to** rename or delete a todo list  
**So that** I can keep my workspace organized

**Priority:** P2  
**Independent test:** Rename and delete an owned list from row actions; lists view updates  
**Acceptance scenarios:** see ### US-2.4 under Acceptance Criteria

### US-2.5: Private lists only
**As a** signed-in user  
**I want** my lists visible only to me  
**So that** other users cannot read or modify my list names

**Priority:** P1  
**Independent test:** Cross-user list access returns `404`; `GET /todo/lists` never returns another user's rows  
**Acceptance scenarios:** see ### US-2.5 under Acceptance Criteria

---

## Requirements

### Functional Requirements

- **FR-001**: All list endpoints MUST require a valid session (`authenticate` middleware).
- **FR-002**: A list MUST belong to exactly one user for its entire lifetime; ownership MUST never change.
- **FR-003**: Every database read, update, and delete MUST include `userId: req.user.id` in the `where` clause.
- **FR-004**: On create, `userId` MUST be set from `req.user.id` only — ignore or strip any `userId` in the request body.
- **FR-005**: List names MUST be trimmed before save; empty strings MUST be rejected.
- **FR-006**: Lists MUST be ordered alphabetically by name in API responses.
- **FR-007**: This feature MUST deliver list CRUD and a **single-view** lists UI in `Dashboard.vue` (dialog-based add/edit/delete). No sidebar/main split. Todo **items** UI is Feature 3.

---

## Assumptions

- Feature 1 auth and session handling MUST be merged to `dev` before implementing this feature.
- Lists and todos use **dialog-based** workflows (no split sidebar / main panel).
- `MenuBar` is introduced in this feature with basic sign-out (profile dropdown is Feature 4).

## Edge Cases

- Empty or whitespace-only list name → client block and/or `400`.
- List name longer than 100 characters → `400`.
- Invalid `listId` → `400`; unowned list → `404`.
- Unauthenticated dashboard or `GET /todo/lists` → redirect or `401`.

## Success Criteria

- **SC-001**: Every Gherkin scenario has at least one automated test before merge.
- **SC-002**: Signed-in user can create, view, rename, and delete lists on one screen without seeing another user's data.
- **SC-003**: `npm test` passes for list API and dashboard lists-view behavior.

---

## Data Ownership & Isolation

Each user owns their lists exclusively. Another authenticated user must not be able to view, rename, or delete them.

| Rule | Requirement |
|------|-------------|
| **Read scope** | `GET /todo/lists` returns only lists where `userId = req.user.id`. |
| **Write scope** | `PUT` and `DELETE` apply only when the list row matches both `id` and `req.user.id`. |
| **Create scope** | New lists are always owned by the authenticated user. |
| **Cross-user access** | If a list belongs to another user, respond with `404` — never `403` (do not confirm the list exists). |
| **UI scope** | The lists view shows only lists returned by `GET /todo/lists` for the signed-in user. |
| **Implementation** | Use a shared helper (e.g. `getAccessibleListOrNull(req, listId)`) in `app/authorization/` — do not duplicate scope logic in controllers. |

---

## API Requirements

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `GET` | `/todo/lists` | Yes | Fetch all lists for the authenticated user |
| `POST` | `/todo/lists` | Yes | Create a new list |
| `PUT` | `/todo/lists/:listId` | Yes | Rename a list |
| `DELETE` | `/todo/lists/:listId` | Yes | Delete a list owned by the caller |

All endpoints return **only data owned by the authenticated user**. Cross-user access attempts return `404`.

**Create list request body:**
```json
{ "name": "Groceries" }
```

**List success response** (`200` / `201`):
```json
{
  "id": 1,
  "name": "Groceries",
  "userId": 42,
  "createdAt": "2026-07-02T12:00:00.000Z",
  "updatedAt": "2026-07-02T12:00:00.000Z"
}
```

**Error response:** `{ "message": "Human-readable explanation." }` with appropriate HTTP status.  
**Not found / not owned:** `404` (do not use `403`).

---

## Screen Requirements

### [View: Application Dashboard] — route name `home`
Replaces the Feature 1 placeholder home page. **Single Vue view** (`Dashboard.vue`) — no sidebar / main-panel split.

**Lists view (this feature)**
*   Heading: **My Lists**
*   Primary action: **+ New List** opens a `<v-dialog>` with a name `<v-text-field>` and **Create** / **Cancel**. Use class `oc-cta` on **Create** and **+ New List** (per [ui-style-system.mdc](../../.cursor/rules/ui-style-system.mdc)).
*   Display owned lists as rows (e.g. `<v-list>` or table): each row shows the **list name** and icon actions:
    *   **Edit** icon — opens rename `<v-dialog>` pre-filled with current name; **Save** / **Cancel**
    *   **Delete** icon — opens confirmation `<v-dialog>`
    *   *(Feature 3 adds an **Items** icon on each row — not in Feature 2)*
*   Icon-only row actions use `size="small"` and accessible `aria-label`s (**Edit list**, **Delete list**).
*   **Empty state:** **"No lists yet. Create your first list."** when the user has zero lists.
*   **Loading state:** skeleton or progress indicator while lists are fetching.
*   **Error state:** `<v-alert type="error">` for API failures.

**App chrome**
*   Introduce `MenuBar` in this feature (not present in Feature 1): signed-in user's name and **Sign out**.
*   `MenuBar` is hidden on login and register routes.

**Implementation note:** one route/view for lists; list CRUD dialogs are child components or inline `<v-dialog>` blocks in `Dashboard.vue` unless the team splits presentational dialogs later.

---

## Key Entities

- **List**: named group belonging to one user; will contain todos (Feature 3).
- **User**: owns many lists (from Feature 1).

---

## Data Model Requirements

### `lists` table
| Field | Type | Rules |
|-------|------|-------|
| `id` | INTEGER PK | Auto-increment |
| `name` | STRING | Required; max 100 chars |
| `userId` | INTEGER FK | Required; references `users.id`; set from `req.user.id` on create |
| `createdAt` | DATE | Sequelize timestamps |
| `updatedAt` | DATE | Sequelize timestamps |

### Associations (in `models/index.js`)
*   `User hasMany List`
*   `List belongsTo User`

---

## Acceptance Criteria (Gherkin)

### US-2.1 — Create todo lists

#### Scenario: User creates a new list
*   **Given** I am signed in on the dashboard
*   **When** I click **+ New List**
*   **And** I enter list name `Groceries`
*   **And** I confirm the dialog
*   **Then** the API returns `201` with a list object containing `id`, `name`, and `userId`
*   **And** the returned `userId` matches my authenticated user ID
*   **And** `Groceries` appears in the lists view
*   **And** the add-list dialog closes

#### Scenario: User creates a list with an empty name
*   **Given** I am signed in on the dashboard
*   **When** I open the new list dialog
*   **And** I leave the name field empty or whitespace only
*   **And** I attempt to confirm
*   **Then** inline validation blocks the request
*   **And** I see the message **"List name is required."**
*   **And** no API request is sent

#### Scenario: User creates a list with a name that is too long
*   **Given** I am signed in on the dashboard
*   **When** I submit a list name longer than 100 characters
*   **Then** the API returns `400` with `{ "message": "List name must be 100 characters or fewer." }`
*   **And** the error is displayed in a `<v-alert type="error">`

---

### US-2.2 — View my lists

#### Scenario: Dashboard loads with existing lists
*   **Given** I am signed in
*   **And** I own lists `Work` and `Personal`
*   **When** I navigate to the dashboard
*   **Then** both lists appear in the lists view
*   **And** each row shows the list name with edit and delete icon actions

#### Scenario: User has no lists
*   **Given** I am signed in
*   **And** I have no lists
*   **When** I navigate to the dashboard
*   **Then** I see **"No lists yet. Create your first list."**

#### Scenario: User cannot see another user's lists
*   **Given** user B owns list `Secret Project`
*   **And** I am signed in as user A
*   **When** I request `GET /todo/lists`
*   **Then** the response contains only lists owned by user A
*   **And** `Secret Project` is not in the response
*   **And** the lists view does not show `Secret Project`

---

### US-2.3 — Manage list rows

#### Scenario: List rows show edit and delete actions
*   **Given** I am signed in
*   **And** I own list `Groceries`
*   **When** I view the dashboard lists view
*   **Then** the `Groceries` row shows an **Edit list** icon action
*   **And** the `Groceries` row shows a **Delete list** icon action

---

### US-2.4 — Rename and delete lists

#### Scenario: User renames a list
*   **Given** I am signed in
*   **And** I own a list named `Groceries`
*   **When** I click the edit icon on the `Groceries` row
*   **And** I change the name to `Shopping` in the rename dialog
*   **And** I confirm
*   **Then** the API returns `200` with the updated list object
*   **And** the lists view shows `Shopping` instead of `Groceries`

#### Scenario: User deletes a list
*   **Given** I am signed in
*   **And** I own a list named `Groceries`
*   **When** I click the delete icon on the `Groceries` row
*   **And** I confirm the delete dialog
*   **Then** the API returns `200` or `204`
*   **And** the list is removed from the lists view

---

### US-2.5 — Private lists only

#### Scenario: User attempts to rename another user's list
*   **Given** I am signed in as user A
*   **And** a list exists that belongs to user B
*   **When** I send `PUT /todo/lists/:listId` with user B's list ID and body `{ "name": "Hijacked" }`
*   **Then** the API returns `404` with `{ "message": "List with id=<id> not found." }`
*   **And** user B's list name is unchanged in the database

#### Scenario: User attempts to delete another user's list
*   **Given** I am signed in as user A
*   **And** a list exists that belongs to user B
*   **When** I send `DELETE /todo/lists/:listId` with user B's list ID
*   **Then** the API returns `404` with `{ "message": "List with id=<id> not found." }`
*   **And** user B's list still exists

#### Scenario: Client cannot assign a list to another user on create
*   **Given** I am signed in as user A
*   **When** I send `POST /todo/lists` with body `{ "name": "Groceries", "userId": 999 }` where user `999` is a different user
*   **Then** the API returns `201` with a list owned by user A
*   **And** the saved `userId` is user A's ID, not `999`

#### Scenario: Unauthenticated user accesses the dashboard
*   **Given** I have no session in `localStorage`
*   **When** I navigate to the dashboard
*   **Then** I am redirected to the login page

#### Scenario: Unauthenticated API request to lists
*   **Given** I have no valid session token
*   **When** I request `GET /todo/lists`
*   **Then** the API returns `401` with an unauthorized message

---

## Test Coverage Map

| Story | Scenario | Test file | Test name |
|-------|----------|-----------|-----------|
| US-2.1 | User creates a new list | `backend/tests/lists.test.js`, `frontend/tests/Dashboard.test.js` | `User creates a new list` |
| US-2.1 | User creates a list with an empty name | `backend/tests/lists.test.js`, `frontend/tests/Dashboard.test.js` | `User creates a list with an empty name` |
| US-2.1 | User creates a list with a name that is too long | `backend/tests/lists.test.js` | `User creates a list with a name that is too long` |
| US-2.2 | Dashboard loads with existing lists | `backend/tests/lists.test.js`, `frontend/tests/Dashboard.test.js` | `Dashboard loads with existing lists` |
| US-2.2 | User has no lists | `frontend/tests/Dashboard.test.js` | `User has no lists` |
| US-2.2 | User cannot see another user's lists | `backend/tests/lists.test.js` | `User cannot see another user's lists` |
| US-2.3 | List rows show edit and delete actions | `frontend/tests/Dashboard.test.js` | `List rows show edit and delete actions` |
| US-2.4 | User renames a list | `backend/tests/lists.test.js`, `frontend/tests/Dashboard.test.js` | `User renames a list` |
| US-2.4 | User deletes a list | `backend/tests/lists.test.js`, `frontend/tests/Dashboard.test.js` | `User deletes a list` |
| US-2.5 | User attempts to rename another user's list | `backend/tests/lists.test.js` | `User attempts to rename another user's list` |
| US-2.5 | User attempts to delete another user's list | `backend/tests/lists.test.js` | `User attempts to delete another user's list` |
| US-2.5 | Client cannot assign a list to another user on create | `backend/tests/lists.test.js` | `Client cannot assign a list to another user on create` |
| US-2.5 | Unauthenticated API request to lists | `backend/tests/lists.test.js` | `Unauthenticated API request to lists` |

---

## Agent implementation request

Copy when asking Cursor to implement this feature (`@` this file):

```text
Implement Feature 2 from @features/feature-2-todo-list-management.md on branch `feature/2-todo-list-management`.

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

*   Todo items (see `features/feature-3-todo-list-item-management.md`)
*   `MenuBar` beyond basic sign-out (full nav deferred if not needed)
*   Drag-and-drop list reordering
*   Sharing lists with other users

---

## Delivered to Feature 3

The following are intentionally deferred to the next feature spec:

*   `todos` table and associations
*   **Items** icon on each list row; list-items dialog (view todos for that list)
*   Add / edit / delete todo dialogs and row actions (checkbox, name, edit, delete)
*   `GET/POST /todo/lists/:listId/todos` and `PUT/DELETE /todo/todos/:id`
