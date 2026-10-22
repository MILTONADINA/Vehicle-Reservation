# Feature: Todo List Item Management

**Feature ID:** 3
**Branch pattern:** `feature/3-todo-list-item-management`
**Status:** Ready
**Created:** 2026-02-15
**Input:** Signed-in users manage todo items per list via dialogs opened from list rows (items, add, edit, delete)
**Depends on:** [Feature 1 — User Authentication](feature-1-user-auth.md), [Feature 2 — Todo List Management](feature-2-todo-list-management.md)

---

## User Stories

### US-3.1: Add tasks to a list
**As a** signed-in user  
**I want to** add todo items to a list from its items dialog  
**So that** I can track what needs to be done in that context

**Priority:** P1  
**Independent test:** Open items dialog for a list, add a todo via add-item dialog; it appears in the items list with `completed: false`  
**Acceptance scenarios:** see ### US-3.1 under Acceptance Criteria

### US-3.2: View tasks in a list
**As a** signed-in user  
**I want to** open a list's items dialog and see all todos for that list  
**So that** I know what work belongs to that group

**Priority:** P1  
**Independent test:** Open items dialog on different list rows; each dialog shows only that list's todos  
**Acceptance scenarios:** see ### US-3.2 under Acceptance Criteria

### US-3.3: Complete tasks
**As a** signed-in user  
**I want to** mark todos as complete or incomplete  
**So that** I can track my progress

**Priority:** P1  
**Independent test:** Toggle checkbox; API persists `completed` and UI reflects state  
**Acceptance scenarios:** see ### US-3.3 under Acceptance Criteria

### US-3.4: Edit and remove tasks
**As a** signed-in user  
**I want to** edit or delete individual todos  
**So that** I can keep my lists accurate

**Priority:** P2  
**Independent test:** Edit title and delete todo via UI; changes persist after refresh  
**Acceptance scenarios:** see ### US-3.4 under Acceptance Criteria

### US-3.5: Private items only
**As a** signed-in user  
**I want** my todo items visible only to me  
**So that** other users cannot read or modify my tasks

**Priority:** P1  
**Independent test:** Cross-user todo or parent-list access returns `404`  
**Acceptance scenarios:** see ### US-3.5 under Acceptance Criteria

### US-3.6: Lists carry their items
**As a** signed-in user  
**I want** deleting a list to remove its todo items  
**So that** I do not leave orphaned tasks in the database

**Priority:** P2  
**Independent test:** Delete list with todos; todos are gone from database  
**Acceptance scenarios:** see ### US-3.6 under Acceptance Criteria

---

## Requirements

### Functional Requirements

- **FR-001**: All todo endpoints MUST require a valid session (`authenticate` middleware).
- **FR-002**: A todo MUST belong to exactly one list and one user for its entire lifetime.
- **FR-003**: Every todo read, update, and delete MUST scope with `userId: req.user.id`.
- **FR-004**: Before creating a todo, the parent list MUST be owned by `req.user.id`; otherwise return `404`.
- **FR-005**: On create, `userId` and `listId` MUST come from validated server context — ignore client spoofing of ownership.
- **FR-006**: Todo titles MUST be trimmed before save; empty strings MUST be rejected.
- **FR-007**: New todos MUST default to `completed: false`.
- **FR-008**: Deleting a list MUST delete all todos in that list (cascade).
- **FR-009**: Todos MUST be ordered incomplete first, then by `createdAt` ascending.
- **FR-010**: This feature MUST extend the Feature 2 single-view lists UI: each list row gains an **Items** icon that opens a list-items `<v-dialog>`. Todo add/edit/delete use nested dialogs — no sidebar/main split.

---

## Assumptions

- Features 1–2 MUST be merged to `dev` before implementing this feature (auth, lists, single-view dashboard, `MenuBar` with sign-out).
- Due dates are out of scope (Feature 5).
- No drag-and-drop reorder, search, or sharing.

## Edge Cases

- Add todo with items dialog closed → no add UI visible; no API call until user opens items dialog and add-item dialog.
- Empty todo title → client block and/or `400`.
- Title longer than 255 characters → `400`.
- Parent list or todo owned by another user → `404`.
- Unauthenticated todo API → `401`.

## Success Criteria

- **SC-001**: Every Gherkin scenario has at least one automated test before merge.
- **SC-002**: User can add, view, complete, edit, and delete todos in an owned list end-to-end.
- **SC-003**: Deleting a list removes its todos; `npm test` passes.

---

## Data Ownership & Isolation

Each user owns their todo items exclusively. Items are private to the user even when nested under a list.

| Rule | Requirement |
|------|-------------|
| **Parent list check** | Todo operations require the parent list to belong to `req.user.id`. |
| **Todo scope** | `GET`, `PUT`, and `DELETE` on todos match both `id` and `userId = req.user.id`. |
| **Create scope** | `POST .../todos` succeeds only when `:listId` is owned by the caller; new todo `userId` is set from `req.user.id`. |
| **Cross-user access** | If a todo or parent list belongs to another user, respond with `404` — never `403`. |
| **UI scope** | The list-items dialog shows only todos for the list opened from that row, fetched via API for the signed-in user. |
| **Implementation** | Use shared helpers (e.g. `getAccessibleListOrNull`, `getAccessibleTodoOrNull`) in `app/authorization/`. |

---

## API Requirements

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| `GET` | `/todo/lists/:listId/todos` | Yes | Fetch all todos in a list |
| `POST` | `/todo/lists/:listId/todos` | Yes | Add a todo to a list |
| `PUT` | `/todo/todos/:id` | Yes | Update a todo (title and/or `completed`) |
| `DELETE` | `/todo/todos/:id` | Yes | Delete a todo owned by the caller |

All endpoints enforce **list ownership** and **todo ownership** by the authenticated user. Cross-user access attempts return `404`.

**Create todo request body:**
```json
{ "title": "Buy milk" }
```

**Todo success response** (`200` / `201`):
```json
{
  "id": 10,
  "listId": 1,
  "title": "Buy milk",
  "completed": false,
  "userId": 42,
  "createdAt": "2026-07-02T12:05:00.000Z",
  "updatedAt": "2026-07-02T12:05:00.000Z"
}
```

**Error response:** `{ "message": "Human-readable explanation." }` with appropriate HTTP status.  
**Not found / not owned:** `404` (do not use `403`).

---

## Screen Requirements

### [View: Application Dashboard] — route name `home`
Extends the Feature 2 single-view lists dashboard. List CRUD (add/rename/delete list) is unchanged; this feature adds todo management via dialogs.

**List rows (extend Feature 2)**
*   Each list row adds an **Items** icon (`aria-label`: **Items** or **View items for &lt;list name&gt;**).
*   Clicking **Items** opens a **list-items dialog** for that list.

**List-items dialog**
*   Title shows the list name (e.g. **Groceries — Items**).
*   Primary action: **+ Add Item** opens a nested **add-item dialog** with a title `<v-text-field>` and **Add** / **Cancel**. **+ Add Item** and **Add** use class `oc-cta`.
*   Todo rows: **checkbox** (`completed`), **name** (title text), **edit** icon, **delete** icon.
*   **Edit:** edit icon opens a nested **edit-item dialog** with title field pre-filled; **Save** / **Cancel**.
*   **Delete:** delete icon opens a confirmation `<v-dialog>`.
*   Completed todos show struck-through or muted title styling.
*   **Empty state:** **"No todos in this list yet."** when the list has zero todos.
*   **Loading state:** skeleton or progress indicator while todos are fetching.
*   **Error state:** `<v-alert type="error">` for API failures.
*   **Close:** dialog has **Close** or equivalent to return to the lists view.

**List switch behavior**
*   User opens items dialog on one list row, closes it, then opens items on another row — each dialog load fetches only that list's todos.

**Implementation note:** list-items, add-item, and edit-item dialogs may be child components; only one list-items dialog need be open at a time.

---

## Key Entities

- **Todo**: task item with title and completion state; belongs to one list and one user.
- **List**: parent container for todos (Feature 2); deleting a list removes its todos.

---

## Data Model Requirements

### `todos` table
| Field | Type | Rules |
|-------|------|-------|
| `id` | INTEGER PK | Auto-increment |
| `listId` | INTEGER FK | Required; references `lists.id`; cascade on list delete |
| `title` | STRING | Required; max 255 chars |
| `completed` | BOOLEAN | Default `false` |
| `userId` | INTEGER FK | Required; references `users.id`; set from `req.user.id` on create |
| `createdAt` | DATE | Sequelize timestamps |
| `updatedAt` | DATE | Sequelize timestamps |

### Associations (add to `models/index.js`)
*   `List hasMany Todo` — `onDelete: CASCADE`
*   `Todo belongsTo List`
*   `User hasMany Todo`
*   `Todo belongsTo User`

---

## Acceptance Criteria (Gherkin)

### US-3.1 — Add tasks to a list

#### Scenario: User adds a todo to a list via dialog
*   **Given** I am signed in on the dashboard
*   **And** I own list `Groceries`
*   **When** I click the **Items** icon on the `Groceries` row
*   **And** I click **+ Add Item**
*   **And** I enter todo title `Buy milk`
*   **And** I confirm the add-item dialog
*   **Then** the API returns `201` with a todo object where `completed` is `false`
*   **And** the returned `userId` matches my authenticated user ID
*   **And** the returned `listId` matches `Groceries`
*   **And** `Buy milk` appears in the list-items dialog

#### Scenario: User adds a todo with an empty title
*   **Given** I am signed in
*   **And** I have opened the items dialog for an owned list
*   **When** I open the add-item dialog
*   **And** I leave the todo title empty
*   **And** I attempt to confirm
*   **Then** inline validation blocks the request
*   **And** I see the message **"Todo title is required."**
*   **And** no API request is sent

#### Scenario: Add item is only available inside the items dialog
*   **Given** I am signed in on the dashboard
*   **And** the list-items dialog is not open
*   **When** I view the lists view
*   **Then** I do not see an add-todo field or **+ Add Item** control on the main lists view

---

### US-3.2 — View tasks in a list

#### Scenario: List items dialog shows empty state
*   **Given** I am signed in
*   **And** I own an empty list `Personal`
*   **When** I open the items dialog for `Personal`
*   **And** the todos finish loading
*   **Then** I see **"No todos in this list yet."**

#### Scenario: User opens items for different lists
*   **Given** I am signed in
*   **And** list `Work` has todos `Email client` and `Write report`
*   **And** list `Personal` has todo `Call mom`
*   **When** I open the items dialog for `Personal`
*   **Then** I see only `Call mom`
*   **When** I close the items dialog
*   **And** I open the items dialog for `Work`
*   **Then** I see `Email client` and `Write report`

#### Scenario: User only sees their own todos when opening items
*   **Given** I am signed in as user A
*   **And** I own list `Work` with todo `My task`
*   **And** user B owns list `Work` with todo `Their task` (same list name, different owner)
*   **When** I open the items dialog for my `Work` list
*   **Then** I see only `My task`
*   **And** I do not see `Their task`

---

### US-3.3 — Complete tasks

#### Scenario: User marks a todo as complete
*   **Given** I am signed in
*   **And** I have opened the items dialog for a list containing todo `Buy milk` with `completed: false`
*   **When** I check the todo's checkbox
*   **Then** the API returns `200` with `completed: true`
*   **And** the todo displays as completed (struck-through or muted)

#### Scenario: User marks a completed todo as incomplete
*   **Given** I am signed in
*   **And** I have opened the items dialog for a list containing todo `Buy milk` with `completed: true`
*   **When** I uncheck the todo's checkbox
*   **Then** the API returns `200` with `completed: false`
*   **And** the todo displays as active again

---

### US-3.4 — Edit and remove tasks

#### Scenario: User edits a todo title
*   **Given** I am signed in
*   **And** I have opened the items dialog for a list containing todo `Buy milk`
*   **When** I click the edit icon on `Buy milk`
*   **And** I change the title to `Buy oat milk` in the edit dialog
*   **And** I confirm
*   **Then** the API returns `200` with the updated title
*   **And** the list-items dialog shows `Buy oat milk`

#### Scenario: User deletes a todo
*   **Given** I am signed in
*   **And** I have opened the items dialog for a list containing todo `Buy milk`
*   **When** I click the delete icon on `Buy milk`
*   **And** I confirm
*   **Then** the API returns `200` or `204`
*   **And** the todo is removed from the list-items dialog

---

### US-3.5 — Private items only

#### Scenario: User cannot read todos in another user's list
*   **Given** I am signed in as user A
*   **And** user B owns list `Secret` with todo `Hidden task`
*   **When** I request `GET /todo/lists/:listId/todos` with user B's list ID
*   **Then** the API returns `404` with `{ "message": "List with id=<id> not found." }`
*   **And** `Hidden task` is not returned to user A

#### Scenario: User attempts to add a todo to another user's list
*   **Given** I am signed in as user A
*   **And** a list exists that belongs to user B
*   **When** I send `POST /todo/lists/:listId/todos` with user B's list ID and body `{ "title": "Intruder task" }`
*   **Then** the API returns `404` with `{ "message": "List with id=<id> not found." }`
*   **And** no todo is created in user B's list

#### Scenario: User attempts to rename another user's todo
*   **Given** I am signed in as user A
*   **And** a todo exists that belongs to user B
*   **When** I send `PUT /todo/todos/:id` with body `{ "title": "Hijacked" }`
*   **Then** the API returns `404` with `{ "message": "Todo with id=<id> not found." }`
*   **And** user B's todo title is unchanged in the database

#### Scenario: User attempts to delete another user's todo
*   **Given** I am signed in as user A
*   **And** a todo exists that belongs to user B
*   **When** I send `DELETE /todo/todos/:id`
*   **Then** the API returns `404` with `{ "message": "Todo with id=<id> not found." }`
*   **And** user B's todo still exists

#### Scenario: Client cannot assign a todo to another user on create
*   **Given** I am signed in as user A
*   **And** I own list `Groceries`
*   **When** I send `POST /todo/lists/:listId/todos` with body `{ "title": "Buy milk", "userId": 999 }` where user `999` is a different user
*   **Then** the API returns `201` with a todo owned by user A
*   **And** the saved `userId` is user A's ID, not `999`

#### Scenario: Unauthenticated API request for todos
*   **Given** I have no valid session token
*   **When** I request `GET /todo/lists/1/todos`
*   **Then** the API returns `401` with an unauthorized message

---

### US-3.6 — Lists carry their items

#### Scenario: Deleting a list removes its todos
*   **Given** I am signed in
*   **And** I own list `Groceries` with todos `Buy milk` and `Buy eggs`
*   **When** I delete list `Groceries` and confirm
*   **Then** both todos are removed from the database
*   **And** they no longer appear if the list ID were still queried

---

## Test Coverage Map

| Story | Scenario | Test file | Test name |
|-------|----------|-----------|-----------|
| US-3.1 | User adds a todo to a list via dialog | `backend/tests/todos.test.js`, `frontend/tests/Dashboard.test.js` | `User adds a todo to a list via dialog` |
| US-3.1 | User adds a todo with an empty title | `backend/tests/todos.test.js`, `frontend/tests/Dashboard.test.js` | `User adds a todo with an empty title` |
| US-3.1 | Add item is only available inside the items dialog | `frontend/tests/Dashboard.test.js` | `Add item is only available inside the items dialog` |
| US-3.2 | List items dialog shows empty state | `frontend/tests/Dashboard.test.js` | `List items dialog shows empty state` |
| US-3.2 | User opens items for different lists | `frontend/tests/Dashboard.test.js` | `User opens items for different lists` |
| US-3.2 | User only sees their own todos when opening items | `backend/tests/todos.test.js` | `User only sees their own todos when opening items` |
| US-3.3 | User marks a todo as complete | `backend/tests/todos.test.js`, `frontend/tests/Dashboard.test.js` | `User marks a todo as complete` |
| US-3.3 | User marks a completed todo as incomplete | `backend/tests/todos.test.js`, `frontend/tests/Dashboard.test.js` | `User marks a completed todo as incomplete` |
| US-3.4 | User edits a todo title | `backend/tests/todos.test.js`, `frontend/tests/Dashboard.test.js` | `User edits a todo title` |
| US-3.4 | User deletes a todo | `backend/tests/todos.test.js`, `frontend/tests/Dashboard.test.js` | `User deletes a todo` |
| US-3.5 | User cannot read todos in another user's list | `backend/tests/todos.test.js` | `User cannot read todos in another user's list` |
| US-3.5 | User attempts to add a todo to another user's list | `backend/tests/todos.test.js` | `User attempts to add a todo to another user's list` |
| US-3.5 | User attempts to rename another user's todo | `backend/tests/todos.test.js` | `User attempts to rename another user's todo` |
| US-3.5 | User attempts to delete another user's todo | `backend/tests/todos.test.js` | `User attempts to delete another user's todo` |
| US-3.5 | Client cannot assign a todo to another user on create | `backend/tests/todos.test.js` | `Client cannot assign a todo to another user on create` |
| US-3.5 | Unauthenticated API request for todos | `backend/tests/todos.test.js` | `Unauthenticated API request for todos` |
| US-3.6 | Deleting a list removes its todos | `backend/tests/todos.test.js` | `Deleting a list removes its todos` |

---

## Agent implementation request

Copy when asking Cursor to implement this feature (`@` this file):

```text
Implement Feature 3 from @features/feature-3-todo-list-item-management.md on branch `feature/3-todo-list-item-management`.

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

*   New list CRUD features (owned by Feature 2)
*   Drag-and-drop reordering of todos
*   Due dates → [feature-5-todo-due-date.md](./feature-5-todo-due-date.md) (Feature 5)
*   Priorities, labels, or notes on todos
*   Sharing lists or todos with other users
*   Search or filter across todos
*   Bulk complete / bulk delete
*   Archive completed todos
