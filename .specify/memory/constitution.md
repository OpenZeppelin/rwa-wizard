<!--
Sync Impact Report
Version: 1.1.0 → 1.2.0
Modified Principles:
- Section I: Clarified layered package ownership (`@openzeppelin/codegen-core`, `@openzeppelin/codegen-rwa-common`, `@openzeppelin/rwa-config`, chain generators), browser-safe template sourcing defaults, and descriptor-driven module behavior
- Section II: Expanded the published headless package list to include `@openzeppelin/codegen-rwa-common`; clarified where shared RWA-domain generator behavior belongs
- Section III: Logger guidance now explicitly covers `@openzeppelin/codegen-rwa-common`
- Additional Constraints: Added browser-safe template sourcing and co-located module descriptor rules
- Development Workflow and Review Process: Replaced stale adapter-led review wording with codegen-boundary enforcement
- Sections I–II: `ui-builder-adapter-*` → `@openzeppelin/adapter-*`; local development now documents sibling `openzeppelin-adapters`
- Governance: Added coordination rule for `@openzeppelin/codegen-rwa-common` breaking changes
Templates:
- ✅ .specify/templates/plan-template.md (Constitution Check section aligns)
- ✅ .specify/templates/spec-template.md (requirements and user stories align)
- ✅ .specify/templates/tasks-template.md (phase structure and TDD align)
Follow-up TODOs: none
-->

# RWA Wizard Constitution

## Core Principles

### I. Codegen-Led, Chain-Agnostic Architecture (NON-NEGOTIABLE)

- The RWA Wizard app MUST remain chain-agnostic; all contract code generation, template rendering, and chain-specific logic reside exclusively in codegen generator packages (e.g., `@openzeppelin/codegen-rwa-stellar`, future `@openzeppelin/codegen-rwa-evm`).
- The UI MUST NOT contain chain-specific parsing, formatting, contract scaffolding, or template logic; it consumes generic interfaces and delegates generation to codegen package boundaries.
- Feature detection drives the UI: the app MUST query generator capabilities and the compliance module registry to enable/disable wizard steps, validation rules, and ecosystem-specific hints dynamically.
- ZIP generation of chain-specific artifacts (contracts, scripts, docs) MUST be delegated to codegen generator packages, not embedded in the wizard UI. The core generation pipeline infrastructure (`@openzeppelin/codegen-core`) provides file tree assembly, ZIP packaging, validation framework, and progress reporting — all chain-agnostic and contract-agnostic.
- The shared `RWAConfig` type (`@openzeppelin/rwa-config`) describes _what_ the user wants; chain-specific generators decide _how_ to produce it. The config package is the single source of truth for the configuration schema.
- Shared package boundaries MUST remain explicit: `@openzeppelin/codegen-core` owns generator-agnostic infrastructure, `@openzeppelin/codegen-rwa-common` owns reusable RWA-domain generator behavior, `@openzeppelin/rwa-config` remains schema-first and behavior-light, and chain packages own ecosystem-specific rendering, wiring, and deploy semantics.
- Codegen packages consumed by the browser MUST remain browser-safe by default. Node-only capabilities such as local checkout/template overrides are permitted only as explicit opt-ins behind generation options and must be runtime-guarded from browser execution paths.
- Adapter packages (`@openzeppelin/adapter-*`, published from the `openzeppelin-adapters` repository) remain for on-chain interaction (wallet connection, transaction formatting, contract queries) and ecosystem metadata (chain names, icons, networks). They are NOT responsible for code generation.
- Rationale: Ensures the wizard is scalable to new chains without UI code changes, strictly separates presentation from generation logic, preserves clean shared-package layering, and enables headless usage of codegen packages by CLI tools and AI agents.

### II. Reuse-First & Monorepo Integration (NON-NEGOTIABLE)

- The application MUST reuse `@openzeppelin/ui-*` packages (types, utils, renderer, storage, components, react, styles) rather than re-implementing core functionality.
- Adapter packages use the `@openzeppelin/adapter-*` namespace (e.g., `@openzeppelin/adapter-evm`, `@openzeppelin/adapter-stellar`) for on-chain interaction and ecosystem metadata.
- The monorepo produces three publicly published codegen packages:
- The monorepo produces four publicly published headless generation packages:
  - `@openzeppelin/codegen-core` — chain-agnostic generation pipeline (file tree, ZIP, validation framework, progress)
  - `@openzeppelin/codegen-rwa-common` — shared RWA-domain generator helpers (ownership, roles, other cross-chain RWA semantics)
  - `@openzeppelin/rwa-config` — shared `RWAConfig` type and validation schema (chain-agnostic, schema-first)
  - `@openzeppelin/codegen-rwa-stellar` — Stellar/Soroban RWA contract generator (first ecosystem implementation)
- These headless generation packages are standalone and usable by the wizard app, CLI tools, and AI agents without React or browser dependencies.
- Local development against the `openzeppelin-ui` and `openzeppelin-adapters` monorepos MUST use the shared `oz-ui-dev` workflow backed by the checked-in `.openzeppelin-dev.json` and `.pnpmfile.cjs` files. Use `pnpm dev:local` / `pnpm dev:npm` so package manifests stay registry-clean while local tarballs or file paths are injected only during install.
- New shared UI utilities, types, or interaction interfaces required by RWA Wizard should ideally be contributed upstream to `openzeppelin-ui` packages or adapter packages first, then consumed here. Codegen-specific infrastructure belongs in `@openzeppelin/codegen-core`; reusable RWA-domain generator behavior belongs in `@openzeppelin/codegen-rwa-common`; schema/default-only concerns stay in `@openzeppelin/rwa-config`.
- Patterns for provider hierarchy, ecosystem management, config services, and storage MUST follow those established by the UI Builder and Role Manager applications.
- Rationale: Guarantees consistency with the broader OpenZeppelin tool ecosystem, validates the standalone usability of UI Kit packages, and enables headless code generation across multiple consumption channels.

### III. Type Safety, Linting, and Code Quality (NON-NEGOTIABLE)

- TypeScript strictness, shared linting, and formatting rules apply throughout the repository.
- `console` usage in source code is prohibited; use `logger` from `@openzeppelin/ui-utils` (exceptions only in tests/scripts). Headless library packages (`codegen-core`, `codegen-rwa-common`, `rwa-config`, `codegen-rwa-stellar`) MAY use `@openzeppelin/ui-utils` for `logger` — the package has no React or heavy UI dependencies. However, since `ui-utils` currently uses a barrel export with no subpath imports, codegen packages MUST verify that tree-shaking (via tsdown) eliminates browser-only modules (`RouterService`, `AnalyticsService`, `deepLink`) from the output bundle to ensure standalone Node.js compatibility. Public API diagnostic output SHOULD prefer structured return values (`ValidationResult`, `ProgressEvent`) over logging where possible.
- `any` types are disallowed without explicit justification.
- React components MUST be typed with `React.FC` or explicit props interfaces; hooks must have explicit return types.
- The canonical `RWAConfig` data model (owned by `@openzeppelin/rwa-config`) MUST be fully typed with no implicit `any` fields; chain-specific extensions use discriminated unions or generics. The wizard app consumes this type; it does not define its own configuration shape.
- Rationale: Enforces consistent quality gates and prevents regressions in the client-side logic.

### IV. UI/Design System Consistency (NON-NEGOTIABLE)

- The UI MUST implement the OpenZeppelin design system using `@openzeppelin/ui-components` and `@openzeppelin/ui-styles`.
- Styling leverages Tailwind CSS v4; use the `cn` utility for class composition.
- Layouts and patterns (wizard steps, forms, dialogs, lists) MUST match the UI Builder and Role Manager applications' UX to provide a unified user experience.
- Prefer `lucide-react` icons; avoid emojis or inline raw SVG when reusable assets exist.
- Rationale: Reduces cognitive load for users switching between tools and minimizes distinct maintenance of UI primitives.

### V. Testing and TDD for Business Logic (NON-NEGOTIABLE)

- All application-specific business logic (e.g., wizard config validation, storage management, ZIP generation orchestration, hook state logic, data transformers) MUST follow TDD: write failing tests first.
- UI components (layouts, pages, wizard step presentational components) do NOT require unit tests unless they contain complex internal logic. Focus testing efforts on hooks, services, and utility functions.
- Vitest is the standard for unit/integration tests.
- The app MUST be testable with mock adapters and mock generators; wizard components should not tightly couple to live network sockets or real adapter implementations during tests.
- Rationale: Preserves confidence in the wizard orchestration and persistence layer independent of blockchain availability, while avoiding brittle tests for visual components.

### VI. Tooling, Persistence, and Autonomy (NON-NEGOTIABLE)

- The application MUST function as a standalone client-side SPA (Single Page Application) with no mandatory backend dependencies.
- Local persistence MUST use `@openzeppelin/ui-storage` (Dexie/IndexedDB) for user data (draft wizard configs, templates/presets, recent projects, user preferences).
- ZIP generation MUST be performed entirely in-browser via `@openzeppelin/codegen-core` (which wraps JSZip internally); no server-side build or generation service is required.
- Build outputs utilize Vite; releases are managed via Changesets.
- Rationale: Ensures the tool is privacy-preserving, works offline (for cached data), and is easy to host.

## Additional Constraints

- **Storage**: Do not use `localStorage` for complex data; use the typed IndexedDB layer via `@openzeppelin/ui-storage`.
- **Security**: Do not hardcode chain secrets; rely on wallet connections or user input. Generated scaffolding MUST avoid privileged functions with missing auth checks.
- **Forms**: Use `@openzeppelin/ui-renderer` for transaction forms where applicable to inherit validation and schema logic from adapters.
- **ZIP Generation**: ZIP output MUST be deterministic from a given `RWAConfig`. The generation pipeline (`@openzeppelin/codegen-core`) MUST support progress callbacks for UI feedback. The public API exposes both raw file tree output (`generate()`) and ZIP output (`generateZip()`).
- **Template Sourcing**: Generators that need upstream templates MUST default to bundled or otherwise browser-safe template sources for app consumption. Filesystem-backed or checkout-backed overrides are allowed only for non-browser runtimes and MUST be explicit opt-ins.
- **Module Descriptors**: Generators with configurable module catalogs MUST co-locate module metadata, capability flags, and generator behavior in module descriptors instead of scattering the same module knowledge across registries, deployment helpers, and switch statements.
- **Privacy**: When wizard configuration involves identity data (e.g., plaintext identity registry storage), the UI MUST surface explicit privacy warnings.
- **Wizard State**: The wizard MUST support draft persistence (auto-save) and resumption across sessions via storage.

## Development Workflow and Review Process

- Use `pnpm` for all tasks.
- **Local UI development**: Run `pnpm dev:local` to use local `@openzeppelin/ui-*` from `../openzeppelin-ui` and `@openzeppelin/adapter-*` from `../openzeppelin-adapters` (see `pnpm dev:adapters:local` / `dev:uikit:local` for single-family overrides). Run `pnpm dev:npm` to switch back to npm packages.
- **Docker testing**: Run `pnpm docker:dev` to build and run the Docker container locally.
- Commit messages MUST follow Conventional Commits. Check available scopes and limits before committing.
- PRs MUST verify that changes to UI Kit dependencies are correctly versioned.
- Code review enforces strict separation of concerns: rejection if UI contains chain-specific logic that belongs in `@openzeppelin/codegen-*` or `@openzeppelin/adapter-*` packages.
- Code review enforces strict separation of concerns: rejection if UI contains chain-specific generation logic, template logic, or bypasses codegen package boundaries, or if it re-implements logic that belongs in `@openzeppelin/codegen-*` or `@openzeppelin/adapter-*` packages.
- Code review enforces Reuse-First: reviewers verify reuse attempts before approving new modules.

## Governance

- This constitution supersedes other practices; non-negotiable rules MUST be enforced during development and review.
- Amendments require a documented proposal and PR review.
- Breaking changes to upstream `openzeppelin-ui` interfaces require coordination with the UI Kit repository maintainers.
- Breaking changes to adapter interfaces or generator boundaries require coordination with the `openzeppelin-adapters` and/or UI Kit maintainers as appropriate.
- Breaking changes to `@openzeppelin/codegen-core` or `@openzeppelin/rwa-config` public APIs require coordination across all consuming generator packages and the wizard app.
- Breaking changes to `@openzeppelin/codegen-core`, `@openzeppelin/codegen-rwa-common`, or `@openzeppelin/rwa-config` public APIs require coordination across all consuming generator packages and affected app surfaces.

**Version**: 1.2.0 | **Ratified**: 2026-02-26 | **Last Amended**: 2026-04-13
