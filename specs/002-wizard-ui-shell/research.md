# Research: RWA Wizard UI Shell

## Decision 1: Persist drafts with a dedicated `@openzeppelin/ui-storage` repository

- **Decision**: Implement draft persistence in `apps/rwa-wizard` with a dedicated Dexie database created through `createDexieDatabase(...)`, a typed draft repository extending `EntityStorage<WizardDraftRecord>`, and React-facing hooks built on the same storage abstractions used by UI Builder and Role Manager.
- **Rationale**: This matches the constitution, keeps persistence fully client-side, and reuses proven OpenZeppelin patterns for schema versioning, typed storage access, and IndexedDB-backed repositories.
- **Alternatives considered**:
  - `localStorage`: rejected because the constitution forbids complex data storage there and it lacks typed schema/migration support.
  - Custom Dexie wiring without `@openzeppelin/ui-storage`: rejected because it would duplicate a solved shared pattern.

## Decision 2: Use lazy draft creation plus debounced autosave

- **Decision**: Do not persist an empty draft immediately when the user opens the wizard. Start with an ephemeral in-memory draft, create a persisted draft only after meaningful content exists, and then autosave with a debounce window similar to UI Builder.
- **Rationale**: This avoids clutter from empty drafts, keeps the draft list useful, and mirrors the best behavior already implemented in UI Builder’s autosave lifecycle.
- **Alternatives considered**:
  - Create a persisted record as soon as the wizard opens: rejected because it pollutes storage with empty drafts.
  - Explicit save only: rejected because the clarified spec requires autosave during editing.

## Decision 3: Support versioned import/export through the storage-backed workflow

- **Decision**: Export drafts as a versioned JSON envelope and import them into newly created drafts only, generating new draft IDs while preserving meaningful metadata such as timestamps where appropriate.
- **Rationale**: This is already a successful pattern in UI Builder, fits the clarified import requirement, and keeps import behavior deterministic and isolated from the currently open draft.
- **Alternatives considered**:
  - Export raw draft records without version metadata: rejected because it makes migration and backward compatibility harder.
  - Merge imported content into the current draft: rejected because the spec explicitly forbids that for the first iteration.

## Decision 4: Model targets with a metadata-first registry plus lazy runtime loading

- **Decision**: Create an app-local target registry with ordered target IDs and sparse feature overrides, paired with a target manager that exposes lightweight metadata synchronously and lazy-loads full codegen package runtimes only when a target is actionable.
- **Rationale**: This copies the strongest ecosystem pattern from UI Builder and Role Manager: fast first render, visible disabled targets, and centralized lazy-loading/caching behavior.
- **Alternatives considered**:
  - Static import of all target packages up front: rejected because it increases bundle cost and selector startup work.
  - A single boolean “supported” flag with no hidden/visible-disabled distinction: rejected because existing apps rely on separate `enabled` and `showInUI` semantics.

## Decision 5: Keep the app boundary at an app-local `RwaCodegenService`

- **Decision**: UI components interact only with an app-local codegen service interface that exposes `validate`, `generateZip`, and module-discovery behaviors using `RWAConfig` as the canonical payload. The real implementation delegates to `@openzeppelin/codegen-rwa-stellar`; mock implementations use the same contract.
- **Rationale**: This preserves the constitution’s separation of concerns, keeps chain-specific logic out of components, and makes temporary mocks cheap to swap in while generator gaps remain.
- **Alternatives considered**:
  - Direct package imports inside React components: rejected because it tightly couples presentation to codegen details and makes mocking harder.
  - App-side recreation of Stellar validation rules: rejected because those rules belong in the generator package.

## Decision 6: Use fixture-backed mocks behind the same service boundary

- **Decision**: All temporary mock behavior lives behind the same codegen service contract and returns shapes aligned with `ValidationResult`, `GenerationResult`, ZIP delivery, and module catalogs expected from the real packages.
- **Rationale**: This lets the team fully test navigation, visuals, and handoff states without blocking on unfinished generator work while minimizing drift from the eventual real integration.
- **Alternatives considered**:
  - Inline component-level mocks: rejected because they scatter temporary behavior and make later cleanup error-prone.
  - Free-form fake data unrelated to package contracts: rejected because it would create rework risk at integration time.

## Decision 7: Deliver generation success as a ZIP download with coarse UI status states

- **Decision**: Treat downloadable ZIP delivery as the primary successful result in the first iteration, with the UI surfacing coarse handoff states such as validating, generating, packaging, success, and error.
- **Rationale**: This matches the clarified product requirement, works naturally in a client-side browser app, and avoids inventing an unnecessary in-app artifact workspace for the first iteration.
- **Alternatives considered**:
  - In-app artifact browsing as the default outcome: rejected because it adds surface area that the spec does not require.
  - No user-visible generation status: rejected because failure and mock-gap states must remain understandable.

## Decision 8: Incubate reusable components locally before promoting them upstream

- **Decision**: Build any missing reusable wizard patterns locally inside `apps/rwa-wizard` first, track them in the component inventory, and promote only validated candidates to `openzeppelin-ui` with example coverage afterward.
- **Rationale**: This matches the clarified spec and reduces the risk of prematurely upstreaming abstractions before their real needs are understood in the wizard context.
- **Alternatives considered**:
  - Build every new pattern in `openzeppelin-ui` first: rejected because it slows iteration and increases churn when requirements are still settling.
  - Keep all new patterns wizard-only forever: rejected because the spec explicitly wants reusable candidates identified and promoted.

## Decision 9: Follow prototype layout at the macro layer only

- **Decision**: Reuse the prototype’s screen composition, sidebar/wizard framing, and overall information hierarchy while relying on established `@openzeppelin/ui-components` styling for the actual primitives.
- **Rationale**: This keeps the intended UX direction without forcing visual divergence or style overrides into shared OpenZeppelin components.
- **Alternatives considered**:
  - Pixel-perfect prototype recreation by overriding shared components: rejected because the spec explicitly forbids that.
  - Ignore prototype layout entirely: rejected because the user wants its macro patterns preserved.
