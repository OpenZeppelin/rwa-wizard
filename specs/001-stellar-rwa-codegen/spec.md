# Feature Specification: Modular Codegen Engine + Stellar RWA Generator

**Feature Branch**: `001-stellar-rwa-codegen`  
**Created**: 2026-03-01  
**Status**: Draft  
**Input**: User description: "Headless RWA Codegen Package for Stellar. First package in the collection of RWA codegen packages for different ecosystem. Designed in a similar way as the UI Builder adapters. Will be consumed by the RWA Wizard app, but should be usable without UI as a standalone package to generate RWA Token code + scripts."

## Architecture Context

This feature delivers **three packages** with distinct responsibilities:

1. **`@openzeppelin/codegen-core`** — A chain-agnostic, contract-agnostic package that provides the generation pipeline infrastructure: file tree assembly, ZIP packaging, validation framework, progress reporting, and the extensibility contracts (interfaces) that generators implement. It knows nothing about Stellar, EVM, RWA tokens, or any specific contract type.
2. **`@openzeppelin/rwa-config`** — A shared configuration package that owns the canonical `RWAConfig` type, validation schema, and related types (e.g., `ClaimTopic`, `TrustedIssuer`, `ComplianceHook`, `OperatorRole`). Chain-agnostic by design — it describes _what_ the user wants, not _how_ it maps to a specific chain. All RWA generators depend on this package for the shared configuration type.
3. **`@openzeppelin/codegen-rwa-stellar`** — The first generator built on the core engine. It implements the engine's extensibility interfaces and consumes the shared `RWAConfig` type to produce Stellar/Soroban RWA token projects (Rust contracts, shell scripts, Cargo workspace). It is publicly published and consumable by the RWA Wizard app, CLI tools, and AI agents.

This separation ensures that future generators (EVM RWA, Midnight RWA, or entirely different contract libraries) reuse the core engine without duplicating infrastructure and share the `RWAConfig` type without depending on a chain-specific package, following the same adapter pattern used by the UI Builder ecosystem.

## Clarifications

### Session 2026-03-01

- Q: Where does `RWAConfig` live as a package? → A: In a dedicated shared config/types package within the RWA Wizard monorepo (e.g., `packages/config`). All generators depend on it; it is independent of any single generator.
- Q: What are the npm package names? → A: `@openzeppelin/codegen-core`, `@openzeppelin/rwa-config`, `@openzeppelin/codegen-rwa-stellar`.
- Q: Should the public API expose the raw file tree in addition to ZIP? → A: Yes. `generate()` returns the raw file tree; a separate `generateZip()` (or option flag) wraps it into a ZIP. Both are public API surfaces.
- Q: How is the `stellar-contracts` pinned commit hash managed? → A: Hardcoded per release. The commit hash is baked into each version of `@openzeppelin/codegen-rwa-stellar`; updated when the generator is released.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Generate a Complete RWA Token Project from Configuration (Priority: P1)

A developer provides a valid RWA configuration object (token metadata, identity settings, compliance hooks, roles) and receives a complete, ready-to-build Stellar/Soroban project containing all required contract source files, deployment scripts, and workspace configuration. The Stellar RWA generator delegates file tree assembly and ZIP packaging to the core codegen engine.

**Why this priority**: This is the core value proposition — transforming a declarative configuration into a deployable multi-contract system. Without this, neither package has purpose. This story validates the full pipeline end-to-end, exercising both the core engine and the Stellar RWA generator together.

**Independent Test**: Can be fully tested by passing a minimal valid configuration and verifying the output contains all expected contract files, deployment scripts, and workspace manifest. The generated Rust code should be syntactically valid and the project structure should match the expected layout.

**Acceptance Scenarios**:

1. **Given** a valid RWA configuration with token metadata (name, symbol, decimals), **When** the generator is invoked, **Then** the output contains all 5 core contracts (RWA Token, Compliance, Identity Verifier, Claim Topics & Issuers, Identity Registry Storage) with correct constructor arguments wired from the configuration.
2. **Given** a configuration with `documentManager.enabled` set to true, **When** the generator is invoked, **Then** the generated RWA Token contract includes the `DocumentManager` trait implementation. When set to false, the trait implementation is omitted.
3. **Given** a configuration with operator roles defined, **When** the generator is invoked, **Then** the generated contracts include `#[only_role]` annotations on the correct functions and the constructor grants the configured roles using the role symbol mapping (respecting the 9-character Soroban limit).
4. **Given** a configuration with an initial supply specified, **When** the generator is invoked, **Then** the deployment script includes a mint call after contract deployment. _(Cross-ref: deployment script details are specified in US2; this scenario validates that the initial supply config flows through to script output.)_
5. **Given** a valid configuration, **When** the generator is invoked, **Then** the output includes a workspace `Cargo.toml` with git dependencies pinned to a specific commit hash for the `stellar-contracts` library crates.

---

### User Story 2 - Generate Deployment and Build Scripts (Priority: P1)

A developer receives shell scripts that orchestrate the full build-deploy-configure lifecycle for the generated contracts. The scripts handle the correct deployment order (respecting contract dependencies), capture deployed addresses, perform post-deployment configuration, and read parameterized values from a serialized config file.

**Why this priority**: Generated contracts without deployment orchestration are unusable by most users. The scripts turn the output from "source code" into "a deployable system" — essential for the package to deliver real value.

**Independent Test**: Can be tested by verifying script content against the expected deployment order (CTI → IRS → Identity Verifier → Compliance → Modules → RWA Token), checking that address capture variables are correctly threaded between steps, and confirming post-deploy configuration calls match the input configuration.

**Acceptance Scenarios**:

1. **Given** a valid configuration, **When** the generator is invoked, **Then** the output includes a `build.sh` script that compiles all workspace contracts and a `deploy.sh` script that deploys and configures them in the correct dependency order.
2. **Given** a configuration with claim topics and trusted issuers, **When** the generator is invoked, **Then** the deploy script includes post-deployment calls to register each claim topic and trusted issuer on the CTI contract.
3. **Given** a configuration with compliance modules assigned to hooks, **When** the generator is invoked, **Then** the deploy script deploys each module contract and registers it on the Compliance contract for the correct hook.
4. **Given** a valid configuration, **When** the generator is invoked, **Then** the output includes a `config.json` file containing the serialized wizard configuration values consumed by the scripts.
5. **Given** a configuration specifying a `single-owner` ownership model with an owner address, **When** the generator is invoked, **Then** all generated contracts use that address as the admin in their constructors, and the deploy script passes it correctly.

---

### User Story 3 - Produce a Downloadable ZIP Archive (Priority: P1)

A developer or the RWA Wizard app can request the generated project as a ZIP archive. The core codegen engine handles ZIP assembly from the file tree produced by the Stellar RWA generator. The archive contains the full project in a structured directory layout, ready to be extracted and built. The ZIP is produced in-memory (suitable for browser environments) and is deterministic — the same configuration always produces the same output.

**Why this priority**: The ZIP is the delivery format for both programmatic and wizard-app consumers. ZIP assembly is a cross-cutting concern owned by the core engine, not by individual generators — validating this separation early is critical.

**Independent Test**: Can be tested by generating a ZIP from a known configuration, extracting it, and verifying the directory structure matches the expected layout with all files present and correct content.

**Acceptance Scenarios**:

1. **Given** a valid configuration with token symbol "ACME", **When** ZIP generation is invoked, **Then** the archive root directory is named `acme-rwa/` and contains `contracts/`, `scripts/`, `Cargo.toml`, and `README.md`.
2. **Given** the same configuration provided twice, **When** ZIP generation is invoked both times, **Then** the two ZIP archives contain identical file contents.
3. **Given** a configuration with no compliance modules selected, **When** ZIP generation is invoked, **Then** the `contracts/modules/` directory is omitted from the archive.
4. **Given** a valid configuration, **When** ZIP generation is invoked, **Then** the output includes a `README.md` with setup instructions, prerequisites, architecture overview, and a listing of all generated contracts with their purpose.

---

### User Story 4 - Use the Package Standalone (Without the Wizard UI) (Priority: P2)

A developer, CLI tool, or AI agent installs the publicly published Stellar RWA generator package and uses its exported functions to generate RWA projects programmatically — for example, from a CI pipeline, a CLI tool, an AI coding assistant, or a testing harness. The package (and its core engine dependency) have no dependency on React, browser APIs (beyond what is needed for ZIP generation), or the RWA Wizard application. As publicly published packages, they are the primary distribution mechanism for RWA code generation across the OpenZeppelin ecosystem.

**Why this priority**: Standalone usability ensures the packages are reusable across contexts (CI/CD, CLIs, AI agents, other apps) and validates clean separation from the wizard UI. Public availability enables third-party adoption and AI-assisted workflows — critical for ecosystem reach beyond the wizard app alone.

**Independent Test**: Can be tested by importing the package in a Node.js script (no browser, no React), constructing a configuration object, invoking the generator, and verifying the output — confirming no runtime errors from missing browser or UI dependencies.

**Acceptance Scenarios**:

1. **Given** a Node.js environment with no browser globals and no React, **When** the package is imported and the generator is invoked with a valid configuration, **Then** the generation completes successfully with no runtime errors.
2. **Given** the package is installed via npm from the public registry, **When** a developer inspects its public API, **Then** it exports a clear entry point for generation (e.g., a `generate` function), the `RWAConfig` type, and validation utilities — without exposing internal implementation details.
3. **Given** a configuration object, **When** the developer invokes the validation function, **Then** it returns structured validation errors indicating which fields are invalid and why, without throwing exceptions.
4. **Given** an AI agent or CLI tool consuming the package, **When** it constructs a configuration programmatically and invokes the generator, **Then** the output is identical to what the wizard app would produce for the same configuration — ensuring parity across all consumption channels.

---

### User Story 5 - Validate Configuration Before Generation (Priority: P2)

A consumer of the package can validate an RWA configuration object before triggering code generation. The core engine provides the validation framework (structured results, field path tracking, error aggregation), while the Stellar RWA generator supplies the domain-specific validation rules (field constraints, structural checks, compliance module availability). Validation catches missing required fields, invalid field values (e.g., decimals out of range, symbol too long, duplicate claim topics), and structural issues (e.g., operators referencing undefined roles). Validation results are structured and machine-readable.

**Why this priority**: Validation prevents generation of broken artifacts and provides actionable feedback. The wizard UI relies on this for form validation, and programmatic consumers need it to fail fast with clear errors. The split between framework (core) and rules (generator) validates the extensibility model.

**Independent Test**: Can be tested by passing various invalid configuration objects and verifying the returned validation results contain the expected error codes and field paths.

**Acceptance Scenarios**:

1. **Given** a configuration with `token.symbol` longer than 12 characters, **When** validation is invoked, **Then** the result includes a specific error for the `token.symbol` field indicating the maximum length constraint.
2. **Given** a configuration with `token.decimals` set to 25 (above the 0–18 range), **When** validation is invoked, **Then** the result includes a specific error for the `token.decimals` field indicating the valid range.
3. **Given** a configuration with duplicate entries in `identityVerification.claimTopics`, **When** validation is invoked, **Then** the result includes an error indicating duplicate claim topics are not allowed.
4. **Given** a fully valid configuration, **When** validation is invoked, **Then** the result indicates success with no errors.
5. **Given** a configuration missing required fields (e.g., no `token.name`), **When** validation is invoked, **Then** the result includes errors for each missing required field.

---

### User Story 6 - Compliance Module Code Generation (Priority: P2)

When the user selects compliance modules (e.g., Transfer Limits, Supply Cap) in their configuration, the generator produces a separate contract crate for each selected module implementing the `ComplianceModule` trait. The generator only surfaces modules that have concrete implementations available in the Stellar contracts library — no stubs or placeholders.

**Why this priority**: Compliance modules are the key differentiator for RWA tokens but are the only part of the system without pre-existing library implementations. The generator must handle them cleanly, including gracefully limiting the selection to implemented modules.

**Independent Test**: Can be tested by requesting generation with various compliance module selections and verifying that only implemented modules produce contract output, and that the output correctly implements the `ComplianceModule` trait with the appropriate hook method logic.

**Acceptance Scenarios**:

1. **Given** a configuration with compliance modules selected and assigned to specific hooks, **When** the generator is invoked, **Then** each selected module produces a separate contract crate under `contracts/modules/{module-name}/` with a valid `ComplianceModule` trait implementation.
2. **Given** a request for the list of available compliance modules, **When** the package API is queried, **Then** it returns only modules with concrete implementations — no stubs or placeholders.
3. **Given** a configuration referencing a compliance module that is not yet implemented, **When** validation is invoked, **Then** it returns a clear error identifying the unsupported module.

---

### User Story 7 - Extend the Engine with a New Generator (Priority: P2)

A developer creating a new generator (e.g., EVM RWA, Midnight RWA, or a non-RWA contract library) can implement the core engine's generator interface, provide their own templates and validation rules, and produce output through the same pipeline — without modifying or forking the core engine. The core engine's extensibility contracts are the sole integration surface.

**Why this priority**: This story validates the architectural promise of modularity. If the core engine cannot be extended without modification, the two-package split has no value. This must be verified during development — even if no second generator ships in the MVP — to avoid locking in Stellar-specific assumptions in the core.

**Independent Test**: Can be tested by creating a minimal "dummy" generator that implements the engine's generator interface, produces a trivial file tree, and verifies it flows through the engine's validation, generation, and ZIP assembly pipeline without errors. This test lives in the core engine package.

**Acceptance Scenarios**:

1. **Given** a new generator that implements the core engine's generator interface, **When** it is registered and invoked with a configuration, **Then** the core engine orchestrates validation, file tree generation, and ZIP assembly using the generator's implementation — without any Stellar or RWA-specific assumptions.
2. **Given** two different generators (e.g., Stellar RWA and the dummy test generator), **When** each is invoked through the core engine with their respective configurations, **Then** each produces its own output independently, sharing only the engine's infrastructure.
3. **Given** the core engine's public API, **When** a developer reviews the generator interface, **Then** it defines clear extension points for: file tree generation, configuration validation rules, and available module/feature registries — without prescribing contract types, chain targets, or output languages.

---

### User Story 8 - Progress Feedback During Generation (Priority: P3)

When the generation pipeline is running (especially ZIP assembly), the consumer receives progress callbacks indicating which phase is active and the approximate completion percentage. The core engine owns progress orchestration; generators report phase transitions through the engine's callback mechanism.

**Why this priority**: Progress feedback is a UX enhancement. The generation pipeline involves multiple contract files, scripts, and ZIP assembly — providing feedback prevents the user from thinking the process has stalled. Lower priority because the pipeline should complete quickly for most configurations.

**Independent Test**: Can be tested by providing a progress callback to the generator and verifying it is called with sequential phase indicators and increasing completion percentages.

**Acceptance Scenarios**:

1. **Given** a progress callback function passed to the generator, **When** generation is invoked, **Then** the callback is invoked at least once per major phase (contract generation, script generation, ZIP assembly) with a phase identifier and completion percentage.
2. **Given** no progress callback is provided, **When** generation is invoked, **Then** the generation completes normally without errors (callback is optional).

---

### Edge Cases

- What happens when a configuration specifies zero claim topics and zero trusted issuers? The system should still generate valid contracts and scripts, with the post-deploy configuration section for CTI being empty.
- What happens when all operator roles are assigned to the same address? The system should generate valid role grants without deduplication issues.
- What happens when the token symbol contains characters that are invalid for directory names? The ZIP root directory name MUST be sanitized: lowercase the symbol, replace non-alphanumeric characters with hyphens, collapse consecutive hyphens, and trim leading/trailing hyphens. The suffix `-rwa` is appended (e.g., `"AC ME!"` → `acme-rwa/`).
- What happens when compliance modules are selected but none are assigned to any hook? The modules should still be generated and deployed, but the compliance contract has no module registrations in the post-deploy script.
- What happens when the configuration specifies a `multi-sig` or `dao` ownership model? The admin address in all contracts should use the corresponding multi-sig or DAO address transparently (address type is opaque).
- What happens when a generator implementation does not support a feature the core engine exposes (e.g., progress callbacks)? The engine should gracefully degrade — unsupported features produce no output, not errors.
- What happens when `accessControl.roles` is an empty array (no custom operator roles)? The system should generate valid contracts with only the admin role; no `grant_role_no_auth` calls appear in the constructor beyond admin setup.
- What happens when `token.initialSupply` is `"0"` vs `undefined`? When `"0"`, the deploy script includes the mint call with amount 0 (a no-op but valid). When `undefined`, the mint call is omitted entirely.
- What happens when `token.name` contains non-ASCII/Unicode characters? The token name is passed through to the Soroban `String` type unchanged — Unicode is valid. Validation MUST NOT restrict to ASCII-only; the max-length check counts UTF-8 bytes (Soroban `String` is byte-limited, not char-limited).
- What happens when `token.initialSupply` exceeds Soroban's `i128` range (max `170141183460469231731687303715884105727`)? Validation MUST reject values exceeding `i128::MAX` with a specific error on the `token.initialSupply` field.
- What happens when a `TrustedIssuer` has an empty `claimTopics` array? Validation MUST reject this as a structural error — a trusted issuer with no claim topics is semantically invalid.
- What happens when `deployment.network` is not a recognized value (not `"testnet"` or `"mainnet"`)? The value is treated as a custom RPC URL and passed through to the deploy script without validation. The generated README MUST note the expected format.
- What happens when the consumer passes an `RWAConfig` with extra/unknown properties beyond the defined schema? The generator MUST silently ignore unknown top-level and nested properties. Validation does not report them as errors or warnings.

## Requirements _(mandatory)_

### Core Codegen Engine Requirements

- **CR-001**: The core engine MUST provide a `Generator<TConfig>` interface that new generators implement to plug into the pipeline. The interface defines two methods: `validate(config)` returning a `ValidationResult`, and `generate(config, options?)` returning a `GenerationResult`. Feature/module registries (e.g., available compliance modules) are a generator-side concern — each generator package exposes its own registry through its public API, not through the `Generator` interface itself.
- **CR-002**: The core engine MUST NOT contain any chain-specific or contract-type-specific logic. It MUST be fully agnostic to Stellar, EVM, RWA, or any other domain.
- **CR-003**: The core engine MUST provide file tree assembly primitives that allow generators to declaratively build an in-memory representation of the output project (directories, files with string content). The `FileTree` type is `Record<string, string | Uint8Array>` — flat path-to-content mapping.
- **CR-004**: The core engine MUST provide ZIP packaging that converts an in-memory file tree into a ZIP archive. ZIP generation MUST be content-deterministic — the same file tree MUST always produce archives with identical file names and file contents. Byte-level identity of the archive is not guaranteed (compression metadata, timestamps, and ordering may vary).
- **CR-005**: The core engine MUST provide a validation framework that generators extend with domain-specific rules. The framework MUST produce structured, machine-readable results with field paths (dot-notation, e.g., `"token.decimals"`, `"compliance.modules[0].moduleId"`), error codes (uppercase snake_case, e.g., `INVALID_RANGE`, `DUPLICATE_ENTRY`, `REQUIRED_FIELD`, `UNSUPPORTED_MODULE`), and human-readable messages. Severity is represented by the error/warning distinction — `errors` block generation, `warnings` are advisory.
- **CR-006**: The core engine MUST support optional progress callbacks that generators invoke to report phase transitions. The engine MUST handle the case where no callback is provided gracefully.
- **CR-007**: The core engine MUST be usable in both browser and Node.js (>=20.x) environments without runtime errors.
- **CR-008**: The core engine MUST be publicly published as `@openzeppelin/codegen-core` with no dependencies on React, UI frameworks, or the RWA Wizard application.
- **CR-009**: All generation functions MUST be stateless and safe for concurrent invocation — no shared mutable state between calls. Two concurrent `generate()` calls with different configurations MUST not interfere with each other.

### Stellar RWA Generator Requirements

- **SR-001**: The Stellar RWA generator MUST implement the core engine's `Generator<RWAConfig>` interface and produce a complete Stellar/Soroban RWA token project from an `RWAConfig` configuration object. The generator package exposes standalone public functions (`generate()`, `validate()`, `generateZip()`, `getAvailableModules()`) that delegate to an internal `Generator` implementation — consumers do not instantiate the `Generator` interface directly.
- **SR-002**: The generator MUST produce all 5 core contracts as individual Rust crates within a Cargo workspace, each implementing the following traits:
  - **RWA Token**: `FungibleToken` (with `type ContractType = RWA`), `AccessControl`, `Pausable`, and optionally `DocumentManager`.
  - **Compliance**: `Compliance`, `TokenBinder`, `AccessControl`.
  - **Identity Verifier**: `IdentityVerifier`, `AccessControl`.
  - **Claim Topics & Issuers (CTI)**: `ClaimTopicsAndIssuers`, `AccessControl`.
  - **Identity Registry Storage (IRS)**: `IdentityRegistryStorage`, `CountryDataManager`, `TokenBinder`, `AccessControl`.
- **SR-003**: The generator MUST produce each contract as a thin wrapper following the canonical pattern from `stellar-contracts/examples/rwa/`: (1) an empty `#[contract] pub struct`; (2) a `#[contractimpl]` block with `pub fn __constructor(e: &Env, ...)` calling the library's storage setup functions (e.g., `Base::set_metadata()`, `access_control::set_admin()`, `access_control::grant_role_no_auth()`); (3) `#[contractimpl(contracttrait)] impl TraitName for ContractStruct { ... }` blocks where trait methods delegate to module-level library functions (e.g., `RWA::mint()`, `identity_storage::add_identity()`, `binder::bind_token()`).
- **SR-004**: The generator MUST conditionally include the `DocumentManager` trait implementation in the RWA Token contract based on the `token.documentManager.enabled` configuration toggle.
- **SR-005**: The generator MUST produce `#[only_role]` macro annotations on privileged functions. The role symbol mapping uses the `OperatorRole.symbol` field from the config, which MUST be max 9 characters (enforced by validation). The stable mapping for default roles is: `"manager"` → `symbol_short!("manager")`, `"agent"` → `symbol_short!("agent")`, `"operator"` → `symbol_short!("operator")`. Custom roles use the configured `symbol` value directly. The `#[only_role(param, "symbol")]` macro expands to `ensure_role()` + `param.require_auth()`.
- **SR-006**: The generator MUST produce a `build.sh` script that compiles all workspace contracts and a `deploy.sh` script that deploys and configures contracts in the correct dependency order (CTI → IRS → Identity Verifier → Compliance → Modules → RWA Token → post-deploy config). The deploy script MUST include error handling: each `stellar contract deploy` call checks the exit code and aborts with a message identifying which contract failed, rather than proceeding with undefined addresses.
- **SR-007**: The generator MUST produce a `config.json` file containing the serialized `RWAConfig` values consumed by the deployment scripts. The JSON structure mirrors the `RWAConfig` type directly — top-level keys `token`, `identityVerification`, `compliance`, `accessControl`, `deployment`. The deploy script reads specific values using `jq` or shell JSON parsing.
- **SR-008**: The generator MUST produce a workspace `Cargo.toml` with git dependencies pinned to a specific commit hash for the `stellar-contracts` library crates (`stellar-tokens`, `stellar-access`, `stellar-macros`, `stellar-contract-utils`) and `soroban-sdk` pinned to a specific version. The commit hash and SDK version are hardcoded constants per release of `@openzeppelin/codegen-rwa-stellar`. Generated code targets **Rust edition 2021**.
- **SR-009**: The generator MUST produce a `README.md` in the output project with: (1) project title and generated-by attribution; (2) prerequisites listing (Rust toolchain, `stellar` CLI, `soroban-sdk` version); (3) build instructions (`./scripts/build.sh`); (4) deployment instructions with network configuration; (5) architecture overview describing the multi-contract system and contract dependencies; (6) a table listing all generated contracts with their purpose, traits, and crate name; (7) a note that shell scripts target Unix-like environments.
- **SR-010**: The generator MUST provide RWA-specific validation rules (field lengths, numeric ranges, duplicate detection, structural checks) that plug into the core engine's validation framework.
- **SR-011**: The generator MUST only surface compliance modules that have concrete implementations in the Stellar contracts library — no stubs, placeholders, or partially implemented modules.
- **SR-012**: The generator MUST auto-generate a default token version (e.g., `"1.0.0"`) in the RWA Token constructor without requiring a wizard field.
- **SR-013**: The deploy script MUST perform post-deployment configuration in the correct order: bind token on Compliance and IRS, register modules on hooks, add claim topics, add trusted issuers, and optionally mint initial supply.
- **SR-014**: The Stellar RWA generator MUST be publicly published as `@openzeppelin/codegen-rwa-stellar`, consumable by the RWA Wizard app, CLI tools, and AI agents. The public API consists of four functions: `generate()` returns the raw `GenerationResult` (file tree + metadata); `generateZip()` wraps generation + ZIP assembly into a single `Promise<ZipResult>` call; `validate()` returns a `ValidationResult` without throwing; `getAvailableModules()` returns the compliance module registry. The `RWAConfig` type is re-exported from `@openzeppelin/rwa-config`. "Well-documented" means: JSDoc on all exported functions and types, parameter/return descriptions, and at least one usage example in the package README.
- **SR-015**: Each generated contract crate MUST include a `lib.rs` file containing `#![no_std]` (when required by Soroban), `mod contract;` declaration, and `pub use contract::*;` re-export — following the standard Soroban crate structure.
- **SR-016**: Each of the 5 core contracts MUST accept the following constructor arguments: (1) **RWA Token**: `e: &Env, name: String, symbol: String, admin: Address, initial_supply: i128` + role grant calls from config; (2) **Compliance**: `e: &Env, admin: Address`; (3) **Identity Verifier**: `e: &Env, admin: Address, cti_address: Address`; (4) **CTI**: `e: &Env, admin: Address`; (5) **IRS**: `e: &Env, admin: Address`. The `admin` in all contracts is the ownership address from `accessControl.ownership`.
- **SR-017**: The `validate()` function MUST return structured `ValidationResult` without throwing exceptions. The `generate()` function MUST throw an `Error` if invoked with an invalid configuration (callers should use `validate()` first for graceful handling). This dual behavior is intentional: `validate()` is for pre-flight checks, `generate()` guards against accidental misuse.

### Key Entities

- **Generator Interface**: The core engine's extensibility contract that all generators implement. Defines the methods a generator must provide: file tree generation from a configuration, validation rules, and feature/module registries. This is the sole integration surface between the engine and any generator.
- **FileTree**: An in-memory representation of a project's directory structure and file contents, produced by generators and consumed by the core engine's ZIP assembly. Chain-agnostic and format-agnostic.
- **ValidationResult**: A structured, machine-readable object containing validation outcomes — field paths, error codes, and human-readable messages. Severity is represented by the error/warning split: `errors[]` block generation, `warnings[]` are advisory. Produced by the core engine's validation framework using rules supplied by generators.
- **RWAConfig**: The canonical configuration object describing the desired RWA token system — token metadata, identity verification settings, compliance hook/module assignments, access control roles, and deployment parameters. Chain-agnostic by design. Owned by the shared `packages/config` package; consumed by all chain-specific generators.
- **ContractTemplate**: A Stellar-RWA-specific concept — a generatable contract unit consisting of trait implementations, constructor logic, access control annotations, and Cargo dependencies. Each template maps to one crate in the output project.
- **DeploymentScript**: A generated shell script that orchestrates contract compilation, deployment, and post-deployment configuration. Reads parameterized values from a config file. Stellar-specific.
- **ComplianceModuleRegistry**: A catalog of available compliance modules with their metadata (name, description, supported hooks). Only lists modules with concrete implementations. Stellar-specific; future generators provide their own registries.
- **GenerationResult**: The output of the generation pipeline — the in-memory file tree plus generation metadata (generator name/version, timestamp, file count, config hash). Usable directly by programmatic consumers or passed to the engine's ZIP assembly. If generation fails (invalid config), `generate()` throws rather than returning a partial result — callers use `validate()` for graceful pre-flight checks. The file tree is a first-class public API output, not just an internal intermediate step.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer can go from a valid configuration to a generated, extractable ZIP in under 5 seconds for a typical configuration (5 core contracts, 2 compliance modules, 3 roles) — measured in a Node.js >=20.x environment on commodity hardware (4+ cores, 8GB+ RAM).
- **SC-002**: 100% of generated Rust contract source files (edition 2021) are syntactically valid — verified by parsing with `syn` or successfully running `cargo check` against the pinned `soroban-sdk` version, without requiring full compilation of the Stellar SDK.
- **SC-003**: Generated deployment scripts correctly order all contract deployments respecting the dependency graph — verified by automated test that extracts shell variable assignments and `stellar contract deploy`/`invoke` calls, confirming address captures are used only after assignment.
- **SC-004**: All three packages (`codegen-core`, `rwa-config`, `codegen-rwa-stellar`) can be installed and invoked in a pure Node.js >=20.x environment (no browser, no React) without runtime errors — verified by standalone integration tests.
- **SC-005**: Configuration validation catches 100% of documented constraint violations (field lengths, numeric ranges, duplicate entries, missing required fields, `i128` overflow) — verified by a comprehensive validation test suite.
- **SC-006**: The generated project structure matches the canonical layout documented in `quickstart.md` § "Expected Output Structure" exactly — verified by structural comparison tests.
- **SC-007**: Each package maintains a focused public API surface, counted by primary exports (functions + named type exports from `index.ts`). Type re-exports and sub-types of an exported interface (e.g., fields of `RWAConfig`) do not count individually. Target: `codegen-core` ≤10, `rwa-config` ≤10, `codegen-rwa-stellar` ≤10.
- **SC-008**: A minimal "dummy" generator can be built on the core engine and produce output through the full pipeline (validate → generate → ZIP) — verified by an extensibility integration test within the core engine package. The dummy generator MUST: implement `Generator<{ message: string }>`, produce at least 2 files in the file tree, exercise the validation framework with at least 1 passing and 1 failing rule, and confirm no chain-specific or RWA-specific assumptions leak into the core.

## Assumptions

- The `stellar-contracts` library crates (`stellar-tokens`, `stellar-access`, `stellar-macros`, `stellar-contract-utils`) are stable enough for the codegen to target a pinned git commit. Breaking changes to trait signatures in the library would require codegen template updates. The pinned commit hash is updated via a manual process: before each release of `@openzeppelin/codegen-rwa-stellar`, the maintainer verifies the new commit against the generator's test suite, updates the constant, and documents the change in the package changelog.
- Compliance module implementations will be built in the `stellar-contracts` library before the wizard ships. The codegen package can be developed and tested against the `ComplianceModule` trait interface now, with module templates added as implementations land. If modules are delayed, the generator ships with an empty module registry — `getAvailableModules()` returns `[]` and validation rejects any module selection.
- All three packages (`@openzeppelin/codegen-core`, `@openzeppelin/rwa-config`, `@openzeppelin/codegen-rwa-stellar`) will be publicly published, following the same build pattern as other workspace packages (ESM + CJS via tsdown, TypeScript types). Public publishing enables consumption by the RWA Wizard app, third-party apps, CLI tools, and AI agents.
- Shell scripts (`build.sh`, `deploy.sh`) target Unix-like environments with the `stellar` CLI installed. Windows compatibility is not a requirement for the MVP. The generated README MUST document this limitation.
- The `RWAConfig` type lives in a dedicated shared config/types package (`packages/config`) within the RWA Wizard monorepo. All RWA generators depend on this package for the configuration type. The core codegen engine does not prescribe any configuration shape — it remains fully domain-agnostic.
- ZIP generation uses JSZip as the in-browser-compatible ZIP library, following the same approach as the UI Builder export pipeline. JSZip is a direct dependency of the core engine, not of individual generators.
- Future generators may target entirely different contract types (not just RWA), different chains (EVM, Midnight), or different output formats (Solidity, Move). The core engine's generator interface must not assume RWA semantics, T-REX architecture, or any particular contract library structure.
- The core codegen engine lives in the RWA Wizard monorepo, not in the shared `openzeppelin-ui` monorepo. The UI Builder has a comprehensive export system (`ZipGenerator`, `TemplateProcessor`, `zipInspector`, file map pattern, progress callbacks) inside `apps/builder/src/export/`, but extracting it into a shared upstream package is not worth the coordination overhead. Instead, the most valuable patterns and code should be copied into the codegen-core package and adapted: specifically the `ZipGenerator` (~160 lines, JSZip wrapper with browser/Node detection and progress reporting), the `zipInspector` test utilities (~166 lines, ZIP extraction and project validation), the `@@param@@` template substitution engine from `TemplateProcessor`, and the flat file map type (`Record<string, string | Uint8Array>`). Domain-specific parts (React code generation, Vite config, npm package management, Prettier formatting) are not relevant and should not be carried over.
- All packages require Node.js >=20.x for native `Blob` support (used by `ZipResult.data`). Browser environments provide `Blob` natively. This minimum version MUST be declared in each package's `engines` field.
- The `ComplianceHook` values (`'transfer'`, `'creation'`, `'destruction'`) map directly to the `ComplianceModule` trait methods: `on_transfer`/`can_transfer`, `on_created`/`can_create`, `on_destroyed`. This mapping is hardcoded in the Stellar generator.
- `GenerationMetadata.configHash` is computed as SHA-256 of `JSON.stringify(config)` with keys sorted alphabetically (deterministic serialization). This ensures the same logical config always produces the same hash regardless of property insertion order.
- Backwards compatibility for the public APIs of `codegen-core` and `rwa-config` follows semantic versioning. Breaking changes require a major version bump and coordination across all consuming packages per the constitution's governance rules. Bundle size optimization is deferred to post-MVP.
