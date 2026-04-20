# Full Requirements Quality Checklist: Modular Codegen Engine + Stellar RWA Generator

**Purpose**: Comprehensive requirements quality review — validating completeness, clarity, consistency, and coverage across the spec, data model, and API contracts for all three packages.
**Created**: 2026-03-01
**Completed**: 2026-03-02
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md) | [data-model.md](../data-model.md)
**Audience**: PR reviewer (standard depth)

## Requirement Completeness

- [x] CHK001 - SC-004 references "Both packages" but the feature delivers three packages — is the success criterion's scope explicitly defined for all three? [Completeness, Spec §SC-004]

  > **Fixed**: SC-004 now reads "All three packages (`codegen-core`, `rwa-config`, `codegen-rwa-stellar`)".

- [x] CHK002 - Are error handling requirements defined for when `generate()` fails mid-pipeline (e.g., template rendering error)? The Key Entities section states `GenerationResult` "also contains structured error information if generation fails," but the data model's `GenerationResult` type has no error field. [Gap, Spec §Key Entities vs. Data Model §GenerationResult]

  > **Fixed**: GenerationResult entity and data model now clarify that `generate()` throws on invalid config rather than returning partial results. Error field removed from entity description. New SR-017 formalizes the dual behavior: `validate()` returns errors, `generate()` throws.

- [x] CHK003 - Are the exact traits each of the 5 core contracts must implement explicitly listed? SR-002 names the contracts but does not specify which traits each contract implements. [Completeness, Spec §SR-002]

  > **Fixed**: SR-002 now lists exact traits per contract (e.g., RWA Token: FungibleToken, AccessControl, Pausable; IRS: IdentityRegistryStorage, CountryDataManager, TokenBinder, AccessControl).

- [x] CHK004 - Are requirements defined for `Pausable` trait integration in generated contracts? [Gap]

  > **Fixed**: SR-002 now includes `Pausable` in the RWA Token trait list (inherited via `FungibleToken<ContractType = RWA>`).

- [x] CHK005 - Are requirements defined for `TokenBinder` trait implementation in the Compliance and Identity Registry Storage contracts? [Gap]

  > **Fixed**: SR-002 now lists `TokenBinder` for both Compliance and IRS contracts.

- [x] CHK006 - Is the structure and schema of the generated `config.json` (SR-007) specified? [Completeness, Spec §SR-007]

  > **Fixed**: SR-007 now specifies that the JSON structure mirrors `RWAConfig` directly with top-level keys `token`, `identityVerification`, `compliance`, `accessControl`, `deployment`.

- [x] CHK007 - Are requirements defined for `lib.rs` file contents in each generated crate? [Gap, Plan §Source Code]

  > **Fixed**: New SR-015 specifies `lib.rs` must contain `#![no_std]`, `mod contract;`, and `pub use contract::*;`.

- [x] CHK008 - Is the `soroban-sdk` version pinning specified? [Completeness, Spec §SR-008]

  > **Fixed**: SR-008 now includes `soroban-sdk` pinned to a specific version alongside the `stellar-contracts` commit hash.

- [x] CHK009 - Are requirements defined for the generated `README.md` content structure? [Completeness, Spec §SR-009]

  > **Fixed**: SR-009 now lists 7 specific sections: title/attribution, prerequisites, build instructions, deployment instructions, architecture overview, contract table, and Unix limitation note.

- [x] CHK010 - Are error code values cataloged or is there a requirement to define them? [Gap, Spec §CR-005]

  > **Fixed**: CR-005 now specifies error code naming convention (uppercase snake_case) with examples: `INVALID_RANGE`, `DUPLICATE_ENTRY`, `REQUIRED_FIELD`, `UNSUPPORTED_MODULE`.

- [x] CHK011 - Is there a requirement for how `OperatorRole.symbol` is auto-generated when not provided? [Ambiguity, Data Model §OperatorRole]

  > **Fixed**: Data model `OperatorRole.symbol` is now `optional`. Validation rules specify auto-generation from `name` (lowercase, truncate to 9 chars). API contract updated to match.

- [x] CHK012 - Are requirements defined for the `CountryDataManager` trait and `CountryData` associated type in the Identity Registry Storage contract? [Gap]
  > **Fixed**: SR-002 now lists `CountryDataManager` as a required trait for the IRS contract.

## Requirement Clarity

- [x] CHK013 - Is "deterministic ZIP" (CR-004) defined precisely — does it mean byte-identical archives or content-identical archives? [Clarity, Spec §CR-004]

  > **Fixed**: CR-004 now specifies "content-deterministic" — identical file names and file contents. Byte-level identity is explicitly not guaranteed (compression metadata may vary).

- [x] CHK014 - SC-001's "<5 seconds" performance target — is the target environment specified? [Clarity, Spec §SC-001]

  > **Fixed**: SC-001 now specifies "Node.js >=20.x environment on commodity hardware (4+ cores, 8GB+ RAM)".

- [x] CHK015 - SC-002 says generated Rust files should be "parseable by `rustfmt`" — `rustfmt` is a formatter, not a syntax validator. [Clarity, Spec §SC-002]

  > **Fixed**: SC-002 now says "verified by parsing with `syn` or successfully running `cargo check` against the pinned `soroban-sdk` version".

- [x] CHK016 - SR-005 references a "stable role symbol mapping" — is the mapping defined? [Clarity, Spec §SR-005]

  > **Fixed**: SR-005 now defines the default mapping (`"manager"` → `symbol_short!("manager")`, `"agent"` → `symbol_short!("agent")`, `"operator"` → `symbol_short!("operator")`), explains custom roles use the configured `symbol` directly, and describes the macro expansion.

- [x] CHK017 - CR-001 lists "feature/module registries" as a required extension point, but the `Generator` interface only defines `validate()` and `generate()`. [Clarity, Spec §CR-001 vs. codegen-core-api.ts]

  > **Fixed**: CR-001 now clarifies that registries are a generator-side concern — each generator package exposes its own registry through its public API (e.g., `getAvailableModules()`), not through the `Generator` interface itself.

- [x] CHK018 - Is "structured error information" in the `GenerationResult` entity definition quantified? [Clarity, Spec §Key Entities]

  > **Fixed**: GenerationResult entity now explicitly states `generate()` throws on failure and describes the metadata fields. No error field — errors are handled via `validate()` pre-flight or thrown `Error`.

- [x] CHK019 - SR-003 says contracts should follow "the established pattern from the library's reference examples" — is this pattern documented explicitly? [Clarity, Spec §SR-003]

  > **Fixed**: SR-003 now documents the exact 3-step pattern: (1) empty `#[contract] pub struct`, (2) `#[contractimpl]` with `__constructor`, (3) `#[contractimpl(contracttrait)] impl Trait for Struct` blocks with delegation to library functions. Specific function names included.

- [x] CHK020 - Is "well-documented public API" (SR-014) defined with measurable criteria? [Clarity, Spec §SR-014]
  > **Fixed**: SR-014 now defines "well-documented" as: JSDoc on all exported functions and types, parameter/return descriptions, and at least one usage example in the package README.

## Requirement Consistency

- [x] CHK021 - User Story 5 acceptance scenarios reference `tokenSymbol` and `tokenName` field paths, but the `RWAConfig` data model uses `token.symbol` and `token.name`. [Consistency, Spec §US-5 vs. Data Model §TokenConfig]

  > **Fixed**: US-5 acceptance scenarios now use correct dot-notation field paths: `token.symbol`, `token.decimals`, `identityVerification.claimTopics`, `token.name`.

- [x] CHK022 - The spec Key Entities section says `ValidationResult` contains "severity levels," but the data model type only has `errors[]` and `warnings[]`. [Consistency, Spec §Key Entities vs. Data Model §ValidationResult]

  > **Fixed**: Key Entities `ValidationResult` description now reads "error/warning distinction" instead of "severity levels". CR-005 also clarifies: errors block generation, warnings are advisory.

- [x] CHK023 - The spec Assumptions section references `FileTree` as `Record<string, string | Uint8Array | Blob>` (including Blob), but the data model defines it as `Record<string, string | Uint8Array>`. [Consistency, Spec §Assumptions vs. Data Model §FileTree]

  > **Fixed**: Assumptions section now uses `Record<string, string | Uint8Array>` (no Blob), consistent with the data model and API contracts.

- [x] CHK024 - The codegen-core API contract header lists 11+ type exports, but SC-007 requires "<10 exported symbols". [Consistency, codegen-core-api.ts vs. Spec §SC-007]

  > **Fixed**: SC-007 now defines counting methodology — primary exports (functions + named type exports from `index.ts`), not sub-types. API contract header updated: 8 primary exports, 4 supporting sub-types not individually counted.

- [x] CHK025 - `rwa-config` exports 12+ types. Does this exceed SC-007's target? [Consistency, rwa-config-api.ts vs. Spec §SC-007]

  > **Fixed**: API contract header updated: 4 primary exports (RWAConfig, ComplianceHook (string alias), OwnershipModel, DEFAULT_ROLE_SYMBOLS). Sub-types of RWAConfig (TokenConfig, etc.) not counted individually. Note: VALIDATION_CONSTANTS moved to `@openzeppelin/codegen-rwa-stellar` as `STELLAR_VALIDATION_CONSTANTS` to maintain chain-agnostic boundary. ComplianceHook changed from fixed union to `string` — each ecosystem defines its own valid values.

- [x] CHK026 - The `codegen-core` `generateZip()` takes `(result, fileName, options)` while `codegen-rwa-stellar` `generateZip()` takes `(config, options)`. Is the wrapper relationship documented? [Consistency, codegen-core-api.ts vs. codegen-rwa-stellar-api.ts]
  > **Fixed**: Both API contracts now include documentation explaining the wrapper pattern. Core's `generateZip()` JSDoc notes that generator packages wrap it. Stellar's `generateZip()` JSDoc explains it calls `generate()` internally then delegates to core.

## Cross-Package Consistency

- [x] CHK027 - Does the `Generator<TConfig>` interface align with how `codegen-rwa-stellar` actually uses it? The stellar package exposes standalone functions, not a `Generator` instance. [Consistency, codegen-core-api.ts vs. codegen-rwa-stellar-api.ts]

  > **Fixed**: SR-001 now explicitly documents this relationship: "The generator package exposes standalone public functions (`generate()`, `validate()`, `generateZip()`, `getAvailableModules()`) that delegate to an internal `Generator` implementation — consumers do not instantiate the `Generator` interface directly."

- [x] CHK028 - Is the `ComplianceHook` type defined in `rwa-config` consistent with the hooks used by the `ComplianceModule` trait in `stellar-contracts`? [Consistency, rwa-config-api.ts vs. stellar-contracts §ComplianceModule]

  > **Fixed**: `ComplianceHook` in `rwa-config` is now an opaque `string`. The Stellar codegen package defines `StellarComplianceHook` with 5 values (`canTransfer`, `canCreate`, `transferred`, `created`, `destroyed`) mapping 1:1 to the Rust `ComplianceHook` enum in `stellar-contracts`. Data model documents the ecosystem-specific hook mapping. EVM T-REX uses 4 hooks (no `canCreate`). Each generator validates hook values against its own set.

- [x] CHK029 - Are the `GenerationMetadata` fields requirements defined consistently between core and stellar? Who populates these fields? [Consistency, Data Model §GenerationMetadata]

  > **Fixed**: Data model `GenerationMetadata` now documents each field's source: all populated by the generator implementation, not the core engine.

- [x] CHK030 - Is the `configHash` algorithm in `GenerationMetadata` specified? [Clarity, Data Model §GenerationMetadata]
  > **Fixed**: Data model now specifies SHA-256 of `JSON.stringify(config)` with keys sorted alphabetically. Assumptions section also documents this algorithm.

## Acceptance Criteria Quality

- [x] CHK031 - SC-002's "100% syntactically valid" — is there a requirement for which Rust edition the generated code targets? [Measurability, Spec §SC-002]

  > **Fixed**: SR-008 now specifies "Generated code targets Rust edition 2021". SC-002 references the pinned `soroban-sdk` version.

- [x] CHK032 - SC-003's "verified by script analysis" — is this an automated test or manual review? [Measurability, Spec §SC-003]

  > **Fixed**: SC-003 now specifies "verified by automated test that extracts shell variable assignments and `stellar contract deploy`/`invoke` calls, confirming address captures are used only after assignment."

- [x] CHK033 - SC-006's "matches the documented ZIP layout specification exactly" — where is the canonical layout documented? [Measurability, Spec §SC-006]

  > **Fixed**: SC-006 now references `quickstart.md` § "Expected Output Structure" as the canonical layout specification.

- [x] CHK034 - SC-007's "<10 exported symbols" — is the counting methodology defined? [Measurability, Spec §SC-007]

  > **Fixed**: SC-007 now defines: primary exports (functions + named type exports from `index.ts`). Re-exports and sub-types don't count individually. Lists target per package.

- [x] CHK035 - SC-008's "dummy generator" test — are the minimum requirements specified? [Measurability, Spec §SC-008]
  > **Fixed**: SC-008 now specifies the dummy generator must: implement `Generator<{ message: string }>`, produce at least 2 files, exercise validation with at least 1 passing and 1 failing rule.

## Scenario Coverage

- [x] CHK036 - Are requirements specified for `initialSupply` = `"0"` vs `undefined`? [Coverage, Spec §US-1]

  > **Fixed**: New edge case added: `"0"` → deferred manual-mint guidance is still emitted with requested amount `0`; `undefined` → the guidance is omitted entirely.

- [x] CHK037 - Are requirements defined for concurrent/parallel generation calls? [Coverage, Gap]

  > **Fixed**: New CR-009 added: "All generation functions MUST be stateless and safe for concurrent invocation — no shared mutable state between calls."

- [x] CHK038 - Are requirements defined for extra/unknown properties in `RWAConfig`? [Coverage, Gap]

  > **Fixed**: New edge case added: "The generator MUST silently ignore unknown top-level and nested properties."

- [x] CHK039 - Are requirements for deploy script failure handling specified? [Coverage, Gap]

  > **Fixed**: SR-006 now requires: "each `stellar contract deploy` call checks the exit code and aborts with a message identifying which contract failed, rather than proceeding with undefined addresses."

- [x] CHK040 - Are requirements defined for what constructor arguments each of the 5 core contracts accepts? [Coverage, Spec §SR-002]
  > **Fixed**: New SR-016 added listing exact constructor arguments for all 5 contracts (RWA Token, Compliance, Identity Verifier, CTI, IRS).

## Edge Case Coverage

- [x] CHK041 - Is the behavior for empty `roles` array (no custom operator roles) specified? [Edge Case, Spec §Edge Cases]

  > **Fixed**: New edge case added: empty roles array → valid contracts with only admin role, no `grant_role_no_auth` calls beyond admin setup.

- [x] CHK042 - Are requirements for Unicode characters in `token.name` defined? [Edge Case, Data Model §TokenConfig]

  > **Fixed**: New edge case added: Unicode is valid (passed through to Soroban `String`); max-length check counts UTF-8 bytes, not characters.

- [x] CHK043 - Is the behavior for very large `initialSupply` values specified? [Edge Case, Data Model §TokenConfig]

  > **Fixed**: New edge case added: validation MUST reject values exceeding `i128::MAX`. SC-005 also updated to include `i128` overflow.

- [x] CHK044 - Is the sanitization algorithm for ZIP root directory name documented? [Edge Case, Spec §Edge Cases]

  > **Fixed**: Edge case now defines the algorithm: lowercase, replace non-alphanumeric with hyphens, collapse consecutive hyphens, trim leading/trailing hyphens, append `-rwa`.

- [x] CHK045 - Is the behavior defined for `trustedIssuers` with an empty `claimTopics` array? [Edge Case, Data Model §TrustedIssuer]

  > **Fixed**: New edge case added: validation MUST reject a trusted issuer with no claim topics as a structural error.

- [x] CHK046 - Are requirements for adapter-backed `deployment.target` variants specified clearly? [Edge Case, Data Model §DeploymentConfig]
  > **Fixed**: New edge case added: preset targets must use recognized adapter-backed Stellar `networkId` values, unsupported ecosystems fail validation, and custom targets pass `rpcUrl` through while optionally carrying `explorerUrl` and `label` metadata for generated output.

## Non-Functional Requirements

- [x] CHK047 - Are bundle size requirements specified for the published packages? [Gap]

  > **Deferred**: Bundle size optimization is explicitly deferred to post-MVP. Added to Assumptions section.

- [x] CHK048 - Is the minimum Node.js version explicitly stated? [Gap]

  > **Fixed**: CR-007 now specifies "Node.js (>=20.x)". New assumption added: "All packages require Node.js >=20.x for native `Blob` support. This minimum version MUST be declared in each package's `engines` field."

- [x] CHK049 - Are backwards compatibility requirements defined for the public APIs? [Gap]

  > **Fixed**: New assumption added: "Backwards compatibility follows semantic versioning. Breaking changes require a major version bump and coordination per the constitution's governance rules."

- [x] CHK050 - Is the `Blob` availability in Node.js environments addressed? [Gap, codegen-core-api.ts §ZipResult]
  > **Fixed**: Addressed by CHK048 — Node.js >=20.x provides native `Blob`. Documented in Assumptions.

## Dependencies & Assumptions

- [x] CHK051 - Is the assumption about compliance module readiness validated? What is the fallback? [Assumption, Spec §Assumptions]

  > **Fixed**: Assumption now includes fallback: "If modules are delayed, the generator ships with an empty module registry — `getAvailableModules()` returns `[]` and validation rejects any module selection."

- [x] CHK052 - Is the `stellar-contracts` commit hash update workflow documented? [Assumption, Spec §Assumptions]

  > **Fixed**: Assumption now describes the process: "before each release, the maintainer verifies the new commit against the generator's test suite, updates the constant, and documents the change in the package changelog."

- [x] CHK053 - Is the dependency on `JSZip` specifically documented, or is "JSZip or equivalent" the constraint? [Ambiguity, Spec §Assumptions vs. Constitution §VI]

  > **Fixed**: Assumption now reads "JSZip" without the "or equivalent" hedge, aligning with the constitution's reference.

- [x] CHK054 - Is the Unix-only limitation for shell scripts validated and documented? [Assumption, Spec §Assumptions]
  > **Fixed**: Assumption now includes: "The generated README MUST document this limitation." SR-009 also lists a Unix limitation note as a required README section.

## Ambiguities & Conflicts

- [x] CHK055 - The stellar API contract's `generate()` says `@throws {Error}` but US-4 scenario 3 says validation "returns structured errors... without throwing exceptions." Is the error handling strategy consistent? [Ambiguity, codegen-rwa-stellar-api.ts vs. Spec §US-4]

  > **Fixed**: New SR-017 explicitly formalizes the dual behavior: `validate()` returns structured errors without throwing; `generate()` throws if config is invalid. US-4 scenario 3 refers to `validate()`, which is correct. API contract JSDoc updated to clarify.

- [x] CHK056 - CR-001 requires "feature/module registries" as a Generator extension point, but the `Generator` interface only has `validate()` + `generate()`. [Conflict, Spec §CR-001 vs. codegen-core-api.ts]

  > **Fixed**: CR-001 rewritten to clarify — registries are a generator-package concern exposed through each package's own public API (e.g., `getAvailableModules()`), not through the core `Generator` interface.

- [x] CHK057 - `ComplianceModuleRegistryEntry` has `implemented: boolean` but `getAvailableModules()` only returns implemented modules. Is the field redundant? [Ambiguity, codegen-rwa-stellar-api.ts]

  > **Fixed**: Removed `implemented` field from `ComplianceModuleRegistryEntry` in both API contract and data model. `getAvailableModules()` only returns implemented modules, so the field was redundant.

- [x] CHK058 - Is there a conflict between `generateZip()` as "option flag" vs separate function? [Ambiguity, Spec §Clarifications vs. codegen-rwa-stellar-api.ts]
  > **Fixed**: SR-014 now explicitly defines `generateZip()` as a separate function (not an option flag). The earlier Clarifications section noted "a separate `generateZip()` (or option flag)" — the "(or option flag)" phrasing was exploratory; the API contract resolves it as a separate function.

## Notes

- All 58 items reviewed and resolved
- Changes applied to: spec.md, data-model.md, codegen-core-api.ts, rwa-config-api.ts, codegen-rwa-stellar-api.ts
- 4 new requirements added: CR-009 (stateless concurrency), SR-015 (lib.rs), SR-016 (constructor args), SR-017 (error handling strategy)
- 7 new edge cases added (empty roles, initialSupply semantics, Unicode, i128 overflow, empty claimTopics, deployment target variants, unknown properties)
