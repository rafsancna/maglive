# Maglive

Maglive is a multilingual corporate product-catalog platform. The repository is an npm monorepo with a Next.js frontend, an Express API, and a narrow shared contracts package.

The authoritative architecture, task order, acceptance gates, and progress record live in `PROJECT_IMPLEMENTATION_PLAN.md`. Implement only the requested task ID or phase, inspect Git status first, preserve unrelated work, and update that document only after verification passes.

## Requirements

- Node.js 24 and npm 11 (see `.nvmrc` and `packageManager`)
- MongoDB 8 configured as a replica set, including local development
- Windows PowerShell, macOS, or Linux shell

Exact dependency versions are committed in the root lockfile. Do not change a dependency major without a Decision Log entry and the affected verification suite.

## Workspace layout

- `contracts/` — runtime-safe Zod schemas and serializable TypeScript contracts
- `frontend/` — Next.js App Router public site and future `/admin` UI
- `backend/` — Express API and MongoDB lifecycle

## Setup

1. Select Node 24: `nvm use` (or the equivalent in your version manager).
2. Install all workspaces from the repository root: `npm install`.
3. Copy `frontend/.env.example` to `frontend/.env.local`.
4. Copy `backend/.env.example` to `backend/.env` and replace every development placeholder.
5. Initialize the local MongoDB replica set as described below.
6. Start both applications with `npm run dev`.

Default local endpoints:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- Health: `http://localhost:5000/api/v1/health`
- MongoDB: `mongodb://localhost:27017/maglive?replicaSet=maglive-rs`

## Local MongoDB replica set

Transactions are a correctness requirement. A standalone MongoDB process is rejected at API startup.

Create a dedicated local data directory outside this repository, then start MongoDB with a replica-set name:

```text
mongod --dbpath <absolute-local-data-directory> --replSet maglive-rs --bind_ip 127.0.0.1 --port 27017
```

Initialize it once from `mongosh`:

```text
rs.initiate({ _id: "maglive-rs", members: [{ _id: 0, host: "127.0.0.1:27017" }] })
```

Wait for `rs.status()` to report a primary before starting the backend. Never point development or test cleanup at a production database.

## Commands

- `npm run dev` — build contracts and run frontend/backend together
- `npm run build` — production-build every workspace in dependency order
- `npm run typecheck` — strict type checks in every workspace
- `npm run lint` — ESLint in every workspace
- `npm test` — deterministic workspace tests
- `npm run clean` — remove generated build and coverage output

Each command can also be run for one workspace, for example `npm test -w @maglive/backend`.

## Test isolation

Database-backed tests must use `MONGODB_TEST_URI`, and its database name must contain an explicit `test` marker such as `maglive_test`. It must also point to a transaction-capable replica set. Test uploads use generated operating-system temporary directories and refuse cleanup outside their validated directory.

Phase 1 smoke tests do not mutate MongoDB. Later integration suites must opt into the guarded test URI explicitly.

## Adding a language

English (`en`) and Simplified Chinese (`zh`) are the initial enabled languages, not a fixed two-language limit. Locale-aware routing, static route parameters, HTML language/direction metadata, request detection, and the language switcher derive from the typed registry in `contracts/src/locale.ts`.

To enable another language:

1. Add one entry to `localeDefinitions` with its route code, BCP 47 language tag, direction, fallback, names, and any exact `Accept-Language` aliases.
2. Add a JSON dictionary matching `Dictionary` in `frontend/src/i18n/dictionaries/`.
3. Add its static dictionary import to `frontend/src/i18n/get-dictionary.ts`; the compiler rejects a missing loader.
4. Add routing, content, long-text, and—when applicable—RTL tests and visual QA.
5. In later CMS phases, include the locale in publication validation, localized metadata, `hreflang`, sitemap, and editorial completeness coverage before public launch.

Do not add locale-specific conditionals to navigation or layouts. When two variants share a base language, assign explicit `acceptLanguageAliases` (for example, regional tags) so request detection remains deterministic.

## Source-control safety

Do not commit `.env` files, secrets, uploads, local MongoDB data, logs, coverage, or build output. Upload placeholder directories are intentionally retained with `.gitkeep` files.
