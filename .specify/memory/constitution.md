<!--
Sync Impact Report
Version: 0.0.0 → 1.0.0
Modified Principles: Initial ratification — all principles are new
- Section I: Adapter-Led, Chain-Agnostic Architecture
- Section II: Reuse-First & Monorepo Integration
- Section III: Type Safety, Linting, and Code Quality
- Section IV: UI/Design System Consistency
- Section V: Testing and TDD for Business Logic
- Section VI: Tooling, Persistence, and Autonomy
- Additional Constraints: ZIP generation, security, forms, storage
- Development Workflow: pnpmfile-based local dev, docker, conventional commits
Templates:
- ✅ .specify/templates/plan-template.md (Constitution Check section aligns)
- ✅ .specify/templates/spec-template.md (requirements and user stories align)
- ✅ .specify/templates/tasks-template.md (phase structure and TDD align)
Follow-up TODOs: none
-->

# RWA Wizard Constitution

## Core Principles

### I. Adapter-Led, Chain-Agnostic Architecture (NON-NEGOTIABLE)

- The RWA Wizard app MUST remain chain-agnostic; all blockchain interactions, contract template generation, and chain-specific logic reside exclusively in chain-specific adapters (e.g., `@openzeppelin/ui-builder-adapter-evm`, `@openzeppelin/ui-builder-adapter-stellar`).
- The UI MUST NOT contain chain-specific parsing, formatting, contract scaffolding, or template logic; it consumes generic interfaces and delegates generation to adapter-led boundaries.
- Feature detection drives the UI: the app MUST query adapter capabilities and ecosystem registry to enable/disable wizard steps, validation rules, and ecosystem-specific hints dynamically.
- Adapters are instantiated via `NetworkConfig`; the app supports multi-chain operations by switching adapters based on user ecosystem/network selection.
- ZIP generation of chain-specific artifacts (contracts, scripts, docs) MUST be delegated to adapter-led generator entrypoints (e.g., exported functions from adapter packages), not embedded in the wizard UI.
- Rationale: Ensures the wizard is scalable to new chains without UI code changes and strictly separates presentation from protocol and generation logic.

### II. Reuse-First & Monorepo Integration (NON-NEGOTIABLE)

- The application MUST reuse `@openzeppelin/ui-*` packages (types, utils, renderer, storage, components, react, styles) rather than re-implementing core functionality.
- Adapter packages remain in the `@openzeppelin/ui-builder-adapter-*` namespace (e.g., `adapter-evm`, `adapter-stellar`).
- Local development against the `openzeppelin-ui` monorepo MUST use the pnpmfile hook workflow: run `pnpm dev:local` to resolve `@openzeppelin/ui-*` packages to local paths via `.pnpmfile.cjs`. This approach keeps `package.json` unchanged while enabling seamless switching between local and npm packages.
- New shared utilities, types, or generation interfaces required by RWA Wizard should ideally be contributed upstream to `openzeppelin-ui` packages or adapter packages first, then consumed here.
- Patterns for provider hierarchy, ecosystem management, config services, and storage MUST follow those established by the UI Builder and Role Manager applications.
- Rationale: Guarantees consistency with the broader OpenZeppelin tool ecosystem and validates the standalone usability of UI Kit packages.

### III. Type Safety, Linting, and Code Quality (NON-NEGOTIABLE)

- TypeScript strictness, shared linting, and formatting rules apply throughout the repository.
- `console` usage in source code is prohibited; use `logger` from `@openzeppelin/ui-utils` (exceptions only in tests/scripts).
- `any` types are disallowed without explicit justification.
- React components MUST be typed with `React.FC` or explicit props interfaces; hooks must have explicit return types.
- The canonical `RwaWizardConfig` data model MUST be fully typed with no implicit `any` fields; chain-specific extensions use discriminated unions or generics.
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
- ZIP generation MUST be performed entirely in-browser using JSZip (following the same proven approach as UI Builder export); no server-side build or generation service is required.
- Build outputs utilize Vite; releases are managed via Changesets.
- Rationale: Ensures the tool is privacy-preserving, works offline (for cached data), and is easy to host.

## Additional Constraints

- **Storage**: Do not use `localStorage` for complex data; use the typed IndexedDB layer via `@openzeppelin/ui-storage`.
- **Security**: Do not hardcode chain secrets; rely on wallet connections or user input. Generated scaffolding MUST avoid privileged functions with missing auth checks.
- **Forms**: Use `@openzeppelin/ui-renderer` for transaction forms where applicable to inherit validation and schema logic from adapters.
- **ZIP Generation**: ZIP output MUST be deterministic from a given `RwaWizardConfig`. The generation pipeline MUST support progress callbacks for UI feedback.
- **Privacy**: When wizard configuration involves identity data (e.g., plaintext identity registry storage), the UI MUST surface explicit privacy warnings.
- **Wizard State**: The wizard MUST support draft persistence (auto-save) and resumption across sessions via storage.

## Development Workflow and Review Process

- Use `pnpm` for all tasks.
- **Local UI development**: Run `pnpm dev:local` to use local `@openzeppelin/ui-*` packages from `../openzeppelin-ui` and adapter packages from `../ui-builder`. Run `pnpm dev:npm` to switch back to npm packages.
- **Docker testing**: Run `pnpm docker:dev` to build and run the Docker container locally.
- Commit messages MUST follow Conventional Commits. Check available scopes and limits before committing.
- PRs MUST verify that changes to UI Kit dependencies are correctly versioned.
- Code review enforces strict separation of concerns: rejection if UI contains chain-specific logic and is not adapter-led.
- Code review enforces Reuse-First: reviewers verify reuse attempts before approving new modules.

## Governance

- This constitution supersedes other practices; non-negotiable rules MUST be enforced during development and review.
- Amendments require a documented proposal and PR review.
- Breaking changes to upstream `openzeppelin-ui` interfaces require coordination with the UI Kit repository maintainers.
- Breaking changes to adapter interfaces or generator boundaries require coordination with the UI Builder repository maintainers.

**Version**: 1.0.0 | **Ratified**: 2026-02-26 | **Last Amended**: 2026-02-26
