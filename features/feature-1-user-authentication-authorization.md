# Feature: User Authentication & Authorization

**Feature ID:** 1  
**Branch pattern:** `feature/1-user-authentication-authorization`  
**Status:** Shipped  
**Created:** 2026-10-26  
**Input:** Allow OC users to sign in with Google and enforce their application roles and sessions.  

---

## User Stories

### US-1.1: Sign in with an OC Google account

**As a** requestor  
**I want to** sign in using my OC Google account  
**So that** I can use the vehicle reservation system without a separate password

**Priority:** P1  
**Independent test:** Submit a verified OC Google credential and receive one local user and a usable application session.  
**Acceptance scenarios:** see ### US-1.1 under Acceptance Criteria

### US-1.2: Keep a valid application session

**As a** signed-in user  
**I want to** stay signed in while my session is valid  
**So that** I can move between protected screens

**Priority:** P1  
**Independent test:** Use the Bearer session on /auth/me and test valid, expired, tampered, and deleted-user sessions.  
**Acceptance scenarios:** see ### US-1.2 under Acceptance Criteria

### US-1.3: Enforce application roles

**As a** system administrator  
**I want** the server to enforce application roles  
**So that** users cannot gain permissions by changing client data

**Priority:** P1  
**Independent test:** Use test-only routes to exercise allowed and forbidden roles without introducing product endpoints.  
**Acceptance scenarios:** see ### US-1.3 under Acceptance Criteria

### US-1.4: Sign out

**As a** signed-in user  
**I want to** end my current application session  
**So that** the browser and its old token cannot keep accessing the system

**Priority:** P1  
**Independent test:** Sign out, confirm the session is removed, and reuse the old token to receive 401.  
**Acceptance scenarios:** see ### US-1.4 under Acceptance Criteria

### US-1.5: Bootstrap the initial administrator

**As a** system administrator  
**I want** an initial administrator to be provisioned safely  
**So that** the first person who signs in does not automatically control the application

**Priority:** P1  
**Independent test:** Provision an explicit OC email through a local command and verify that only its Google identity links to the admin record.  
**Acceptance scenarios:** see ### US-1.5 under Acceptance Criteria

## Requirements

### Functional Requirements

* **FR-001:** Users MUST sign in through Google using OC credentials. This feature MUST NOT add password login, password registration, or password reset.
* **FR-002:** The backend MUST verify the Google credential signature, issuer, audience against GOOGLE_CLIENT_ID, expiry, and verified email before accepting identity. The signed hosted-domain claim and the email domain MUST each exactly match oc.edu or eagles.oc.edu; suffix lookalikes and other domains MUST be rejected.
* **FR-003:** Missing credentials MUST return 400; invalid credentials MUST return 401; unverified or non-OC identities MUST return 403, using the messages in API Requirements.
* **FR-004:** A first verified OC sign-in MUST create exactly one local user with role requestor; identity and role fields in the request body MUST NOT override verified Google fields or the assigned default role.
* **FR-005:** An existing Google subject MUST reuse the existing local user. A previously provisioned email with null googleSub MUST link to that subject without overwriting local names or role. Conflicting existing identities MUST return 409 without changes.
* **FR-006:** The user role MUST be one of admin, area_admin, requestor, or maintenance. The server MUST load the current user and role from the database for each authenticated request and provide req.user with id, role, and areaId. areaId MUST be null until Feature 2 introduces the area relationship, then MUST come from the current user record rather than client data or token claims.
* **FR-007:** Login MUST return the flat payload in API Requirements, containing an application session token and no Google credential, OAuth refresh token, or secret.
* **FR-008:** Application sessions MUST use a signed JWT stored in sessions and sent in Authorization: Bearer. JWT expiry and expirationDate MUST match a 24-hour lifetime.
* **FR-009:** Login MUST reuse an existing unexpired, valid application session for that user; otherwise it MUST issue a new session. Expired or invalid stored tokens MUST NOT become valid again.
* **FR-010:** Missing, malformed, expired, tampered, unknown-session, or deleted-user application tokens MUST return 401 with { "message": "Unauthorized." }.
* **FR-011:** GET /auth/me MUST return the current account fields without a token, and MUST require an authenticated session.
* **FR-012:** Role middleware MUST permit only the roles a feature allows. Authenticated disallowed roles MUST return 403 with { "message": "Forbidden." }; client role changes MUST NOT grant server access.
* **FR-013:** The Login screen MUST contain a Google sign-in button and no local password fields. A cancelled Google prompt MUST leave the user signed out and send no login request.
* **FR-014:** The frontend MUST store a successful login response as localStorage key user using Utils and navigate to Home. The primary signed-in heading MUST be Vehicle Reservations.
* **FR-015:** The frontend MUST show a loading indicator and suppress duplicate login requests until the current request completes. Failed login MUST display the API message or the documented fallback without storing a session.
* **FR-016:** Signed-out navigation to protected screens MUST open /login. On navigation with a stored token the frontend MUST validate /auth/me before displaying protected content and merge returned account fields without losing the token.
* **FR-017:** A 401 response MUST clear stored authentication and return to /login. A 403 response MUST display the denial without signing the user out. A failed session check MUST show its fallback and Retry while keeping protected content hidden.
* **FR-018:** Sign out MUST delete the presented session only. Successful logout or an already-invalid-session response MUST clear local authentication and open /login. Other failures MUST retain the session and permit retry.
* **FR-019:** An operator command MUST provision the initial admin for an explicit OC email and names. No first-login rule MUST grant admin. Re-running the seed MUST leave an existing admin unchanged and MUST NOT promote an existing non-admin.
* **FR-020:** Login user/session writes MUST be atomic. Provider outages MUST return 503 and storage failures MUST return 500 using the documented messages; no partial user or session MUST be committed.
* **FR-021:** Google client configuration and AUTH_SECRET MUST come from environment configuration. Secrets and Google credentials MUST NOT be returned to other users or written to application logs.

## Assumptions

* Google sign-in supersedes the starter rules that illustrate username/password login and a worker role. The Google-auth handout specifies an Internal OC Google client and a local User/Session model. Update auth-patterns.mdc to match this contract during Feature 1 implementation.
* Only OC Google accounts may sign in. The approved hosted domains and email domains are oc.edu and eagles.oc.edu, compared case-insensitively by exact match; arbitrary Google accounts and suffix lookalikes are not allowed.
* A first-time verified OC user is created as requestor. An existing provisioned account keeps its assigned role when linked to the verified Google identity.
* The four application roles are admin, area_admin, requestor, and maintenance. The first admin is provisioned explicitly through the operator seed command, never by promoting the first person who signs in.
* Names and email are taken from verified Google claims at initial creation. A missing given_name or family_name becomes an empty string, not invented personal data. Subsequent profile editing belongs to Feature 3; this feature does not depend on it.
* For a linked identity, email remains the local verified email; automatic Google email-renaming and account merging are deferred.
* Backend tests stub Google credential verification; they do not need real Google credentials or network access. Role checks use test-only routes, not product probe endpoints.


## Edge Cases

* Expired Google credentials are rejected even if a browser has cached them.
* A valid Google identity must not claim a different linked local user via email.
* A server session without a corresponding user cannot authenticate.
* A client-supplied role does not change the persisted role.
* Cancellation, duplicate submissions, provider outages, session-check failures, and logout failures have the behavior shown in the scenarios.


## Success Criteria

* **SC-001:** Every login acceptance case produces the specified response without duplicate accounts or unexpected privilege changes.
* **SC-002:** Valid sessions work for 24 hours and revoked or invalid sessions cannot access protected routes.
* **SC-003:** All four roles are evaluated from the current database row, and all mapped unauthorized cases fail.
* **SC-004:** Login, protected navigation, error recovery, and sign-out match the Screen Requirements in frontend tests and a manual browser check.
* **SC-005:** Every acceptance scenario has an exact-name test before the feature is marked complete.


## Data Ownership & Isolation

* Each Google subject identifies one local user; each session belongs to that user.
* Authentication supplies each protected route with req.user containing id, role, and areaId. This feature supplies null areaId while no area relationship exists; Feature 2 populates it from the database after introducing that relationship. Resource features enforce their own area and ownership rules using this context.
* No user may submit a local account ID, email, or role to select another identity.
* /auth/me exposes the caller’s account only; role helpers do not create resource-management endpoints.


## Key Entities

* **User:** a local account linked to an OC Google identity, with names, email, and an application role.
* **Session:** a time-limited application token belonging to one User. It is distinct from the Google credential.


## API Requirements

All paths are under `/vehicle-t6`; failures use `{ "message": "..." }`.

| Method | Endpoint | Auth | Request | Success |
|--------|----------|------|---------|---------|
| POST | `/vehicle-t6/login` | Verified Google credential | `{ "credential": "<Google ID token>" }` | `200`, login payload below |
| GET | `/vehicle-t6/auth/me` | Bearer session | None | `200`, account payload below |
| POST | `/vehicle-t6/logout` | Bearer session | None | `200`, `{ "message": "Signed out." }` |

Login response: `{ "userId": 1, "email": "user@oc.edu", "firstName": "Avery", "lastName": "Reed", "role": "requestor", "areaId": null, "token": "<application JWT>" }`.
Account response: the same account fields with no `token`. This deliberately replaces the username/fName/lName example in auth-patterns.mdc because Google authentication has no local username.

Both responses include areaId from the start: null before Feature 2, then the current area-admin assignment after Feature 2 adds users.areaId. Admin, requestor, and maintenance accounts remain unassigned with areaId null; Feature 3 requires exactly one area for an area_admin account. The protected-route context always has `{ id, role, areaId }`; an absent area relationship never removes the areaId property. Feature 1 has no dependency on an Area table or assignment UI.

| Condition | Status | Message |
|-----------|--------|---------|
| Missing, empty, or non-string credential | 400 | `Google credential is required.` |
| Invalid Google signature, issuer, audience, or expiry | 401 | `Google sign-in failed.` |
| Unverified email or domain not approved | 403 | `Use your OC Google account.` |
| Conflicting subject/email links | 409 | `Google account could not be linked.` |
| Google verification unavailable | 503 | `Google sign-in is unavailable. Try again.` |
| Login storage failure | 500 | `Sign-in could not be completed.` |
| No valid application session, including logout | 401 | `Unauthorized.` |
| Authenticated role not permitted | 403 | `Forbidden.` |
| Session lookup failure | 500 | `Session could not be checked.` |
| Logout storage failure | 500 | `Sign-out could not be completed. Try again.` |

The initial-admin seed is an operator command, not an HTTP endpoint. Its only inputs are admin email and names; Google verifies that identity when it first signs in.


## Screen Requirements

* **Login** — `/login`, route name `login`: heading **Sign in**, Google sign-in button. No local username/password or register controls. A pending exchange shows progress and suppresses resubmission. Cancellation leaves this screen unchanged. If the Google sign-in script does not load within a few seconds, the screen shows `Google sign-in could not be loaded. Reload the page.` in place of the button.
* **Home** — `/`, route name `home`: heading **Vehicle Reservations**, signed-in email, and a **Sign out** action in MenuBar. Resource links are introduced by their owning features.
* A successful login stores its flat response with Utils; API calls attach its token through the existing axios service pattern.
* Protected navigation waits for `/auth/me`. A failed check hides protected content and displays `Session could not be checked.` and **Retry**; retry repeats that check. A 401 clears the store and opens Login.
* Login failures show the API message, or `Sign-in could not be completed.` if none is available. Forbidden responses show `Forbidden.` without discarding the session.
* Sign out calls the API. A success or 401 clears the store and opens Login; a network or server failure shows `Sign-out could not be completed. Try again.` and keeps the session for another attempt.


## Data Model Requirements

`users`:

| Field | Type | Rule |
|-------|------|------|
| id | Integer | Auto-generated primary key |
| googleSub | String(255), nullable | Unique when set; obtained only from verified Google claims; null for provisioned accounts |
| email | String(254) | Required, unique, trimmed and lowercase; verified OC identity |
| firstName | String(100) | Required column; empty string allowed when Google omits the name |
| lastName | String(100) | Required column; empty string allowed when Google omits the name |
| role | Enum | `admin`, `area_admin`, `requestor`, `maintenance`; default `requestor` |

`sessions`:

| Field | Type | Rule |
|-------|------|------|
| id | Integer | Auto-generated primary key |
| token | String(1024) | Required, unique, signed application JWT |
| email | String(254) | Verified local email at session creation |
| expirationDate | Date/time | UTC; matches JWT expiry |
| userId | Integer | Required foreign key to users.id; sessions deleted with their user |

Register User hasMany Session and Session belongsTo User in models/index.js. Feature 1 does not create an Area table or users.areaId column: its account responses and authenticated context return areaId as null. Feature 2 adds the nullable column and foreign key, after which these existing contracts expose the current stored value. Exclude googleSub and session rows from account representations; only login may return its application token. JWT signing uses AUTH_SECRET; Google verification uses GOOGLE_CLIENT_ID. Seed inputs are ADMIN_EMAIL, ADMIN_FIRST_NAME, and ADMIN_LAST_NAME. The frontend’s public Google client ID must match the backend audience.

## Acceptance Criteria (Gherkin)

### US-1.1 — Sign in with an OC Google account

#### Scenario: New OC user signs in
* **Given** Google verification returns a new subject, a verified OC email, and names
* **When** the client posts its credential to /vehicle-t6/login
* **Then** the response is 200 with the flat login payload including areaId null and the new user has role requestor
* **And** exactly one user and one valid application session are stored

#### Scenario: Existing OC user signs in
* **Given** a local user is linked to the verified Google subject
* **When** the same Google identity signs in again
* **Then** the same userId and stored role are returned without a second user

#### Scenario: Provisioned OC user links the first Google sign-in
* **Given** a local user has the verified OC email, a stored role, and no googleSub
* **When** that user signs in with the matching verified Google email
* **Then** googleSub is attached to the existing user without replacing the stored role or names

#### Scenario: Google subject cannot claim another local email
* **Given** a verified subject belongs to one user and its supplied email belongs to a different local user
* **When** that subject signs in
* **Then** the response is 409 with message Google account could not be linked. and neither user is changed

#### Scenario: Missing Google credential is rejected
* **Given** no Google credential is supplied
* **When** POST /vehicle-t6/login is sent
* **Then** the response is 400 with message Google credential is required. and no user or session is created

#### Scenario: Invalid Google credentials are rejected
* **Given** a credential has a bad signature, wrong issuer, wrong audience, or expired expiry
* **When** POST /vehicle-t6/login is sent for each invalid credential
* **Then** each response is 401 with message Google sign-in failed. and no user or session is created

#### Scenario: Non-OC Google account is rejected
* **Given** Google verification succeeds but the hosted domain or email domain is outside oc.edu and eagles.oc.edu, including a suffix lookalike such as oc.edu.example.org
* **When** that credential is submitted
* **Then** the response is 403 with message Use your OC Google account. and no user or session is created

#### Scenario: Unverified Google email is rejected
* **Given** Google verification returns email_verified as false
* **When** the credential is submitted
* **Then** the response is 403 with message Use your OC Google account. and no user or session is created

#### Scenario: Client cannot choose a role or identity
* **Given** a valid new OC credential is submitted with forged role admin, userId, and email fields
* **When** the login request is processed
* **Then** the user is created as requestor using verified Google identity fields only

#### Scenario: Google verification unavailable is reported
* **Given** Google verification cannot complete because the provider cannot be reached
* **When** a credential is submitted
* **Then** the response is 503 with message Google sign-in is unavailable. Try again. and no account is created

#### Scenario: Login storage failure is reported
* **Given** verified identity data is valid but the database operation fails
* **When** the user signs in
* **Then** the response is 500 with message Sign-in could not be completed. and no partial user or session is committed

#### Scenario: Google sign-in button opens the OC sign-in flow
* **Given** the visitor opens /login
* **When** the login page finishes loading
* **Then** the heading Sign in and Google sign-in button appear with no password or registration fields

#### Scenario: Successful sign-in stores the session and opens Home
* **Given** Google returns a credential and the login API returns 200
* **When** the sign-in flow completes
* **Then** the response is stored as localStorage user through Utils and the Home page shows Vehicle Reservations and Sign out

#### Scenario: Cancelled Google sign-in leaves the user signed out
* **Given** a visitor starts Google sign-in
* **When** the visitor cancels the Google prompt
* **Then** the visitor stays on Sign in and no login API request or stored session is created

#### Scenario: Login errors are displayed without a stored session
* **Given** the login API returns a message or fails without one
* **When** the sign-in attempt completes
* **Then** the page displays that API message or Sign-in could not be completed. and stores no session

#### Scenario: Repeated sign-in is blocked while a request is pending
* **Given** a Google credential exchange is waiting for the login API
* **When** the visitor tries to submit it again
* **Then** a loading indicator remains visible and only one login request is sent

#### Scenario: Authentication logs exclude credentials and secrets
* **Given** Google credentials, application tokens, and environment secrets are present in a login or logout attempt
* **When** successful and failed authentication operations write application logs
* **Then** no log contains those credentials, tokens, or secret values

#### Scenario: Missing Google name claims do not invent personal data
* **Given** a verified new OC identity omits given_name or family_name
* **When** the identity signs in
* **Then** the user and login payload use an empty string for each missing name without inventing values

### US-1.2 — Keep a valid application session

#### Scenario: Valid session returns the current account
* **Given** a signed-in user has a non-expired application session
* **When** GET /vehicle-t6/auth/me carries that Bearer token
* **Then** the response is 200 with userId, email, firstName, lastName, the current database role, and areaId null before Feature 2, without a Google credential or token

#### Scenario: Valid session is reused on sign-in
* **Given** the same user already has a valid signed application session
* **When** the user signs in through Google again
* **Then** the existing token and expiry are reused instead of creating another session

#### Scenario: Expired session is replaced on sign-in
* **Given** the user has only expired sessions
* **When** a valid Google sign-in completes
* **Then** a new signed session expires 24 hours after creation and old expired tokens remain unusable

#### Scenario: Missing or invalid application session is rejected
* **Given** a request has no Bearer token, a malformed token, a tampered token, an expired token, or no matching session row
* **When** GET /vehicle-t6/auth/me is called for each case
* **Then** each response is 401 with message Unauthorized.

#### Scenario: Deleted user session cannot authenticate
* **Given** a session row exists but its user has been deleted
* **When** GET /vehicle-t6/auth/me uses that token
* **Then** the response is 401 with message Unauthorized.

#### Scenario: Role is read from the database on every request
* **Given** a valid token was issued before the user role changed in the database
* **When** GET /vehicle-t6/auth/me is requested
* **Then** the new database role is used instead of a token claim or localStorage role

#### Scenario: Protected navigation validates a stored session
* **Given** localStorage user contains a token
* **When** the user refreshes Home or opens another protected route
* **Then** GET /auth/me validates it before protected content appears and preserves the token while updating account fields

#### Scenario: Signed-out navigation opens Sign in
* **Given** localStorage has no user
* **When** the visitor opens /
* **Then** the router opens /login without showing protected content

#### Scenario: Unauthorized API response clears local authentication
* **Given** a protected request returns 401
* **When** the response is handled
* **Then** localStorage user is removed and the router opens /login

#### Scenario: Session check unavailable does not render protected content
* **Given** the initial GET /auth/me returns a network error or 500
* **When** a protected page is being opened
* **Then** the page displays Session could not be checked. and Retry without clearing the stored token or displaying protected content

#### Scenario: Session check retry restores protected navigation
* **Given** the first session check failed and the next response is 200
* **When** the user chooses Retry
* **Then** the account is refreshed and the requested protected content appears

#### Scenario: Unexpired invalid stored session is replaced
* **Given** a user has an unexpired session row whose stored JWT fails signature verification
* **When** a valid Google login completes
* **Then** a fresh valid application session is returned and the old token still receives 401 on /auth/me

#### Scenario: Session lookup storage failure returns a safe error
* **Given** the session lookup encounters a database failure
* **When** GET /vehicle-t6/auth/me is called with a token
* **Then** the response is 500 with message Session could not be checked. and no authentication state is changed

### US-1.3 — Enforce application roles

#### Scenario: Stored role controls access to a role-protected endpoint
* **Given** a valid user has one of admin, area_admin, requestor, or maintenance
* **When** a test-only route allows that role
* **Then** the request proceeds with req.user containing the database user id and role, and an areaId property set to null before Feature 2

#### Scenario: Disallowed role receives Forbidden
* **Given** a user has a valid session but the test-only route does not allow their role
* **When** the protected request is sent
* **Then** the response is 403 with message Forbidden. and the protected operation is not run

#### Scenario: Forged local role grants no server permissions
* **Given** a requestor changes the stored client role to admin
* **When** the client sends a request to an admin-only test route
* **Then** the response is 403 with message Forbidden.

#### Scenario: Forbidden response keeps the session
* **Given** a protected API returns 403 with message Forbidden.
* **When** the client handles the response
* **Then** the user sees Forbidden. and remains signed in

### US-1.4 — Sign out

#### Scenario: Sign-out invalidates the current session
* **Given** a user has a valid session
* **When** POST /vehicle-t6/logout uses its Bearer token
* **Then** the response is 200 with message Signed out. and that session is deleted
* **And** the token subsequently returns 401 on /auth/me

#### Scenario: Sign-out does not end other sessions
* **Given** two users have valid sessions
* **When** one user signs out
* **Then** only the session presented to logout is deleted

#### Scenario: Expired session at sign-out clears the browser
* **Given** the logout API returns 401 for an already expired session
* **When** the user chooses Sign out
* **Then** localStorage user is removed and Sign in appears

#### Scenario: Successful sign-out clears the browser
* **Given** the logout API returns 200
* **When** the user chooses Sign out
* **Then** localStorage user is removed and Sign in appears

#### Scenario: Sign-out failure permits a retry
* **Given** the logout API returns 500 or a network error
* **When** the user chooses Sign out
* **Then** the session remains stored and the page displays Sign-out could not be completed. Try again.

#### Scenario: Logout storage failure preserves the session
* **Given** a user has a valid session but its deletion fails
* **When** POST /vehicle-t6/logout uses the token
* **Then** the response is 500 with message Sign-out could not be completed. Try again. and the stored session is preserved

### US-1.5 — Bootstrap the initial administrator

#### Scenario: Initial administrator is provisioned explicitly
* **Given** the operator supplies a verified-format OC admin email and nonblank first and last names
* **When** the admin seed command is run against an empty user table
* **Then** one admin user with no linked googleSub is created without a password

#### Scenario: Admin seed is idempotent without promoting users
* **Given** the requested email already exists
* **When** the admin seed command is run again
* **Then** an existing admin is left unchanged and an existing non-admin causes a failure without a role change

#### Scenario: Invalid admin seed input creates nothing
* **Given** an admin seed value is missing or its email is outside the approved OC domains
* **When** the seed command is run
* **Then** it exits unsuccessfully and creates or changes no user

## Test Coverage Map

Each scenario below must have an automated test with the exact scenario title. Frontend tests mock the API and Google sign-in; backend tests mock Google verification rather than contacting Google.

| Story | Scenario | Test file | Test name |
|-------|----------|-----------|-----------|
| US-1.1 | New OC user signs in | `backend/tests/auth.test.js` | `it("New OC user signs in")` |
| US-1.1 | Existing OC user signs in | `backend/tests/auth.test.js` | `it("Existing OC user signs in")` |
| US-1.1 | Provisioned OC user links the first Google sign-in | `backend/tests/auth.test.js` | `it("Provisioned OC user links the first Google sign-in")` |
| US-1.1 | Google subject cannot claim another local email | `backend/tests/auth.test.js` | `it("Google subject cannot claim another local email")` |
| US-1.1 | Missing Google credential is rejected | `backend/tests/auth.test.js` | `it("Missing Google credential is rejected")` |
| US-1.1 | Invalid Google credentials are rejected | `backend/tests/auth.test.js` | `it("Invalid Google credentials are rejected")` |
| US-1.1 | Non-OC Google account is rejected | `backend/tests/auth.test.js` | `it("Non-OC Google account is rejected")` |
| US-1.1 | Unverified Google email is rejected | `backend/tests/auth.test.js` | `it("Unverified Google email is rejected")` |
| US-1.1 | Client cannot choose a role or identity | `backend/tests/auth.test.js` | `it("Client cannot choose a role or identity")` |
| US-1.1 | Google verification unavailable is reported | `backend/tests/auth.test.js` | `it("Google verification unavailable is reported")` |
| US-1.1 | Login storage failure is reported | `backend/tests/auth.test.js` | `it("Login storage failure is reported")` |
| US-1.1 | Google sign-in button opens the OC sign-in flow | `frontend/tests/Login.test.js` | `it("Google sign-in button opens the OC sign-in flow")` |
| US-1.1 | Successful sign-in stores the session and opens Home | `frontend/tests/Login.test.js` | `it("Successful sign-in stores the session and opens Home")` |
| US-1.1 | Cancelled Google sign-in leaves the user signed out | `frontend/tests/Login.test.js` | `it("Cancelled Google sign-in leaves the user signed out")` |
| US-1.1 | Login errors are displayed without a stored session | `frontend/tests/Login.test.js` | `it("Login errors are displayed without a stored session")` |
| US-1.1 | Repeated sign-in is blocked while a request is pending | `frontend/tests/Login.test.js` | `it("Repeated sign-in is blocked while a request is pending")` |
| US-1.1 | Authentication logs exclude credentials and secrets | `backend/tests/auth.test.js` | `it("Authentication logs exclude credentials and secrets")` |
| US-1.1 | Missing Google name claims do not invent personal data | `backend/tests/auth.test.js` | `it("Missing Google name claims do not invent personal data")` |
| US-1.2 | Valid session returns the current account | `backend/tests/auth.test.js` | `it("Valid session returns the current account")` |
| US-1.2 | Valid session is reused on sign-in | `backend/tests/auth.test.js` | `it("Valid session is reused on sign-in")` |
| US-1.2 | Expired session is replaced on sign-in | `backend/tests/auth.test.js` | `it("Expired session is replaced on sign-in")` |
| US-1.2 | Missing or invalid application session is rejected | `backend/tests/auth.test.js` | `it("Missing or invalid application session is rejected")` |
| US-1.2 | Deleted user session cannot authenticate | `backend/tests/auth.test.js` | `it("Deleted user session cannot authenticate")` |
| US-1.2 | Role is read from the database on every request | `backend/tests/auth.test.js` | `it("Role is read from the database on every request")` |
| US-1.2 | Protected navigation validates a stored session | `frontend/tests/Login.test.js` | `it("Protected navigation validates a stored session")` |
| US-1.2 | Signed-out navigation opens Sign in | `frontend/tests/Login.test.js` | `it("Signed-out navigation opens Sign in")` |
| US-1.2 | Unauthorized API response clears local authentication | `frontend/tests/Login.test.js` | `it("Unauthorized API response clears local authentication")` |
| US-1.2 | Session check unavailable does not render protected content | `frontend/tests/Login.test.js` | `it("Session check unavailable does not render protected content")` |
| US-1.2 | Session check retry restores protected navigation | `frontend/tests/Login.test.js` | `it("Session check retry restores protected navigation")` |
| US-1.2 | Unexpired invalid stored session is replaced | `backend/tests/auth.test.js` | `it("Unexpired invalid stored session is replaced")` |
| US-1.2 | Session lookup storage failure returns a safe error | `backend/tests/auth.test.js` | `it("Session lookup storage failure returns a safe error")` |
| US-1.3 | Stored role controls access to a role-protected endpoint | `backend/tests/auth.test.js` | `it("Stored role controls access to a role-protected endpoint")` |
| US-1.3 | Disallowed role receives Forbidden | `backend/tests/auth.test.js` | `it("Disallowed role receives Forbidden")` |
| US-1.3 | Forged local role grants no server permissions | `backend/tests/auth.test.js` | `it("Forged local role grants no server permissions")` |
| US-1.3 | Forbidden response keeps the session | `frontend/tests/Login.test.js` | `it("Forbidden response keeps the session")` |
| US-1.4 | Sign-out invalidates the current session | `backend/tests/auth.test.js` | `it("Sign-out invalidates the current session")` |
| US-1.4 | Sign-out does not end other sessions | `backend/tests/auth.test.js` | `it("Sign-out does not end other sessions")` |
| US-1.4 | Expired session at sign-out clears the browser | `frontend/tests/Login.test.js` | `it("Expired session at sign-out clears the browser")` |
| US-1.4 | Successful sign-out clears the browser | `frontend/tests/Login.test.js` | `it("Successful sign-out clears the browser")` |
| US-1.4 | Sign-out failure permits a retry | `frontend/tests/Login.test.js` | `it("Sign-out failure permits a retry")` |
| US-1.4 | Logout storage failure preserves the session | `backend/tests/auth.test.js` | `it("Logout storage failure preserves the session")` |
| US-1.5 | Initial administrator is provisioned explicitly | `backend/tests/auth.test.js` | `it("Initial administrator is provisioned explicitly")` |
| US-1.5 | Admin seed is idempotent without promoting users | `backend/tests/auth.test.js` | `it("Admin seed is idempotent without promoting users")` |
| US-1.5 | Invalid admin seed input creates nothing | `backend/tests/auth.test.js` | `it("Invalid admin seed input creates nothing")` |

## Agent implementation request

Copy when asking Cursor to implement this feature (`@` this file):

```text
Implement Feature 1 from @features/feature-1-user-authentication-authorization.md on branch `feature/1-user-authentication-authorization`.

Follow layer order in @features/framework.md (models → routes → backend tests → frontend → frontend tests).
Update @.cursor/rules/auth-patterns.mdc to match this feature's Google sign-in, account fields, four roles, and id/role/areaId request context.
Map every Gherkin scenario in the Test Coverage Map; run `npm test` before finishing.
If API routes, payloads, schema, or product rules changed per this spec, update @features/reference/api.md, @features/reference/data-model.md, and/or @features/reference/behavior.md in the same PR to match shipped code.
Complete Definition of Done and the merge checklist in @features/framework.md.
Do not implement behavior not in this spec.
```

**Reference updates for this feature:** `api.md`, `data-model.md`, `behavior.md`.

## Definition of Done

* [x] Backend and frontend implemented per this spec (**FR-001**–**FR-021** satisfied)
* [x] **Success Criteria (SC-001**–**SC-005)** met
* [x] All mapped tests pass (`npm test`)
* [x] Test Coverage Map complete
* [x] `features/reference/data-model.md` updated (if schema changed)
* [x] `features/reference/api.md` updated (if API changed)
* [x] `features/reference/behavior.md` updated (if product rules changed)


## Out of Scope

* Local passwords, username registration, password resets, Google Calendar access, account merging, and Google profile synchronization.
* Area records and area assignments: [Feature 2 — Area Management](feature-2-area-management.md) introduces Area and the area relationship; [Feature 3 — User Management](feature-3-user-management.md) maintains assignments. These are downstream work, not dependencies of this feature.
* Resource-specific permissions, vehicle CRUD, reservation workflows, and sending emails belong to their owners in the [feature catalog](README.md#feature-catalog); this feature supplies authentication and role helpers only.
