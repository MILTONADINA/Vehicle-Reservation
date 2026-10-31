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

## Associations

| Association | Options | Introduced |
|-------------|---------|------------|
| `user.hasMany(session, { as: "sessions" })` / `session.belongsTo(user, { as: "user" })` | `foreignKey: userId` (not null), `onDelete: CASCADE` — sessions are deleted with their user | Feature 1 |

## Provenance

| Table | Introduced |
|-------|------------|
| users, sessions | Feature 1 |
