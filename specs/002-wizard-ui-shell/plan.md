# Implementation Plan: RWA Wizard UI Shell

**Branch**: `002-wizard-ui-shell` | **Date**: 2026-03-13 | **Spec**: [`specs/002-wizard-ui-shell/spec.md`](./spec.md)
**Input**: Feature specification from `/specs/002-wizard-ui-shell/spec.md`

## Summary

Build the first usable `rwa-wizard` browser app shell as a purely client-side React/Vite SPA that captures `RWAConfig` through a guided multi-step flow, persists drafts locally with `@openzeppelin/ui-storage`, exposes a registry-backed target selector with Stellar enabled and future targets disabled, and hands completed drafts to codegen packages for ZIP download. The implementation will mirror proven storage, feature-flag, and ecosystem-management patterns from UI Builder and Role Manager, keep all chain-specific logic behind an app-local codegen service boundary, and use fixture-backed mocks wherever the generator API surface is not yet complete so the end-to-end UI can still be exercised.

## Technical Context

**Language/Version**: TypeScript (strict) with React 19 on Vite  
**Primary Dependencies**: `react`, `react-router-dom`, `@openzeppelin/ui-components`, `@openzeppelin/ui-react`, `@openzeppelin/ui-renderer`, `@openzeppelin/ui-storage`, `@openzeppelin/ui-styles`, `@openzeppelin/ui-types`, `@openzeppelin/ui-utils`, `@openzeppelin/rwa-config`, `@openzeppelin/codegen-rwa-stellar`  
**Storage**: IndexedDB via `@openzeppelin/ui-storage` (`createDexieDatabase`, `EntityStorage`, repository hooks)  
**Testing**: Vitest for unit/integration tests, `fake-indexeddb` for storage-backed tests, focused hook/service tests before implementation of business logic  
**Target Platform**: Modern desktop browsers as a standalone client-side SPA  
**Project Type**: Web application (frontend-only SPA)  
**Performance Goals**: Target selector metadata is available synchronously on first render without awaiting heavy generator packages; autosave persists meaningful edits within 1 second of idle time without blocking navigation; generation status feedback appears within 250 ms of phase changes and ZIP handoff begins visible completion feedback within 2 seconds after generation succeeds on typical developer hardware  
**Constraints**: No backend; no chain-specific generation logic in the UI; use `@openzeppelin/ui-storage` instead of `localStorage` for draft data; use the existing OpenZeppelin feature-flag system from `@openzeppelin/ui-utils` / `AppConfigService` for gated future surfaces; follow prototype macro layout without restyling established shared components; surface privacy warnings for sensitive identity-oriented draft inputs; track and replace temporary generator mocks near the end of implementation  
**Scale/Scope**: One SPA (`apps/rwa-wizard`), one fully enabled target (Stellar), several visible-disabled future targets, a 5-stage MVP wizard flow ending in review plus a hidden feature-flagged deployment placeholder reserved for future work, multiple persisted drafts, one app-local storage subsystem, one app-local target registry, and one app-local codegen service seam

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Codegen-Led, Chain-Agnostic Architecture**: Pass. The plan keeps UI state/persistence in the app and routes all target-specific validation and artifact generation through a codegen service boundary backed by `@openzeppelin/codegen-rwa-stellar`.
- **II. Reuse-First & Monorepo Integration**: Pass. The plan reuses `@openzeppelin/ui-*` packages, adopts storage and ecosystem patterns from UI Builder/Role Manager, and consumes existing workspace packages rather than recreating them.
- **III. Type Safety, Linting, and Code Quality**: Pass. Typed `RWAConfig`, typed service/repository contracts, and no app-side `any` or chain-specific config forks are planned.
- **IV. UI/Design System Consistency**: Pass. The plan explicitly reuses `@openzeppelin/ui-components` and keeps prototype influence at the macro layout layer only.
- **V. Testing and TDD for Business Logic**: Pass. Draft storage, autosave, registry resolution, config mapping, and codegen orchestration will be test-first; presentational components stay lightly tested.
- **VI. Tooling, Persistence, and Autonomy**: Pass. The app remains a client-only SPA with IndexedDB draft persistence and browser ZIP download flow.

**Post-Design Re-Check**: Pass. The generated artifacts maintain the same boundaries: storage is local and typed, target selection is metadata-first with lazy runtime loading, and codegen interaction stays behind app-local contracts with mockable seams.

## Project Structure

### Documentation (this feature)

```text
specs/002-wizard-ui-shell/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── codegen-service-contract.md
│   ├── draft-storage-contract.md
│   └── target-catalog-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/rwa-wizard/
├── src/
│   ├── app/
│   │   ├── config/              # featureFlags, initAppConfig (AppConfigService bootstrap)
│   │   ├── providers/           # AppProviders, CopyProvider
│   │   ├── routes/              # AppRouter, AppSidebar, DashboardPage, wizardConstants
│   │   └── state/               # wizardStore (external store) + useWizardStore selector hook
│   ├── components/
│   │   └── shared/              # ErrorBanner(Stack), WizardFrame/Section, AddressListInput, …
│   ├── features/
│   │   ├── target-catalog/      # Sidebar target selector
│   │   ├── draft-management/    # Draft list, import/export, autosave (machine + hook)
│   │   ├── wizard/
│   │   │   ├── WizardPage.tsx   # Presentational wizard page (consumes hooks below)
│   │   │   ├── hooks/           # useWizardSession, useWizardSteps, useTargetRuntime
│   │   │   ├── state/           # useWizardDraftState (local form state + RWAConfig mapping)
│   │   │   ├── steps/           # One folder per step: access-control/ asset/ compliance/ deployment/ identity/ review/
│   │   │   └── validation/      # stepValidators, stepConstraints
│   │   └── generation/          # useGenerationFlow, GenerationDialog, status/error panels
│   ├── hooks/                   # Cross-feature hooks (useStepForm)
│   ├── registry/                # targets, targetManager, enrichEcosystemMetadata
│   ├── services/
│   │   ├── codegen/             # Codegen service loader, types, runtime options
│   │   ├── download/            # ZIP download + export-as-JSON + triggerBlobDownload
│   │   ├── runtime/             # Adapter capabilities loader + provider
│   │   └── validation/          # normalizeValidation
│   ├── storage/                 # WizardDraftStorage (IndexedDB) + React hooks
│   ├── test/                    # Shared test fixtures
│   ├── types/                   # wizard domain types (TargetId, WizardStepId, …)
│   ├── utils/                   # errorReporting, defaultRwaConfig, meaningfulDraft, componentInventory
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
│
packages/config/
packages/codegen-core/
packages/codegen-rwa-stellar/
packages/components/
packages/hooks/
packages/cli/
```

**Structure Decision**: The feature is implemented primarily inside `apps/rwa-wizard/src`, with app-local modules for storage, target registry, wizard orchestration, shared feature-flag access, and codegen integration. Wizard steps live under `features/wizard/steps/<step>/` and the wizard shell is composed in `features/wizard/WizardPage.tsx` through the `useWizardSession`, `useWizardSteps`, and `useTargetRuntime` hooks; the router shell splits further into `AppRouter`, `AppSidebar`, and `DashboardPage`. A deployment placeholder exists under `features/wizard/steps/deployment/` but remains hidden by default behind the shared OpenZeppelin feature-flag system. Existing workspace packages remain external dependencies and references, not places for UI-shell business logic, except for future shared-component promotion after local validation.

## Traceability Map

- `FR-001` to `FR-007A` map primarily to the MVP wizard flow, draft navigation, review surfaces, and feature-flagged deployment placeholder behavior described in `data-model.md` (`WizardDraftRecord`, `WizardStage`, `TargetCapabilitySnapshot`) and verified through `quickstart.md`.
- `FR-008A` to `FR-008G` map to `contracts/draft-storage-contract.md` and the draft-related entities in `data-model.md`.
- `FR-009` to `FR-011A` map to `contracts/codegen-service-contract.md`, `GenerationJobState` in `data-model.md`, and the generation section of `quickstart.md`.
- `FR-001A`, `FR-001B`, and `FR-013` to `FR-013C` map to `contracts/target-catalog-contract.md` and `TargetCatalogEntry` / `TargetCapabilitySnapshot` in `data-model.md`.
- `FR-014` to `FR-021` define release and review artifacts that are reinforced across `research.md`, `quickstart.md`, and the planning structure for future tasks.

## Complexity Tracking

No constitutional violations or exceptional complexity exemptions are required for this plan.
