# Angular 22 Learning Store: project blueprint and revision guide

**Purpose:** learn, implement, and revise almost every major Angular application-development topic through one coherent project, using Angular Material and dummy APIs.

**Document version:** 1.15 — 2026-09-29. **Current status:** P12 authorized zoneless milestone is implemented and verified within the recorded limits. See the [P12 final evidence](#p12-beforeafter-evidence-and-final-verification) for supplied completed main-pass gates after final copy fixes. Application scheduling is explicitly zoneless; the root deliberately remains Eager and Zone.js is test-only. P00–P11 implementation/verification metrics and then-next claims remain historical, including P11's completed gates within their recorded limits. **Next: P13 SSR/hydration, then P14 settings/ecosystem**, each separately scoped, not automatically started. **M08 settings remains a placeholder**: toolbar theme is session-only; saved preferences, locale preview and global mock reset UI remain settings/P14 work. Advanced resources/forms, `transformedValue`, async DI awareness and optional refresh remain deferred. No automatic installs, CI, Prettier or full-curriculum completion are implied.

**Baseline:** Angular 22.1.7, CLI 22.1.8, TypeScript 6.0.3, RxJS 7.8.x, project-local Node.js 22.23.2, Angular Material/CDK 22.1.8 (compatible peers verified). [AGENT.md](AGENT.md) remains the canonical engineering standard.

This is a broad learning curriculum and an actionable project specification, not a claim to enumerate every Angular API or every patch-release change. Core topics must be implemented; advanced topics are separate learning tracks; legacy topics are for understanding existing applications. Experimental features are awareness-only unless explicitly approved.

## Contents

**Start here:** [Module-wise build guide](#module-wise-build-guide) is the primary implementation checklist. For current delivery, use the [P12 implementation and source/test map](#p12--zoneless-migration--2026-09-29) and [final verification and before/after evidence](#p12-beforeafter-evidence-and-final-verification). The [P11](#p11-source-reading-matrix), [P10](#p10-source-reading-matrix) and [P09](#p09-source-reading-matrix) matrices retain historical coverage; the numbered sections below are the detailed reference curriculum.

1. [Learning method and scope](#1-learning-method-and-scope)
2. [Angular 22 version facts](#2-angular-22-version-facts)
3. [Application concept and screens](#3-application-concept-and-screens)
4. [Architecture and state ownership](#4-architecture-and-state-ownership)
5. [Angular Material and CDK design](#5-angular-material-and-cdk-design)
6. [Dummy API specification](#6-dummy-api-specification)
7. [HTTP and asynchronous data flows](#7-http-and-asynchronous-data-flows)
8. [Feature study catalogue](#8-feature-study-catalogue)
9. [Forms curriculum](#9-forms-curriculum)
10. [Routing curriculum](#10-routing-curriculum)
11. [RxJS operator laboratory](#11-rxjs-operator-laboratory)
12. [Performance and rendering](#12-performance-and-rendering)
13. [Advanced ecosystem tracks](#13-advanced-ecosystem-tracks)
14. [Security accessibility and internationalization](#14-security-accessibility-and-internationalization)
15. [Testing strategy](#15-testing-strategy)
16. [Implementation roadmap](#16-implementation-roadmap)
17. [Acceptance scenarios](#17-acceptance-scenarios)
18. [Revision questions and answer cues](#18-revision-questions-and-answer-cues)
19. [Completion checklist and workflow](#19-completion-checklist-and-workflow)
20. [Sources and verification notes](#20-sources-and-verification-notes)

## Module-wise build guide

Here, **module means a standalone feature area**, not an Angular `NgModule`. Each feature owns its route file, pages, domain logic and colocated tests. Top-level routing lazily loads these boundaries. Do not create empty services or components merely to fill the proposed structure.

### Build order and responsibilities

Use this table to choose the next deliverable; use P00–P15 in [section 16](#16-implementation-roadmap) for the finer-grained checkpoints. Module IDs describe ownership; phase IDs describe sequencing. In particular, M02 catalogue precedes M03 cart, while M02 editing follows M03.

| Module / current status | Responsibility and folders under `src/app/` | Routes | Prerequisites / phase | API and revision references | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| **M00 — Foundation: implemented; P08 widgets verified** | `layout/`, `core/theme/`, `features/dashboard/`, root providers/routes, `src/theme.scss` | `/dashboard`, error recovery; lazy feature routes | P00 → P01; widgets P08 | No HTTP before Load widgets; public users/tasks/user-1 posts after Load. [Material](#5-angular-material-and-cdk-design), F01/F07, R01/R02/R08/R11 | Shell/theme evidence retained; independent/combineLatest/forkJoin widgets delivered and verified within the P08 scope |
| **M01 — Data platform: task extension implemented and verified** | `core/http/`, `core/config/`, `core/mock/`, `testing/`; feature-specific DTO parsers stay with their domain | No independent production screen | M00 / P02, checkout P06, session P07, reads/tasks P08 | [Dummy API contract](#6-dummy-api-specification), [HTTP flows](#7-http-and-asynchronous-data-flows), F02–F05/F08, D02 | Existing P02–P07 evidence retained; M06 parsers/mocks verified in its 843-test suite; task CRUD/parser/mock specs included in M07's final 1176-test suite |
| **M02 — Products: implemented** | `features/products/`: catalogue, detail, editor, data access and query parsing | `/products`, `/products/new`, `/products/:id/edit`, `/products/:id` | M01 / P03 and M03 / P05 done | `/products` family; [forms](#9-forms-curriculum), F03–F05, C01–C06/C16, R03/R05/R07 | Shareable search/sort/page, cancellable reads, validated Signal Forms, dirty guard, mock CRUD and explicit remote-write notice |
| **M03 — Cart: implemented** | `features/cart/`: root session cart owner, quantity control and totals | `/cart` | M02 catalogue / P04 done | No API for owned cart; [state ownership](#43-ownership-rules), C05–C08, D01, S01/S02/S07 | Immutable updates; computed integer-cent totals; quantity boundaries; no second writable total |
| **M04 — Checkout: implemented** | `features/checkout/`: typed form, stepper, fake receipt | `/checkout` | M03 plus P05 / P06 done | `POST /carts/add`; [Reactive Forms](#94-typed-reactive-forms-checklist) | Invalid/pending/duplicate submits blocked; failed submit retains cart/draft; CVA, dirty guard and receipt validation tested; no payment fields |
| **M05 — Demo session: implemented** | `features/session/` Signal Forms presentation and `core/session/` lifetime/parsers/guards | `/login`, guarded checkout/editor routes, `/forbidden` | M01 + M04 / P07 done | `/auth/login`, `/auth/me`; refresh explicitly deferred; [security](#141-demo-authentication-rules), R04 | Private in-memory token, minimal verified identity, exact-endpoint headers, safe explicit Continue, logout/expiry/cancellation tests; local roles are UX only |
| **M06 — Users & posts: read slice and P08 widgets verified** | `features/users/`, `features/posts/`, shared read-state/avatar UI; public services reused by dashboard widgets | `/users`, `/users/:id`, `/posts/:id`; no profile tab routes | M02 + M05 / P08 | Public users/posts/comments GETs; [implementation record](#m06--first-p08-slice-implementation-record--2026-09-27), [RxJS](#11-rxjs-operator-laboratory) | Historical read-slice suite/builds/browser checks retained; subsequent widgets have separate scoped P08 verification evidence |
| **M07 — Tasks: P08 and P10 ordering verified within limits** | `features/tasks/`: public data, Signal Forms draft, component-owned queue and local board | `/tasks`; profile links with `userId`, not tabs | M06 / P08; P10 same-column pointer drag plus native moves | `/todos` family; [P08 record](#m07--p08-tasks-implementation-record--2026-09-27), [P10 record](#p10--material-and-cdk--2026-09-28) | Actual mouse drag, Enter move and Space completion observed; no-HTTP ordering, snapshot rejection and unchanged cap-10 PATCH queue/row rollback are unit-tested. [P10 evidence and limits](#p10-verification--main-pass) |
| **M08 — Settings: placeholder, explicitly deferred** | `features/settings/`; reuse `core/theme/`, do not duplicate theme state | `/settings` | Original P09/P14 mapping; settings work deferred to settings/P14 | No remote settings endpoint; [locale](#144-locale-date-and-money-decisions), D02/S04 | Toolbar theme remains session-only; saved preferences, locale preview and global mock reset UI are not P09 deliverables |
| **M09 — Labs: P12 implemented and verified within limits** | `features/labs/`: prior labs plus `zoneless/` | Existing entries plus lazy `/labs/zoneless`, linked from index/dashboard | P04 → P08 → P09 → P10 → P11 → P12 | [P12 source/test map](#p12-source-and-test-map); historical [P09](#p09-source-reading-matrix), [P10](#p10-source-reading-matrix), [P11](#p11-source-reading-matrix) | Native one-shot callback, signal versus plain snapshot/markForCheck, cancellation/reset/destruction; 16 explicit-zoneless lab cases and forms/state regressions. [Final gates passed](#p12-beforeafter-evidence-and-final-verification); advanced lessons remain open |
| **M10 — P12 runtime migration implemented and verified within limits** | `app.config.ts`, build/test configuration, root, `tools/quality/` and `e2e/`; P11 quality/performance retained | Existing app routes and `/labs/zoneless` | P11 complete within historical limits; P12 complete within limits; next P13 then P14 | [P12 record](#p12--zoneless-migration--2026-09-29), [performance](#12-performance-and-rendering), [testing](#15-testing-strategy) | Explicit zoneless provider, empty build polyfills, Eager root retained; test-only Zone, browser no-Zone guard and artifact exclusion. Final 1799-unit/70-helper/49-browser suites, lint/types, builds/audit and both production profiles passed. Size warning/five dev-chain findings remain; no fresh security audit claim |

### Module delivery checklist

- [x] M00: establish local-tooling baseline and build/test evidence (P00).
- [x] M00: Material shell/theme, overview and lazy feature previews (P01).
- [x] M01: product data contracts, HTTP configuration and seeded development mocks (P02); other domains follow their owning modules.
- [x] M02: catalogue/list/detail first (P03).
- [x] M03: cart plus component/state lessons (P04).
- [x] M02: add Signal Forms editing and safe simulated CRUD (P05).
- [x] M04: typed checkout and fake receipt (P06).
- [x] M05: demo session and navigation guards (P07); final post-edit verification passed, refresh deferred.
- [x] M06: first P08 public-read slice implemented — users table, profile/posts, post/comments/dependent author, section retries and strict minimal projections.
- [x] M06: post-edit verification signed off for the delivered read slice; final results and limitations below.
- [x] M07 / P08: task CRUD, URL public-assignment paging/filter, bounded queue and native local board moves implemented.
- [x] M07: final verification signed off within the [recorded limits](#m07-verification--final).
- [x] Remaining P08 implementation: user-loaded dashboard widgets and nine actual RxJS operator/timeline recipes delivered.
- [x] P08 scoped completion signed off with supplied test/build/artifact and focused browser evidence; see the [verification limits](#p08-verification--final).
- [x] M09 / P09 core: eight lazy entries deliver framework, resource and independent forms comparisons; [coverage and advanced limits](#p09-source-reading-matrix) recorded.
- [x] P09 core final verification: post-edit application runs and focused mock browser checks passed on 2026-09-28 within the [recorded limits](#p09-verification--final).
- [ ] M08: settings/P14 explicitly deferred; toolbar theme is session-only, with no persistence or global mock reset UI.
- [x] M09 / P10 implementation: three lazy Material/date-time/CDK routes with local owners, controls and cleanup; [source matrix](#p10-source-reading-matrix).
- [x] M07 / P10 implementation: typed same-column CDK pointer ordering and snapshot validation alongside native Move up/down; no HTTP order, unchanged completion queue.
- [x] P10 verification and closeout: final post-newline-fix tests/builds/artifacts, focused sequential browser checks, 66-file hygiene, 108 local links/anchors and `git diff --check` passed within [recorded limits](#p10-verification--main-pass); port-4212 shutdown succeeded with no listener confirmed.
- [x] M09/M10 / P11 full implementation: animation, profiling and fill-image lessons alongside selected quality tools, selective preloading/defer, local measurements and expanded browser coverage.
- [x] P11 full follow-up supplied runs: 1777 unit / 36 browser tests, production build and two fresh profiles passed within [recorded limits](#p11-full-follow-up--2026-09-28); v1.13 baseline checks remain historical.
- [x] P11 final main-pass gates: 66-helper suite, lint/strict E2E types, bundle audit, security audit disposition and supplied final-source hygiene checks recorded in the [full follow-up](#p11-full-follow-up--2026-09-28); documentation checks predate this edit. Advanced tracks remain separate.
- [x] M09/M10 / P12 implementation: explicit zoneless runtime, Eager root retained, test-only Zone, lazy native-callback lab and notification/FormsReactiveLab regressions; [source/test map](#p12-source-and-test-map).
- [x] P12 earlier focused checks: 63 unit, 70 helper and 8 new browser tests (two axe scans, zero violations), lint and strict E2E types passed; final full gates below supersede the focused-only boundary.
- [x] P12 final application verification: 1799 unit, 70 helper, 49 browser tests (12 axe scans, zero violations), lint/types, production/mock builds, bundle audit and both production profiles passed after final copy fixes; [limits and pre-document hygiene](#p12-beforeafter-evidence-and-final-verification) recorded.
- [ ] Next: P13 SSR/hydration, then P14 settings/ecosystem; neither starts automatically.

For each module: read its linked lessons → define a small acceptance slice → implement its page/service/contracts → test success and failure → run build/headless tests → update this checklist. Keep the app runnable between slices. The more detailed requirements below remain authoritative; this table does not remove any revision topic.

**Historical records below (P00–P11):** preserve their original metrics, verification limits, dashboard/API descriptions and “Next”/“remaining” claims as statements at that milestone, not current status. The M00–P10 block and P11 records retain their original text; added historical labels distinguish their runtime-Zone/deferred-P12 claims from current delivery. The P12 record follows historical P11, before section 1.

### M00 implementation record — 2026-09-24

- Material/CDK 22.1.8 installed through the project-local CLI schematic. Replaced generated theme with `src/theme.scss`; removed external font/icon requests. No global installations, APIs, secrets or `.env` required.
- `layout/shell.component.*` provides responsive sidenav/toolbar, named navigation, skip link, route-heading focus, and a native labelled theme selector. Theme preference is session-only and resets to system on reload; root tokens reach future overlays.
- `features/dashboard/` is a learning overview, **not** a live-data dashboard. `core/learning/learning-modules.ts` supplies shared, typed navigation/preview metadata. Feature route files currently reuse `shared/ui/planned-module/` rather than duplicating dummy components; replace each preview within its owning module later.
- Root Eager/Zone.js behavior, strict settings, Jasmine/Karma and bundle budgets remain unchanged. No HTTP providers, auth guards, SSR, zoneless migration or state library were added.
- P00 production build and original 3 tests passed. P01 production build and 40 ChromeHeadless tests passed (router, Material harnesses, responsive navigation, focus, theme and cleanup). Initial production bundle: approximately 435 kB, below the unchanged 500 kB warning budget. `git diff --check` passed.
- Browser smoke checks exercised the desktop overview and light selection, plus 390 px mobile keyboard navigation, route-heading focus, Escape restoration, dark/system selection and no horizontal overflow on the product preview. This is not a full accessibility certification: no axe, E2E runner or screen-reader audit is configured. Wider responsive/system-color coverage remains a quality-phase check.
- Known tooling limitations: legacy Karma/dev-server builder deprecation warnings. The editor retains two apparently stale Angular diagnostics on root `ShellComponent`/`app-shell` discovery despite successful AOT builds and tests. If visible, run **Angular: Restart Angular Language server** from the command palette; do not suppress template checking or add schemas to hide them.

### M01 implementation record — 2026-09-24

**Scope:** P02 establishes the reusable data boundary with products. User/post/task/cart/session contracts and mocks are deliberately deferred to their owning modules, not represented by unused empty models. M02 catalogue/detail UI is next; no overview or preview page sends API requests.

Read the implementation in this order:

1. `features/products/data/product.models.ts`: readonly DTO/domain/draft boundaries, mutually exclusive query filters, and distinct write results. `ProductMutation<T>` reports `simulated` remote writes versus `session` mock persistence. A POST echo is not a full product detail.
2. `product.parsers.ts`: validate `unknown`, project only rendered fields, discard category URLs and unrelated review fields, and reject unsafe image schemes, invalid numbers, duplicate IDs and inconsistent pages. HTTPS and safe root-relative image paths are accepted. Drafts/patches allowlist editable fields; empty patches are invalid.
3. `product-query.ts` and `products-api.service.ts`: validated IDs/slugs, immutable `HttpParams`, cold subscriptions, GET/POST/PATCH/DELETE, response-ID checks and one error channel. `core/http/api-error.ts` supplies safe messages and Retry-After metadata. There is no automatic retry, cache or implicit navigation after a write.
4. `core/config/app-data.providers.ts`: default remote provider. `npm.cmd start` uses it. `npm.cmd run start:mock` selects `app-data.providers.mock.ts` via `angular.json` file replacement; stop/restart to change modes. Both use the same service API. No dependencies, global-tool changes, API key or `.env` were needed in P02.
5. `core/mock/`: functional interception, 30 deterministic records, three categories, local image and isolated session CRUD. Requests outside the exact API origin/base-path boundary pass through; unsupported API endpoints/verbs normally return 501, never silently call DummyJSON. Only the product subset is implemented; the mock is not a complete DummyJSON clone.
6. Colocated specs: ordinary HTTP service tests use the testing backend without the mock; mock tests install the interceptor plus a test-backend fail-safe. Read parser fixtures, create → get → patch → delete → 404, reset, timing and cancellation cases as the executable P02 lesson.

**Scenario controls (code/tests now, UI in later labs):** inject the explicitly mock-provided `MockProductBackend` only in a mock/test entry. `setScenario({ outcome, delayMs })` sets a default; `enqueue(...)` overrides the next subscribed API request; `reset()` restores seeds/IDs and clears defaults/queue. Outcomes: `success`, `empty`, `malformed`, `network`, 400/422/401/403/404/409/429/500/503. Delay is an integer from 0 to 10,000 ms and applies to errors too. Different queued delays reproduce out-of-order reads. Empty applies to list/category collections, not writes; malformed and error scenarios do not commit mutations.

**Lifetime:** state is local to the running app injector, never persisted to storage. Mock writes commit at response time, so unsubscribe before a delayed response prevents a mock commit. Reset invalidates already-pending operations: they fail with 409 at their scheduled response time instead of changing the reset database. Real HTTP cancellation does **not** promise server rollback. Consumers own subscriptions; no backend-owned standing subscriptions or timers are started at bootstrap.

**Validation:** production and mock-configuration builds passed, as did the full ChromeHeadless suite covering the existing foundation and new parser/HTTP/mock behavior. Production initial output is approximately 455 kB, within the unchanged 500 kB warning budget. Production stats and emitted JavaScript were inspected: mock implementation, seed data and tests are excluded. The public SVG illustration remains an ordinary asset. The mock configuration is development-only and must not be deployed. No live mutation/auth calls or new accessibility/E2E audit were performed; existing builder/editor limitations from M00 still apply.

**Next:** M02 / P03 wires these contracts into the Material catalogue/detail screens, including router query parsing, debouncing, request state and retry UI. Scenario panels, request timelines, auth/session behaviors and other domains are still later milestones.

### M02 / P03 implementation record — 2026-09-24

**Delivered:** `/products` and `/products/:id` are real lazy-loaded Material screens using the P02 service in remote or mock mode. `/products/new` and `/products/:id/edit` remain P05 previews; there are no working cart, checkout or editing controls yet.

- `data/product-url.ts` owns URL parsing/canonicalization: `q`, `category`, one-based `page`, `pageSize` (12/24/48), `sort` (title/price/rating), `order` (asc/desc). Defaults are omitted, duplicate/invalid parameters fall back safely, unknown parameters are dropped, and unsafe paging arithmetic is rejected. Search trims to 200 characters and takes precedence over category in an ambiguous URL. Invalid detail IDs never reach HTTP.
- `catalogue/product-catalogue.component.*` separates the local search draft from router-owned committed state. Typing debounces 300 ms; filter/sort/page-size changes reset paging. Category and search are alternatives. Canonicalization uses replace navigation; user changes retain browser history. Detail links and the back link retain validated query parameters.
- One `toSignal` request boundary per result stream consumes `switchMap` with inner error recovery. Categories load independently and can fail/retry without hiding successful products. New queries cancel old reads; leaving cancels requests and pending typing. Clear cancels an uncommitted draft even when the URL is already unfiltered. No cache, automatic retry, nested subscription or writable copy of a result total was added.
- `data/product-load-state.ts` models loading/success/error; empty is a successful empty page. Templates use `@let`/exhaustive `@switch` and stable product IDs. No client-side filtering/sorting/paging of server subsets. Out-of-range pages remain explicit and offer first-page recovery instead of looping through redirects.
- `detail/product-detail.component.*` validates path IDs, replaces reads on reused-route ID changes, renders gallery/description/stock/rating/reviews, handles missing images/reviews, and distinguishes invalid/not-found/forbidden/network/format failures. Reviews have no transport IDs; immutable response-object identity is used for this read-only list. Demo currency is explicitly USD and review dates render in UTC.
- Shared feature UI uses `NgOptimizedImage`, a single priority image per view, and named broken-image fallbacks. Material controls have labels, result/loading announcements and busy state; errors offer deliberate retry where appropriate. Shell heading focus is retained for page changes, but query-only navigation no longer steals search focus. Root Eager/Zone, strictness, providers and global tools are unchanged.

**Revision path:** URL tests → catalogue request stream → Material controls/template → HTTP-backed component tests → detail cancellation/error tests. Predict what happens when typing A then B, choosing a category before debounce finishes, clearing without a URL change, or navigating away while a read is pending. Inspect the mock in-browser results; it does not generate real API network requests. Scenario panels and operator timelines remain later labs.

**Quality notes:** colocated tests cover canonical URLs, controls, zero/empty values, independent failures/retry, cancellation, search restoration/teardown and image fallbacks; route and shell tests now isolate the backend. Compilation succeeds, but adding the Material read screens raises the initial bundle to approximately **560 kB**, above the unchanged 500 kB warning budget and below the 1 MB error limit. Build statistics identify shared Angular Forms/Common and Material code in the initial bundle despite lazy product views. This performance regression remains open rather than being hidden by larger budgets or unrelated shell changes. Legacy builder warnings and the existing stale root editor diagnostics remain; no axe/E2E/screen-reader audit is implied.

**Final verification — 2026-09-27:** all **195 ChromeHeadless tests passed**; production and mock builds succeeded. Production initial output is **559.73 kB** (the warning above remains). Production stats exclude mock implementation, seeds and tests. Local documentation links/anchors and `git diff --check` passed. Mock browser smoke checks exercised search with retained focus, category/sort/direction, page two, detail/back query restoration, reload and browser history, empty results, invalid/missing IDs and mobile menu/heading focus. Catalogue and detail had no horizontal overflow at 390 px. The search/detail journey logged no console errors or live DummyJSON requests. Browser testing caught a reordered-image priority error: separate static-priority template branches now recreate `NgOptimizedImage` when priority changes, covered by a regression test. These focused checks are not a full accessibility audit or a committed E2E suite.

**Next:** M03 / P04 — session cart and component/state lessons. M02 is not fully complete until P05 editing is implemented.

### M03 / P04 implementation record — 2026-09-27

**Delivered:** `/cart`, reusable catalogue cards with add intent, detail add actions, live header count, `/labs` index and `/labs/component-state`. Editing remains P05; checkout remains P06. No new dependencies, HTTP endpoints, global tooling, storage, secrets or `.env` are needed.

**Read in order:**

1. `features/cart/data/cart.service.ts`: `@Service()` root owner with one private writable signal, readonly snapshots, immutable updates and computed item count/subtotal/lookups. `CartLine` snapshots product ID/title/image, unit price in cents, stock and quantity. Semantic `add`/`setQuantity` return explicit success/failure; remove/clear are idempotent. Domain tests reject invalid IDs, prices, stocks and quantities; old snapshots stay unchanged.
2. `features/products/ui/product-card.component.*`: required `input()` for product, optional presentation/query inputs and `output()` for add intent. Parents own the cart interaction and status message. `StockLevelDirective` demonstrates host metadata with readable stock text rather than color-only meaning. Detail reuses the same root cart, not a second state owner.
3. `features/cart/ui/quantity-control.component.ts`: real `model()` contract, bounded increment/decrement and numeric entry. Invalid/empty/fractional/out-of-range input keeps the prior committed quantity and announces the error. Cart uses `[quantity]` plus `(quantityChange)` to dispatch intent through its service; the lab demonstrates `[(quantity)]` against an owned local signal. A model input is not permission to mutate a readonly cart line.
4. `cart.component.*` and `ui/usd-cents.pipe.ts`: stable ID tracking, computed summary and pure display formatting. Remove/clear restore heading focus; cancelling clear restores the original Material button using a signal query with explicit `ElementRef` read. The header uses an accessible text count rather than adding a separate badge dependency. Checkout is explanatory text, not a dead submit button.
5. `features/labs/component-state/`: selected/default content projection and fallbacks; two siblings share one component-provided `LabCounter`, while an independent experiment receives another. Hide/show probes demonstrates `OnInit`/`OnDestroy` cleanup; destroying the experiment resets its provider state. A later sibling observation view reads lifecycle signals after hooks, avoiding synchronous writes into an already-checked parent binding. The lifecycle log is bounded to 12 entries; there are no timers or ongoing subscriptions. Tests assert instance isolation, registration cleanup, projection and model resets.

**Money and inventory contract:** round each first-added USD unit price once to the nearest cent, then multiply/sum integer cents. Limit unit prices to USD 1,000,000, distinct lines to 100, and each quantity to `min(snapshot stock, 99)`; these limits keep all totals safe integers. Zero-priced in-stock products are allowed. No discounts, taxes or shipping are calculated. First-add price/stock/title remain until remove/re-add; product screens can additionally prevent adding a currently out-of-stock product. This is not an inventory reservation, server validation or production checkout contract.

**Lifetime and failure:** navigating between routes preserves the root cart; reload or a fresh app injector clears it. The isolated lab cannot change it. Mock backend reset affects only mock data, not cart snapshots; reload resets both. No HTTP request or local/session-storage write occurs for cart operations. Overflow, invalid quantity and missing-line failures leave state unchanged. Authentication/local identity is not required for this anonymous session exercise; no authorization is implied.

**Verification:** 243 ChromeHeadless tests passed across the app, including domain boundaries, rounding, model input/output, pure pipe, card intents, cart routes, shell count, projection, DI scope and lifecycle cleanup. Production and mock builds succeeded; production initial output is **564.96 kB** (500 kB warning/1 MB error budgets unchanged). Production stats/emitted JavaScript exclude mock implementation, seeds and tests. All 45 local documentation links/anchors, P04 file whitespace and `git diff --check` passed. The existing P03 size warning remains open; no budgets or compiler checks were weakened. Browser mock checks verified keyboard add/quantity/remove/cancel-focus, route persistence, reload clearing, 390 px cart/lab reflow, independent counters and teardown/recreation with no console errors. No full axe, screen-reader or committed E2E suite exists; legacy builder and stale editor-discovery diagnostics on root/lab imports remain limitations. A language-server restart is recommended, not schema or compiler suppression.

**Revision prompts:** Why does the cart survive a route change but an experiment counter does not? Why bind cart quantity one-way plus an event while the lab binds a local signal two-way? Why round before multiplying? What happens if you mutate a previously returned snapshot, hide both probes, or reset only the mock database?

**Next:** M02 / P05 — verify Material Signal Forms integration, then implement product editing and simulated CRUD with dirty-navigation protection.

### M02 / P05 implementation record — 2026-09-27

**Delivered:** shared lazy `/products/new` and `/products/:id/edit` Signal Forms editor, catalogue create/detail edit links, schema validation, minimal PATCH updates, save/delete result panels, reset/delete confirmations and functional dirty-navigation protection. Earlier P03/P04 records above describe their historical scope. No new dependencies, global-tool changes, credentials, `.env`, authentication or checkout implementation were added.

**Read in order:**

1. `features/products/editor/product-editor.schema.ts`: a private model-backed form uses a reusable `schema`, required/length/range/pattern rules and pure custom validators. Numeric fields model empty values as `number | null`; zero stock remains valid. `editorModel` projects editable fields and `productChanges` allowlists only differences. Explicit learning-app limits are title 120 characters, description 2,000, USD price 0.01–1,000,000 with at most two decimals, and integer stock 0–1,000,000. These are client exercise rules, not promised remote-server constraints.
2. `product-editor.component.ts`: edit ID comes from the path, create mode from route configuration, never query input. Cancellable `switchMap` reads reset the draft only for a different ID or deliberate load retry. Categories load/retry independently without replacing user input. Saving requires loaded category choices; a previously loaded category missing from the choices may be retained. An empty choice list prevents new creation, not editing a valid existing category.
3. `productForm.title` is the field binding; `productForm.title()` is its state. `[formField]` binds directly to Material native inputs/textarea and Material select's supported CVA interoperability. There is no second `FormControl`, compatibility form, custom adapter or new package. Material harnesses verify values, touched errors, reset, disabled controls and select behavior. The model remains the single writable draft; the baseline snapshot exists only for reset/change comparison.
4. Manual `submit(form, { ignoreValidators: 'none', action, onInvalid })` marks touched and gates invalid/pending forms. **Review field errors** focuses the first invalid bound control while Save is disabled. The action uses one `firstValueFrom` boundary with a 15-second response timeout and component-owned destruction teardown. Duplicate writes are blocked; edits send only changed PATCH fields and no-op edits send nothing. Expected service failures reject into an explicitly handled promise boundary and inline `ApiError`, rather than leaving a sticky submission field error that requires changing valid data before retry. Drafts remain intact; writes never auto-retry.
5. Successful responses reset dirty/touched state to the validated write echo. Create success disables that draft until **Create another product**, whose focus is restored after rendering. Remote results are explicitly simulated; no link assumes a created remote ID is fetchable. Mock results link to session detail/edit routes. Delete requires consent, preserves a dirty draft on failure, and leaves an explicit deletion result rather than silently navigating. A later edit does not rewrite the earlier response panel or claim it is saved.
6. `product-editor.guard.ts` delegates to the editor's leave policy. Dirty leave and reused edit-ID changes prompt stay/discard; query-only changes preserve the draft. Active writes or another confirmation block departure. Material Dialog focuses cancel, traps focus, accepts Escape/backdrop as cancellation and restores the initiating control. Dialog cleanup has its own destruction-bound subscription, so a superseding navigation cannot strand the editor in a confirming state after unsubscribing the guard. `beforeunload` warnings are best-effort browser behavior, not guaranteed recovery or persistence.

**Persistence boundaries:** mock create → detail → edit → delete → 404 works until reset/reload; remote writes only return simulated results. Cart title/price/stock remain first-add snapshots even after product edits/deletion. No cache is silently rewritten. Cancellation, a timeout or an invalid response does not prove server rollback; verify before retrying a potentially committed write. The visible local demo-admin identity is explanatory UX, not an authentication/authorization mechanism; P07 owns that lesson.

**Verification:** 288 ChromeHeadless tests passed; production and mock builds succeeded. New coverage includes validation limits, real Material integration, allowlisted POST/minimal PATCH/no-op updates, duplicate saves, active-write navigation, unchanged-data retry, malformed responses, delete failures, category independence, invalid IDs/load errors, reused routes, superseded guards, focus and destruction cancellation. Production initial output is **573.14 kB**, above the unchanged 500 kB warning budget and below the 1 MB error limit. The initial-size issue remains open. All 397 production inputs and 25 emitted scripts passed mock/test exclusion checks; 47 local documentation links, 17 P05 files' whitespace checks and `git diff --check` passed.

**Browser checks:** mock create/read/update/delete and subsequent 404, initial error review, keyboard select/Escape, cancel-default/focus restoration, dirty stay/discard, cart snapshot preservation and reload clearing. A 390 px editor/deletion check had no horizontal overflow. The monitored final journey had no browser errors or live DummyJSON requests. No live mutation/auth calls, axe audit, screen-reader certification or committed E2E runner are implied. Legacy builder warnings and existing root/lab editor-discovery diagnostics remain despite successful builds/tests; restart the Angular language server rather than suppress checks.

**Revision prompts:** Why pass a field tree rather than its value to `FormField`? Why is empty stock different from zero? Why does `ignoreValidators: 'none'` matter? Why preserve a valid draft after a 503? Why can cancelling a guard subscription differ from closing its dialog? Why does a successful remote response not justify a new detail link?

**Next:** M04 / P06 — typed Reactive Forms checkout and a fake receipt. Async validation endpoints, custom Signal Forms controls, checkbox/date integration, nested/dynamic schemas and form-system comparisons remain later labs; P05 does not claim those are complete.

### M04 / P06 implementation record — 2026-09-27

**Delivered:** lazy `/checkout`, cart entry link, vertical Material stepper, typed nested Reactive Forms, dynamic notes, delivery CVA, dirty/reset confirmations and a validated simulated receipt. This intentionally contrasts P05 Signal Forms without attaching both systems to one control. No dependencies, global tooling, real payment, storage, credentials or `.env` were added. Earlier implementation records describe their historical scope.

**Read in order:**

1. `features/checkout/checkout-form.ts`: inferred typed `FormGroup` tree for address, delivery and review, non-nullable text/boolean controls, nullable delivery selection, and `FormArray<FormControl<string>>` notes. Non-blank recipient/city are limited to 80 characters, street to 120, postal code to five digits; up to three added notes must each contain non-blank text of at most 120 characters. These are fictional practice rules, not international address validation. The sample button avoids needing personal information.
2. `ui/delivery-choice.component.ts`: `NG_VALUE_ACCESSOR` registers a `ControlValueAccessor` around Material radio buttons. `writeValue` never echoes `onChange`; user choices report changes, blur reports touched and `setDisabledState` controls interaction. Signals are local visual-control state, not a competing checkout draft. Compare this with P04's component `model()` and P05's Signal Forms field binding.
3. `checkout.component.*`: the control tree owns the only writable draft. One `valueChanges` view projects `getRawValue()` for review; one `statusChanges` view notifies the template. Linear steps validate their groups, touch errors and focus invalid controls. Submission rechecks the entire form and cart; invalid, pending, empty and duplicate submits cannot reach HTTP. Reset clears dynamic notes and uses `FormGroupDirective.resetForm()` so the directive's submitted flag resets alongside control values/dirty/touched state.
4. `data/checkout.models.ts`, `checkout.parsers.ts` and `checkout-api.service.ts`: POST only `{ userId, products: [{ id, quantity }] }`, with fixed visible demo user **1** until P07. Query parameters cannot supply identity. Runtime parsing matches distinct product IDs and quantities regardless of response order, validates counts, line/subtotal arithmetic and aggregate discounted total, and maps USD to integer cents. Unknown/private transport fields are dropped. Missing or inconsistent receipts fail safely; a successful HTTP status alone never clears the cart.
5. The explicit synchronous busy gate and one finite side-effect subscription ignore duplicate writes. `takeUntilDestroyed`, a 15-second response timeout and `finalize` handle cancellation/reenabling; there is no automatic retry. Failures retain form and cart and show a safe error with deliberate retry. Cancellation, timeout or format failure does not prove server rollback. Dirty leave/reset asks for confirmation; active submissions block route departure. Dialog cleanup is independent of the guard subscription. Browser unload prompts are best-effort, not draft persistence.
6. `CartService.clearSubmitted` compares the exact immutable submitted snapshot before clearing; intervening cart changes are preserved. Receipts show submitted snapshot, service subtotal and service discounted total separately, explaining price differences rather than inventing fees. Fictional address, delivery and notes are never posted, stored or logged and are cleared on success. Leaving/reloading loses the receipt; neither mode claims a persisted order or offers a retrieval link.
7. `core/mock/mock-product-backend.service.ts` now also handles `POST /carts/add`: validate demo user 1, resolve current product prices, reject missing products (404) or insufficient current stock (409), and return sequential local receipt IDs. Stock is neither deducted nor reserved; orders are not stored. Reset restores the receipt counter; existing delay, failure, cancellation and reset-generation rules apply. Unsupported cart reads still fail explicitly. Product CRUD and cart snapshots remain separate owners.

**Verification:** 344 ChromeHeadless tests passed; production and mock builds succeeded. Coverage includes typed validation/reset/disabled values, Material stepper and CVA behavior, pending/duplicate gates, payload privacy, malformed/reordered receipts, error retry, current mock price/stock, delayed cancellation/reset, dirty dialogs, receipt focus and protection of newer cart changes. Production initial output is **585.96 kB**, above the unchanged 500 kB warning budget and below the 1 MB error limit. The existing bundle-size regression remains open; no budgets or strict checks were weakened. All 413 production inputs and 30 emitted scripts passed mock/test exclusion checks; 48 local documentation links, 26 P06-related files' whitespace checks and `git diff --check` passed.

**Browser checks:** mock browse → add two → cart → checkout → receipt, invalid-field focus, keyboard radio/acknowledgement/submission, cancel-default/Escape/focus restoration and 390 px reflow. Receipt heading receives focus, the header cart count clears and local address data is absent from the receipt. Reset removes field errors; discard preserves the cart; reloading a receipt returns empty checkout. Light/default and dark receipt presentation were inspected. The monitored journeys produced no browser errors or live DummyJSON requests. No live mutation/auth calls, axe audit, screen-reader certification or committed E2E suite are implied. Existing builder deprecations and stale root/lab editor-discovery diagnostics remain despite passing builds/tests.

**Revision prompts:** Why can `.value` omit disabled controls while `getRawValue()` includes them? Why must a CVA not echo programmatic writes? Why does `form.reset()` alone not reset directive submission metadata? Why must receipt IDs/quantities be validated before clearing? Why keep a newer cart even after a successful receipt? Why does a mock receipt not mean inventory was reserved?

**Next:** M05 / P07 — demo session and navigation guards, then map checkout identity to that session. FormRecord/builders, async/cross-field validation, `updateOn`, date controls, Signal Forms custom controls and equivalent-editor/compatibility labs remain later curriculum; P06 does not claim the whole forms checklist is complete.

### M05 / P07 implementation record — 2026-09-27

**Delivered:** lazy `/login` Signal Forms screen, login → profile verification → minimal session publication, explicit verification/logout/Continue, guarded checkout and local demo-admin editor navigation, forbidden recovery and session-aware write checks. Checkout now captures the signed-in demo user's ID instead of fixed user 1. Earlier P00–P06 records above retain their historical scope and measurements. No new dependencies, global-tool changes, storage, real credentials or `.env` were needed.

**Practice accounts and roles:** mock mode accepts `learner` / `practice-only` (ID **2**) and `emilys` / `emilyspass` (ID **1**). Remote mode offers the public documented `emilys` / `emilyspass` example; no live remote authentication was called during this implementation's verification. The sample button fills values only on request. **learner** is the default local role; **demo-admin** must be selected in the UI. Either account can use either practice role. Role is not sent to the API and does not represent server authorization; guards and action checks are navigation/workflow UX only.

**Read in order** (paths below are under `src/app/`):

1. `core/session/session.models.ts` and `session.store.ts`: a root owner keeps the writable session and access token private, exposes a readonly minimal user and notice, and offers semantic expiry/logout/rejection operations. Only `{ id, username, firstName, lastName, role }` is published; there is no token display or retained email/image/extra profile payload. The fixed 30-minute deadline is calculated from **login start**, not profile response time, and is not extended by **Verify session**. The expiry timer is scheduled outside Zone.js so Angular stability does not wait 30 minutes; it re-enters for logout. Guards and action/token access also check expiry synchronously, protecting against delayed browser timers. Destruction clears the timer and ends ongoing session work.
2. `core/session/session.parsers.ts`: validate untrusted login/profile responses, positive safe-integer IDs, bounded non-blank profile text and token format. Credentials are projected to username/password only; usernames trim, passwords are not silently rewritten. The login request adds only `expiresInMins: 30`. Extra fields, including any remote refresh token, are discarded. Runtime validation is separate from TypeScript's DTO expectations; public demo examples are not permission to store real credentials.
3. `core/session/session.service.ts`: a cold `defer` establishes an explicit synchronous busy gate. `POST /auth/login` yields a candidate token, carried in `HttpContext` for one `GET /auth/me`; ID **and username** must match before publishing a session. The combined login/profile chain has one **15-second total timeout**, not 15 seconds per stage. Verification permits one operation at a time and checks the existing identity without extending expiry. Logout cancels login, its profile read and later verification through the store's end signal. `finalize` releases busy state on success, error or cancellation; safe errors permit deliberate retry. This is **not an implemented `exhaustMap` lesson**: duplicate prevention is an explicit gate. No automatic retry or refresh occurs.
4. `core/session/session-auth.interceptor.ts` and `core/config/app-data.providers*.ts`: the functional interceptor adds a session bearer only for **GET at the exact configured API origin/base path plus `/auth/me`**, with no query, fragment or URL credentials. It inspects `request.urlWithParams`, including parameters supplied through `HttpParams`, rather than checking `request.url` alone. Other methods/origins, login/refresh, products, carts and image/CDN URLs receive no session bearer from this interceptor. Allowed auth requests use `credentials: 'omit'` and disable `withCredentials`; login also omits cookies. A 401 rejects only the token used by that request, so an old failure cannot sign out a newer session. This is a narrow header policy, not a claim to authorize other API calls.
5. `core/session/session.guard.ts`, `features/session/session.routes.ts` and the checkout/product route files: functional guards return redirect trees. Guests go to login; learner-role editor visits go to `/forbidden`, whose recovery offers login. The return-path allowlist accepts `/dashboard`, `/cart`, `/checkout`, `/products`, `/products/new`, `/products/:id` and `/products/:id/edit` with positive integer path IDs. Queries, fragments, outlets, matrix parameters, encoded path characters and control characters are rejected. Invalid or duplicate `returnUrl` values fall back to `/dashboard`; the guest guard strips the original query before validating its return path. Login displays an explicit **Continue** link after success; it never automatically redirects or trusts arbitrary query-supplied identity.
6. `features/session/session.component.*`: one private Signal Forms model owns username/password/local role. Required/non-blank/length rules, Material field bindings, invalid-control focus, `submit(..., { ignoreValidators: 'none', ... })`, pending and busy checks provide deliberate submission semantics. A handled `firstValueFrom` boundary treats empty completion as cancellation, not a failed login or an excuse to retry. Password fields clear on success, error, cancellation and destruction; visibility resets and the current form keeps username. Credentials are not put in session state, logs, browser storage or cookies. Error/success headings and logout username focus support recovery without displaying tokens. Compare its form ownership with P05's editor and P06's Reactive Forms control tree.
7. `core/mock/mock-product-backend.service.ts`, `mock-api.interceptor.ts` and `mock-session.spec.ts`: mock `POST /auth/login` allowlists the two public practice accounts; `GET /auth/me` validates the runtime token. Tokens use `crypto.randomUUID()`, have a 30-minute expiry, and are bounded to one session per demo user. Delay, cancellation and reset-generation rules apply: cancelled delayed work cannot commit a mock session, and reset invalidates pending generations/tokens. Reset does **not** immediately sign out app state; the next verification returns 401. Mock `POST /carts/add` now accepts user IDs 1 and 2. Product reads/writes and carts remain public like their DummyJSON counterparts; no forced bearer requirement was added to product writes. This in-browser simulator is not a production auth server.
8. `features/checkout/checkout.component.*`, `features/products/editor/product-editor.component.*`, their existing dirty guards and `layout/shell.component.*`: checkout requires a session and captures its user ID at dispatch, never from query parameters. New save/delete/checkout actions recheck session and relevant local role, including after confirmation dialogs before a write. Expiry leaves the current draft in place but blocks new writes; already-dispatched writes are not rolled back. Existing active-write and dirty-navigation policies remain; choosing to navigate to login may ask to discard a draft. Logout preserves the anonymous cart; reload clears cart and session. Product edits still do not rewrite cart snapshots.
9. Colocated `session.service.spec.ts`, `session-auth.interceptor.spec.ts`, `session.guard.spec.ts`, `features/session/session.component.spec.ts`, `core/mock/mock-session.spec.ts`, `mock-checkout.spec.ts`, plus checkout/editor/router/shell specs: trace payload projection and mismatched identity failures, total timeout, duplicate gates, cancellation, stale 401, fixed expiry, exact URL/HttpParams exclusions, safe return paths, password cleanup, local role denial and captured checkout identity. Controlled HTTP/mock backends keep unit tests off the public API. Read the assertions as executable boundaries, not proof of production authorization.

**Explicitly deferred:** optional refresh remains future curriculum. No refresh token is retained, no `/auth/refresh` call or mock refresh endpoint is implemented, no single-flight refresh queue is claimed and no automatic request replay occurs. Persistence, real account management, server authorization and the full RxJS operator lab are not P07 deliverables. Keeping an access token in memory limits persistence; it is not an XSS defense or a substitute for server enforcement.

**Final verification:** the main implementation pass completed **527/527 ChromeHeadless tests successfully (7.313 s)**; production and mock builds succeeded. Production initial output is **586.04 kB**, above the unchanged **500 kB warning** budget and below the **1 MB error** limit; the existing size regression remains open. All **421 production inputs and 34 emitted scripts** passed mock/test exclusion checks; **50 local Markdown links/anchors**, **37 P07-related files' whitespace checks** and `git diff --check` passed (only existing LF/CRLF notifications). Final diagnostics showed only pre-existing root/lab editor-discovery errors, none in P07. Angular MCP `list_projects` and `get_best_practices` actually succeeded with Angular 22 guidance during implementation, and official authentication documentation was fetched. This documentation-only follow-up records those final results without claiming fresh app checks or an MCP invocation. Remote auth was not exercised live.

**Observed browser checks:** mock browse → add → guest guard → login as user 2 → verify → explicit Continue → checkout → receipt with user 2; learner denied `/products/new` with login recovery; logout focus and password clearing; local demo-admin allowed creation; reload redirects guarded navigation. At 390 px, the inspected light/default/dark views had no horizontal overflow. The monitored journey produced no browser errors or live DummyJSON requests. These are focused browser observations, not a committed E2E suite, axe audit or screen-reader certification. Existing root/lab editor-discovery warnings and legacy builder deprecations remain; no diagnostics or budgets were suppressed.

**Revision prompts:** Why verify both ID and username before publishing a candidate token? Why does a query added via `HttpParams` matter to the interceptor? Why must a 401 be tied to the request's token? Why start expiry at login and check it synchronously as well as with a timer? Why clear a password but preserve an editor draft? Why does a local demo-admin selection not authorize a public product write? Why can reset invalidate a mock token without immediately changing app session state? Why keep Continue explicit?

**Historical next (at P07):** **M06 / P08 first slice — related users/posts reads**, minimal public projections, parallel/dependent requests, cancellation and partial-error recovery. Then **M07 / P08 tasks**, serialized mutations and RxJS operator/timeline lessons; dashboard widgets remain future P08 work. Do not mark these placeholder routes complete or claim refresh/`exhaustMap` coverage from P07.

### M06 / first P08 slice implementation record — 2026-09-27

**Delivered scope:** lazy `/users` searchable Material table, `/users/:id` public profile plus posts, and `/posts/:id` post/comments plus a dependent author. These are public read-only screens, not session profile editing. `/posts` remains a recovery page, not a list. The profile has independent sections, **no nested profile/posts/tasks tab routes**. Earlier P00–P07 records above remain historical. No dependency, environment-variable, global-tool or session/auth-policy changes belong to this slice.

**Read in order** (paths under `src/app/`):

1. `features/users/data/user.models.ts`, `features/posts/data/post.models.ts`, then their parsers: project `unknown` into readonly public user `{ id, firstName, lastName, image }`, post `{ id, title, body, userId }` and comment `{ id, body, postId, user: { id, fullName } }`. Discard email, address, password, role, username and unused reaction/like fields even when the API ignores `select`. Validate positive safe-integer IDs, required text, expected detail IDs and each post/comment's parent relationship. Missing/empty avatars become `null`; image URLs permit HTTPS without URL credentials or safe root-relative paths, not arbitrary schemes.
2. `core/http/read-parsers.ts` and `.spec.ts`: validate nonnegative safe-integer `total`, `skip` and `limit`, safe requested page arithmetic, exact requested offset and unique row IDs. Expected rows are `min(requested limit, max(0, total - skip))`; reject truncated or inconsistent pages rather than silently dropping rows. A reduced response limit is accepted only when it still accommodates every expected remaining row; zero is valid for an empty/beyond-end page. Preserve the normalized `Page<T>` metadata instead of deriving a global total from displayed rows.
3. `features/users/data/users-api.service.ts` and `features/posts/data/posts-api.service.ts`: cold `defer`-based GETs for users, user search/detail, posts by user, post detail and comments by post. Build parameters safely, request minimal `select` fields and validate every response. Each request has its own **15-second timeout** and safe `ApiError` mapping; this is not one 15-second budget for the entire post→author chain. There is **no automatic retry or service cache**. Public requests set `credentials: 'omit'` and `withCredentials: false`; the existing exact `/auth/me` session-bearer policy is unchanged and does not attach a bearer to these reads. Public response roles/IDs never establish or replace the demo session.
4. `shared/ui/read-state.ts`, `read-error.component.*` and `user-avatar.component.*`: each inner read emits loading, success or error. Inner `catchError` preserves future route/search/retry intents; `startWith` lets combined sections render partial progress. Empty collections are successful values. Errors are section-specific: network/format/server failures offer explicit retry; invalid requests, 401/403 and 404 offer link recovery instead. The 48×48 `NgOptimizedImage` avatar has named missing/broken fallbacks and resets its failure state when the source changes. Templates interpolate untrusted text rather than rendering HTML; no sanitization bypass is used.
5. `features/users/data/user-url.ts` → `directory/user-directory.component.*` → `users.routes.ts`: router-owned `q`, one-based `page`, and `pageSize` 10/25/50 (default 10). Search trims/caps at 200 characters and waits 300 ms; equivalent normalized queries do not refetch. Search/page-size changes reset the page. Duplicate/invalid values fall back safely; defaults and unknown keys disappear via replace navigation. The linked signal holds only the uncommitted search draft. Clear, pagination, navigation and destruction cancel pending typing; `switchMap` replaces stale HTTP reads. The table renders the server page without client-side filtering/repaging or a sort control. Profile links and the profile's Back link retain validated directory queries; child paging is separate from that return query.
6. `features/users/profile/user-profile.component.*`: the validated path ID starts profile and posts **in parallel**, not profile→posts. `combineLatest` combines independently recoverable read states; profile/posts can render or retry without waiting for or reloading the other. A local `linkedSignal` keys the ten-row posts page to the user ID; reused IDs reset to page zero and cancel prior requests. Empty and beyond-end views are distinct, with deliberate first-page recovery for the latter. Invalid IDs produce no profile/posts requests; query parameters cannot override identity.
7. `features/posts/detail/post-detail.component.*` → `posts.routes.ts`: post and comments start together. Only a successful, validated post supplies `userId` to the dependent author `switchMap`. The post stream uses **`shareReplay({ bufferSize: 1, refCount: true })` inside the route-ID `switchMap`**, sharing one HTTP subscription between rendering and author lookup. Its scope ends on ID replacement/view destruction; `refCount` is not a TTL or a general cache-eviction promise for completed HTTP streams. Comments and author retry independently; retrying the post renews its author dependency but not comments. Comment paging is local, ten rows per page, reset on post ID changes. One `toSignal` view boundary owns combined subscriptions; destruction cancels active inner reads, including the dependent author. Post/author/commenter links use validated IDs; the post's Back link goes to the directory without promising query restoration through the entire relationship journey.
8. `core/mock/relationship-mock.ts` → `mock-product-backend.service.ts`/`mock-api.interceptor.ts` → `mock-relationships.spec.ts`, then colocated parser/service/URL/component/shared-UI specs: trace allowlisted GETs through the existing delayed scenario and reset-generation boundary. Source seeds contain **30 fictional users, 42 posts and 14 comments**, not hard-coded remote totals. User 1 has 12 posts, user 2 has three, user 30 has none; post 1 has 12 comments. Seeds retain only public fields and no remote avatar URLs. Responses are cloned; consumers cannot mutate nested seed objects. Unsupported relationship methods/routes fail locally (normally 501), never silently fall through to DummyJSON. Existing empty/malformed/network/status/delay scenarios, cancellation and reset invalidation remain available; scenario-control UI is still later work. Specs exercise privacy, strict metadata, relationship integrity, timeout, independent failure/retry, route reuse, paging reset, safe text and cleanup; their presence is not a passing test-run claim.

**Revision questions:** Why can posts render before the profile arrives, but the author cannot load before the post? What initial emission does `combineLatest` need from each section? Why catch errors inside the route/request switch? Which requests repeat when retrying comments, author or post? Why place sharing inside the route switch rather than on a root service, and why is `refCount` not a cache TTL? How does a parent ID prevent an old child-page index leaking into a new route? Why reject a short page when its total says more rows should have arrived? Why project fields locally even after requesting `select`? Why does viewing public user 2 not sign in as user 2?

**Research evidence:** the main implementation pass successfully used Angular MCP `list_projects` and `get_best_practices`; official DummyJSON users/posts/comments documentation was fetched. The earlier status-edit follow-up also fetched documentation. This final documentation-only closeout records that evidence rather than claiming fresh MCP calls or web research; MCP tools are unavailable in this editing session. No live authentication or mutations were performed.

#### M06 verification — final

**Final supplied main-pass results:** **843/843 ChromeHeadless tests SUCCESS (8.073 s)**; production and mock builds succeeded. Production initial output is **599.56 kB**, up **13.52 kB from P07's 586.04 kB**, above the unchanged **500 kB warning** budget and below the unchanged **1 MB error** limit. The existing initial-size issue remains open; budgets were not raised. All **440 production inputs and 42 emitted scripts** passed mock/test exclusion checks. `git diff --check` passed with LF/CRLF notices only. This final documentation-only closeout records supplied application results without rerunning tests/builds.

**Earlier attempts and test fixes:** the initial TypeScript union-observable subscription typing blocker was fixed before the successful final suite. The history unit test uses `provideLocationMocks()` and the public `Router.setUpLocationChangeListener()` because the router harness does not perform application bootstrap that would set up the location listener. The earlier unsupported-users mock test now uses `/todos`, since users reads are supported. The intermediate documentation pass's 53 local Markdown links/anchors, five-file whitespace check and three clean edited code/template files remain limited historical checks, not the final application evidence.

**Observed mock browser checks:** directory search → profile → post/dependent author/comments; second-page access for the profile's 12 posts and the post's 12 comments; keyboard search focus retention and clear focus; Back/Forward query restoration; directory page size 25/page two surviving reload; keyboard opening of size 50; menu Escape focus restoration. Empty search, user 30's empty posts, post 2's empty comments, invalid user/post IDs and missing user 999 were verified. Directory/profile/post/error/empty views had no horizontal overflow at 390 px in the inspected light/default/dark checks. The monitored main journey produced no page errors or live DummyJSON requests. One selector-based click timed out against Material's intentional touch-target sibling; local Material source inspection and successful real-pointer/keyboard interaction confirmed the behavior, so no CSS override or workaround was added.

**Current diagnostics and limits:** historical root/lab template diagnostics have cleared. The latest main-pass editor check instead reports unresolved Jasmine globals in existing `core/mock/mock-product-backend.service.spec.ts` and `core/mock/mock-checkout.spec.ts`, although the suite compiles and runs. Newly checked M06 files are clean; this is **not** an all-editor-diagnostics-clean claim. No diagnostics were suppressed and no alternate runner was installed. Legacy Karma/dev-server deprecations remain. No live authentication/mutations, axe audit, screen-reader audit or full E2E verification was performed; focused browser observations do not establish full accessibility conformance. The temporary mock server on port 4208 was stopped after verification.

**Documentation-only validation:** **54 local Markdown links/anchors** passed with no broken destinations or stale M06 verification-pending text. A read-only scan covered **58 scoped M06-related files, including 56 untracked files**: no trailing whitespace, missing final newlines or UTF-8 BOMs; existing tab indentation on 24 lines in `src/app/app.routes.ts` remains an exception and was not changed. The two edited documents have no editor diagnostics. `git diff --check` passed with package-file LF/CRLF notices only. No application tests/builds were rerun and no verification files were created.

**Historical exact completion / next (at M06):** M06's directory/profile/post/comment public-read implementation and verification sign-off are complete within the limits above. **M07 / P08 tasks** and serialized mutations are next. Live dashboard widgets, operator timelines/four-flattening-operator comparisons, profile tasks/nested tabs and remaining RxJS lessons are not delivered by this slice. The dashboard is still metadata-only and makes no API calls. **Do not mark all of P08 complete.**

### M07 / P08 tasks implementation record — 2026-09-27

**Delivered scope:** lazy public `/tasks` with paged all-user/user-filtered reads, Signal Forms creation, completion-only updates, confirmed deletion and page-local OPEN / DONE ordering. The profile now provides **View this user's tasks**, linking to `/tasks?userId=<id>`; no nested profile/tasks tab was added. This is public assignment data, not an authenticated identity or an authorization boundary. Earlier records above, including their then-next tasks and metrics, remain historical. No environment variables, `.env`, dependencies, global tools or session/auth policy changes are part of M07.

**Read in order** (paths under `src/app/`; final main-pass test evidence is recorded below, with no tests rerun in this documentation-only closeout):

1. `features/tasks/data/task.models.ts` → `task.parsers.ts` / `.spec.ts`: readonly task `{ id, todo, completed, userId }`, query/draft/deletion contracts and explicit `simulated` versus `session` results. Runtime parsers project only these fields, reject inconsistent pages/relationships and validate mutation echoes against the requested text, completion and owner. Creation trims text and limits trimmed data to 200 characters; existing remote text is preserved and is not subject to the creation-only limit. Deletion retains only matching ID, `isDeleted: true` and a canonical ISO timestamp. The [official todos documentation](https://dummyjson.com/docs/todos) shows **`id: "1"` in the PUT/PATCH update response**. Only mutation acknowledgement IDs normalize canonical positive decimal strings to safe integers; numeric IDs remain valid, while leading zeroes, signs, whitespace, fractions, exponent notation and unsafe values fail. Read IDs and every `userId` stay strictly numeric; this is not general coercion of external data.
2. `data/tasks-api.service.ts` / `.spec.ts`: cold `defer` subscriptions support `GET /todos`, `GET /todos/user/:userId`, `GET /todos/:id`, `POST /todos/add`, completion-only `PATCH /todos/:id` and bodyless DELETE. List calls send only `skip`/`limit`; creation sends `{ todo, userId, completed: false }`. Each request has a **15-second first-response timeout**, safe error mapping, runtime validation, no cache and no automatic retry. All requests use `credentials: 'omit'` / `withCredentials: false` and receive no session bearer under the unchanged exact `/auth/me` policy. Specs cover public 401s preserving a verified session, payload/response privacy, ID normalization, timeout, cancellation and explicit recovery without the public API. Public text is interpolated; arbitrary response bodies/task text do not appear in errors.
3. `task-url.ts` / `.spec.ts` → `tasks.component.ts`: URL-owned optional `userId`, one-based `page`, and `pageSize` 10/25/50 (default 10). An absent user filter means all users. A present invalid, empty or duplicate ID yields an error and **no HTTP**, never a silently broadened query; **All users** is deliberate recovery. Pagination defaults/invalid values normalize safely, unknown keys disappear, leading-zero page numbers canonicalize, and unsafe paging arithmetic falls back. Filter/page-size changes start at page one. `switchMap` cancels replaced reads; failed loads clear stale rows and permit explicit reload. There is no task search or server-sort UI, and local column moves do not sort the full server dataset.
4. `task-board.service.ts` / `.spec.ts`: `TasksComponent.providers` creates one board state owner per component, not a root queue. Private writable signals expose readonly views. The admission bound is **10 operations total, including the active request and any queued create/delete/completion**; one creation at a time and per-row locks prevent duplicates. Row phases become `queued` immediately and `in-flight` only when `concatMap` subscribes. Completion changes optimistically on admission; delete keeps its row until validated success. `defer` also catches synchronous API exceptions. Inner `catchError` handles each failure without terminating later queued intents; completion failure restores only that row's previous task at its existing local position, preserving other successes/deletions. Creation failure keeps the form draft; failed deletion keeps its row. No whole-page rollback or automatic write replay occurs.
5. Queue cleanup: inner `finalize` releases the operation's phase/count on completion, error or unsubscribe. A delete response can remove its row before completion, but the pending counter keeps navigation/reload locked until the request completes. **`takeUntilDestroyed()` is after `concatMap`**, so forced destruction unsubscribes the active request and drops unstarted buffered writes; it does not drain them. The owner's destroy callback resets count/create/row phases and completes owned subjects, because dropped operations never subscribed and cannot run inner finalizers. Ordinary navigation is blocked while writes are pending; destruction tests exercise the forced teardown path. Client cancellation/timeout/invalid response does not prove remote rollback, and discarded optimistic view state is not a compensating server write.
6. `tasks.component.html` → `task-form.ts` / `.spec.ts`: Signal Forms with Material text/number controls owns a non-blank draft (200-character UI limit) and positive safe-integer assignment ID, defaulting to the filter or user 1. Submission touches errors/focuses the first invalid control; admitted creation disables the draft immediately, even while queued, and resets it only on validated success. **Creation results are separate from board rows in both modes**: no remote-generated-ID actions, no insertion into a server-paged snapshot, no invented total increment. Mock results advise explicitly loading the desired filter/page, which may not include the new task. DELETE requires confirmation. OPEN / DONE are computed from this page's completion flags; toggling completion sends PATCH. Native **Move up / Move down** swaps within a column with **no HTTP**, refuses pending rows/neighbors and retains focus through render hooks. CDK drag/drop remains P10.
7. Snapshot honesty: local successful deletes remove rows but retain the server total labelled **“at last load”**; column counts describe only local page rows. No remote total is inferred from them. Explicit **Reload page** replaces the snapshot, local order, previews and creation result with a fresh read, without silently refetching after each mutation. Mock reads reflect session writes; remote reads discard simulated changes. Browser reload additionally restores mock seeds. Explicit page reload preserves a dirty creation draft; an accepted canonical query change resets the draft/default assignment. Ordering is not a persisted field or a separate dirty draft.
8. `tasks.guard.ts` → `tasks.routes.ts` → `tasks.component.spec.ts`: functional **`CanDeactivate`**, configured with `runGuardsAndResolvers: 'always'`, delegates to the component. Specs assert dirty draft keep/discard for **query-only** navigation as well as departure; consent precedes the new read/default assignment. Active/queued writes or an open confirmation block departure, query filter/page changes, pagination and reload; reads alone can be replaced/cancelled. Confirmations focus cancel and restore focus; independent destruction-bound dialog cleanup prevents a superseded guard subscription leaving a lock behind. Browser unload protection is best-effort, not persistence. Auth/session is not consulted for task access. UI specs cover loading/empty/error/recovery, duplicate gates, row locks/capacity, separate results, safe text, focus, snapshot totals and forced destruction, with passing-suite evidence recorded below.
9. `core/mock/task-mock.ts` → `mock-product-backend.service.ts` → `mock-tasks.spec.ts`: one task database per backend injector, **42 tasks** across the existing 30 public users: 12 for user 1, three for user 2, none for user 30 and one for each user 3–29. All 30 are valid creation owners; IDs begin at 43. CRUD is session-stateful and reset restores seeds/IDs. Pages return the actual slice length as response `limit`, including zero for empty/beyond-end pages; unknown owners/details fail locally. Bodies/parameters are allowlisted (PATCH only `completed`); unsupported routes/methods return 501, never live fallback. Responses are cloned so callers cannot mutate the database. Scenarios are consumed at subscription, with integer delays **0–10,000 ms** and commits only at response time. Cancelling before delivery prevents a mock commit/ID allocation; reset invalidates earlier pending generations with 409 at delivery. Status/network/malformed and empty-write outcomes do not commit; empty lists are successful, empty detail is 404. Specs cover all six operations, delayed failures/cancellation/reset, clone isolation, CRUD/reset and public-session privacy through the real provider stack plus a test-backend fail-safe.

**Research evidence:** the main implementation pass successfully called the local Angular MCP `list_projects` and `get_best_practices` tools and fetched official DummyJSON todos documentation. The earlier scoped status edit also fetched the official todos page and its relevant user-todos documentation link; it did not make live task mutations or authentication calls. This documentation-only closeout records those successful calls without claiming a fresh MCP invocation or treating the current tool registry as evidence of main-pass unavailability.

**Revision prompts:** Why count queued work as well as the active request? Why put error recovery inside `concatMap` and destruction after it? Why do unstarted buffered operations have no inner finalizer? Why must rollback replace one row rather than a page snapshot? Why normalize a documented mutation ID string without relaxing read/user IDs? Why is a creation echo not an actionable paged row? Why are column counts and totals labelled differently? Why protect query-only navigation but allow replacement of a pending read? Why is public assignment unrelated to the demo session?

#### M07 verification — final

**Final supplied main-pass results:** **1176/1176 ChromeHeadless tests SUCCESS (9.451 s total; 9.137 s execution)**, including task/mock and updated dashboard/route/profile specs. Production and mock builds passed. Production initial output is **599.74 kB**, above the unchanged **500 kB warning** budget and below the unchanged **1 MB error** limit. The existing size warning remains open; no budgets or strict checks were weakened. This documentation-only closeout does not rerun tests or builds; prior P00–P07/M06 metrics retain their historical scope.

**Final artifact revalidation:** the earlier exclusion scan preceded the last small accessibility-template change, so this closeout re-scanned the final `dist/angular-22/stats.json` and all emitted browser JavaScript. **450 production inputs and 45 emitted scripts** passed mock/test-path exclusion and 20 seed/implementation-marker checks, with **zero matches and no missing script outputs**. This is final-artifact evidence, not reuse of the earlier scan. The public mock-product SVG remains an ordinary asset; never deploy the mock configuration.

**Observed mock browser checks:** creation for public user 30 produced a separate, non-actionable result with focus; explicit page reload then exposed the created row. Space toggled completion. Delete Escape restored focus; confirmed deletion removed the row while totals stayed **“at last load”**, and reload refreshed them. User 1's 12 tasks supported page two and first-page recovery. Enter activated native local reordering and retained focus on the enabled move control. Cancelling a dirty filter change preserved the draft; accepting discard cleared it. Invalid-filter errors had an ARIA association, required task text showed validation, the user 1 profile linked to filtered tasks, and keyboard ArrowDown selected page size 25. Browser reload reset mock seeds.

**Responsive/monitoring evidence:** empty and populated task views at **390 px**, in inspected **light and dark** states, had no horizontal overflow in either the main content or document. The monitored successful creation/reset mobile journey recorded **zero page errors and zero live DummyJSON requests**. These are focused observations, not full axe, E2E, screen-reader or live-API verification; no live authentication or task mutations were performed.

**Automation corrections, not app bugs:** an initial check incorrectly expected heading focus after reordering although the enabled move button correctly retained focus; a required-text assertion omitted the message's final period; an option click followed ArrowDown even though it had already selected 25. Corrected selectors/expectations passed. No app workaround is implied by those automation failures.

**Diagnostics and limits:** final main-pass scoped TypeScript/template diagnostics were **zero**. Existing editor-only unresolved Jasmine globals in the older `core/mock/mock-checkout.spec.ts` and `core/mock/mock-product-backend.service.spec.ts` remain despite the successful suite; this is not an all-workspace-diagnostics-clean claim. Legacy Karma/dev-server deprecations remain. No suppression, alternate test runner or accessibility tooling was added.

**Documentation-only validation:** **63 local Markdown links/anchors** passed across `README.md` and this blueprint (14 and 49 respectively), with no broken destinations or stale M07 verification-pending status. Both documents passed trailing-whitespace, final-newline and UTF-8 BOM checks and have no editor diagnostics. `git diff --check` passed with existing package-file LF/CRLF notices only. This closeout edited only these two documents, revalidated existing production artifacts, and created no verification files; no source changes, tests or builds were run.

**Historical next remaining scope (at M07):** dashboard widgets with independent partial-error recovery, `forkJoin`/`combineLatest` comparisons and the operator/timeline labs, including four-flattening-operator subscription experiments. Native task move controls exist; CDK drag/drop and its interaction checks remain P10. The dashboard remains a public metadata-only overview with **no API calls**. **M07 implementation does not complete P08.**

### P08 / dashboard widgets and RxJS recipes — 2026-09-27

**Delivered and verified:** P08 is complete within the recorded scope: user-initiated public widgets on `/dashboard` and nine real-operator recipes at lazy `/labs/rxjs`, linked from the overview and `/labs`, complete the earlier verified M06/M07 slices. Their historical sign-offs remain unchanged; focused browser evidence and limits for this slice are below. This four-file closeout updates only README/blueprint status, dashboard copy and aligned test assertions; no behavior or dependencies change and no application checks are rerun here. The implementation introduces no new endpoints, session policy, persistence, environment variables or global-tool changes.

**Read in order** (paths under `src/app/`):

1. `features/dashboard/dashboard-widgets.component.ts` / `.html`: `UsersApiService.list({ q: '', pageIndex: 0, pageSize: 10 })`, `TasksApiService.list({ userId: null, pageIndex: 0, pageSize: 10 })` and `PostsApiService.byUser(1, 0, 10)` reuse existing cold, validated, 15-second-timeout services. **No HTTP occurs on construction or strategy changes before Load widgets.** Each active group reads each domain once. Users/posts retain at most **three linked previews**; task completion counts cover only returned rows from the first ten tasks, not the global total. The posts total and titles belong to **public user 1**, not all posts, recent activity or the authenticated user. Totals describe the last response. Public requests retain `credentials: 'omit'`, `withCredentials: false` and no session bearer; even a public 401 does not clear the session.
2. `widget-composition.ts`: `composeWidgets(strategy, sources, retry$)` accepts request factories returning `Observable<WidgetData>` and returns `Observable<WidgetStates>`. Independent rendering uses **`merge` + immutable `scan`**; **`combineLatest`** seeds every section with loading so one successful response need not wait for its peers. The component admits retries **only for error states** in these two strategies; section `exhaustMap` suppresses overlap, and healthy siblings do not reload. **`forkJoin`** emits a settled snapshot only after every input emits and completes. Per-inner `catchError` maps safe errors without discarding healthy results; `defaultIfEmpty` maps a no-emission completion to an error, while a valid zero-total page is empty. Three failures remain three error states, not one collapsed group failure. A never-completing input cannot yield a snapshot; service response timeouts do not redefine forkJoin completion semantics.
3. `dashboard-widgets.component.ts` owns **one stable `toSignal` boundary** over the Load stream's `switchMap`. After loading, switching strategy cancels the previous group, including pending retries, and starts one fresh group; it never runs all strategies concurrently. **Reload snapshot** is forkJoin-only, reloads all three domains after settlement and ignores duplicate busy actions. The boundary unsubscribes active inner reads on view destruction. No cache, polling, automatic retry or background refresh was introduced. `dashboard.component.*` keeps Material overview/module cards, adds idle widgets and links both labs, and points next to P09. The widget controls and articles themselves are styled native HTML.
4. `features/labs/labs.routes.ts` places static `rxjs` before the generic topic preview. `rxjs-lab.component.ts` / `.html` / `.css` uses styled **native selects/buttons and semantic sections**, not Material cards or a Material form. Public labels are **Recipe**, **Click scenario**, **Flattening strategy**, **Inner error** and **Virtual navigation teardown**; actions are **Run experiment** and **Reset experiment**. Concept, prediction before Run, Angular/RxJS mechanism, common mistake, revision question and test observation accompany each recipe. Allowlisted selection validation associates errors with controls; changing recipe/scenario clears the trace. Reset restores defaults. A generation check plus `DestroyRef.destroyed` rejects late promise publication after reset, replacement or destruction.
5. `experiment-trace.ts`: real **`VirtualTimeScheduler` from `rxjs`** drives synthetic fixtures in the production route. `runVirtualExperiment(setup)` injects a scheduler/trace into each recipe, flushes synchronously and always disposes the owning subscription. `ExperimentTrace` accepts only bounded synthetic IDs, event kinds and relative integer timestamps: **at most 160 events, 500 virtual ms**, stable equal-time ordering and independent snapshots. It does not retain request bodies, credentials, error messages or user payloads. These intentional production learning fixtures are not `src/app/testing` fixtures, mock backend code or `rxjs/testing` leakage. No real HTTP, storage, global event listeners or ongoing wall-clock timers are used by the lab.
6. Read `rxjs-lessons.ts` alongside the actual recipe implementations below, then their colocated specs. The lesson text is backed by running operators, not a prewritten expected timeline. `flattenOperations<T, R>(source$, strategy, project)` is shared with `TestScheduler` emission **and subscription-window** assertions. Other recipe specs compare TestScheduler traces with the production virtual scheduler. `rxjs-lab.component.spec.ts` covers all recipes, native labels, invalid selection/recovery, reset, isolation and late promise results. `dashboard-widgets.component.spec.ts` uses real services plus the HTTP testing backend to check no pre-load requests, public credentials, partial/empty/error/timeout states, error-only retries, all-failed snapshot recovery, single groups and actual component-destruction cancellation. Dashboard and route specs cover links, titles, idle behavior and remaining curriculum.

#### Nine delivered recipes

| Recipe / implementation | Actual fixture and operator behavior |
| --- | --- |
| **Flattening** — `flattening-experiment.ts` | Burst **A0 / B7 / C11 / D47**; spaced **A0 / B38 / C71 / D109**; latencies **A31 / B13 / C23 / D9** virtual ms. `switchMap` replaces, `concatMap` queues, `mergeMap(project, 2)` permits two inners and buffers the rest, `exhaustMap` ignores while busy. No-error burst next events: switch C34/D56; concat A31/B44/C67/D76; merge B20/A31/C43/D56; exhaust A31/D56. Inner `catchError(() => EMPTY)` preserves later clicks. A selected error on an ignored/cancelled operation may never occur. Downstream `takeUntil` cuts off at **25 or 50** virtual ms, cancelling active inners and logging dropped unstarted queued work; four clicks bound admission, not the operators' general queue capacity. |
| **Subjects** — `source-experiments.ts` | `Subject`, `BehaviorSubject('D')`, `ReplaySubject(2)` share A1/B5/C11, complete at 13; subscribers join at 0/8/15. Only ReplaySubject replays B/C after completion; completed BehaviorSubject does not replay its current value. Signals represent current synchronous UI state, not an event history. |
| **Sources** — `source-experiments.ts` | `of` and `from(array)` emit synchronously; `defer` factories run separately at subscriptions 5/17. `timer(10)` fires once; `interval(6).pipe(take(3))` emits at 6/12/18. Local `EventTarget` events at 4/9/19 feed `fromEvent`; `takeUntil` removes observation/listener at 12, so 19 is not delivered to the view. All schedules are virtual and owned. |
| **Transformation** — `stream-experiments.ts` | `from([1,2,3,4])`, `map` doubling, `filter` above four, `tap` observing 6/8, `scan` accumulating and `startWith(0)` produce 0/6/14. Synthetic numeric IDs are counters, not user payloads. |
| **Timing** — `stream-experiments.ts` | Shared A0/B3/B11/C22/D35 completes at 45. `debounceTime(6)` + `distinctUntilChanged` emits B9/C28/D41; leading-only `throttleTime(6)` emits A0/B11/C22/D35; `auditTime(6)` emits B6/B17/C28/D41. Every timing operator receives the virtual scheduler. |
| **Combination** — `stream-experiments.ts` | Primary A2/C9/D21 completes at 24; secondary B6/C15 completes at 18. `combineLatest` first emits at 6, seeded variants use `startWith('S')`; unseeded `withLatestFrom` first responds at 9, seeded at 2. `forkJoin` emits D+C at 24. EMPTY combinations emit no result; a NEVER join cancels at 30. Per-inner recovery in JOIN-RECOVER retains A plus synthetic E. |
| **Errors** — `stream-experiments.ts` | `defer`, `timer`, `throwError` and `retry({ count: 2, delay })`: seven-ms attempts, five-ms delay for synthetic transient failures only, at most three attempts (0/12/24). Transient success arrives at 31; exhausted/validation failures recover with EMPTY after logging the failure. Validation gets one attempt. NEVER times out at 13; `finalize` covers completion, error and unsubscribe. This does not add automatic retry to application services or writes. |
| **Sharing** — `sharing-experiment.ts` | Cold A+5/B+15 then completion; readers join at 0/8/20/47, first two leave at 11/13. `share` has no replay; `shareReplay({ bufferSize: 1, refCount: true })` replays A to reader 2. Ref-count zero at 13 cancels/reset unfinished work. Reader 3 completes at 35; reader 4 restarts `share` but receives cached B at 47 from completed `shareReplay`. Ref-count is not TTL; each Run constructs a fresh instance. |
| **Promises** — `promise-experiment.ts` | `runPromiseExperiment(): Promise<readonly TraceEvent[]>` compares `firstValueFrom`/`lastValueFrom`: A7/B16/complete19 means first resolves A at 7 with cancellation, last resolves B at completion 19. Both EMPTY conversions reject `EmptyError` at 0; NEVER conversions reject `TimeoutError` at 13 using `timeout({ first: 13, each: 13, scheduler })`. Handlers attach before flush; only settled promise microtasks remain, and markers use virtual subscription-end time. An inter-emission timeout alone does not bound a forever-emitting last-value source; this fixture has fixed completion. |

**Lifetime distinction:** the lab's “navigation” control is a **synthetic `takeUntil` cutoff**, not Angular navigation or proof of component teardown. Dashboard component destruction separately tests `toSignal`-owned HTTP cancellation; task lifecycle tests cover real owning-view cleanup with `takeUntilDestroyed` after `concatMap`. Lab component tests separately reject publication into a destroyed view. Cancelling observation never proves server rollback.

**Revision prompts:** Why is public user 1 unrelated to the signed-in identity? Why are first-page task counts not global? Why does an EMPTY stream differ from a valid empty page? What makes combineLatest partial progress possible? Why can forkJoin retain three errors instead of failing the group? Which clicks never subscribe, and why can they neither finalize an inner nor report its selected error? Why does completed replay survive zero readers? Which promise settles before source completion?

#### P08 verification — final

**Supplied main-pass results, not rerun here:** **1314/1314 ChromeHeadless tests SUCCESS**; production and mock builds passed. Production initial output is **604.02 kB (604,025 B)**, approximately **4.28 kB above M07**. The unchanged **500 kB warning / 1 MB error** budgets still produce the existing size warning, not an error. Budgets were not increased; the comparison is intentionally approximate. The main pass owns the final application rerun after these copy/assertion edits; this record does not claim that rerun has already occurred.

**Production artifact evidence:** exclusion checks passed for **462 inputs and 49 emitted scripts**, excluding mock implementation/seeds, specs, `app/testing`, `rxjs/testing` and `TestScheduler`; all **49 emitted scripts match the stats**. Stats contain **76 output records: 49 JavaScript + 27 CSS**, not 76 scripts. All **eight RxJS lab implementation modules** remain outside the initial import graph, contributing **28.075 kB** to lazy output. Shared RxJS helpers contribute **4,280 B** in the initial graph; this is not exact per-feature attribution of the approximate whole-build delta or a zero-initial-cost claim. `VirtualTimeScheduler` and production-route synthetic fixtures are intentional. The mock build passed but remains development-only and must not be deployed.

**Diagnostics/tool evidence:** the **29 scoped files** had clean main-pass editor diagnostics and whitespace checks. Older component-state lab quantity-control discovery diagnostics resurfaced despite passing AOT/tests. Older `core/mock/mock-checkout.spec.ts` and `core/mock/mock-product-backend.service.spec.ts` had previously known editor-only Jasmine-global errors; this scoped closeout does not certify their absence. Deprecated Karma/dev-server builder warnings remain. Local Angular MCP **`list_projects` and `get_best_practices` actually succeeded in the main pass**. This edit records that success without claiming fresh MCP calls; those tools are not exposed in this editing session. No behavior, dependency, strictness, budget or session-policy changes are part of this edit.

**Status-closeout validation:** **68 local Markdown links/anchors** passed across `README.md` and this blueprint (**15 and 53** respectively). All **four edited files** have no editor diagnostics and pass trailing-whitespace, final-newline and UTF-8 BOM checks; scoped `git diff --check` passed. Only `README.md`, this blueprint and `features/dashboard/dashboard.component.html` / `.spec.ts` are edited; the six dashboard test cases are retained with aligned copy assertions, not rerun here. No verification files, dependency changes or application check runs are added. A checksum confirms historical M00–M07 records retain their original content.

**Observed fresh-page mock browser checks:** all nine recipes passed via pointer interaction, in table order above, with event counts **19, 48, 43, 8, 25, 45, 42, 57, 27**. Keyboard **Enter Reset** and **Space Run** passed. The concat scenario recorded **B error at 44 virtual ms**, then **C cancelled and D dropped at 50 virtual ms**. All three dashboard strategies showed **30 users, 42 tasks and 12 posts for public user 1**, with page-local **3 completed / 7 incomplete** tasks. Keyboard **Load widgets** and forkJoin **Reload snapshot** worked; dynamic labels and only-on-request loading were verified. Browser reload returned the lab to idle. Monitoring recorded **zero page errors and zero live DummyJSON requests**.

**Responsive and automation evidence:** both dashboard and lab passed **390 px light/dark** reflow checks after the responsive transition, with stable **document/client widths 375/375 px**; reduced motion was emulated. An initial measurement during Material's sidebar transition showed a transient **119 px** width difference, then stabilized at 375/375; no CSS changes were needed. Automation on an older shared tab failed scroll-stability/native-activation checks; a fresh page passed all trusted pointer/keyboard control checks without app workarounds. These were automation/transition observations, not application fixes.

**Verification limits:** browser dashboard checks used the default-success mock only. Partial-failure/retry behavior is validated by HTTP unit tests and TestScheduler, not claimed as browser-verified. Dashboard hero-link navigation to the RxJS lab and revisit checks remain with the main pass and are not claimed here; neither is server shutdown. No axe, screen-reader audit, committed E2E suite or live-API checks were performed. Focused browser observations do not establish full WCAG conformance or complete every later curriculum lesson.

**Next:** P09 feature labs, resource variants and forms comparisons. P08 implementation completion is not completion of every C/D/S/R topic, resource/form comparison or Material lesson. CDK drag/drop remains P10; optional session refresh remains deferred.

### P09 / core framework, resources and forms labs — 2026-09-27

**Delivered scope:** P09 core is implemented, not the entire curriculum. Eight lazy entry routes replace previews: `/labs/components`, `/labs/di`, `/labs/state`, `/labs/routing`, `/labs/resources`, `/labs/forms-signal`, `/labs/forms-reactive` and `/labs/forms-template`. `features/labs/labs.routes.ts` keeps static entries before `:topic`, uses `FormsLabGuard` on all three forms routes and preserves P04/P08 routes. The labs index exposes all eight, and the dashboard adds **Open Angular labs** without removing existing hero links. App smoke coverage uses actual application providers. No dependency, global-tool, session-policy, storage, zoneless or SSR change belongs to P09. No new endpoint, secret or `.env` is required.

#### P09 source-reading matrix

Paths are under `src/app/`. Read each implementation with its colocated specs; IDs identify core coverage and revision, not blanket completion of every row in the reference curriculum.

| Coverage | Source-reading sequence and observable boundary |
| --- | --- |
| **C01–C08 foundations / C03/C08–C10/C14 templates and queries** | Retain product/card/quantity/P04 examples, then `features/labs/components/templates-experiment.component.*`, `notice-template.directive.ts`, `permission-view.directive.ts`, `queries-experiment.component.ts`, `query-panel.component.ts`. Typed template contexts, local structural permission view (not authorization), projection/fallbacks, view/content queries, stable reordering and focus are actual experiments. |
| **C05/C06/C13/C15/C20 composition; C04–C06/C11/C18 dynamic views** | `composition-experiment.component.ts`, `toggle-behavior.directive.ts`, `toggle-examples.component.ts`; then `dynamic-experiment.component.*`, `dynamic-widgets.component.ts`, `widget-container.directive.ts`, `widget-lifetime.service.ts`. Compare host-directive composition with inheritance; run both `NgComponentOutlet` and `ViewContainerRef.createComponent`. Container input/output bindings differ from the outlet's typed callback input. Input updates do not recreate; replacement/clear/switch/destroy release the old widget. |
| **C16/C17 pipes, C19 encapsulation, C11/C12 rendering** | `pipes-experiment.component.*` / `fixture-sum.pipe.ts`, `encapsulation-experiment.component.ts` / `encapsulation-samples.component.ts`, then `render-experiment.component.*`, `render-probe.component.ts` / `render-measurements.service.ts`. Compare mutation/new reference, Emulated/ShadowDom/None and render-callback measurement/cleanup. These complete the **seven component experiments**, not every performance or Material lesson. |
| **D01–D05; bounded D06 slice** | `features/labs/di/di-experiment.ts` → `scope-probe.component.ts` → `di-lab.component.*`: value/factory/existing/class/multi providers, alias versus separate identity, view/content resolution flags, owned environment injectors, context loss after `await`, and cleanup. D06 uses `provideEnvironmentInitializer` to start a **150 ms** local configuration fixture with a **600 ms deadline** and failure UI. This is isolated environment initialization, **not application bootstrap initialization**. |
| **S01–S07; stable S09 comparison** | `features/labs/state/state-experiment.service.ts` → `style-preview.component.ts` → `event-source.component.ts` → `notification-preview.component.ts` → `state-lab.component.*`. Observe equality/mutation, lazy computed memoization/dynamic dependencies, linked selection, effect cleanup/`untracked`, stabilized `toObservable`, one-time `toSignal`, output interop and cleanup. The Eager/OnPush plain external-fixture preview demonstrates explicit notification, **not zoneless**. S09 runs stable RxJS `debounceTime(250)`; experimental `debounced` is not invoked. |
| **S08 / resource comparison** | `features/labs/resources/resource-read.ts` → `resource-readers.ts` → `resource-experiment.component.*` → `resources-lab.component.*`, plus HTTP/mock specs. Four real read implementations share the product contract, but **only the selected variant is constructed and requested**; no concurrent four-way comparison. See the cancellation/identity detail below. |
| **R01–R08/R11; bounded R10/R12 coverage** | `features/labs/routing/routing-lab-session.service.ts` → `routing-lab.routes.ts` → `routing-detail.component.ts` / `routing-pages.component.ts` → `routing-lab.component.*`, plus actual-router tests. Nested lazy children, `canActivate`/`canActivateChild`/`canMatch`/`canDeactivate`, controlled resolver/recovery, validated inputs via global `app.config.ts` `withComponentInputBinding()`, query/fragment/history, titles/bounded events, named outlet and allowlisted matcher run locally without HTTP. Same-route parameter changes demonstrate **default reuse**, not a custom retention cache. R09 preloading measurement remains P11; R12 tests exist, but installed developer-preview view transitions are not invoked. |
| **Core forms comparisons; additional migration/metadata lessons** | `features/labs/forms/forms-lab.model.ts` → `local-availability.service.ts` → `forms-signal.schema.ts` / `forms-reactive-form.ts` → custom controls → the three `forms-*-lab.component.*` pages → `forms-core-lessons.component.*` → `forms-lab.guard.ts`. Compare independent draft owners, cross-field/nested/dynamic rules, blur/async validation, Signal value/checkbox controls versus CVA, disabled/raw values, manual save/failure/reset, typed metadata, compatibility and guarded navigation. Advanced parsing and Material date/time integration remain separate. |

**Learning presentation:** each experiment includes **Concept**, **Try it**, **What Angular does**, **Common mistake** and **Revision question**, plus an observation/test. Component/DI/state/routing/resource exercises use labelled native controls and semantic articles/sections, with explicit busy/error/empty states where relevant; forms use native/custom controls with Material cards/actions/dialogs. This is not a claim that every control is a Material component or that automated accessibility certification ran. Predict before changing a control, inspect the result, then explain the source and its cleanup test.

**Four resource readers:** `HttpClient` + RxJS/`toSignal`, `httpResource`, `rxResource`, and `resource` with an abort-aware promise adapter all read the same product-detail contract. The first, third and fourth reuse `ProductsApiService.get`; httpResource issues the equivalent GET through the configured handler/interceptor pipeline. Component-local policy preserves that pipeline (including the development mock), omits cookies, disables transfer/cache reuse and bounds final responses to **15 seconds**, including interceptor delays. The unchanged session policy attaches no bearer to these public reads. Construction is idle; Load starts the selected reader, a new ID replaces old work, same-ID reload suppresses overlap, and only validated same-ID data can appear as stale/reloading content. Empty completion is not a successful empty product.

`httpResource` uses one resource instance for reactive ID changes. Its request callback reads the selected ID; `parseProductDetail` validates response shape without reading a newer selection during parsing. The public projection checks loading before value access, uses `hasValue()`, and validates identity before publication. An identity mismatch is a **projected UI error**, not the underlying resource's raw error signal. **Clear explicitly destroys and recreates an idle resource**: installed Angular 22.1.7 can return early for undefined parameters before aborting the previous loader. `abortableRead` releases both its HTTP subscription and abort listener and rejects already-aborted work without starting a request. No resource loader writes data.

**Independent forms:** Signal and Reactive labs use equivalent pure draft rules and separate owners, not synchronized writable models. They include nullable numeric values, conditional calendar-date ordering, bounded notes, dynamic annotations, disabled references, custom stock controls and a Signal checkbox control. `LocalAvailabilityService` is component-local and controlled by completion/failure buttons, not an HTTP uniqueness endpoint. Typed title changes commit on blur and replace old checks. Signal Forms `validateAsync` deliberately supplies a **defined idle request with `of(true)`** when validation params disappear, cancelling the old stream on invalid/reset rather than relying on the undefined-params path. Reactive Forms uses `updateOn: 'blur'`, explicit buffered-title handling and status/value observation.

Save remains blocked for invalid/pending/busy forms; a manual **Complete success / Fail response** simulator sends **no HTTP writes**. Failure preserves the draft for explicit retry; success/reset clears the appropriate values, dynamic controls and submission/dirty state. The Signal submit/review path touches the buffered title itself before the root: **root touch alone does not flush a child's pending title on Enter**. `FormsLabGuard` is wired on all three forms entry routes; stay/discard preserves or intentionally abandons the draft, busy saves block departure, and browser unload warnings remain best-effort. The template-driven preference form is a small independent `ngModel`/`NgForm` exercise, not M08 settings or persistence.

The extra `forms-core-lessons.component.*` on `/labs/forms-signal` uses **trusted typed metadata**, `createMetadataKey`, `hidden`, `readonly`, `applyWhen` and a field-targeted simulated server error returned by `submit`. Editing clears that field error. Its top-down `compatForm` lesson retains the Reactive control owner; bottom-up `SignalFormControl` binds its field tree without competing directives. `NonNullableFormBuilder` demonstrates `patchValue`, `setValue` and reset. These are separate local fixtures, not a second owner for the main comparison draft or an API-JSON template compiler.

**Explicit awareness / advanced limits:** D07 `injectAsync` is **public and stable in the installed API**, but remains blueprint awareness-only with no runtime invocation in this delivery. S09 `debounced` is experimental and uncalled; advanced dependent/streaming resource helpers remain separate. D06 does not implement an application-bootstrap initializer. R09 preloading/download measurements remain **P11**; no global preload policy, custom retention cache or view-transition invocation was added. Installed view transitions remain developer preview. Advanced `transformedValue` and **P10 Material datepicker/adapter/timepicker** work are separate from native calendar-date fields. The existing Eager root and Zone.js remain; P12/P13 own zoneless/SSR. **M08 settings/P09/P14 is explicitly deferred to settings/P14**: toolbar theme still lasts only until reload; no theme persistence, locale preview or global reset UI is delivered. Optional session refresh stays deferred. Do not tick full foundations, all routing or the whole forms curriculum from this core slice.

**Revision questions:** Why can an outlet callback differ from an output binding? What destroys a replaced widget or injector? Why does an injection context not survive `await`? Which event makes an OnPush view eligible? Why validate identity outside httpResource parsing, and why can the UI error differ from `ref.error()`? Why must Clear destroy the resource on this installed patch? Why use a defined idle validator result? What does touching the title do that touching the root does not? Which form owns each compatibility value? Why is default route reuse not a cache, and why are local preference controls not saved settings?

#### P09 verification — supplied checkpoint

**Historical checkpoint:** the results and edit-boundary statements below describe the earlier status edit, before final source fixes and verification. They are retained unchanged; the [2026-09-28 final record](#p09-verification--final) supersedes their pending-work and resource-spec diagnostic status.

**Supplied main-pass results before this edit:** **1611/1611 ChromeHeadless tests SUCCESS (12.938 s total; 12.485 s execution)**; production and mock builds passed. Production initial output is **636.51 kB (636,509 B)**, **32,484 B above P08's 604,025 B**. The **500 kB warning / 1 MB error** and **4 kB warning / 8 kB error component-style budgets** are unchanged. The initial-size regression remains open, not hidden by budget changes. This scoped edit does not run tests or builds; the main pass owns final post-edit application runs.

**Supplied production artifacts:** **534 inputs and 69 emitted scripts**, with no mock/test-source or implementation-marker matches. **Zero `features/labs/` inputs in the initial graph** confirms the lazy boundary, not zero initial cost: shared Angular Forms contributes **71,121 B**, core resource code **8,802 B** to that graph. These totals are not exact per-feature attribution of the **32,484 B** whole-build increase. No production exclusion claim applies to deployment of the mock build; it remains development-only.

**Research and diagnostics:** the main pass successfully called Angular MCP **`list_projects` and `get_best_practices`**, used v22 guidance and checked installed declarations against live **22.2** docs. Installed **22.1.7** contracts govern runtime choices. This editing session has no Angular MCP tools exposed and claims no fresh calls. Latest supplied editor diagnostics include **88 Jasmine-global errors in the new `features/labs/resources/resource-read.spec.ts`**, despite the passing suite; main app-component errors cleared. Do not claim all editor diagnostics are clean. Legacy builder deprecations remain; no suppression, package or runner change is part of this edit.

**Browser work in progress, not final sign-off:** supplied initial observations cover success/reload/404/Clear for all four resource readers with no live errors observed in that resource journey. Signal and Reactive forms each exercised failed save with draft retained → retry → success → reset, plus dirty-guard Escape/Stay and retained focus. The first dialog Escape attempt needed a timing retry; sidebar Escape hides navigation under existing behavior and was not fixed. These are limited observations, not full route, mobile, theme, keyboard, pixel-scroll, axe, screen-reader or E2E certification. The main pass will append final browser evidence and final runs after this edit; no completed browser block or server shutdown is invented here.

**Edit boundary:** only `README.md`, this blueprint, `features/dashboard/dashboard.component.html` / `.spec.ts`, and `core/learning/learning-modules.ts` are changed. Dashboard retains all six test cases, existing hero links, P08 widget initialization/HTTP claims and unrelated behavior. P00–P08 historical records/metrics remain unchanged. **Next: P10 Material/CDK; settings/P14 and explicit advanced/awareness work stay deferred.**

**Scoped status-edit validation:** 81 local Markdown links/anchors passed, all five edited files passed trailing-whitespace/final-newline/BOM checks, and all six dashboard test cases remain (not rerun). Scoped editor diagnostics were clean; this does not clear the resource-spec Jasmine diagnostics reported above. Read-only comparison confirmed the entire historical P00–P08 blueprint block and 12 README verification paragraphs unchanged. Scoped `git diff --check` passed; the separate file scan also covers untracked files that Git's tracked diff omits. No application test/build or browser run was performed by this edit.

#### P09 verification — final

**Final verification date: 2026-09-28.** Implementation revision **1.11 / 2026-09-27** is retained. P09 core is delivered and verified within the limits below; **P10 Material/CDK is next**. These are supplied final main-pass application results, not fresh tests/builds/browser runs by this two-document closeout. The preceding checkpoint remains historical.

**Final application runs:** **1613/1613 ChromeHeadless tests SUCCESS (12.591 s total; 12.163 s execution)**. Production **7.718 s** and mock **3.958 s** builds succeeded after the final source changes. Production initial output is **636.91 kB (636,915 B)**, **32,890 B above P08's 604,025 B**. The **500 kB warning / 1 MB error** and **4 kB warning / 8 kB error component-style budgets** remain unchanged. The initial-size warning remains open; no budget or strictness relaxation hides it.

**Final artifacts and source hygiene:** the final scan covered **534 production inputs and 69 emitted scripts**, with no mock/test paths or markers and **no `features/labs/` inputs in the initial graph**. Lazy lab boundaries do not imply zero shared-framework initial cost; the earlier checkpoint's shared-code totals are not a new final attribution. The mock build is development-only and must not be deployed. All **112 scoped new and modified source files, including untracked files**, passed UTF-8 decoding, no-BOM, final-newline and trailing-whitespace checks. `git diff --check` passed with existing LF/CRLF notices only.

**Final diagnostic scope:** **82 files (78 runtime files + four resource specs)** had no errors; the earlier **88 Jasmine-global errors in `resources/resource-read.spec.ts` cleared**. A further recheck of **seven last-edited files**, including shell/render/routing files, was clean. This is not an all-editor-clean claim: older known diagnostics may remain. Legacy Karma/dev-server deprecations remain. The earlier successful main-pass MCP/research evidence is retained; no fresh MCP or web research is claimed by this closeout.

**Observed mock resource and forms checks:**

- All four resource readers completed **success → Reload → ID 999 not-found → Clear**. The final promise-reader keyboard check explicitly used **Enter Load** and **Space Clear**, returned to idle and restored product-ID focus.
- Signal and Reactive forms each preserved the draft after failure, then completed explicit retry/success and reset. Dirty navigation to Cart focused **Stay** by default; Escape retained the draft, and reset restored title focus.
- The template form exercised empty **Review**, a fictional label, save **Fail response** preserving **Fictional learner**, retry **Complete success**, then reset with `submitted` false. Core metadata exercises covered show/require details, field-targeted rejection and **Reset core lessons**.

**Observed mock framework checks:**

- Components: permission/context exercises and selection through both **ViewContainerRef** and **NgComponentOutlet**; render create/read/destroy with active observer **1 → 0**. The final repeated check verified **four lifetimes, 16 hooks and zero observers** after stabilization. An immediate post-click read saw zero hooks before the settled 16; waiting for stable observations resolved that automation timing issue without an app fix.
- DI: configuration succeeded; alias/original/separate counters were **1 / 1 / 0**, and destroying the owned injector reported **DestroyRef true**.
- State: computed read counts **1 / 2 / 3**, batch behavior, destroy/recreate integration and debounced **Latest local value** were verified.
- Routing: controlled **Notebook 2 → Complete**, help open/close, **All labs** return and revisit **Notebook 1** reset mode to immediate with `h1` focus. Help focus was also verified after the shell correction below.

**Actual fixes and regression evidence:** browser checking found that the shell incorrectly focused `h1` after auxiliary help closed. `layout/shell` now compares the **primary `UrlTree` branch**, ignoring auxiliary outlets, query and fragment while preserving primary matrix parameters. **Two integrated desktop/mobile test cases passed**, alongside the browser help-focus check. Review also corrected index tracking in sliding histories: router entries use unique **ID/type strings**; lifecycle entries use immutable **`{ id, hook }`** identities with a sequence and **16-entry bound**. DOM retention is tested. A temporary offset-based attempt recomputed old keys; stable item identity replaced it before the final passing suite. No manual `detectChanges()` application workaround or root Eager/Zone.js change was made.

**Responsive checks, monitoring and limits:** all eight P09 entry routes were measured at **390 px in light and dark**, with reduced motion emulated: **16 measurements passed**, document and main **client/scroll widths 375/375 px**, without horizontal overflow. Final monitoring across those 16 checks recorded **zero page errors and zero live DummyJSON requests**; the framework pass also recorded zero page errors. These focused observations are **not a full axe, screen-reader, E2E, live-API or pixel-scroll audit**, nor full WCAG certification. No live authentication or mutations were performed. The temporary mock server on **port 4211 was successfully stopped**.

**Completion boundary:** only `README.md` and this blueprint are finalized here, with local documentation validation rather than application reruns. P00–P08 records and the earlier P09 checkpoint remain historical. P09 core verification does not close full C/D/S/R or forms master checklists: D07 awareness, experimental/advanced resources, bootstrap initialization, P11 preloading, preview transitions, custom retention, advanced `transformedValue`, P10 Material date/time/CDK, optional refresh and P12/P13 zoneless/SSR limits remain as recorded. **M08 settings stays deferred to settings/P14**; theme remains session-only, with no saved preferences, locale preview or global mock reset UI.

### P10 / Material and CDK — 2026-09-28

**Delivered and verified within limits:** three lazy routes, `/labs/material`, `/labs/material-dates` and `/labs/cdk`, plus same-column pointer ordering on `/tasks`. Static lab entries precede `:topic` in `features/labs/labs.routes.ts`; existing P04/P08/P09 entries remain. P00–P09 records above retain their historical scope, including claims that P10 was next. The [main-pass evidence below](#p10-verification--main-pass) records final post-newline-fix application results, focused observations and successful hygiene/link/server closeout.

**Ownership and scope:** Material gallery inputs, date/time drafts and CDK fixtures are local throwaway experiments, not saved settings, appointments or API writes. They use the existing Material/CDK dependencies. No new endpoint, environment variable, storage policy, session authorization rule, root Eager/Zone.js migration or SSR integration is introduced. Dashboard widgets still make no HTTP before **Load widgets**; hero links, feature cards and six dashboard test cases are retained. M08 settings/P14 remains a placeholder.

#### P10 source-reading matrix

Paths are relative to `src/app/`; in lab rows, `material/`, `material-dates/` and `cdk/` abbreviate directories under `features/labs/`. Read implementation and colocated specs together. The specs describe intended regression coverage; their presence is not evidence that this editing pass ran them.

| Lesson | Source-reading sequence | Behavior and boundary to inspect |
| --- | --- | --- |
| Lazy entry and learning presentation | `features/labs/labs.routes.ts` → `material/material-lab.component.*` / `material-lesson.component.ts`, `material-dates/material-dates-lab.component.*`, `cdk/cdk-lab.component.*` | Three independent lazy entries; the Material page hosts four experiments, CDK mounts only its selected experiment. Local prediction/mechanism/mistake/revision/observation copy is backed by controls, not just a component list. |
| Material actions | `material/material-actions.component.ts` / `.html` / `.spec.ts` | Menu action selects Notes; tabs switch local panels, button toggles choose mode, a named inline-SVG button controls pin state separately from its tooltip. Disabled choices are inert; reset restores state. No route-tab or icon-font request is implied. |
| Material choices | `material/material-choices.component.ts` / `.html` / `.spec.ts` | Allowlisted local autocomplete, selection chips, slider and slide toggle use independent typed Reactive `FormControl`s through CVAs. One-time `toSignal` views observe values without a competing writable draft. Reset closes autocomplete, enables controls and clears validation display. |
| Display, hierarchy and feedback | `material/material-display-feedback.component.*` → `material-action-sheet.component.ts` → `material-overlays.spec.ts` | Badge mirrors visible completed count, manual progress, responsive grid-list, expansion panel, tree `childrenAccessor`/`expansionKey`/`isExpandable` and stable IDs. Typed bottom-sheet choose/cancel results; important notice remains inline after snackbar dismissal. Only owned references close on reset/destruction; late dismissal cannot overwrite reset or close another feature's overlay. |
| Complete local table | `material/material-table.component.ts` / `.html` / `.spec.ts` | Fifteen fictional rows in `MatTableDataSource<Reading>`; signal queries attach `MatSort` and `MatPaginator`. Numeric sorting, allowlisted columns, filtering before paging, 5/10 page sizes, clear versus reset, one inline sort announcement and owner disconnection. Never reuse this client-side paging as a remote-page total. |
| Signal date versus Reactive range/time | `material-dates/material-dates-values.ts` → `material-single-date-control.component.ts` → `material-dates-lab.component.ts` / `.html` / `.spec.ts` | Scoped native adapter/en-GB, schema-owned `singleDate` with a CVA-only validation bridge; a separate nullable typed `FormGroup` owns range/time. Parse/min/max/order errors, raw-text reset, disabled/touched state and local calendar/wall-clock diagnostics. See installed integration limitations below. |
| Owned overlay and portal | `cdk/overlay-experiment.component.ts` / `.html` / `.spec.ts` → `cdk-lab.component.spec.ts` | `Overlay.create`, centered global positioning, `scrollStrategies.block()`, `TemplatePortal`, cancellable render-time autofocus and `FocusTrapFactory`. Escape/backdrop/Close dispose resources; replacement/destruction does not focus a disappearing opener. |
| Virtual scrolling and selection | `cdk/fictional-people.ts` → `virtual-people-experiment.component.ts` / `.html` / `.css` / `.spec.ts` | Complete frozen 1,000-person fictional dataset; fixed 48 px rows/288 px viewport, `*cdkVirtualFor`, buffers, zero template cache, stable IDs and `SelectionModel<string>`. End-exclusive range and independently observed attached DOM count are distinct from total data and selected IDs. |
| Local CDK utilities | `cdk/public-product-link.ts` / `.spec.ts` → `utilities-experiment.component.ts` / `.html` / `.spec.ts` → `announcement-lifetime.spec.ts` | Local `Dir`/`Directionality`, `FocusMonitor.monitor`/`focusVia`/`stopMonitoring`, component-provided `LiveAnnouncer`, explicit Clipboard copy with allowlisted origin/path, bounded scratch textarea autosizing and teardown-owned `BreakpointObserver`. No root direction/settings change. |
| Task pointer ordering | `features/tasks/tasks.component.ts` / `.html` → `task-board.service.ts` → their `.spec.ts` files | Typed `CdkDragDrop<readonly TaskRow[], readonly TaskRow[], TaskRow>`, captured row/board identity and same-container checks before `moveToIndex(id, targetIndex, expectedRows)`. Native Move up/down remains. Reordering is local; completion still uses the existing cap-10 `concatMap` PATCH queue. |
| Overview status | `core/learning/learning-modules.ts` → `features/dashboard/dashboard.component.html` / `.spec.ts` | M07/M09 describe only delivered mechanisms; P11 is next, settings remains planned. Six retained cases cover feature links, idle widgets and no-initial-HTTP assertions in the final post-dashboard-source suite. |

#### P10 behavior and limitations

**Material gallery:** the menu, tabs and toggles have separate local state. Autocomplete suggestions do not validate arbitrary free text: only exact allowlisted subjects enter the preview. The table caps filter text at 80 characters, trims case-insensitively and filters all 15 rows; filtering and sorting return to page one. Clearing only the filter preserves sort/page size; clearing a sort restores original ID order; full reset restores ID ascending and five rows per page. The tree uses public accessors rather than `TreeControl`. Progress advances manually, never from a network request. The persistent snackbar is dismissible but the important notice remains inline; a bottom-sheet cancellation keeps the subject. Neither feedback mechanism is storage or server error handling.

**Date adapter and independent owners:** installed Material/CDK 22.1.8 source confirms the stable timepicker API and is authoritative for its CVA/native-parser behavior. `provideNativeDateAdapter()` and `MAT_DATE_LOCALE: 'en-GB'` are component-scoped. They do not set app locale or persist settings. Fixture A's private `Date | null` model owns Signal Forms `singleDate`; Fixture B's independent `FormGroup` has nullable `start`, `end` and `time` controls. They do not synchronize. Single/range dates allow **10–25 September 2026 inclusive**; time allows **09:00–17:00 inclusive** with `interval="30m"` options. Empty/partial ranges are valid in this optional scratch fixture; both endpoints are revalidated when either changes, rejecting reversed ranges when both exist.

**Installed date bridge limitation:** Material's date CVA can skip reformatting unchanged null and fail to notify a direct Signal Forms bridge when malformed text again produces null. `MaterialSingleDateControlComponent` therefore implements **`ControlValueAccessor` and `Validator` only**, not `FormValueControl`. Its internal Reactive control forwards validation events (including same-null parse errors), while programmatic writes do not echo `onChange`. Signal `minDate`/`maxDate` metadata flows through wrapper inputs; accepted values normalize to local calendar days. This is a deliberate control boundary, not two competing owners of the same page draft.

**Parsing/reset semantics:** en-GB is display configuration, **not strict day/month/year parsing**. Native typed dates use permissive JavaScript parsing; even formatted text need not round-trip. Native time parsing is permissive too; **30-minute options do not enforce typed-time granularity** (`10:15` is within bounds). Prefer calendar/options; a production workflow needs explicit strict parser/domain/timezone policy. Reset closes popups, enables controls and clears values/dirty/touched state. Same-null range text is cleared through public Material value setters; time reset also clears native text with `Renderer2` because focused/unchanged-null formatting can be skipped. Observations use local date and hours/minutes getters, never UTC slicing; a time's carrier date is ignored. Material's real today highlight/native time carrier is not an appointment or a changed fixture bound. There is no save, persistence, timezone combination or unsaved-settings guard on this scratch route.

**Overlay lifetime:** the CDK example is a centered modal mechanism exercise, not a replacement for Material Dialog or a connected popover. It blocks background scroll and traps Tab focus after a cancellable `afterNextRender`. Escape ignores composing input; Escape/backdrop/Close release event subscriptions, trap and overlay. Opener focus returns only when still connected and the overlay owns focus (or focus fell to the body). Reopening cancels old autofocus; experiment replacement/destruction disposes without stealing the next view's focus.

**Virtual list:** all 1,000 people already exist locally, independent of `/users` and its remote pages. Fixed-height offsets require 48 px rows; the viewport is 288 px plus buffers. `SelectionModel<string>` retains stable IDs outside virtual views and publishes readonly snapshots. Jump buttons remain mounted/focused; reset clears selection without resetting scroll. The live range is end-exclusive, while a post-render read counts actual attached rows. Do not invent a fixed observed DOM count or claim lower downloaded-data cost. Virtualization limits browser find and assistive traversal to rendered content; no custom arrow-key selection contract or complete accessibility certification is implied.

**Utilities:** direction changes remain local to `Dir`; scratch text is capped at 240 characters and autosized. `BreakpointObserver` reports viewport behavior, not persisted preferences. `FocusMonitor` explicitly unregisters its element on teardown, in addition to unsubscribing. The local `LiveAnnouncer` owns its pending announcements; visible copy feedback is not a duplicate live region. Clipboard runs only on a button action and constructs a constant same-origin **`/products/1`** link from an HTTP(S) origin, rejecting credentials, page paths, query and fragment input. It never copies current route/session parameters. A false result or platform exception offers manual copy, without raw error logging; no automatic clipboard write occurs.

**Task drag/drop contract:** columns are unconnected vertical drop lists; handles use pointer gestures, **not built-in CDK keyboard dragging**. Drag requires at least two rows and is disabled while any write or confirmation is active. Start captures the exact row object and readonly board-array reference. Drop requires a started gesture, pointer over the same container, matching item/drop-container/column ID/data and valid previous index. `moveToIndex` then validates the unchanged board snapshot, integer target, row availability and every displaced row before immutable same-column reordering; other-column positions remain untouched. Cross-column, outside, stale, invalid, unstarted and no-op events do not change order. Native Move up/down retains its keyboard/focus behavior and can move unrelated unlocked rows even while other writes are pending; pending rows cannot be displaced. Completion is still an explicit checkbox → existing PATCH queue operation, never a cross-column drop. No position field, storage, HTTP order request or new queue slot is added; explicit reload replaces local order. Existing cap-10 admission, row-only rollback, dirty/busy guards and teardown-after-`concatMap` remain. Client cancellation still does not prove remote rollback.

**Revision prompts:** Why is a local full-dataset table different from a server page? Why can invalid date text coexist with a null model? Why does a half-hour option list not validate typed granularity? Who owns the Signal date and the Reactive range? Why cancel pending overlay autofocus? Why can selected IDs outnumber attached checkboxes? Why explicitly stop focus monitoring? Why reject a stale drag even if IDs match, and why must ordering never masquerade as completion PATCH?

**Still deferred:** advanced resource helpers/streaming, advanced forms/`transformedValue`, D07 async DI awareness (no runtime invocation), full bootstrap-initializer work, preview transitions/custom route retention and optional refresh. R09 preloading/download measurements belong to **P11 quality/performance**; agree on new lint/E2E/a11y tools before installation, never install automatically. **P12 zoneless**, **P13 SSR/hydration** and **settings/P14** remain separate. Local date locale, RTL and choice controls are not settings delivery or persistence.

#### P10 verification — main pass

**Final supplied application results — 2026-09-28, after dashboard source changes and all 45 successful newline-only fixes:** **1706/1706 ChromeHeadless tests SUCCESS (20.514 s total; 19.479 s execution)**; production build **15.249 s PASS**, mock build **6.719 s PASS**. Initial production output is **667,223 B (667.22 kB)**, **30,308 B above P09's 636,915 B**. Budgets remain **500 kB warning / 1 MB error** and component styles **4 kB warning / 8 kB error**. The existing initial-size warning remains open; no budget or strictness was relaxed. This two-document closeout records supplied evidence, without terminal/browser use or application reruns.

**Regenerated final artifacts after the newline fixes:** **588 production inputs and 78 emitted scripts**, with **zero forbidden paths**; path checks excluded `core/mock`, `app/testing`, specs, the mock provider, RxJS testing and Angular testing. All **11 implementation/test-marker checks had zero hits**, and **zero `features/labs/` inputs** appeared in the initial graph. Entry-chunk bytes are unchanged: Material **378,191 B**, dates **152,438 B**, CDK **29,544 B**. These are route-entry chunk sizes, not whole dependency costs or evidence of zero shared-framework initial cost. Never deploy the mock build.

**Research and source/test corrections:** main-pass Angular MCP **`list_projects` and `get_best_practices` succeeded through the local CLI SDK transport**; an agent tool registry is not evidence of server unavailability. Installed source governs stable timepicker behavior and the CVA/native-parser limits above. Source fixes include focused/same-null time reset through `Renderer2`, tree `aria-disabled`, single announcements and durable inline feedback. The textarea boundary test uses host `setInputValue` + dispatched `input` + `sendKeys`: `MatInputHarness.setValue`'s event-free final overwrite had caused a false cap assertion. Opening the timepicker with ArrowDown also advances its key manager; the test expectation was corrected to installed behavior, without an app hack.

**Fresh-page sequential mock browser observations:**

- **Virtual selection:** select person 1 → jump to last/person 1000, displaying **992–1000 with 8 attached DOM rows** → select 1000 → return to first/person 1, still checked with **2 selected IDs**. The displayed end-exclusive range and actual DOM count are separate observations.
- **CDK modal/utilities:** Enter opened the modal; Shift+Tab reached Close, Tab reached Acknowledge, and Escape restored the opener. Local RTL rendered after settling; textarea growth from **2 to 6 lines**, programmatic focus and successful public-link clipboard copy were observed.
- **Material gallery:** menu **Review notes** selected Notes; Detail mode and pin, Comet autocomplete selection, Practice chip, **20-minute** slider and captions off worked. Tree expansion, reading details and manual progress to **100%** worked; important inline notice survived snackbar dismissal. Bottom-sheet Escape restored opener focus. From local-table page two, **Enter on Minutes** sorted with Aurora first; filter **120** showed Eclipse, and reset restored Lunar first.
- **Dates:** Signal calendar selection of **15 September 2026**; Reactive sample and timepicker ArrowDown/Enter/Escape; reset, malformed-time error/reset and single-date disable/reset were observed. This is not browser coverage of every invalid-date combination.
- **Tasks:** an **actual mouse-pointer drag** moved the first OPEN row to third; Enter on Move up moved it to second; Space completion moved it to DONE and updated the session mock. **No-HTTP ordering and reuse of the same completion queue are unit assertions**, not network-inspected mock requests. Stale/invalid drop rejection is unit-tested, not claimed as a browser gesture.

**Responsive monitoring and automation limits:** **12 checks at 390 px, light/dark with reduced motion**, covering gallery, dates, CDK overlay/virtual/utilities and tasks, found no document/main overflow. Per-navigation error, unhandled-rejection and resource observers recorded **zero page errors/unhandled rejections and zero live DummyJSON requests**. Initially two scripts interfered on a shared page; fresh-page sequential repeats passed. An old-tab click-stability timeout also passed on a fresh page. An immediate RTL read needed render stabilization; a fourth progress advance was correctly disabled at 100% from a 25% start. These were automation corrections, not app bugs. Clipboard denial, the full invalid-date matrix and stale task drops are unit coverage, not browser coverage. No axe, screen-reader audit, full E2E, live-API checks or contrast/WCAG certification is claimed.

**Diagnostics and limits:** final scoped editor diagnostics retain **four entry-discovery errors** in `material-lab.component.ts` / `.html` for `MaterialDisplayFeedbackComponent` and `cdk-lab.component.ts` / `.html` for `UtilitiesExperimentComponent`, despite passing AOT/tests. No suppression was added; the existing-workspace command tool could not restart the Angular language service. Legacy builder deprecations remain.

**Final closeout results:**

- **Source hygiene and documentation links:** all **45 newline-only fixes succeeded**, followed by the final application runs above. All **66 scoped P10 files** passed UTF-8 decoding, no-BOM, final-newline and trailing-whitespace checks; **108 local README/blueprint Markdown links/anchors passed**. **`git diff --check` passed**, with LF/CRLF warnings in package files only.
- **Server shutdown:** the temporary mock server on **port 4212 was successfully terminated by the kill tool**. Read-only `Get-NetTCPConnection` confirmed **no listener**.

**Completion boundary:** P10 implementation, verification and administrative closeout are complete within the recorded limits. **Next is P11 quality/performance**, not settings or advanced tracks. P00–P09 history remains unchanged.

### P11 / Quality and performance — 2026-09-28

**Historical P11 scope (revisions 1.13–1.14):** all implementation/verification metrics and then-next claims below, through the post-documentation closeout, remain historical. This includes the matrix's runtime-Zone retention, 66-helper/36-browser counts and statements calling P12 deferred. P12 supersedes those current-state claims, not their historical evidence; Eager remains deliberately retained.

**Current revision 1.14:** the [completed P11 full follow-up](#p11-full-follow-up--2026-09-28) adds animation, profiling and fill-image lessons, expanded keyboard/browser coverage and measured shell improvements to the v1.13 baseline, with final verification gates satisfied within limits. The matrix below maps current sources; baseline measurement/verification subsections are explicitly historical. Dashboard HTTP still requires **Load widgets**; root Eager/Zone.js, data ownership and session policy remain unchanged. P00–P10 above remain verbatim history; this is not full-curriculum completion.

#### P11 source-reading matrix

Application paths below are relative to `src/app/`; tooling/E2E paths are relative to the repository root. Read implementation with its specs, predict download versus construction, then compare the observation. Test counts describe coverage, not a fresh passing run by this edit.

| Learning path | Files and boundary |
| --- | --- |
| Selective router preload | `core/routing/performance-preloading.service.ts` / `.spec.ts` → `app.config.ts` `withPreloading`: **10 strategy tests**; selected loading is not preload-all or authorization. |
| Lazy parent and child routes | `features/labs/labs.routes.ts` → `features/labs/performance/performance.routes.ts` / `.spec.ts` → `preload-lesson.component.ts` / `demand-lesson.component.ts`: candidate download after entering the parent is distinct from child activation. |
| Main defer experiment | `features/labs/performance/performance-lab.component.ts` / `.html` / `.css` / `.spec.ts`: labelled trigger/observations, deferred states, reserved layout and explicit unmount; focus can prefetch without rendering. |
| Summary and payload lifetime | `deferred-summary.component.ts` / `.html` / `.css` → `payload-lifetime.service.ts` / `.spec.ts` in the same performance folder: construction/destruction counters differ from module download/cache lifetime; revisit resets component-owned counters. |
| Measurements and deterministic coverage | `features/labs/performance/performance-measurements.ts` / `.spec.ts`, with lab/route/lifetime specs: **36 tests at the historical v1.13 baseline**, before the new lessons; inspect observer cleanup and sample limits. |
| CSS animation and reduced motion — 7 files | [Lesson TS](src/app/features/labs/performance/animation-lesson.component.ts), [HTML](src/app/features/labs/performance/animation-lesson.component.html), [CSS](src/app/features/labs/performance/animation-lesson.component.css), [spec](src/app/features/labs/performance/animation-lesson.component.spec.ts) → [card](src/app/features/labs/performance/animation-card.component.ts) → [lifetime service](src/app/features/labs/performance/animation-lifetime.service.ts) / [spec](src/app/features/labs/performance/animation-lifetime.service.spec.ts): 240/600 ms enter/leave, destruction versus retained DOM, bounded re-entry and zero-duration reduced-motion override. |
| Pure method versus computed profiling — 6 files | [Calculator](src/app/features/labs/performance/profiling-calculator.service.ts) / [spec](src/app/features/labs/performance/profiling-calculator.service.spec.ts) → [lesson TS](src/app/features/labs/performance/profiling-lesson.component.ts), [HTML/procedures](src/app/features/labs/performance/profiling-lesson.component.html), [CSS](src/app/features/labs/performance/profiling-lesson.component.css), [spec](src/app/features/labs/performance/profiling-lesson.component.spec.ts): 12 × 4,000 rounds, immutable weight update, stable DOM reversal, scoped injector and extension/browser procedures; actual Chrome trace evidence below is distinct from extension GUI use. |
| Local fill image — 4 files | [Lesson TS](src/app/features/labs/performance/image-lesson.component.ts), [HTML](src/app/features/labs/performance/image-lesson.component.html), [CSS](src/app/features/labs/performance/image-lesson.component.css), [spec](src/app/features/labs/performance/image-lesson.component.spec.ts): nonpriority local SVG in a reserved 16:9 positioned frame; contain/cover, failure/restore and responsive sizes, not CDN resizing. |
| Shell cost and startup layout | [Shell TS](src/app/layout/shell.component.ts), [HTML](src/app/layout/shell.component.html), [CSS](src/app/layout/shell.component.css), [spec](src/app/layout/shell.component.spec.ts): native nav/actions, stale openedChange guard, explicit responsive public-host margin and growable minimum content height; Material drawer/toolbar and Eager root/Zone retained. |
| Production artifact audit | `tools/quality/bundle-audit.mjs` / `bundle-audit.spec.mjs`: native Node coverage totals **66 tests**; inspect graph/exclusion checks and raw/gzip estimates, not network claims. |
| Production browser samples | `tools/quality/measure-browser.mjs`: built production artifacts only, installed Chrome, default **two profiles**, fresh contexts, ephemeral loopback server and owned browser/server cleanup. |
| Correctness configuration | `eslint.config.mjs`, `tsconfig.json`, `tsconfig.e2e.json`, `package.json`: curated TS/HTML/inline-template rules plus strict browser-test checking, not full recommended/type-aware lint or a security audit. |
| Browser isolation and storefront | `playwright.config.ts` → `e2e/fixtures.ts` → `e2e/storefront.spec.ts`: installed Chrome, one worker, managed mock **4213**, no unknown-server reuse, external-request/page-error guards; **6 storefront tests**. |
| Accessibility and image/read checks | `e2e/axe.spec.ts`: **8 tests / 10 scans**, including open timepicker; `e2e/images-and-reads.spec.ts`: **3 tests** for fixed-image priority/fallback and read journeys. |
| Browser performance contract | [Original performance test](e2e/quality/performance.spec.ts): **1 test**; original **6 + 8 + 3 + 1 = 18** baseline tests retained. |
| Expanded real-browser lessons | [Animation/profiling](e2e/quality/animation-and-profiling.spec.ts): **5 tests**, including public `ng.enableProfiling()`/Chrome CDP traces for both modes. [Keyboard](e2e/keyboard.spec.ts): **2 tests**, Tab-only checkout and editor dirty-cancel/focus. [Defer/images](e2e/quality/defer-and-images.spec.ts): **11 tests**, real triggers and held-load/failure/restore geometry at two widths. **18 added → 36 total**, not all 18 blueprint scenarios or full WCAG. |

**Tool decision and installation:** after an explicit question, the user delegated autonomous tool selection before installation. Exact development versions are `angular-eslint` **22.5.0**, `eslint` **10.11.0**, `typescript-eslint` **8.70.1**, `@playwright/test` **1.63.0**, `@axe-core/playwright` **4.13.0** and `@eslint/js` **10.0.1**. The last is currently unused by the configuration and retained; no uninstall or other package change is part of this documentation task. Initial installation used system Node **22.14** and emitted engine warnings; the process PATH was then corrected to project-local **22.23.2**, with no system/global changes. No CI, Prettier, automatic tool/browser installs or Jasmine/Karma migration was added.

**Actual commands:** `npm.cmd run lint`, `npm.cmd run typecheck:e2e`, `npm.cmd run test:quality`, `npm.cmd run e2e`, `npm.cmd run e2e:a11y`; retain `npm.cmd test -- --watch=false --browsers=ChromeHeadless`. For production samples, first `npm.cmd run build -- --stats-json`, then `npm.cmd run audit:bundle` and `npm.cmd run measure:browser`. Playwright's managed **mock port 4213** is separate from the production helper's ephemeral loopback server. **Never deploy mock builds**, reuse an unknown server or incidentally call live APIs/auth. Generated reports remain ignored; these commands are documented, not executed here.

#### P11 measurement and security boundaries

**Historical v1.13 baseline:** bytes, shifts, image coverage and audit results below are retained for comparison, not fresh v1.14 evidence. The [full follow-up](#p11-full-follow-up--2026-09-28) supersedes the measured bytes/startup shifts, adds fill-image/profile coverage and records fresh audits with the unchanged bounded disposition.

**Final production artifacts:** initial output **682,439 B**, versus P10 **667,223 B**, a **15,216 B increase**. Summed gzip-level-9 estimate **192,964 B** is not network transfer. Final checks passed for **598 inputs, 84 JavaScript files and 85 emitted JS/CSS files**, with mock/test-path exclusions and all **seven marker checks passing**. Earlier entry-chunk samples were performance **15,182 B**, summary **2,569 B**, preload candidate **936 B**, demand child **911 B**; these are entry chunks, not whole dependency costs. The existing **500 kB warning / 1 MB error** and **4 kB warning / 8 kB error style** budgets remain unchanged; the initial-size warning is open.

**Measured layout change:** the original **12 rem / 192 px** reserved region allowed downstream movement of **676.8125 px desktop / 753.59375 px narrow**. Minimum reservation **55 rem / 880 px desktop**, **60 rem / 960 px narrow** produced **0 px in both sampled profiles**. These are sample pixel equivalents, not a fixed-height clipping contract: enlarged text may grow the region; no clipping or nested scroller was added. Zero movement of this boundary is not zero document layout shift.

**Final-build production fresh-context/cold sequence — both profiles PASS:** dashboard idle fetched no labs JavaScript. Entering the performance parent downloaded the candidate without activating it. Focusing the summary trigger prefetched with **zero summary instances**; Enter rendered **one**, unmount recorded **one destruction**, and revisit reset local counters. Revisit requested **zero additional JavaScript resources** in the observed sequence; cached modules and component lifetimes are different. This is local request behavior, not a universal cache/network speed claim.

**Latest final-build observer and interaction samples:** lab LCP last-candidate values were **280/212 ms** (desktop/narrow); dashboard was **null/336 ms**, and samples vary. They are observer candidates, **not field LCP**. Automation timings **55.7/45.4 ms** include driver overhead, **not INP**. Document-boot layout-shift sums excluding recent input were **0.263333 desktop / 0.086493 narrow**: an **open boot-shift risk**, not formal session-window CLS and not evidence of a speed improvement.

**Resource timing:** local HTTP is uncompressed with cache disabled, so encoded and decoded body sizes match. Candidate body/transfer **936/1,236 B**, summary **2,569/2,869 B**, demand **911/1,211 B** include the browser-reported **300 B overhead**. These measurements neither validate CDN compression/delivery nor turn gzip estimates into observed network bytes.

**Images and public reads:** the nine-result mock sample has **400×300** product dimensions, **one eager/high-priority image and eight lazy images**, with named alternatives. Static-priority branches recreate images when descending/ascending reordering changes priority; broken-image fallback passed. This is mock dimension/priority/fallback evidence, not real-CDN profiling, responsive `srcset` or `fill` delivery verification.

**Security review supplied by the main pass:** the interceptor adds its own bearer only to exact configured-origin/base-path, query-free **GET `/auth/me`**; unrelated origins are untouched, not stripped of independently supplied headers. Session state stays in memory; no auth changes were made. Public responses are validated/minimally projected and rendered as text; no HTML/sanitization bypass was added. No live API/auth checks were made. Server security headers/CSP are not configured, and preloading is not authorization.

**Dependency audit boundary:** supplied `npm audit --omit=dev` result was **0**; the full audit still reports **5 moderate** findings in the existing **Webpack → SockJS → uuid 8.3.2** development chain, **GHSA-w5hq-g745-h8pq**. The advisory concerns v3/v5/v6 caller-buffer behavior; installed SockJS uses `require('uuid').v4()` with no arguments, with no affected call identified in that reviewed path. This is **not fixed and not a clean audit**. Do not force upgrades or migrate builders to conceal it. Application runtime does not depend on uuid; mock tokens use native crypto. This bounded review is not a security certification.

#### P11 core acceptance map

Numbers refer to section 17. Paths below are actual files, not proposed test locations. The supplied full follow-up runs passed, but unit assertions and focused browser samples retain their own scope: **36 Playwright tests do not mean all 18 blueprint scenarios or every action by keyboard**.

| Scenarios | Evidence to read and remaining boundary |
| --- | --- |
| **1–4** query/latest/error/paging | `src/app/features/products/catalogue/product-catalogue.component.spec.ts`; read its HTTP-backed cancellation/recovery assertions, not parser tests as a substitute for search behavior. |
| **5–6** CRUD/remote honesty | `src/app/features/products/editor/product-editor.component.spec.ts`, `src/app/core/mock/mock-product-backend.service.spec.ts`; mock CRUD versus simulated remote notices, no live remote mutation claim. |
| **7** cart consistency | `src/app/features/cart/data/cart.service.spec.ts`; single owner, immutable snapshots and quantity/money boundaries. |
| **8** submission concurrency | `src/app/features/checkout/checkout.component.spec.ts`; explicit duplicate gate and draft/cart retention, not an invented checkout `exhaustMap`. |
| **9** safe navigation | Product editor spec above, `src/app/features/tasks/tasks.component.spec.ts` and checkout spec; dirty/busy guards and cancellation. |
| **10** auth boundary | `src/app/core/session/session-auth.interceptor.spec.ts` and `session.guard.spec.ts`; exact endpoint/HttpParams exclusions and safe return paths. |
| **11** cleanup | `src/app/features/tasks/task-board.service.spec.ts`, `src/app/features/dashboard/dashboard-widgets.component.spec.ts`, performance lab/lifetime/animation specs and [real-motion browser checks](e2e/quality/animation-and-profiling.spec.ts); active-inner teardown and component destruction versus leaving DOM, not only synthetic navigation. |
| **12** independent errors | `src/app/features/dashboard/widget-composition.spec.ts` and `dashboard-widgets.component.spec.ts`; partial failure/retry and composition remain HTTP/unit evidence. |
| **13** forms equivalence | `src/app/features/labs/forms/forms-signal-lab.component.spec.ts`, `forms-reactive-lab.component.spec.ts`, `forms-validation.spec.ts` and `forms-controls.spec.ts`; equivalent rules with independent owners. |
| **14** keyboard operation | [Tab-only journeys](e2e/keyboard.spec.ts), `e2e/storefront.spec.ts` and animation keyboard/focus checks; browse/add/login/checkout/receipt and editor dirty-cancel retain focused scope, **not all-keyboard or screen-reader certification**. |
| **15** theme consistency | `e2e/axe.spec.ts`: sampled light/dark views and overlays, including open timepicker; no universal contrast/theme certification. |
| **16–17** rendering/offline | SSR/hydration remains **P13**; PWA/offline remains a separate deferred track. Neither is accepted from CSR/mock tests. |
| **18** strictness | `src/app/core/http/read-parsers.spec.ts`, domain parser specs, strict TypeScript/template configuration and passing final AOT builds; malformed runtime data differs from compile-time exhaustiveness. |

#### P11 verification — final

**Historical v1.13 baseline and config/unit follow-up only.** Its completed hygiene and then-undelivered animation/profiler limits are not current full-P11 status. See the [v1.14 full follow-up](#p11-full-follow-up--2026-09-28) for supplied final results and completed gates within limits.

**Supplied final current-source results — 2026-09-28:** lint and `typecheck:e2e` passed; **66/66 native Node quality tests passed**; **1752/1752 Jasmine/ChromeHeadless tests SUCCESS (27.992 s total; 26.444 s execution)**. The deliberate chunk-unavailable error case still emits an expected Angular `ERROR` diagnostic, while public navigation-hook assertions pass; the previous `ErrorHandler` spy was corrected. Production **16.550 s PASS**, latest mock **12.059 s PASS**, with application logic unchanged afterward. Final production checks passed for **598 inputs, 84 JavaScript files and 85 emitted JS/CSS files**, all mock/test-path exclusions and **seven marker checks**. Bundle budgets and the open initial-size warning remain unchanged.

**Final browser results:** **18/18 Playwright tests passed in 1.1 minutes with no retries**: **six storefront + three image/read + one defer + eight axe**. The **10 axe scans**, including the open timepicker, found **zero violations**, with `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa` and **no suppressions**. Profiles were **1280×900 desktop/light** and **390×844 narrow/dark**, both with reduced motion. Mock-only safety fixtures asserted **zero external requests and page errors**. Earlier targeted CDK checks passed **five consecutive repeats** after geometry synchronization; no application CDK change was needed. This is neither E2E coverage of all 18 blueprint scenarios nor every action exercised by keyboard.

**Production measurement and risk disposition:** both fresh/cold profiles passed after the final production build; download/prefetch/construction/destruction/revisit behavior and latest numeric samples are in the [measurement record](#p11-measurement-and-security-boundaries). The initial-size warning and boot-shift risk remain open. Runtime audit **0** does not erase the full audit's **five moderate development-chain findings**, retained with a bounded risk disposition, not fixed.

**Research, diagnostics and server cleanup:** Angular MCP `list_projects` and `get_best_practices` actually succeeded earlier in P11 through the local CLI SDK transport; no fresh call is claimed here. Final scoped editor checks were clean for new files; **older Angular entry-discovery errors remain**, not an all-workspace-clean result. The owned **port-4214 debug server was stopped**; read-only checks found **no listeners on 4213/4214**.

**Hygiene and curriculum limits:** nine EOF fixes plus a README blank-line fix followed the runs, **formatting only, no application-logic change**. Final closeout checked 42 scoped files and 124 local documentation links. Git whitespace validation is recorded below. The final config/unit-test follow-up and checks are recorded below; application runtime code remains unchanged. Completion means the core P11 baseline within these limits, not CI, full CSS `animate.enter`/`animate.leave`, Angular DevTools profiling, field Web Vitals or full accessibility certification. Settings/P14, advanced resources/forms/`transformedValue`, async DI awareness, optional refresh, P12 zoneless and P13 SSR remain separate. No automatic next work follows this record.

**Final closeout follow-up:** base `tsconfig.json` now includes only `src/**/*.ts`; strictness and `rootDir` are unchanged, and the six E2E/config files are independently discovered by `tsconfig.e2e.json`. Its five new root-directory diagnostics cleared. A subsequent full run exposed the existing CDK real-layout test reading a 480 px spacer before the 48,000 px extent was applied. The test now waits for bounded actual spacer/row geometry, not a range notification; no CDK application code changed. Its four tests passed **three consecutive runs**, followed by **1752/1752 SUCCESS (24.051 s total; 23.197 s execution)**. Lint and E2E typechecking passed; production rebuilt in **25.377 s** and its artifact audit passed with the same byte totals. Earlier 66-test helper, 18-test browser/axe and two-profile measurement evidence above retains its recorded scope; those checks were not rerun for this config/unit-test-only follow-up. Final documentation/whitespace checks cover **42 scoped files and 124 local links/anchors**; `git diff --check` passes with package LF/CRLF notices only. Older Angular editor entry-discovery diagnostics remain despite passing AOT/tests; no suppression or all-editor-clean claim. Settings and advanced tracks remain deferred.

Final P11 verification and administrative closeout are complete within the recorded limits.

### P11 full follow-up — 2026-09-28

**Revision 1.14 supersedes the v1.13 baseline as current status. Full P11 implementation and final main-pass verification gates are complete within the limits below.** The [source matrix](#p11-source-reading-matrix) links the seven animation, six profiling and four image files and matching tests. Settings/M08/P14, advanced resources/forms/`transformedValue`, async DI awareness, optional refresh, P12 zoneless and P13 SSR remain explicitly deferred. There is no automatic next work.

**Lesson contracts:** CSS `animate.enter` is **240 ms**, `animate.leave` **600 ms**. `DestroyRef` teardown can precede DOM removal; re-entry is blocked while the previous host leaves, without queueing another card. Reduced motion uses no animation and **zero animation/transition durations with `!important`** to override the global duration rule and avoid waiting for a nonexistent completion event. Profiling compares identical **12-sample × 4,000-round** pure work: an intentionally expensive template method versus `computed`, unrelated note updates, immutable weight replacement and stable-ID DOM reversal. The method is a lab-only anti-pattern, not recommended application code. Component/injector/profiler extension procedures and browser Performance procedures are delivered; **no extension GUI was installed or exercised and no speedup is claimed**.

**Image contract:** nonpriority `NgOptimizedImage fill` uses a local 4:3 SVG in a positioned, reserved **16:9** frame, contain/cover, a real missing-local-image request, named fallback and fresh-image restore. Responsive **`sizes="(max-width: 600px) 80vw, 40vw"`** is accepted by installed Angular; the earlier `512px` sizes hint was rejected. Geometry is checked through load/failure/restore at desktop and 390 px. There is no resizing CDN/generated responsive variant or claimed byte reduction from sizes alone.

**Supplied final-source main-pass evidence (not rerun by this status edit):**

| Check | Full follow-up result and scope |
| --- | --- |
| Lint / strict E2E types | **Both PASS** |
| Jasmine/ChromeHeadless | **1777/1777 SUCCESS**, **15.699 s total / 15.107 s execution** |
| Playwright | **36/36 PASS, 1.7 minutes, no retries/skips**: original 18 + animation/profiling 5 + keyboard 2 + defer/images 11 |
| Axe | Original **8 tests / 10 scans, zero violations**, included in the 36; not all WCAG or every action by keyboard |
| Actual Angular profiling | Public **`ng.enableProfiling()`** and Chrome CDP traces captured **both method and computed modes**; main-pass embedded-report inspection confirmed real Angular track timestamps and the named component template listener, detailed below |
| Mock build | **5.632 s PASS**, separate **`dist/angular-22-mock` — never deploy** |
| Production build | **6.135 s PASS**, **544,214 B initial**, **167,248 B summed gzip-level-9 estimate** |
| Production artifact audit | **PASS: 606 inputs, 86 JavaScript files, 87 emitted JS/CSS files**, no forbidden paths or hits across **seven marker checks** |
| Quality helpers | **66/66 PASS, 247.6693 ms** |

**Trace evidence:** inspection of the ZIP embedded in `playwright-report/index.html` found **1,128 total `TimeStamp` entries in each mode**, including the actual **`🅰️ Angular`** track and named **`ProfilingLessonComponent` template button listener**. These are real trace entries, not incidental URL matches or synthetic measures. The totals are **not component-cycle counts**, and no speedup is claimed. Report attachments may be embedded in that HTML ZIP without a `data` folder; generated reports remain ignored. This does not substitute for hands-on extension-GUI evidence.

**Measured initial-cost reduction:** versus v1.13 **682,439 / 192,964 B raw/gzip**, final initial raw output is **138,225 B smaller (~20.25%)**. Final status copy adds **116 B** over the superseded intermediate build. Native nav/action controls replace eager `MatNavList`/`MatButton` use, retaining visible keyboard focus and at least **44 px** targets. Material drawer/toolbar, Eager root and Zone.js remain; this is not an incidental change-detection or shell-framework migration. Budgets are unchanged: **500 kB warning / 1 MB error**, styles **4/8 kB**. The remaining **44,214 B over-warning is an explicit limitation**, not hidden by raising limits. Entry chunks remain performance **42,832 B** (prior **15,182 B**), deferred summary **2,568 B**, demand **908 B**, preloaded **933 B**, labs **2,711 B**. Entry bytes are not whole-route dependency cost; gzip estimates are not network transfer.

**Fresh production profiles after the final build — both PASS:** Chrome **154.0.8037.57**, local Node **22.23.2**, **1280×900 light / 390×844 dark**. All lifetime, preloading and defer boundary assertions passed, with **0 px downstream movement** and **0 repeat JavaScript requests**. Dashboard and lab startup/final observed layout-shift sums were **0 in both**, versus prior **0.263333 / 0.086493**. Attribution identified the **256 px `MatSidenavContent` startup margin and footer movement**. Explicit responsive margin on the public host and minimum content height keep the footer below the first viewport without preventing content growth. A separate guard rejects stale asynchronous `openedChange` notifications that could reopen the drawer. Dashboard LCP candidates were **null/176 ms**, lab **188/204 ms**. These local samples are not field Web Vitals, formal session-window CLS, INP or a universal zero-shift promise.

**Fresh security audits and bounded disposition:** runtime audit **0**; full audit **5 moderate findings unchanged** in the existing **Webpack → SockJS → uuid 8.3.2** development chain. The prior reviewed disposition remains: SockJS uses no-argument `v4()`, with no affected caller-buffer call identified in that path. Findings are **not fixed**, the full audit is not clean, and this bounded review is not a security certification. No dependencies changed in the full follow-up; no forced upgrade or builder migration conceals the findings.

**Completed hygiene and cleanup gates:** before this documentation edit, **153 local Markdown links/anchors**, **9 JSON configurations** and **50 scoped files' UTF-8/no-BOM/final-newline/trailing-whitespace checks PASS** were recorded. **`git diff --check` PASS**, with package LF/CRLF warnings only; **no listeners on 4213/4214**. These supplied checks predate this edit and are not claimed as post-edit validation.

**Research and completion limits:** main-pass MCP **`list_projects`/`get_best_practices` actually succeeded in this request through the official local SDK transport**, and official animation/profiling/image documentation was checked. This two-document closeout uses no terminal and claims no fresh MCP/research or application runs. Older Angular language-service entry-discovery diagnostics remain despite passing AOT/tests, as do legacy Karma/dev-server deprecations; no all-editor-clean claim. Manual extension GUI use was unavailable/unexercised. No field Web Vitals, full WCAG/security certification, CI, Prettier or live API/auth checks are implied. These caveats, the size warning and five audit findings are explicit limitations, **not unfinished P11 implementation gates**. Full P11 implementation and verification are complete within this scope; deferred settings/advanced/P12–P14 work does not start automatically.

**Post-documentation closeout:** lint and strict E2E types passed again; all **5 animation/profiling browser tests passed (28.0 s)** after tightening the trace assertion to genuine Angular-track timestamps. Final checks passed for **54 scoped files, 155 local links/anchors, 9 JSON configurations and `git diff --check`**; no owned test-port listeners remained. Application source and production artifacts were unchanged after the full runs above.

### P12 / Zoneless migration — 2026-09-29

**Implemented and verified within limits — revision 1.15 / 2026-09-29.** This is the authorized runtime migration, not an incidental P11 optimization or completion of the whole curriculum. `app.config.ts` explicitly selects stable `provideZonelessChangeDetection()`; `angular.json` build polyfills are `[]`, with no Zone.js in the runtime configuration. The root deliberately keeps `ChangeDetectionStrategy.Eager`: **checking strategy and scheduling are independent**. Signals read by templates, `AsyncPipe` and intentional `markForCheck` boundaries notify Angular; `NgZone.run`/`runOutsideAngular` may remain for compatibility but are not zoneless notifications.

**Test-only Zone exception:** package metadata and lockfile both record Zone.js **0.15.1** as dev-only with the same **`~0.15.0` range**, not an upgrade. Karma retains `zone.js` and `zone.js/testing` for existing `fakeAsync` clocks and explicit Zone compatibility suites. **The legacy unit suite is not globally migrated.** New notification regressions explicitly enable zoneless and await `whenStable()` after callback delivery without forcing `detectChanges()`. Browser no-Zone assertions and production artifact exclusions independently guard runtime builds.

#### P12 source and test map

| Read together | Implemented contract and test boundary |
| --- | --- |
| [Application providers](src/app/app.config.ts), [root](src/app/app.component.ts), [build/test configuration](angular.json), [package metadata](package.json) | Explicit stable zoneless scheduling, unchanged root Eager strategy, empty runtime polyfills and test-only Zone dependency. [Smoke](src/app/app.component.spec.ts) and [route specs](src/app/app.routes.spec.ts) use actual `appConfig`, not a substitute provider setup. |
| [Lab TS](src/app/features/labs/zoneless/zoneless-lab.component.ts), [HTML](src/app/features/labs/zoneless/zoneless-lab.component.html), [CSS](src/app/features/labs/zoneless/zoneless-lab.component.css), [16 new Jasmine cases](src/app/features/labs/zoneless/zoneless-lab.component.spec.ts); [lazy routes](src/app/features/labs/labs.routes.ts) | `/labs/zoneless`, linked from index/dashboard: native 1,000 ms one-shot timer → private `EventTarget` → template-read signal OR plain snapshot + `markForCheck`. Idle/pending/done/cancelled, duplicate prevention, cancel/reset/destruction invalidation and listener removal. Explicit-zoneless tests use no forced render. |
| [State notification preview](src/app/features/labs/state/notification-preview.component.ts) / [spec](src/app/features/labs/state/notification-preview.component.spec.ts) | Existing Eager/OnPush comparison now describes scheduling honestly and tests both Zone and zoneless; a plain external mutation is not a notification. |
| [FormsReactiveLab implementation](src/app/features/labs/forms/forms-reactive-lab.component.ts) / [spec](src/app/features/labs/forms/forms-reactive-lab.component.spec.ts) | New explicit-zoneless success/failure regressions resolve controlled async validation without a second click or `detectChanges()`; form observables must notify the view rather than relying on patched callbacks. |
| [Eight new browser cases](e2e/zoneless.spec.ts) / [shared fixtures](e2e/fixtures.ts) | Desktop/light and 390 px narrow/dark native completion in both modes (two axe scans), cancel/navigation, 30-minute session expiry with Playwright clock, and all four resource readers' success/error/recovery. All existing browser tests assert no global Zone; external requests/page errors remain blocked/checked. |
| [Bundle audit](tools/quality/bundle-audit.mjs) / [helper specs](tools/quality/bundle-audit.spec.mjs) | Audit accepts an absent polyfills entry, rejects duplicate entries and bans `node_modules/zone.js`; all 70 helpers and the final production artifact audit passed within the boundaries below. |

**Try and explain:** start one native callback in each notification mode, wait without another click, cancel pending work, reset and navigate away/revisit. Predict why Eager alone cannot schedule an arbitrary native callback and why `markForCheck` is notification rather than a forced synchronous render. Each run owns its one-shot timer/listener; there is **no ongoing polling, HTTP, storage or production `detectChanges()` hack**. Existing session ownership, data endpoints and UI behavior are preserved.

Live components/state/performance/profiling lesson copy now distinguishes Eager checking, zoneless scheduling and test-only Zone; dashboard M09 copy reflects P10–P12. These copy corrections do not complete other curriculum topics.

#### P12 before/after evidence and final verification

All results below are supplied main-pass evidence, not runs performed by this documentation edit. **The final full gates completed after final copy fixes.** This request's fresh pre-change baseline is distinct from historical P11 bytes/counts.

| Check | Before P12 | Final result and boundary |
| --- | --- | --- |
| Jasmine/ChromeHeadless | **1777 tests from the prior dashboard run**, not a fresh pre-change unit run | **1799/1799 SUCCESS, 11.639 s total / 11.102 s execution** |
| Playwright | This request's pre-change **41/41 PASS (1.2 minutes)** | **49/49 PASS (1.4 minutes), no failures/retries/skips**; 41 existing + 8 new |
| Axe | Historical P11 scans retain their scope | **8 dedicated tests / 10 scans + 2 new P12 scans = 12 scans, zero violations**, included in the 49; not full WCAG certification |
| Quality helpers | Historical P11 had 66 cases | **70/70 PASS (224.5338 ms)** |
| Lint / strict E2E types | Historical results remain historical | **Both PASS** in the final full gates |
| Production | Fresh pre-change build **5.499 s**; **544,213 B raw initial / 167,250 B summed gzip estimate**, **86 JavaScript / 87 JS/CSS files** | **5.447 s PASS; 507,039 B raw / 154,204 B summed gzip-level-9 estimate**, not network transfer |
| Mock build | Earlier results retain their scope | **4.867 s PASS**, separate **`dist/angular-22-mock` — never deploy** |
| Final artifact audit | Pre-change counts above are a separate baseline | **PASS: 86 JavaScript / 87 emitted JS/CSS files**, ignoring 64 embedded component-style records; no Zone/mock/test inputs or external imports; initial roots main/styles only, no polyfills |

**Earlier focused evidence and test-only corrections:** **63 unit PASS (4.657 s)**, **70 helper PASS (224.5693 ms)** and **8 new browser PASS (42.2 s)**, including two zero-violation axe scans, preceded the full gates. The first full unit run's **four failures were resolved only in tests**:

- Shell Escape waits for `MatSidenav.openedChange` to capture the opener and for closed notifications.
- Editor dialogs await `whenStable()` after `afterOpened` for CDK `afterNextRender` focus work.
- Submit-error assertions use a `MutationObserver` to await the actual signal-rendered error, with a **3 s failure deadline and disconnection**, rather than assuming `whenStable()` owns untracked submission promises.

No production rendering hack or application-component change was made to resolve those failures. **42 focused tests passed (3.862 s)**, followed by **1799/1799 full-suite successes twice (21.051 s, then 11.639 s)**.

**Measured initial-cost reduction:** fresh baseline **544,213 / 167,250 B raw/gzip** → final **507,039 / 154,204 B**: **−37,174 B (−6.83%) raw / −13,046 B (−7.80%) gzip**. Gzip is a **summed level-9 estimate, not network transfer**. Lazy zoneless entry **12,072 B** is entry-only, not whole-route cost. Budgets remain **500 kB warning / 1 MB error**, component styles **4/8 kB**; the **7,039 B warning excess remains**, not hidden by a budget increase.

**Fresh production profiles — both PASS:** Chrome **154.0.8037.58**, local Node **22.23.2**, **1280×900 light / 390×844 dark**. Dashboard/lab boot and final observed layout-shift sums **0 in both**, downstream movement **0 px**, repeat JavaScript requests **0**; lifetime/preload/defer boundaries pass. Dashboard LCP candidates **null/176 ms**, lab **188/152 ms**, driver-inclusive wall times **41.7/38.8 ms** are local diagnostics, **not field Web Vitals, formal CLS/INP or a speed certification**.

**Tooling/research boundary:** the initial `npm.cmd` invocation used bundled/system Node **22.14** and emitted engine warnings; subsequent lockfile synchronization through direct project-local **Node 22.23.2 + npm CLI succeeded without engine warnings**, with no upgrades or global changes. Its npm audit summary remained **five moderate development-chain findings**, not fixed and not a fresh security audit. Angular MCP tools were unavailable; no P12 MCP run is claimed. Main-pass research fetched official zoneless/provider/`ChangeDetectorRef`/`TestBed` documentation and confirmed stable **22.1.7** installed declarations. This edit rechecked the [Angular zoneless guide](https://angular.dev/guide/zoneless) and [stable provider API](https://angular.dev/api/core/provideZonelessChangeDetection), without rerunning application verification.

**Diagnostics and explicit limits:** legacy Karma **NG0914** is expected with test-only Zone plus explicit zoneless providers; all browser tests assert no global Zone. Deliberate failed-chunk diagnostics and missing-image 404 tests still pass. Scoped editor checks retain **two existing `NotificationPreviewComponent` discovery errors**: unknown `app-notification-preview` in `state-lab.component.html` and static imports in `state-lab.component.ts`, despite successful AOT/tests. No suppression or all-editor-clean claim is made. Existing builder deprecations, size warning and five audit findings remain limitations, not incomplete P12 application verification.

**Documentation closeout boundary:** before this two-document edit, **33 scoped files** passed UTF-8/no-BOM/final-newline/trailing-whitespace checks, **three JSON files (package, lockfile, Angular configuration)** parsed, and **`git diff --check` passed** with package CRLF notices only. Final post-document links/hygiene/main checks have **not run yet**; main will run them, and no post-edit count or completion is claimed. **P12 application implementation and verification are complete within these limits**, not awaiting sign-off. No SSR, settings, live API, new endpoint, environment variable or global configuration change belongs to this milestone. Next: **P13 SSR/hydration, then P14 settings/ecosystem**, separately scoped and not automatically started. M08 stays a placeholder; advanced resources/forms/`transformedValue`, async DI awareness and optional refresh stay open.

## 1. Learning method and scope

### 1.1 What we will build

**Angular 22 Learning Store** is a small storefront and management dashboard with a built-in learning lab. Products teach HTTP, routing, and rendering. A cart teaches signals. Product editing and checkout teach forms. Users, posts, and tasks teach RxJS composition. A labs area demonstrates framework features that would otherwise feel artificial in a storefront.

There are three clearly labelled data modes:

- **Remote demo:** real HTTP requests to DummyJSON; writes return simulated results and do not persist on the server.
- **Local mock:** development-only, seeded HTTP simulation with deterministic scenarios and session-scoped CRUD state.
- **Unit-test backend:** Angular HTTP testing providers; never calls the public API.

The project is not a real shop. It does not process payments, send email, create real accounts, or implement production authorization.

### 1.2 Learning loop for every topic

1. Read the concept and predict its behavior before writing code.
2. Build the smallest exercise in the assigned screen or lab.
3. Observe the template, Network panel, Angular DevTools, or a redacted event timeline.
4. Trigger empty, error, slow, repeated-action, and destroyed-view cases where relevant.
5. Write an automated test that proves the important behavior.
6. Explain the mechanism, when to use it, and one common mistake without reading the code.

Each lab should display **Concept**, **Try it**, **What Angular does**, **Common mistake**, and **Revision question**, plus an observation/test. Material cards/expansion panels are one presentation option; the delivered P08 RxJS lab uses labelled native controls and styled semantic sections with **Angular and RxJS mechanism** and **Test observation** headings. P09 framework/resource labs use semantic sections and native controls; forms additionally use Material presentation/actions and focused custom controls. P10 adds an interactive Material gallery, Material date/time fixtures and native-control CDK mechanism experiments. The implementation links back to this document rather than creating competing standards documents.

### 1.3 Scope labels

| Label | Meaning |
| --- | --- |
| Core | Required for the learning application |
| Advanced | Required for broad revision, implemented after the core in isolated milestones |
| Legacy | Read/compare/migrate; not the default architecture for new screens |
| Awareness | Explain purpose and trade-offs; no dependency or implementation by default |

Learning order: TypeScript and templates → components and DI → signals → HTTP/RxJS → routing → forms → Material/CDK → tests and performance → rendering and ecosystem tracks. Testing and accessibility also apply throughout, not just at the end.

## 2. Angular 22 version facts

Not every feature available in Angular 22 was introduced in Angular 22. Standalone components, signals, built-in control flow, and deferred views predate this release.

| Topic | Angular 22 guidance | Consequence for this repository |
| --- | --- | --- |
| Standalone | Default; omit redundant `standalone: true` | Continue standalone architecture |
| Change detection | OnPush is now the default; `Default` is a deprecated alias for `Eager` | New components use the default. P12 deliberately retains the root's explicit Eager strategy, independently of zoneless scheduling |
| Zone.js | Zoneless defaults and stable `provideZonelessChangeDetection()` coexist with supported Zone-based apps | P12 explicitly uses the zoneless provider and build polyfills `[]`; Zone.js 0.15.1 (`~0.15.0`) is test-only for Karma/compatibility, not application runtime |
| Signal Forms | Stable in v22; use `@angular/forms/signals` | Primary new-form learning track, alongside typed Reactive Forms |
| Async resources | `resource`, `httpResource`, and `rxResource` are available as stable v22 APIs | Teach their read/cancellation semantics; do not use reactive loaders for durable writes |
| Services | `@Service` is available for new singleton services | Prefer it where its scope fits; learn `@Injectable` and explicit providers too |
| HTTP backend | `HttpClient` uses Fetch by default; `withXhr()` opts into XHR | No outdated blanket `withFetch()` setup. Upload-progress exercise needs browser-only XHR or a simulated transport |
| HTTP configuration | Explicit `provideHttpClient(withInterceptors(...))` configures the application's pipeline | Do not claim `HttpClient` always requires explicit provisioning merely to be injectable in v22 |
| Hydration | `provideClientHydration()` enables incremental hydration by default, including event replay | SSR is still a separate installation/configuration milestone; it is not enabled in this app now |
| Template switching | Consecutive `@case` branches and exhaustive `@default never;` are supported | Use typed state unions; assign a signal value to `@let` before exhaustive checking |
| Angular Aria | Stable accessible headless primitives | Optional comparison with styled Material components, not a replacement required for the app |
| Tooling | CLI/MCP guidance may be generic or lag a newer release | Verify installed public declarations and version-specific docs when advice conflicts |

**Important distinctions:** OnPush is a component checking strategy; zoneless is how Angular schedules updates without Zone.js. They are related but not interchangeable. `@defer` delays loading/rendering a template region; hydration reuses server-rendered DOM. Neither is a substitute for route lazy loading.

## 3. Application concept and screens

### 3.1 User journeys

- Browse, search, sort, and paginate products; open a shareable product URL.
- Add products to a local cart, change quantities, and complete a fake checkout.
- Sign in with a public demo account to explore token handling and navigation guards.
- Create/edit/delete products and observe that remote writes are simulated.
- Browse users, their posts and tasks; toggle task completion and rearrange a local task board.
- Switch light/dark/system theme and review locale/accessibility behavior.
- Visit labs to compare signals, RxJS, forms, DI scopes, lifecycle, rendering, and error handling.

### 3.2 Route and screen map

| Route | Screen and behavior | Material UI | Main learning topics |
| --- | --- | --- | --- |
| `/dashboard` | Overview plus verified user-loaded public widgets; no HTTP before Load | Material overview cards; native widget strategy/buttons/articles | Independent `merge`/`scan`, seeded `combineLatest`, per-inner recovery before `forkJoin`; public scopes, not recent activity |
| `/products` | Product cards/table, search, categories, server paging and sorting | Form fields, select, table, paginator, sort, chips | HTTP, URL state, RxJS cancellation, stable identity |
| `/products/:id` | Gallery, price, stock, reviews, add-to-cart | Cards, tabs, expansion panels, buttons | Route parameters, inputs, images, deferred views |
| `/products/new` | Product creation, guarded demo-admin action | Form fields, select, snackbar | Signal Forms, validation, POST |
| `/products/:id/edit` | Product editing with unsaved-change protection | Same editor, confirmation dialog | PATCH, draft ownership, `canDeactivate` |
| `/cart` | Quantity controls, derived subtotal and discounts | List/table, badge, icon buttons | Signals, `computed`, `model`, immutable updates |
| `/checkout` | Fake address/delivery/review flow | Stepper, radio buttons, checkbox; date/time comparison is a separate lab | Typed Reactive Forms, nested groups, dynamic controls, CVA |
| `/login` | Demo login, verification/logout and explicit Continue | Card, inputs, password toggle, local role select | Signal Forms, explicit duplicate gate, session lifetime, safe return paths; synthetic `exhaustMap` comparison at `/labs/rxjs`, not a login refactor |
| `/users` | Implemented public directory with URL search/page | Material table, search, avatar, paginator | Canonical queries, cancellation, minimal projection/privacy |
| `/users/:id` | Implemented profile/posts sections plus public filtered task link, not nested tabs | Avatar, lists, paginator, section errors | Parallel reads, independent retries, ID-keyed local paging |
| `/posts/:id` | Implemented post/comments and dependent author | Sections, avatar, lists, paginator | Route-scoped sharing, dependent cancellation, text safety |
| `/tasks` | P08 public URL-paged/filterable CRUD plus P10 local pointer ordering | Signal Forms, checkbox, dialog, paginator, native Move up/down and same-column CDK handles | Cap-10 writes/row rollback unchanged; typed drop/snapshot/identity validation, no HTTP order, dirty/busy guard |
| `/settings` | Placeholder; saved theme preferences, locale preview and global mock reset UI deferred to settings/P14 | Existing toolbar theme selector is session-only | Future DI configuration, effects and persistence policy; not delivered settings |
| `/labs` and `/labs/component-state` | Labs index plus delivered P04 model/projection/scope/lifecycle exercise | Material index and P04 presentation | Eight P09, three P10, P11 performance and P12 zoneless entries preserve P04/P08 links |
| `/labs/rxjs` | Verified nine-recipe local virtual-time operator lab within the P08 scope | Styled native controls and semantic sections, not Material cards | Actual operators, bounded traces, sources/subjects, timing, errors, sharing, promises and synthetic teardown |
| `/labs/components` | Seven delivered experiments, including both dynamic-component mechanisms | Native controls and semantic articles | Templates, queries/projection, composition, dynamic views, pipes, encapsulation, render callbacks |
| `/labs/di` | Provider/scoping/context/cleanup workbench | Native controls and semantic sections | Isolated bounded environment initializer, not bootstrap; D07 awareness only |
| `/labs/state` | State/interop and Eager/OnPush notification comparisons | Native controls and local preview | Memoization, equality, effects, output interop; stable 250 ms RxJS debounce. P12 tests notification preview in both Zone and zoneless modes |
| `/labs/routing` | Real nested lazy routes with local fixtures | Native navigation, resolver controls and named help outlet | Input binding, guards, resolver, default reuse, matcher and recovery; R09 measurement delivered separately in P11, transitions deferred |
| `/labs/resources` | Four actual readers, one selected variant at a time | Native Load/reload/Clear and status/error sections | Product read replacement, identity parsing/publication, cancellation and explicit resource destruction |
| `/labs/forms-signal` | Independent Signal draft plus core metadata/compatibility lessons | Native/custom controls, Material cards/actions/dialog | Blur/async rules, field errors, local save/reset, typed metadata, compatibility |
| `/labs/forms-reactive` | Equivalent independent typed draft | Native/CVA controls, Material cards/actions/dialog | Nested groups, arrays/records, raw/disabled values, local save/reset |
| `/labs/forms-template` | Small isolated preference form, not saved settings | Native controls, Material presentation | `ngModel`/`NgForm`; all three forms entries use `FormsLabGuard` |
| `/labs/material` | Local action/choice/display/feedback gallery and complete 15-row table | Menu, tabs, tooltip, toggles, autocomplete, chips, slider, badge, grid-list, expansion, tree, snackbar, bottom sheet, table/sort/paginator | Independent local state/CVAs, typed results, full-dataset sorting/paging and owned cleanup |
| `/labs/material-dates` | Independent optional Signal single date and typed Reactive range/time | Datepicker, date range and timepicker; scoped native adapter/en-GB | CVA-only validation bridge, bounds/parse/reset/disabled semantics; permissive parsing, not saved settings |
| `/labs/cdk` | One selected local overlay, virtual-list or utilities experiment | CDK mechanisms with native labelled controls | Portal/trap cleanup, full 1,000-person fixture/stable selection, local direction/focus/announcement/clipboard/autosize/breakpoints |
| `/labs/performance` | P11 full follow-up: defer/preload, animation, profiling and fill images | Labelled native controls and observations | Download versus lifetime, reduced-motion teardown, pure method/computed work, stable DOM and reserved image geometry; [current evidence and limits](#p11-full-follow-up--2026-09-28) |
| `/labs/zoneless` | P12 native callback lab, implemented and verified within limits | Labelled native controls and status observations | One-shot timer/private EventTarget, template-read signal versus plain snapshot + markForCheck; duplicate/cancel/reset/destruction boundaries |
| `/labs/:topic` | Remaining topic previews after static routes | Topic-specific preview | Advanced/awareness catalogue is not automatically complete |
| `/forbidden` and `**` | Access-denied and not-found views | Card, navigation button | Error routes, wildcard ordering, recovery |

Declare static product routes such as `new` before `:id`. The root path redirects to `/dashboard` using a full path match. Lazy-load feature areas; do not eagerly import all labs into the application shell.

### 3.3 Common UI states

Every data page must intentionally render loading, success, empty, error, and retry states. A detail page must distinguish invalid ID, not-found, forbidden, and network failure. A form must distinguish pristine, dirty, pending validation, invalid, submitting, success, and submit failure.

Refreshing existing data should not unnecessarily replace the entire page with a spinner. If old data stays visible, label it as refreshing/stale and define whether it can still be acted upon.

## 4. Architecture and state ownership

### 4.1 Proposed organization

Foundation/layout/theme, products, cart, checkout, session and their data/configuration/mock/testing boundaries exist through P07. M06 adds users/posts/comments data, shared read-state/avatar UI, strict read parsers and relationship mocks as the first P08 slice. M07 adds verified task data, a component-owned board/queue, Signal Forms, URL/guard boundaries and stateful task mocks. P08 adds dashboard widget composition using those existing services and `features/labs/rxjs/` production-route virtual fixtures. P09 adds `features/labs/components/`, `di/`, `state/`, `routing/`, `resources/` and `forms/` with lazy entry routes, isolated owners and colocated tests. Routing uses the global input-binding option; forms guards are wired at all three P09 forms entry routes. P10 adds `features/labs/material/`, `material-dates/` and `cdk/`, plus typed task ordering in the existing `features/tasks/tasks.component.*` and `task-board.service.*`, not a new data service. M08 settings/P14 and advanced work remain deferred; the date/time scratch route has no unsaved-settings guard.

| Location | Responsibility |
| --- | --- |
| `src/main.ts` | Bootstrap only |
| `src/app/app.config.ts` | Router, HTTP/interceptors, cross-cutting provider configuration |
| `src/app/app.routes.ts` | Top-level routes and lazy feature entry points |
| `src/app/layout/` | Material shell, navigation, page layout |
| `src/app/core/http/` | Shared page contract and safe error mapping; later cross-cutting HTTP policies |
| `src/app/core/session/` | Demo session and auth lifecycle |
| `src/app/core/config/` | Typed public configuration and data-mode selection |
| `src/app/shared/ui/` | Reusable empty/error/loading views, confirmation dialog |
| `src/app/shared/util/` | Small pure functions, only when actually shared |
| `src/app/features/<feature>/` | Pages, UI components, domain models, data access, feature routes |
| `src/app/features/labs/` | Independent framework exercises, lazy-loaded by topic |
| `src/app/features/labs/material/` | Local actions/choices/display-feedback, typed sheet, full local table and lesson presentation |
| `src/app/features/labs/material-dates/` | Scoped native adapter, CVA-only single-date bridge, independent range/time and local-value diagnostics |
| `src/app/features/labs/cdk/` | Owned overlay, complete fictional virtual fixture/selection, local utilities and allowlisted public link |
| `src/app/features/labs/performance/` | P11 defer/preload/lifetime, animation/reduced motion, scoped pure profiling and local fill-image lessons with colocated specs |
| `src/app/features/labs/zoneless/` | P12 native one-shot callback and explicit notification comparison, owned cleanup and explicit-zoneless scheduling regressions |
| `src/app/testing/` | Test fixtures and reusable test helpers |
| `src/app/core/mock/` | Development-only mock interceptor, seed data, scenario controls |
| `src/styles.css` | Existing global application styles |
| `src/theme.scss` | Root Material 3 Sass theme; existing component styles remain CSS |

Colocate `.component.ts`, `.component.html`, `.component.css`, and `.component.spec.ts`. Keep `.service.ts` and `.spec.ts` naming. Extract a repository/store layer only when it owns meaningful reusable policy, not simply to wrap another function.

### 4.2 Data flow

**User action → page intent → focused service/stream → HttpClient → interceptor pipeline → backend → validation/mapping → read-only state → template.**

Presentational components receive inputs and emit semantic events. They do not decide API URLs, attach tokens, or manage unrelated global state. Domain services must not open Material dialogs merely because an HTTP request failed; presentation owns that decision.

### 4.3 Ownership rules

| State | Owner | Lifetime |
| --- | --- | --- |
| Product query, sort, page | Router query parameters | Shareable and restorable through navigation |
| User directory query/page | Router query parameters | Shareable; validated profile return query |
| Profile-post/comment page | Owning component's ID-keyed linked signal | Local; resets when parent route ID changes |
| Shared post read and dependent author | Post detail's route-ID stream | No root cache; replaced on ID change, torn down with the view |
| Task public user filter/page | Router query parameters | Validated public assignment, never session identity |
| Task rows/order, snapshot, cap-10 write queue | Component-provided `TaskBoardService`; component captures pointer-start row/array identity | Typed same-column drops/native moves update local order only; explicit load replaces it; destruction cancels active and drops queued writes |
| Task creation draft | Tasks component's Signal Forms model | Failure/reload preserves it; success or accepted query change resets it; dirty leave asks |
| Dashboard widget group | Component-owned Load/Retry streams and one `toSignal` boundary | Idle before Load; strategy switch replaces group; destruction cancels active reads |
| RxJS recipe/scenario and completed trace | Lab component signals; each Run owns fresh virtual fixtures | Reset/replacement clears trace; generation/destruction checks reject late promise publication |
| P09 widgets, DI injectors and state fixtures | Owning experiment/component | Replacement/clear/destruction releases local instances and subscriptions; not root app state |
| P09 selected resource reader | Active experiment and one reader factory | Idle before Load; ID replaces read, same-ID reload, Clear destroys resource; owner teardown cancels |
| P09 forms drafts and availability | Independent page model or control tree and component-local availability service | Failure preserves draft; success/reset clears; replacement/invalid/reset cancels old checks; guarded departure |
| P09 routing fixtures and interactive configuration | Route-provided session with parent-view cleanup | Default detail reuse on parameters; parent departure cancels pending work/resets interactive settings; no retention cache |
| P10 Material action/choice/display state and table | Experiment signals or independent typed controls; table's `MatTableDataSource`/sort/paginator | Reset is local; teardown disconnects data source and closes only owned overlays; no HTTP/storage |
| P10 single date and range/time | Separate Signal Forms model (CVA-only wrapper) and typed Reactive control tree; page-scoped adapter | Never synchronized; reset enables/clears state and raw text; leaving discards scratch values without a save/guard |
| P10 CDK overlay and selection | Selected experiment owns overlay/trap/render callback or `SelectionModel<string>` | Switching destroys old experiment; selection survives virtual row destruction, not experiment destruction |
| P10 direction, note, focus and announcements | Utilities experiment/local `Dir`, scoped `LiveAnnouncer`, owned monitoring | No root preference update; destroy ends observation/announcement work and unregisters focus target; clipboard only on action |
| P11 animation, profiling and image experiments | Lesson-local signals/providers; explicit inspection snapshots, pure calculator and image request identity | Leave can retain DOM after destruction; bounded re-entry, memoized immutable inputs/stable IDs and fresh-image restore; no app persistence |
| P12 native callback experiment | Component-owned one-shot timer/private EventTarget and selected notification mode | Duplicate starts blocked; cancel/reset/destruction invalidate late delivery and remove listeners; no polling/HTTP/storage |
| Uncommitted search text | Product page | Until applied to URL or page destroyed |
| Product results/request status | Feature data owner | Current query; explicit cache policy if added |
| Product editor draft | Editor component/route-scoped owner | Until save, discard, or route destruction |
| Cart lines | Cart service with private writable signals | Browser app session |
| Total price/count | `computed` from cart lines | Never a second independently writable value |
| Session tokens | Private in-memory session service | Until logout, expiration, or page reload |
| Theme preference | Theme service | Session-only now; persistence policy/UI deferred to settings/P14; no secrets |
| Mock data/scenario | Development mock backend | Seed/reset/reload; excluded from production behavior |

Do not use `effect` to synchronize several writable copies of query state. Parse router parameters into a typed model and update the URL through explicit user intents. Normalize defaults to prevent navigation loops.

### 4.4 Domain model boundaries

Define separate transport DTOs, app domain models, and form drafts where they genuinely differ. Use readonly domain fields and small unions such as data mode, load status, sort direction, and demo role.

- `ProductSummary`: ID, title, category, price, thumbnail, stock, rating; optional brand where missing.
- `ProductDetail`: summary plus description, image URLs and mapped reviews.
- `ProductQuery`: search term, category slug, page index, page size, whitelisted sort field/direction.
- `Page<T>`: normalized `items`, `total`, `skip`, `limit`; map the API-specific envelope first.
- `ProductDraft`: title, description, price, stock, category; client-only fields are not silently sent.
- `CartLine`: product ID, display data, integer quantity, price snapshot.
- `CheckoutDraft`: fictional address and delivery choices; no payment-card fields.
- `PublicUser`: only fields needed for display. Never retain entire API user payloads by default.
- `ApiError`: discriminated category, safe message, optional status/retry metadata; no raw token payloads.

Use `unknown` at untrusted boundaries and validate required fields. `HttpClient.get<Product>()` is a compile-time expectation, not a runtime schema check. Learn handwritten guards first; adopt a schema library only as a deliberate dependency decision.

For the first product-page parser: require a non-null object, an array at `products`, nonnegative integer paging metadata, and valid objects for every rendered row. Require positive integer IDs, string titles/categories, finite nonnegative prices, nonnegative integer stock, bounded numeric ratings, and permitted image URL schemes. Map only accepted fields. Reject a malformed page with a typed data-format error rather than silently dropping rows while keeping a misleading total. Create a different parser for a reduced projection instead of asserting it is a full product.

## 5. Angular Material and CDK design

### 5.1 Setup and visual direction

During the Material milestone, select a compatible stable Material/CDK 22.x pair and use the project-local CLI installation schematic. Review its diff, package peers, generated theme, fonts, and icons. No global CLI/Node changes and no forced dependency installation.

Use a clean Material 3 layout: responsive sidenav, toolbar with cart/session actions, constrained content width, clear headings, and spacious cards. Provide light, dark, and system modes with violet/blue primary colors and a restrained accent. Theme the root so overlay dialogs and menus inherit the same tokens.

Start with a supported M3 prebuilt theme or use `mat.theme` in `src/theme.scss`. Teach color, typography, density, `color-scheme`, system tokens, and supported component override mixins. Do not target internal `.mat-*` DOM classes or use `::ng-deep` to fight the library.

Default density should remain comfortable; compact mode must retain usable targets. Prefer self-hosted/locally available fonts and icons when offline operation or privacy is important. Material is not a charting library: dashboard graphs should be simple accessible SVG/CSS or an explicitly chosen later dependency.

### 5.2 Material coverage map

| Family | Components to exercise | Where and what to verify |
| --- | --- | --- |
| Navigation | Toolbar, sidenav, menu, tabs, list | Responsive drawer, active route, keyboard navigation |
| Actions | Buttons, icon buttons, button toggle, tooltip | Descriptive names; tooltip is not the only label |
| Display | Card, divider, badge, expansion panel, grid-list lab | Heading order, content projection, responsive alternatives |
| Data | Table, sort, paginator | Remote pagination, total count, sortable whitelist, announcements |
| Text/choice | Form field, input, select, autocomplete | Labels, validation, filtered results, object identity |
| Selection | Checkbox, radio, slide toggle, slider, chips | Keyboard operation, boolean versus value controls, chip semantics |
| Date/time | Datepicker/date range and available timepicker | Compatible adapter, locale, parsing, null values, calendar versus instant |
| Feedback | Progress spinner/bar, snackbar | Busy semantics; important errors remain visible after snackbar dismissal |
| Workflows | Dialog, bottom sheet, stepper | Typed result, cancelled action, focus trap and restoration |
| Hierarchy | Tree | Stable identity, accessible expand/collapse; use current public APIs |

A server-backed product table receives already-paged data from the API. Do not attach a client-side `MatTableDataSource` paginator/sorter to that page and accidentally sort/page only the returned subset. A separate small local-table lab can demonstrate `MatTableDataSource` correctly.

**P10 complete within limits:** `/labs/material` supplies that complete **15-row** local table with filter → sort → page ordering and 5/10 sizes, plus actions, choices, hierarchy and owned feedback overlays. `/labs/material-dates` supplies the independent date/range/time integration with scoped native parsing limits. See the [source matrix](#p10-source-reading-matrix) and [final verification](#p10-verification--main-pass); focused evidence does not establish universal Material compatibility.

### 5.3 CDK and testing coverage

- **Drag/drop implemented:** same-column task pointer handles alongside native **Move up/down buttons**, not a move menu or built-in keyboard dragging. Typed events and captured snapshot/identity validation precede immutable local ordering; no server position writes. Completion still uses the existing PATCH queue.
- **Scrolling implemented:** all 1,000 fictional people are local; fixed 48 px rows in a 288 px viewport, stable-ID selection, end-exclusive range and observed attached DOM count. Not remote-user paging or a lower downloaded-data claim.
- **Overlay/Portal implemented:** centered modal help uses `TemplatePortal`, blocking scroll, owned focus trap, Escape/backdrop/Close, cancellable autofocus and disposal. Use Material Dialog for ordinary dialogs; this is a mechanism lab, not a connected popover.
- **Accessibility implemented mechanisms:** `FocusMonitor` with explicit unregistering, focus trapping and scoped `LiveAnnouncer`, without duplicate live feedback. Full accessibility review remains a separate verification task.
- **Layout:** local `BreakpointObserver` behavior and CSS; no SSR/hydration claim.
- **Collections/Bidi/TextField/Clipboard implemented:** `SelectionModel<string>`, local `Dir`, bounded textarea autosizing, action-only copy of allowlisted same-origin `/products/1` with manual fallback; no persisted preferences.
- **Harnesses:** colocated Material harness and CDK/board interaction/cleanup specs passed in the final 1706-test suite; [browser evidence and limits](#p10-verification--main-pass) are recorded separately. Avoid private DOM selectors or invented drag harness/keyboard APIs.

## 6. Dummy API specification

### 6.1 Base and guarantees

Remote base: **`https://dummyjson.com`**, supplied through a typed injection token/configuration boundary. It is public configuration, not a secret; no API key or `.env` file is required for this project.

DummyJSON is an external demonstration service. Availability, sample counts, records, and response details can change. Do not hard-code dataset totals or assert exact public product titles in tests. Live contract checks are optional and separate from unit tests.

All application calls use Angular `HttpClient` or a documented Angular resource API behind data access. The provider's documentation uses `fetch` examples, but that does not dictate our application architecture.

### 6.2 Remote endpoint catalogue

Paths below are relative to the base. Bodies and response descriptions show the subset relevant to the app, not exhaustive remote schemas.

| Method and path | Query/body example | Response shape | Exercise |
| --- | --- | --- | --- |
| `GET /products` | `limit=12&skip=0&sortBy=title&order=asc` | `{ products: ProductDto[], total, skip, limit }` | Remote list, sort, pagination |
| `GET /products/search` | `q=phone&limit=12&skip=0` | Same product envelope | Debounced search and cancellation |
| `GET /products/categories` | None | Array of `{ slug, name, url }` | Category select |
| `GET /products/category/:slug` | Encoded slug plus paging | Product envelope | Category browsing |
| `GET /products/:id` | Positive integer ID | Product object | Detail read and route validation |
| `POST /products/add` | `{ title: 'Practice Notebook', price: 12.5, stock: 8, category: 'groceries', description: 'Demo item' }` | Submitted fields plus generated ID | Create result; not persistent |
| `PATCH /products/:id` | `{ title: 'Revised title', price: 14.5 }` | Updated product object | Edit result; not persistent |
| `DELETE /products/:id` | No body | Product plus `isDeleted`, `deletedOn` | Confirmation and simulated deletion |
| `GET /users` | `limit=10&skip=0&select=id,firstName,lastName,image` | `{ users: UserDto[], total, skip, limit }` | Directory with minimal projection |
| `GET /users/search` | `q=ann&limit=10&skip=0` | User envelope | Search; map only public display fields |
| `GET /users/:id` | Positive integer ID | User object | Profile; discard unneeded/sensitive-looking fields |
| `GET /posts/user/:userId` | User ID in path | `{ posts: PostDto[], total, skip, limit }` | User-post relationship |
| `GET /posts/:id` | Post ID | Post object | Detail route |
| `GET /posts/:id/comments` | Post ID | `{ comments: CommentDto[], total, skip, limit }` | Related request and comments |
| `GET /todos` | `limit=10&skip=0` | `{ todos: TodoDto[], total, skip, limit }` | Public task snapshot paging |
| `GET /todos/:id` | Positive integer ID | Todo object | Data-service detail read; no dedicated task-detail screen |
| `GET /todos/user/:userId` | Public user ID plus `limit`/`skip` | `{ todos: TodoDto[], total, skip, limit }` | Tasks per public assignment, not auth identity |
| `POST /todos/add` | `{ todo: 'Revise signals', completed: false, userId: 1 }` | Todo object with generated ID | Create task simulation |
| `PATCH /todos/:id` | `{ completed: true }` | Updated todo; documented echo ID may be a string | Ordered toggles and row-only rollback |
| `DELETE /todos/:id` | No body | Todo plus deletion metadata | Task deletion simulation |
| `GET /carts/user/:userId` | User ID | `{ carts: CartDto[], total, skip, limit }` | Read sample carts; not the local cart owner |
| `POST /carts/add` | `{ userId: 1, products: [{ id: 1, quantity: 2 }] }` | Cart with product lines, totals and ID | Fake checkout; no real order/payment |
| `POST /auth/login` | `{ username: '<public demo username>', password: '<public demo password>', expiresInMins: 30 }` | User summary, `accessToken`, `refreshToken` | Demo session |
| `GET /auth/me` | Bearer token in header | Current demo user | Protected read |
| `POST /auth/refresh` | `{ refreshToken: '<in-memory token>', expiresInMins: 30 }` | New access/refresh tokens | Optional future exercise; P07 retains no refresh token and does not call/implement this endpoint |
| `GET /http/500` | No body | Intentional HTTP failure; validate rather than assume payload | Manual error lab, not unit-test dependency |

Optional paging payload reduction uses a `select` parameter. Never assume a projected response includes fields that were not requested. Category objects include a remote `url`, but construct API paths from validated slugs instead of blindly requesting arbitrary response-provided URLs.

### 6.3 Query contract

- Page sizes: 12/24/48 for cards; 10/25/50 for tables. `skip = pageIndex × pageSize`.
- Allowlisted sort fields: title, price, rating. Direction: `asc` or `desc`.
- Trim search input; debounce 300 ms; ignore unchanged normalized queries; reset page when criteria change.
- Remote mode uses either all-products, search, or category endpoint. Search and category are mutually exclusive in the first implementation because arbitrary combined filtering is not assumed to be supported.
- A later combined-filter lab can use a deliberately complete local dataset or a backend with that contract. Never filter one remote page and present its count as the global result count.
- Build parameters with `HttpParams` or the typed request options object. Encode path segments; reject invalid IDs before requesting.
- Route query values are untrusted strings. Clamp/reject invalid page sizes, negative pages, invalid sorts and malformed categories; emit a canonical URL.

### 6.4 Simulated writes and persistence policy

**Remote mode:** after a successful write, display the returned result and a clear “Demo only — server changes are not saved” message. Reloading remote data restores its original values. Do not imply that a generated remote ID can be fetched, edited, or deleted later. Do not hard-code the generated ID or rely on different POSTs returning unique IDs.

**Local mock mode:** keep seeded records in memory and allocate unique local IDs. Reads reflect writes until reset/reload. Validate payloads, return not-found for missing IDs, and model errors. This is the mode for complete create → read → edit → delete exercises.

**Cart:** the browser-session cart is separate from sample remote carts. A successful `/carts/add` call returns a fake receipt. Clear only the matching submitted cart snapshot after a validated response; preserve it on failure or intervening cart changes. The local mock calculates receipts from current prices/stock but stores no orders and deducts no inventory. Do not implement checkout as a product write or claim remote inventory has changed.

Do not silently merge remote mutations into a supposedly authoritative server-paged result. M07's explicit task snapshot previews completion changes and removes successful deletes locally, retaining totals **“at last load”**. Created results stay separate in both modes; explicit reload replaces the snapshot and local order. This is not general filter/order/total reconciliation or persistent remote state.

### 6.5 Development mock design

Keep the same data-access service and request contracts in both demo modes. A development-only functional interceptor can handle a narrowly allowlisted set of requests to the configured API origin, returning `HttpResponse`/`HttpErrorResponse` objects from seeded state. Unmatched requests must pass through or fail explicitly according to the mode, never be swallowed silently.

Register it through `provideHttpClient(withInterceptors(...))`, after the applicable logging/loading/auth interceptors, so those policies also see mock responses. It does not replace `HttpClient`. Use a development configuration/provider entry with no production import of mock fixtures; verify the production bundle excludes them. Unit tests normally omit this interceptor and use Angular's testing backend; test the mock interceptor itself separately. Select remote/mock mode at bootstrap and reset/reload when changing it so caches and sessions cannot mix modes.

This in-browser HTTP simulation is not a real network server: mocked requests may not appear as network traffic. Provide a redacted request timeline in the lab. Use a real local mock server later if network-level/offline/service-worker behavior is being tested.

| Scenario | Expected behavior | Verification |
| --- | --- | --- |
| Normal and delayed success | Busy UI, then valid data | Loading transition test |
| Empty page | Helpful no-results view, clear-filters action | Empty is not an error |
| 400/422 validation | Field or form error, preserve draft | No blind retry |
| 401 and refresh failure | Clear session or controlled reauthentication | No refresh loop |
| 403 | Access-denied feedback | Do not present as not-found |
| 404 | Resource-not-found with recovery link | List can still work |
| 409 conflict | Preserve draft, explain conflict | Local mock only; not a claimed remote contract |
| 429 with Retry-After | Respect bounded retry/delay policy | Virtual-time test |
| 500/503 | Inline retry for safe reads | Finite retries, no automatic write replay |
| Network error/status 0 | Distinguish connectivity/CORS possibility | Never “fix” CORS with `no-cors` |
| Malformed response | Validation failure state | No unsafe cast into the model |
| Out-of-order responses | Latest search wins | Older request unsubscribed/ignored |

Latency controls belong to development fixtures. Deterministic tests use controlled HTTP responses and virtual time, not real sleeps. A reset action restores a known seed and clears local mutations and failure scenarios.

## 7. HTTP and asynchronous data flows

### 7.1 Product search walkthrough

1. A Material input changes draft search text.
2. Debounce and normalize before writing a new query to the router.
3. Router state produces a typed request query.
4. `switchMap` replaces the previous read; the transport is unsubscribed when possible.
5. The service validates the response and maps the product envelope to `Page<ProductSummary>`.
6. Inner `catchError` converts failure to a typed state without killing future searches.
7. The template consumes a single `AsyncPipe` or `toSignal` boundary and renders the state.
8. Navigating away disposes the owning subscription/resource. A cancelled request must not hide a newer request's loading indicator.

Do not keep both an imperative subscription and an `AsyncPipe` subscription to the same cold HTTP source unless deliberate sharing has been designed.

### 7.2 Product save walkthrough

1. Validate the draft and identify the active data mode.
2. Ignore duplicate clicks while submitting (`exhaustMap` or an equivalent explicit submission contract).
3. Map the draft to an allowlisted create/update DTO and execute one mutation.
4. Success: present the returned result, reset dirty state at the correct moment, and show the simulation notice in remote mode.
5. Failure: preserve fields, announce the error, re-enable submission; do not retry writes automatically.
6. If navigation cancels the client subscription, do not assume it rolled back server work. Define navigation policy while submitting.

### 7.3 HTTP feature checklist

| Feature | Exercise | Rule |
| --- | --- | --- |
| GET/POST/PATCH/DELETE | Product and todo services | Typed parameters plus runtime validation where needed |
| PUT versus PATCH | Mock-only replacement comparison | Teach semantics; do not assume a demo API enforces them identically |
| Headers/params/context | Auth, paging, skip-global-loader context | Immutable request cloning; no token attached to image/CDN origins |
| Functional interceptors | Timing, active-request counter, auth, optional refresh | Ordered pipeline; central policy without hiding feature errors |
| `HttpContextToken` | Exclude background refresh from global busy bar | Per-request configuration, not URL substring heuristics |
| Error handling | Expected errors mapped in data layer | Global `ErrorHandler` is for unexpected errors, not every failed request |
| Cancellation | Search and destroyed detail view | Test unsubscribe; cancellation is not rollback |
| Caching | Category list, explicit invalidation lab | Key by relevant parameters and user scope; define TTL/lifetime |
| Progress/events | Mock file upload and download lab | Fetch does not provide upload progress; XHR exercise is browser-only |
| Blobs/text/files | Local export and mock download | Correct `responseType`, revoke created object URLs |
| Transfer cache | Later SSR public reads | Never serialize session tokens or private responses |

An active-request counter increments at subscription time and decrements in `finalize`; one global boolean fails with concurrent requests. Retries and cancellation must leave the counter balanced. Feature-level loading states remain the primary source of page behavior.

### 7.4 Resource comparison lab

**Delivered P09:** `/labs/resources` runs the same product-detail contract in four separate variants, **one selected reader at a time**, not four concurrent requests. See the [implementation/cancellation boundary](#p09--core-framework-resources-and-forms-labs--2026-09-27). `httpResource` uses reactive IDs on the same instance and projects identity errors separately from raw resource errors; Clear explicitly destroys resource instances to cover Angular 22.1.7's undefined-params cancellation gap.

| Choice | Use when | Observe |
| --- | --- | --- |
| `HttpClient` + RxJS + `AsyncPipe`/`toSignal` | Composition, cancellation, retries and event-driven reads need explicit operators | Cold subscriptions, teardown, sharing policy |
| `httpResource` | A signal-dependent HTTP read should expose resource state directly | Request dependencies, loading/error/value, reload, parsing |
| `rxResource` | A resource should wrap an existing observable-based reader | `stream` factory, cancellation and completion behavior |
| `resource` | Promise/async-loader data does not fit ordinary HTTP directly | Parameters, `abortSignal`, status, cleanup |

Resource loaders are for reads that may be cancelled/re-run. Updating a resource's local value is not a persisted server mutation. Guard error/value access using the API's supported state checks. Advanced revision can explore dependent/streaming resources and newer async-signal helpers after checking their exact installed API signatures and stability.

### 7.5 Task and dashboard walkthroughs

The [implemented M07 task slice](#m07--p08-tasks-implementation-record--2026-09-27) uses a component-owned, cap-10 `concatMap` queue for creation/completion/deletion. Admission locks the row before dispatch; inner recovery restores only its previous state without erasing other successes. Downstream destruction teardown cancels active work and drops unstarted buffered writes, rather than draining them. OPEN / DONE reflect page-local completion, with PATCH for toggles; native up/down and [P10 same-column pointer ordering](#p10--material-and-cdk--2026-09-28) send no HTTP. P10 validates typed drop identity and the captured board snapshot before immutable reordering, without adding queue slots or persisted positions. Totals stay “at last load”, created results remain separate and explicit reload resets local order. M07's suite remains historical evidence; [P10 verification](#p10-verification--main-pass) distinguishes actual pointer/keyboard observations from unit-tested no-HTTP ordering and unchanged queue behavior.

The [delivered P08 dashboard](#p08--dashboard-widgets-and-rxjs-recipes--2026-09-27) stays idle until **Load widgets**. Independent `merge`/`scan` and loading-seeded `combineLatest` render partial states with error-only section retry; `forkJoin` waits for settled inputs, mapping each error/no-response completion before joining, and exposes group **Reload snapshot**. Only one strategy group runs; switching cancels the old group, and one `toSignal` owns teardown. First-ten task completion counts are page-local; first-three user/post previews and public-user-1 post totals are not global/recent/authenticated activity. No strategy is universally better. The P08 record distinguishes focused browser checks from unit-tested partial-failure/retry behavior.

## 8. Feature study catalogue

Each ID should have a working demonstration and a test or recorded observation appropriate to its scope. The [P09 source matrix](#p09-source-reading-matrix) maps delivered core demonstrations and explicit awareness/advanced limits; it does not mark every row complete. Tables cover APIs by concept rather than forcing every API into the storefront.

### 8.1 TypeScript and Angular foundations

| ID | Topic and mechanism | Exercise and completion evidence |
| --- | --- | --- |
| F01 | Bootstrap, standalone imports, application configuration | Explain how `main.ts` creates the root, providers resolve, and a route becomes a view |
| F02 | Strict typing, inference, type-only imports, optional/null values | Model product DTOs/drafts without `any` or unsafe assertions |
| F03 | Unions, narrowing, exhaustive handling, `never`, `satisfies` | Add a new request-state variant and let the compiler reveal missing handling |
| F04 | Generics, `keyof`, utility/mapped types, readonly arrays | Typed page result and safe sort mapping; avoid over-generalized service classes |
| F05 | Runtime validation versus compile-time types | Malformed fixture fails predictably before rendering |
| F06 | Promise/event-loop basics versus observables | Compare one eager promise to a cold HTTP observable; handle rejection explicitly |
| F07 | CLI workspace, builders, AOT, template compilation, environment configurations | Locate build/test targets, budgets and strict template checks; no global CLI changes |
| F08 | Public configuration versus secrets, dev proxy and CORS | Explain why a browser bundle cannot conceal an API key and a proxy is not production auth |

### 8.2 Templates, components, directives and pipes

| ID | Topic and mechanism | Exercise and completion evidence |
| --- | --- | --- |
| C01 | Interpolation, property/attribute/event binding, class/style bindings | Product card; distinguish `[disabled]` from an attribute string |
| C02 | Template expressions, safe navigation, nullish coalescing, references | Show zero price and empty strings correctly; avoid truthiness bugs |
| C03 | `@if`, `@else`, `@for`, `@empty`, contextual variables | Reorder/delete products while focus and view identity remain correct |
| C04 | `@switch`, grouped cases, `@let`, exhaustive checks | Typed request-state panel; use a local variable for signal-based exhaustiveness |
| C05 | `input`, required inputs, aliases and transforms | Product card contract; boolean/number attribute transforms where appropriate |
| C06 | `output` and event contracts | Card emits product ID on add-to-cart; parent owns cart state |
| C07 | `model` and two-way binding | Reusable quantity control; explain when two-way binding is justified |
| C08 | Content projection, selectors and fallback content | Reusable card with projected heading/actions; distinguish content from view |
| C09 | `ng-template`, `TemplateRef`, `NgTemplateOutlet`, `ng-container` | Reusable empty-state template without unnecessary DOM wrappers |
| C10 | `viewChild`/`viewChildren`, `contentChild`/`contentChildren` | Focus search after a panel renders; account for conditional/missing query results |
| C11 | Lifecycle hooks and `DestroyRef` | Timeline for create/input change/content/view/destroy; clean timers/listeners |
| C12 | `afterNextRender`, `afterEveryRender`, `afterRenderEffect` | Safe DOM measurement and browser integration; separate writes from reads |
| C13 | Attribute directives and `host` metadata | Highlight low stock with text plus styling; no color-only meaning |
| C14 | Custom structural directive, `TemplateRef`/`ViewContainerRef`, context typing | Permission-view lab; clearly not a security boundary, not a replacement for `@if` |
| C15 | Directive composition with `hostDirectives` | Reuse a focus/behavior directive; deliberately expose its public inputs |
| C16 | Built-in pipes and custom pure pipes | Currency/date/decimal/percent/text; pure price-label pipe test |
| C17 | Pure versus impure pipes | Mutation-versus-new-reference demonstration; do not use impure pipes to hide bad data flow |
| C18 | Dynamic components: `NgComponentOutlet`, `ViewContainerRef.createComponent` | Widget host with typed bindings; destroy replaced widgets |
| C19 | Style encapsulation: Emulated, ShadowDom, None | Isolated lab; explain Material theme delivery inside shadow roots |
| C20 | Inheritance versus composition | Compare a tiny inherited behavior to a composed directive/service; prefer composition for reusable UI |

### 8.3 Dependency injection and state

| ID | Topic and mechanism | Exercise and completion evidence |
| --- | --- | --- |
| D01 | `inject`, `@Service`, `@Injectable` and constructor DI comparison | Root cart service; explain injection-context restrictions |
| D02 | `InjectionToken`, value/factory/existing/class/multi providers | Typed API base and configurable mock mode; provider alias preserves identity |
| D03 | Root/environment/route/component scopes and `viewProviders` | Two editor instances share root cart but not local drafts |
| D04 | `optional`, `self`, `skipSelf`, `host` resolution | Inspector lab shows which instance is resolved and why |
| D05 | `runInInjectionContext`, cleanup and injector lifetime | Explain why a valid context does not persist across `await` |
| D06 | Initializers and configuration load | P09 isolated environment initializer: 150 ms fixture, 600 ms deadline and failure UI; application bootstrap initialization is not implemented |
| D07 | Async DI awareness | Installed `injectAsync` is public/stable; blueprint awareness only, no runtime invocation in P09; do not mix sync/async contracts casually |
| S01 | `signal`, `set`, `update`, equality and readonly exposure | Immutable cart updates; mutation test demonstrates missed notifications |
| S02 | `computed`, lazy memoization and dynamic dependencies | Cart totals and item counts are derived, never copied by an effect |
| S03 | `linkedSignal` | Selected variant resets when available variants change, while still allowing user selection |
| S04 | `effect`, cleanup, `untracked` and dependency tracking | P09 local style/cleanup experiment; theme persistence remains settings/P14, not delivered by this lab |
| S05 | Signal/RxJS boundaries | One `toSignal` per reused stream; valid initial value/error handling; `toObservable` stabilization |
| S06 | `outputFromObservable` and `outputToObservable` | Event interop lab with documented ownership and cleanup |
| S07 | State store without a state-management library | Cart service exposes read-only selectors and semantic update methods |
| S08 | Async resource APIs | Product-detail comparison from section 7.4; tests for replacement/error/reload |
| S09 | Debounced/async-signal helpers | P09 stable RxJS 250 ms comparison runs; installed experimental `debounced` returns `Resource<T>`, not `Signal<T>`, and is not invoked; advanced async-resource helpers remain separate |

### 8.4 How Angular updates the view

Follow a complete trace: click handler → signal write → dependent computed invalidation → Angular scheduling → eligible component checking → template binding evaluation → minimal DOM update.

With OnPush, input changes, template-read signal updates, event handling and explicit notifications participate in view updates. A plain object mutation or arbitrary callback is not a reliable notification strategy. `AsyncPipe` also notifies Angular when its value changes.

P09 introduced the Eager/default-OnPush notification preview; P12 now tests it in both Zone and zoneless modes and distinguishes those scheduling environments honestly. The app explicitly uses `provideZonelessChangeDetection()` while retaining the Eager root. `/labs/zoneless` separately demonstrates a native one-shot callback notifying through a template-read signal or plain snapshot plus `markForCheck`. Neither a plain mutation nor `NgZone.run` alone supplies a zoneless notification. Use signals for normal UI state. Learn `ChangeDetectorRef` detach/reattach/detectChanges as advanced mechanisms, not routine application patterns or fixes for a missing notification. [P12 final verification and measured byte reductions](#p12-beforeafter-evidence-and-final-verification) are not a runtime speed or field Web Vitals certification.

## 9. Forms curriculum

### 9.1 Three separate implementations

| Form style | Assigned screen | Why it exists |
| --- | --- | --- |
| Signal Forms | Product editor and delivered `/labs/forms-signal` | Stable v22 model/schema/field state, custom controls and extra metadata/compatibility lessons |
| Typed Reactive Forms | Checkout and delivered `/labs/forms-reactive` | Equivalent independent lab draft with explicit nested/dynamic control tree |
| Template-driven forms | Delivered `/labs/forms-template`, small isolated preference form | `ngModel`, `NgForm`, directives and migration trade-offs; not M08 settings |

Do not attach competing form systems to the same control. Do not maintain a signal model and an independently writable reactive form as duplicate sources of truth. Compatibility APIs are for deliberate migration exercises.

The real product routes retain the Signal Forms editor. All three P09 forms routes run independent fixtures/drafts with wired `FormsLabGuard`; Signal and Reactive labs share pure rules but no writable owner. Controlled local availability, blur updates, pending/invalid gates, manual Complete/Fail saves, draft-preserving failure/retry and reset send no HTTP writes. Signal Forms also hosts typed metadata, hidden/readonly/`applyWhen`, field-targeted server-error and compatibility/builders lessons. P10 adds a separate unguarded scratch route `/labs/material-dates`: Signal `singleDate` through a CVA-only wrapper versus independent typed Reactive range/time. Core comparisons and this bounded date/time integration are implemented; advanced `transformedValue` and broader forms work remain deferred. See the [P09 record](#p09--core-framework-resources-and-forms-labs--2026-09-27) for cancellation/blur behavior and [P10 record](#p10--material-and-cdk--2026-09-28) for parsing/reset limits.

### 9.2 Signal Forms checklist

- Create a defined initial model, call `form`, bind through `FormField` and `[formField]`.
- Explore field value, valid/invalid, touched, dirty, pending, disabled, hidden and readonly behavior.
- Build reusable validation schemas: required title, positive price, nonnegative integer stock, selected category.
- Add cross-field validation in a mock-only scheduling/pricing lab, with errors placed at a meaningful field/group.
- Add conditional logic, nested objects, arrays, reusable schemas and conditional schema application.
- Demonstrate async validation with cancellation and a deterministic mocked availability endpoint; DummyJSON does not promise a SKU-uniqueness validator.
- Demonstrate field debounce/blur behavior, reset, submission state and server validation errors through supported form APIs.
- Build a quantity/rating custom control using `FormValueControl`; boolean control uses `FormCheckboxControl` instead. Include disabled behavior, focus, touched/blur reporting and accessible naming.
- Keep validation in the schema, not duplicated inside the visual control. Explore `transformedValue` for number/date parsing in the advanced custom-control lab.
- Add a dynamic-form lab with trusted, typed metadata; never compile or execute templates supplied by API JSON.

### 9.3 Material integration checkpoint

Angular Material/CDK 22.1.8 is installed. **P05 verified** `[formField]` on `input matInput` (text and nullable number), `textarea matInput`, and `mat-select` through its existing CVA interoperability. Colocated harness tests cover values, reset, disabled and touched/error presentation; browser checks cover selection and dialog focus. No extra adapter or Reactive Form is needed for these controls. `submit` explicitly gates pending validation, but this editor has no fabricated async validator. P09 separately delivers local async validation, Signal value/checkbox custom controls and a Reactive CVA, with native date fields; these do not certify all Material components. **P10 is verified within limits** for scoped native datepicker/date-range/stable timepicker at `/labs/material-dates`: a CVA-only single-date wrapper bridges same-null parse validation/reset into Signal Forms, while separate typed Reactive controls own range/time. Bounds, optional/partial ranges, disabled/reset semantics and permissive en-GB parsing limits are documented in the [P10 record](#p10--material-and-cdk--2026-09-28). A 30-minute option interval is not typed-time validation; [final evidence](#p10-verification--main-pass) separates unit coverage from focused browser observations. Advanced `transformedValue` remains separate.

Use documented native integration where supported; do not assume every control uses an identical adapter. If a chosen control needs a bridge, use a supported compatibility approach or a small Signal Forms control wrapper with explicit state wiring. Do not implement both `ControlValueAccessor` and Signal Forms control interfaces on the same component. Do not invent imports for an unverified Material adapter package.

Typed Reactive Forms provide a supported separate comparison/fallback route. Record any actual integration limitation discovered during implementation instead of abandoning the Signal Forms lesson or hiding a typing error.

### 9.4 Typed Reactive Forms checklist

- `FormControl`, `FormGroup`, `FormArray`, `FormRecord`, `NonNullableFormBuilder` and type-safe values.
- Nested address group, dynamic order notes/contact entries, required delivery option.
- Sync, async and cross-field validators; `updateOn` behavior.
- `valueChanges`, `statusChanges`, `setValue` versus `patchValue`, reset and `emitEvent` decisions.
- Disabled controls and the difference between `.value` and `getRawValue()`.
- Reusable `ControlValueAccessor` lab: write value, on-change, on-touched, disabled state; no feedback loop from programmatic writes.
- Compatibility revision: `compatForm` and `SignalFormControl`, using installed API contracts rather than arbitrary bidirectional subscriptions.

### 9.5 Form acceptance requirements

Save is blocked when invalid, pending or already submitting. Submission exposes relevant errors and focuses the first invalid field. Errors are associated with controls and not conveyed by color alone. Failed saves preserve user input. Successful saves reset the correct dirty/submission state. Unsaved navigation offers stay/discard and restores focus after the dialog.

## 10. Routing curriculum

**Current coverage:** P09's local routes/guards/resolvers/input binding/default reuse and router tests remain delivered; see the [source matrix](#p09-source-reading-matrix). **R09 selective preloading and local download measurements are delivered within P11's limits**; the [full follow-up](#p11-full-follow-up--2026-09-28) records final production samples and completed verification gates. R12 view transitions are developer preview in the installed API and are not invoked; no custom retention cache is present. Do not mark all R01–R12 complete.

| ID | Feature | Exercise and rule |
| --- | --- | --- |
| R01 | `Routes`, `provideRouter`, links, active links, outlets | Material navigation with correct active state and accessible page heading |
| R02 | Lazy `loadComponent`/`loadChildren`, nested routes | Features load on demand; profile tabs can be URL-addressable |
| R03 | Path, query, fragment and navigation state | Product ID and shareable filters; do not use transient navigation state as durable storage |
| R04 | Functional `canActivate`, `canActivateChild`, `canMatch` | Demo login/admin navigation; return `UrlTree`/redirect result rather than side-effect navigation |
| R05 | `canDeactivate` | Dirty-editor confirmation; account for save in progress |
| R06 | Functional resolvers and navigation errors | Compare resolving essential product data to loading inside the page; avoid blocking on noncritical widgets |
| R07 | Component input binding | Use `withComponentInputBinding` where suitable; validate string parameters before treating them as IDs |
| R08 | Router events, title strategy, scrolling | Navigation progress, document titles, anchor/scroll restoration and focus behavior |
| R09 | Preloading strategies | P11 implements `core/routing/performance-preloading.service.ts` via `app.config.ts` `withPreloading`; parent-entry candidate download is distinct from activation. [Current samples and limits](#p11-full-follow-up--2026-09-28); not preload-all or authorization |
| R10 | Named outlets, route reuse and custom matching | Isolated advanced inspector; clean up retained subscriptions and state |
| R11 | Redirects, wildcard and invalid URLs | Deep-link refresh works with host fallback; unknown product differs from unknown route |
| R12 | Router testing and view transitions | Test actual URLs and guards; optional reduced-motion-aware transition lab |

Read the Angular 22 functional guard signatures, including the updated `canMatch` arguments, before implementing custom calls. Demo guards are UX checks, never server authorization. Validate login return URLs as internal routes to prevent open redirects.

## 11. RxJS operator laboratory

**Completed P08 scope:** `/labs/rxjs` implements nine actual-operator recipes, with source/test details and focused browser evidence in the [P08 record](#p08--dashboard-widgets-and-rxjs-recipes--2026-09-27). The catalogue below is a revision map, not a claim that all framework/resource/forms labs or every production integration is complete.

### 11.1 Observable fundamentals

Teach producer/subscriber, next/error/complete, cold versus hot sources, subscription teardown, laziness and multicasting. Create a small timeline that logs only operation IDs and timestamps, never credentials. Compare `Subject`, `BehaviorSubject`, `ReplaySubject` and signals; explain why a subject is not needed simply to relay every existing event.

| Operators/concept | Exercise | What must be demonstrated |
| --- | --- | --- |
| `of`, `from`, `defer`, `fromEvent`, `timer`, `interval` | Source playground | Creation/subscription timing; teardown stops ongoing work |
| `map`, `filter`, `tap`, `scan`, `startWith` | Product mapping and event counter | Transform versus side effect versus accumulated state |
| `debounceTime`, `distinctUntilChanged` | Product search | Fewer requests without dropping final intent |
| `switchMap` | Replace stale searches | Latest result wins; not for writes that must all finish |
| `concatMap` | Queue task updates | Preserve order; show queue growth and bounded user interaction |
| `mergeMap` with concurrency limit | Independent detail reads | Up to a defined number in flight, results may arrive out of order |
| `exhaustMap` | Delivered synthetic four-click lab | Ignore triggers while busy; P06/P07 still use explicit gates, not this operator |
| `combineLatest` | Query/filter composition | Needs an initial value from each input; reacts to any change |
| `forkJoin` | Finite dashboard requests | Needs each source to emit and complete; define partial-error behavior |
| `withLatestFrom` | Submit click plus current draft | Primary event drives work; secondary data must have emitted |
| `catchError`, `throwError`, `retry`, `timeout` | Read failures | Correct recovery scope, finite retry, non-retryable validation failures |
| `finalize` | Busy-state cleanup | Runs on completion, error and unsubscribe |
| `take`, `takeUntil`, `takeUntilDestroyed` | Finite sources and synthetic cutoff in the lab; actual component lifecycle specs separately | Place destruction teardown after higher-order operators; virtual navigation is not Angular destruction |
| `share`, `shareReplay` | M06 route sharing plus delivered overlap/reset/late-reader lab | Completed replay retention is not TTL; Run replaces the lab instance; general cache policy remains a separate lesson |
| `firstValueFrom`, `lastValueFrom` | Required promise boundary | Empty-source and never-completing-source behavior |
| `throttleTime`, `auditTime`, schedulers | High-frequency local events | Compare timing policies with virtual time, not vague speed claims |

### 11.2 Four-click experiment

The delivered lab runs burst clicks **A0 / B7 / C11 / D47** with latencies **A31 / B13 / C23 / D9** virtual ms; spaced clicks are A0/B38/C71/D109. Compare `switchMap`, `concatMap`, `mergeMap` with concurrency **2**, and `exhaustMap`; select an inner error and optional downstream synthetic navigation cutoff at **25/50**. An ignored/cancelled selected operation may never error. Production uses `VirtualTimeScheduler`, with bounded ID/event/time logs; colocated `TestScheduler` tests assert both emissions and subscription windows. Component-teardown tests are separate from this synthetic navigation experiment.

### 11.3 Avoid these traps

- Nested subscriptions lose a clear cancellation/error path.
- An outer `catchError` can terminate the interaction stream after the first failure.
- Teardown before `switchMap` may leave the active inner stream alive.
- `shareReplay` is not automatically a time-bounded HTTP cache.
- A `BehaviorSubject` piped through asynchronous operators no longer guarantees synchronous emission for `toSignal({ requireSync: true })`.
- `switchMap` cancels client observation; it does not undo a server mutation.
- A root service's `DestroyRef` does not end work when a page is destroyed.

## 12. Performance and rendering

### 12.1 Required performance labs

**Historical measurement scope:** the P11 results and completion checks in this subsection remain P11 evidence, not P12 final production measurements. P12's separate before/after boundary is below.

**Current P11 full follow-up:** required performance lessons and verification gates are complete within limits, with [source/tests](#p11-source-reading-matrix) and [final results and samples](#p11-full-follow-up--2026-09-28). The v1.13 baseline is historical. Both fresh production profiles show zero observed startup/final shifts and downstream movement after shell/layout fixes; that is not a universal zero-shift or field Web Vitals claim. Observer candidates and document shift sums are not field LCP/INP or formal session-window CLS; gzip sums are estimates, not network transfer. Lazy boundaries do not prove zero shared-framework initial cost.

- [x] Stable `@for` identity, immutable weight updates and computed derivation; profiling reversal preserves actual DOM nodes.
- [x] Route lazy loading versus `@defer` splitting; selective preloading differs from activation.
- [x] All seven defer triggers: idle, viewport, interaction, hover/focus, timer, immediate and `when`; prefetch independently from rendering.
- [x] Placeholder/loading/error blocks, after/minimum loading timing and deterministic defer tests; real browser triggers separately exercised.
- [x] Eligible deferred dependencies and production download/lifetime/revisit boundaries checked.
- [x] `NgOptimizedImage` dimensions and nonpriority fill: local SVG, reserved 16:9 frame, contain/cover, real failure/restore and responsive sizes.
- [x] P10 virtual DOM-size observations versus ordinary paging, with accessibility trade-offs; not a benchmark.
- [x] CSS `animate.enter`/`animate.leave`, 240/600 ms, destruction versus DOM removal, bounded re-entry and no-animation/zero-duration reduced motion.
- [x] Pure intentional method versus computed profiling; component/injector/profiler extension and browser Performance procedures; actual public Angular Chrome traces captured in both modes.
- [x] Unnecessary eager nav/action dependencies reduced; template-call anti-pattern isolated to the lab, no duplicate request owner introduced.
- [x] Final quality, audit disposition and hygiene gates recorded within the supplied scope; see the full follow-up for pre-edit documentation-check timing.

**Evidence limits, not unfinished implementation:** optional hands-on Angular DevTools extension GUI inspection/recording was unavailable/unexercised; procedures and Chrome CDP traces do not claim GUI evidence. Local samples do not supply field INP/Web Vitals or universal performance/accessibility certification.

Record baseline and changed measurements for initial transfer size, lazy chunk behavior, interaction responsiveness, layout shift and repeated navigation. Do not increase budgets just to silence a regression. Use LCP/INP/CLS where measurable; a green score is not proof of accessibility or overall correctness.

### 12.2 Controlled zoneless migration

**P12 implemented and verified within limits:** [source/tests and final before/after evidence](#p12--zoneless-migration--2026-09-29) record the explicit stable provider, empty build polyfills, deliberate Eager-root retention and native callback/Reactive Forms notification regressions. Zone.js remains only as a development dependency for Karma clocks and explicit Zone compatibility tests; the legacy unit suite is not globally migrated. All 49 browser tests assert no global Zone, and the final production audit excludes Zone inputs. Full unit/browser/helper suites, lint/types, builds/artifacts and both production profiles passed after final copy fixes. Measured byte reductions and local samples do not certify runtime speed, field Web Vitals or every UI scenario.

Do not claim zoneless means “Angular never runs change detection.” It means Angular uses explicit notifications instead of relying on Zone-patched asynchronous activity.

### 12.3 SSR, prerendering and hydration track

Install/configure version-compatible SSR only in its milestone. Keep server files and generated CLI configuration aligned with the workspace's strict TypeScript setup; do not weaken `rootDir`/strictness to hide a problem.

| Topic | Exercise |
| --- | --- |
| CSR versus SSR versus SSG | Compare HTML before JavaScript; public product data versus private dashboard |
| Hybrid routes | Explicitly choose client/server/prerender route modes based on freshness and privacy |
| Prerender parameters | Use a bounded deterministic list of public product IDs; do not crawl an unbounded API during build |
| Hydration | Reuse server DOM; prevent invalid HTML and direct-DOM mismatch |
| Incremental hydration | `@defer` hydration boundary and triggers; observe event replay on first load |
| Transfer cache/TransferState | Public reads avoid unnecessary duplicate fetching; no tokens/private user responses |
| Platform APIs | Browser-only initialization in appropriate render callbacks; no unguarded localStorage/window on server |
| Stability | Understand `PendingTasks` and pending async work; avoid never-ending bootstrap tasks |
| Server security | Per-request user state, validated origins, safe trusted-proxy configuration, no XHR backend on server |
| SEO | Title, description, canonical URL and meaningful not-found status; no fake structured commercial claims |

Do not cache a user's session in process-global mutable state. For the learning app, authenticated views can remain client-rendered while public routes demonstrate SSR. A browser interceptor mock does not test a real server deployment.

## 13. Advanced ecosystem tracks

| Track | Deliverable and topics | Boundaries |
| --- | --- | --- |
| A01 — PWA/service worker | Installable app shell, offline explanation, asset/data caching, `SwUpdate` notification and reload flow | Test a production-like HTTPS/localhost build; never cache tokens/private API data; mock interceptor is not proof of offline networking |
| A02 — Web worker | Pure catalogue aggregation in a worker with typed messages, cancellation/termination and fallback | No DOM or ordinary component DI in the worker; use local fixtures |
| A03 — Angular Elements | Package a small public product-badge custom element; attributes/properties/events/lifecycle | Separate build boundary; assess runtime duplication before embedding |
| A04 — Library authoring | Extract a genuinely reused UI primitive into a library; public API, peer dependencies, packaging and consumer test | Keep a small initial application; no premature shared mega-library |
| A05 — Angular Aria | Build one headless accessible comparison widget and contrast styling/control with Material | Additional package only in this milestone; do not rebuild every Material control |
| A06 — Internationalization | Extract source messages, ICU plural/select, locale builds, RTL and Material labels/date adapter | Runtime locale preview is not the same as build-time Angular translations |
| A07 — Tooling/CI | Deterministic install, build, tests, coverage, explicit lint/a11y/E2E setup, artifact policy | Add tools deliberately; no scripts claimed before they exist |
| A08 — Libraries and third-party integration | `importProvidersFrom`, supported module interoperability, third-party lifecycle cleanup | No global scripts or sanitization bypass as a shortcut |
| A09 — Legacy Angular | NgModules, declarations/imports/exports/providers, decorator inputs/queries, constructor DI, structural microsyntax, template-driven forms | Learn recognition and migration; do not make them the new default architecture |
| A10 — Legacy APIs and migrations | Old animation DSL, class interceptors/guards, module bootstrap, older change-detection guidance | Check deprecation/removal status against installed v22 before making runnable examples |
| A11 — AngularJS upgrade awareness | Explain hybrid migration purpose and boundaries | No AngularJS runtime dependency or hybrid app required |
| A12 — AI/MCP and developer experience | Workspace discovery, best-practice lookup, API documentation search, language service, schematic/migration review | Tool output is evidence, not automatic authority; review diffs and keep approvals |
| A13 — Experimental frontier | Explain experimental WebMCP and other preview APIs if relevant | Awareness only, disabled by default; not necessary for Angular mastery |

NgRx, Nx, micro-frontends, Firebase, GraphQL and real payment/auth backends are optional ecosystem choices, not mandatory Angular features. They are intentionally outside the first project so framework behavior remains visible.

## 14. Security accessibility and internationalization

### 14.1 Demo authentication rules

**P07 implemented scope:** [M05's record](#m05--p07-implementation-record--2026-09-27) documents login/me/logout, a fixed 30-minute in-memory lifetime, local role selection, safe explicit Continue and workflow guards. Only exact query-free `GET /auth/me` receives the session bearer; `urlWithParams` includes `HttpParams` in that decision. Product/cart APIs remain public. No refresh token is retained, no refresh endpoint is called and no automatic retry is implemented. The refresh design below is **optional future work**, not a completed P07 feature.

Use only publicly documented dummy credentials, entered through a labelled demo form. Never enter real passwords or personal data. Keep demo tokens in memory and clear on logout; reload ends the session. Do not put tokens/passwords in localStorage, URL parameters, logs, snapshots or source fixtures.

An auth interceptor checks the exact configured origin and approved endpoint policy before adding a bearer token. It must exclude login/refresh as appropriate and never attach credentials to image URLs. Do not enable cross-origin credentials universally.

Optional refresh exercise: one refresh in flight, queued dependent reads, at most one retry of the original eligible request, exclusions preventing recursion, failed refresh clears session. Do not replay non-idempotent writes without a real idempotency contract. Demo role selection only controls UI/route exercises; DummyJSON is not our production authorization server.

For the first refresh implementation, both `/auth/login` and `/auth/refresh` bypass automatic bearer attachment and refresh recovery. Only approved protected reads such as `/auth/me` can trigger recovery from a 401. A session-owned shared in-flight refresh operation lets concurrent callers await one result; clear its reference on completion/failure. Mark the retried request with an `HttpContextToken` so a second 401 propagates instead of refreshing again. Cancel or ignore refresh results after logout using a session-generation check, preventing a late response from restoring a logged-out session.

### 14.2 Security revision

- Angular interpolation escapes untrusted text; HTML/URL/resource contexts have different risks.
- Avoid `bypassSecurityTrust*`, direct untrusted HTML insertion and dynamically compiled templates.
- Explain XSS versus CSRF/XSRF versus CORS; origin-scoped bearer handling is not equivalent to cookie security.
- Production authorization and input validation belong on the server, regardless of guard or form checks.
- Treat external response links, redirect URLs, file names and JSON as untrusted inputs.
- Discuss CSP/Trusted Types and deployment headers as defense-in-depth; don't pretend client code sets server headers.
- Review package peers and lockfiles; no forced audit upgrades or blind dependency installs.

### 14.3 Accessibility acceptance

Target WCAG 2.2 AA. Include semantic landmarks, a skip link, heading hierarchy, meaningful page titles, visible focus, sufficient contrast, text resizing, reflow and reduced motion. Associate labels/hints/errors with fields. Restore focus after dialogs. Announce loading/result changes sparingly. Provide keyboard alternatives for drag/drop and descriptive icon-button names.

Check light/dark, narrow screens, keyboard-only use, and a screen reader where available. P11's full 36-test run includes the original eight-test/ten-scan axe checks with zero violations plus two Tab-only journeys and animation focus/reduced-motion checks within their [recorded scope](#p11-full-follow-up--2026-09-28), not full keyboard, screen-reader or WCAG certification. P12's final **49/49** browser run includes those **10 dedicated scans plus two zoneless scans: 12 total, zero violations**, within the [P12 limits](#p12-beforeafter-evidence-and-final-verification). Automated checks complement rather than replace manual review. Material provides accessible primitives but cannot fix missing application labels or confusing workflows.

### 14.4 Locale, date and money decisions

Use locale-aware formatting, not string concatenation, for currency, decimals and dates. Treat the demo currency as an explicit display configuration; changing locale does not convert currency. Keep calendar dates distinct from UTC timestamps. Define rounding once; use an integer minor-unit model for cart calculations where practical and reconcile fake server totals explicitly.

Use Angular message extraction/localization for actual translated builds, including plural/select messages. `LOCALE_ID`, locale data, Material date adapters and labels must be configured consistently. Test long text and RTL layouts; do not mirror product imagery blindly.

## 15. Testing strategy

The workspace uses Jasmine/Karma; any runner migration is separate. P12 retains `zone.js`/`zone.js/testing` for legacy clocks and explicit Zone compatibility suites, not application runtime. New scheduling regressions explicitly enable zoneless, deliver controlled callbacks and await `whenStable()` without forced `detectChanges()` or a second click. App smoke/route specs use actual `appConfig`; the entire legacy unit suite is not claimed zoneless. Unit tests must use mocks, not DummyJSON availability.

| Layer | Tools/patterns | Required cases |
| --- | --- | --- |
| Pure domain logic | Jasmine | Money/quantity boundaries, parser validation, canonical query mapping |
| Components | Standalone imports in TestBed; rendered behavior | Input/output, state branches, keyboard actions, cleanup |
| Material | Public component harnesses | Dialog confirm/cancel/focus, select/input errors, paginator/sort |
| HTTP services | `provideHttpClient` before `provideHttpClientTesting`, `HttpTestingController` | URL/method/params/body, malformed data, 404/500/network failure, outstanding requests |
| Interceptors | Controlled requests and concurrent subscriptions | Origin-scoped auth, balanced busy counter, finite retry, refresh exclusions |
| Signals/resources | Supported Angular test stabilization | Derivation, dependency replacement, reload/error behavior, destroyed owner |
| RxJS | `TestScheduler` | Emissions and subscription windows, cancellation, ordering, retries |
| Router | `provideRouter`, router testing utilities/harness | Direct links, query restoration, guard redirect, dirty-form cancellation, not-found |
| Forms | Public model/control API plus DOM/harness interaction | Sync/async validation, pending, reset, disabled, submit failure retains draft |
| End-to-end (P12 verified within limits) | Playwright, installed Chrome, managed loopback mock server; all shared fixtures assert no global Zone and retain external-request/page-error guards | Final 49/49 PASS (1.4 minutes), no failures/retries/skips: 41 existing + 8 new (native modes, cancellation/navigation, clock-driven expiry and four readers); not all blueprint scenarios |
| Accessibility (bounded coverage) | Dedicated eight-test/ten-scan axe suite plus focused keyboard checks; P12 adds two scans in its zoneless spec | Final 12 scans, zero violations, included in the 49 browser cases; new scans at desktop/light and 390 px dark; not full keyboard/screen-reader/WCAG certification |
| Quality helpers (P12) | Native Node tests, bundle audit and production browser measurement helper | Final 70/70 helpers PASS (224.5338 ms); absent polyfills permitted, duplicate entries and Zone inputs rejected. Final artifact audit and both production profiles PASS; P11 results remain historical |
| SSR/PWA (advanced) | Production-like build and browser checks | Initial HTML, hydration console, offline/update behavior, privacy |

Do not mix fake clock systems in one test. Do not add arbitrary timeouts to stabilize flaky behavior. Reset mutable mocks between tests. Prefer behavior assertions to private members or Material implementation classes.

## 16. Implementation roadmap

**P12 zoneless implementation and [final application verification are complete within limits](#p12-beforeafter-evidence-and-final-verification).** P00–P11 retain historical implementation/verification evidence and limits. Next is **P13 SSR/hydration, then P14 settings/ecosystem**, without automatic next work. M08 remains a placeholder; advanced resources/forms/`transformedValue`, async DI awareness and optional refresh stay deferred. Delivered milestones do not imply full C/D/S/R, forms or curriculum completion. Use the [module-wise checklist](#module-wise-build-guide) as the primary build order and this table for phase details. Each milestone ends with a runnable, reviewable result.

| Phase | Prerequisites | Deliverables | Exit criteria |
| --- | --- | --- | --- |
| P00 — Baseline | This document | Verify local versions, existing build/tests, repository instructions and accepted scope | Existing behavior recorded; no global tooling changes |
| P01 — Material foundation | P00 | Compatible Material/CDK, theme, accessible shell, initial lazy routes | Responsive navigation; no initial budget regression hidden |
| P02 — Data contracts | P01 | DTO/domain parsers, API token, HTTP configuration, mock mode/scenarios | HTTP tests prove remote URLs and mock CRUD; no live unit-test calls |
| P03 — Catalogue | P02 | Product list/detail, category/search, URL paging/sorting | Empty/error/retry and latest-search-wins tests pass |
| P04 — Component/state labs | P03 | Cards, quantity control, cart, projection/directives/pipes, DI and lifecycle labs | Catalogue/cart interactions and teardown demonstrated |
| P05 — Signal Forms CRUD | P04 | Material integration spike, product editor, create/update/delete, dirty guard | Validation and failure preserve drafts; simulated-write policy visible |
| P06 — Reactive checkout | P04, P05 | Typed stepper form, fake receipt, custom control comparison | Double submission prevented; failure preserves cart; no real payment data |
| P07 — Demo session: implemented | P02, P06 | Login/me/logout, exact-endpoint auth policy, safe Continue, checkout/editor navigation guards; refresh deferred | Minimal identity, private token, reload/logout/expiry/cancellation tested; final post-edit verification passed |
| P08 — Relationships/RxJS: complete within recorded scope | P03, P07 | Verified M06/M07 plus user-loaded widgets and nine local operator/timeline recipes | 1314-test suite, production/mock builds, exclusion checks and focused browser checks passed; explicit verification limits retained |
| P09 — Core feature labs verified within limits | P04, P08 | Eight lazy entries: components/DI/state/routing, four resource readers, three guarded forms comparisons plus metadata/compatibility | Final 1613-test suite, production/mock builds, exclusion checks and focused browser checks passed on 2026-09-28; [limits retained](#p09-verification--final); settings deferred |
| P10 — Material/CDK complete within limits | P05, P09 | Three lazy local gallery/date-time/CDK labs; full local table, scoped date bridge, owned overlay/virtual selection/utilities; same-column task pointer ordering plus native moves | Final post-newline-fix 1706-test suite, production/mock builds, artifact exclusions, focused sequential browser checks and hygiene/links/diff checks passed; server shutdown confirmed; [diagnostics and limits](#p10-verification--main-pass) retained |
| P11 — Full follow-up complete within limits | All core phases | Quality tools; defer/preload, animation/reduced motion, method/computed profiling and fill images; shell cost/layout fixes and expanded browser coverage | [Final results](#p11-full-follow-up--2026-09-28): unit/browser/helper suites, lint/types, production/mock builds, artifact audit, both production profiles and hygiene pass; initial 544,214 B, sampled shifts zero; runtime audit 0, five moderate dev-chain findings and size warning retained |
| P12 — Zoneless implemented and verified within limits | P11 | Explicit stable zoneless provider, empty build polyfills, Eager root retained, test-only Zone; native callback lab, forms/state regressions and browser/artifact guards | Final 1799 unit / 70 helper / 49 browser, lint/types, builds/audit and both production profiles passed; [final evidence and limits](#p12-beforeafter-evidence-and-final-verification), no forced-render workaround |
| P13 — SSR/hydration: next, separately scoped | P12 | Public hybrid rendering, bounded prerender, hydration/event replay/transfer cache; not started | No hydration mismatch, private cache or cross-request state leak |
| P14 — Ecosystem and deferred settings | P11; P13 where relevant | M08 settings preference/reset/locale scope; i18n, PWA, worker, library, Elements and Aria isolated tracks | Define settings persistence/reset policy explicitly; each selected advanced deliverable has its own verification |
| P15 — Revision completion | Selected phases | Final coverage review and unanswered-question list | Learner explains mechanisms and demonstrates failure/recovery scenarios |

Tests for changed behavior are part of every phase. P11 adds broader tooling and audits; it does not postpone unit testing until the app is finished.

Before P07, editor/cart/checkout exercises used an explicitly labelled local demo identity, not authenticated admin access. P07 now guards checkout/editor navigation and maps checkout to the verified demo session user. The UI-selected local demo-admin role is not sent to the API and is not server authorization; the anonymous cart still survives logout. P11's tooling gate was satisfied by an explicit question followed by the user's delegation of autonomous tool selection before installation. This does not authorize automatic future installs, a builder migration or later tracks.

## 17. Acceptance scenarios

1. **Shareable query:** change product search/sort/page, copy the URL, open it again; results and controls reflect the same normalized query.
2. **Latest request wins:** a slow A search completes after a faster B search; A never replaces B's view.
3. **Search survives errors:** one request fails; the next valid input still triggers a request and renders results.
4. **No double paging:** moving to page two requests the correct `skip`; total reflects the backend, not current rows.
5. **Mock CRUD:** create a local product, read it, edit it, delete it, and get not-found afterward; reset restores seeds.
6. **Remote honesty:** a simulated write shows its result and notice; later remote reload does not pretend persistence.
7. **Cart consistency:** adding/removing/updating lines changes all totals from a single state owner; invalid quantities are rejected.
8. **Submission concurrency:** repeated checkout clicks produce one request while pending; failure keeps cart and input.
9. **Safe navigation:** cancelling a dirty-form leave prompt keeps the user and draft in place; confirming discards intentionally.
10. **Auth boundary:** `/auth/me` receives the allowed token; unrelated/CDN requests do not; invalid return URLs are rejected.
11. **Cleanup:** navigating away stops polls/listeners/inner requests; repeated visits do not accumulate subscriptions.
12. **Independent errors:** one dashboard widget failure does not erase successful independent widgets.
13. **Forms equivalence:** Signal and Reactive Forms versions show equivalent validation and reset behavior without sharing mutable models.
14. **Accessible operation:** keyboard-only browse, add-to-cart, edit, dialog cancel and checkout work with visible/restored focus.
15. **Theme consistency:** dialogs, menus and datepicker overlays match the selected theme and retain contrast.
16. **Rendering correctness:** after the SSR milestone, initial public content exists before JS and hydration introduces no mismatch.
17. **Offline truthfulness:** after the PWA milestone, cached shell works offline and uncached data gets an explicit offline state.
18. **Strictness:** malformed API data and a newly added state-union branch fail visibly or at compile time, not through hidden casts.

## 18. Revision questions and answer cues

Try answering the question before reading the cue. Explain the behavior using a screen or test from the project.

| Question | Short answer cue |
| --- | --- |
| What happens between `main.ts` and the first page? | Bootstrap → root/environment providers → root view → route activation and rendering |
| Is every Angular 22 app automatically zoneless and OnPush? | New defaults differ from explicit compatibility providers/metadata in upgraded apps |
| How are OnPush and zoneless different? | Which views are checked versus how updates are scheduled |
| Why did mutating a signal's array fail to update the view? | Reference/equality and notification; use immutable updates |
| When do I use `computed`, `linkedSignal`, or `effect`? | Pure derivation; derived writable/reset state; imperative side effect |
| Why not call `toSignal` in a getter? | Repeated subscriptions and injection/lifetime issues |
| Why can `toObservable` skip intermediate synchronous writes? | It observes stabilized signal state, not every individual assignment |
| What is the difference between view and projected content? | Component-owned template versus content supplied by its consumer |
| Why does `track item.id` matter? | Stable relation between data and existing DOM/component instances |
| Can a route/component provider replace a root singleton? | A closer injector can create a separate scoped instance |
| Can `inject` run inside any callback? | Only in a valid injection context; capture dependencies earlier |
| Why can two HTTP subscriptions create two requests? | `HttpClient` observables are cold unless shared deliberately |
| When is `switchMap` dangerous? | For writes whose completion/order must be preserved |
| Why put `catchError` inside a request projection? | Recover the request without ending the outer interaction stream |
| Why put destruction teardown after higher-order mapping? | Cancel active inner subscriptions as well as the source |
| Why is a busy counter safer than one boolean? | Concurrent completion/cancellation must not clear another request's busy state |
| Does a generic HTTP type validate JSON? | No; inspect/validate untrusted values at runtime |
| Why do created DummyJSON products disappear? | Remote mutations simulate responses, not persistence |
| Can I implement server pagination by filtering the current page? | No; page-local results are not the server-wide filtered set |
| Why use resource APIs for reads rather than checkout? | Reactive reads may re-run/cancel; durable writes need explicit semantics |
| Why is a guard not authorization? | Browser code can be bypassed; server must enforce access |
| Why can a reactive form's `.value` omit a field? | Disabled controls; compare `getRawValue()` and the intended contract |
| How does a custom form control report interaction? | Proper value/disabled/touched or signal-control contract, including blur |
| Why not assume every Material control binds identically to Signal Forms? | Verify supported control integration and state/error behavior per component |
| What does `@defer` add beyond lazy routing? | Template-region dependency loading and rendering triggers |
| How is hydration different from rendering again? | Attach behavior to compatible existing server DOM |
| Why shouldn't an SSR service hold users in module-level state? | Server processes handle multiple users; state can leak across requests |
| Does changing locale convert money? | No; formatting and exchange conversion are different operations |
| Does a Material component guarantee WCAG compliance? | No; labels, content, focus flows, contrast and composition remain app responsibilities |
| Why use harnesses rather than internal CSS selectors? | Stable public interactions, less dependency on implementation DOM |
| Why aren't all topics implemented in the dashboard? | Cohesive features teach naturally; isolated labs prevent production complexity |

Suggested revision passes: first explain vocabulary; next trace data and control flow; finally diagnose a deliberately broken fixture and write the regression test. Keep unresolved questions in this document until they are answered by code, tests or verified documentation.

## 19. Completion checklist and workflow

### 19.1 Master checklist

**Current note — P12:** implementation and [final application verification are complete within limits](#p12-beforeafter-evidence-and-final-verification). P00–P11 checks below retain their historical scope, not current-suite sign-off. The broader unchecked curriculum is not implicitly complete. Next: P13, then P14 settings/ecosystem, separately scoped.

- [x] P00 baseline verified; root standards read.
- [x] Material 22/CDK installed locally with compatible peers; theme and shell complete.
- [x] Remote, local-mock and test backend responsibilities are clearly separated.
- [x] M05/P07 demo session, scoped headers and checkout/editor navigation guards implemented; final post-edit verification passed and refresh deferred.
- [x] M06 first P08 public-read implementation delivered and post-edit verification signed off: searchable users, parallel profile/posts, post/comments/dependent author and minimal projections.
- [x] M07 task CRUD, public URL filter/paging, bounded queue and local board implemented.
- [x] M07 final verification signed off within recorded limits.
- [x] Remaining P08 implementation: dashboard widgets and nine real-operator/timeline recipes delivered; suite/build evidence recorded.
- [x] P08 scoped completion signed off with test/build/artifact and focused browser evidence; explicit verification limits retained.
- [x] P09 core implementation: eight lazy entries, four actual selected-reader variants and three independent guarded forms comparisons, with metadata/compatibility lessons.
- [x] P09 core final verification: 1613 tests, production/mock builds, artifact/source checks and focused mock browser observations passed on 2026-09-28 within [explicit limits](#p09-verification--final), not full accessibility/E2E certification.
- [x] P10 implementation: three lazy local Material/date-time/CDK labs and typed same-column task pointer ordering alongside native moves, with source/ownership/limitations mapped.
- [x] P10 verification and closeout: final post-newline-fix suite/builds/artifacts, focused browser checks, 66-file hygiene, 108 local links/anchors and `git diff --check` passed within [recorded limits](#p10-verification--main-pass); port-4212 shutdown succeeded with no listener confirmed.
- [x] P11 full implementation: animation, profiling and fill-image lessons, quality configuration, 36-test browser suite, preloading/defer/lifetime and measured shell improvements delivered.
- [x] P11 supplied runs: 1777 unit / 36 browser tests, production build and two fresh production profiles passed; [results and limits](#p11-full-follow-up--2026-09-28).
- [x] P11 final main gates: 66-helper suite, lint/strict E2E types, bundle audit, security audit disposition and supplied final-source hygiene checks complete; documentation checks predate this edit, and warnings/findings remain explicit limitations.
- [ ] M08 settings/P14: persistence, locale preview and global mock reset UI explicitly deferred; toolbar theme remains session-only.
- [ ] Product/user/post/task/cart contracts and failure behavior implemented.
- [ ] F01–F08 foundations and C01–C20 component/template topics demonstrated.
- [ ] D01–D07 DI and S01–S09 state/resource topics revised; API maturity checked for advanced helpers.
- [x] Signal, Reactive and isolated template-driven core forms compared with independent drafts; P10 adds bounded independent Material date/time fixtures. Advanced `transformedValue` and broader forms work remain open.
- [ ] R01–R12 routing topics demonstrated with safe navigation behavior.
- [x] P08's nine RxJS recipes cover fundamentals, flattening, combination, errors, sharing and synthetic teardown with tests; real component cleanup has separate tests. This does not close all C/D/S/R or resource/form labs.
- [x] P10 Material/CDK implementation and colocated interaction/cleanup coverage present; source limitations recorded, not universal compatibility or full accessibility completion.
- [x] Material/CDK focus/interaction/harness evidence recorded from the main pass, with unit/browser scope and accessibility limits distinguished.
- [ ] Core acceptance scenarios verified with automated and manual evidence.
- [x] P11 performance baseline and full-follow-up local samples recorded, including actual Angular Chrome traces; no extension-GUI or field Web Vitals claim.
- [x] P12 intentional zoneless runtime migration and native callback lab implemented; Eager root deliberately retained, Zone.js test-only, legacy unit suite not globally migrated.
- [x] P12 earlier focused 63-unit/70-helper/8-browser checks, two axe scans with zero violations, lint and strict E2E types passed as supplied.
- [x] P12 final application verification: 1799 unit / 70 helper / 49 browser tests, 12 zero-violation axe scans, lint/types, production/mock builds, bundle audit and both production profiles passed after final copy fixes; limits and pre-document hygiene recorded.
- [ ] SSR/hydration, i18n and chosen advanced tracks completed separately.
- [ ] Legacy/awareness topics reviewed without adding unnecessary runtime dependencies.
- [ ] Remaining limitations and deferred topics recorded honestly.

### 19.2 Commands during implementation

Use project-local tools: `npm.cmd ci` for the lockfile, `npm.cmd start` (remote) or `npm.cmd run start:mock` (local), `npm.cmd run build`, `npm.cmd run ng -- version`, and `npm.cmd test -- --watch=false --browsers=ChromeHeadless`. Add `--code-coverage` when relevant. Use deliberate installs for new dependencies and commit matching lockfile changes.

P11 adds actual scripts: `npm.cmd run lint`, `npm.cmd run typecheck:e2e`, `npm.cmd run test:quality`, `npm.cmd run e2e` and `npm.cmd run e2e:a11y`. For production measurement, run `npm.cmd run build -- --stats-json`, then `npm.cmd run audit:bundle` and `npm.cmd run measure:browser`. The latter defaults to two profiles in installed Chrome, serves built artifacts on ephemeral loopback and owns cleanup. Playwright instead manages mock port 4213; never deploy mock builds or incidentally call live APIs/download browsers. No CI or Prettier is configured.

Before finishing a code milestone: inspect diagnostics, run the relevant checks, review the diff and `git diff --check`. Never claim a planned check passed. The v1.13/v1.14 closeouts remain historical. P12's final application gates and production comparisons completed as supplied in the [final record](#p12-beforeafter-evidence-and-final-verification). This two-document edit runs no terminal, application checks or dependency audits; supplied pre-document hygiene is not post-edit validation, and main will run the final post-document checks.

Before substantial Angular work, use configured MCP workspace discovery/best-practice/documentation tools when available. Verify version-specific advice against the installed public API. Never change system Angular CLI or Node.js.

### 19.3 First implementation instruction

Start with **P00, then P01 only**: verify the existing app, choose compatible Angular Material/CDK 22 packages, create the accessible Material shell/theme and initial lazy route placeholders, and add tests. Do not simultaneously migrate to zoneless, SSR, a new test runner or a state library.

Foundation through P11 retains its historical records. **P12 is implemented and [verified within limits](#p12-beforeafter-evidence-and-final-verification).** Next is **P13 SSR/hydration, then P14 settings/ecosystem**, separately scoped with no automatic next implementation. Settings/M08/P14, advanced resources/forms/async DI awareness, `transformedValue` and optional refresh remain deferred. The P00/P01 instruction above is the historical starting point, not the current next task.

## 20. Sources and verification notes

**Current P12 update — revision 1.15 / 2026-09-29:** the [implementation/source/test record](#p12--zoneless-migration--2026-09-29) and [final evidence](#p12-beforeafter-evidence-and-final-verification) record completed application verification after final copy fixes, test-only stabilization, fresh before/after production measurements and explicit limitations. Main-pass research fetched official zoneless/provider/ChangeDetectorRef/TestBed documentation and confirmed installed 22.1.7 stable declarations; MCP tools were unavailable, with no P12 MCP success claim. This edit changes only README and this blueprint, runs no terminal/application checks/audits and rechecks the two key reference pages. Final post-document links/hygiene/main checks are not claimed; main will run them. P00–P11 evidence below remains historical.

**Historical label for the following revision 1.14 paragraph:** its use of “Current” and “this request” refers to the P11 closeout, including its successful MCP calls, not this P12 session. All metrics, limits and then-next claims remain unchanged.

**Current P11 update — revision 1.14 / 2026-09-28:** the [full follow-up](#p11-full-follow-up--2026-09-28) and [source matrix](#p11-source-reading-matrix) record completed implementation and verification gates: supplied final unit/browser/helper suites, lint/types, production/mock builds, artifact audit, bounded security disposition, actual Angular track timestamps and two final-build production profiles. Main-pass MCP `list_projects`/`get_best_practices` succeeded in this request through the official local SDK transport; official animation/profiling/image docs were checked. This closeout edits **only README and this blueprint**, not the already validated UI or assertions; it uses no terminal and reruns no application checks, audits, browser measurements or MCP. Supplied local links/JSON/file-hygiene/diff checks predate this edit. Older Angular editor discovery diagnostics, deprecations, size warning and five moderate audit findings remain explicit limitations, not unfinished P11 implementation; there is no all-clean or full-certification claim.

**Historical P11 update — revision 1.13 / 2026-09-28:** the [baseline verification](#p11-verification--final) retains selected-tool, 1752-unit/18-browser, config/unit follow-up and hygiene evidence (42 scoped files / 124 local links), not fresh full-follow-up results. Its then-undelivered animation/profiling and open boot-shift statements are superseded by v1.14 within the new recorded limits. P00–P10 records and research notes below remain verbatim history, including then-next statements.

**P10 update — revision 1.12 / 2026-09-28:** the [source-reading matrix](#p10-source-reading-matrix) records local implementation APIs and limits; [final verification](#p10-verification--main-pass) records supplied post-newline-fix results, regenerated artifacts, focused sequential browser evidence, four remaining editor errors and successful hygiene/link/diff/server closeout. Main-pass MCP `list_projects`/`get_best_practices` actually succeeded through the local CLI SDK transport. Installed source is authoritative for stable timepicker and CVA/native-parser behavior. This closeout writes only README and this blueprint, without terminal/browser use, new external references or fresh MCP/application checks. P10 is complete within those limits; P11 quality/performance is next. The P09 update and research notes below retain their historical scope.

**P09 update:** [revision 1.11's implementation record](#p09--core-framework-resources-and-forms-labs--2026-09-27) retains its 2026-09-27 date, successful main-pass MCP calls and installed 22.1.7 contracts versus live 22.2 guidance. The [final verification record — 2026-09-28](#p09-verification--final) supersedes the historical checkpoint with supplied final application runs, scoped diagnostics and focused browser evidence. This closeout updates only README and this blueprint, validating local documentation without rerunning MCP, web research, tests, builds or browser checks. Earlier research notes below remain historical.

Primary references used for this blueprint:

- [Angular 22 release overview](https://angular.dev/events/v22).
- [Angular change-detection strategy API](https://angular.dev/api/core/ChangeDetectionStrategy).
- [Angular control flow and exhaustive switching](https://angular.dev/guide/templates/control-flow).
- [Signal Forms overview](https://angular.dev/guide/forms/signals/overview), [custom controls](https://angular.dev/guide/forms/signals/custom-controls), and [migration/compatibility](https://angular.dev/guide/forms/signals/migration).
- [RxJS/signal interop](https://angular.dev/ecosystem/rxjs-interop) and [stable rxResource API](https://angular.dev/api/core/rxjs-interop/rxResource).
- [HTTP configuration and backend behavior](https://angular.dev/guide/http/setup).
- [Incremental hydration defaults and triggers](https://angular.dev/guide/incremental-hydration).
- [Angular Material setup](https://material.angular.dev/guide/getting-started) and [Material 3 theming](https://material.angular.dev/guide/theming).
- [DummyJSON products](https://dummyjson.com/docs/products), [authentication](https://dummyjson.com/docs/auth), [users](https://dummyjson.com/docs/users), [carts](https://dummyjson.com/docs/carts), [todos](https://dummyjson.com/docs/todos), [posts](https://dummyjson.com/docs/posts), [comments](https://dummyjson.com/docs/comments), and [HTTP simulation](https://dummyjson.com/docs/http).

Verification on 2026-09-23: inspected the installed package versions and relevant Angular declarations; queried the configured Angular CLI MCP server for workspace discovery and best practices; reviewed the official documentation above. The MCP best-practice text contains some generic older recommendations, so the installed Angular 22 APIs and current version-specific documentation resolve those differences.

The release-blog redirect could not be used as a reliable content source; no unique claims depend on it. At document creation, no implementation or app tests were implied. The records above track historical implementation/verification through P07, final verification of M06/M07 and scoped P08 completion with focused browser evidence and explicit limits. P02/P03 repeated MCP and relevant HTTP/DummyJSON documentation checks without live mutation/auth calls. P05 successfully queried the local Angular MCP workspace/best-practice tools and verified installed Angular 22.1.7 Signal Forms declarations against the official submission/migration guides. P06 repeated local MCP workspace/best-practice calls and checked the official carts contract and Material stepper guidance. P07 successfully called `list_projects` and `get_best_practices` with Angular 22 guidance and fetched official authentication documentation; no live remote authentication was called. M06's main implementation pass also succeeded with `list_projects`/`get_best_practices` and fetched official users/posts/comments docs, as recorded in its research evidence; no live auth/mutations were performed. M07's successful main-pass MCP/todos research and the earlier status edit's official-documentation recheck are recorded separately above; research is not application verification. The remaining P08 main pass also successfully called local `list_projects` and `get_best_practices`; this status edit records supplied results without rerunning those calls or application checks. Installed declarations take precedence over examples from newer documentation. Material Signal Forms input/textarea/select integration is runtime-tested as recorded in section 9.3; P06 separately tests Reactive Forms checkbox/radio/CVA/stepper integration, not universal Signal Forms compatibility. P08's RxJS lab uses styled native controls, not a new Material integration claim.
