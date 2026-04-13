# Mock Gap Register: RWA Wizard UI Shell

**Feature**: `002-wizard-ui-shell`
**Date**: 2026-04-13
**Status**: All runtime codegen flows use the real `@openzeppelin/codegen-rwa-stellar` package. No mock fallback is active at runtime.

---

## Active Gaps

### GAP-001: Test-Only Codegen Service


| Field                     | Value                                                                                                                                                                                                                            |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ID**                    | `GAP-001`                                                                                                                                                                                                                        |
| **Target**                | `stellar`                                                                                                                                                                                                                        |
| **Affected Flow**         | Unit/integration tests for generation hook, review step, and codegen service parity                                                                                                                                              |
| **Mocked API Seam**       | `RwaCodegenService` (`validate`, `getAvailableModules`, `generateZip`)                                                                                                                                                           |
| **User-Visible Fallback** | None — test-only; not used at runtime                                                                                                                                                                                            |
| **Mock Behavior**         | `createTestCodegenService()` returns deterministic hardcoded validation (always valid), a fixed 3-module catalog (supply-limit, max-balance, country-restrict), and a synthetic ZIP blob. All modules are marked `under-review`. |
| **Replacement Trigger**   | No replacement needed — this is intentionally a test double, not a runtime mock. It will evolve alongside the real codegen package API.                                                                                          |
| **Owning File**           | `apps/rwa-wizard/src/services/codegen/testCodegenService.ts`                                                                                                                                                                     |
| **Status**                | **Stable** — by design for testing                                                                                                                                                                                               |


---

### GAP-002: Compliance Module Review States


| Field                     | Value                                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ID**                    | `GAP-002`                                                                                                                                                                                                                 |
| **Target**                | `stellar`                                                                                                                                                                                                                 |
| **Affected Flow**         | Compliance step module catalog, review step summary                                                                                                                                                                       |
| **Mocked API Seam**       | `ComplianceModuleOption.review.state`                                                                                                                                                                                     |
| **User-Visible Fallback** | Modules display an "Under Review" badge in the catalog and review summary. Users can still select and configure these modules.                                                                                            |
| **Mock Behavior**         | Not a mock — the `under-review` state is real data from `@openzeppelin/codegen-rwa-stellar`. However, all currently available Stellar compliance modules (supply-limit, max-balance, country-restrict) are in this state. |
| **Replacement Trigger**   | When the Stellar contracts team merges the compliance module PRs and the codegen package reports `review.state: 'stable'` for each module, the UI will automatically reflect the updated state.                           |
| **Owning File**           | `@openzeppelin/codegen-rwa-stellar` (external package)                                                                                                                                                                    |
| **Status**                | **Active** — waiting on upstream stabilization                                                                                                                                                                            |


---

### GAP-003: Disabled Target Ecosystems


| Field                     | Value                                                                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ID**                    | `GAP-003`                                                                                                                                                                  |
| **Target**                | `evm`, `avalanche`, `solana` (future targets)                                                                                                                              |
| **Affected Flow**         | Target selector sidebar — disabled entries with "Coming Soon" labels                                                                                                       |
| **Mocked API Seam**       | `TargetCatalogEntry` registry — `enabled: false, showInUI: true` entries                                                                                                   |
| **User-Visible Fallback** | Target buttons appear in the sidebar but are disabled with a "Coming Soon" badge. No codegen runtime exists for these targets.                                             |
| **Mock Behavior**         | The registry contains static metadata entries for future targets. These are not backed by any codegen package — selecting them is blocked at the UI level.                 |
| **Replacement Trigger**   | When a `@openzeppelin/codegen-rwa-<target>` package is published and a `codegenLoader` case is added for the target, the registry entry can be updated to `enabled: true`. |
| **Owning File**           | `apps/rwa-wizard/src/registry/targets.ts`                                                                                                                                  |
| **Status**                | **Active** — by design for MVP                                                                                                                                             |


---

### GAP-004: Ecosystem Metadata Fallback


| Field                     | Value                                                                                                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ID**                    | `GAP-004`                                                                                                                                                                                                       |
| **Target**                | `stellar`                                                                                                                                                                                                       |
| **Affected Flow**         | Wizard steps that consume `TargetEcosystemMetadata` (admin controls, identity controls, operator roles, compliance hooks, limits)                                                                               |
| **Mocked API Seam**       | `RwaCodegenService.getEcosystemMetadata()`                                                                                                                                                                      |
| **User-Visible Fallback** | If the codegen package does not expose `getEcosystemMetadata`, the wizard falls back to empty arrays for controls/roles/hooks and zero-valued limits. The UI gracefully handles this by showing empty sections. |
| **Mock Behavior**         | Not a mock — the real codegen package provides this metadata. The gap is that the method is optional (`getEcosystemMetadata?`), so a fallback path exists.                                                      |
| **Replacement Trigger**   | When `getEcosystemMetadata` is guaranteed to be present in all target codegen packages, the optional chaining can be removed.                                                                                   |
| **Owning File**           | `apps/rwa-wizard/src/services/codegen/types.ts` (optional method)                                                                                                                                               |
| **Status**                | **Active** — defensive design                                                                                                                                                                                   |


---

### GAP-005: Network Options for Deployment


| Field                     | Value                                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ID**                    | `GAP-005`                                                                                                                                                              |
| **Target**                | `stellar`                                                                                                                                                              |
| **Affected Flow**         | Deployment placeholder step (hidden by default behind `DEPLOYMENT_STEP` feature flag)                                                                                  |
| **Mocked API Seam**       | `TargetCapabilitySnapshot.networkOptions`                                                                                                                              |
| **User-Visible Fallback** | The deployment step is hidden by default. If enabled via feature flag, network options may be empty because the capability snapshot does not populate them in the MVP. |
| **Mock Behavior**         | `networkOptions` is an optional field on `TargetCapabilitySnapshot`. No network data is populated in the current implementation.                                       |
| **Replacement Trigger**   | When the deployment feature is implemented with real network selection, `networkOptions` will be populated by the target runtime and consumed by the deployment step.  |
| **Owning File**           | `apps/rwa-wizard/src/types/wizard.ts` (`TargetCapabilitySnapshot.networkOptions`)                                                                                      |
| **Status**                | **Deferred** — hidden behind feature flag                                                                                                                              |


---

## Resolved Gaps


| ID     | Description                                                                                                                                                                                   | Resolution                                                                         |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| (none) | The original `mockCodegenService.ts` and `mockGapRegistry.ts` were replaced with a real codegen service backed by `@openzeppelin/codegen-rwa-stellar` and a test-only service for unit tests. | Resolved in Phase 4 (US2) — runtime codegen now uses the real package exclusively. |


---

## Summary


| Status                         | Count |
| ------------------------------ | ----- |
| Stable (test-only, by design)  | 1     |
| Active (waiting on upstream)   | 3     |
| Deferred (behind feature flag) | 1     |
| Resolved                       | 1     |


No mock-backed fallback is used at runtime. The wizard always delegates to the real `@openzeppelin/codegen-rwa-stellar` package for validation, module discovery, and ZIP generation. If the package fails to load, generation is disabled entirely — there is no silent fallback to mock behavior.