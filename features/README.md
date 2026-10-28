# Feature Specifications

Spec-driven development (SDD) source of truth for **this** application.  
No application code may be written unless it maps to a requirement in one of these files.

**Methodology:** [framework.md](./framework.md) — how to write, trace, and ship feature specs.  
**Student guide (requirements):** [writing-feature-requirements.md](./writing-feature-requirements.md) — stories, FRs, initial data model, Gherkin AC.  
**Student guide (design):** [writing-feature-design.md](./writing-feature-design.md) — ownership, API, screens, test map, DoD, out of scope.  
**Student guide (living reference):** [reference/writing-living-reference.md](./reference/writing-living-reference.md) — update api / data-model / behavior in the same PR.

*(Examples in the writing guides often cite the OC CS Speckit Todo sample app — use them as patterns for your product.)*

**Sprints** live in your agile tool — they are **not** part of these specs.

## Feature catalog

| ID | Feature | File | Branch | Depends on | Author | Reviewer |
|----|---------|------|--------|------------|--------|----------|
| 1 | User Authentication & Authorization | [feature-1-user-authentication-authorization.md](./feature-1-user-authentication-authorization.md) | `feature/1-user-authentication-authorization` | — | Milton | Morgan |
| 2 | Area Management | [feature-2-area-management.md](./feature-2-area-management.md) | `feature/2-area-management` | 1 | Milton | Morgan |
| 3 | User Management | [feature-3-user-management.md](./feature-3-user-management.md) | `feature/3-user-management` | 1, 2 | Milton | Morgan |
| 4 | Vehicle Management | [feature-4-vehicle-management.md](./feature-4-vehicle-management.md) | `feature/4-vehicle-management` | 1, 2 | Landry | Milton |
| 5 | Driver Management | [feature-5-driver-management.md](./feature-5-driver-management.md) | `feature/5-driver-management` | 1 | Morgan | Landry |
| 6 | Destination Management | *not yet written* | `feature/6-destination-management` | 1 | Morgan | Landry |
| 7 | Reservation Requests | *not yet written* | `feature/7-reservation-requests` | 1, 2, 5, 6 | Morgan | Landry |
| 8 | Request Processing | *not yet written* | `feature/8-request-processing` | 4, 7 | Morgan | Landry |
| 9 | Reservation Emails | *not yet written* | `feature/9-reservation-emails` | 2, 4, 8 | Milton | Morgan |
| 10 | Vehicle Issue Reports | *not yet written* | `feature/10-vehicle-issue-reports` | 4, 8 | Landry | Milton |
| 11 | Weekly Vehicle Schedule | *not yet written* | `feature/11-weekly-vehicle-schedule` | 4, 8 | Landry | Milton |
| 12 | Mileage & Service Logs | *not yet written* | `feature/12-mileage-service-logs` | 4 | Landry | Milton |

When you write a spec, replace *not yet written* with a link to your `feature-N-short-name.md` in the same PR.

New features: follow [framework.md](./framework.md#feature-spec-template) — **Status**, **Input**, **FR-00N**, **SC-00N**, **Key Entities**, Gherkin, **Agent implementation request**, **Definition of Done**.

**Branch roles:** `main` = scaffold-only starter kit · `dev` = integration · `feature/N-*` = feature work (branch from `dev`).

## Living reference

Keep snapshots in sync when schema, API, or product rules change — **in the same PR as implementation** (required DoD; see [Merge checklist + Agility sync](./framework.md#merge-checklist--agility-sync)). Each `feature-N-*.md` includes an **Agent implementation request** block so Cursor updates reference during implementation ([framework.md](./framework.md#agent-implementation-request)). Spec evolution after merge: [prefer a new feature delta](./framework.md#spec-evolution-after-merge).

| File | Purpose |
|------|---------|
| [reference/README.md](./reference/README.md) | How to maintain reference docs |
| [reference/writing-living-reference.md](./reference/writing-living-reference.md) | Student guide — writing/updating living reference |
| [reference/data-model.md](./reference/data-model.md) | Current database tables (update in feature PR when schema changes) |
| [reference/api.md](./reference/api.md) | Current REST API (update in feature PR when API changes) |
| [reference/behavior.md](./reference/behavior.md) | Current product rules (update in feature PR when rules change) |

## Related

- Cursor rules: `.cursor/rules/`
- ADRs: `docs/adr/`
- Quality attributes (NFRs): `docs/nfr/`
- Starter kit notes: `docs/STARTER-KIT.md`
