# Data Model Reference

**Living snapshot** of the MySQL schema on `dev` (Sequelize models in `backend/app/models/`). Update this file when a feature that defines schema merges to `dev`.

## Tables

### `users`

| Field | Type | Rules |
|-------|------|-------|
| id | Integer | Auto-generated primary key |
| googleSub | String(255), nullable | Unique when set; the verified Google subject; null for provisioned accounts until their first sign-in |
| email | String(254) | Required, unique, stored trimmed and lowercase |
| firstName | String(100) | Required column; empty string when Google omits the name |
| lastName | String(100) | Required column; empty string when Google omits the name |
| role | Enum | `admin`, `area_admin`, `requestor`, `maintenance`; default `requestor` |
| areaId | Integer, nullable | Foreign key to `areas.id`; set only for area admins, null for every other role (Feature 2) |
| createdAt, updatedAt | DateTime | Sequelize timestamps |

### `sessions`

| Field | Type | Rules |
|-------|------|-------|
| id | Integer | Auto-generated primary key |
| token | String(1024) | Required; signed application JWT; unique index on the first 255 characters (MySQL index-length limit; the JWT's random `jti` falls inside the prefix) |
| email | String(254) | The user's email when the session was created |
| expirationDate | DateTime | UTC; equals the JWT `exp` (24 hours after issue) |
| userId | Integer | Required foreign key to `users.id` |
| createdAt, updatedAt | DateTime | Sequelize timestamps |

### `areas`

| Field | Type | Rules |
|-------|------|-------|
| id | Integer | Auto-generated primary key |
| areaName | String(100) | Required, stored trimmed; unique index. The table collation is `utf8mb4_0900_as_ci` (case-insensitive, accent-sensitive), so only letter case and surrounding spaces are ignored when comparing names |
| areaLogo | String(2048) | Required, stored trimmed; absolute HTTPS URL with a host |
| noticeEmail | Text | Required plain reminder text, 1 to 5,000 characters after outer trimming; case, internal spaces and line breaks kept |
| createdAt, updatedAt | DateTime | Sequelize timestamps |

### `vehicles`

| Field | Type | Rules |
|-------|------|-------|
| id | Integer | Auto-generated primary key |
| make | String(40) | Required; one of the standard makes |
| model | String(40) | Required; one of the standard models for that make |
| year | Integer | Required; 1980 through current calendar year + 1 |
| vin | String(17) | Required; trimmed; stored uppercase; letters and digits only; unique ignoring case (`utf8mb4_0900_as_ci`) |
| purchasedDate | Date only | Required; `YYYY-MM-DD` |
| color | String(40) | Required; trimmed; nonblank; case kept |
| passengers | Integer | Required; 1 through 15 |
| plateNumber | String(20) | Required; trimmed; nonblank; case kept |
| plateExpireMonth | Integer | Required; 1 through 12 |
| designatedParking | String(200) | Required; trimmed; nonblank; case kept; pickup parking location |
| areaId | Integer | Required foreign key to `areas.id`, `ON DELETE RESTRICT` |
| createdAt, updatedAt | DateTime | Sequelize timestamps |

### `drivers`

| Field | Type | Rules |
|-------|------|-------|
| id | Integer | Auto-generated primary key |
| firstName | String(100) | Required; trimmed; nonblank; case kept |
| lastName | String(100) | Required; trimmed; nonblank; case kept |
| licenseState | String(2) | Required; uppercase USPS state or DC code from the Feature 5 standard list |
| licenseExpireDate | Date only | Required; `YYYY-MM-DD` |
| approvedDate | Date only | Required; `YYYY-MM-DD` |
| status | String(20) | Required; `approved` or `inactive` |
| createdAt, updatedAt | DateTime | Sequelize timestamps |

### `destinations`

| Field | Type | Rules |
|-------|------|-------|
| id | Integer | Auto-generated primary key |
| destinationName | String(100) | Required; trimmed; nonblank; unique ignoring case; case kept |
| addressLine | String(200) | Required; trimmed; nonblank; case kept |
| city | String(100) | Required; trimmed; nonblank; case kept |
| state | String(2) | Required; uppercase USPS state or DC code from the Feature 6 standard list |
| zipCode | String(5) | Required; trimmed; exactly 5 digits |
| roundTripMiles | Decimal(6,1) | Required; greater than 0 and at most 9999.9; at most one decimal digit |
| status | String(20) | Required; `active` or `inactive` |
| createdAt, updatedAt | DateTime | Sequelize timestamps |

### `reservation_requests`

| Field | Type | Rules |
|-------|------|-------|
| id | Integer | Auto-generated primary key |
| requestorUserId | Integer | Required foreign key to `users.id`, `ON DELETE RESTRICT` |
| areaId | Integer | Required foreign key to `areas.id`, `ON DELETE RESTRICT` |
| driverId | Integer | Required foreign key to `drivers.id`, `ON DELETE RESTRICT` |
| destinationId | Integer, nullable | Foreign key to `destinations.id`, `ON DELETE RESTRICT`; set in catalog destination mode |
| destinationCity | String(100), nullable | Required in free-text mode; trimmed, nonblank |
| estimatedMiles | Decimal(6,1), nullable | Required in free-text mode; > 0 and ≤ 9999.9, at most one decimal digit |
| departureDate | Date only | Required; `YYYY-MM-DD` |
| departureTime | String(5), nullable | `HH:mm` when timed; null for whole-day trips |
| returnDate | Date only | Required; `YYYY-MM-DD` |
| returnTime | String(5), nullable | `HH:mm` when timed; null for whole-day trips |
| passengers | Integer | Required; 1 through 15 |
| purpose | String(500) | Required; trimmed; nonblank; case kept |
| noteType | String(32), nullable | `general`, `special_instructions`, or `other`; paired with noteText |
| noteText | String(1000), nullable | Trimmed; nonblank when present; paired with noteType |
| vehicleId | Integer, nullable | Foreign key to `vehicles.id`, `ON DELETE RESTRICT`; set for `reserved`/`returned`; null otherwise |
| statusReason | String(500), nullable | Optional when admin/area_admin cancels via status change; null for other statuses |
| status | String(32) | Required; one of `requested`, `awaiting_vehicle`, `reserved`, `returned`, `cancelled`; created as `requested` |
| createdAt, updatedAt | DateTime | Sequelize timestamps |

### `reservation_emails`

Internal delivery records (Sequelize table `reservationEmails`); no API returns them.

| Field | Type | Rules |
|-------|------|-------|
| id | Integer | Auto-generated primary key |
| reservationRequestId | Integer | Required foreign key to `reservation_requests.id`, `ON DELETE RESTRICT` |
| kind | Enum | `status_change` or `pickup_reminder` |
| notificationKey | String(32) | The new status for `status_change`; the departureDate `YYYY-MM-DD` for `pickup_reminder` |
| recipient | String(254) | Required snapshot of the requestor's `users.email` |
| subject | String(255) | Required message snapshot |
| body | Text | Required plain-text message snapshot; reused on every retry |
| deliveryState | Enum | `pending`, `sent`, `failed`, `skipped`; created `pending`; the last three are terminal |
| attemptCount | Integer | Starts at 0; at most 3 transport attempts |
| nextAttemptAt | DateTime, nullable | UTC; creation time, then five minutes after each failed attempt; null once terminal |
| sentAt | DateTime, nullable | UTC provider-acceptance time once `sent`; null otherwise |
| createdAt, updatedAt | DateTime | Sequelize timestamps |

Unique index `reservation_emails_request_kind_key` on `(reservationRequestId, kind, notificationKey)`: one job per status event or per departure-date reminder.

### `issue_reports`

Sequelize table `issueReports`.

| Field | Type | Rules |
|-------|------|-------|
| id | Integer | Auto-generated primary key |
| requestId | Integer | Required foreign key to `reservation_requests.id`, `ON DELETE RESTRICT` |
| vehicleId | Integer, nullable | Foreign key to `vehicles.id`, `ON DELETE RESTRICT`; copied from the request at create time |
| issueType | Enum | `low_gas`, `dirty`, or `maintenance_need` |
| timing | Enum | `before`, `during`, or `after` |
| note | String(1000), nullable | Optional; trimmed; blank becomes null; case and internal spaces kept |
| reportedByUserId | Integer | Required foreign key to `users.id`, `ON DELETE RESTRICT`; always the signed-in user |
| createdAt, updatedAt | DateTime | Sequelize timestamps; API returns `createdAt` |

### `mileage_logs`

Sequelize table `mileageLogs`.

| Field | Type | Rules |
|-------|------|-------|
| id | Integer | Auto-generated primary key |
| vehicleId | Integer | Required foreign key to `vehicles.id`, `ON DELETE RESTRICT` |
| logDate | Date only | Required; `YYYY-MM-DD` |
| mileage | Integer | Required; 0 through 2,000,000 |
| loggedByUserId | Integer | Required foreign key to `users.id`, `ON DELETE RESTRICT`; always the signed-in user |
| createdAt, updatedAt | DateTime | Sequelize timestamps; API returns `createdAt` |

### `service_logs`

Sequelize table `serviceLogs`.

| Field | Type | Rules |
|-------|------|-------|
| id | Integer | Auto-generated primary key |
| vehicleId | Integer | Required foreign key to `vehicles.id`, `ON DELETE RESTRICT` |
| serviceDate | Date only | Required; `YYYY-MM-DD` |
| serviceType | Enum | `repair`, `oil_change`, or `tire_replacement` |
| note | String(1000), nullable | Optional; trimmed; blank becomes null; case and internal spaces kept |
| loggedByUserId | Integer | Required foreign key to `users.id`, `ON DELETE RESTRICT`; always the signed-in user |
| createdAt, updatedAt | DateTime | Sequelize timestamps; API returns `createdAt` |

## Associations

| Association | Options | Introduced |
|-------------|---------|------------|
| `user.hasMany(session, { as: "sessions" })` / `session.belongsTo(user, { as: "user" })` | `foreignKey: userId` (not null), `onDelete: CASCADE` — sessions are deleted with their user | Feature 1 |
| `area.hasMany(user, { as: "users" })` / `user.belongsTo(area, { as: "area" })` | `foreignKey: areaId` (nullable), `onDelete: RESTRICT` — an area with assigned users cannot be deleted | Feature 2 |
| `area.hasMany(vehicle, { as: "vehicles" })` / `vehicle.belongsTo(area, { as: "area" })` | `foreignKey: areaId` (not null), `onDelete: RESTRICT` — an area with vehicles cannot be deleted | Feature 4 |
| `user.hasMany(reservationRequest, { as: "reservationRequests" })` / `reservationRequest.belongsTo(user, { as: "requestor" })` | `foreignKey: requestorUserId` (not null), `onDelete: RESTRICT` — a user with requests cannot be deleted | Feature 7 |
| `area.hasMany(reservationRequest, { as: "reservationRequests" })` / `reservationRequest.belongsTo(area, { as: "area" })` | `foreignKey: areaId` (not null), `onDelete: RESTRICT` — an area with requests cannot be deleted | Feature 7 |
| `driver.hasMany(reservationRequest, { as: "reservationRequests" })` / `reservationRequest.belongsTo(driver, { as: "driver" })` | `foreignKey: driverId` (not null), `onDelete: RESTRICT` — a driver with requests cannot be deleted | Feature 7 |
| `destination.hasMany(reservationRequest, { as: "reservationRequests" })` / `reservationRequest.belongsTo(destination, { as: "destination" })` | `foreignKey: destinationId` (nullable), `onDelete: RESTRICT` — a destination with requests cannot be deleted | Feature 7 |
| `vehicle.hasMany(reservationRequest, { as: "reservationRequests" })` / `reservationRequest.belongsTo(vehicle, { as: "vehicle" })` | `foreignKey: vehicleId` (nullable), `onDelete: RESTRICT` — a vehicle referenced by a reserved/returned request cannot be deleted | Feature 8 |
| `reservationRequest.hasMany(reservationEmail, { as: "emails" })` / `reservationEmail.belongsTo(reservationRequest, { as: "reservationRequest" })` | `foreignKey: reservationRequestId` (not null), `onDelete: RESTRICT` — no request-delete route exists, so this adds no 409 response | Feature 9 |
| `reservationRequest.hasMany(issueReport, { as: "issues" })` / `issueReport.belongsTo(reservationRequest, { as: "reservationRequest" })` | `foreignKey: requestId` (not null), `onDelete: RESTRICT` | Feature 10 |
| `vehicle.hasMany(issueReport, { as: "issueReports" })` / `issueReport.belongsTo(vehicle, { as: "vehicle" })` | `foreignKey: vehicleId` (nullable), `onDelete: RESTRICT` — deleting a vehicle with issues returns 409 `Vehicle is in use.` | Feature 10 |
| `user.hasMany(issueReport, { as: "issueReports" })` / `issueReport.belongsTo(user, { as: "reporter" })` | `foreignKey: reportedByUserId` (not null), `onDelete: RESTRICT` — deleting a reporter returns 409 `User is in use.` | Feature 10 |
| `vehicle.hasMany(mileageLog, { as: "mileageLogs" })` / `mileageLog.belongsTo(vehicle, { as: "vehicle" })` | `foreignKey: vehicleId` (not null), `onDelete: RESTRICT` — deleting a vehicle with mileage logs returns 409 `Vehicle is in use.` | Feature 12 |
| `user.hasMany(mileageLog, { as: "mileageLogs" })` / `mileageLog.belongsTo(user, { as: "logger" })` | `foreignKey: loggedByUserId` (not null), `onDelete: RESTRICT` — deleting a logger returns 409 `User is in use.` | Feature 12 |
| `vehicle.hasMany(serviceLog, { as: "serviceLogs" })` / `serviceLog.belongsTo(vehicle, { as: "vehicle" })` | `foreignKey: vehicleId` (not null), `onDelete: RESTRICT` — deleting a vehicle with service logs returns 409 `Vehicle is in use.` | Feature 12 |
| `user.hasMany(serviceLog, { as: "serviceLogs" })` / `serviceLog.belongsTo(user, { as: "logger" })` | `foreignKey: loggedByUserId` (not null), `onDelete: RESTRICT` — deleting a logger returns 409 `User is in use.` | Feature 12 |

Drivers have no foreign keys to users, areas, or vehicles. Destinations have no foreign keys to users, areas, vehicles, or drivers.

## Provenance

| Table | Introduced |
|-------|------------|
| users, sessions | Feature 1 |
| areas, users.areaId | Feature 2 |
| vehicles | Feature 4 |
| drivers | Feature 5 |
| destinations | Feature 6 |
| reservation_requests | Feature 7 |
| reservation_requests.vehicleId, reservation_requests.statusReason, vehicle association | Feature 8 |
| reservation_emails | Feature 9 |
| issue_reports | Feature 10 |
| mileage_logs, service_logs | Feature 12 |
