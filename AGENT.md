# Engineering standards for this workspace

## Scope and working agreement

- Read and follow this file before planning, generating, reviewing, or changing code in this repository. It is the canonical project guidance linked by `.github/copilot-instructions.md`.
- Apply these standards to new and modified code. Do not rewrite unrelated code merely to adopt a newer pattern.
- Read the current files first, preserve user edits, and choose the smallest maintainable solution. Explain material trade-offs and justified exceptions.
- Check installed package versions and public APIs before using examples from newer documentation. Avoid experimental APIs unless explicitly requested.
- Never change global Angular CLI, system Node.js, global npm packages, or machine configuration for this project.
- Never claim a check passed unless it actually ran successfully. Report missing tools, skipped checks, warnings, and remaining risks.
- Instructions guide agent behavior; they do not replace compiler checks, tests, accessibility checks, security review, or human review.

## Project baseline and commands

- Angular 22.1.x, Angular CLI 22.1.x, TypeScript 6.0.x and RxJS 7.8.x. Zone.js 0.15.x is a test-only development dependency for existing Jasmine/Karma clocks and Zone compatibility tests. Treat `package.json` and `package-lock.json` as the source of truth.
- Node.js 22.23.2 is a local development dependency. Use npm scripts so both Node and Angular CLI resolve locally; do not invoke global `ng` or download an unpinned CLI with `npx`.
- Install with `npm.cmd ci` for the committed lockfile; use `npm.cmd install` when intentionally updating dependencies. Commit dependency and lockfile changes together.
- Start: `npm.cmd start`. Production build: `npm.cmd run build`. Workspace CLI: `npm.cmd run ng -- <arguments>`.
- Unit tests: `npm.cmd test -- --watch=false --browsers=ChromeHeadless`. Coverage when relevant: append `--code-coverage`.
- On Windows PowerShell, use `npm.cmd` when forwarding arguments; the `npm.ps1` wrapper in this environment has dropped flags after `--`. On other platforms use `npm`.
- Unit tests use Jasmine/Karma. P11 deliberately adds a curated Angular ESLint correctness baseline (`npm.cmd run lint`), strict browser-test checking (`npm.cmd run typecheck:e2e`), and Playwright with axe (`npm.cmd run e2e`, or `npm.cmd run e2e:a11y`). Prettier and CI are not configured; this is not a runner migration or full type-aware lint/security audit.
- Browser tests use installed Chrome, one worker and a managed loopback mock server on port 4213, with external-request/page-error guards. Do not reuse an unknown server, download browsers or call live APIs incidentally. Generated `test-results` and `playwright-report` stay ignored.
- Quality helper tests: `npm.cmd run test:quality`. After `npm.cmd run build -- --stats-json`, run `npm.cmd run audit:bundle` and `npm.cmd run measure:browser`. The latter serves only built production artifacts on an ephemeral loopback port and closes its own browser/server. Local timings and gzip estimates are not field Web Vitals or a security certification.
- Respect `.editorconfig`: UTF-8, two spaces, final newline, single quotes in TypeScript. Preserve nearby formatting and semicolon style.
- Keep strict TypeScript and Angular template checking enabled. Preserve `rootDir: "./src"`; do not suppress diagnostics to hide new errors.

## Angular architecture and organization

- Use standalone components, directives, and pipes. Standalone is the default; omit redundant `standalone: true`. Introduce NgModules only for required legacy integration.
- Keep bootstrapping in `src/main.ts`, application providers in `app.config.ts`, and route definitions in `app.routes.ts` or feature route files.
- Organize growing code by feature/domain. Colocate a component, template, styles, and tests. Extract shared code only when it has a clear reusable purpose.
- Preserve this repository's kebab-case names and `.component.ts`, `.service.ts`, and `.spec.ts` conventions. Use `app-` component selectors.
- Keep components focused on presentation and interaction; put reusable business logic and data access behind focused services or pure functions.
- Avoid circular dependencies, deep imports into package internals, broad barrel files that hide cycles, speculative abstractions, and unnecessary state libraries.
- Import only template dependencies that are used, rather than `CommonModule` by default.

## Components, dependency injection, and change detection

- Angular 22 defaults to OnPush change detection. For new components, use that default instead of redundantly specifying it.
- P12 deliberately enables `provideZonelessChangeDetection()` and removes Zone.js from application build polyfills. Keep the existing root's explicit `ChangeDetectionStrategy.Eager`: checking strategy and scheduling are independent. Do not reintroduce application Zone.js or force ticks to hide a missing notification.
- Native callbacks must notify through template-read signals, `AsyncPipe` or an intentional `markForCheck` boundary. `NgZone.run`/`runOutsideAngular` may remain for compatibility but are not zoneless notifications. Reactive Forms async state needs an observable-to-view notification bridge.
- Prefer `input()`, `input.required()`, and `output()` for new public component APIs. Use `model()` only for a genuine two-way binding contract.
- Prefer signal-based queries for new code. Avoid broad conversions of existing decorator APIs unless needed by the task.
- Prefer `inject()` in valid injection contexts. Do not call it from arbitrary event handlers or asynchronous callbacks; capture dependencies during initialization.
- Prefer Angular 22's `@Service` for new root singleton services when its behavior fits; existing `@Injectable({ providedIn: 'root' })` remains valid. Use explicit provider scopes for state that must not be shared application-wide.
- Keep injected dependencies private and readonly when possible. Use protected for template-only members; expose public members only for a real API.
- Put host bindings and listeners in decorator `host` metadata rather than adding new `@HostBinding` or `@HostListener` usages.
- Use lifecycle hooks for their intended timing and implement the corresponding interfaces. Clean up manually created listeners, observers, timers, and other resources with `DestroyRef` or their owning lifecycle.
- Avoid manual `detectChanges()`, `ApplicationRef.tick()`, or timing hacks to compensate for a broken data flow. Fix the reactive update path first.

## TypeScript standards

- Keep strict typing. Avoid explicit or implicit `any`; use `unknown` at untrusted boundaries and narrow with validation, type guards, or discriminants.
- Infer obvious local types. Give exported functions, service contracts, and domain boundaries clear parameter and return types.
- Use `import type` for type-only dependencies where appropriate. Import from supported public entry points.
- Prefer small domain types and discriminated unions over loosely related booleans, broad objects, or magic strings. Use exhaustive handling for finite states.
- Prefer `const`, readonly properties/collections, pure functions, and immutable updates. Remember that `readonly` is compile-time and shallow, not runtime freezing.
- Avoid unsafe casts, double assertions, non-null assertions, and definite-assignment assertions. Establish the invariant or model missing values instead.
- Use `satisfies` when checking an object against a contract while retaining useful inference; it does not validate external data at runtime.
- Distinguish `null`, `undefined`, empty, loading, and error states intentionally. Use optional chaining and nullish coalescing only when their semantics match the domain.
- Catch errors as `unknown` and narrow them. Handle rejected promises; do not leave fire-and-forget work without intentional error handling.
- Keep functions cohesive, name values by meaning and units, and replace repeated domain constants with named definitions. Comment why rather than narrating obvious code.
- Do not disable strict compiler flags, add blanket `@ts-ignore`, or increase bundle budgets merely to make a failing check pass.

## Signals and state ownership

- Use signals for synchronous UI state, `computed()` for derived values, and RxJS for asynchronous event composition, cancellation, and concurrency.
- Update signals with `set()` or immutable `update()` results. Do not mutate nested objects/arrays in place and expect change tracking.
- Keep writable state private to its owner; expose read-only signals or observable views to consumers. Avoid multiple writable sources for the same data.
- Use `linkedSignal()` when derived state genuinely also needs local writes/reset behavior. Prefer `computed()` for purely derived state.
- Use `effect()` for necessary imperative side effects, not for copying state between signals or replacing a computed value. Supply cleanup for ongoing effects.
- Create `toSignal()` and `toObservable()` conversions once and reuse them, rather than recreating subscriptions in getters, templates, or reactive computations.
- `toSignal()` subscribes immediately: provide an initial value or model `undefined`; use `requireSync` only for a source guaranteed to emit synchronously. Handle observable errors before exposing the signal to the template.
- Respect injection-context requirements and injector lifetime for interop utilities. A root-scoped service does not share a component's destruction lifetime.

## RxJS standards

- Compose streams with pipeable operators instead of nested subscriptions. Keep transformations pure; use `tap` only for intentional side effects.
- Suffix observable variables with `$`. Do not add `$` to signals, promises, or ordinary values.
- Prefer `AsyncPipe` for template consumption or a single `toSignal()` boundary. Subscribe imperatively only when an actual side effect needs it.
- For long-lived imperative subscriptions, use `takeUntilDestroyed()`. Outside an injection context, pass a previously injected `DestroyRef` explicitly.
- Place lifecycle teardown after higher-order operators so active inner subscriptions are also cancelled. Test teardown for ongoing streams.
- Finite HTTP streams normally complete; cancellation can still be necessary when a view is destroyed or a newer request supersedes an older one.
- Choose flattening by business semantics:
  - `switchMap`: replace stale reads, searches, or selections; do not use for writes that must all complete.
  - `concatMap`: serialize work when order matters and each operation must complete; consider queue growth.
  - `mergeMap`: allow independent concurrency, with an appropriate concurrency limit for costly work.
  - `exhaustMap`: ignore repeated triggers while one operation is active, such as duplicate submissions.
- For search/input streams, apply appropriate debouncing and distinctness before requests. Cancellation of a request does not guarantee rollback of server-side work.
- Put `catchError` at the scope that should recover. Catch within a higher-order request when the outer interaction stream must remain alive. Do not silently replace every failure with an empty success value.
- Use `finalize` for cleanup that must run on completion, error, or unsubscribe. Ensure loading indicators remain correct under overlapping or cancelled requests.
- Retry only suitable transient failures, with a bounded policy and delay/backoff. Do not blindly retry mutations or authentication/validation errors.
- Understand combination semantics: `combineLatest` needs an emission from every input; `forkJoin` needs every source to emit and complete; `withLatestFrom` is driven by the primary source.
- Use sharing only to solve an actual duplication/cache problem. For shared subscriptions, consider `shareReplay({ bufferSize: 1, refCount: true })`, but define cache lifetime and invalidation explicitly; it is not an automatic eviction policy for completed requests.
- Keep subjects private and expose `asObservable()` when a subject is appropriate. Prefer existing sources or signals over adding subjects solely to relay state.
- Avoid deprecated `toPromise()`. Use `firstValueFrom`/`lastValueFrom` only at a required promise boundary, with defined empty-source, timeout, and completion behavior.
- Test ordering, cancellation, errors, retries, and unsubscribe behavior using RxJS `TestScheduler` when timing is central to the logic.

## Templates, styles, and performance

- Use built-in `@if`, `@for`, and `@switch`. Track lists with stable unique identity; use index tracking only for truly static, non-reordering lists.
- Keep expensive computations out of templates. Prefer computed values or pure pipes, and avoid allocations or side-effecting method calls during rendering.
- Prefer direct class and style bindings over `ngClass`/`ngStyle`. Keep styles component-scoped; avoid `::ng-deep` and global overrides without a clear integration need.
- Use external HTML/CSS for substantial views, consistent with this app. Small inline templates are acceptable when they remain easy to read.
- Use `NgOptimizedImage` for suitable image URLs, supply dimensions or an appropriate fill container, and prioritize only critical images. Do not apply it to inline base64 images.
- Lazy-load feature routes and use `@defer` for genuinely noncritical expensive UI with useful loading/error states. Do not defer the primary content merely to improve a metric.
- Preserve bundle budgets and measure before optimizing. Avoid unnecessary dependencies, large eager imports, and repeated HTTP subscriptions.
- If SSR/hydration is added, guard browser-only APIs, avoid render-time nondeterminism, and use supported DOM/render lifecycle APIs to prevent hydration mismatches.

## Routing, forms, and HTTP

- Define typed `Routes`, lazy-load with `loadComponent`/`loadChildren` where useful, and provide not-found/error flows. Use router APIs for internal navigation.
- Prefer functional guards, resolvers, and interceptors. Return a redirect result from a guard instead of imperatively navigating and returning false.
- Treat route guards as navigation UX, never as server-side authorization. Validate route/query parameters before use.
- For new forms, prefer Angular 22's stable Signal Forms when appropriate. Typed Reactive Forms are a supported alternative; preserve existing form architecture rather than mixing systems casually.
- With Reactive Forms, use typed controls and non-nullable controls when the model requires them. Avoid new untyped or template-driven forms for complex workflows.
- Keep validation pure, expose useful field errors, and handle pending, invalid, submitting, success, and failure states. Avoid duplicate submissions and preserve user input on failure.
- Use `HttpClient` and provider-based configuration for application HTTP. Centralize cross-cutting concerns in focused interceptors without hiding domain-specific error handling.
- An HTTP generic type is not runtime validation. Validate untrusted responses where correctness or security depends on their shape.
- Use safe parameter construction and correctly scoped authentication headers. Do not attach credentials to arbitrary third-party URLs.
- Keep data access out of templates and present loading, empty, error, and retry states deliberately. Use mocks rather than real services in unit tests.

## Accessibility and security

- Target WCAG 2.2 AA. Prefer native semantic HTML and controls; use ARIA only when necessary and keep it synchronized with state.
- Provide labels, descriptive accessible names, appropriate image alternatives, correct button types, visible keyboard focus, and logical heading/landmark structure.
- Support keyboard-only operation, focus restoration for dialogs/navigation, accessible form errors, reduced motion, responsive layouts, and adequate contrast. Never communicate state by color alone.
- Validate accessibility with keyboard checks and an automated tool such as axe when available; automated checks do not prove full WCAG conformance.
- Rely on Angular's safe binding and sanitization. Avoid direct untrusted DOM/HTML insertion and `bypassSecurityTrust*` unless independently justified and reviewed.
- Never put secrets in source, client-side environment files, bundles, logs, test fixtures, or MCP configuration. Browser configuration is public, even when injected at build time.
- Keep authorization and sensitive validation on the server. Do not log tokens or personal data; use redacted, actionable diagnostics.
- Review dependency changes and peer compatibility. Do not use forced installs or forced audit fixes to conceal incompatibilities.

## Testing and definition of done

- Add or update colocated Jasmine tests for changed behavior, regressions, and important edge cases. Import standalone components into `TestBed`, rather than declaring them.
- Test public behavior and rendered output rather than private implementation details. Use descriptive cases and deterministic fixtures.
- Cover loading/empty/error states, input/output interactions, validation, cancellation, and cleanup where applicable.
- Use `provideHttpClientTesting()` after `provideHttpClient()` and verify outstanding requests for HTTP tests. Use router testing utilities rather than real navigation where appropriate.
- Avoid arbitrary timeouts or real network calls. Use the asynchronous testing approach supported by the current runner; do not mix fake clock systems.
- Existing Karma polyfills retain `zone.js`/`zone.js/testing`; not every legacy unit spec is zoneless. New scheduling regressions explicitly provide `provideZonelessChangeDetection()` and await `whenStable()` after delivering the callback, without forced `detectChanges()`. Zone-free browser tests and the production artifact audit independently guard runtime builds.
- For code changes, run `npm.cmd run build` and the single-run headless test command. Add targeted tests first when fixing a bug.
- Check editor diagnostics, review the diff, and run `git diff --check`. Do not introduce generated build outputs, secrets, unrelated formatting, or unintended dependency changes.
- For documentation/configuration-only work, validate links/JSON and relevant tool startup instead of claiming application tests were rerun.
- Report what changed, what was verified, and any limitations. Keep this guidance current when a deliberate architecture or tooling change is accepted.

## Angular MCP and instruction discovery

- `.vscode/mcp.json` configures the official Angular CLI MCP server already supplied by the local `@angular/cli` dependency. No global server installation or API key is required.
- The configuration targets this Windows workspace and invokes `node_modules/node/bin/node.exe` directly. Its child-process PATH prefers workspace tools without modifying the system PATH. Adapt the executable and path separator explicitly if moving to another OS.
- After installing dependencies, use VS Code's **MCP: List Servers**, select **angularCli**, and start it if needed. Review any trust/permission prompts; do not disable tool approvals globally.
- When available, use `list_projects` to confirm workspace context and `get_best_practices` for version-aligned guidance before substantial Angular work. Use `search_documentation` to verify unfamiliar APIs.
- Build/test/dev-server tools can execute workspace code. Use them only within the requested scope and stop development servers you start when no longer needed. Never invoke deployment targets without explicit authorization.
- Documentation search can use the internet; do not include secrets or private source in search queries. `--read-only` and `--local-only` may be added when those restrictions are desired.
- If MCP is unavailable, report that and use local CLI tools and official documentation; do not pretend MCP tools ran.
- `.github/copilot-instructions.md` is the automatically discoverable entry point. `.vscode/settings.json` enables instruction files and linked guidance for the VS Code Local agent. Other clients must support that format or be configured to load this file explicitly.
- These are workspace standards, not a claim of deterministic enforcement or global preferences for unrelated repositories.

## References

- [Angular AI guidance](https://angular.dev/ai/develop-with-ai) and [official best practices](https://angular.dev/assets/context/best-practices.md).
- [Angular RxJS interop](https://angular.dev/ecosystem/rxjs-interop) and [lifecycle teardown](https://angular.dev/ecosystem/rxjs-interop/take-until-destroyed).
- [Angular CLI MCP](https://angular.dev/ai/mcp) and [VS Code MCP configuration](https://code.visualstudio.com/docs/agents/reference/mcp-configuration).
- [VS Code custom instructions](https://code.visualstudio.com/docs/copilot/customization/custom-instructions).

Guidance checked against Angular 22 documentation on 2026-09-23. Recheck version-sensitive recommendations during future upgrades.
