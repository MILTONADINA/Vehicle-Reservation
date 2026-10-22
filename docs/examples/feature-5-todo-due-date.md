# Feature: Todo Due Date

**Feature ID:** 5
**Branch pattern:** `feature/5-todo-due-date`
**Status:** Ready
**Created:** 2026-03-15
**Input:** Optional calendar due dates on todos with display and overdue highlighting
**Depends on:** [Feature 1 — User Authentication](feature-1-user-auth.md), [Feature 2 — Todo List Management](feature-2-todo-list-management.md), [Feature 3 — Todo List Item Management](feature-3-todo-list-item-management.md)
**Related:** `features/reference/data-model.md`, `features/reference/api.md`, `features/reference/behavior.md` (update in same PR when implementing)

---

## User Stories

### US-5.1: Set a due date when creating a todo
**As a** signed-in user  
**I want to** optionally set a due date when I add a todo  
**So that** I can plan when work should be finished

**Priority:** P1  
**Independent test:** Create todo with `dueDate`; API returns date and row displays it  
**Acceptance scenarios:** see ### US-5.1 under Acceptance Criteria

### US-5.2: View due dates on todos
**As a** signed-in user  
**I want to** see each todo's due date in the list  
**So that** I know what is due and when

**Priority:** P1  
**Independent test:** Todos with `dueDate` show formatted date in list rows  
**Acceptance scenarios:** covered by US-5.1 and US-5.3 scenarios (display in list)

### US-5.3: Edit or clear a due date
**As a** signed-in user  
**I want to** change or remove a due date when editing a todo  
**So that** I can keep deadlines accurate

**Priority:** P1  
**Independent test:** Edit dialog sets or clears `dueDate`; API and UI stay in sync  
**Acceptance scenarios:** see ### US-5.3 under Acceptance Criteria

### US-5.4: Spot overdue todos
**As a** signed-in user  
**I want** incomplete todos past their due date to stand out visually  
**So that** I can prioritize overdue work

**Priority:** P2  
**Independent test:** Incomplete todo with past `dueDate` uses overdue styling; completed does not  
**Acceptance scenarios:** see ### US-5.4 under Acceptance Criteria

---

## Requirements

### Functional Requirements

- **FR-001**: All behavior MUST build on Feature 3 todo CRUD (list-items and add/edit-item dialogs); list and ownership rules are unchanged.
- **FR-002**: `dueDate` MUST be optional on create and update; `null` means no due date.
- **FR-003**: Dates MUST be calendar-only: API `YYYY-MM-DD`; database `DATEONLY`.
- **FR-004**: Invalid date strings MUST return `400` with `{ "message": "..." }`.
- **FR-005**: Sending `dueDate: null` on `PUT` MUST clear the due date.
- **FR-006**: Omitting `dueDate` on `PUT` MUST leave the existing value unchanged.
- **FR-007**: Todo sort order MUST remain unchanged from Feature 3 (incomplete first, then `createdAt` ascending).
- **FR-008**: Incomplete todos MUST be styled overdue when `dueDate` is before today in the browser's local calendar (frontend only; API returns stored date).
- **FR-009**: Reference docs MUST be updated in the same PR when implementing (see **Agent implementation request**).

---

## Assumptions

- Features 1–3 MUST be merged to `dev` before implementing this feature (todo CRUD complete).
- No timezone or time-of-day — date-only in local browser calendar.
- No sorting, filtering, reminders, or calendar views.

## Edge Cases

- Invalid `dueDate` on create or update → `400` (`"Due date must be a valid date in YYYY-MM-DD format."`).
- Cross-user todo `dueDate` change → `404`.
- Completed todo with past due date → no overdue styling.
- Create without `dueDate` → `null` in API and no date on row.

## Success Criteria

- **SC-001**: Every Gherkin scenario has at least one automated test before merge.
- **SC-002**: User can set, view, edit, and clear due dates on owned todos.
- **SC-003**: Overdue styling applies only to incomplete past-due todos; `npm test` passes.

---

## Data Ownership & Isolation

Due date changes follow the same scope rules as Feature 3 todos.

| Rule | Requirement |
|------|-------------|
| **Read scope** | `dueDate` is returned only on todos the caller already owns via list/todo scoping. |
| **Write scope** | `dueDate` may be set or cleared only on todos owned by `req.user.id`. |
| **Cross-user access** | Unchanged — `404` for another user's list or todo. |

---

## API Requirements

Extends Feature 3 todo endpoints. Auth and ownership behavior are unchanged.

| Method | Endpoint | Change |
|--------|----------|--------|
| `POST` | `/todo/lists/:listId/todos` | Accept optional `dueDate` in body |
| `PUT` | `/todo/todos/:id` | Accept optional `dueDate` (date string or `null`) |
| `GET` | `/todo/lists/:listId/todos` | Response includes `dueDate` on each todo |

**Create todo request body:**
```json
{
  "title": "Buy milk",
  "dueDate": "2026-07-15"
}
```

`dueDate` is optional. Omit it or send `null` for no due date.

**Update todo request body** (any combination):
```json
{
  "title": "Buy oat milk",
  "completed": false,
  "dueDate": "2026-07-20"
}
```

Clear due date:
```json
{ "dueDate": null }
```

**Todo success response** (`200` / `201`):
```json
{
  "id": 10,
  "listId": 1,
  "title": "Buy milk",
  "completed": false,
  "dueDate": "2026-07-15",
  "userId": 42,
  "createdAt": "2026-07-02T12:05:00.000Z",
  "updatedAt": "2026-07-02T12:05:00.000Z"
}
```

`dueDate` is `null` when not set.

**Validation errors:** `400` with `{ "message": "..." }` for invalid `dueDate` format.

**Error response:** unchanged from Feature 3.  
**Not found / not owned:** `404` (do not use `403`).

---

## Screen Requirements

### [View: Application Dashboard] — route name `home`
Extends Feature 3 list-items, add-item, and edit-item dialogs only.

**Add-item dialog**
*   Optional `<v-text-field type="date">` (or equivalent) beside the title field for due date.
*   Leaving the date empty creates a todo with no due date.

**Todo row (in list-items dialog)**
*   Show due date when set (formatted for readability, e.g. `Jul 15, 2026` or locale-appropriate).
*   When `completed` is `false` and `dueDate` is before today (local date), apply overdue styling (e.g. error color on the date text).
*   Completed todos do not use overdue styling even if the date is in the past.

**Edit todo dialog**
*   Add optional date field pre-filled with the current `dueDate` (empty when `null`).
*   User can clear the date and **Save** to remove the due date.
*   **Save** / **Cancel** behavior unchanged otherwise.

**Validation**
*   Client-side: reject invalid date input before API call where the control allows it.
*   API errors shown via existing `<v-alert type="error">`.

---

## Key Entities

- **Todo**: gains optional **dueDate** (calendar date); still belongs to one list and one user.

---

## Data Model Requirements

### `todos` table (add column)

| Field | Type | Rules |
|-------|------|-------|
| `dueDate` | DATEONLY | Nullable; optional on create/update |

Existing Feature 3 columns are unchanged. Existing rows default to `dueDate: null`.

---

## Acceptance Criteria (Gherkin)

### US-5.1 — Set a due date when creating a todo

#### Scenario: User adds a todo with a due date
*   **Given** I am signed in on the dashboard
*   **And** I have opened the items dialog for an owned list
*   **When** I click **+ Add Item**
*   **And** I enter todo title `Buy milk`
*   **And** I set due date `2026-07-15`
*   **And** I confirm the add-item dialog
*   **Then** the API returns `201` with `dueDate` `2026-07-15`
*   **And** the todo row in the list-items dialog shows the due date

#### Scenario: User adds a todo without a due date
*   **Given** I am signed in
*   **And** I have opened the items dialog for an owned list
*   **When** I open the add-item dialog
*   **And** I enter a title and leave the due date empty
*   **And** I confirm
*   **Then** the API returns `201` with `dueDate` null
*   **And** no due date is shown on the row

#### Scenario: API rejects an invalid due date on create
*   **Given** I am signed in as user A
*   **And** I own a list
*   **When** I send `POST /todo/lists/:listId/todos` with body `{ "title": "Task", "dueDate": "not-a-date" }`
*   **Then** the API returns `400` with `{ "message": "..." }`
*   **And** no todo is created

### US-5.3 — Edit or clear a due date

#### Scenario: User sets a due date when editing a todo
*   **Given** I am signed in
*   **And** I have todo `Buy milk` with no due date
*   **When** I open the edit dialog
*   **And** I set due date `2026-07-20`
*   **And** I click **Save**
*   **Then** the API returns `200` with `dueDate` `2026-07-20`
*   **And** the row shows the new due date

#### Scenario: User clears a due date when editing a todo
*   **Given** I am signed in
*   **And** I have todo `Buy milk` with due date `2026-07-20`
*   **When** I open the edit dialog
*   **And** I clear the due date field
*   **And** I click **Save**
*   **Then** the API returns `200` with `dueDate` null
*   **And** the row no longer shows a due date

#### Scenario: API rejects an invalid due date on update
*   **Given** I am signed in as user A
*   **And** I own todo `Buy milk`
*   **When** I send `PUT /todo/todos/:id` with body `{ "dueDate": "2026-99-99" }`
*   **Then** the API returns `400` with `{ "message": "..." }`
*   **And** the stored `dueDate` is unchanged

#### Scenario: User cannot set due date on another user's todo
*   **Given** I am signed in as user A
*   **And** a todo exists that belongs to user B
*   **When** I send `PUT /todo/todos/:id` with body `{ "dueDate": "2026-07-15" }`
*   **Then** the API returns `404` with `{ "message": "Todo with id=<id> not found." }`
*   **And** user B's todo is unchanged

### US-5.4 — Spot overdue todos

#### Scenario: Incomplete todo past due date is styled as overdue
*   **Given** I am signed in
*   **And** I have opened the items dialog for a list containing an incomplete todo with `dueDate` yesterday
*   **When** the todos are displayed
*   **Then** the due date is displayed with overdue styling

#### Scenario: Completed todo past due date is not styled as overdue
*   **Given** I am signed in
*   **And** I have opened the items dialog for a list containing a completed todo with `dueDate` yesterday
*   **When** the todos are displayed
*   **Then** the due date does not use overdue styling

---

## Test Coverage Map

Each scenario above must map to at least one automated test.

| Story | Scenario | Test file | Test name |
|-------|----------|-----------|-----------|
| US-5.1 | User adds a todo with a due date | `backend/tests/todos.test.js`, `frontend/tests/Dashboard.test.js` | `User adds a todo with a due date` |
| US-5.1 | User adds a todo without a due date | `backend/tests/todos.test.js` | `User adds a todo without a due date` |
| US-5.1 | API rejects an invalid due date on create | `backend/tests/todos.test.js` | `API rejects an invalid due date on create` |
| US-5.3 | User sets a due date when editing a todo | `backend/tests/todos.test.js`, `frontend/tests/Dashboard.test.js` | `User sets a due date when editing a todo` |
| US-5.3 | User clears a due date when editing a todo | `backend/tests/todos.test.js`, `frontend/tests/Dashboard.test.js` | `User clears a due date when editing a todo` |
| US-5.3 | API rejects an invalid due date on update | `backend/tests/todos.test.js` | `API rejects an invalid due date on update` |
| US-5.3 | User cannot set due date on another user's todo | `backend/tests/todos.test.js` | `User cannot set due date on another user's todo` |
| US-5.4 | Incomplete todo past due date is styled as overdue | `frontend/tests/Dashboard.test.js` | `Incomplete todo past due date is styled as overdue` |
| US-5.4 | Completed todo past due date is not styled as overdue | `frontend/tests/Dashboard.test.js` | `Completed todo past due date is not styled as overdue` |

---

## Agent implementation request

Copy when asking Cursor to implement this feature (`@` this file):

```text
Implement Feature 5 from @features/feature-5-todo-due-date.md on branch `feature/5-todo-due-date`.

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
*   [ ] `features/reference/data-model.md` updated
*   [ ] `features/reference/api.md` updated
*   [ ] `features/reference/behavior.md` updated (if product rules changed)

---

## Out of Scope

*   Sorting or filtering todos by due date
*   Due date on quick-add without opening edit dialog (optional field on add row is in scope; separate due-date-only modal is not)
*   Reminders, notifications, or email alerts
*   Recurring todos
*   Time-of-day or timezone handling (date-only)
*   Calendar or agenda views
*   Changes to lists, profile, or auth (Features 2, 4)
