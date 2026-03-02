# Research: Stellar RWA Codegen

**Branch**: `001-stellar-rwa-codegen` | **Date**: 2026-03-01

## R1: Template Rendering Strategy for Rust Code Generation

**Decision**: String concatenation with `@@param@@` placeholder substitution for simple cases; programmatic builders for conditional sections (e.g., DocumentManager toggle, role annotations).

**Rationale**: The generated Rust contracts are small (42–130 lines each) with well-defined structure. The variability is limited: conditional trait implementations, variable constructor arguments, and configurable role annotations. A full template engine (Handlebars, EJS) adds unnecessary dependency weight for what are essentially string builders with a few conditionals. The `@@param@@` pattern from UI Builder's TemplateProcessor is proven and lightweight. For conditional blocks (e.g., "include DocumentManager impl only if enabled"), programmatic string building in TypeScript is clearer than template-engine control flow in Rust syntax.

**Alternatives considered**:

- **Handlebars/EJS template engine**: Rejected — adds dependency, templates are small enough that programmatic generation is clearer, and Rust syntax in template files creates IDE confusion.
- **AST-based code generation**: Rejected — overkill for generating thin wrapper contracts. No need to parse or manipulate Rust ASTs when the output is fixed patterns with variable insertions.

## R2: Validation Framework Design

**Decision**: Rule-based validation with field path tracking. Generators register validation rules as functions `(config: unknown) => ValidationError[]`. The core engine aggregates results from all rules into a single `ValidationResult`.

**Rationale**: The wizard UI needs per-field validation errors for form feedback. Programmatic consumers need machine-readable error codes. A rule-based approach lets each generator define its own rules (field constraints, structural checks, module availability) without the core engine knowing anything about the config shape. Field paths (e.g., `"tokenSymbol"`, `"identityVerification.claimTopics[2]"`) enable precise error targeting.

**Alternatives considered**:

- **JSON Schema validation (Zod/Ajv)**: Considered as a supplement — Zod is a reasonable choice for the config package to define and validate the `RWAConfig` shape. The core engine's validation framework would then compose Zod validation from the config package with generator-specific semantic rules. This hybrid is worth evaluating during implementation.
- **Monolithic validation function**: Rejected — doesn't compose across generators and doesn't provide per-field granularity.

## R3: FileTree Representation

**Decision**: Use a flat `Record<string, string | Uint8Array>` (path → content) as the in-memory file tree, matching the UI Builder's proven pattern.

**Rationale**: The UI Builder has used this pattern successfully for its entire export pipeline. It's simple, supports both text and binary files, works in both browser and Node.js, and is directly consumable by JSZip. A richer tree abstraction (nested objects, directory nodes) adds complexity without benefit — JSZip handles directory creation implicitly from paths.

**Alternatives considered**:

- **Nested directory tree object**: Rejected — adds structural complexity with no functional benefit. JSZip creates directories from paths automatically.
- **Virtual filesystem (memfs)**: Rejected — unnecessary dependency for what is essentially a string map.

## R4: Contract Template Architecture

**Decision**: Each contract type has a dedicated template module (TypeScript file) that exports a `generate(config: RWAConfig): Record<string, string>` function producing the contract's file set (contract.rs, lib.rs, Cargo.toml).

**Rationale**: The 6 contract types (RWA Token, Compliance, Identity Verifier, CTI, IRS, Compliance Module) each have distinct trait implementations, constructor arguments, and RBAC annotations. Keeping them as separate modules makes each template independently testable and maintainable. The template function receives the full config and extracts what it needs — simpler than pre-slicing the config.

**Alternatives considered**:

- **Single monolithic generator**: Rejected — too large, hard to test individual contract generation.
- **Template files on disk (`.rs.template`)**: Rejected — complicates build and bundling for npm package. Inline string templates in TypeScript are simpler to package and test.

## R5: Deployment Script Generation Strategy

**Decision**: Generate shell scripts as string templates with variable interpolation from config. Scripts use `stellar contract deploy` and `stellar contract invoke` CLI commands. Address capture uses shell variable assignment (`CTI_ADDRESS=$(stellar contract deploy ...)`).

**Rationale**: The PRD specifies shell scripts as the deployment format (Open Decision #5). The Stellar CLI is the standard deployment tool. Shell scripts have the lowest barrier to entry — no additional runtime beyond `stellar` CLI. Address threading between deployment steps is naturally handled by shell variables.

**Alternatives considered**:

- **TypeScript/JavaScript deployment scripts**: Rejected — adds Node.js as a runtime dependency for users who may only have the Stellar CLI installed.
- **Makefile**: Rejected — less readable for the target audience, harder to implement conditional steps.

## R6: Pinned Commit Hash Management

**Decision**: Hardcode the `stellar-contracts` git commit hash as a constant in `@openzeppelin/codegen-rwa-stellar`. Update it when releasing a new version of the package.

**Rationale**: Each release of the generator targets a known-good version of the Stellar contracts library. This ensures reproducibility — the same generator version always produces the same Cargo.toml dependencies. Users who need a different version can manually edit the generated Cargo.toml after extraction.

**Alternatives considered**:

- **Configurable via RWAConfig**: Rejected — most users don't know which commit hash to use. Adds unnecessary complexity.
- **Fetch latest from GitHub API**: Rejected — introduces network dependency and non-determinism.

## R7: Package Dependency Graph

**Decision**: Three packages with clear dependency direction:

```
@openzeppelin/codegen-core        (no internal deps)
@openzeppelin/rwa-config          (no internal deps)
@openzeppelin/codegen-rwa-stellar (depends on both above)
```

**Rationale**: `codegen-core` and `rwa-config` are independent — neither knows about the other. The Stellar generator depends on both: it implements the core engine's `Generator` interface and consumes the `RWAConfig` type. This means non-RWA generators only depend on `codegen-core`, and the config package can evolve independently of the engine.

**Alternatives considered**:

- **Config inside codegen-core**: Rejected — makes core engine RWA-specific, violating CR-002.
- **Config inside generator**: Rejected — forces future generators to depend on Stellar package for shared types.

## R8: Stellar Contracts Reference Patterns

**Decision**: Use the existing `examples/rwa/src/contract.rs` (42 lines) and `examples/rwa/src/identity_registry_storage.rs` (130 lines) as the canonical templates. The generated code follows the exact same pattern: empty struct, `__constructor`, trait implementations with delegation to library storage functions, `#[only_role]` annotations.

**Key patterns from the reference implementations**:

- Constructor: `pub fn __constructor(e: &Env, ...)` with `Base::set_metadata()`, `access_control::set_admin()`, `access_control::grant_role_no_auth()`
- Trait impl: `#[contractimpl(contracttrait)] impl TraitName for ContractStruct { ... }`
- RBAC: `#[only_role(operator, "role_symbol")]` macro on methods
- Delegation: All trait methods delegate to module-level functions (e.g., `RWA::mint()`, `identity_storage::add_identity()`, `binder::bind_token()`)
- Soroban role symbols: max 9 chars via `symbol_short!("role")`

**Rationale**: Following the exact library patterns ensures the generated contracts are production-ready and consistent with the OpenZeppelin Stellar Contracts documentation.
