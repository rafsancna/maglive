# Maglive Multilingual Corporate Website

## Project Implementation Plan

| Document field | Value |
|---|---|
| Document version | 1.2 |
| Document status | Active execution baseline |
| Implementation status | Phase 1 complete |
| Task progress | 6 / 48 |
| Current phase | Phase 2 — Authentication |
| Next task | PH02-01 |
| Last updated | 2026-08-26 |
| Source of truth | This file |
| Delivery model | Next.js frontend + Express backend + contracts package |

This is the authoritative architecture, contract, delivery roadmap, and progress record for the Maglive website. Application work must be performed through the numbered task cards in Section 15. A task is complete only when its Definition of Done and verification requirements have been satisfied.

## Table of Contents

1. [Project Understanding and Scope](#1-project-understanding-and-scope)
2. [Locked Architectural Decisions](#2-locked-architectural-decisions)
3. [Multilingual Content and URL Strategy](#3-multilingual-content-and-url-strategy)
4. [Product-Template Architecture](#4-product-template-architecture)
5. [CMS Behavior](#5-cms-behavior)
6. [MongoDB Conceptual Schemas and Indexes](#6-mongodb-conceptual-schemas-and-indexes)
7. [REST API Endpoints and Response Conventions](#7-rest-api-endpoints-and-response-conventions)
8. [Media and Storage Architecture](#8-media-and-storage-architecture)
9. [Authentication and Preview Security](#9-authentication-and-preview-security)
10. [SEO, Rendering, Cache, and Performance](#10-seo-rendering-cache-and-performance)
11. [Complete Folder Structure](#11-complete-folder-structure)
12. [Error and Fallback Matrix](#12-error-and-fallback-matrix)
13. [Security Requirements](#13-security-requirements)
14. [Development Phases and Master Checklist](#14-development-phases-and-master-checklist)
15. [Atomic Implementation Tasks](#15-atomic-implementation-tasks)
16. [Testing and Release Gates](#16-testing-and-release-gates)
17. [Future Improvements](#17-future-improvements)
18. [Risks and Prohibited Patterns](#18-risks-and-prohibited-patterns)
19. [Decision Log](#19-decision-log)
20. [Progress Log](#20-progress-log)

---

## Execution Protocol

### Status convention

- [ ] Pending
- [x] Complete
- A task being worked on records Status: In progress inside its task card.
- A blocked task remains unchecked and records the blocker in Notes / results.

### Rules for every implementation session

1. Identify the exact task ID requested by the user.
2. Read this document, the task card, its dependencies, and the current progress log.
3. Inspect the repository and Git status before changing files.
4. Preserve unrelated or user-owned changes.
5. Implement only the requested task and work required by its Definition of Done.
6. Do not pull deferred work into the current task.
7. Run the task’s verification and any directly affected existing tests.
8. Fix failures caused by the task before marking it complete.
9. Update the task checkbox, Status, Notes / results, Current phase, Next task, and Progress Log.
10. Record any architectural deviation in the Decision Log before relying on it.
11. Leave every completed phase buildable and runnable.

### Change-control rules

- Locked architectural decisions may be changed only through a new Decision Log entry containing context, decision, consequences, and affected tasks.
- Do not silently rename task IDs, template IDs, API routes, model fields, or locales.
- If new work is discovered, add a new task card with a stable ID rather than expanding an unrelated completed task.
- A checked task must never hide failing verification. Reopen it if a later change invalidates its Definition of Done.

---

# 1. Project Understanding and Scope

## 1.1 Product goal

Build a professional multilingual corporate website with a focused custom CMS. The main business capability is the publication of product categories and product pages whose content is managed in the CMS while their visual design is implemented manually in React.

The system is not an e-commerce platform, multi-tenant service, generic page builder, or WordPress replacement.

## 1.2 Required version-one capabilities

- English and Simplified Chinese public routes at launch, with registry-driven support for adding more languages later.
- Administrator login, logout, session expiry, and protected CMS routes.
- Multilingual parent/child product categories.
- Local development media uploads and reusable media records.
- Multilingual products, specifications, downloads, SEO, and publication state.
- A code-owned product-template registry.
- A dependable Standard template and at least one professional custom template.
- Draft save, secure preview, publish, unpublish, archive, and duplicate workflows.
- Database-driven product and category listings.
- Localized metadata, canonical URLs, hreflang, sitemap, robots, and truthful structured data.
- Responsive, accessible, media-conscious public pages.
- Automated tests for critical API, CMS, preview, SEO, and publication behavior.

## 1.3 Explicitly outside version one

- Generic page builder or CMS-controlled layout/animation logic.
- E-commerce checkout, pricing, inventory, accounts, reviews, or orders.
- Projects, news, general-page, or site-settings CMS modules.
- Public registration, advanced RBAC, MFA, or password recovery.
- Revision history, approval workflow, or scheduled publishing.
- Localized slugs and CMS-managed redirects.
- Cloud deployment infrastructure.
- Cloud object storage, resumable upload, virus scanning, image pipelines, or video transcoding.
- Product import/export, advanced search, or translation-provider integration.

## 1.4 Success criteria

- A CMS administrator can create a category, upload media, create a multilingual product, preview it in its real coded template, and publish selected locales.
- A newly published product appears automatically in its category and at its canonical localized URL without frontend source changes.
- A new product design becomes selectable only after a developer adds and registers a coded React template.
- Drafts and unpublished translations never leak through public APIs, sitemap, metadata, or page rendering.
- Another developer can understand, run, test, and extend the system from this document and repository documentation.

---

# 2. Locked Architectural Decisions

| ID | Decision | Locked behavior |
|---|---|---|
| AD-01 | Modular monorepo | Root contains frontend, backend, and contracts workspaces. |
| AD-02 | Application boundary | Next.js owns UI/rendering; Express owns all CMS business APIs. |
| AD-03 | Next Route Handlers | Limited to Draft Mode entry/exit and signed cache invalidation. |
| AD-04 | Database | One MongoDB database accessed through Mongoose. |
| AD-05 | Shared contracts | contracts contains DTO schemas, locales, API envelopes, and template IDs only. |
| AD-06 | Translation storage | Typed locale-keyed maps embedded with their owning entity. |
| AD-07 | Slugs | One lowercase ASCII slug shared by all languages and immutable after publication. |
| AD-08 | Product URL | /[locale]/products/[productSlug]. |
| AD-09 | Category URL | /[locale]/products/category/[categorySlug]. |
| AD-10 | Category hierarchy | Nullable parentId; root plus one child level in version one. |
| AD-11 | Product category | One canonical leaf category per product. |
| AD-12 | Publication | Global product state plus independent per-locale snapshot publication. |
| AD-13 | Specifications | Ordered groups/items with stable keys and translated labels. |
| AD-14 | Media | Binary files outside MongoDB; storage provider plus Media records. |
| AD-15 | Authentication | Opaque Mongo-backed sessions in HTTP-only cookies; no browser-stored JWT. |
| AD-16 | Authorization | One administrator role; Express is the security boundary. |
| AD-17 | Templates | Static type-safe whitelist; never import a CMS-provided path. |
| AD-18 | Template data | Optional, versioned, bounded, and validated; content only. |
| AD-19 | Preview | Saved drafts, short-lived product-bound grant, and Next Draft Mode. |
| AD-20 | Rendering | Server Components by default; client islands only for interaction. |
| AD-21 | Cache | Explicit public caching and signed invalidation; admin/preview are no-store. |
| AD-22 | Rich text | Constrained Markdown-style content rendered through sanitization. |
| AD-23 | Delete behavior | Published content is archived; permanent deletion is limited to unused drafts. |
| AD-24 | Concurrency | Product and category edits use optimistic version checks. |
| AD-25 | Working versus live content | Editors modify working data; public APIs compose one immutable global publication snapshot with immutable per-locale snapshots. |
| AD-26 | Database integrity | Local, test, and production MongoDB must support transactions through a replica set. |
| AD-27 | Visibility-safe cache | Product visibility/revision is checked no-store before any cached snapshot is rendered. |
| AD-28 | Preview exchange | A single-use opaque grant is exchanged server-to-server for a short-lived signed preview credential. |
| AD-29 | Publication coherence | Shared-field promotion is explicit and atomically republishes every live locale; English must remain live while any other locale is live. |
| AD-30 | Live reference integrity | Media deletion checks working content, global snapshots, locale snapshots, and poster relationships. |
| AD-31 | Ancestor visibility | Category/product public reads and sitemap entries validate the complete active, locale-published ancestor chain. |
| AD-32 | Preview redirect identity | Next builds preview redirects only from productId/locale/slug returned by the trusted one-time exchange. |
| AD-33 | Locale extensibility | One typed registry drives enabled route codes, metadata, request detection, static parameters, and the language switcher; en and zh are the initial entries, not a fixed limit. |

## 2.1 Target technology baseline

Use supported stable releases available at Phase 1 implementation, with exact versions committed to lockfiles. The intended major-version baseline is:

- Node.js 24 LTS
- npm workspaces
- Next.js 16 App Router
- React 19
- TypeScript 5
- Tailwind CSS 4
- Express 5
- MongoDB 8
- Mongoose 9
- Zod 4
- Vitest, Testing Library, Supertest, and Playwright

Do not upgrade a major version during a later task without a Decision Log entry and full affected verification.

## 2.2 Environment defaults

    Frontend development URL: http://localhost:3000
    Backend development URL:  http://localhost:5000
    API base URL:              http://localhost:5000/api/v1
    Media base URL:            http://localhost:5000/uploads
    MongoDB:                   mongodb://localhost:27017/maglive?replicaSet=maglive-rs
    Default locale:            en
    Initially enabled locales: en, zh (expand through the typed locale registry)

Production should preferably expose Next.js and Express through one same-site reverse proxy while keeping them as separate processes.

## 2.3 Environment ownership

Frontend server-only variables:

| Variable | Purpose |
|---|---|
| SITE_URL | Absolute canonical public origin |
| API_INTERNAL_URL | Express origin used by Next server rendering |
| MEDIA_PUBLIC_ORIGIN | Exact public media origin allowed in API DTO URLs and Next image remotePatterns |
| REVALIDATION_SECRET | Verifies signed Express-to-Next invalidation |
| PREVIEW_EXCHANGE_SECRET | Authenticates Next-to-Express preview grant exchange |
| DEFAULT_LOCALE | Must match the contracts default, en |

Frontend browser-visible variables:

| Variable | Purpose |
|---|---|
| NEXT_PUBLIC_API_BASE_URL | Browser-to-Express API base for administrator requests |

Backend-only variables:

| Variable | Purpose |
|---|---|
| NODE_ENV, PORT | Runtime mode and HTTP port |
| MONGODB_URI | Database connection |
| FRONTEND_ORIGIN | Exact credentialed CORS origin |
| SESSION_SECRET | Session-cookie signing |
| PREVIEW_SIGNING_SECRET | Product-scoped preview grants |
| PREVIEW_EXCHANGE_SECRET | Authenticates the internal one-time grant exchange |
| UPLOAD_ROOT | Absolute/resolveable local storage root |
| PUBLIC_MEDIA_BASE_URL | Public URL prefix computed into DTOs |
| MAX_IMAGE_BYTES | Image upload limit |
| MAX_VIDEO_BYTES | Video upload limit |
| MAX_DOCUMENT_BYTES | PDF upload limit |
| NEXT_REVALIDATION_URL | Internal Next invalidation endpoint |
| NEXT_REVALIDATION_SECRET | HMAC signing for invalidation events |
| TRUST_PROXY | Explicit proxy-hop configuration |

No secret is duplicated into a NEXT_PUBLIC variable. All environments use separate values and databases.

---

# 3. Multilingual Content and URL Strategy

## 3.1 Locale registry

The contracts package defines the only supported locale registry. The initial enabled entries are:

| Route code | Language tag | Direction | Default fallback |
|---|---|---|---|
| en | en | ltr | en |
| zh | zh-Hans | ltr | en |

This table is an initial launch set, not a two-language ceiling. Shared UI and routing code must iterate the registry; it must never use binary locale conditionals such as `locale === "zh"`. Adding a locale adds one registry entry, one schema-compatible frontend dictionary, one static dictionary loader, CMS/editor coverage, localized metadata and publication coverage, and tests. The registry owns the route code, BCP 47 language tag, direction, fallback, native display name, and any exact `Accept-Language` aliases. Static dictionary imports remain intentional so a new registry locale fails type-checking until its dictionary loader exists. RTL locales additionally set direction to rtl and require layout, long-content, keyboard, and visual QA.

## 3.2 Translation representation

Use typed maps conceptually equivalent to:

    type TranslationMap<T> = Partial<Record<LocaleCode, T>>

Mongoose stores these as Map values with typed subdocuments, never Schema.Types.Mixed. API DTO mappers serialize maps as ordinary JSON objects.

Use entity-level maps:

- Product translations contain the product’s language-owned editorial fields.
- Category translations contain the category’s name, description, state, and SEO.
- Specification groups/items contain maps for translated labels and optional display overrides.
- Product-media usages contain maps for contextual alt text, title, and caption.
- Media may contain reusable default metadata, overridden by usage metadata when necessary.

Every requested locale is validated against the locale registry before it is used in a query or dotted update path.

## 3.3 Working content and translation publication

The editor always changes working content. Live Product and Category documents separate one immutable publishedGlobal snapshot from immutable publishedSnapshots[locale] entries. publishedGlobal owns every shared public field; each locale snapshot owns only language-specific content and carries the exact globalRevision it was validated against. Public APIs compose these snapshots and never read working translations, specifications, media usages, category selection, hierarchy, or template data.

For a Product, the global snapshot owns slug, category, model/series, stable specification structure and invariant values, media identities/roles/order/locale applicability, selected template and validated templateData, display order, and featured state. Its locale snapshot owns editorial/SEO content, translated specification labels/overrides, and contextual media text for that locale. Category global and locale snapshots use the same split for hierarchy/order/media identity versus translated content/SEO/contextual media text.

First publication creates both the global and English locale snapshots. A later locale-only publication is allowed only when the working shared-field hash equals publishedGlobal.sourceHash. If shared fields changed, the request must explicitly opt into shared promotion and include every currently live locale plus the requested locale. The service validates every included working locale and atomically replaces publishedGlobal and all live locale snapshots with one new globalRevision; any validation failure rejects the whole operation. This prevents different locale URLs from exposing different canonical category, model, specification structure, media set, or template.

Consequences:

- Saving edits to an already-live product never changes the public page.
- Preview reads the saved working copy.
- Publishing replaces only the selected locale snapshot when shared fields are unchanged.
- Shared-field promotion is a distinct confirmed action that atomically republishes all live locales against one global revision.
- A locale with no snapshot is unpublished.
- Global and locale source hashes independently drive Changes pending indicators while the previous snapshots remain public.
- English cannot be unpublished while another locale remains published. Unpublish additional locales first, unpublish all locales atomically, or archive the entity.
- Unpublishing the last locale removes publishedGlobal and returns the product to draft.
- Archiving hides every snapshot without deleting working or published data.

A public product locale exists only when:

1. The product global status is published.
2. publishedGlobal exists and publishedSnapshots contains the requested locale with the same globalRevision.
3. Its referenced category and every ancestor are active, have coherent global snapshots, and have locale snapshots for the requested locale.
4. Neither the product nor any category in that ancestor chain is in an archived/deleting transition.

English must pass validation and receive a snapshot before the product can first become globally published. Additional locales publish independently while the shared-field coherence and English-retention rules above remain satisfied.

Publication validation checks these core localized fields before creating a snapshot:

- Product name
- Short description
- Long description when required by the selected template
- SEO title or enough localized data to derive one
- SEO description or enough localized data to derive one
- Required template text

Optional fields may fall back to English only after the requested locale has passed core publication validation. The public DTO reports fallback fields internally for diagnostics; fallback markers are not exposed as editable layout controls.

An unpublished or incomplete working locale:

- Returns localized 404 at its locale URL.
- Is absent from listings for that locale.
- Is absent from hreflang and sitemap.
- Is disabled or marked unavailable in the language switcher.

Categories use the same working/global/locale snapshot rule. English must publish first and remain published while another locale is live. A child category locale cannot publish until its parent and complete ancestor chain have coherent published snapshots for that locale.

## 3.4 URL and language switching

Canonical routes:

    /en/products/630w-topcon
    /zh/products/630w-topcon
    /en/products/category/solar-modules
    /zh/products/category/solar-modules

The language switcher replaces the locale segment while preserving the entity slug. Product and category DTOs expose availableLocales derived only from coherent live snapshots; the switcher verifies membership before linking. It never sends an entity visitor back to the homepage unnecessarily.

Locale detection runs only for public URLs without a locale:

1. Saved locale cookie
2. Accept-Language match
3. Default English

It excludes admin routes, Next internals, internal Route Handlers, uploads, and static files. An explicitly localized URL is never auto-redirected to another language.

## 3.5 Slug policy

- Lowercase ASCII letters, digits, and hyphens only.
- No leading, trailing, or repeated hyphens.
- Reserved product slugs include category, new, edit, admin, api, preview, and uploads.
- Unique within its entity type using a unique MongoDB index.
- Editable while the entity has never been published.
- Immutable after first publication in version one.
- Localized slugs and redirect history require a future Redirect model and migration.

## 3.6 Public route map

    /
      → locale detection redirect

    /[locale]
    /[locale]/about
    /[locale]/products
    /[locale]/products/category/[categorySlug]
    /[locale]/products/[productSlug]
    /[locale]/projects
    /[locale]/news
    /[locale]/news/[slug]
    /[locale]/downloads
    /[locale]/contact

    /admin/login
    /admin
    /admin/products
    /admin/products/new
    /admin/products/[id]
    /admin/categories
    /admin/media

News detail exists as a code-owned route shell only until the NewsArticle CMS is approved. It must not query a nonexistent API.

---

# 4. Product-Template Architecture

## 4.1 Data flow

    Product.pageTemplate
        → shared template ID contract
        → serializable frontend catalog
        → server-only component registry
        → ProductPageRenderer
        → normalized ProductPageViewModel
        → manually coded React template

The CMS controls content. React code controls hierarchy, visual design, responsive behavior, animation, and component composition.

## 4.2 Registry responsibilities

- contracts/product-template defines immutable template IDs and optional templateData schemas.
- catalog.ts contains ID, administrator-facing label, version, and availability; it imports no React component.
- registry.server.ts statically maps every ID to its loader.
- ProductPageRenderer validates the ID, chooses the component, and passes one normalized view model.
- The CMS selector imports catalog metadata only, preventing product templates from entering the admin client bundle.

The registry must satisfy a complete Record of ProductTemplateId to loader at TypeScript compile time.

Administrator create/update/publish contracts accept ProductTemplateId only. Public read contracts accept a bounded kebab-case template string at the transport edge, then explicitly narrow it with isProductTemplateId. This limited legacy path allows an old stored ID to reach the Standard resilience fallback without permitting arbitrary imports or weakening normal write validation.

## 4.3 Template component contract

Every product template receives:

    ProductTemplateProps {
      product: ProductPageViewModel
      locale: LocaleCode
      preview: boolean
    }

The view model contains already localized, sorted, public-safe content and computed media URLs. Templates do not:

- Access Mongoose or Express.
- Fetch their own product.
- Resolve translation fallback.
- Construct storage URLs.
- Hardcode product names, model numbers, images, downloads, or CMS copy.
- Inspect arbitrary transport fields.

## 4.4 Reusable versus template-local code

Shared components own stable behavior and accessibility:

- Navbar, footer, breadcrumb, and locale switcher
- Specifications
- Image gallery
- Video player
- Downloads
- Certifications
- Related products
- Enquiry CTA
- Buttons, dialogs, fields, and layout primitives

Template-local components own composition and distinct art direction. A component moves to shared product components only after at least two templates need a stable generic API.

## 4.5 Template-specific data

Do not add templateData during the Standard template implementation. When a real design cannot use common fields:

- Define a versioned Zod schema in contracts.
- Set strict object depth, string, and array limits.
- Add a deliberately coded administrator editor panel.
- Validate on save and again on publish.
- Add fixture and migration tests.
- Store content only—never component names, class names, CSS, animation timelines, or layout coordinates.

Breaking changes use a new schema version or new template ID until existing products are migrated.

## 4.6 Template creation procedure

1. Confirm an existing template cannot satisfy the design.
2. Add the immutable ID and optional schema to contracts.
3. Create a focused template directory.
4. Add catalog metadata and a server registry loader.
5. Add an admin editor panel only when unique fields exist.
6. Test empty, partial, complete, long English, and long Chinese fixtures.
7. Render two products through the same template to prove no hardcoding.
8. Deploy template code before allowing the CMS to publish products using it.

---

# 5. CMS Behavior

## 5.1 Version-one navigation

    Dashboard
    Products
    Categories
    Media
    Logout

Projects, News, Settings, and Users are not shown until implemented.

## 5.2 Product list

The list supports:

- Search by localized name, slug, model, or series.
- Category, global status, and featured filters.
- Bounded page and page-size parameters.
- Stable sorting.
- Translation-state indicators.
- Edit, duplicate, preview, publish/unpublish, archive, and confirmed draft delete.

Search/filter/pagination state is represented in the URL so refresh and back/forward navigation preserve it.

## 5.3 Product editor

Sections:

    Basic Information
    Content
    Specifications
    Media
    Downloads
    SEO
    Page Template
    Publishing

The language selector remains visible and shows Draft, Complete, or Published for each language. Switching tabs must not discard unsaved in-memory edits.

Version-one editor controls:

- Explicit Save Draft.
- Preview Saved Draft.
- Publish current translation.
- Explicitly promote shared changes across every live locale when required.
- Publish, unpublish, and archive product while enforcing English retention.
- Dirty-state navigation warning.
- Backend field-error mapping.
- Optimistic concurrency conflict message and reload option.

Autosave, revisions, simultaneous collaborative editing, approvals, and scheduled publication are deferred.

## 5.4 Duplicate, archive, and delete behavior

Duplicate:

- Creates a new draft with a unique slug suffix.
- Copies translations, specifications, template, and media references.
- Does not copy physical files.
- Clears first-publication metadata, publishedGlobal, and every locale snapshot.

Archive:

- Hides all locales from public APIs and pages.
- Preserves content and references.

Permanent delete:

- Allowed only for never-published drafts.
- Requires confirmation and current version.
- Does not delete shared media.

Categories and media with active references return a deterministic 409 conflict instead of cascading.

## 5.5 Category lifecycle

- Category forms edit working translations and contextual image metadata.
- First publication creates publishedGlobal and the English locale snapshot together.
- Publishing a locale validates its working content, media, and complete ancestor snapshot chain, then atomically promotes a PublishedCategoryLocaleSnapshot.
- When shared hierarchy/order/media identity changed, an explicit shared promotion republishes every live locale atomically against one new globalRevision.
- Editing an already-published category produces Changes pending while the existing snapshot remains public.
- English cannot be unpublished while another locale remains live; all child/product locale dependencies must also permit the operation.
- Archiving hides the category plus all descendant/product routes whose full ancestor chain depends on it, without deleting snapshots.
- A category that has ever been published cannot be permanently deleted in version one.
- Permanent delete requires never-published state, no children, no products, no deleting transition conflict, and the current version.
- firstPublishedAt records whether permanent deletion is ever eligible.

## 5.6 Product creation workflow

    Administrator creates a draft
      → selects a leaf category and registered template ID
      → enters model/series and English content
      → adds Chinese content independently
      → adds structured features/applications/specifications
      → uploads or selects reusable media
      → assigns media roles and localized usage metadata
      → adds downloads and localized SEO
      → saves the versioned draft
      → previews the saved draft in the actual template
      → publishes English and any other complete locales
      → Express commits publication and requests cache invalidation
      → public listings/detail/sitemap reflect the product

No physical page file is generated for a product. Only creating a new visual template requires frontend source work.

---

# 6. MongoDB Conceptual Schemas and Indexes

## 6.1 User

    User {
      emailNormalized: string
      passwordHash: string
      role: "admin"
      active: boolean
      lastLoginAt?: Date
      passwordChangedAt?: Date
      createdAt: Date
      updatedAt: Date
    }

Indexes:

- Unique emailNormalized.
- Optional active index only if operational queries justify it.

Password hashes are excluded from normal query serialization.

## 6.2 Session

Managed by the Mongo session-store adapter:

    Session {
      sessionId
      sessionData
      expiresAt
    }

expiresAt has a TTL index. The default Express in-memory store is forbidden outside tests.

## 6.3 PreviewGrant infrastructure record

This short-lived infrastructure collection supports single-use preview exchange:

    PreviewGrant {
      tokenHash: string
      productId: ObjectId
      locale: LocaleCode
      productVersion: number
      administratorId: ObjectId
      expiresAt: Date
      consumedAt?: Date
      createdAt: Date
    }

Indexes:

- Unique tokenHash.
- TTL expiresAt.

Only a random opaque value is placed in the preview URL; MongoDB stores its hash. Exchange atomically sets consumedAt only when it is absent and the grant has not expired.

## 6.4 Category

    Category {
      slug: string
      parentId?: ObjectId
      sortOrder: number
      translations: Map<locale, {
        name: string
        description?: string
        seo: {
          title?: string
          description?: string
          openGraphMediaId?: ObjectId
        }
      }>
      image?: {
        mediaId: ObjectId
        translations: Map<locale, {
          alt?: string
          title?: string
        }>
      }
      publishedGlobal?: {
        sourceVersion: number
        sourceHash: string
        globalRevision: string
        publishedAt: Date
        data: PublishedCategoryGlobalSnapshot
      }
      publishedSnapshots: Map<locale, {
        sourceVersion: number
        sourceHash: string
        globalRevision: string
        publishedAt: Date
        data: PublishedCategoryLocaleSnapshot
      }>
      status: "active" | "archived" | "deleting"
      firstPublishedAt?: Date
      createdBy: ObjectId
      updatedBy: ObjectId
      createdAt: Date
      updatedAt: Date
      version: number
    }

Indexes:

- Unique slug.
- parentId + sortOrder.
- status.

Service rules:

- No self-parent, descendant parent, cycle, or depth beyond two levels.
- Products reference leaf categories.
- First publish atomically creates publishedGlobal plus English; English remains required while any other locale is live.
- A locale-only publish is permitted only when the working shared hash matches publishedGlobal.sourceHash.
- Explicit shared promotion validates every live locale and atomically replaces the global snapshot and all live locale snapshots with one globalRevision.
- Public APIs compose PublishedCategoryGlobalSnapshot and the requested matching PublishedCategoryLocaleSnapshot only.
- Public category DTOs derive availableLocales from coherent locale snapshots and validate the complete active ancestor chain.
- Published categories archive rather than permanently delete.
- Reference-sensitive category operations run in a MongoDB transaction.
- A transient deleting state blocks new children/products while deletion rechecks references.
- Delete rejects categories with children or products.
- Reorder accepts the complete sibling ID list and uses one bulk write.

## 6.5 Media

    Media {
      kind: "image" | "video" | "document"
      storage: {
        provider: "local" | "s3" | "r2" | "oss"
        key: string
      }
      originalName: string
      mimeType: string
      sizeBytes: number
      checksum?: string
      width?: number
      height?: number
      durationSeconds?: number
      posterMediaId?: ObjectId
      defaultTranslations: Map<locale, {
        title?: string
        alt?: string
        caption?: string
      }>
      status: "processing" | "ready" | "failed" | "deleting"
      uploadedBy: ObjectId
      createdAt: Date
      updatedAt: Date
    }

Indexes:

- kind + createdAt descending.
- status + createdAt descending.
- Optional checksum after duplicate detection becomes a requirement.

The API computes a public URL. It never exposes internal absolute paths.

posterMediaId must reference a distinct ready image. Media usage reporting and deletion checks include Media-to-Media poster references. Setting, changing, and deleting poster relationships use transaction-backed reference validation.

## 6.6 Product specifications

    SpecificationGroup {
      key: string
      order: number
      translations: Map<locale, {
        label: string
      }>
      items: [{
        key: string
        order: number
        value: string
        unit?: string
        translations: Map<locale, {
          label: string
          valueOverride?: string
          note?: string
        }>
      }]
    }

Rules:

- Group keys are unique within a product.
- Item keys are unique within a group.
- Stable keys, not translated labels, are used by templates.
- Group/item counts and string lengths are bounded.
- value is presentation-oriented in version one; typed numeric filtering is deferred.

## 6.7 Product media usage

    ProductMediaUsage {
      mediaId: ObjectId
      role:
        "hero" | "gallery" | "video" | "backgroundVideo" |
        "datasheet" | "certificate" | "brochure" |
        "document" | "openGraph"
      order: number
      locale?: LocaleCode
      translations: Map<locale, {
        alt?: string
        title?: string
        caption?: string
      }>
    }

No locale means the asset is shared. Separate usages support language-specific PDFs. Contextual usage metadata overrides Media defaults.

## 6.8 Product

    Product {
      slug: string
      categoryId: ObjectId
      model?: string
      series?: string
      translations: Map<locale, {
        name: string
        shortDescription?: string
        longDescriptionMarkdown?: string
        features: [{
          key: string
          title: string
          body?: string
          iconMediaId?: ObjectId
        }]
        advantages: [{
          key: string
          title: string
          body?: string
        }]
        applications: [{
          key: string
          title: string
          body?: string
        }]
        warrantyInformation?: string
        seo: {
          title?: string
          description?: string
          keywords?: string[]
          openGraphTitle?: string
          openGraphDescription?: string
          openGraphMediaId?: ObjectId
        }
      }>
      specifications: SpecificationGroup[]
      mediaUsages: ProductMediaUsage[]
      pageTemplate: ProductTemplateId
      templateData?: {
        schemaVersion: number
        data: unknown
      }
      displayOrder: number
      featured: boolean
      publishedGlobal?: {
        sourceVersion: number
        sourceHash: string
        globalRevision: string
        publishedAt: Date
        data: PublishedProductGlobalSnapshot
      }
      publishedSnapshots: Map<locale, {
        sourceVersion: number
        sourceHash: string
        globalRevision: string
        publicationRevision: string
        publishedAt: Date
        data: PublishedProductLocaleSnapshot
      }>
      status: "draft" | "published" | "archived" | "deleting"
      firstPublishedAt?: Date
      createdBy: ObjectId
      updatedBy: ObjectId
      createdAt: Date
      updatedAt: Date
      version: number
    }

templateData enters the application as unknown and is accepted only after its template-specific schema parses it.

PublishedProductGlobalSnapshot is a bounded, public-safe copy of shared working fields. PublishedProductLocaleSnapshot contains only the requested locale’s editorial/SEO content, translated specification data, and contextual media text. The public PublishedProduct DTO is composed only when the locale snapshot’s globalRevision equals publishedGlobal.globalRevision; neither snapshot includes administrator/audit/internal-storage data, and public APIs never reconstruct live content from working fields.

The global sourceHash and each locale sourceHash are computed from separate canonical working projections. A locale publicationRevision is a new opaque value for each successful locale publication and participates in the cache key; a shared promotion assigns new locale revisions to every republished locale. Application validation caps the complete Product BSON document at 8 MiB, including all working data and published snapshots, leaving safety margin beneath MongoDB’s hard document limit.

Indexes:

- Unique slug.
- status + categoryId + displayOrder.
- status + featured + displayOrder.
- categoryId.
- updatedAt descending.

Admin search starts with escaped, length-limited queries over slug, model, series, and default-language name. A search service is deferred until real catalog volume requires it.

## 6.9 Future models

Project, NewsArticle, SiteSettings, Redirect, and AuditLog remain separate future models. Do not create a universal Content model.

---

# 7. REST API Endpoints and Response Conventions

## 7.1 Namespaces

    /api/v1/public/*
    /api/v1/admin/*
    /api/v1/preview/*

## 7.2 Public endpoints

| Method | Endpoint | Behavior |
|---|---|---|
| GET | /api/v1/health | Liveness/readiness without private configuration. |
| GET | /api/v1/public/categories | Published localized categories with availableLocales; optional ordered tree; archived/deleting ancestor chains excluded. |
| GET | /api/v1/public/categories/:slug | Published localized category, availableLocales, and coherent active breadcrumbs. |
| GET | /api/v1/public/products | Published localized summaries with bounded filters/pagination. |
| GET | /api/v1/public/products/:slug/visibility | No-store locale visibility and publicationRevision gate. |
| GET | /api/v1/public/products/:slug | Composed published global/local DTO by canonical slug and required locale revision. |
| GET | /api/v1/public/sitemap-entries | Paginated canonical route and update data if needed. |

Product-list query allowlist:

    locale
    category
    featured
    page
    limit
    sort

Public services always require coherent global/locale snapshots plus an active, non-deleting complete category ancestor chain for the requested locale. There is no includeDraft flag.

## 7.3 Authentication endpoints

| Method | Endpoint | Behavior |
|---|---|---|
| GET | /api/v1/admin/auth/csrf | Creates/reuses a minimal pre-auth or authenticated session and returns its CSRF token. |
| POST | /api/v1/admin/auth/login | Requires pre-auth CSRF plus Origin validation, authenticates, rotates the session ID, and returns a replacement CSRF token. |
| POST | /api/v1/admin/auth/logout | Requires authenticated CSRF/Origin validation, destroys the server session, and clears the cookie. |
| GET | /api/v1/admin/auth/me | Returns the current safe administrator DTO. |

## 7.4 Category admin endpoints

| Method | Endpoint | Behavior |
|---|---|---|
| GET | /api/v1/admin/categories | Full editing list/tree. |
| POST | /api/v1/admin/categories | Creates a category draft. |
| GET | /api/v1/admin/categories/:id | Returns the complete editing DTO. |
| PATCH | /api/v1/admin/categories/:id | Allowlisted update with version check. |
| DELETE | /api/v1/admin/categories/:id | Deletes only when unreferenced. |
| POST | /api/v1/admin/categories/reorder | Reorders a complete sibling set. |
| POST | /api/v1/admin/categories/:id/publish | Validates selected locales; supports explicit promoteShared all-live-locale promotion. |
| POST | /api/v1/admin/categories/:id/unpublish | Removes selected locale snapshots. |
| POST | /api/v1/admin/categories/:id/archive | Hides all category snapshots without deleting data. |

## 7.5 Media admin endpoints

| Method | Endpoint | Behavior |
|---|---|---|
| GET | /api/v1/admin/media | Search/filter/paginate media. |
| POST | /api/v1/admin/media | Authenticated multipart upload. |
| GET | /api/v1/admin/media/:id | Complete metadata DTO. |
| PATCH | /api/v1/admin/media/:id | Updates metadata only. |
| GET | /api/v1/admin/media/:id/usages | Lists references blocking deletion. |
| DELETE | /api/v1/admin/media/:id | Deletes unreferenced record and stored object. |

File replacement is a new upload followed by explicit reference changes; the existing storage key is never overwritten.

## 7.6 Product admin endpoints

| Method | Endpoint | Behavior |
|---|---|---|
| GET | /api/v1/admin/products | Search/filter/paginate all products. |
| POST | /api/v1/admin/products | Creates a draft. |
| GET | /api/v1/admin/products/:id | Complete editing DTO. |
| PATCH | /api/v1/admin/products/:id | Allowlisted update with version check. |
| DELETE | /api/v1/admin/products/:id | Permanently deletes an unused, never-published draft. |
| POST | /api/v1/admin/products/:id/duplicate | Copies content/references into a new draft. |
| POST | /api/v1/admin/products/:id/publish | Validates locale set and optional explicit promoteShared all-live-locale promotion. |
| POST | /api/v1/admin/products/:id/unpublish | Unpublishes selected locales or the product. |
| POST | /api/v1/admin/products/:id/archive | Archives the product. |
| POST | /api/v1/admin/products/:id/preview-token | Issues a short-lived product-bound grant. |

Category/Product publish command bodies contain expectedVersion, a nonempty allowlisted locales array, and promoteShared defaulting false. When shared working hashes differ, promoteShared must be true and locales must equal the union of every currently live locale and the requested additions; the server computes that required set and never trusts the client to omit a live locale. Unpublish commands also require expectedVersion and explicit locales or all: true, with English-retention validation.

## 7.7 Preview endpoints

| Method | Endpoint | Behavior |
|---|---|---|
| POST | /api/v1/preview/exchange | Internal Next-only, atomically consumes one opaque grant and returns a signed access credential plus verified productId, locale, and canonical slug. |
| GET | /api/v1/preview/products/:id | Returns draft-capable DTO only with a matching preview grant. |

The exchange requires PREVIEW_EXCHANGE_SECRET in a constant-time validated internal header. Its redirect fields come from the consumed grant and current version-matched Product, never caller-provided URL data. The product-read endpoint requires the signed preview access credential in an Authorization header forwarded by the Next server. Preview credentials cannot authorize any admin endpoint.

## 7.8 API layer flow

    route
      → authentication / CSRF / rate limit
      → Zod request validation
      → thin controller
      → service business rules
      → Mongoose model or StorageProvider
      → DTO mapper
      → response

Controllers do not contain publication, hierarchy, storage, duplication, or reference-integrity logic. No repository layer is introduced in version one.

## 7.9 Response envelopes

Success:

    {
      "data": {},
      "meta": {
        "page": 1,
        "limit": 20,
        "total": 48,
        "totalPages": 3
      }
    }

Error:

    {
      "error": {
        "code": "CATEGORY_IN_USE",
        "message": "The category still has references.",
        "fieldErrors": [],
        "requestId": "..."
      }
    }

Never expose production stack traces, database errors, storage paths, password hashes, sessions, preview secrets, audit internals, or all translations through public DTOs.

## 7.10 HTTP status policy

| Status | Use |
|---|---|
| 400 | Malformed request or unsupported query syntax |
| 401 | Missing/expired authentication |
| 403 | Authenticated but CSRF/origin/action forbidden |
| 404 | Public entity/locale absent, or resource ID absent |
| 409 | Duplicate slug, stale editor/publication revision, or referenced deletion |
| 413 | File/request too large |
| 415 | Unsupported or mismatched media type |
| 422 | Well-formed request that fails field/business validation |
| 429 | Rate limit |
| 500 | Unexpected internal failure |
| 503 | Required dependency temporarily unavailable |

---

# 8. Media and Storage Architecture

## 8.1 Storage interface

    interface StorageProvider {
      save(input): Promise<StoredObject>
      delete(reference): Promise<void>
      exists(reference): Promise<boolean>
      getPublicUrl(reference): string
    }

Services store provider and key. Controllers and models do not resolve disk paths.

## 8.2 Local layout

    backend/uploads/
      images/YYYY/MM/<uuid>.<validated-extension>
      videos/YYYY/MM/<uuid>.<validated-extension>
      documents/YYYY/MM/<uuid>.<validated-extension>

The upload root is configured, resolved to an absolute path at startup, verified to remain outside executable source directories, and ignored by Git except placeholder files.

## 8.3 Upload pipeline

    authenticated multipart request
      → file count and request limits
      → temporary disk file
      → content-signature and MIME validation
      → type-specific checks
      → UUID storage key
      → provider save/move
      → metadata extraction
      → Media document creation
      → cleanup object/temp file if persistence fails

Large videos are never fully buffered in process memory.

## 8.4 Allowed media policy

- Images: JPEG, PNG, WebP; configurable maximum size; dimensions required.
- Videos: MP4 and WebM; configurable maximum size; poster strongly required for publication.
- Documents: PDF; configurable maximum size.
- SVG: disabled until a tested sanitizer and restrictive serving policy are deliberately implemented.

Original filenames are display/audit metadata only. Final names and extensions come from validated content, not the browser.

## 8.5 Delivery and caching

Development media is served at:

    http://localhost:5000/uploads/<storage-key>

Use:

- Correct Content-Type.
- X-Content-Type-Options: nosniff.
- Range support for video where the serving layer supports it.
- Long immutable caching for UUID URLs.
- Content-Disposition attachment for downloads where appropriate.
- Strict Next.js image remotePatterns for the configured media host.

## 8.6 Integrity and migration

- MongoDB runs as a transaction-capable replica set in local, test, and production environments.
- Reference-sensitive database changes use Mongoose sessions/transactions.
- Category/Media deletion first enters a transient deleting state that all reference-creating services reject, then rechecks references before destructive work.
- Category child creation/reparenting and Product category assignment use transactions and enforce that a referenced product category remains a leaf.
- Before media deletion, query every working Category/Product reference, every publishedGlobal and per-locale Category/Product snapshot reference, SEO/icon usage, and Media.posterMediaId. Removing an asset from working content does not release it while an older live snapshot still uses it.
- posterMediaId must be a ready image, cannot reference itself, and participates in usage/deletion conflicts.
- Referenced deletion returns 409 and usage details.
- Deleting a product never deletes shared media.
- Replacement creates a new immutable object.
- Filesystem/object-store work is outside MongoDB transactions: a failed object delete leaves the Media record in deleting/failed cleanup state for safe retry instead of pretending success.
- Store provider per Media record so local and object-storage assets can coexist during migration.
- S3, R2, and OSS adapters must pass the same storage contract tests before activation.

Local media is publicly retrievable by URL and is not appropriate for confidential assets.

---

# 9. Authentication and Preview Security

## 9.1 Administrator authentication

Use express-session with a Mongo-backed production store.

Cookie policy:

- Opaque identifier only.
- HTTP-only.
- Secure in production.
- SameSite Lax or Strict according to the final same-site topology.
- Path and host scoped deliberately.
- Short idle timeout and documented absolute lifetime.
- Rotated after successful login.
- Cleared and server record destroyed on logout.

Password policy:

- Argon2id where operationally supported; otherwise reviewed bcrypt settings.
- Never store or log plaintext.
- Generic invalid-credential response.
- Rate limit by IP and normalized account identifier.
- No public registration.
- Initial user created by an idempotent CLI command that never embeds credentials.

## 9.2 Request protection

- Exact FRONTEND_ORIGIN allowlist; never wildcard with credentials.
- GET csrf may create a minimal anonymous pre-auth session and token so the login request itself can be protected.
- POST login requires that pre-auth CSRF token plus Origin validation. On success, regenerate the session ID, discard the anonymous token, and return a new CSRF token bound to the authenticated session.
- Every later state-changing authenticated request, including logout, requires the current authenticated-session token; tokens from before rotation fail.
- Origin and, where appropriate, Referer validation.
- Backend requireAdmin middleware on every admin route.
- Next admin checks are a user-experience guard only.
- Admin/auth/preview responses use Cache-Control: no-store.
- Secrets never use NEXT_PUBLIC prefixes.

## 9.3 Preview flow

1. Administrator saves the product draft.
2. Administrator requests a preview grant for product ID and locale.
3. Express first requires a valid unique canonical working slug, then generates 256 bits of randomness, stores only its hash in PreviewGrant with product, locale, administrator, current working version, consumedAt null, and a five-minute TTL, and returns a Next preview URL containing only the opaque value.
4. Browser opens the Next internal preview handler using a no-referrer response policy.
5. The Next server posts the opaque grant to /api/v1/preview/exchange with PREVIEW_EXCHANGE_SECRET.
6. Express atomically matches an unexpired, unconsumed hash and sets consumedAt. Reuse fails.
7. Express returns a signed five-minute preview access credential plus verified productId, locale, and canonical slug obtained from the consumed grant and version-matched Product.
8. Next enables Draft Mode and stores the access credential in a host-only HTTP-only, production Secure, SameSite Lax cookie scoped to Path=/ with matching expiry.
9. Next validates the exchange response and constructs the canonical product path only from its verified locale and slug, then redirects with the opaque grant removed from URL/history.
10. The product page detects Draft Mode, reads the credential server-side, and forwards it as Authorization: Preview <credential> to the protected preview read endpoint with no-store.
11. Express verifies signature/claims/current working version and returns working data for only that product locale.
12. The same ProductPageRenderer renders the actual selected template.
13. Exit clears Draft Mode and the preview credential cookie.

Preview requirements:

- noindex, nofollow.
- No sitemap, hreflang, or analytics page-view entry.
- No public product endpoint fallback.
- Reject arbitrary redirect targets.
- Expired, consumed, modified, stale-version, wrong-product, or wrong-locale grants/credentials fail.
- Draft Mode’s bypass cookie alone never authorizes draft API access.
- Version one previews saved content only.

---

# 10. SEO, Rendering, Cache, and Performance

## 10.1 Rendering policy

- Code-owned corporate pages: static generation.
- Product detail routes: dynamic Server Components that first perform an uncached visibility/revision gate, then read a cached immutable published snapshot keyed by publicationRevision.
- Category trees/listings and product listings: no-store Server Component data in version one because membership and visibility can change independently.
- Initial correctness phase: all catalog fetches remain dynamic until the visibility gate and invalidation are implemented and tested.
- Mature product detail: cached snapshot data with explicit tags and fallback interval; the route itself remains visibility-gated.
- Admin and preview: dynamic no-store.
- Client Components: interaction and animation islands only.

Pin the Next.js caching model used by the selected major version. Do not mix incompatible cache models or rely on implicit fetch defaults.

## 10.2 Metadata policy

Every indexable localized page emits:

- Localized title and description.
- Self-referencing canonical.
- Alternates for published translations only.
- x-default pointing to English only when that exact English canonical is indexable. Version one’s English-first/English-retention publication rule guarantees this for every live Product and Category; code-owned localized routes always provide English.
- OpenGraph title, description, locale, image, alt, and dimensions.
- Twitter/X summary_large_image when an appropriate image exists.
- Correct html lang and dir.

Every genuine translation canonicalizes to itself. Missing locale pages are not represented as alternate URLs.

## 10.3 Structured data

- Organization and optionally WebSite at site level.
- BreadcrumbList on categories and products.
- Product only with visible, truthful data.
- BlogPosting only when the future news module exists.
- Never fabricate price, offer, availability, review, or rating data.
- Use canonical absolute URLs and localized visible values.
- Safely serialize JSON-LD so CMS content cannot close the script context.

## 10.4 Sitemap and robots

- Include canonical URLs for published locales only.
- Include reciprocal language alternates.
- Use real entity updatedAt values.
- Exclude admin, preview, drafts, archived entities, and untranslated locale variants.
- Split only near sitemap protocol limits.
- robots disallows admin/internal preview paths but is never treated as access control.
- Non-production environments emit global noindex behavior.

## 10.5 Cache invalidation

Tag vocabulary:

    products
    product:<slug>
    categories
    category:<categorySlug>
    media:<mediaId>
    sitemap

Visibility-safe product read:

1. Next requests /products/:slug/visibility?locale with no-store.
2. Express validates the Product snapshots plus the referenced category’s complete active, non-deleting, locale-published ancestor chain. A hidden/unpublished/archived result returns 404; an API outage returns 503.
3. A visible response returns publicationRevision.
4. Next requests the published snapshot with that required revision as part of the cache key.
5. Express rejects a mismatched/obsolete revision rather than returning different content under an old key.

This gate makes a successful product or ancestor-category unpublish/archive invisible immediately even if a purge callback fails, and a newly published revision cannot be confused with an older cached snapshot. Category routes, product/category listings, related products, and sitemap entries independently apply the same complete-ancestor predicate and remain no-store in version one. Revalidation improves cache hygiene and sitemap/category freshness but is not the sole visibility control.

After product publish/update/category move/locale publication/unpublish/archive, category create/update/reorder/publish/unpublish/archive/delete, or public-facing media metadata/poster change, Express calls a signed internal Next endpoint with:

- Operation
- Entity ID
- Old and new slug where applicable
- Old and new category where applicable
- Affected locales
- Timestamp and replay-protected signature

Invalidate product detail snapshots, products, categories, affected category IDs/slugs, affected media IDs, and sitemap as applicable. Unpublish/archive uses immediate invalidation semantics. A moderate time-based fallback protects against orphaned cache entries. Callback failure is logged and shown to the administrator rather than being silently ignored; the uncached visibility/revision gate preserves correctness.

An API network failure is not converted to notFound and must not create a cached false 404.

## 10.6 Media and client performance

- Server Components by default.
- Correct image width/height or aspect ratio.
- Accurate responsive sizes.
- Only the actual LCP hero is prioritized.
- Gallery and below-fold media lazy-load.
- Video uses a poster and preload none or metadata.
- Click-to-play is the default.
- Background autoplay is muted, playsInline, lightweight, mobile-aware, and optional.
- Heavy animation libraries load only inside templates that need them.
- Simple animation uses CSS transforms/opacity.
- All animation honors prefers-reduced-motion.
- SEO content remains server-rendered even when its visual wrapper is interactive.
- CJK font payloads use system fallbacks or deliberate subsetting.

Performance budgets:

    LCP below 2.5 seconds
    CLS below 0.1
    INP below 200 milliseconds
    No offscreen video download before user intent
    No template-specific animation library in the global bundle

## 10.7 Database/API performance

- Paginate every list and cap limit.
- Use explicit projections and lean public queries.
- Avoid unbounded populate and recursive database queries.
- Build the small category tree in application memory.
- Index actual listing/filter patterns.
- Do not add Redis, Elasticsearch, Atlas Search, queues, or workers until measured requirements justify them.

---

# 11. Complete Folder Structure

    maglive/
    ├── package.json
    ├── README.md
    ├── PROJECT_IMPLEMENTATION_PLAN.md
    ├── .gitignore
    ├── contracts/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── api.ts
    │       ├── auth.ts
    │       ├── category.ts
    │       ├── locale.ts
    │       ├── media.ts
    │       ├── product.ts
    │       ├── product-template.ts
    │       └── index.ts
    ├── frontend/
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── next.config.ts
    │   ├── postcss.config.mjs
    │   ├── .env.example
    │   ├── public/
    │   │   ├── icons/
    │   │   └── placeholders/
    │   ├── src/
    │   │   ├── app/
    │   │   │   ├── (public)/[locale]/
    │   │   │   │   ├── layout.tsx
    │   │   │   │   ├── page.tsx
    │   │   │   │   ├── about/page.tsx
    │   │   │   │   ├── products/
    │   │   │   │   │   ├── page.tsx
    │   │   │   │   │   ├── category/[categorySlug]/page.tsx
    │   │   │   │   │   └── [productSlug]/page.tsx
    │   │   │   │   ├── projects/page.tsx
    │   │   │   │   ├── news/
    │   │   │   │   │   ├── page.tsx
    │   │   │   │   │   └── [slug]/page.tsx
    │   │   │   │   ├── downloads/page.tsx
    │   │   │   │   ├── contact/page.tsx
    │   │   │   │   ├── loading.tsx
    │   │   │   │   ├── error.tsx
    │   │   │   │   └── not-found.tsx
    │   │   │   ├── (admin)/admin/
    │   │   │   │   ├── layout.tsx
    │   │   │   │   ├── login/page.tsx
    │   │   │   │   ├── page.tsx
    │   │   │   │   ├── products/
    │   │   │   │   │   ├── page.tsx
    │   │   │   │   │   ├── new/page.tsx
    │   │   │   │   │   └── [id]/page.tsx
    │   │   │   │   ├── categories/page.tsx
    │   │   │   │   └── media/page.tsx
    │   │   │   ├── api/internal/
    │   │   │   │   ├── preview/route.ts
    │   │   │   │   ├── exit-preview/route.ts
    │   │   │   │   └── revalidate/route.ts
    │   │   │   ├── sitemap.ts
    │   │   │   ├── robots.ts
    │   │   │   └── global-error.tsx
    │   │   ├── components/
    │   │   │   ├── ui/
    │   │   │   ├── site/
    │   │   │   ├── admin/
    │   │   │   │   ├── auth/
    │   │   │   │   ├── categories/
    │   │   │   │   ├── media/
    │   │   │   │   └── products/
    │   │   │   ├── product/
    │   │   │   └── product-templates/
    │   │   │       ├── catalog.ts
    │   │   │       ├── registry.server.ts
    │   │   │       ├── types.ts
    │   │   │       ├── ProductPageRenderer.tsx
    │   │   │       ├── Standard/
    │   │   │       └── TopconPremium/
    │   │   ├── i18n/
    │   │   │   ├── config.ts
    │   │   │   ├── get-dictionary.ts
    │   │   │   └── dictionaries/
    │   │   │       ├── en.json
    │   │   │       └── zh.json
    │   │   ├── services/api/
    │   │   │   ├── client.ts
    │   │   │   ├── auth.ts
    │   │   │   ├── categories.ts
    │   │   │   ├── media.ts
    │   │   │   └── products.ts
    │   │   ├── lib/
    │   │   │   ├── env.ts
    │   │   │   ├── media-url.ts
    │   │   │   ├── product-view-model.ts
    │   │   │   ├── seo.ts
    │   │   │   ├── structured-data.ts
    │   │   │   └── errors.ts
    │   │   ├── types/
    │   │   └── proxy.ts
    │   └── tests/
    │       ├── components/
    │       ├── routes/
    │       └── e2e/
    └── backend/
        ├── package.json
        ├── tsconfig.json
        ├── .env.example
        ├── uploads/
        │   ├── images/.gitkeep
        │   ├── videos/.gitkeep
        │   └── documents/.gitkeep
        ├── src/
        │   ├── app.ts
        │   ├── server.ts
        │   ├── config/
        │   │   ├── env.ts
        │   │   ├── database.ts
        │   │   ├── cors.ts
        │   │   └── session.ts
        │   ├── models/
        │   │   ├── User.ts
        │   │   ├── Category.ts
        │   │   ├── Media.ts
        │   │   ├── Product.ts
        │   │   └── PreviewGrant.ts
        │   ├── controllers/
        │   │   ├── admin/
        │   │   ├── public/
        │   │   └── preview/
        │   ├── services/
        │   │   ├── authService.ts
        │   │   ├── categoryService.ts
        │   │   ├── mediaService.ts
        │   │   ├── productService.ts
        │   │   ├── publishingService.ts
        │   │   └── previewService.ts
        │   ├── storage/
        │   │   ├── StorageProvider.ts
        │   │   ├── LocalStorageProvider.ts
        │   │   └── storageService.ts
        │   ├── routes/v1/
        │   │   ├── index.ts
        │   │   ├── admin/
        │   │   ├── public/
        │   │   └── preview/
        │   ├── middleware/
        │   │   ├── requireAdmin.ts
        │   │   ├── csrf.ts
        │   │   ├── rateLimit.ts
        │   │   ├── validate.ts
        │   │   ├── upload.ts
        │   │   ├── errorHandler.ts
        │   │   └── notFound.ts
        │   ├── validators/
        │   ├── mappers/
        │   ├── utils/
        │   └── scripts/createAdmin.ts
        └── tests/
            ├── unit/
            ├── integration/
            └── fixtures/

Folder responsibilities are defined by Sections 2, 4, 7, and 8. No repositories, generic content engine, global state framework, worker service, or page-builder directory is added in version one.

---

# 12. Error and Fallback Matrix

| Situation | Required response |
|---|---|
| Unsupported locale | Localized 404; no redirect loop |
| Invalid/unknown public slug | 404 without revealing a matching draft |
| Globally draft or archived product | Public 404 |
| Unpublished product translation | Locale 404; omit switcher, sitemap, and hreflang |
| Archived/deleting/incoherent category ancestor | Hide category descendants and dependent products with public 404/exclusion |
| Missing optional localized field | Default-language fallback after locale passed core validation |
| Missing required template content | Block publication with field errors |
| Unknown legacy template ID | Standard fallback if common data is valid; log configuration error |
| Missing/broken image | Dimensioned branded placeholder |
| Empty existing category | 200 with localized empty state |
| Confirmed API entity absence | notFound behavior |
| API/network dependency unavailable | Retryable 503; never cache as 404 |
| Duplicate slug | 409 with slug field error |
| Stale editor version | 409 with reload/compare message |
| Publication revision changes between gate/detail reads | 409 PUBLICATION_REVISION_CHANGED; Next repeats the gate/detail sequence once |
| Shared fields changed during locale-only publish | 409 SHARED_PUBLICATION_REQUIRED with server-computed required locale set |
| Attempt to unpublish English while another locale remains | 409 DEFAULT_LOCALE_REQUIRED |
| Referenced category/media delete | 409 with usage details |
| Invalid request fields | 422 with field-error map |
| Invalid/unsupported media | 415 and cleanup |
| Oversized upload | 413 and cleanup |
| Expired session | 401 SESSION_EXPIRED; login return path |
| Missing/invalid CSRF | 403 |
| Expired/invalid preview | Dedicated noindex preview error |
| Upload persistence failure | Remove temp/stored object; create no Media record |
| Unexpected server error | Generic message and request ID; detailed server log |

---

# 13. Security Requirements

## 13.1 Application/API

- Strict request-body, path, and query schemas.
- Explicit update allowlists; never spread request bodies into models.
- Allowlisted Mongo filters and sorts; reject operators supplied by clients.
- Escaped and bounded search input.
- Bounded strings, arrays, nested objects, page sizes, and uploads.
- Optimistic concurrency on editable content.
- Request ID and sanitized error responses.
- No secrets or sensitive bodies in logs.
- Dependency lockfiles and audit during release gates.

## 13.2 Authentication/session

- Argon2id or reviewed bcrypt password hashing.
- Mongo-backed sessions with rotation and TTL.
- HTTP-only and production Secure cookies.
- Exact credentialed CORS origins.
- CSRF token plus Origin validation.
- Login and mutation rate limiting.
- No browser localStorage authentication token.
- No public registration in version one.
- No frontend-only authorization assumption.

## 13.3 Content/rendering

- Treat CMS Markdown and templateData as untrusted input.
- Sanitize rich-text output.
- Escape ordinary text through React.
- Safely serialize JSON-LD.
- Apply a production Content Security Policy.
- No arbitrary HTML, script, style, component name, import path, or animation code from CMS.

## 13.4 Media

- Content-signature validation in addition to MIME checks.
- Server-derived extension and UUID key.
- Temporary disk streaming and deterministic cleanup.
- Path-resolution checks against traversal.
- SVG disabled until a proven safe pipeline exists.
- nosniff headers and safe content disposition.
- Reference checks before deletion across working fields, publishedGlobal, every locale snapshot, and Media poster relationships.
- Upload roots outside executable application directories.

## 13.5 Operations

- Separate development, test, staging, and production databases.
- Use a transaction-capable MongoDB replica set in every environment, including a documented single-node local/test replica set.
- Least-privilege database accounts.
- Secrets validated at startup and excluded from Git.
- Backups and restore rehearsal before production.
- Correct reverse-proxy trust configuration.
- Global noindex in non-production.

---

# 14. Development Phases and Master Checklist

| Phase | Tasks | Exit condition |
|---|---:|---|
| Phase 1 — Foundation | PH01-01 through PH01-06 | Both applications build/run; locales and health API work. |
| Phase 2 — Authentication | PH02-01 through PH02-04 | Secure login, refresh, protection, and logout work. |
| Phase 3 — Categories | PH03-01 through PH03-03 | Multilingual category hierarchy works end to end. |
| Phase 4 — Media | PH04-01 through PH04-04 | Valid local media can be uploaded, reused, and safely deleted. |
| Phase 5 — Product Backend | PH05-01 through PH05-05 | Draft/published multilingual product APIs are verified. |
| Phase 6 — Product CMS | PH06-01 through PH06-05 | Administrator can author and publish a product. |
| Phase 7 — Catalog/Templates | PH07-01 through PH07-06 | Published products automatically render through coded templates. |
| Phase 8 — Preview/Cache | PH08-01 through PH08-04 | Secure draft preview and content invalidation work. |
| Phase 9 — SEO/Performance | PH09-01 through PH09-05 | Localized SEO and performance/error targets are met. |
| Phase 10 — Hardening/Release | PH10-01 through PH10-06 | Clean-checkout release gate passes. |

Master task state:

- [x] Phase 1 — Foundation
- [ ] Phase 2 — Authentication
- [ ] Phase 3 — Categories
- [ ] Phase 4 — Media
- [ ] Phase 5 — Product Backend
- [ ] Phase 6 — Product CMS
- [ ] Phase 7 — Public Catalog and Templates
- [ ] Phase 8 — Preview and Cache
- [ ] Phase 9 — SEO and Performance
- [ ] Phase 10 — Hardening and Release Readiness

---

# 15. Atomic Implementation Tasks

## Phase 1 — Foundation

### [x] PH01-01 — Establish repository conventions and workspace

**Status:** Completed — 2026-08-26

**Goal:** Create the root workspace, version policy, scripts, ignores, and operator-facing baseline without application features.

**Dependencies:** None.

**Files / folders:** Root package.json, package-lock.json, .nvmrc, .gitignore, README.md, frontend/, backend/, contracts/.

**Implementation scope:**

- Configure npm workspaces for frontend, backend, and contracts.
- Pin Node.js 24 in .nvmrc and package engines.
- Use ES modules throughout; contracts/backend TypeScript use NodeNext-compatible module resolution.
- Add root scripts for dev, build, typecheck, lint, test, and clean orchestration.
- Ignore environment files, build outputs, coverage, node_modules, logs, and uploaded media while retaining upload placeholder files.
- Document ports, workspace commands, MongoDB prerequisite, task-ID workflow, and the rule that exact dependency versions remain lockfile-pinned.
- Create only empty workspace directories/package manifests needed by subsequent tasks.

**Do not implement yet:** Next pages, Express routes, Mongo models, authentication, CMS features, Docker, CI/CD, or deployment infrastructure.

**Verification:**

- Run npm install and confirm one root lockfile.
- Run npm ls --workspaces without workspace-resolution errors.
- Confirm secrets and sample uploaded files are ignored with git check-ignore.
- Confirm Git diff contains only foundation files and this plan update.

**Definition of Done:** A clean checkout can install all workspaces from the root, the README explains the workflow, ignored data cannot be accidentally committed, and no product feature exists.

**Notes / results:** Added npm workspaces, Node/npm policy, root orchestration, strict shared TypeScript/ESLint foundations, one lockfile, ignore rules, environment examples, upload placeholders, and operator README. Verified npm install (0 vulnerabilities), npm ls --workspaces, and git check-ignore for secrets/uploads/build output.

### [x] PH01-02 — Create shared contracts package

**Status:** Completed — 2026-08-26

**Goal:** Establish a narrow runtime-validation and TypeScript boundary shared by frontend and backend.

**Dependencies:** PH01-01.

**Files / folders:** contracts/package.json, contracts/tsconfig.json, contracts/src/api.ts, auth.ts, locale.ts, category.ts, media.ts, product.ts, product-template.ts, index.ts.

**Implementation scope:**

- Add Zod as the contracts runtime dependency.
- Define LocaleCode from the immutable en/zh registry and export route code, language tag, direction, and fallback metadata.
- Define success/error envelopes, field errors, one-based pagination, default limit 20, maximum limit 100, and deterministic metadata.
- Define serializable ObjectId values as validated 24-character hex strings; never expose Mongoose ObjectId types.
- Define public/admin DTO primitives without database methods or UI state.
- Define the initial ProductTemplateId list containing standard and topcon-premium.
- Define a bounded kebab-case LegacyTemplateId read schema and isProductTemplateId narrowing helper; administrator writes still accept known IDs only.
- Export unknown-to-parsed schemas and inferred types; prohibit any in public contracts.
- Add unit tests for valid/invalid locales, pagination bounds, ObjectId strings, template IDs, and error envelopes.

**Do not implement yet:** Mongoose schemas, services, React components, template loaders, templateData, API networking, or business publication rules.

**Verification:**

- Run npm run build -w contracts.
- Run npm run typecheck -w contracts.
- Run npm test -w contracts.
- Verify the built package exports only contract modules.

**Definition of Done:** Both future applications can depend on one buildable package for locale, transport, and template-ID contracts with passing boundary tests.

**Notes / results:** Added the buildable @maglive/contracts package with locale registry, envelopes, pagination, ObjectId strings, safe admin/category/media/product DTO primitives, known/legacy template identifiers, and Zod boundary tests. Build, strict typecheck, ESLint, and 4 tests pass; dist contains contract modules only.

### [x] PH01-03 — Bootstrap Next.js, Tailwind, and the public route shell

**Status:** Completed — 2026-08-26

**Goal:** Produce the smallest strict, buildable frontend with a shared design-system foundation and code-owned corporate route shells.

**Dependencies:** PH01-01 and PH01-02.

**Files / folders:** frontend package/configuration files, frontend/src/app, frontend/src/components/ui, frontend/src/components/site, frontend/src/styles or global stylesheet, frontend/public.

**Implementation scope:**

- Install pinned Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, ESLint, and required type packages.
- Enable strict TypeScript and workspace import of contracts.
- Add global typography, color, spacing, radius, shadow, container, and focus tokens through CSS variables and Tailwind.
- Define mobile-first breakpoints, accessible focus treatment, form defaults, and reduced-motion base rules.
- Create root public layout primitives: Navbar, Footer, Container, Button, Heading, and SkipLink.
- Add code-owned route shells for Home, About, Projects, News, Downloads, and Contact; Projects and News explicitly state their CMS modules are future work.
- Treat product enquiry as a mail/contact CTA in version one; do not add an enquiry API or database model.
- Add frontend .env.example containing SITE_URL, API_INTERNAL_URL, MEDIA_PUBLIC_ORIGIN, NEXT_PUBLIC_API_BASE_URL, DEFAULT_LOCALE, and REVALIDATION_SECRET with safe placeholders.

**Do not implement yet:** Locale detection, real catalog data, admin pages, product templates, forms that submit to a backend, animation libraries, or CMS-driven corporate pages.

**Verification:**

- Run npm run lint -w frontend.
- Run npm run typecheck -w frontend.
- Run npm run build -w frontend.
- Manually inspect all route shells at mobile and desktop widths for navigation, footer, keyboard focus, and no horizontal overflow.

**Definition of Done:** The frontend production build passes, shared design tokens/primitives exist, and every intended corporate route has a clear code-owned shell without pretending its future CMS exists.

**Notes / results:** Added the strict Next.js 16/Tailwind 4 application, responsive design tokens, accessible focus/reduced-motion foundations, shared Navbar/Footer/Container/Heading/SkipLink/locale-link components, and honest code-owned Home/About/Products/Projects/News/Downloads/Contact shells. Frontend lint, typecheck, 4 tests, and production build pass. All 14 en/zh route shells returned 200 in runtime HTTP checks with localized links and viewport metadata; responsive CSS was reviewed at desktop/tablet/mobile breakpoints. The in-app browser connection was unavailable, so no screenshot artifact was produced.

### [x] PH01-04 — Implement locale routing and dictionaries

**Status:** Completed — 2026-08-26

**Goal:** Launch English and Simplified Chinese on an extensible, registry-driven routing, metadata, dictionary, and detection foundation.

**Dependencies:** PH01-02 and PH01-03.

**Files / folders:** frontend/src/app/(public)/[locale], frontend/src/i18n, frontend/src/proxy.ts, localized navigation components.

**Implementation scope:**

- Move public route shells beneath the [locale] segment.
- Validate params through the shared locale registry and return notFound for unsupported route codes.
- Add initial server-only en and zh dictionaries for navigation, generic page labels, loading, errors, and accessibility text; make the typed loader require coverage for every registry locale.
- Set html lang and dir from locale metadata.
- Implement request-boundary detection for public paths lacking a locale using preference cookie, Accept-Language, then en.
- Drive detection, static parameters, native language labels, and switcher links from the shared registry without two-locale conditionals.
- Exclude /admin, /api/internal, /_next, /uploads, favicon/static files, and already-localized URLs.
- Add locale-aware Link helpers that prevent accidental unprefixed public links.
- Set/update a non-sensitive locale preference cookie from the switcher.

**Do not implement yet:** CMS content translations, entity-aware language switching, hreflang, dynamic SEO, localized slugs, or translation fallback from the API.

**Verification:**

- Run frontend lint, typecheck, tests, and production build.
- Verify / redirects deterministically, /en and /zh render correct dictionaries, and /xx returns 404.
- Verify admin/internal/assets are not locale-redirected.
- Inspect server HTML for correct lang and dir.

**Definition of Done:** Every enabled locale shares one public route tree; initial en/zh routes work; a future locale is introduced through the registry plus its dictionary/loader/tests rather than navigation or layout rewrites; detection cannot loop; unsupported locales fail safely; and all generic UI copy comes from server-loaded dictionaries.

**Notes / results:** Added initial immutable en/zh dictionaries, a compiler-enforced static dictionary loader, a single typed locale metadata registry, locale validation, root-relative localized link helpers, preference-cookie language switching, and Next 16 proxy detection using cookie → weighted Accept-Language → English. Routing, static parameters, HTML lang/dir, native language labels, detection aliases, and switcher links now derive from the registry with no two-language branch. Verified deterministic 307 redirects, /en and /zh localized copy, /xx and unsupported regional-code 404 behavior, excluded admin/internal/static paths without locale redirects, correct en/zh-Hans HTML lang and ltr dir, no unprefixed public navigation links, and registry-driven switcher coverage.

### [x] PH01-05 — Bootstrap Express, configuration, MongoDB, and API errors

**Status:** Completed — 2026-08-26

**Goal:** Create a separately runnable, versioned Express API with validated configuration and predictable lifecycle/error behavior.

**Dependencies:** PH01-01 and PH01-02.

**Files / folders:** backend package/configuration, backend/src/app.ts, server.ts, config, routes/v1, middleware, utils, backend/.env.example.

**Implementation scope:**

- Install pinned Express 5, Mongoose 9, Zod, Helmet, CORS, structured logger, and development tooling.
- Validate environment at startup; exit non-zero when required configuration is absent or MongoDB cannot initialize.
- Required backend environment contract:
  - NODE_ENV and PORT, defaulting to development and 5000 where safe.
  - MONGODB_URI.
  - FRONTEND_ORIGIN, exactly one origin in version one.
  - SESSION_SECRET, PREVIEW_SIGNING_SECRET, and PREVIEW_EXCHANGE_SECRET, minimum 32 random bytes outside development fixtures.
  - UPLOAD_ROOT and PUBLIC_MEDIA_BASE_URL.
  - MAX_IMAGE_BYTES default 15 MiB.
  - MAX_VIDEO_BYTES default 250 MiB.
  - MAX_DOCUMENT_BYTES default 50 MiB.
  - NEXT_REVALIDATION_URL and NEXT_REVALIDATION_SECRET.
  - TRUST_PROXY default false/0 until deployment configuration explicitly changes it.
- Add JSON/request size limits, request IDs, Helmet, explicit credentialed CORS, safe logging, health route, API not-found middleware, normalized errors, and graceful SIGINT/SIGTERM shutdown.
- Require a transaction-capable replica set; verify transaction support during startup/readiness and document single-node local replica-set initialization.
- Health reports API and database readiness without secrets or connection strings.

**Do not implement yet:** Domain models, sessions, authentication, uploads, CRUD endpoints, cache callbacks, or frontend proxying.

**Verification:**

- Run backend lint, typecheck, tests, and production build.
- Exercise health, API 404, malformed JSON, oversized JSON, allowed Origin, and rejected Origin.
- Start with valid MongoDB, invalid URI, and missing secret; verify useful startup behavior.
- Start against a standalone non-replica MongoDB and verify readiness/startup refuses the unsupported integrity configuration.
- Verify graceful shutdown closes HTTP and MongoDB connections.

**Definition of Done:** Port 5000 exposes a predictable /api/v1/health endpoint, unsafe configuration cannot start, and all API errors use the shared envelope.

**Notes / results:** Added Express 5 application/server separation, validated environment contract, exact credentialed CORS, Helmet, 1 MiB JSON limit, request IDs, redacted structured logging, shared-envelope 404/malformed/oversized errors, database-aware health, Mongoose startup/disconnect, replica-set/mongos transaction capability enforcement, and tested graceful SIGINT/SIGTERM shutdown. Backend lint, strict typecheck, 12 tests, and production build pass. Supertest verifies health/503/errors/CORS; process smoke verifies unreachable Mongo exits 1. No local mongod executable was available, so replica/standalone behavior was verified through deterministic hello-capability tests and documented local replica-set setup rather than a machine-local database process.

### [x] PH01-06 — Establish isolated test harnesses

**Status:** Completed — 2026-08-26

**Goal:** Make every later task independently verifiable without risking development or production data.

**Dependencies:** PH01-02 through PH01-05.

**Files / folders:** contracts tests, frontend test setup, backend tests/setup, root scripts, documented test environment.

**Implementation scope:**

- Configure Vitest for contracts, frontend utilities/components, and backend units.
- Configure Testing Library and DOM assertions for frontend.
- Configure Supertest for Express integration tests.
- Require MONGODB_TEST_URI whose database name contains an explicit test marker and points to a transaction-capable replica set; refuse destructive setup otherwise.
- Use a generated temporary upload directory for media tests and verify cleanup.
- Add one locale/component smoke test and one health/error-envelope API integration test.
- Keep test environment secrets synthetic and separate from .env development values.

**Do not implement yet:** Playwright, visual regression, feature-specific test suites, CI, coverage quotas, or production services.

**Verification:**

- Run npm test from the root.
- Run each workspace test command separately.
- Prove the database safety guard rejects a non-test database name.
- Verify temporary files are removed after test completion.

**Definition of Done:** All workspace tests pass deterministically, test cleanup is constrained to explicit temporary/test resources, and later tasks have established testing patterns.

**Notes / results:** Added isolated Vitest configurations for every workspace, Testing Library/DOM setup, Supertest API coverage, guarded MONGODB_TEST_URI validation, transaction-capability fixtures, generated temporary upload roots with constrained cleanup, and synthetic test configuration. Root npm test passes 8 files / 20 tests (contracts 4, backend 12, frontend 4); the safety guard rejects missing, non-test, and non-replica URIs, and the temporary-resource test proves cleanup.

## Phase 2 — Authentication

### [ ] PH02-01 — Add User model and administrator bootstrap CLI

**Status:** Pending

**Goal:** Store a secure administrator identity and provide a non-public creation workflow.

**Dependencies:** Phase 1 complete.

**Files / folders:** backend/src/models/User.ts, backend/src/scripts/createAdmin.ts, auth validators/contracts, unit tests.

**Implementation scope:**

- Implement normalized lowercase email, unique index, passwordHash, admin role, active flag, timestamps, and optional login/password-change timestamps.
- Exclude passwordHash from normal selection and serialization.
- Hash with Argon2id using reviewed parameters; centralize hash/verify operations.
- Create an interactive or environment-fed CLI that creates or updates the first admin without hardcoded credentials or password logging.
- Make duplicate email behavior deterministic and safe.

**Do not implement yet:** Public registration, password reset, invitations, multiple roles, MFA, sessions, or login endpoints.

**Verification:**

- Run model/validator/hash unit tests.
- Run the CLI against an isolated database, verify one admin, then run it again and verify deterministic duplicate/update behavior.
- Inspect the document to confirm no plaintext password and excluded hash serialization.

**Definition of Done:** A secure administrator can be bootstrapped through an intentional CLI, passwords are never persisted/logged in plaintext, and identity constraints are tested.

**Notes / results:** _Pending._

### [ ] PH02-02 — Configure Mongo-backed administrator sessions

**Status:** Pending

**Goal:** Establish revocable server-side sessions and a deliberate cookie lifecycle.

**Dependencies:** PH02-01.

**Files / folders:** backend/src/config/session.ts, app middleware wiring, environment validation, session integration tests.

**Implementation scope:**

- Add express-session and a Mongo-backed store.
- Use a non-default cookie name and synthetic test secret.
- Configure HTTP-only, production Secure, deliberate SameSite, path, idle timeout, and documented absolute-session behavior.
- Rotate session IDs after authentication and destroy records on logout.
- Configure TTL cleanup and disable rolling renewal unless explicitly documented.
- Prevent the production in-memory store.
- Document localhost cross-port credential behavior and preferred same-site production reverse proxy.

**Do not implement yet:** Login routes, CSRF, remember-me, multiple devices UI, or external identity providers.

**Verification:**

- Test session persistence across requests and API process restart with Mongo-backed storage.
- Inspect Set-Cookie flags in development and simulated production.
- Verify expired records and logout destruction behavior through the store.

**Definition of Done:** The backend can create, retrieve, expire, rotate, and destroy opaque sessions without storing authentication tokens in browser-accessible storage.

**Notes / results:** _Pending._

### [ ] PH02-03 — Implement authentication, CSRF, Origin checks, and rate limits

**Status:** Pending

**Goal:** Provide secure login/logout/session APIs and authoritative protection for all future administrator routes.

**Dependencies:** PH02-01 and PH02-02.

**Files / folders:** auth service/controller/routes, requireAdmin, csrf, rateLimit middleware, shared auth contracts, integration tests.

**Implementation scope:**

- Implement GET csrf, POST login, GET me, and POST logout at the locked routes.
- Validate normalized email and bounded password payloads.
- Use one generic invalid-credential message for missing, inactive, and incorrect accounts.
- Let GET csrf create/reuse a minimal anonymous pre-auth session; require that token and Origin validation on POST login.
- On successful login, regenerate the session ID, invalidate the pre-auth token, return only the safe administrator DTO, and issue a new authenticated-session CSRF token.
- Require the current authenticated-session token header on every later state-changing admin request, including logout.
- Enforce exact Origin and safe Referer fallback checks.
- Rate limit login by IP plus normalized account key and administrator mutations by session/IP.
- Return stable AUTH_REQUIRED, SESSION_EXPIRED, CSRF_INVALID, and RATE_LIMITED error codes.

**Do not implement yet:** Admin UI, password recovery, CAPTCHA, roles, account management, or audit-log UI.

**Verification:**

- Integration-test pre-auth CSRF issuance, valid login, session/token rotation, wrong password, inactive user, session fixation resistance, me, authenticated-CSRF logout, and expiry.
- Test missing/wrong/stale-pre-auth CSRF, pre-auth token reuse after login, foreign Origin, rate-limit threshold, and unauthenticated access.
- Verify secrets, hashes, cookies, and CSRF values do not appear in logs or DTOs.

**Definition of Done:** Authentication lifecycle works through HTTP, all future admin routes can reuse tested requireAdmin/CSRF middleware, and common cross-site/session attacks are rejected.

**Notes / results:** _Pending._

### [ ] PH02-04 — Build login page and protected admin shell

**Status:** Pending

**Goal:** Provide a usable administrator entry point and navigation frame without treating frontend guards as authorization.

**Dependencies:** PH02-03.

**Files / folders:** frontend admin layout/login/dashboard shell, admin auth components, frontend auth API service, tests.

**Implementation scope:**

- Build accessible login form with loading, generic invalid-credential, rate-limit, and unavailable-API states.
- Fetch and submit the pre-auth CSRF token for login, replace it with the post-login token returned after session rotation, and send credentials/current CSRF on administrator mutations and logout.
- Verify session through me and redirect unauthenticated users to login with a validated local return path.
- Add Dashboard, Products, Categories, Media, and Logout navigation; future modules are absent.
- Handle SESSION_EXPIRED globally for admin requests while preserving a safe return path.
- Add keyboard navigation, focus management, responsive sidebar/header, and clear current location.

**Do not implement yet:** Dashboard analytics, product/category/media screens, localized admin chrome, roles, or client global-state libraries.

**Verification:**

- Run frontend lint/typecheck/tests/build.
- Manually test direct /admin visit, pre-auth token acquisition, login/token replacement, refresh, browser back/forward, logout, expiry, keyboard navigation, and narrow viewport.
- Confirm direct calls to protected Express endpoints remain rejected without a session.

**Definition of Done:** A valid administrator can enter and leave a protected, accessible admin shell; session failure is handled clearly; Express remains authoritative.

**Notes / results:** _Pending._

## Phase 3 — Categories

### [ ] PH03-01 — Add Category model and validation

**Status:** Pending

**Goal:** Represent a multilingual, ordered two-level product-category hierarchy.

**Dependencies:** Phase 2 complete.

**Files / folders:** contracts category schemas, backend Category model, category validators, unit tests.

**Implementation scope:**

- Add slug, nullable parentId, sortOrder, working locale translations/SEO, contextual image usage, publishedGlobal, per-locale publishedSnapshots, active/archived/deleting state, firstPublishedAt, audit fields, timestamps, and version.
- Add unique slug and parentId/sortOrder indexes.
- Validate supported locales, bounded text, slug rules, nonnegative order, and translation shapes.
- Define publication completeness for category name, SEO derivation, contextual image kind/readiness/metadata, English-first publication, and complete parent/ancestor locale snapshots.
- Define split PublishedCategoryGlobalSnapshot/PublishedCategoryLocaleSnapshot, separate source hashes, globalRevision matching, and shared-promotion behavior so working edits never change or fragment live content.
- Treat “Products” as navigation, not a stored hierarchy level.

**Do not implement yet:** Category APIs/UI, media selection, product reference checks, drag-and-drop, materialized paths, or more than two levels.

**Verification:**

- Unit-test serialization, duplicate slug mapping, invalid locale, invalid field lengths, global/locale revision matching, and parent-independent schema rules.
- Verify DTO ObjectIds serialize as strings and raw Mongoose maps do not cross contracts.

**Definition of Done:** Category persistence and contracts express all locked hierarchy/translation fields without embedding products or introducing tree overengineering.

**Notes / results:** _Pending._

### [ ] PH03-02 — Implement category services and REST routes

**Status:** Pending

**Goal:** Manage category lifecycle and return a safe localized public tree.

**Dependencies:** PH03-01.

**Files / folders:** category service/controller/routes/mapper, validation middleware, integration tests.

**Implementation scope:**

- Implement admin list/create/read/update/delete, complete-sibling reorder, publish locale, unpublish locale, and archive.
- Implement public category list/tree and detail by slug.
- Enforce self-parent, descendant-cycle, maximum-depth, English-first/retention, complete published-ancestor, and snapshot-coherence rules in the service.
- Run reference-sensitive hierarchy/lifecycle changes in transactions; use deleting to block new children during permanent deletion.
- Reject permanent deletion while children exist or firstPublishedAt is set.
- On first publish, atomically create publishedGlobal plus English. Permit locale-only promotion only when shared fields are unchanged; otherwise require an explicit all-live-locale shared promotion in one transaction.
- Return only a coherent composition of active publishedGlobal and requested-locale snapshots publicly; never working translations. Include availableLocales derived from coherent live snapshots.
- Exclude a category, its descendants, and dependent product/list/sitemap results whenever any member of its complete ancestor chain is archived, deleting, globally incoherent, or lacks the requested locale snapshot.
- Apply optimistic version checks to updates and delete.
- Record a documented temporary limitation: product-reference checks for delete, new-child/reparent, and locale unpublish are added in PH05-03 after Product exists.

**Do not implement yet:** Product-reference checks, functional media existence checks until Phase 4, category UI, drag-and-drop, or bulk import.

**Verification:**

- Integration-test CRUD, English-first publish, Chinese-first rejection, English-retention on unpublish, locale-only republish, explicit shared promotion, archive, duplicate slug, reorder, self/cycle/depth attempts, stale version, child/previously-published deletion blocks, transaction rollback, authorization/CSRF, and public snapshots.
- Confirm working changes do not affect existing public snapshots, an unpublished translation is absent, availableLocales is correct, and archiving a root hides its child tree for every public query.

**Definition of Done:** Categories can be safely managed and localized publicly; hierarchy rules and current deletion guarantees are explicit and tested.

**Notes / results:** _Pending._

### [ ] PH03-03 — Build category administration

**Status:** Pending

**Goal:** Provide end-to-end category creation, translation, hierarchy, ordering, and conflict handling.

**Dependencies:** PH03-02 and PH02-04.

**Files / folders:** frontend admin categories route, category components/forms/service, tests.

**Implementation scope:**

- Build list/tree view and create/edit form.
- Add en/zh tabs with Draft, Published, Changes pending, and validation indicators derived from snapshot/source hashes.
- Add slug, parent selection, order, description, and localized SEO fields.
- Allow only root categories as parents for a second-level category.
- Provide move-up/move-down ordering controls using complete sibling reorder; drag-and-drop is deferred.
- Display a disabled image-selection placeholder explaining that media integration arrives in PH04-04.
- Handle field errors, stale version, unauthorized/expired session, child-delete conflict, and API unavailable state.
- Add publish locale, explicit shared-promotion impact confirmation, unpublish locale, archive, and eligible permanent-delete controls with confirmations; explain English-first/retention conflicts.

**Do not implement yet:** Functional media picker, product-reference conflict, drag-and-drop, bulk editing, or more hierarchy levels.

**Verification:**

- Create a root and child, reject Chinese-first publication, publish English parent then child, add Chinese, edit shared working content without changing live content, confirm and execute all-live-locale shared promotion, reject English-only unpublish while Chinese remains, unpublish/archive, reorder siblings, attempt invalid depth/delete, and recover from a stale version.
- Run frontend lint/typecheck/tests/build and keyboard/form accessibility checks.

**Definition of Done:** Administrators can manage the current category hierarchy and translations without relying on not-yet-built media or products.

**Notes / results:** _Pending._

## Phase 4 — Media

### [ ] PH04-01 — Define storage contract and safe local adapter

**Status:** Pending

**Goal:** Make media business logic independent of local disk.

**Dependencies:** Phase 3 complete.

**Files / folders:** backend/src/storage, backend/uploads placeholders, storage configuration and tests.

**Implementation scope:**

- Implement save, delete, exists, and getPublicUrl against provider/key references.
- Resolve UPLOAD_ROOT once and validate every target remains beneath it.
- Generate UUID and date/type partitioned keys.
- Use temporary and final locations with atomic move where supported.
- Add fake-provider contract tests and LocalStorageProvider tests.
- Serve local files with correct types, nosniff, immutable UUID caching, and range support where available.

**Do not implement yet:** Multipart controller, Media model, metadata extraction, S3/R2/OSS adapters, transforms, or transcoding.

**Verification:**

- Test duplicate original names, traversal paths, missing objects, save/delete, restart persistence, URL generation, and fake/local contract parity.
- Verify uploads remain Git-ignored and target validation rejects workspace/source escape.

**Definition of Done:** Storage operations are safe, tested, and accessed only through the provider contract; local disk can later be replaced without controller/model rewrites.

**Notes / results:** _Pending._

### [ ] PH04-02 — Add Media model and secure upload pipeline

**Status:** Pending

**Goal:** Accept approved media through authenticated streaming uploads and persist only safe metadata.

**Dependencies:** PH04-01 and Phase 2.

**Files / folders:** contracts media schemas, backend Media model, upload middleware, media service/controller/routes, fixtures/tests.

**Implementation scope:**

- Add the locked Media schema including deleting state and posterMediaId, indexes, DTO mapper, admin list/read/upload/update endpoints.
- Stream multipart data to a controlled temporary file rather than memory.
- Enforce one upload per request initially, configured byte limits, and file-count limits.
- Inspect content signatures and require agreement with the allowed type; derive extension server-side.
- Support JPEG, PNG, WebP, MP4, WebM, and PDF; reject SVG.
- Extract image dimensions and store optional video metadata when reliably available.
- Calculate a streaming checksum when practical without adding a duplicate-detection feature.
- Save through StorageProvider, then create Media; clean temp/final objects on all partial failures.
- Mark successfully validated uploads ready.
- Validate posterMediaId updates as a distinct ready image and reject self-reference.

**Do not implement yet:** Product/category usages endpoint, delete, functional admin picker, SVG, cloud upload, image conversion, thumbnails, video transcoding, or malware scanning.

**Verification:**

- Integration-test every allowed type, forged MIME, renamed executable, invalid PDF, oversize, truncated request, multiple-file rejection, unauthorized/CSRF-invalid upload, and database/storage failure cleanup.
- Confirm no binary content is present in MongoDB.

**Definition of Done:** Valid local media becomes a ready Media record and retrievable URL; invalid/failed uploads leave neither public files nor database records.

**Notes / results:** _Pending._

### [ ] PH04-03 — Implement media usages and reference-aware deletion

**Status:** Pending

**Goal:** Expose current references and safely delete only unreferenced media.

**Dependencies:** PH04-02 and PH03-02.

**Files / folders:** media service/routes, Category integration, tests.

**Implementation scope:**

- Implement GET usages and DELETE media.
- Enter deleting state atomically, causing all category/media reference-creating writes to reject the asset, then recheck references.
- Query working Category image/SEO references, every Category publishedGlobal/per-locale snapshot reference, and Media.posterMediaId references.
- Return deterministic usage descriptors and 409 MEDIA_IN_USE.
- Run database reference-state changes in a transaction; include poster readiness/type/self-reference checks.
- Delete stored object first only with a compensation strategy, or delete database record first only with a recoverable cleanup strategy; document and test the selected order.
- Return a retriable cleanup error rather than claiming success when object deletion fails.
- Record that Product usage checks are added in PH05-03 after Product exists.

**Do not implement yet:** Product usage checks, force/cascade delete, bulk delete, asset replacement, or orphan sweeper.

**Verification:**

- Test unreferenced delete, working-category conflict, an asset removed from working content but retained by a live Category snapshot, poster reference/self-reference/wrong kind, concurrent reference attempt during deleting, missing ID, repeated delete, storage failure, transaction rollback, authorization, and path safety.
- Confirm the API never silently leaves a known inconsistent record/object pair.

**Definition of Done:** Media deletion is recoverable, reports current category usages, and cannot break existing category images.

**Notes / results:** _Pending._

### [ ] PH04-04 — Build media library/picker and integrate categories

**Status:** Pending

**Goal:** Let administrators upload, browse, edit, select, replace, and safely delete reusable media.

**Dependencies:** PH04-02, PH04-03, and PH03-03.

**Files / folders:** frontend admin media route/components/service, reusable MediaPicker, category editor integration, tests.

**Implementation scope:**

- Build paginated media library with type filter, upload progress, retry, and empty/error states.
- Preview images, videos, and PDFs appropriately.
- Edit reusable default title/alt/caption translations.
- Build a reusable modal/panel picker returning a Media DTO.
- Replace a file by uploading a new asset and explicitly choosing references to update; never overwrite an existing key.
- Allow a ready image to be selected as a video poster and show poster-to-media usage in deletion details.
- Show usage details and block referenced deletion.
- Replace the category editor placeholder with the functional picker and translated contextual alt handling.

**Do not implement yet:** Product integration, folders, tags, bulk operations, crop editor, cloud uploads, or background processing.

**Verification:**

- Upload/select/edit/replace/delete media; assign it to a category and confirm deletion conflict.
- Exercise retry, cancellation, expired session, keyboard navigation, screen-reader labels, and narrow viewport.
- Run frontend lint/typecheck/tests/build.

**Definition of Done:** A category can use a reusable uploaded asset, the media library exposes accurate state/errors, and replacement/deletion preserves integrity.

**Notes / results:** _Pending._

## Phase 5 — Product Backend

### [ ] PH05-01 — Add Product model and bounded nested schemas

**Status:** Pending

**Goal:** Persist flexible multilingual products without category-specific columns or uncontrolled mixed data.

**Dependencies:** Phase 4 complete.

**Files / folders:** contracts product schemas, backend Product model and nested schema helpers, model tests.

**Implementation scope:**

- Implement the locked Product working data, ProductTranslation, PublishedProductGlobalSnapshot, per-locale PublishedProductLocaleSnapshot, SpecificationGroup/Item, ProductMediaUsage, SEO, audit, status/deleting, and version shapes.
- Add the locked indexes.
- Bound each translation to 100 features, 100 advantages, and 100 applications; bound text fields to documented practical limits.
- Bound specifications to 30 groups and 100 items per group.
- Bound mediaUsages to 300 and keywords to 20.
- Bound templateData serialized size to 256 KiB and nesting depth to 8 when it is later enabled.
- Enforce an 8 MiB application-level cap on the complete Product BSON document including working data and all snapshots.
- Validate supported locales, unique nested keys, order ranges, media roles, and one category ID.
- Use unknown at the templateData transport boundary; no Schema.Types.Mixed-based acceptance without template parsing.

**Do not implement yet:** Product services/routes, publication, templateData for current templates, search, public DTOs, or CMS UI.

**Verification:**

- Model-test a solar module and inverter, split global/locale snapshot round trips and revision matching, optional fields, invalid/duplicate nested keys, unsupported locale, excessive arrays/text/document size, invalid media roles, and DTO serialization.
- Verify binaries, absolute storage paths, raw Mongoose maps, and ObjectId objects are absent from API contracts.

**Definition of Done:** One bounded, understandable Product model represents both product families and retains room for coded templates without becoming a page builder.

**Notes / results:** _Pending._

### [ ] PH05-02 — Implement draft and per-locale publication validation

**Status:** Pending

**Goal:** Make publication an explicit, deterministic business operation distinct from saving drafts.

**Dependencies:** PH05-01, PH03-02, PH04-03, and contracts template IDs.

**Files / folders:** backend publishingService, product validators, publication contracts, unit/integration tests.

**Implementation scope:**

- Allow incomplete, structurally valid working drafts to save without changing any existing public snapshot.
- Require the locked slug, active leaf category, known template ID, and ready referenced media at publish time.
- Require English core fields before first global publication and keep English published while any other locale remains live.
- Validate each requested locale independently and require its category/ancestor published snapshot for that locale.
- Validate role/type compatibility, such as image hero, video role, PDF document roles, and poster expectations.
- Validate unique specification keys/orders and selected template requirements.
- Reject unknown template IDs during normal save/publish; Standard fallback is legacy runtime resilience only.
- Build separate canonical shared and localized projections. First publish creates PublishedProductGlobalSnapshot plus English; unchanged-shared locale publication replaces only that locale snapshot.
- When the shared hash changed, reject an ordinary locale publish. An explicit shared-promotion request must include every currently live locale plus the target, validate all working projections, and atomically replace the global snapshot and all included locale snapshots with one globalRevision and new per-locale publicationRevisions.
- Derive CMS shared state and each locale state as Draft, Published, or Changes pending from global/locale snapshot presence and source hashes rather than storing drifting status flags.
- Return field-addressable errors and warnings; missing optional SEO/alt can warn where not template-critical.

**Do not implement yet:** CRUD routes, cache invalidation, preview, scheduled publication, review workflow, or templateData for topcon-premium.

**Verification:**

- Unit-test incomplete draft, editing without public leakage, English-first/retention rules, English-only publish, separate global/locale changes-pending hashes, unchanged-shared locale republish, later Chinese publish, rejected implicit shared promotion, atomic all-live-locale shared promotion and rollback, missing ancestor snapshot, inactive ancestor, wrong media type, missing media, unknown template, and valid module/inverter.
- Confirm errors are stable and map to editor field paths.

**Definition of Done:** The same input always yields a clear publishable/not-publishable result, and no incomplete locale can be marked published.

**Notes / results:** _Pending._

### [ ] PH05-03 — Implement product lifecycle APIs and complete reference integrity

**Status:** Pending

**Goal:** Provide protected product CRUD/lifecycle operations while closing category/media reference gaps.

**Dependencies:** PH05-01 and PH05-02.

**Files / folders:** product service/admin controller/routes/mapper, category/media service integration, integration tests.

**Implementation scope:**

- Implement admin create/read/update, duplicate, publish, unpublish, archive, and permanent draft delete.
- Require version on PATCH and destructive/lifecycle commands; return 409 on mismatch.
- Enforce immutable slug after first publication.
- Duplicate with a unique draft slug, copied working content/specs/media references/template, cleared timestamps, no publishedGlobal or publishedSnapshots, and global draft state.
- Archive hides all public locales while preserving content/references.
- Reject unpublishing English while another locale remains; support explicit all-locale unpublish, which removes publishedGlobal and returns the product to draft.
- Permanently delete only never-published drafts and never cascade-delete media.
- Use transaction-backed reference checks for product category assignment/moves and reject non-active, deleting, or non-leaf categories.
- Extend category child creation/reparenting and delete to reject Product references, preventing a product-used category from gaining children.
- Extend category-locale unpublish to reject while child snapshots or published product snapshots depend on that locale; category archive remains an explicit visibility-hiding operation.
- Extend media usages/delete to include every working Product usage/SEO/icon reference, every Product publishedGlobal/per-locale snapshot reference, every already-supported Category live/working reference, and Media poster reference.
- Record createdBy/updatedBy from the authenticated session.

**Do not implement yet:** Admin list search UI, bulk lifecycle actions, revisions, cache revalidation, preview, or public routes.

**Verification:**

- Integration-test full lifecycle/snapshot promotion, working edits without live changes, duplicate, stale version, slug collision/immutability, unauthorized/CSRF-invalid mutation, concurrent category/product reference attempts, invalid category/media, product-blocked category delete/child creation, and product/poster-blocked media delete including an asset removed from working content but retained in a live snapshot, archive, and draft-delete eligibility.
- Verify duplication never creates physical media files.

**Definition of Done:** All product state changes occur through protected services, optimistic concurrency prevents silent overwrite, and category/media deletion cannot break products.

**Notes / results:** _Pending._

### [ ] PH05-04 — Add bounded administrator product querying

**Status:** Pending

**Goal:** Support a predictable, efficient product-list API.

**Dependencies:** PH05-03.

**Files / folders:** product query contracts/service/controller tests.

**Implementation scope:**

- Implement one-based pagination, default 20, maximum 100.
- Add bounded escaped search over slug, model, series, and every currently supported locale name path (en and zh), with a documented index/performance review before adding locales at scale.
- Add category, global status, derived locale publication state, and featured filters.
- Allowlist sort values: updated-desc, updated-asc, order-asc, order-desc, name-asc, and name-desc.
- Add deterministic ID tie-break sorting.
- Return minimal list DTOs, counts, and translation-completeness summaries.
- Reject regex operators, unsupported query keys, invalid IDs, and excessive search input.

**Do not implement yet:** Atlas Search, fuzzy search, arbitrary client sorting, saved filters, bulk actions, or frontend list.

**Verification:**

- Test English and Chinese name search, each filter/sort, combinations, empty results, maximum/invalid limits, final page, deterministic ties, escaped metacharacters, and projection privacy.
- Inspect query plans for the primary status/category/order paths with representative fixtures.

**Definition of Done:** The administrator list endpoint remains bounded, deterministic, safe from operator injection, and suitable for the planned UI.

**Notes / results:** _Pending._

### [ ] PH05-05 — Implement public localized product APIs

**Status:** Pending

**Goal:** Expose only public-safe, requested-locale product data for listings and detail pages.

**Dependencies:** PH05-03 and PH05-04.

**Files / folders:** public product service/controller/routes, product mapper, public contract tests.

**Implementation scope:**

- Implement no-store visibility/revision gate, localized product list, and composed published-snapshot detail by canonical slug plus required publicationRevision.
- Apply global published, publishedGlobal presence, requested locale snapshot/globalRevision match, and complete active/non-deleting category ancestor-chain predicates.
- Public detail composes PublishedProductGlobalSnapshot with only the matching PublishedProductLocaleSnapshot; it never reconstructs output from working Product fields.
- Return availableLocales only for locale snapshots matching publishedGlobal.globalRevision and valid category ancestor chains, plus the localized published breadcrumb/category, sorted composed specifications/media, API-computed media URLs, and a normalized related-product summary.
- Apply optional field fallback centrally and track which fields fell back.
- Return 404 for absent product, draft/archived/deleting product, and missing requested snapshot without revealing which condition occurred; return 409 PUBLICATION_REVISION_CHANGED for an obsolete required revision.
- Implement sitemap-entries pagination for published product/category locale pairs and updatedAt values, or document the same public API pagination algorithm used by Next; choose the dedicated endpoint for version one.
- Use correctness-first no-store fetch semantics until PH08-03 enables public caching.

**Do not implement yet:** Next pages, cache tags, recommendations beyond simple same-category related items, search, or localized slugs.

**Verification:**

- Test draft/archived/deleting leakage, working edits versus old snapshots, global/locale revision mismatch, new publicationRevision, obsolete revision, unpublished locale, archived/deleting/missing-locale root or leaf category, optional fallback, media ordering/URLs, related products, sitemap entries, pagination, and private-field exclusion.
- Validate public responses through shared schemas.

**Definition of Done:** Express provides complete localized DTOs for the public catalog and sitemap without exposing drafts, admin fields, raw maps, storage keys, or other translations.

**Notes / results:** _Pending._

## Phase 6 — Product CMS

### [ ] PH06-01 — Build administrator product list

**Status:** Pending

**Goal:** Give administrators a responsive, URL-addressable workspace for finding and managing products.

**Dependencies:** PH05-03, PH05-04, and PH02-04.

**Files / folders:** frontend admin products route, ProductTable/filter/pagination components, products API service, tests.

**Implementation scope:**

- Build search, category/status/translation/featured filters, allowlisted sorting, and pagination against the admin API.
- Store query state in the URL with validated defaults.
- Show localized-name summary, slug, model/series, category, global status, locale states, featured state, and updated time.
- Add edit, duplicate, preview-availability, publish/republish, unpublish/archive, and eligible-draft-delete actions with confirmations.
- Refresh only affected list data after a successful action.
- Display empty, loading, validation, conflict, unauthorized, and unavailable-API states.

**Do not implement yet:** Bulk actions, saved filters, inline editing, product form, autosave, or client global-state framework.

**Verification:**

- Run frontend lint/typecheck/tests/build.
- Test URL persistence, browser navigation, each filter/sort combination, no results, last page, duplicate, archive/delete confirmation, session expiry, 409, and 503.
- Verify mobile table/card behavior and keyboard access to every action.

**Definition of Done:** Administrators can reliably locate and perform existing lifecycle actions on products without loading the entire collection or losing query state.

**Notes / results:** _Pending._

### [ ] PH06-02 — Build product editor shell and multilingual basics

**Status:** Pending

**Goal:** Create/edit product drafts while preserving language state and preventing accidental data loss.

**Dependencies:** PH06-01 and product admin APIs.

**Files / folders:** frontend admin product new/edit routes, editor shell/form state, Basic Information and Content panels, tests.

**Implementation scope:**

- Use React Hook Form with shared Zod-compatible contracts for the complex editor; keep server validation authoritative.
- Build the locked section navigation and persistent en/zh language tabs with Draft, Published, and Changes pending indicators derived from snapshot/sourceHash state.
- Add slug, category, model, series, name, short description, Markdown long description, warranty, featured, and display order fields.
- Fetch one complete editing DTO and submit allowlisted PATCH payloads with required version.
- Implement explicit Save Draft, dirty navigation warning, loading skeleton, field-error mapping, stale-version recovery, and safe session-expiry return.
- Keep language-tab values mounted in form state so switching cannot discard edits.
- Render Markdown preview through the chosen sanitized renderer, never arbitrary raw HTML.

**Do not implement yet:** Specifications, media, SEO, template selection, publication controls, autosave, revisions, collaboration, or unsaved preview.

**Verification:**

- Create and edit a draft, switch languages repeatedly, navigate with unsaved changes, reload saved data, trigger backend field errors, simulate 409/401/503, and inspect sanitized Markdown output.
- Run frontend lint/typecheck/tests/build and keyboard/screen-reader form checks.

**Definition of Done:** One editor safely owns basic multilingual draft state, persists it through versioned APIs, and clearly handles loss/conflict/session risks.

**Notes / results:** _Pending._

### [ ] PH06-03 — Build features, advantages, applications, and specifications editors

**Status:** Pending

**Goal:** Author flexible, ordered product content without category-specific forms or arbitrary JSON.

**Dependencies:** PH06-02.

**Files / folders:** product editor structured-content/specification components, form schemas, component tests.

**Implementation scope:**

- Add localized feature, advantage, and application item editors with stable keys.
- Add specification groups and items with stable keys, common value/unit, translated group/item labels, value override, and note.
- Implement add, remove, and accessible move-up/move-down ordering.
- Validate key uniqueness, bounds, required labels, order normalization, and maximum counts before submission.
- Preserve stable item identity in React form arrays.
- Show empty states and concise guidance for module versus inverter examples without hardcoding category fields.

**Do not implement yet:** Spreadsheet import, category-defined attributes, formulas, comparison filters, drag-and-drop, or templateData.

**Verification:**

- Construct and reload representative solar-module and inverter content.
- Test duplicate keys, maximum counts, add/remove/reorder, long Chinese labels, optional fields, server error paths, keyboard-only ordering, and form-state stability.
- Run frontend unit tests, typecheck, and build.

**Definition of Done:** Administrators can create ordered, translated, validated content/specifications for different product families using one comprehensible editor.

**Notes / results:** _Pending._

### [ ] PH06-04 — Build product media, gallery, video, and download panels

**Status:** Pending

**Goal:** Assign reusable assets to product roles with localized contextual metadata.

**Dependencies:** PH06-02, PH04-04, and PH05-03 reference integrity.

**Files / folders:** product editor media/download components, MediaPicker integration, tests.

**Implementation scope:**

- Add hero, gallery, video, backgroundVideo, datasheet, certificate, brochure, document, and openGraph roles.
- Reuse MediaPicker and filter selectable media by compatible kind.
- Add usage order, optional locale scope, and localized alt/title/caption.
- Add video poster selection and clear poster recommendations.
- Implement accessible ordering and preview for images, video, and documents.
- Surface reference and media-readiness errors from backend validation.
- Preserve shared assets across locales by default; require explicit locale for translated documents.

**Do not implement yet:** Upload transforms, crop editor, cloud direct upload, automatic video poster/transcoding, product enquiry attachments, or bulk media assignment.

**Verification:**

- Assign every role, reorder galleries/documents, add shared and language-specific assets, select invalid kinds, remove usages, reload, and attempt deletion from the media library.
- Confirm contextual metadata does not overwrite Media defaults.
- Run accessibility, frontend tests, typecheck, and build.

**Definition of Done:** A product can reference all required media/download types with valid ordering, locale behavior, contextual metadata, and deletion protection.

**Notes / results:** _Pending._

### [ ] PH06-05 — Build SEO, template, completeness, and publication controls

**Status:** Pending

**Goal:** Finish the version-one product editor and make publication state understandable and deliberate.

**Dependencies:** PH06-03, PH06-04, and PH05-02/PH05-03.

**Files / folders:** editor SEO/template/publishing panels, frontend template catalog metadata, publication service calls, tests.

**Implementation scope:**

- Add localized SEO title, description, optional keywords, OpenGraph title/description/image.
- Add a serializable template catalog keyed by the shared template IDs, with code-owned administrator labels; do not import components into the admin bundle.
- Add template selector for standard and topcon-premium.
- Show separate shared-field and per-locale Changes pending/completeness errors and warnings returned by the backend.
- Add a disabled Preview Saved Draft control explaining that secure preview is activated in PH08-02; add working publish-selected-locale, explicitly confirmed republish-all-live-locales for shared promotion, unpublish locale/all, and archive controls.
- Explain and enforce English-first/retention rules in control availability and conflict handling.
- Require a successful Save Draft before enabling publication. PH08-02 replaces the preview placeholder with the working action.
- Display revalidation status as not-applicable until Phase 8; publication remains correctness-first/uncached.
- Keep templateData absent for both initial templates.

**Do not implement yet:** Template component registry, public product route, templateData, scheduled publication, approvals, revisions, or cache invalidation.

**Verification:**

- Save complete/incomplete SEO, choose each template, publish English only, edit locale-only content while the old snapshot remains public, publish Chinese later, edit shared fields and require an explicit validated all-live-locale promotion, reject incomplete locale/implicit shared promotion/English-only unpublish, unpublish-all/archive, and recover from stale version/session expiry.
- Verify no template component code enters the admin client bundle.
- Run frontend lint/typecheck/tests/build.

**Definition of Done:** An administrator can author, validate, and publish a complete product through explicit controls without editing source code, and the future preview entry point is present but cannot imply preview works early.

**Notes / results:** _Pending._

## Phase 7 — Public Catalog and Templates

### [ ] PH07-01 — Add validated frontend API adapters and product view models

**Status:** Pending

**Goal:** Isolate public rendering and templates from HTTP, DTO, fallback, and media-storage details.

**Dependencies:** PH05-05 and Phase 1 frontend.

**Files / folders:** frontend services/api client/products/categories, lib/product-view-model.ts, media-url.ts, view-model types, tests.

**Implementation scope:**

- Build separate server public API client and browser admin client behavior; use API_INTERNAL_URL server-side and NEXT_PUBLIC_API_BASE_URL in the browser.
- Add timeout/abort, safe non-JSON error parsing, and request-ID preservation.
- Parse every response through shared schemas.
- Parse public pageTemplate through the bounded legacy read schema, then narrow to ProductTemplateId before registry lookup; never dynamically import the untrusted string.
- Distinguish confirmed 404, validation/auth errors, and upstream/network failures.
- On PUBLICATION_REVISION_CHANGED, repeat the no-store gate plus exact-revision read once; a second race becomes a retryable 503 rather than a false 404.
- Normalize locale content, optional fallback, ordering, breadcrumbs, related items, and API-provided media URLs into ProductPageViewModel. Validate that each media URL is absolute and matches the configured public media-origin allowlist; never derive a URL from a storage key in the frontend.
- Keep the adapter pure and fixture-testable.
- Use no-store for public product/category fetches until PH08-03.

**Do not implement yet:** Routes, template components, caching, retries that hide failures, React Query, or global client state.

**Verification:**

- Test valid/malformed DTOs, 404, 401, 422, 500, timeout, unreachable API, fallback flags, ordering, accepted API-provided absolute media URLs, and rejected relative/disallowed-origin URLs.
- Confirm no raw storage key, Mongoose map, ObjectId object, or admin field reaches view models.

**Definition of Done:** Public pages and templates can consume stable normalized data while transport/database failures retain distinct semantics.

**Notes / results:** _Pending._

### [ ] PH07-02 — Build product index and category listing routes

**Status:** Pending

**Goal:** Render database-driven catalog navigation and listings for each published locale.

**Dependencies:** PH07-01, PH01-04, and shared site primitives.

**Files / folders:** localized products index/category routes, catalog components, site navigation updates, tests.

**Implementation scope:**

- Build product index with published categories and featured/ordered product summaries.
- Build category route with localized category content, breadcrumb, descendants where applicable, ordered products, and bounded pagination.
- Build category entity-aware language switching from the category DTO’s availableLocales, preserving its canonical slug and disabling unpublished target locales rather than falling back to home.
- Add crawlable server-rendered pagination links.
- Add intentional empty-category, localized 404, and upstream 503 states.
- Update the public Navbar/Footer to expose Products and code-owned Home/About/Projects/News/Downloads/Contact routes.
- Keep Projects and News code-owned informational pages; no fake CMS data/API.

**Do not implement yet:** Product detail, templates, client-heavy filters, product search, Projects/News CMS, contact submission backend, or caching.

**Verification:**

- Test published/draft mixtures, empty category, parent/child navigation, pagination, category equivalent-page language switching/unavailable locale, locale differences, archived ancestor exclusion, API outage, unsupported slug, mobile layout, keyboard navigation, and long Chinese text.
- Run frontend lint/typecheck/tests/build.

**Definition of Done:** Published products automatically appear in correct localized category listings, while corporate navigation is complete and deferred CMS modules are represented honestly.

**Notes / results:** _Pending._

### [ ] PH07-03 — Build reusable public product components

**Status:** Pending

**Goal:** Centralize accessible product behaviors without forcing templates into one visual composition.

**Dependencies:** PH07-01 and design primitives.

**Files / folders:** frontend/src/components/product, component fixtures/tests.

**Implementation scope:**

- Build Breadcrumb, Specifications, Gallery, VideoPlayer, Downloads, Certifications, RelatedProducts, and EnquiryCta.
- EnquiryCta links to localized Contact or configured mail action; no form/API is added.
- Components accept explicit view-model props and variants, never pageTemplate.
- Handle partial/empty fields, broken media, translated alt/title, long content, and keyboard interaction.
- Provide stable dimensions/aspect ratios and reduced-motion behavior.
- Keep visual defaults neutral enough for composition inside different templates.

**Do not implement yet:** Page-level layout, template branching, global animation runtime, enquiry backend, or CMS layout controls.

**Verification:**

- Component-test full, partial, empty, broken-media, long English/Chinese, keyboard, screen-reader name, reduced-motion, and mobile behavior.
- Verify shared components contain no template-ID condition.

**Definition of Done:** Templates can compose tested product behaviors with accessible defaults and no duplicated transport/fallback logic.

**Notes / results:** _Pending._

### [ ] PH07-04 — Add template registry, renderer, and Standard template

**Status:** Pending

**Goal:** Establish safe code-owned template selection and a dependable universal fallback design.

**Dependencies:** PH07-01, PH07-03, and PH06-05 catalog metadata.

**Files / folders:** product-templates catalog.ts, registry.server.ts, types.ts, ProductPageRenderer.tsx, Standard directory, tests.

**Implementation scope:**

- Make catalog.ts the serializable frontend source derived from shared IDs and administrator labels.
- Add a server-only static loader registry that compile-time satisfies every ProductTemplateId.
- Implement ProductPageRenderer with known-ID lookup, preview diagnostics, and legacy unknown-ID handling.
- Build Standard as focused Hero, Overview, Features, Specifications, Media, Downloads, Related, and CTA sections.
- Keep Standard a Server Component composition; interactive children remain isolated.
- For an unknown legacy ID, render Standard only if the common view model validates and emit structured monitoring/log output; normal save/publish already rejects it.

**Do not implement yet:** Product detail route, custom premium template, templateData, animations beyond shared primitives, or CMS-controlled design.

**Verification:**

- Type-check complete registry, known IDs, simulated unknown legacy ID, missing optional sections, full content, and bundle boundaries.
- Confirm catalog imports no React components and admin bundles no template modules.
- Run frontend tests/build.

**Definition of Done:** Every valid template ID has a compile-time registered loader, Standard renders any valid common product, and unsafe dynamic import behavior is impossible.

**Notes / results:** _Pending._

### [ ] PH07-05 — Add first professional custom template

**Status:** Pending

**Goal:** Validate that a distinctive product design can reuse CMS data and shared behavior without product hardcoding.

**Dependencies:** PH07-04.

**Files / folders:** product-templates/TopconPremium section components, registry/catalog tests, fixtures.

**Implementation scope:**

- Implement focused Hero, Technology, Advantages, Specifications, Gallery/Video, Downloads, and CTA sections.
- Compose the shared product components where their APIs fit.
- Use common ProductPageViewModel fields only; templateData remains deferred.
- Add responsive art direction, semantic headings, clear focus behavior, and CSS/reduced-motion-safe animations.
- Add two fixture products with different names/models/media/specifications using the same template.
- Avoid GSAP unless a documented interaction cannot be achieved cleanly with CSS or the chosen lightweight motion approach.

**Do not implement yet:** Additional templates, product-specific constants, templateData, heavy parallax, global animation dependencies, or editable layout.

**Verification:**

- Render both fixtures at representative mobile/tablet/desktop widths.
- Verify no product copy, ID, slug, model, media path, or specification value exists in template source.
- Run accessibility tests, visual screenshots, reduced-motion test, bundle inspection, typecheck, and build.

**Definition of Done:** Two products render as a polished unique design using only supplied data, proving the content/design boundary and template reuse model.

**Notes / results:** _Pending._

### [ ] PH07-06 — Build product detail route and equivalent-page language switching

**Status:** Pending

**Goal:** Resolve a localized product to its coded template and preserve entity context across languages.

**Dependencies:** PH07-02, PH07-04, and PH07-05.

**Files / folders:** localized product detail route, route-aware LocaleSwitcher, page tests.

**Implementation scope:**

- Fetch the no-store visibility gate by canonical slug/locale, then fetch the exact published snapshot using its required publicationRevision; both remain no-store until Phase 8.
- Render breadcrumb and selected template through ProductPageRenderer.
- Map a confirmed API 404 to notFound; map upstream failures to the retryable error boundary.
- Build entity-aware locale switching from availableLocales, changing only the locale segment.
- Disable/label unpublished target languages rather than linking to a fallback/homepage.
- Preserve stable category-independent canonical route shape.
- Keep both gate and snapshot fetches no-store until Phase 8; after Phase 8 only the snapshot fetch becomes cached.

**Do not implement yet:** Preview, metadata beyond safe generic defaults, caching, localized slugs, redirects, or client-side product fetching.

**Verification:**

- Test Standard, TopconPremium, simulated bounded unknown legacy ID, absent slug, global draft, unpublished locale, obsolete revision, working edits that do not change live output, upstream outage, language switching, browser navigation, and long/partial content.
- Run frontend lint/typecheck/tests/build.

**Definition of Done:** Every public product route uses API content and a registered coded template, equivalent-language navigation remains on the product, and outages cannot become false 404s.

**Notes / results:** _Pending._

## Phase 8 — Preview and Cache

### [ ] PH08-01 — Implement short-lived preview grants in Express

**Status:** Pending

**Goal:** Authorize narrowly scoped access to one saved draft/version through a single-use grant and short-lived access credential without exposing an admin session.

**Dependencies:** PH05-03, PH05-05, and authentication.

**Files / folders:** backend PreviewGrant infrastructure model, preview service/admin grant route/internal exchange route/preview read route, preview contracts, tests.

**Implementation scope:**

- Implement authenticated preview-grant issuance for product ID and supported locale using 256 random bits; require a valid unique canonical working slug, then store only the token hash with product, locale, administrator, working version, consumedAt, and five-minute TTL.
- Return a frontend preview URL built from configured trusted origin and server-known route pattern containing the opaque single-use grant.
- Implement POST exchange protected by PREVIEW_EXCHANGE_SECRET; atomically consume one unexpired/unused hash, load the exact version-matched Product, and return a signed five-minute access credential plus verified productId, locale, and canonical slug. Caller-provided redirect/slug/locale fields are ignored or rejected.
- Implement preview product read that requires Authorization: Preview, verifies signature/claims/current version, then returns the saved working data required for rendering.
- Apply no-store and stable preview error codes.
- Never accept an arbitrary redirect target or grant access to general admin endpoints.

**Do not implement yet:** Next Draft Mode, long-lived share links, comments, unsaved content, or token database/revocation UI.

**Verification:**

- Test valid issuance/exchange/read and verified redirect fields, invalid/non-unique slug at issuance, replayed grant, expired grant/credential, modified credential, caller-supplied redirect/slug/locale, wrong internal secret, wrong purpose/product/locale, stale version, inactive user, and unauthenticated issuance/use.
- Verify token values are redacted from logs.

**Definition of Done:** Express atomically exchanges one opaque grant for a reusable five-minute, product/locale/version-bound preview credential and verifies it without weakening public or admin authorization.

**Notes / results:** _Pending._

### [ ] PH08-02 — Implement Next Draft Mode preview entry and exit

**Status:** Pending

**Goal:** Render authorized draft content through the exact public template with secure cache/index behavior.

**Dependencies:** PH08-01 and PH07-06.

**Files / folders:** frontend internal preview/exit Route Handlers, preview fetch helper/banner/error state, admin Preview action, tests.

**Implementation scope:**

- Exchange the URL grant server-to-server through POST /api/v1/preview/exchange with PREVIEW_EXCHANGE_SECRET, validate the returned productId/locale/slug/access credential contract, and only then enable Draft Mode.
- Store the returned access credential in a host-only HTTP-only, production Secure, SameSite Lax, Path=/, five-minute cookie and remove the opaque grant from URL/history.
- Redirect only to a localized product path constructed from the exchange response’s verified locale and canonical slug; never use a URL, locale, slug, or return target supplied by the browser.
- Detect Draft Mode in the product route, forward the credential server-side as Authorization: Preview to the protected preview API with no-store, and render the same ProductPageRenderer.
- Add visible Preview and Exit Preview UI.
- Emit noindex/nofollow and omit preview pages from analytics, sitemap, and hreflang.
- Clear both Draft Mode and preview authorization on exit.

**Do not implement yet:** Unsaved live preview, collaborative review links, device emulation, comments, or general draft browsing.

**Verification:**

- Test entry, single-use exchange/replay rejection, verified locale/slug redirect construction, clean URL/history, actual selected template, cookie attributes, exit, expiration, tampering, stale version, wrong product/locale, caller-supplied redirect/slug/locale and open-redirect attempts, and public endpoint isolation.
- Inspect cookies, Cache-Control, robots metadata, and browser history.

**Definition of Done:** An authorized administrator can preview a saved draft in its production renderer; the draft is uncached, unindexed, and unavailable through public APIs.

**Notes / results:** _Pending._

### [ ] PH08-03 — Add explicit public cache tags and signed invalidation

**Status:** Pending

**Goal:** Improve public performance while preserving deterministic publication behavior.

**Dependencies:** PH08-02 and all public routes.

**Files / folders:** frontend public fetch/cache helpers and revalidation Route Handler, backend revalidation callback service, configuration/tests.

**Implementation scope:**

- Pin and document the exact Next.js cache APIs used by the installed major version.
- Keep product visibility/revision, category trees/listings, and product listings no-store.
- Cache only the immutable product snapshot read keyed by slug, locale, and required publicationRevision.
- Add explicit tags for products, individual slug, categories, category slug, media ID, and sitemap.
- Add a conservative time-based fallback interval.
- Implement POST-only internal revalidation with timestamped HMAC signature, replay window, constant-time comparison, and bounded event schema.
- Emit callback events after product locale publication/shared promotion/category move/unpublish/archive, category shared/locale publication/reorder/unpublish/archive/delete, and public-facing media metadata/poster changes.
- Invalidate old/new product/category paths, global categories/products, affected media IDs, and sitemap where applicable.
- Use immediate invalidation semantics for unpublish/archive and normal refresh semantics for ordinary updates according to supported APIs.
- Surface callback success/failure separately from database mutation success.

**Do not implement yet:** Queue, retries beyond bounded in-process attempt, Redis, eager rebuild farm, or CDN purge.

**Verification:**

- Test publish, working edit without publication, locale republish/new revision, all-live-locale shared promotion, category move/publication/reorder/root archive, media metadata/poster change, Chinese publication, unpublish, archive, invalid signature, replay, malformed event, and unavailable frontend callback.
- Confirm the no-store gate hides unpublished content and selects the new revision even when invalidation fails.
- Confirm a new product appears, changed published content refreshes, and unpublished content stops resolving.
- Confirm upstream API outages are never cached as product 404s.

**Definition of Done:** Product snapshots use explicit revision-keyed caching behind an uncached visibility gate, listings remain correctness-first, all lifecycle events invalidate affected surfaces, and callback failure cannot expose unpublished working content.

**Notes / results:** _Pending._

### [ ] PH08-04 — Add revalidation retry, logging, and admin feedback

**Status:** Pending

**Goal:** Make cache-invalidation failures operationally recoverable without adding infrastructure.

**Dependencies:** PH08-03.

**Files / folders:** backend callback retry/logging, product publication responses, admin feedback/retry action, tests.

**Implementation scope:**

- Add a small bounded retry with exponential delay for transient callback failures; do not hold requests for an excessive duration.
- Record request ID, operation, affected entity/locales, attempts, and final status without secrets.
- Return publication success plus a distinct revalidation warning when content committed but invalidation failed; visibility/revision correctness remains guaranteed by the uncached gate.
- Add an authenticated manual revalidation retry action for the affected product/event.
- Keep the time-based public cache fallback as the final consistency safety net.

**Do not implement yet:** Persistent job queue, scheduled worker, monitoring vendor, email alerts, or automatic infinite retries.

**Verification:**

- Simulate transient success, permanent failure, invalid secret, duplicate retry, expired event, and administrator manual retry.
- Verify publication state is not rolled back incorrectly and warnings are unambiguous.

**Definition of Done:** A failed frontend callback is logged, visible, safely retryable, and cannot be mistaken for failed database publication.

**Notes / results:** _Pending._

## Phase 9 — SEO and Performance

### [ ] PH09-01 — Add localized metadata, canonical URLs, and social metadata

**Status:** Pending

**Goal:** Generate unique, truthful, server-rendered search and sharing metadata for every indexable locale page.

**Dependencies:** PH07-02, PH07-06, and PH08-03.

**Files / folders:** frontend lib/seo.ts, localized route metadata functions, metadata tests.

**Implementation scope:**

- Validate SITE_URL as an absolute production base and configure metadataBase.
- Generate product/category titles and descriptions from localized SEO fields with documented localized derivation fallback.
- Generate code-owned localized metadata for Home, About, Products index, Projects, News, Downloads, and Contact from versioned dictionaries/site configuration; no absent CMS model is queried, and unknown News detail slugs remain 404/noindex.
- Emit self-referencing canonical URLs.
- Emit reciprocal alternates for available published locales only, using language tags from the registry. Emit x-default to English only after verifying the English canonical is indexable; the locked retention rule makes this true for live Product/Category entities.
- Emit OpenGraph type, locale, title, description, absolute image, alt, width, and height.
- Emit Twitter/X summary_large_image only when a suitable image exists.
- Reuse the same memoized/cached entity read for page content and metadata where the selected Next version supports it safely.
- Add safe site-level title template and Organization defaults.

**Do not implement yet:** Structured data, sitemap, fabricated keywords, localized slugs, or CMS-driven site settings.

**Verification:**

- Inspect rendered head for every enabled locale's product/category pages, a single-locale product, missing optional SEO, missing OG image, and every code-owned Home/About/Products/Projects/News/Downloads/Contact route.
- Test canonical and alternates as absolute, self-consistent URLs; verify x-default always resolves and never points to an unpublished English entity.
- Confirm preview/unpublished locales are absent and no duplicate API fetch is introduced unnecessarily.

**Definition of Done:** Each public locale page has one self-canonical and a correct published-only alternate cluster with unique localized metadata.

**Notes / results:** _Pending._

### [ ] PH09-02 — Add Organization, Breadcrumb, and Product structured data

**Status:** Pending

**Goal:** Help search engines understand the organization, catalog hierarchy, and real product facts without inventing commerce data.

**Dependencies:** PH09-01 and normalized product/category view models.

**Files / folders:** frontend lib/structured-data.ts, JSON-LD components/tests.

**Implementation scope:**

- Add Organization at site level using code-owned configuration until SiteSettings exists.
- Add localized BreadcrumbList matching visible navigation, not necessarily URL segment depth.
- Add Product with localized name/description/images, brand/organization, model, category, and truthful available identifiers.
- Omit offers, price, availability, aggregateRating, review, and other absent commerce fields.
- Use canonical absolute URLs and localized visible values.
- Serialize through a helper that escapes script-closing/HTML-sensitive characters.
- Emit structured data only on indexable public pages.

**Do not implement yet:** Merchant listings, reviews, ratings, ProductGroup variants, NewsArticle schema, or CMS-editable organization settings.

**Verification:**

- Parse generated JSON as JSON.
- Run representative pages through structured-data validation tooling.
- Test malicious CMS strings containing angle brackets/script fragments.
- Confirm every structured value is visible or factually supported by the page/API.

**Definition of Done:** Organization, breadcrumbs, and products expose valid localized JSON-LD without XSS or fabricated commercial claims.

**Notes / results:** _Pending._

### [ ] PH09-03 — Generate localized sitemap and robots behavior

**Status:** Pending

**Goal:** Expose all and only canonical, indexable public URLs to crawlers.

**Dependencies:** PH05-05 sitemap endpoint, PH09-01, and PH08-03 cache invalidation.

**Files / folders:** frontend app/sitemap.ts, robots.ts, sitemap API service/tests.

**Implementation scope:**

- Page through the dedicated sitemap-entries endpoint until complete.
- Include code-owned corporate pages for each supported locale.
- Include only categories/products whose requested locale snapshot coheres with publishedGlobal and whose complete category ancestor chain is active, non-deleting, coherent, and locale-published.
- Add language alternates and real updatedAt.
- Use SITE_URL absolute canonical hosts and stable slash policy.
- Exclude admin, internal routes, preview, drafts, archived entities, missing translations, and media internals.
- Add robots rules for public production and global noindex behavior for non-production.
- Tag sitemap data so publication/category operations invalidate it.
- Keep one sitemap until measured URL volume approaches the protocol threshold.

**Do not implement yet:** Sitemap splitting, image/video/news sitemap extensions, Search Console automation, or redirect model.

**Verification:**

- Validate generated XML/metadata output, absolute hosts, language alternates, lastModified values, and corporate routes.
- Test English-only then Chinese-published product, rejected English-only unpublish while Chinese remains, valid unpublish-all/archive, archived root hiding descendant/product entries, empty catalog, API outage, and non-production robots.
- Confirm robots is not used as authorization.

**Definition of Done:** Crawlers receive a valid, current, published-only localized sitemap and environment-correct robots behavior.

**Notes / results:** _Pending._

### [ ] PH09-04 — Optimize responsive media, video, client islands, and motion

**Status:** Pending

**Goal:** Meet explicit performance budgets on representative media-heavy product pages without sacrificing the premium design.

**Dependencies:** PH07-03 through PH07-06 and PH08-03.

**Files / folders:** Next image configuration, shared media components, template client islands, performance fixtures/tests.

**Implementation scope:**

- Configure strict image remotePatterns from validated environment.
- Supply dimensions/aspect ratio, accurate sizes, and priority only for the actual LCP hero.
- Lazy-load below-fold images and gallery interactions.
- Use posters, preload none/metadata, click-to-play, playsInline, and mobile-aware background-video behavior.
- Prevent offscreen video requests before intent.
- Split galleries, video controls, and animation controllers into the smallest practical Client Components.
- Load any motion library only from the template/section using it.
- Respect reduced motion and avoid layout-triggering animation.
- Choose representative acceptance pages: Standard full-media product and TopconPremium full-media product, tested at 390×844 mobile and 1440×900 desktop on production builds.

**Do not implement yet:** CDN transforms, image pre-generation, video transcoding, service worker, speculative prefetching, or global GSAP.

**Verification:**

- Run mobile Lighthouse against production server with LCP below 2.5 s, CLS below 0.1, and INP below 200 ms under the documented test profile.
- Use browser/network tests to prove no offscreen video download before intent.
- Run bundle analysis, reduced-motion, missing poster, slow network, and layout-shift checks.

**Definition of Done:** Both representative templates meet documented budgets or have an approved Decision Log exception with measured evidence and remediation task.

**Notes / results:** _Pending._

### [ ] PH09-05 — Add localized loading, not-found, outage, media, and preview error states

**Status:** Pending

**Goal:** Make every known public/admin failure mode intentional, accessible, and correctly classified.

**Dependencies:** PH07-06, PH08-02, PH08-04, and locale dictionaries.

**Files / folders:** localized loading/error/not-found components, media placeholder, admin/global error adapters, tests.

**Implementation scope:**

- Add localized route loading, 404, retryable 503, empty category, and unexpected-error states.
- Add dimensioned branded image placeholder and video/poster fallback.
- Add invalid/expired/stale preview screen with exit and return-to-editor guidance.
- Preserve request IDs in safe support messages.
- Handle administrator session expiry without falsely claiming a save; retain safe in-memory dirty state during reauthentication where technically reliable.
- Distinguish confirmed entity absence from network/backend failure in every route.
- Add legacy unknown-template diagnostic banner in preview/admin while public Standard fallback remains graceful.

**Do not implement yet:** Monitoring vendor integration, offline application mode, automatic mutation retry, or localStorage persistence of sensitive form data.

**Verification:**

- Inject every Section 12 condition and confirm expected status, copy, focus, retry/exit actions, and no secret/stack leakage.
- Test keyboard, screen reader announcement, long Chinese text, narrow viewport, and reduced motion.

**Definition of Done:** Known failures degrade predictably, retain correct HTTP/index semantics, and never convert outages into false content absence or false save success.

**Notes / results:** _Pending._

## Phase 10 — Hardening and Release Readiness

### [ ] PH10-01 — Complete security hardening checklist

**Status:** Pending

**Goal:** Verify the combined application against the locked security requirements before release testing.

**Dependencies:** Phases 1 through 9 complete.

**Files / folders:** security middleware/configuration, threat checklist, regression tests, operational documentation.

**Implementation scope:**

- Review every admin router for authentication, CSRF, Origin, validation, rate limiting, and no-store behavior.
- Review public mappers for draft/admin/storage-field leakage.
- Apply and test CSP, frame restrictions, nosniff, referrer policy, and production HSTS.
- Verify session, proxy trust, cookie, CORS, secret length, and environment behavior under production-like topology.
- Test NoSQL operator injection, mass assignment, XSS/Markdown, JSON-LD serialization, traversal, forged media, and oversized inputs.
- Confirm logs redact credentials, cookies, CSRF, preview grants, sensitive request bodies, and secrets.
- Run dependency audit and document accepted risks with owners/remediation.

**Do not implement yet:** Third-party penetration test, WAF, SIEM, advanced malware scanner, MFA, or enterprise RBAC.

**Verification:**

- Execute the security regression suite and manual checklist.
- Inspect representative response headers and logs.
- Prove every admin endpoint fails without auth/CSRF and every public endpoint excludes drafts.

**Definition of Done:** Every Section 13 requirement is either verified passing or represented by an approved, time-bounded Decision Log exception.

**Notes / results:** _Pending._

### [ ] PH10-02 — Complete backend unit and HTTP integration tests

**Status:** Pending

**Goal:** Lock down backend business rules, middleware, MongoDB behavior, and storage behavior through stable tests.

**Dependencies:** PH10-01 and all backend features.

**Files / folders:** backend tests/unit, integration, fixtures, test helpers.

**Implementation scope:**

- Cover translation resolution, split working-to-global/locale snapshot promotion/hash/revision, explicit all-live-locale shared promotion, English retention, publication completeness, hierarchy cycles/depth, duplicate semantics, optimistic concurrency, transaction-backed reference checks, storage safety, preview grant exchange/access credentials, and revalidation signing.
- Cover pre-auth/authenticated CSRF lifecycle, cookies/CORS, rate limits, category/product CRUD and lifecycle snapshots, complete-ancestor public exclusion, working/live media reference checks, visibility gate, upload pipeline, cleanup, Product/Category/Media/poster usage conflicts, lifecycle operations, preview replay/redirect identity protection, and sitemap data.
- Use explicitly isolated MongoDB and generated temporary upload directories.
- Add deterministic fixtures for module, inverter, categories, media, both locales, and every template ID.
- Avoid brittle tests of trivial implementation details.

**Do not implement yet:** High-scale load test, production data testing, chaos platform, or coverage of private library internals.

**Verification:**

- Run npm run test -w backend repeatedly and from a clean test database.
- Run backend typecheck/lint/build.
- Verify cleanup leaves no test documents or files.

**Definition of Done:** Critical backend rules and HTTP boundaries have deterministic regression coverage, with no test capable of targeting non-test data.

**Notes / results:** _Pending._

### [ ] PH10-03 — Complete frontend component, route, SEO, accessibility, and visual tests

**Status:** Pending

**Goal:** Protect CMS state, rendering contracts, locale behavior, SEO, and accessible interaction without brittle snapshots.

**Dependencies:** PH10-01 and all frontend features.

**Files / folders:** frontend component/route tests, API fixtures, accessibility helpers, visual baselines.

**Implementation scope:**

- Cover language-tab/global-and-locale snapshot state, shared-promotion confirmation, dirty warnings, field errors, stale version, session expiry, specification/media ordering, bounded legacy template resolution, product/category equivalent-page locale switching, fallback rendering, and error states.
- Cover product/category plus every code-owned corporate route’s metadata, canonical/alternate/x-default clusters, sitemap/robots helpers, and safe JSON-LD.
- Run automated accessibility checks on login, admin list/editor, catalog, Standard, and TopconPremium.
- Add targeted visual baselines for Standard and TopconPremium at mobile/desktop with English, long Chinese, missing optional content, and reduced motion.
- Prefer behavioral assertions over broad markup snapshots.

**Do not implement yet:** Exhaustive browser/version matrix, Storybook, visual baselines for every minor component, or testing third-party internals.

**Verification:**

- Run frontend test, lint, typecheck, and production build.
- Review visual diffs intentionally and verify no accidental baseline updates.
- Complete keyboard and screen-reader smoke checks.

**Definition of Done:** Critical frontend behavior, SEO generation, accessibility, and template layouts have stable automated/manual evidence.

**Notes / results:** _Pending._

### [ ] PH10-04 — Add critical Playwright editorial workflow

**Status:** Pending

**Goal:** Prove the primary business journey across browser, Next, Express, MongoDB, and local storage.

**Dependencies:** PH10-02 and PH10-03.

**Files / folders:** frontend tests/e2e, Playwright configuration, isolated seed/cleanup helpers.

**Implementation scope:**

- Automate: acquire pre-auth CSRF → login/session-token rotation → create and English-publish root/child category snapshots → add Chinese category snapshots → upload media/poster → create product → add English/Chinese content/specifications/media/SEO → save → preview working copy through verified redirect identity → publish English → edit locale-only working content and verify live snapshot unchanged → republish → verify Chinese unavailable → publish Chinese → change a shared field and atomically promote all live locales → verify both product/category equivalent-language switches/metadata → reject English-only unpublish → archive ancestor/product and verify visibility-gated removal → logout with authenticated CSRF.
- Add negative journeys for unauthorized admin route, forged upload, invalid publication, expired preview, and public draft leakage.
- Run desktop Chromium and one mobile viewport against isolated services/data.
- Capture trace/screenshot only on failure and redact secrets.

**Do not implement yet:** Exhaustive browsers, parallel multi-user editing, production environment execution, or load generation.

**Verification:**

- Run the full E2E suite twice from clean seeded state.
- Verify generated test media/database cleanup.
- Confirm failures produce actionable traces without credentials/tokens.

**Definition of Done:** The complete editorial/publication workflow and highest-risk negative paths pass through real HTTP/browser boundaries.

**Notes / results:** _Pending._

### [ ] PH10-05 — Run clean-checkout release gate

**Status:** Pending

**Goal:** Establish an objective, reproducible version-one release decision.

**Dependencies:** PH10-01 through PH10-04.

**Files / folders:** root release scripts/checklist, lockfile, reports referenced from Notes / results.

**Implementation scope:**

- From a clean checkout, install from lockfile and validate environment examples.
- Run root formatting check, lint, strict typecheck, unit/integration/component/E2E tests, and production builds.
- Run dependency audit, security regressions, accessibility scans, visual checks, and representative Lighthouse budgets.
- Verify no secrets/uploads/test data/build outputs are tracked.
- Verify database indexes initialize as expected and backup/restore rehearsal is documented.
- Record exact commands, versions, outcomes, exceptions, and report locations.
- Block release on any unapproved failure.

**Do not implement yet:** Deployment, production migration, cloud resources, or bypassing failed gates.

**Verification:**

- Execute the full gate in the documented order on a clean workspace.
- Compare results against Section 16 acceptance criteria.

**Definition of Done:** Every mandatory gate passes or an explicit approved exception identifies owner, expiry, consequence, and remediation; the repository is release-ready but not deployed.

**Notes / results:** _Pending._

### [ ] PH10-06 — Complete operating and extension documentation

**Status:** Pending

**Goal:** Allow another developer/operator to run, maintain, back up, troubleshoot, and extend the system without architectural guesswork.

**Dependencies:** PH10-05.

**Files / folders:** README and focused docs referenced by it; this plan’s status/decision/progress sections.

**Implementation scope:**

- Document setup, environment variables, local ports, MongoDB, admin bootstrap, uploads, tests, builds, and troubleshooting.
- Document API envelope/auth/CSRF usage and common error codes.
- Document backup/restore rehearsal, upload/database consistency checks, and session-secret implications.
- Document template creation, ID/version lifecycle, fixtures, CMS availability, deployment ordering, and legacy migration.
- Document local-to-object-storage migration using the provider contract.
- Document reverse-proxy/cookie/CORS/trust-proxy requirements.
- Reconcile every completed task, phase checkbox, Decision Log entry, and Progress Log entry.

**Do not implement yet:** Cloud-specific deployment playbook, News/Projects CMS guides, enterprise incident management, or undocumented future features.

**Verification:**

- Have a second developer or clean-room agent follow setup and one template-extension exercise using documentation only.
- Run every documented command and verify paths/names against the repository.

**Definition of Done:** Documentation matches the released repository, another developer can operate and extend it, and all 48 task records accurately reflect evidence and state.

**Notes / results:** _Pending._

---

# 16. Testing and Release Gates

## 16.1 Required test layers

| Layer | Required coverage |
|---|---|
| Static | Formatting check, lint, strict TypeScript, contracts/backend/frontend production builds |
| Contracts | Locales, IDs, DTOs, envelopes, pagination, template IDs |
| Backend unit | Publication, translation fallback, hierarchy, storage, references, preview, revalidation |
| Backend integration | Auth/CSRF/CORS, CRUD, draft isolation, uploads, lifecycle, sitemap data |
| Frontend component | Forms, language state, specifications, media, templates, errors, accessibility |
| Route/SEO | Locale routes, 404/503 distinction, metadata, alternates, sitemap, robots, JSON-LD |
| E2E | Full administrator-to-public publication workflow and negative security paths |
| Visual/manual | Responsive layouts, long Chinese, keyboard, screen reader, reduced motion, slow network |
| Performance | Standard and TopconPremium on specified mobile/desktop profiles |
| Security | Injection, XSS, session, CSRF, CORS, rate limit, upload spoofing/traversal, secret leakage |

## 16.2 Mandatory scenario matrix

- Pre-auth CSRF, login, session/CSRF rotation, refresh, authenticated-CSRF logout, expiration, stale-token rejection, foreign Origin, and rate limiting.
- Parent/child category creation, English-first/retention, locale publication, cycle/depth rejection, ordering, archived-ancestor exclusion, stale version, and occupied deletion.
- Every allowed media type plus forged MIME, invalid PDF, oversized/truncated request, traversal filename, cleanup, and working/live-snapshot referenced deletion.
- Solar-module and inverter specifications through the same schema/editor.
- Incomplete draft save versus invalid publication rejection.
- English-only publication followed by Chinese publication, plus explicit atomic all-live-locale promotion after shared-field changes.
- Strict public exclusion of global drafts and draft translations.
- Duplicate product reusing media without copying physical files.
- Product/category optimistic-concurrency conflicts.
- Known, reused, and simulated unknown legacy template rendering.
- Preview expiry, tampering, stale version, wrong product/locale, trusted redirect identity, browser redirect-field rejection, and public draft isolation.
- New publication, edit, category move, locale publication, unpublish, archive, and revalidation failure/retry.
- Equivalent product/category page language switching and unavailable-locale behavior.
- Canonical and reciprocal published-only hreflang with a resolving English x-default.
- Valid JSON-LD without fabricated price, stock, offer, rating, or review.
- Slow network, missing media/poster, reduced motion, and no premature video download.
- Full browser editorial workflow through logout.

## 16.3 Release acceptance criteria

- Root install uses one committed lockfile and succeeds from a clean checkout.
- Every workspace lint, strict typecheck, test, and production build passes.
- No core domain or API path uses any; unknown is parsed before use.
- No binary media is present in MongoDB.
- No CMS value controls imports, components, CSS, or animation code.
- No draft/unpublished locale is accessible through public API, page, sitemap, metadata, or structured data.
- No public locale snapshot has a globalRevision mismatch, no shared field differs by locale, and every x-default URL resolves.
- No referenced media/category can be destructively removed.
- No secret, uploaded asset, test database content, or generated build output is tracked.
- Session/CSRF/CORS/security regression suite passes.
- Standard and TopconPremium meet approved accessibility, visual, and performance targets.
- Backup/restore and local media consistency procedures are documented and rehearsed.
- This plan’s phase/task state and logs exactly match the evidence.

---

# 17. Future Improvements

Prioritize only after measured version-one needs:

1. S3, Cloudflare R2, Alibaba OSS, or another StorageProvider plus CDN.
2. Direct/resumable object-storage uploads.
3. Background image resizing, thumbnails, video posters/transcoding, and malware scanning.
4. Project and NewsArticle CMS modules.
5. SiteSettings for organization metadata, contact data, locales, and social profiles.
6. Revision history, rollback, scheduled publication, and approval workflow.
7. Multiple staff roles, MFA, password reset, invitations, and device/session management.
8. Redirect model and localized slugs.
9. Translation-provider integration and completeness dashboards.
10. Product import/export.
11. Advanced search only when bounded MongoDB search is measured inadequate.
12. Enquiry/contact submission API and CRM integration after requirements and privacy policy exist.
13. Monitoring, metrics, uptime alerts, and centralized logs.
14. AuditLog UI.
15. Storybook when reusable components are numerous enough to justify its maintenance.

Each future feature requires its own Decision Log entry and new task cards before implementation.

---

# 18. Risks and Prohibited Patterns

| Risk/prohibited pattern | Required prevention |
|---|---|
| Multilingual added later | Locale contracts, routes, schemas, CMS, publication, and SEO begin in foundation. |
| English indexed under foreign locale | Core translations publish independently; missing locale returns 404. |
| Saving edits changes live content | Public APIs read immutable snapshots; editors modify working content only. |
| Shared fields diverge across locale URLs | Separate publishedGlobal from locale snapshots; explicit shared promotion atomically republishes every live locale. |
| English x-default becomes a 404 | English-first publication and English-retention while any other locale is live. |
| Archived parent leaves descendants visible | Every public category/product/list/sitemap read validates the complete ancestor chain. |
| Localized slugs too early | One shared immutable slug; redirects/localized aliases deferred. |
| Category in product URL | Product canonical remains category-independent. |
| Unlimited hierarchy | Version-one depth is root plus child. |
| Multi-category ambiguity | One leaf category per product. |
| Template per product by default | Share templates unless art direction genuinely differs. |
| Hardcoded product content in template | Templates receive only normalized view-model props. |
| Database string used as import | Static registry only. |
| Client registry bundles all templates | Serializable catalog separated from server loaders. |
| Arbitrary templateData | Versioned Zod schema, bounds, migration, and coded editor. |
| Specification labels as identifiers | Stable language-neutral keys. |
| Schema.Types.Mixed for product content | Typed subdocuments and parsed unknown boundaries. |
| Raw Mongoose types in API | DTO mapper and string ObjectIds. |
| Business logic in controllers | Services own rules; controllers own HTTP mapping. |
| Premature repositories/microservices | Modular Express monolith until measured need. |
| Absolute media URLs in database | Provider plus relative key. |
| Media overwritten in place | Immutable UUID keys and explicit reference update. |
| File extension trusted | Signature/MIME/type validation and server-derived extension. |
| Unsanitized SVG/HTML | SVG disabled; Markdown/rendered content sanitized. |
| Large upload buffered in memory | Temporary disk streaming and limits. |
| Local disk used across production replicas | Migrate through StorageProvider before horizontal scale. |
| Cascade deletion | Reference conflict and explicit reassignment. |
| Query-then-delete race | Replica-set transactions plus deleting state and reference recheck. |
| Media poster deleted indirectly | Media-to-Media poster references participate in usage checks. |
| Asset removed from working data but still live | Media usage checks include global and per-locale publication snapshots. |
| Frontend-only admin protection | Express authorization on every admin route. |
| JWT/localStorage complexity | Opaque Mongo-backed sessions. |
| Wildcard credentialed CORS | Exact origin only. |
| SameSite treated as full CSRF defense | CSRF token plus Origin validation. |
| API outage mapped to 404 | Distinct 503/error behavior. |
| Cached page survives unpublish | No-store visibility/revision gate before cached snapshot read. |
| Caching before invalidation | Correctness-first no-store until Phase 8 tests. |
| Revalidation failure hidden | Warning, log, bounded retry, manual retry, TTL fallback. |
| Preview URL replay | Hashed single-use grant exchange and short-lived bound access credential. |
| Browser controls preview redirect | Exchange returns verified product identity; Next constructs the route from that response only. |
| Heavy global animation/video | Template-local islands, posters, lazy loading, budgets. |
| Unfinished future CMS screens | Hide modules until implemented. |
| Silent architectural drift | Decision Log before implementation. |

---

# 19. Decision Log

Decision entries are immutable. A changed decision receives a new ID and identifies the superseded entry.

| ID | Date | Status | Decision | Rationale | Alternatives rejected | Consequences | Affected tasks | Supersedes |
|---|---|---|---|---|---|---|---|---|
| ADR-001 | 2026-08-26 | Accepted | Use separate Next.js and Express applications in one monorepo. | Preserves clear ownership while simplifying coordinated development. | Next API routes; microservices. | Two deployable processes and explicit REST boundary. | All | — |
| ADR-002 | 2026-08-26 | Accepted | Add a narrow contracts workspace. | Prevents DTO/locale/template-ID drift without sharing app internals. | Duplicate types; import backend source into frontend. | Shared Zod runtime dependency and coordinated versioning. | PH01-01, PH01-02, all API tasks | — |
| ADR-003 | 2026-08-26 | Accepted | Use locale-keyed typed maps and independent translation publication. | Direct lookup, expandable locales, no duplicate translation entries. | Field-level maps; arrays; separate collections/databases. | Locale validation and DTO serialization are mandatory. | PH01-02, PH03-01, PH05-01 onward | — |
| ADR-004 | 2026-08-26 | Accepted | Use one global immutable post-publication ASCII slug. | Stable switching/canonical URLs and simple uniqueness. | Localized slugs; category-bearing product URLs. | Redirect model required before future published-slug edits. | PH03-01, PH05-01, PH07-06, PH09-01 | — |
| ADR-005 | 2026-08-26 | Accepted | Use parentId with a two-level category cap and one leaf category per product. | Meets current taxonomy without recursive/tree overengineering. | Nested sets; materialized paths; multi-category products. | Product moves do not affect canonical URL. | PH03-01 through PH03-03, PH05-01 | — |
| ADR-006 | 2026-08-26 | Accepted | Use Mongo-backed opaque sessions with CSRF/Origin defenses. | Immediate revocation and lower complexity for staff CMS. | Long-lived JWT in localStorage; in-memory sessions. | Same-site deployment preferred; cookie topology must be tested. | Phase 2, PH10-01 | — |
| ADR-007 | 2026-08-26 | Accepted | Store media through a replaceable provider and immutable keys. | Enables local development and later object-storage migration. | Binary MongoDB storage; absolute URLs; overwrite-in-place. | Media references require integrity checks; local assets are public. | Phase 4, PH05-03, PH09-04 | — |
| ADR-008 | 2026-08-26 | Accepted | Use a static type-safe template registry and normalized view model. | Protects bundling/security and keeps design separate from content. | Dynamic CMS import; universal page builder; product hardcoding. | New designs require code, registry, fixtures, and deployment. | PH01-02, PH06-05, Phase 7 | — |
| ADR-009 | 2026-08-26 | Accepted | Defer templateData until a demonstrated custom-data requirement. | Prevents an unvalidated miscellaneous/page-builder object. | Add arbitrary JSON preemptively. | Initial Standard and TopconPremium use common fields only. | PH05-01, PH05-02, PH06-05, PH07-05 | — |
| ADR-010 | 2026-08-26 | Accepted | Use saved-draft, product/version-bound preview with Next Draft Mode. | Same renderer with narrow authorization and no public draft leakage. | Unsaved live preview; Draft Mode cookie as authorization. | Preview requires Express grant plus Next framework adapter. | PH08-01, PH08-02 | — |
| ADR-011 | 2026-08-26 | Accepted | Begin public rendering no-store, then enable explicit cache/invalidation. | Correctness precedes performance and prevents hidden stale-content bugs. | Implicit caching from first route; always-dynamic forever. | Phase 8 is required before performance acceptance. | PH05-05, Phase 7, Phase 8 | — |
| ADR-012 | 2026-08-26 | Accepted | Keep corporate pages code-owned and enquiry as CTA in version one. | Delivers a complete corporate shell without building unrequested CMS/form systems. | Empty hidden routes; premature generic content/enquiry backend. | Projects/News CMS and submission backend need future tasks. | PH01-03, PH07-02, PH07-03 | — |
| ADR-013 | 2026-08-26 | Accepted | Separate working content from immutable per-locale published snapshots. | Saving edits to a live product/category must not bypass preview/publication. | Single live document fields; full revision-history system; separate publication service. | Additional bounded snapshot storage; public DTOs read snapshots only; CMS derives Changes pending by hash. | PH03-01 through PH03-03, Phase 5, Phase 6, PH10-02 through PH10-04 | ADR-003 publication-state implementation detail |
| ADR-014 | 2026-08-26 | Accepted | Require transaction-capable MongoDB and transient deleting states for reference-sensitive mutations. | Query-then-delete and leaf-category checks otherwise race with concurrent writes. | Accept low-probability races; denormalized counters without transactions. | Local/test MongoDB requires a replica set; filesystem cleanup remains retryable outside DB transactions. | PH01-05, PH01-06, PH03-02, Phase 4, PH05-03, PH10-01 | — |
| ADR-015 | 2026-08-26 | Accepted | Gate product visibility/revision with no-store before reading a cached immutable snapshot. | Unpublish and republish correctness must not depend solely on a fallible purge callback. | Fully cached routes with TTL; no public data caching at all. | One lightweight API check per product request; listings remain no-store in version one. | PH05-05, PH07-01, PH07-06, Phase 8, PH10-04 | Refines ADR-011 |
| ADR-016 | 2026-08-26 | Accepted | Exchange a single-use opaque preview grant for a signed five-minute access credential. | Draft Mode is not authorization and URL credentials must not remain replayable. | Reusable signed URL token; Draft Mode cookie alone; general admin session forwarding. | PreviewGrant TTL infrastructure record and shared internal exchange secret are required. | PH01-05, PH08-01, PH08-02, PH10-02, PH10-04 | Refines ADR-010 |
| ADR-017 | 2026-08-26 | Accepted | Model category images as contextual usages and include Media poster references in integrity checks. | Alt/title belong to context, and poster relationships can otherwise be broken by deletion. | Bare imageMediaId; untracked poster IDs. | Category DTOs carry localized image metadata; media usage lookup includes Media-to-Media references. | PH03-01, PH04-02 through PH04-04, PH05-03 | Refines ADR-007 |
| ADR-018 | 2026-08-26 | Accepted | Split each live Product/Category into one publishedGlobal snapshot plus matching per-locale snapshots; require explicit atomic all-live-locale promotion when shared fields change. | Canonical category, hierarchy, model, specification structure, media identity, and template cannot diverge by language. | Complete independent locale snapshots; silently copy shared changes into one locale; separate publication collection. | More deliberate publish UI and validation; public DTO composition requires globalRevision equality. | PH03-01 through PH03-03, Phase 5, Phase 6, PH08-03, PH10-02 through PH10-04 | Supersedes ADR-013 snapshot shape; retains its working/live separation |
| ADR-019 | 2026-08-26 | Accepted | Require English first and forbid removing English while another locale is live. | The default language and x-default must never resolve to a missing entity. | Dynamically choose/omit x-default; permit Chinese-only live entities. | Editors unpublish additional locales first, unpublish all atomically, or archive. | PH03-02, PH05-02, PH05-03, PH06-05, PH09-01, PH09-03 | Refines ADR-003 |
| ADR-020 | 2026-08-26 | Accepted | Validate the complete active, coherent, locale-published category ancestor chain on every public category/product/list/sitemap read. | Archiving a parent must immediately hide descendants and products without denormalized drift. | Propagated inherited-hidden flag; check only direct category. | At most two category levels keeps the additional predicate bounded; public lists stay no-store in version one. | PH03-02, PH05-05, PH07-02, PH08-03, PH09-03, PH10-02 | Refines ADR-005 and ADR-015 |
| ADR-021 | 2026-08-26 | Accepted | Treat references in working data and every global/locale publication snapshot as deletion blockers. | An old live snapshot may still use media removed from the working copy. | Check working fields only; cascade; rely on cache purge. | Usage reporting and transaction-backed deletion queries span every live/working reference path. | PH04-03, PH05-03, PH10-01, PH10-02 | Refines ADR-007 and ADR-014 |
| ADR-022 | 2026-08-26 | Accepted | Return verified productId, locale, and canonical slug from preview exchange and construct redirects only from that response. | An opaque grant alone gives Next no trusted canonical redirect identity. | Browser-supplied return URL; token-decoding in Next; ID-only public route. | Preview issuance requires a valid unique slug and exchange loads the version-matched Product. | PH08-01, PH08-02, PH10-02, PH10-04 | Refines ADR-016 |
| ADR-023 | 2026-08-26 | Accepted | Treat en and zh as initial enabled locales in one open-ended typed registry that drives route and UI behavior. | Additional languages must be addable without rewriting detection, navigation, layouts, or static parameter generation. | Hardcoded two-language branches; unrestricted runtime dictionaries; duplicating language metadata in every dictionary. | Each new locale adds registry metadata, a statically imported typed dictionary, CMS/SEO/publication coverage, and locale-specific tests; type-checking exposes incomplete additions. | PH01-02, PH01-04, PH03-01 onward, PH09-01 through PH09-03 | Refines ADR-003 |

---

# 20. Progress Log

## 20.1 Progress dashboard

| Metric | Current value |
|---|---|
| Overall status | Phase 1 complete; Phase 2 not started |
| Tasks complete | 6 / 48 |
| Current phase | Phase 2 — Authentication |
| Current task | None |
| Next task | PH02-01 |
| Blockers | None |
| Phase exit status | Phase 1 passed — workspace install, builds, locales, health contract, and test harness verified |

## 20.2 Append-only activity log

Do not edit or delete historical rows. Corrections are new rows.

| Date | Entry/task | Status transition | Summary | Changed files | Verification/results | Blockers | Next task |
|---|---|---|---|---|---|---|---|
| 2026-08-26 | PLAN-001 | Draft → Approved baseline | Created the master architecture, contracts, roadmap, atomic tasks, gates, decision log, and progress tracker. | PROJECT_IMPLEMENTATION_PLAN.md | Structural/document QA completed; no application code created. | None | PH01-01 |
| 2026-08-26 | PH01-01 | Pending → Completed | Established npm monorepo, version policy, root scripts, ignores, environment examples, upload placeholders, and operator documentation. | Root configuration, README.md, workspace manifests | npm install and npm ls --workspaces pass; one lockfile; 0 audit vulnerabilities; secrets/uploads/build output ignored. | None | PH01-02 |
| 2026-08-26 | PH01-02 | Pending → Completed | Added the narrow runtime-safe contracts workspace. | contracts/ | Build/typecheck/lint pass; 1 file / 4 tests pass; dist exports contract modules only. | None | PH01-03 |
| 2026-08-26 | PH01-03 | Pending → Completed | Built the professional responsive public shell and shared UI primitives. | frontend configuration, app shell, components, styles | Frontend build/typecheck/lint pass; all 14 en/zh shells return 200; responsive code review completed. | None | PH01-04 |
| 2026-08-26 | PH01-04 | Pending → Completed | Added English/Chinese dictionaries, validated routes, detection proxy, preference cookie, and locale-safe links. | frontend/src/i18n, proxy, localized routes | 307 detection matrix, locale cookie, /xx 404, excluded paths, HTML lang/dir, localized-link checks, and 2 files / 4 frontend tests pass. | None | PH01-05 |
| 2026-08-26 | PH01-05 | Pending → Completed | Added Express configuration, security middleware, health/errors, replica capability enforcement, and graceful shutdown. | backend/src, backend/.env.example | Backend build/typecheck/lint pass; 5 files / 12 tests pass; unreachable DB exits 1; no local mongod available for machine-local replica smoke. | None | PH01-06 |
| 2026-08-26 | PH01-06 | Pending → Completed | Established isolated workspace test harnesses and safe temporary/database guards. | workspace test configurations and tests | Root npm test passes 8 files / 20 tests; non-test DB guard and temporary cleanup proven. | None | Phase 1 gate |
| 2026-08-26 | PHASE-01 | In progress → Passed | Completed the Foundation phase and left all workspaces buildable and runnable. | All Phase 1 files plus this tracker | Root lint, strict typecheck, test, and production build pass; localized runtime route matrix and health/error integration pass. | None | PH02-01 |
| 2026-08-26 | PH01-04A | Completed → Refined | Removed fixed two-language assumptions while retaining en/zh as the initial enabled locales. | contracts locale registry, frontend i18n/switcher/dictionaries/tests, README, plan | Registry/switcher/regional-detection coverage passes; root lint, strict typecheck, 9 files / 21 tests, and production build pass. | None | PH02-01 |

## 20.3 Implementation activity template

Add one row after every meaningful task transition:

    Date:
    Task ID:
    Status transition:
    Summary:
    Changed files:
    Verification commands and results:
    Blockers:
    Next task:

---

End of authoritative plan.
