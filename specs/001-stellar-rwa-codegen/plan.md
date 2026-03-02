# Implementation Plan: Modular Codegen Engine + Stellar RWA Generator

**Branch**: `001-stellar-rwa-codegen` | **Date**: 2026-03-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-stellar-rwa-codegen/spec.md`

## Summary

Build three publicly published npm packages in the RWA Wizard monorepo: `@openzeppelin/codegen-core` (chain-agnostic generation pipeline), `@openzeppelin/rwa-config` (shared RWA configuration type), and `@openzeppelin/codegen-rwa-stellar` (Stellar/Soroban RWA contract generator). The core engine provides file tree assembly, ZIP packaging, validation framework, and progress reporting. The Stellar generator produces a complete multi-contract Rust/Soroban project (5 core contracts + optional compliance modules + deployment scripts) from a declarative `RWAConfig` object. Key patterns are adapted from the UI Builder's export system (ZipGenerator, TemplateProcessor, zipInspector).

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js >=20.19.0  
**Primary Dependencies**: JSZip (ZIP generation), tsdown (build), Vitest (testing)  
**Storage**: N/A — stateless library packages  
**Testing**: Vitest (unit + integration), zipInspector pattern for output validation  
**Target Platform**: Isomorphic (browser + Node.js)  
**Project Type**: Library (3 npm packages)  
**Performance Goals**: <5s for typical generation (5 contracts, 2 modules, 3 roles) per SC-001  
**Constraints**: No React deps, no browser-only APIs (except JSZip), isomorphic, <10 exported symbols per package  
**Scale/Scope**: 3 packages, 8 key entities, 9 CR + 17 SR requirements, 8 success criteria

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                      | Status  | Notes                                                                                                                                                             |
| ------------------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Codegen-Led, Chain-Agnostic | ✅ PASS | Three packages split by concern: core engine (chain-agnostic), config (RWA-specific, chain-agnostic), Stellar generator (chain-specific). No chain logic in core. |
| II. Reuse-First & Monorepo     | ✅ PASS | Adapting ZipGenerator, TemplateProcessor, zipInspector from UI Builder. Packages live in rwa-wizard monorepo under `packages/`.                                   |
| III. Type Safety               | ✅ PASS | Full TypeScript strict. `RWAConfig` fully typed in `@openzeppelin/rwa-config`. No `any` types.                                                                    |
| IV. UI/Design System           | N/A     | Headless packages — no UI.                                                                                                                                        |
| V. Testing/TDD                 | ✅ PASS | Vitest for all packages. TDD for validation rules, template generation, ZIP assembly. Dummy generator test for extensibility (SC-008).                            |
| VI. Tooling/Persistence        | ✅ PASS | Standalone packages, no persistence. ZIP via codegen-core. Build via tsdown.                                                                                      |
| ZIP Generation                 | ✅ PASS | Deterministic, in-memory, via codegen-core wrapping JSZip. Dual API: `generate()` + `generateZip()`. Progress callbacks supported.                                |
| Security                       | ✅ PASS | Generated contracts include `#[only_role]` and `#[only_admin]` annotations. No hardcoded secrets.                                                                 |

**Gate result: PASS** — No violations. Proceed to Phase 0.

### Post-Phase 1 Re-Check

| Principle                      | Status  | Notes                                                                                                                                                            |
| ------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Codegen-Led, Chain-Agnostic | ✅ PASS | Generator interface in codegen-core is fully config-agnostic (`Generator<TConfig = unknown>`). No Stellar/RWA types leak into core.                              |
| II. Reuse-First                | ✅ PASS | ZipGenerator, zipInspector, TemplateProcessor patterns documented in research.md (R1, R3). Packages live in `packages/` following existing monorepo conventions. |
| III. Type Safety               | ✅ PASS | All entities fully typed in data-model.md. RWAConfig has zero implicit `any` fields. OwnershipModel uses discriminated unions.                                   |
| V. Testing/TDD                 | ✅ PASS | Dummy generator test validates extensibility (SC-008). zipInspector utility enables output validation. Test structure defined in project layout.                 |
| VI. Tooling/Persistence        | ✅ PASS | `generateZip()` is a standalone core engine function, not coupled to any generator. Dual API surface confirmed in contracts.                                     |
| ZIP Determinism                | ✅ PASS | `configHash` in GenerationMetadata enables reproducibility tracking. Same FileTree → same ZIP contents.                                                          |
| <10 Exported Symbols           | ✅ PASS | codegen-core: ~8 type exports + 1 function. rwa-config: ~4 type exports + 1 constant. stellar: 4 function exports + re-exports. Counted per SC-007 methodology.  |

**Post-design gate result: PASS** — No new violations introduced.

## Project Structure

### Documentation (this feature)

```text
specs/001-stellar-rwa-codegen/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (public API interfaces)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── codegen-core/                    # @openzeppelin/codegen-core
│   ├── src/
│   │   ├── index.ts                 # Public API exports
│   │   ├── types.ts                 # Generator interface, FileTree, ValidationResult, GenerationResult
│   │   ├── generator.ts             # Generation pipeline orchestrator
│   │   ├── validation.ts            # Validation framework (rule aggregation, field paths, error codes)
│   │   ├── file-tree.ts             # FileTree builder utilities
│   │   ├── zip-generator.ts         # ZipGenerator (adapted from UI Builder)
│   │   └── progress.ts              # Progress callback types and orchestration
│   ├── __tests__/
│   │   ├── generator.test.ts        # Pipeline orchestration tests (with dummy generator)
│   │   ├── validation.test.ts       # Validation framework tests
│   │   ├── file-tree.test.ts        # FileTree builder tests
│   │   ├── zip-generator.test.ts    # ZIP generation tests (determinism, progress)
│   │   └── utils/
│   │       └── zip-inspector.ts     # ZIP extraction + validation utilities (adapted from UI Builder)
│   ├── package.json
│   ├── tsconfig.json
│   └── tsdown.config.ts
│
├── config/                          # @openzeppelin/rwa-config
│   ├── src/
│   │   ├── index.ts                 # Public API exports
│   │   ├── types.ts                 # RWAConfig, ClaimTopic, TrustedIssuer, ComplianceHook, OperatorRole, etc.
│   │   ├── defaults.ts              # Default values, role symbol mapping
│   │   └── constants.ts             # Validation constants (max lengths, ranges, role symbols)
│   ├── __tests__/
│   │   └── types.test.ts            # Type guard and constant tests
│   ├── package.json
│   ├── tsconfig.json
│   └── tsdown.config.ts
│
├── codegen-rwa-stellar/             # @openzeppelin/codegen-rwa-stellar
│   ├── src/
│   │   ├── index.ts                 # Public API: generate(), generateZip(), validate(), modules registry
│   │   ├── stellar-rwa-generator.ts # Generator interface implementation
│   │   ├── validation/
│   │   │   └── rules.ts             # RWA-specific validation rules
│   │   ├── templates/
│   │   │   ├── contracts/
│   │   │   │   ├── rwa-token.ts     # RWA Token contract template
│   │   │   │   ├── compliance.ts    # Compliance contract template
│   │   │   │   ├── identity-verifier.ts
│   │   │   │   ├── claim-topics-issuers.ts
│   │   │   │   ├── identity-registry-storage.ts
│   │   │   │   └── compliance-module.ts
│   │   │   ├── scripts/
│   │   │   │   ├── build-sh.ts      # build.sh template
│   │   │   │   └── deploy-sh.ts     # deploy.sh template
│   │   │   ├── cargo/
│   │   │   │   ├── workspace-toml.ts  # Root Cargo.toml template
│   │   │   │   └── crate-toml.ts      # Per-crate Cargo.toml template
│   │   │   ├── readme.ts           # README.md template
│   │   │   └── lib-rs.ts           # lib.rs template (shared across crates)
│   │   ├── modules/
│   │   │   └── registry.ts         # ComplianceModuleRegistry (available modules)
│   │   └── constants.ts            # Pinned commit hash, role symbol map, crate versions
│   ├── __tests__/
│   │   ├── generate.test.ts        # End-to-end generation tests + progress callback tests
│   │   ├── generate-zip.test.ts    # ZIP output tests
│   │   ├── validation.test.ts      # RWA validation rule tests (all edge cases from spec)
│   │   ├── standalone.test.ts      # Standalone Node.js integration test
│   │   ├── benchmark.test.ts       # SC-001 performance benchmark (<5s)
│   │   ├── syntax-validation.test.ts # SC-002 Rust syntax validation
│   │   ├── templates/
│   │   │   ├── rwa-token.test.ts   # Token contract template tests
│   │   │   ├── compliance-module.test.ts # Compliance module template tests
│   │   │   ├── scripts.test.ts     # Script generation tests (deploy order, address threading)
│   │   │   └── cargo.test.ts       # Cargo.toml generation tests
│   │   └── modules/
│   │       └── registry.test.ts    # Module registry tests
│   ├── package.json
│   ├── tsconfig.json
│   └── tsdown.config.ts
│
├── components/                      # Existing (unchanged)
└── hooks/                           # Existing (unchanged)
```

**Structure Decision**: Three packages under `packages/` following the existing monorepo convention. `codegen-core` is the lowest layer (no internal deps), `config` depends on nothing, and `codegen-rwa-stellar` depends on both. Each package builds with tsdown (ESM + CJS + DTS), matching `packages/components` and `packages/hooks`.

## Complexity Tracking

No constitution violations to justify.
