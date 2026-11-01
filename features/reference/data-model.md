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

## Associations

| Association | Options | Introduced |
|-------------|---------|------------|
| `user.hasMany(session, { as: "sessions" })` / `session.belongsTo(user, { as: "user" })` | `foreignKey: userId` (not null), `onDelete: CASCADE` — sessions are deleted with their user | Feature 1 |
| `area.hasMany(user, { as: "users" })` / `user.belongsTo(area, { as: "area" })` | `foreignKey: areaId` (nullable), `onDelete: RESTRICT` — an area with assigned users cannot be deleted | Feature 2 |
| `area.hasMany(vehicle, { as: "vehicles" })` / `vehicle.belongsTo(area, { as: "area" })` | `foreignKey: areaId` (not null), `onDelete: RESTRICT` — an area with vehicles cannot be deleted | Feature 4 |

## Provenance

| Table | Introduced |
|-------|------------|
| users, sessions | Feature 1 |
| areas, users.areaId | Feature 2 |
| vehicles | Feature 4 |
