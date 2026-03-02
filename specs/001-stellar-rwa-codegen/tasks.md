# Tasks: Modular Codegen Engine + Stellar RWA Generator

**Input**: Design documents from `/specs/001-stellar-rwa-codegen/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md, quickstart.md

**Tests**: Included — constitution requires TDD for all business logic (validation, generation, ZIP assembly).

**Organization**: Tasks grouped by user story. Each story is independently testable after its phase completes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold all three packages in the monorepo with build tooling

- [x] T001 Create `packages/codegen-core/` directory structure with `src/`, `__tests__/`, `__tests__/utils/`
- [x] T002 [P] Create `packages/config/` directory structure with `src/`, `__tests__/`
- [x] T003 [P] Create `packages/codegen-rwa-stellar/` directory structure with `src/`, `src/templates/contracts/`, `src/templates/scripts/`, `src/templates/cargo/`, `src/validation/`, `src/modules/`, `__tests__/`, `__tests__/templates/`, `__tests__/modules/`
- [x] T004 Configure pnpm workspace to include new packages in `pnpm-workspace.yaml`
- [x] T005 [P] Create `packages/codegen-core/package.json` with name `@openzeppelin/codegen-core`, JSZip dependency, tsdown build config, Vitest test config, `engines: { node: ">=20.0.0" }`
- [x] T006 [P] Create `packages/config/package.json` with name `@openzeppelin/rwa-config`, tsdown build config, Vitest test config, `engines: { node: ">=20.0.0" }`
- [x] T007 [P] Create `packages/codegen-rwa-stellar/package.json` with name `@openzeppelin/codegen-rwa-stellar`, dependencies on `@openzeppelin/codegen-core` and `@openzeppelin/rwa-config`, tsdown build config, Vitest test config, `engines: { node: ">=20.0.0" }`
- [x] T008 [P] Create `tsconfig.json` for each package extending the root TypeScript config with strict mode
- [x] T009 [P] Create `tsdown.config.ts` for each package (ESM + CJS + DTS output)
- [x] T010 Run `pnpm install` and verify all three packages build with empty `src/index.ts` stubs

**Checkpoint**: All three packages scaffold, build, and are recognized by the monorepo.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types, validation framework, file-tree utilities, and config types that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Core Engine Types & Infrastructure

- [x] T011 [P] Define core types in `packages/codegen-core/src/types.ts`: `Generator<TConfig>` interface, `FileTree`, `ValidationResult`, `ValidationError`, `ValidationWarning`, `GenerationResult`, `GenerationMetadata`, `ZipResult`, `ProgressCallback`, `ProgressEvent`, `GenerateOptions`
- [x] T012 [P] Implement file-tree builder utilities in `packages/codegen-core/src/file-tree.ts`: helper functions for creating and merging `FileTree` records
- [x] T013 [P] Implement progress types and helpers in `packages/codegen-core/src/progress.ts`: progress event factory, no-op callback default
- [x] T014 Write validation framework tests in `packages/codegen-core/__tests__/validation.test.ts`: rule composition, field paths, error codes (uppercase snake_case), error vs warning separation
- [x] T015 Implement validation framework in `packages/codegen-core/src/validation.ts`: rule aggregation, field path tracking, error/warning separation, structured `ValidationResult` assembly
- [x] T016 [P] Implement zipInspector test utility in `packages/codegen-core/__tests__/utils/zip-inspector.ts`: `extractFilesFromZip()` and `validateProjectStructure()` (adapted from UI Builder)
- [x] T017 Write ZipGenerator tests in `packages/codegen-core/__tests__/zip-generator.test.ts`: determinism (same FileTree → same contents), progress callbacks, browser/Node compat
- [x] T018 Implement ZipGenerator in `packages/codegen-core/src/zip-generator.ts`: JSZip wrapper with browser/Node detection, content-deterministic output, progress reporting (adapted from UI Builder pattern)
- [x] T019 Implement generation pipeline orchestrator in `packages/codegen-core/src/generator.ts`: `generateZip()` function that packages a `GenerationResult` into a `ZipResult`
- [x] T020 Create codegen-core public API in `packages/codegen-core/src/index.ts`: export all types and `generateZip` function per `contracts/codegen-core-api.ts`

### RWA Config Types

- [x] T021 [P] Define all RWAConfig types in `packages/config/src/types.ts`: `RWAConfig`, `TokenConfig`, `IdentityVerificationConfig`, `ComplianceConfig`, `AccessControlConfig`, `DeploymentConfig`, `ClaimTopic`, `TrustedIssuer`, `ComplianceModuleSelection`, `ComplianceHook`, `OperatorRole`, `OwnershipModel` per `contracts/rwa-config-api.ts`
- [x] T022 [P] ~~Define validation constants in `packages/config/src/constants.ts`~~ **MOVED**: Validation constants (`STELLAR_VALIDATION_CONSTANTS`) are chain-specific and now live in `packages/codegen-rwa-stellar/src/constants.ts`. The config package stays chain-agnostic (types only).
- [x] T023 [P] Define defaults in `packages/config/src/defaults.ts`: `DEFAULT_ROLE_SYMBOLS` mapping (`manager`, `agent`, `operator`). `generateRoleSymbol()` moved to `packages/codegen-rwa-stellar/src/constants.ts` (Soroban-specific truncation logic).
- [x] T024 Create rwa-config public API in `packages/config/src/index.ts`: export types and `DEFAULT_ROLE_SYMBOLS` per `contracts/rwa-config-api.ts`
- [x] T025 Write config tests in `packages/config/__tests__/types.test.ts`: `DEFAULT_ROLE_SYMBOLS` validation. Constant and `generateRoleSymbol` tests moved to `packages/codegen-rwa-stellar/__tests__/constants.test.ts`.

**Checkpoint**: Foundation ready — all core types, validation framework, ZIP packaging, and config types are built and tested. User story implementation can now begin.

---

## Phase 3: User Story 1 — Generate a Complete RWA Token Project (Priority: P1) 🎯 MVP

**Goal**: A developer provides a valid `RWAConfig` and receives a complete multi-contract Stellar/Soroban project with all 5 core contracts, workspace manifest, and lib.rs files.

**Independent Test**: Pass a minimal valid config → verify output contains all expected `.rs` files, `Cargo.toml` files, and correct trait implementations per SR-002.

### Tests for User Story 1

- [x] T026 [P] [US1] Write RWA Token template tests in `packages/codegen-rwa-stellar/__tests__/templates/rwa-token.test.ts`: correct traits (FungibleToken, AccessControl, Pausable), `__constructor` args, conditional DocumentManager, role grants
- [x] T027 [P] [US1] Write Cargo.toml template tests in `packages/codegen-rwa-stellar/__tests__/templates/cargo.test.ts`: workspace-level git deps pinned to commit hash, soroban-sdk version, per-crate deps, Rust edition 2021

### Implementation for User Story 1

- [x] T028 [P] [US1] Extend Stellar constants in `packages/codegen-rwa-stellar/src/constants.ts` (already contains `STELLAR_VALIDATION_CONSTANTS` and `generateRoleSymbol` from Phase 2): add pinned `stellar-contracts` commit hash, `soroban-sdk` version, crate names
- [x] T029 [P] [US1] Create lib.rs template in `packages/codegen-rwa-stellar/src/templates/lib-rs.ts`: `#![no_std]`, `mod contract;`, `pub use contract::*;` per SR-015
- [x] T030 [P] [US1] Create per-crate Cargo.toml template in `packages/codegen-rwa-stellar/src/templates/cargo/crate-toml.ts`: crate name, `crate-type = ["cdylib"]`, dependencies from config
- [x] T031 [P] [US1] Create workspace Cargo.toml template in `packages/codegen-rwa-stellar/src/templates/cargo/workspace-toml.ts`: workspace members, git deps with pinned rev, soroban-sdk version, edition 2021 per SR-008
- [x] T032 [US1] Implement RWA Token contract template in `packages/codegen-rwa-stellar/src/templates/contracts/rwa-token.ts`: empty struct, `__constructor` per SR-016, FungibleToken/AccessControl/Pausable impls, conditional DocumentManager per SR-004, role grants per SR-005, default token version per SR-012
- [x] T033 [P] [US1] Implement Compliance contract template in `packages/codegen-rwa-stellar/src/templates/contracts/compliance.ts`: Compliance + TokenBinder + AccessControl traits, `__constructor(e, admin)` per SR-016
- [x] T034 [P] [US1] Implement Identity Verifier contract template in `packages/codegen-rwa-stellar/src/templates/contracts/identity-verifier.ts`: IdentityVerifier + AccessControl traits, `__constructor(e, admin, cti_address)` per SR-016
- [x] T035 [P] [US1] Implement CTI contract template in `packages/codegen-rwa-stellar/src/templates/contracts/claim-topics-issuers.ts`: ClaimTopicsAndIssuers + AccessControl traits, `__constructor(e, admin)` per SR-016
- [x] T036 [P] [US1] Implement IRS contract template in `packages/codegen-rwa-stellar/src/templates/contracts/identity-registry-storage.ts`: IdentityRegistryStorage + CountryDataManager + TokenBinder + AccessControl traits, `__constructor(e, admin)` per SR-016
- [x] T037 [US1] Create StellarRwaGenerator class in `packages/codegen-rwa-stellar/src/stellar-rwa-generator.ts`: implement `Generator<RWAConfig>` interface, wire all contract templates into `generate()` method, produce `GenerationResult` with `FileTree` and `GenerationMetadata` (including configHash via sorted-key SHA-256)
- [x] T038 [US1] Write end-to-end generation test in `packages/codegen-rwa-stellar/__tests__/generate.test.ts`: pass valid config → verify all 5 contracts present, correct file paths, trait impls match SR-002, constructor args match SR-016

**Checkpoint**: `generate(config)` returns a `GenerationResult` with all 5 core contracts, workspace Cargo.toml, and lib.rs files. US1 is independently testable.

---

## Phase 4: User Story 2 — Generate Deployment and Build Scripts (Priority: P1)

**Goal**: The generated project includes `build.sh`, `deploy.sh`, `config.json`, and `README.md` — turning source code into a deployable system.

**Independent Test**: Verify script content has correct deployment order (CTI → IRS → Identity Verifier → Compliance → Modules → RWA Token), address variables are threaded correctly, and post-deploy config matches input.

### Tests for User Story 2

- [x] T039 [P] [US2] Write script generation tests in `packages/codegen-rwa-stellar/__tests__/templates/scripts.test.ts`: deployment order, address capture threading, error handling (exit code checks), post-deploy config order per SR-013, conditional mint call

### Implementation for User Story 2

- [x] T040 [P] [US2] Implement build.sh template in `packages/codegen-rwa-stellar/src/templates/scripts/build-sh.ts`: `stellar contract build` for all workspace crates
- [x] T041 [US2] Implement deploy.sh template in `packages/codegen-rwa-stellar/src/templates/scripts/deploy-sh.ts`: deployment order per SR-006, address capture via shell variables, exit code checks, post-deploy config per SR-013 (bind token, register modules, add claim topics, add trusted issuers, optional mint)
- [x] T042 [P] [US2] Implement config.json generation in `packages/codegen-rwa-stellar/src/stellar-rwa-generator.ts`: serialize RWAConfig mirroring type structure per SR-007
- [x] T043 [US2] Implement README.md template in `packages/codegen-rwa-stellar/src/templates/readme.ts`: 7 required sections per SR-009 (title, prerequisites, build, deploy, architecture, contract table, Unix note)
- [x] T044 [US2] Wire script, config.json, and README templates into StellarRwaGenerator.generate() in `packages/codegen-rwa-stellar/src/stellar-rwa-generator.ts`

**Checkpoint**: `generate(config)` now returns contracts + scripts + config.json + README. Deployment scripts are verifiably correct via automated tests.

---

## Phase 5: User Story 3 — Produce a Downloadable ZIP Archive (Priority: P1)

**Goal**: The generated project can be packaged as a ZIP archive with correct directory structure, deterministic output, and root directory named from token symbol.

**Independent Test**: Generate ZIP from known config, extract with zipInspector, verify structure matches `quickstart.md` § "Expected Output Structure".

### Tests for User Story 3

- [x] T045 [US3] Write ZIP output tests in `packages/codegen-rwa-stellar/__tests__/generate-zip.test.ts`: root directory naming, content determinism (same config → same files), omitted `contracts/modules/` when no modules, structural match against quickstart layout

### Implementation for User Story 3

- [x] T046 [US3] Implement directory name sanitization in `packages/codegen-rwa-stellar/src/stellar-rwa-generator.ts`: lowercase symbol, replace non-alphanumeric with hyphens, collapse/trim, append `-rwa`
- [x] T047 [US3] Implement `generateZip()` convenience wrapper in `packages/codegen-rwa-stellar/src/index.ts`: call `generate()` then delegate to codegen-core's `generateZip()` per `contracts/codegen-rwa-stellar-api.ts`

**Checkpoint**: `generateZip(config)` returns a valid ZIP with the complete project. Determinism verified. US3 is independently testable.

---

## Phase 6: User Story 5 — Validate Configuration Before Generation (Priority: P2)

**Goal**: Consumers can validate an `RWAConfig` before generation, receiving structured errors with field paths and error codes.

**Independent Test**: Pass invalid configs with various constraint violations → verify returned `ValidationResult` contains expected error codes and field paths.

> Note: US5 before US4 because standalone usage (US4) depends on validation being available.

### Tests for User Story 5

- [x] T048 [US5] Write comprehensive validation tests in `packages/codegen-rwa-stellar/__tests__/validation.test.ts`: token.symbol >12 chars, decimals out of range, duplicate claimTopics, missing required fields, i128 overflow, empty trustedIssuer.claimTopics, duplicate role symbols, unsupported compliance module, valid config passes, role symbol auto-generation, empty roles array (admin-only), initialSupply `"0"` vs `undefined` semantics, Unicode token.name (UTF-8 byte length check), unrecognized deployment.network passthrough, extra/unknown config properties (silently ignored), all operators same address, zero claimTopics + zero trustedIssuers

### Implementation for User Story 5

- [x] T049 [US5] Implement RWA validation rules in `packages/codegen-rwa-stellar/src/validation/rules.ts`: field length checks, numeric range checks, duplicate detection, structural checks (trusted issuer references valid claim topics), i128 range, module availability check per SR-010
- [x] T050 [US5] Wire validation rules into StellarRwaGenerator.validate() in `packages/codegen-rwa-stellar/src/stellar-rwa-generator.ts`
- [x] T051 [US5] Implement `validate()` public API function in `packages/codegen-rwa-stellar/src/index.ts` per SR-017: returns ValidationResult without throwing
- [x] T052 [US5] Add validation guard to `generate()`: throw Error if config is invalid per SR-017

**Checkpoint**: `validate(config)` returns structured errors. `generate()` throws on invalid config. All documented constraints are enforced.

---

## Phase 7: User Story 6 — Compliance Module Code Generation (Priority: P2)

**Goal**: When compliance modules are selected, the generator produces a separate contract crate for each module implementing the `ComplianceModule` trait.

**Independent Test**: Generate with compliance module selections → verify each produces a crate under `contracts/modules/{name}/` with valid `ComplianceModule` trait impl.

### Tests for User Story 6

- [x] T053 [P] [US6] Write compliance module template tests in `packages/codegen-rwa-stellar/__tests__/templates/compliance-module.test.ts`: correct ComplianceModule trait impl, hook method logic, separate crate structure
- [x] T054 [P] [US6] Write module registry tests in `packages/codegen-rwa-stellar/__tests__/modules/registry.test.ts`: only implemented modules returned, supported hooks accurate

### Implementation for User Story 6

- [x] T055 [US6] Define compliance module registry in `packages/codegen-rwa-stellar/src/modules/registry.ts`: `ComplianceModuleRegistryEntry[]` with id, name, description, supportedHooks per data-model.md. **⚠️ NOTE**: Once the registry exists, update `validateComplianceModules` in `src/validation/rules.ts` to dynamically query it instead of using a hardcoded empty set (current Phase 6 placeholder).
- [x] T056 [US6] Implement compliance module contract template in `packages/codegen-rwa-stellar/src/templates/contracts/compliance-module.ts`: ComplianceModule trait impl with hook-specific method logic, per-module crate Cargo.toml and lib.rs
- [x] T057 [US6] Wire compliance module generation into StellarRwaGenerator.generate() — add module crates to FileTree when `compliance.modules` is non-empty. **⚠️ NOTE**: Module crate directories (e.g., `contracts/modules/supply-cap`) must also be added to the workspace `members` array in the root `Cargo.toml` generated by `workspace-toml.ts`. The current Phase 4 implementation only passes core contract paths as members.
- [x] T058 [US6] Implement `getAvailableModules()` public API function in `packages/codegen-rwa-stellar/src/index.ts`: filter registry to implemented-only entries
- [x] T059 [US6] Add compliance module deployment to deploy.sh template — deploy each module and register on Compliance contract per hook

**Checkpoint**: Compliance modules generate as separate crates. Registry only exposes implemented modules. Deploy script handles module registration.

---

## Phase 8: User Story 7 — Extend the Engine with a New Generator (Priority: P2)

**Goal**: Validate the architectural promise — a dummy generator can use codegen-core's pipeline without any Stellar or RWA assumptions.

**Independent Test**: Create a dummy `Generator<{ message: string }>` that produces 2 files, exercises validation with 1 passing and 1 failing rule, and flows through the full pipeline.

### Implementation for User Story 7

- [x] T060 [US7] Write dummy generator extensibility test in `packages/codegen-core/__tests__/generator.test.ts`: implement `Generator<{ message: string }>` per SC-008, verify validate → generate → generateZip pipeline, confirm no chain-specific assumptions in core
- [x] T061 [US7] Write file-tree builder tests in `packages/codegen-core/__tests__/file-tree.test.ts`: create, merge, path handling
- [x] T062 [US7] Write concurrent invocation safety test in `packages/codegen-core/__tests__/generator.test.ts`: invoke `generate()` concurrently with different configs via `Promise.all()`, verify no shared mutable state interference per CR-009

**Checkpoint**: Core engine is proven extensible and concurrency-safe. No Stellar/RWA leakage. SC-008 and CR-009 satisfied.

---

## Phase 9: User Story 4 — Use the Package Standalone (Priority: P2)

**Goal**: All three packages work in a pure Node.js environment with no browser or React dependencies. Public API is clean and well-documented.

**Independent Test**: Import `@openzeppelin/codegen-rwa-stellar` in a Node.js script (no browser globals), invoke `generate()`, verify success.

### Implementation for User Story 4

- [ ] T063 [US4] Finalize public API with JSDoc in `packages/codegen-rwa-stellar/src/index.ts`: `generate()`, `generateZip()`, `validate()`, `getAvailableModules()`, re-export `RWAConfig` — all with JSDoc per SR-014
- [ ] T064 [US4] Write standalone Node.js integration test in `packages/codegen-rwa-stellar/__tests__/standalone.test.ts`: import package in Node.js, construct config, invoke generate/validate/generateZip, verify no runtime errors from missing browser/UI deps per SC-004
- [ ] T065 [US4] Verify no React/browser-only dependencies in all 3 package builds — check `package.json` deps and `tsdown` output for browser-only imports

**Checkpoint**: All packages work standalone in Node.js. Public API is minimal (<10 primary exports per SC-007), well-documented, and independently importable.

---

## Phase 10: User Story 8 — Progress Feedback During Generation (Priority: P3)

**Goal**: Consumers receive progress callbacks during generation indicating phase and completion percentage.

**Independent Test**: Pass a progress callback → verify it's called with sequential phases and increasing percentages. Omit callback → verify no errors.

### Tests for User Story 8

- [ ] T066 [US8] Write progress callback tests in `packages/codegen-rwa-stellar/__tests__/generate.test.ts`: callback receives sequential phases with increasing percentages, no callback → no error

### Implementation for User Story 8

- [ ] T067 [US8] Integrate progress callbacks into StellarRwaGenerator.generate() in `packages/codegen-rwa-stellar/src/stellar-rwa-generator.ts`: report phases (validating, generating-contracts, generating-scripts, assembling-zip) with percentages

**Checkpoint**: Progress callbacks work when provided, are silently skipped when omitted. CR-006 satisfied.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, API consistency, build verification, and final quality checks

- [ ] T068 [P] Create package README.md for `packages/codegen-core/README.md` with package description, API reference, and usage example
- [ ] T069 [P] Create package README.md for `packages/config/README.md` with RWAConfig type reference and example config object
- [ ] T070 [P] Create package README.md for `packages/codegen-rwa-stellar/README.md` with quickstart example (from `quickstart.md`), API reference, and available modules listing
- [ ] T071 Verify SC-007 export count: codegen-core ≤10, rwa-config ≤10, codegen-rwa-stellar ≤10 primary exports
- [ ] T072 Run full build for all 3 packages (`pnpm -r --filter './packages/codegen-*' --filter './packages/config' build`) and verify ESM + CJS + DTS output
- [ ] T073 Run full test suite for all 3 packages and verify all pass
- [ ] T074 Run quickstart.md validation: execute the quickstart code sample against the built packages and verify expected output structure
- [ ] T075 Write SC-001 performance benchmark in `packages/codegen-rwa-stellar/__tests__/benchmark.test.ts`: generate a typical config (5 contracts, 2 modules, 3 roles) and assert completion in <5 seconds on Node.js >=20.x per SC-001
- [ ] T076 Write SC-002 Rust syntax validation test in `packages/codegen-rwa-stellar/__tests__/syntax-validation.test.ts`: generate all contract `.rs` files, verify syntactic validity by parsing with `syn` crate via a helper script or `cargo check` against pinned `soroban-sdk` per SC-002

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — **BLOCKS all user stories**
- **User Stories (Phase 3–10)**: All depend on Foundational phase completion
  - US1 (Phase 3) and US2 (Phase 4) can proceed sequentially (US2 depends on US1 contracts)
  - US3 (Phase 5) depends on US1 + US2 (needs full FileTree to ZIP)
  - US5 (Phase 6) can start in parallel with US1 (validation rules are independent of templates)
  - US6 (Phase 7) depends on US1 (needs contract template pattern established)
  - US7 (Phase 8) can start in parallel with US1 (core engine only, no Stellar deps)
  - US4 (Phase 9) depends on US1 + US3 + US5 (needs working end-to-end pipeline)
  - US8 (Phase 10) depends on US1 (needs working generate() to add callbacks to)
- **Polish (Phase 11)**: Depends on all desired user stories being complete

### User Story Dependencies

```
Phase 2 (Foundational) ──┬──→ Phase 3 (US1) ──┬──→ Phase 4 (US2) ──→ Phase 5 (US3) ──→ Phase 9 (US4)
                         │                    │                                           ↑
                         │                    ├──→ Phase 7 (US6)                          │
                         │                    └──→ Phase 10 (US8)                         │
                         ├──→ Phase 6 (US5) ──────────────────────────────────────────────┘
                         └──→ Phase 8 (US7) [core only]
```

### Within Each User Story

- Tests written FIRST (TDD per constitution V)
- Templates/models before services
- Core implementation before integration
- Wire into generator last

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T001–T003, T005–T009)
- Foundational: codegen-core and rwa-config types can be built in parallel (T011–T013 ∥ T021–T024)
- US1: All non-Token contract templates can run in parallel (T033–T036)
- US5 and US7 can start in parallel with US1 (independent of Stellar templates)
- US6 template tests and registry tests can run in parallel (T053 ∥ T054)
- All Polish README tasks can run in parallel (T068–T070)

---

## Parallel Example: User Story 1

```text
# After T031 (workspace Cargo.toml) completes, launch contract templates in parallel:
Task T033: "Implement Compliance contract template"
Task T034: "Implement Identity Verifier contract template"
Task T035: "Implement CTI contract template"
Task T036: "Implement IRS contract template"

# Once all templates done, wire into generator:
Task T037: "Create StellarRwaGenerator class"
Task T038: "Write end-to-end generation test"
```

## Parallel Example: Foundational Phase

```text
# Launch codegen-core types and rwa-config types in parallel:
Task T011: "Define core types in codegen-core/src/types.ts"
Task T012: "Implement file-tree builder in codegen-core/src/file-tree.ts"
Task T013: "Implement progress types in codegen-core/src/progress.ts"
Task T021: "Define RWAConfig types in config/src/types.ts"
Task T022: "Define validation constants in config/src/constants.ts"
Task T023: "Define defaults in config/src/defaults.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1–3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — Contract Generation
4. **STOP and VALIDATE**: Test US1 independently (all 5 contracts generate correctly)
5. Complete Phase 4: US2 — Scripts + README
6. Complete Phase 5: US3 — ZIP Archive
7. **MVP COMPLETE**: Full generate → ZIP pipeline works end-to-end

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 → Contracts generate correctly → **Milestone: Core generation works**
3. US2 → Scripts + README → **Milestone: Deployable projects**
4. US3 → ZIP packaging → **Milestone: MVP complete (deployable ZIP from config)**
5. US5 → Validation → **Milestone: Safe for production use**
6. US6 → Compliance modules → **Milestone: Full feature parity with PRD**
7. US7 → Extensibility → **Milestone: Architecture validated**
8. US4 → Standalone → **Milestone: Ready for public publish**
9. US8 → Progress → **Milestone: UX polish complete**

### Parallel Team Strategy

With multiple developers after Foundational completes:

- **Developer A**: US1 → US2 → US3 (core generation pipeline, sequential)
- **Developer B**: US5 → US6 (validation + compliance modules, independent of templates)
- **Developer C**: US7 (extensibility, core engine only — no Stellar deps needed)

---

## Notes

- [P] tasks = different files, no shared dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable at its checkpoint
- Constitution V requires TDD — write failing tests before implementation
- Commit after each task or logical group per commit rules
- Stop at any checkpoint to validate the story independently
- Total: **76 tasks** across 11 phases
