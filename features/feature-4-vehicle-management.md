# Feature: Vehicle Management

**Feature ID:** 4  
**Branch pattern:** `feature/4-vehicle-management`  
**Status:** Implemented  
**Created:** 2026-10-27  
**Input:** Allow admins and area admins to maintain the OC fleet. A vehicle has make, model, year, VIN, purchased date, color, passenger count, plate number, plate expire month, designated parking, and an assigned area. Make and model come from a standard combo-box list.  
**Depends on:** [Feature 1 — User Authentication & Authorization](feature-1-user-authentication-authorization.md), [Feature 2 — Area Management](feature-2-area-management.md)

---

## User Stories

Every story is P1: each one must ship for the assignment’s Vehicle Management feature.

### US-4.1: View vehicles

**As a** fleet administrator  
**I want to** see the vehicles I am allowed to manage  
**So that** I know what is in the fleet for my areas

**Priority:** P1  
**Independent test:** Sign in as admin and as area_admin, list vehicles, and verify the admin sees every vehicle while the area admin sees only vehicles for its assigned area  
**Acceptance scenarios:** see ### US-4.1 under Acceptance Criteria

### US-4.2: Add a vehicle

**As a** fleet administrator  
**I want to** add a vehicle with the required fleet fields and an area  
**So that** the vehicle can later be assigned to a reservation

**Priority:** P1  
**Independent test:** Create a valid vehicle as admin and as area_admin, verify saved fields and area rules, and reject requestor and maintenance creates  
**Acceptance scenarios:** see ### US-4.2 under Acceptance Criteria

### US-4.3: Edit a vehicle

**As a** fleet administrator  
**I want to** update a vehicle’s details and area  
**So that** fleet records stay accurate

**Priority:** P1  
**Independent test:** Update an in-scope vehicle and reject an area admin changing a vehicle outside its assigned area  
**Acceptance scenarios:** see ### US-4.3 under Acceptance Criteria

### US-4.4: Delete a vehicle

**As a** fleet administrator  
**I want to** remove a vehicle that is not in use  
**So that** obsolete vehicles leave the fleet list

**Priority:** P1  
**Independent test:** Delete an in-scope vehicle and reject deletion when the vehicle is out of scope  
**Acceptance scenarios:** see ### US-4.4 under Acceptance Criteria

## Requirements

### Functional Requirements

* **FR-001:** Vehicle management MUST reuse Feature 1 authentication and role checks and the Area records from Feature 2. It MUST NOT add another sign-in flow or area screen.
* **FR-002:** A vehicle MUST store make, model, year, vin, purchasedDate, color, passengers, plateNumber, plateExpireMonth, designatedParking, and areaId. The server MUST generate id. Request-body properties outside those fields MUST be ignored on create and update.
* **FR-003:** make and model MUST each be chosen from the standard lists in this spec. model MUST belong to the selected make. Values outside those lists MUST return 400.
* **FR-004:** year MUST be an integer from 1980 through the current calendar year plus one. passengers MUST be an integer from 1 through 15. plateExpireMonth MUST be an integer from 1 through 12. purchasedDate MUST be a calendar date in `YYYY-MM-DD` form.
* **FR-005:** vin, color, plateNumber, and designatedParking MUST be required nonblank strings after trimming outer spaces. vin MUST be stored uppercase, 1 to 17 letters or digits, and unique ignoring case. color, plateNumber, and designatedParking MUST keep their letter case after outer trimming. plateNumber MUST be at most 20 characters. designatedParking MUST be at most 200 characters and is the vehicle’s pickup parking location for later day-before emails.
* **FR-006:** areaId MUST be a positive integer for an existing Area. A missing area MUST return 404. An invalid areaId shape MUST return 400.
* **FR-007:** An admin MUST list, create, update, and delete any vehicle. An area_admin MUST list, create, update, and delete only vehicles whose areaId equals that user’s current database areaId. Requestor and maintenance MUST receive the Feature 1 403 response for every vehicle-management endpoint. Signed-out requests MUST receive the Feature 1 401 response.
* **FR-008:** Area scope MUST come from the current database user.areaId, not from URL queries, request bodies, token claims, or localStorage. An area_admin with null areaId MUST receive an empty list and MUST NOT create, update, or delete any vehicle.
* **FR-009:** An area_admin create or update MUST set or keep areaId equal to that user’s assigned area. A body areaId for a different area MUST return 403 without saving. An update or delete for a vehicle outside that area MUST return the same 404 used for a missing vehicle.
* **FR-010:** Vehicle lists for the caller’s allowed scope MUST sort by make ascending, then model ascending, then id ascending. An empty allowed result MUST be 200 with [].
* **FR-011:** Duplicate vin on create or update MUST return 409 without changing data. Keeping the same vin on the same record MUST be allowed.
* **FR-012:** PUT MUST replace the editable vehicle fields while preserving id. Route ids on PUT and DELETE MUST be positive safe integers; invalid ids MUST return 400 and missing or out-of-scope vehicles MUST return 404.
* **FR-013:** DELETE MUST return 200 with message `Vehicle deleted.` This feature MUST NOT create reservation, issue, or log tables.
* **FR-014:** GET `/vehicle-t6/vehicles/options` MUST return the standard make list and the models for each make. Only admin and area_admin MAY call it.
* **FR-015:** The Vehicles page MUST be available to admin and area_admin only. MenuBar MUST show Vehicles for those roles. Signed-out visitors MUST go to Login. Requestor and maintenance MUST be sent Home.
* **FR-016:** Add and Edit MUST use dialogs with the documented fields, Save, and Cancel. Make and model MUST be combo boxes filled from the options endpoint. Area MUST be a combo box of areas from Feature 2; an area_admin’s area field MUST be fixed to its assigned area and MUST NOT offer other areas.
* **FR-017:** Form validation MUST block invalid submissions before a write. Save MUST show progress, block duplicate submission, close on success, and refresh the list. Cancel MUST send no write and MUST discard unsaved values and errors. A failed save MUST keep the dialog values and show the API message or the specified fallback.
* **FR-018:** Deletion MUST use a confirmation dialog. Cancel MUST make no request. Confirming MUST show progress, block duplicate deletion, close and refresh on success, and keep the row and show an error on failure.
* **FR-019:** List loading MUST show progress. `No vehicles found.` MUST appear only after a successful empty response. A failed load MUST show the API message or fallback and MUST NOT claim the list is empty.
* **FR-020:** Database failures MUST return 500 `Vehicle request failed.` without SQL details or partial writes.

## Assumptions

* Make and model use the fixed standard lists in this feature. The team does not upload a manufacturer catalog file.
* Mileage logs and service logs belong to Feature 12. Issue reports belong to Feature 10. Assigning a vehicle to a reservation belongs to Feature 8.
* Admin manages the whole fleet. Area admin manages only vehicles for its one assigned area from Feature 2 / Feature 3.
* Requestor and maintenance do not use this management screen. Feature 12 may later let maintenance read vehicles for logging.
* VIN is the unique fleet identity. Plate numbers are required but are not unique in this feature.
* designatedParking is stored here so Feature 9 can name the parking spot in the day-before email. This feature does not send that email.

## Edge Cases

* An area admin with no area assignment sees an empty fleet and cannot write.
* A forged areaId in the body does not let an area admin place a vehicle in another area.
* Case variants of the same VIN do not create a second vehicle.
* Failed loading does not show `No vehicles found.`
* Failed saving or deletion keeps the current record on screen.

## Success Criteria

* **SC-001:** Create, list, update, delete, and options match the documented vehicle contract.
* **SC-002:** Admin and area-admin scope rules hold for every mapped acceptance case.
* **SC-003:** Invalid fields, unknown make/model pairs, missing areas, and duplicate VINs do not change data.
* **SC-004:** Dialog, loading, empty, error, and role-specific navigation cases have matching frontend tests and a manual check.
* **SC-005:** Every scenario has an exact-name test before merge.

## Data Ownership & Isolation

| Operation | admin | area_admin | requestor / maintenance |
|-----------|-------|------------|-------------------------|
| List | All vehicles | Vehicles for own areaId only | 403 |
| Options | Allowed | Allowed | 403 |
| Create | Any existing area | Own area only | 403 |
| Update | Any existing vehicle | Own-area vehicle only; otherwise 404 | 403 |
| Delete | Any vehicle | Own-area vehicle only; otherwise 404 | 403 |

Authentication and roles come from [Feature 1](feature-1-user-authentication-authorization.md). Areas come from [Feature 2](feature-2-area-management.md). No client-supplied role or area claim expands those permissions.

## Key Entities

* **Vehicle:** one OC fleet unit with make, model, year, VIN, purchase date, color, passenger count, plate data, designated parking, and one assigned Area.
* **Standard make/model lists:** the fixed combo-box values this feature validates and returns from the options endpoint.

## Standard make and model lists

These lists are the only allowed combo-box values for this feature.

| Make | Models |
|------|--------|
| Chevrolet | Express, Malibu, Silverado, Suburban, Tahoe |
| Ford | Escape, Explorer, F-150, Transit, Transit Connect |
| GMC | Savana, Sierra, Terrain, Yukon |
| Honda | Odyssey, Pilot |
| Jeep | Cherokee, Grand Cherokee, Wrangler |
| Nissan | Frontier, NV200, Pathfinder |
| Ram | 1500, ProMaster |
| Toyota | Camry, Highlander, Sienna, Tacoma |
| Club Car | Carryall, Onward |
| Other | Other |

## API Requirements

All endpoints reuse [Feature 1](feature-1-user-authentication-authorization.md) authentication. No GET-by-id endpoint is introduced.

| Method | Endpoint | Allowed role | Success |
|--------|----------|--------------|---------|
| GET | `/vehicle-t6/vehicles/options` | admin, area_admin | `200`, `{ "makes": [...], "modelsByMake": { ... } }` |
| GET | `/vehicle-t6/vehicles` | admin, area_admin | `200`, array of Vehicle objects in the caller’s scope |
| POST | `/vehicle-t6/vehicles` | admin, area_admin | `201`, new Vehicle object |
| PUT | `/vehicle-t6/vehicles/:id` | admin, or area_admin for an in-scope vehicle | `200`, updated Vehicle object |
| DELETE | `/vehicle-t6/vehicles/:id` | admin, or area_admin for an in-scope vehicle | `200`, `{ "message": "Vehicle deleted." }` |

POST/PUT body:

```json
{
  "make": "Ford",
  "model": "Transit",
  "year": 2022,
  "vin": "1FTBR1C80MKA12345",
  "purchasedDate": "2022-06-15",
  "color": "White",
  "passengers": 12,
  "plateNumber": "OC-4521",
  "plateExpireMonth": 8,
  "designatedParking": "Support Central lot, spot B3",
  "areaId": 1
}
```

Vehicle object: the body fields above plus generated `id`. `vin` is returned uppercase. Request-body properties outside those fields are ignored.

| Failure | Status | Message |
|---------|--------|---------|
| No valid session | 401 | Feature 1 `Unauthorized.` |
| Disallowed role or area_admin writing another area on create/update body | 403 | Feature 1 `Forbidden.` |
| Invalid field, make/model pair, date, month, year, passengers, or route id shape | 400 | `Invalid vehicle data.` for body fields; `Vehicle id must be a positive integer.` for a bad route id |
| Missing area on create/update | 404 | `Area with id=<id> not found.` |
| Missing or out-of-scope vehicle | 404 | `Vehicle with id=<id> not found.` |
| Duplicate VIN | 409 | `VIN is already in use.` |
| Other database failure | 500 | `Vehicle request failed.` |

## Screen Requirements

* `/vehicles`, route name `vehicles`, heading **Vehicles**. MenuBar shows **Vehicles** for admin and area_admin only. Signed-out users follow Feature 1 Login redirect. Requestor and maintenance are sent Home.
* List columns: **Make**, **Model**, **Year**, **Color**, **Passengers**, **Plate**, **Plate expires**, **Parking**, **Area**, and permitted **Actions**. Area shows the Feature 2 area name for `areaId`. The page uses only server-returned records.
* Admin and area_admin see **Add vehicle**, **Edit**, and **Delete** on rows in their allowed scope. An area_admin does not see other areas’ vehicles.
* Add/edit dialogs: **Add vehicle** or **Edit vehicle**; fields **Make**, **Model**, **Year**, **VIN**, **Purchased date**, **Color**, **Passengers**, **Plate number**, **Plate expire month**, **Designated parking**, and **Area**; buttons **Save** and **Cancel**. Make and model are combo boxes from `/vehicles/options`. Model options follow the selected make. Area options come from Feature 2; an area_admin’s Area control is fixed to its assigned area. Edit starts with the chosen row’s values. The client applies the same validity rules and uses `Invalid vehicle data.` when invalid.
* A pending save shows progress and disables repeated Save. Success closes the dialog and reloads the list. Failure keeps the values and shows the API message or `Vehicle could not be saved.`. Cancel sends no write and discards values and errors.
* **Delete vehicle** confirmation asks `Delete this vehicle?` and offers **Delete** and **Cancel**. Pending deletion suppresses resubmission. Failure keeps the dialog and row and shows the API message or `Vehicle could not be deleted.`; success closes it and refreshes the list.
* The list shows progress while loading and `No vehicles found.` only after a successful empty result. Load failure shows the API message or `Vehicles could not be loaded.` and no empty-state message.

## Data Model Requirements

Add `vehicles`:

| Field | Type | Rule |
|-------|------|------|
| id | Integer | Auto-generated primary key |
| make | String(40) | Required; one of the standard makes |
| model | String(40) | Required; one of the standard models for that make |
| year | Integer | Required; 1980 through current year + 1 |
| vin | String(17) | Required; trimmed; stored uppercase; letters and digits only; unique ignoring case |
| purchasedDate | Date only | Required; `YYYY-MM-DD` |
| color | String(40) | Required; trimmed; nonblank; case kept |
| passengers | Integer | Required; 1 through 15 |
| plateNumber | String(20) | Required; trimmed; nonblank; case kept |
| plateExpireMonth | Integer | Required; 1 through 12 |
| designatedParking | String(200) | Required; trimmed; nonblank; case kept; pickup parking location |
| areaId | Integer | Required foreign key to `areas.id`, `ON DELETE RESTRICT` |

Register Vehicle belongsTo Area and Area hasMany Vehicle in `models/index.js`. This feature does not add mileage, service, issue, or reservation tables.

## Acceptance Criteria (Gherkin)

### US-4.1 — View vehicles

#### Scenario: Admin lists every vehicle in make and model order
* **Given** vehicles Ford Transit and Chevrolet Express exist in different areas
* **When** an admin requests GET /vehicle-t6/vehicles
* **Then** both vehicles are returned sorted by make, then model, then id

#### Scenario: Area admin lists only vehicles for its area
* **Given** an area_admin has areaId 2 and vehicles exist in areas 1 and 2
* **When** that user lists vehicles
* **Then** the response is 200 with only area 2 vehicles

#### Scenario: Area admin without an assignment gets an empty list
* **Given** an area_admin has null areaId and vehicles exist
* **When** that user lists vehicles
* **Then** the response is 200 with []

#### Scenario: Empty vehicle list is returned
* **Given** there are no vehicles in the caller’s scope
* **When** an admin lists vehicles
* **Then** the response is 200 with []

#### Scenario: Requestor and maintenance cannot list vehicles
* **Given** the signed-in role is requestor or maintenance
* **When** each role lists vehicles
* **Then** each response is 403 with the Feature 1 Forbidden. message

#### Scenario: Vehicle API requires a session
* **Given** no valid application session is supplied
* **When** GET, POST, PUT, or DELETE is sent to an applicable vehicle route
* **Then** each response is 401 with the Feature 1 Unauthorized. message and nothing changes

#### Scenario: Options returns the standard make and model lists
* **Given** an admin or area_admin is signed in
* **When** GET /vehicle-t6/vehicles/options is sent
* **Then** the response is 200 with the documented makes and modelsByMake values

#### Scenario: Vehicles page shows allowed records and actions
* **Given** GET /vehicles returns the caller’s allowed vehicles
* **When** an admin or area_admin opens /vehicles from MenuBar
* **Then** each allowed vehicle appears with make, model, year, color, passengers, plate, plate expire month, designated parking, and area name, and Add vehicle, Edit, and Delete are available

#### Scenario: Vehicles navigation requires an allowed role
* **Given** a signed-out visitor opens /vehicles
* **When** the Feature 1 route guard runs
* **Then** the visitor reaches /login and no vehicle records appear

#### Scenario: Requestor and maintenance are sent Home from Vehicles
* **Given** a requestor or maintenance user opens /vehicles
* **When** the route guard runs
* **Then** the user reaches Home and MenuBar does not show Vehicles

#### Scenario: Vehicles page distinguishes loading empty and failed states
* **Given** the vehicle list is pending, then succeeds with []
* **When** the page renders each state
* **Then** progress appears while pending and No vehicles found. appears only after success

#### Scenario: Vehicle list failure does not show an empty list
* **Given** GET /vehicles fails with an API message or no response message
* **When** the list request completes
* **Then** the page shows the message or Vehicles could not be loaded. and does not show No vehicles found.

### US-4.2 — Add a vehicle

#### Scenario: Admin creates a vehicle
* **Given** an admin supplies a valid Ford Transit for an existing area
* **When** POST /vehicle-t6/vehicles is sent
* **Then** the response is 201 with generated id and the saved vehicle fields, including uppercase vin

#### Scenario: Area admin creates a vehicle for its own area
* **Given** an area_admin has areaId 2 and supplies valid vehicle fields with areaId 2
* **When** POST /vehicle-t6/vehicles is sent
* **Then** the response is 201 with the vehicle stored for area 2

#### Scenario: Area admin cannot create a vehicle for another area
* **Given** an area_admin has areaId 2 and posts valid fields with areaId 1
* **When** POST /vehicle-t6/vehicles is sent
* **Then** the response is 403 with the Feature 1 Forbidden. message and no vehicle is created

#### Scenario: Area admin without an assignment cannot create a vehicle
* **Given** an area_admin has null areaId and posts valid vehicle fields
* **When** POST /vehicle-t6/vehicles is sent
* **Then** the response is 403 with the Feature 1 Forbidden. message and no vehicle is created

#### Scenario: Vehicle string values trim outer spaces
* **Given** an admin surrounds a valid vin, color, plateNumber, and designatedParking with spaces
* **When** the vehicle is created
* **Then** outer spaces are removed, vin is stored uppercase, and color, plateNumber, and designatedParking keep their letter case

#### Scenario: Duplicate VIN is rejected
* **Given** a vehicle with vin 1FTBR1C80MKA12345 exists
* **When** an admin creates another vehicle with the same vin in different letter case
* **Then** the response is 409 with message VIN is already in use. and no extra vehicle is stored

#### Scenario: Unknown make or model is rejected
* **Given** an admin posts a make or model that is not on the standard lists, or a model that does not belong to the make
* **When** POST /vehicle-t6/vehicles is sent
* **Then** the response is 400 with message Invalid vehicle data. and no vehicle is stored

#### Scenario: Missing area is rejected
* **Given** an admin posts valid vehicle fields with areaId 9999 and no such area exists
* **When** POST /vehicle-t6/vehicles is sent
* **Then** the response is 404 with message Area with id=9999 not found. and no vehicle is stored

#### Scenario: Requestor and maintenance cannot create a vehicle
* **Given** the signed-in role is requestor or maintenance
* **When** each role posts valid vehicle data
* **Then** each response is 403 with the Feature 1 Forbidden. message and no vehicle is created

#### Scenario: Client cannot select a vehicle primary key
* **Given** an admin sends valid vehicle data plus id 99 and an unrelated property
* **When** the vehicle is created
* **Then** the server generates its own id and persists only the allowed vehicle fields

#### Scenario: Add vehicle opens the specified form
* **Given** an admin is on Vehicles
* **When** the admin selects Add vehicle
* **Then** the Add vehicle dialog shows Make, Model, Year, VIN, Purchased date, Color, Passengers, Plate number, Plate expire month, Designated parking, Area, Save, and Cancel

#### Scenario: Saving a vehicle updates the list
* **Given** valid vehicle fields are entered and POST succeeds
* **When** the admin selects Save
* **Then** the dialog shows progress while pending, suppresses duplicate saves, closes on success, and reloads the allowed list

#### Scenario: Cancel leaves vehicle records unchanged
* **Given** an add or edit vehicle dialog contains unsaved changes
* **When** the user selects Cancel
* **Then** the dialog closes without a write request and reopening it shows the correct initial values without the previous error

#### Scenario: Vehicle form rejects invalid fields before submitting
* **Given** a required vehicle field is blank or outside the allowed ranges
* **When** the user selects Save
* **Then** no write request is sent and Invalid vehicle data. is shown

#### Scenario: Failed vehicle save keeps the dialog open
* **Given** Save is pressed and the API returns an error message or no message
* **When** the create request finishes
* **Then** the dialog stays open with the entered values and shows the API message or Vehicle could not be saved.

### US-4.3 — Edit a vehicle

#### Scenario: Admin updates a vehicle
* **Given** vehicle id 1 exists
* **When** an admin sends PUT /vehicle-t6/vehicles/1 with valid replacement fields
* **Then** the response is 200 with the updated vehicle fields and the same id

#### Scenario: Area admin updates a vehicle in its area
* **Given** an area_admin has areaId 2 and vehicle id 5 belongs to area 2
* **When** that user sends a valid PUT for vehicle 5 with areaId 2
* **Then** the response is 200 with the updated fields

#### Scenario: Area admin cannot update a vehicle in another area
* **Given** an area_admin has areaId 2 and vehicle id 4 belongs to area 1
* **When** that user sends PUT /vehicle-t6/vehicles/4
* **Then** the response is 404 with message Vehicle with id=4 not found. and the vehicle is unchanged

#### Scenario: Area admin cannot move a vehicle to another area
* **Given** an area_admin has areaId 2 and vehicle id 5 belongs to area 2
* **When** that user sends PUT for vehicle 5 with areaId 1
* **Then** the response is 403 with the Feature 1 Forbidden. message and the vehicle stays in area 2

#### Scenario: Updating a missing vehicle is rejected
* **Given** no vehicle has id 9999
* **When** an admin sends PUT /vehicle-t6/vehicles/9999 with valid fields
* **Then** the response is 404 with message Vehicle with id=9999 not found.

#### Scenario: Invalid vehicle route id is rejected
* **Given** an admin is signed in
* **When** PUT or DELETE is sent with route id abc, 0, -1, or an unsafe integer
* **Then** each response is 400 with message Vehicle id must be a positive integer.

#### Scenario: Edit vehicle opens with the current values
* **Given** an allowed vehicle row is shown on Vehicles
* **When** the user selects Edit
* **Then** the Edit vehicle dialog shows that row’s current values, Save, and Cancel

#### Scenario: Saving an edited vehicle refreshes the list
* **Given** valid edited fields are entered and PUT succeeds
* **When** the user selects Save
* **Then** the dialog shows progress while pending, closes on success, and reloads the allowed list

### US-4.4 — Delete a vehicle

#### Scenario: Admin deletes an unused vehicle
* **Given** vehicle id 3 exists
* **When** an admin sends DELETE /vehicle-t6/vehicles/3
* **Then** the response is 200 with message Vehicle deleted. and the vehicle is gone

#### Scenario: Area admin deletes an unused vehicle in its area
* **Given** an area_admin has areaId 2 and vehicle id 5 belongs to area 2
* **When** that user sends DELETE /vehicle-t6/vehicles/5
* **Then** the response is 200 with message Vehicle deleted.

#### Scenario: Area admin cannot delete a vehicle in another area
* **Given** an area_admin has areaId 2 and vehicle id 4 belongs to area 1
* **When** that user sends DELETE /vehicle-t6/vehicles/4
* **Then** the response is 404 with message Vehicle with id=4 not found. and the vehicle remains

#### Scenario: Deleting a missing vehicle is rejected
* **Given** no vehicle has id 9999
* **When** an admin sends DELETE /vehicle-t6/vehicles/9999
* **Then** the response is 404 with message Vehicle with id=9999 not found.

#### Scenario: Delete vehicle requires confirmation
* **Given** an allowed vehicle row is shown on Vehicles
* **When** the user selects Delete
* **Then** a Delete vehicle dialog asks Delete this vehicle? and offers Delete and Cancel

#### Scenario: Confirmed vehicle deletion refreshes the list
* **Given** the delete confirmation is open and DELETE succeeds
* **When** the user selects Delete
* **Then** the dialog shows progress while pending, closes on success, and reloads the allowed list

#### Scenario: Failed vehicle deletion preserves the dialog and row
* **Given** the delete confirmation is open and DELETE fails
* **When** the delete request finishes
* **Then** the dialog and row remain and the page shows the API message or Vehicle could not be deleted.

#### Scenario: Cancel closes delete without a request
* **Given** the delete confirmation is open
* **When** the user selects Cancel
* **Then** no delete request is sent and the vehicle remains on the list

## Test Coverage Map

Exact `it(...)` titles. Backend file: `backend/tests/vehicles.test.js`. Frontend file: `frontend/tests/Vehicles.test.js`.

| Story | Scenario | File | Exact test name |
|-------|----------|------|-----------------|
| US-4.1 | Admin lists every vehicle in make and model order | `backend/tests/vehicles.test.js` | `it("Admin lists every vehicle in make and model order")` |
| US-4.1 | Area admin lists only vehicles for its area | `backend/tests/vehicles.test.js` | `it("Area admin lists only vehicles for its area")` |
| US-4.1 | Area admin without an assignment gets an empty list | `backend/tests/vehicles.test.js` | `it("Area admin without an assignment gets an empty list")` |
| US-4.1 | Empty vehicle list is returned | `backend/tests/vehicles.test.js` | `it("Empty vehicle list is returned")` |
| US-4.1 | Requestor and maintenance cannot list vehicles | `backend/tests/vehicles.test.js` | `it("Requestor and maintenance cannot list vehicles")` |
| US-4.1 | Vehicle API requires a session | `backend/tests/vehicles.test.js` | `it("Vehicle API requires a session")` |
| US-4.1 | Options returns the standard make and model lists | `backend/tests/vehicles.test.js` | `it("Options returns the standard make and model lists")` |
| US-4.1 | Vehicles page shows allowed records and actions | `frontend/tests/Vehicles.test.js` | `it("Vehicles page shows allowed records and actions")` |
| US-4.1 | Vehicles navigation requires an allowed role | `frontend/tests/Vehicles.test.js` | `it("Vehicles navigation requires an allowed role")` |
| US-4.1 | Requestor and maintenance are sent Home from Vehicles | `frontend/tests/Vehicles.test.js` | `it("Requestor and maintenance are sent Home from Vehicles")` |
| US-4.1 | Vehicles page distinguishes loading empty and failed states | `frontend/tests/Vehicles.test.js` | `it("Vehicles page distinguishes loading empty and failed states")` |
| US-4.1 | Vehicle list failure does not show an empty list | `frontend/tests/Vehicles.test.js` | `it("Vehicle list failure does not show an empty list")` |
| US-4.2 | Admin creates a vehicle | `backend/tests/vehicles.test.js` | `it("Admin creates a vehicle")` |
| US-4.2 | Area admin creates a vehicle for its own area | `backend/tests/vehicles.test.js` | `it("Area admin creates a vehicle for its own area")` |
| US-4.2 | Area admin cannot create a vehicle for another area | `backend/tests/vehicles.test.js` | `it("Area admin cannot create a vehicle for another area")` |
| US-4.2 | Area admin without an assignment cannot create a vehicle | `backend/tests/vehicles.test.js` | `it("Area admin without an assignment cannot create a vehicle")` |
| US-4.2 | Vehicle string values trim outer spaces | `backend/tests/vehicles.test.js` | `it("Vehicle string values trim outer spaces")` |
| US-4.2 | Duplicate VIN is rejected | `backend/tests/vehicles.test.js` | `it("Duplicate VIN is rejected")` |
| US-4.2 | Unknown make or model is rejected | `backend/tests/vehicles.test.js` | `it("Unknown make or model is rejected")` |
| US-4.2 | Missing area is rejected | `backend/tests/vehicles.test.js` | `it("Missing area is rejected")` |
| US-4.2 | Requestor and maintenance cannot create a vehicle | `backend/tests/vehicles.test.js` | `it("Requestor and maintenance cannot create a vehicle")` |
| US-4.2 | Client cannot select a vehicle primary key | `backend/tests/vehicles.test.js` | `it("Client cannot select a vehicle primary key")` |
| US-4.2 | Add vehicle opens the specified form | `frontend/tests/Vehicles.test.js` | `it("Add vehicle opens the specified form")` |
| US-4.2 | Saving a vehicle updates the list | `frontend/tests/Vehicles.test.js` | `it("Saving a vehicle updates the list")` |
| US-4.2 | Cancel leaves vehicle records unchanged | `frontend/tests/Vehicles.test.js` | `it("Cancel leaves vehicle records unchanged")` |
| US-4.2 | Vehicle form rejects invalid fields before submitting | `frontend/tests/Vehicles.test.js` | `it("Vehicle form rejects invalid fields before submitting")` |
| US-4.2 | Failed vehicle save keeps the dialog open | `frontend/tests/Vehicles.test.js` | `it("Failed vehicle save keeps the dialog open")` |
| US-4.3 | Admin updates a vehicle | `backend/tests/vehicles.test.js` | `it("Admin updates a vehicle")` |
| US-4.3 | Area admin updates a vehicle in its area | `backend/tests/vehicles.test.js` | `it("Area admin updates a vehicle in its area")` |
| US-4.3 | Area admin cannot update a vehicle in another area | `backend/tests/vehicles.test.js` | `it("Area admin cannot update a vehicle in another area")` |
| US-4.3 | Area admin cannot move a vehicle to another area | `backend/tests/vehicles.test.js` | `it("Area admin cannot move a vehicle to another area")` |
| US-4.3 | Updating a missing vehicle is rejected | `backend/tests/vehicles.test.js` | `it("Updating a missing vehicle is rejected")` |
| US-4.3 | Invalid vehicle route id is rejected | `backend/tests/vehicles.test.js` | `it("Invalid vehicle route id is rejected")` |
| US-4.3 | Edit vehicle opens with the current values | `frontend/tests/Vehicles.test.js` | `it("Edit vehicle opens with the current values")` |
| US-4.3 | Saving an edited vehicle refreshes the list | `frontend/tests/Vehicles.test.js` | `it("Saving an edited vehicle refreshes the list")` |
| US-4.4 | Admin deletes an unused vehicle | `backend/tests/vehicles.test.js` | `it("Admin deletes an unused vehicle")` |
| US-4.4 | Area admin deletes an unused vehicle in its area | `backend/tests/vehicles.test.js` | `it("Area admin deletes an unused vehicle in its area")` |
| US-4.4 | Area admin cannot delete a vehicle in another area | `backend/tests/vehicles.test.js` | `it("Area admin cannot delete a vehicle in another area")` |
| US-4.4 | Deleting a missing vehicle is rejected | `backend/tests/vehicles.test.js` | `it("Deleting a missing vehicle is rejected")` |
| US-4.4 | Delete vehicle requires confirmation | `frontend/tests/Vehicles.test.js` | `it("Delete vehicle requires confirmation")` |
| US-4.4 | Confirmed vehicle deletion refreshes the list | `frontend/tests/Vehicles.test.js` | `it("Confirmed vehicle deletion refreshes the list")` |
| US-4.4 | Failed vehicle deletion preserves the dialog and row | `frontend/tests/Vehicles.test.js` | `it("Failed vehicle deletion preserves the dialog and row")` |
| US-4.4 | Cancel closes delete without a request | `frontend/tests/Vehicles.test.js` | `it("Cancel closes delete without a request")` |

## Agent implementation request

Copy when asking Cursor to implement this feature (`@` this file):

```text
Implement Feature 4 from @features/feature-4-vehicle-management.md on branch `feature/4-vehicle-management`.

Follow layer order in @features/framework.md (models → routes → backend tests → frontend → frontend tests).
Map every Gherkin scenario in the Test Coverage Map; run `npm test` before finishing.
If API routes, payloads, schema, or product rules changed per this spec, update @features/reference/api.md, @features/reference/data-model.md, and/or @features/reference/behavior.md in the same PR to match shipped code.
Complete Definition of Done and the merge checklist in @features/framework.md.
Do not implement behavior not in this spec.
```

**Reference updates for this feature:** `api.md`, `data-model.md`, `behavior.md`.

## Definition of Done

* [x] Backend and frontend implemented per this spec (**FR-001**–**FR-020** satisfied)
* [x] **Success Criteria (SC-001**–**SC-005)** met
* [x] All mapped tests pass (`npm test`)
* [x] Test Coverage Map complete
* [x] `features/reference/data-model.md` updated (if schema changed)
* [x] `features/reference/api.md` updated (if API changed)
* [x] `features/reference/behavior.md` updated (if product rules changed)
* [x] Agility stories and acceptance tests for Feature 4 are created or updated
* [x] Application code for this feature is handwritten; automated tests may use AI assistance

## Out of Scope

* Google sign-in and roles: [Feature 1](feature-1-user-authentication-authorization.md).
* Creating or editing areas: [Feature 2](feature-2-area-management.md).
* Assigning users to areas: [Feature 3 — User Management in the catalog](README.md#feature-catalog).
* Approved drivers (first/last name, license state, license expire date, approved date, status): [Feature 5 — Driver Management in the catalog](README.md#feature-catalog). The interview lists drivers near vehicles, but drivers are their own feature.
* Assigning a vehicle to a reservation request: [Feature 8 — Request Processing in the catalog](README.md#feature-catalog).
* Issue reports such as low gas, dirty, or maintenance need: [Feature 10 — Vehicle Issue Reports in the catalog](README.md#feature-catalog).
* Weekly schedule views: [Feature 11 — Weekly Vehicle Schedule in the catalog](README.md#feature-catalog).
* Mileage and service logs: [Feature 12 — Mileage & Service Logs in the catalog](README.md#feature-catalog).
* Uploading vehicle photos or importing an outside manufacturer catalog file.
