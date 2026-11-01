# Vehicle Reservation

OC vehicle reservation system, built with Spec-Driven Development (SDD).

Specifications define *what* to build (`features/`). Cursor rules define *how* (`.cursor/rules/`). Tests verify both.

Features, their owners, and their reviewers are listed in [features/README.md](features/README.md).

**Docs:** [features/framework.md](features/framework.md) · [docs/STARTER-KIT.md](docs/STARTER-KIT.md) · [docs/adr/README.md](docs/adr/README.md)

---

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vue 3, Vuetify 4, Vite, vue-router, axios |
| Backend | Node.js (ES modules), Express, Sequelize, MySQL |
| Tests | Jest + supertest (backend), Vitest + `@vue/test-utils` (frontend) |

Default ports: frontend `8082`, backend `3200`. API mount: `/vehicle-t6` (set in `backend/server.js` and `frontend/src/services/services.js`).

---

## Getting started

```bash
npm install --prefix frontend
npm install --prefix backend
npm install

# macOS / Linux / Git Bash:
cp backend/.env.example backend/.env
cp backend/.env.test.example backend/.env.test
cp frontend/.env.example frontend/.env
# Windows PowerShell / cmd:
#   copy backend\.env.example backend\.env
#   copy backend\.env.test.example backend\.env.test
#   copy frontend\.env.example frontend\.env
# Create MySQL databases `vehicle-t6` and `vehicle-t6-test`; set DB_* and AUTH_SECRET
# Set the team's Google client ID as GOOGLE_CLIENT_ID (backend) and VITE_GOOGLE_CLIENT_ID (frontend)
# Set ADMIN_EMAIL, ADMIN_FIRST_NAME, and ADMIN_LAST_NAME (backend) for the first administrator

npm test
cd backend && npm run seed:admin   # once, creates the tables and the first administrator
cd backend && npm run dev
cd frontend && npm run dev
```

The `.env` files and the Google client ID are never committed.

Works on **macOS, Windows, and Linux** — use `npm run …` for all tooling (PDF, Agility, bundles).

## Branching

| Branch | Purpose |
|--------|---------|
| `main` | Starter kit only — no feature implementation |
| `dev` | Integration |
| `feature/N-*` | One feature at a time |

```bash
git fetch origin
git checkout feature/N-short-name
git merge origin/dev
```

## Building a feature

1. Merge the latest `dev` into your feature branch, and restart the backend so new columns are added.
2. Implement with Cursor: `Implement @features/feature-N-….md per its Agent implementation request and Definition of Done`, or one layer at a time (reference updates in the same PR when API/schema changes).
3. Open a pull request into `dev` for the reviewer named in [features/README.md](features/README.md). See the [merge checklist](features/framework.md#merge-checklist--agility-sync).
