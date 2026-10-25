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
- `frontend/` — Next.js App Router public site and `/admin` CMS
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
- `npm run e2e` — Playwright editorial workflow (from `frontend/`)
- `npm run clean` — remove generated build and coverage output

Each command can also be run for one workspace, for example `npm test -w @maglive/backend`.

## End-to-end tests

`frontend/tests/e2e` contains Playwright specs that exercise the primary administrator and public journeys through real browser, Next.js, Express, and MongoDB boundaries. The suite covers:

- Administrator login with pre-auth CSRF acquisition, session/CSRF token rotation, and invalid-credential rejection.
- Public catalog listing, product detail rendering, and the localized Chinese catalog.
- Locale detection, root-path redirect, primary-navigation coverage of every corporate route, English↔Simplified Chinese switching, and locale retention across navigation.

The backend e2e bootstrap script (`backend/src/scripts/e2eServer.ts`) starts a disposable in-memory MongoDB replica set, seeds an administrator, a root/child published category pair, and two published products in both languages, then serves the API on port `5100`. Playwright's `webServer` configuration starts the backend and the Next.js dev server automatically and wires the frontend environment to the e2e API.

```text
npm run e2e -w @maglive/frontend
```

Additional Playwright modes:

```text
npm run e2e:ui -w @maglive/frontend      # interactive UI mode
npm run e2e:headed -w @maglive/frontend  # headed browser
```

The suite is pinned to one worker so the isolated services stay deterministic. Test data and the database are in-memory and are discarded when the servers stop; screenshots and traces are captured only on failure. If you prefer to run the servers manually, start the backend with `npm run e2e:server -w @maglive/backend` (with `PORT=5100 FRONTEND_ORIGIN=http://localhost:3000`) and a normal frontend dev server configured to use `http://localhost:5100/api/v1`, then run `PLAYWRIGHT_WEB_SERVER=0 npm run e2e -w @maglive/frontend`.

## Release gate

The version-one release gate runs from the repository root:

```text
npm run lint
npm run typecheck
npm test
npm run build
npm run e2e -w @maglive/frontend
```

The gate must pass on a clean checkout with the lockfile, and the Playwright suite must pass from a clean seeded state. See `PROJECT_IMPLEMENTATION_PLAN.md` (PH10-05) for the full acceptance criteria.

## Test isolation

Database-backed tests must use `MONGODB_TEST_URI`, and its database name must contain an explicit `test` marker such as `maglive_test`. It must also point to a transaction-capable replica set. Test uploads use generated operating-system temporary directories and refuse cleanup outside their validated directory.

Phase 1 smoke tests do not mutate MongoDB. Later integration suites must opt into the guarded test URI explicitly.

## Adding a language

English (`en`) and Simplified Chinese (`zh`) are protected built-in languages, not a fixed two-language limit. Sign in and open `/admin/languages` to add another language. Enter its lowercase route code, BCP 47 language tag, English and native names, text direction, fallback language, and optional exact `Accept-Language` aliases.

The new language is persisted in MongoDB and immediately becomes available to locale-aware public routing, HTML language/direction metadata, the public language switcher, sitemap generation, search, and the Category, Product, and Media editors. The switcher shows the stored country flag for the language; flags live in `backend/assets/flags` and are refreshed with `npm run flags:fetch`. Translate and publish the complete Category ancestor chain before publishing Products in the new language. English must be published first and remain live while another locale is published.

Corporate shell copy such as navigation and general content pages remains code-owned. An admin-added language uses its selected fallback dictionary for that shell until a schema-compatible JSON dictionary is deployed in `frontend/src/i18n/dictionaries/` and registered in `frontend/src/i18n/get-dictionary.ts`. Database-backed Category, Product, specification, SEO, and contextual Media text can all be translated through the admin immediately.

Languages cannot currently be removed after creation because translations and immutable publication snapshots may reference their route codes. When two variants share a base language, assign explicit aliases so browser request detection remains deterministic. RTL languages additionally require layout, long-content, keyboard, and visual QA before public launch.

## Administrator bootstrap and sessions

There is no public registration endpoint. Configure `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env`, keep `ADMIN_UPDATE_EXISTING=false` for first creation, and run:

```text
npm run admin:create -w @maglive/backend
```

The command normalizes the email, hashes the password with Argon2id, and never prints the password. A duplicate fails safely unless `ADMIN_UPDATE_EXISTING=true` is deliberately set for a credential replacement; return that flag to `false` immediately afterward.

Administrator sessions use the `maglive_admin_session` HTTP-only cookie and encrypted records in MongoDB's `admin_sessions` collection. The default server-enforced idle window is 30 minutes and the absolute lifetime is 8 hours. Session IDs rotate at login, logout destroys the record, rolling cookie renewal is disabled, and MongoDB owns expired-record cleanup through a TTL index.

During local development, ports 3000 and 5000 are different origins but the same `localhost` site. Browser requests must use `credentials: "include"`; Express accepts only `FRONTEND_ORIGIN`. Production should expose the frontend and API through one HTTPS same-site reverse proxy. Set `TRUST_PROXY` to the exact proxy-hop count so Secure cookies are issued only for requests Express recognizes as HTTPS.

## Category operations

The protected category workspace is available at `/admin/categories`. It supports a root plus one child level, registry-driven localized content, sibling ordering, optimistic concurrency, independent locale publication, archive, and permanent deletion of unused drafts.

Public reads are localized and draft-safe:

- `GET /api/v1/public/categories?locale=en` returns the visible category tree.
- `GET /api/v1/public/categories/:slug?locale=en` returns one visible category.

Public category DTOs are composed only from coherent publication snapshots and validate the complete active ancestor chain. Working edits never appear publicly. English must be published first and remain published while another locale is live. Category/list reads remain `no-store`; signed invalidation infrastructure is available for future immutable snapshot caching.

Category image fields are contextual usages. The editor uses the shared media picker and stores locale-specific alt/title text with the Category usage rather than treating reusable Media defaults as final page copy. Category child creation, reparenting, locale unpublication, and permanent deletion use transaction-backed Product reference checks so they cannot invalidate working or published products.

## Product operations

Express owns the protected Product lifecycle. Incomplete working drafts may be saved, while publication separately validates templates, localized core fields, specification structure, ready role-compatible media, and the complete localized category chain. Shared changes require explicit atomic promotion across every live locale.

Protected Product endpoints:

- `GET /api/v1/admin/products`
- `POST /api/v1/admin/products`
- `GET/PATCH/DELETE /api/v1/admin/products/:id`
- `POST /api/v1/admin/products/:id/duplicate`
- `POST /api/v1/admin/products/:id/publish`
- `POST /api/v1/admin/products/:id/unpublish`
- `POST /api/v1/admin/products/:id/archive`

Every update and lifecycle command uses optimistic versions. Published slugs are immutable; duplicates reuse media references without copying stored objects; only never-published drafts can be permanently deleted.

The administrator list is one-based and bounded to 100 rows. It supports strict category, global-status, locale-publication-state, featured, and allowlisted sort filters. Search input is capped and escaped before matching slug, model, series, and names for every locale in the shared registry; regex operators and unknown query keys are rejected. Results contain list summaries rather than editing documents, use an ObjectId tie-breaker, and include collection counts plus per-locale completeness.

The protected workspace at `/admin/products` keeps validated search, filter, sort, locale, and pagination state in the URL so views survive refresh and browser navigation. Its responsive table becomes labeled Product cards on narrow screens. Each row exposes versioned duplicate, publication, unpublication, archive, and eligible never-published-draft deletion commands behind explicit confirmation, refreshes only Product list data after success, and distinguishes invalid URLs, conflicts, expired sessions, and API outages. `/admin/products/new` and `/admin/products/:id` provide a persistent multilingual editor with dirty-state protection, structured content/specification/media panels, versioned Save Draft, and explicit publication controls.

The public catalog is available at `/:locale/products`, `/:locale/products/category/:categorySlug`, and `/:locale/products/:productSlug`. It reads snapshot-only APIs, resolves products through the static Standard or Topcon Premium template registry, and returns intentional 404/503 states. Product detail pages emit localized metadata and JSON-LD; `sitemap.xml` and `robots.txt` are generated from published-only records.

Preview uses `POST /api/v1/admin/products/:id/preview` to issue a five-minute, single-use grant. Next exchanges it server-to-server at `/api/internal/preview`, stores a host-only HTTP-only credential, and renders the saved working copy with noindex/no-store semantics. `POST /api/internal/revalidate` accepts timestamped HMAC-signed invalidation events; cache correctness still relies on the uncached visibility gate.

The initial MongoDB query plans for status/category/order and status/featured/order are covered by integration tests. Substring name search, locale-aware name sorting, and derived locale-state filtering are correctness-first paths for the initial modest catalog. Adding a locale automatically adds its name path, but each locale expansion requires a query-plan/data-volume review; adopt a dedicated indexed search strategy such as Atlas Search before those paths are used at large catalog scale. Fuzzy search remains intentionally deferred.

Public Product reads are snapshot-only and currently use `no-store` semantics behind the visibility gate:

- `GET /api/v1/public/products` returns bounded localized summaries using `locale`, optional `category`/`featured`, and allowlisted pagination/sorting.
- `GET /api/v1/public/products/:slug/visibility` verifies the requested locale and complete Category ancestor chain, then returns the current `publicationRevision`.
- `GET /api/v1/public/products/:slug` requires that revision and returns a composed global/local snapshot; an obsolete revision returns `409 PUBLICATION_REVISION_CHANGED`.
- `GET /api/v1/public/sitemap-entries` returns bounded published Category/Product locale-route pairs and public snapshot timestamps.

Draft, archived, deleting, incoherent, untranslated, or category-hidden Products receive the same public 404 and never enter lists, related items, or sitemap results. Detail DTOs use shared snapshot identity/order, requested-locale content, registry-derived `availableLocales`, API-computed media URLs, and explicit `fallbackFields` when an optional value comes from reusable Media metadata or the coherent English snapshot. They never expose working translations, audit actors, storage keys, checksums, or other locale snapshots. Related Products are limited to four ordered items in the same canonical leaf category.

The sitemap feed sorts the complete modest-catalog set by canonical localized path, then applies one-based maximum-100 pagination. Next must request every page until `totalPages`; revisit this aggregation strategy before approaching sitemap protocol or in-memory catalog scale limits.

## Media operations

The protected media workspace is available at `/admin/media`. It supports immutable uploads, filename search, type filtering, localized reusable metadata, image/video/PDF previews, video posters, usage inspection, retry/cancellation feedback, and reference-aware deletion. The same picker is used by the Category editor.

Approved local uploads are JPEG, PNG, WebP, MP4, WebM, and PDF. SVG is intentionally disabled. Express streams one file into a controlled temporary directory, enforces configured limits, matches the filename extension and claimed type against its signature, derives the final extension, computes a SHA-256 checksum, and persists only metadata in MongoDB. Files are stored through `StorageProvider` beneath `backend/uploads/` using immutable UUID/date/type keys; never address files by their original names.

Image and video originals are staged below the non-public `.staging` storage prefix and submitted to BullMQ. Run Redis and provide FFmpeg/FFprobe through `FFMPEG_PATH` and `FFPROBE_PATH`; `npm run dev` starts the API, frontend, and media worker together. Production runs the API with `npm start -w @maglive/backend` and the independently scalable worker with `npm run start:worker -w @maglive/backend`. Sharp creates non-upscaled AVIF/WebP image variants, while FFmpeg creates bounded H.264 MP4 renditions with `faststart` and an optimized poster. MongoDB stores every processing stage so the SSE admin progress stream survives refreshes and reconnects.

Protected endpoints:

- `GET/POST /api/v1/admin/media`
- `GET/PATCH/DELETE /api/v1/admin/media/:id`
- `GET /api/v1/admin/media/:id/events`
- `POST /api/v1/admin/media/:id/retry`
- `GET /api/v1/admin/media/:id/usages`

Deletion first enters a transaction-protected `deleting` state so new Category, Product, and poster references fail. It then verifies every working/live Category and Product usage plus Media poster relationships, deletes the stored object, and transactionally removes the Media record. A storage failure leaves a retryable record rather than reporting false success.

## Host-independent media and flag links

Every media link is resolved against the deployment that renders it, so the same build can run on `localhost`, a bare IP address, a review domain, or production without editing data or rebuilding.

- `PUBLIC_MEDIA_BASE_URL` (backend) may be an absolute CDN/bucket URL, a root-relative path such as `/uploads`, or empty. An absolute value is used verbatim, which keeps existing deployments and CDN setups unchanged. A relative or empty value is resolved against the public origin of the current request, so `http://192.168.1.40:5000/uploads/...` or `https://shop.example.com/uploads/...` is produced automatically. Express reads `X-Forwarded-Proto`/`Host` (honouring `TRUST_PROXY`) and the `X-Public-Origin` header that the Next.js server sends for server-rendered pages.
- `MEDIA_PUBLIC_ORIGIN` (frontend) is optional. When it is set, every media link returned by the API is re-pointed at that origin before it reaches the page, which is what keeps records seeded against an old host rendering correctly after a move. Without it the links follow `NEXT_PUBLIC_API_BASE_URL`. Non-http(s) schemes are rejected.
- `NEXT_PUBLIC_API_BASE_URL` is the browser-facing API URL and the fallback source for the media origin. `API_INTERNAL_URL` stays internal-only.

Country flags are static assets that belong to the backend: `backend/assets/flags/<country>.svg` (121 countries, refreshed with `npm run flags:fetch`, sourced from `flag-icons`). The API publishes them at `/media/flags/<country>.svg` with an immutable cache and `Access-Control-Allow-Origin: *`. The website re-serves the same files on its own origin at `/flags/<country>.svg` through `frontend/src/app/flags/[country]/route.ts`, so markup only contains a relative link and flag images render identically on Windows, macOS, iOS, Android, and Linux. Languages expose the ISO 3166-1 `countryCode` (and an absolute `flagUrl` for API consumers); a language without a stored flag falls back to a two-letter badge.

## Source-control safety

Do not commit `.env` files, secrets, uploads, local MongoDB data, logs, coverage, or build output. Upload placeholder directories are intentionally retained with `.gitkeep` files.
