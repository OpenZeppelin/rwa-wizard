# Tasks: RWA Wizard UI Shell

**Input**: Design documents from `/specs/002-wizard-ui-shell/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. Constitution requires TDD for app-specific business logic such as storage, autosave, target registry resolution, config mapping, and codegen orchestration.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this belongs to (`[US1]`, `[US2]`, `[US3]`)
- Every task includes an exact file path

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the application skeleton and test harness expected by the plan

- [x] T001 Create the planned app directory skeleton under `apps/rwa-wizard/src/app`, `apps/rwa-wizard/src/components`, `apps/rwa-wizard/src/features`, `apps/rwa-wizard/src/hooks`, `apps/rwa-wizard/src/registry`, `apps/rwa-wizard/src/services`, `apps/rwa-wizard/src/storage`, `apps/rwa-wizard/src/types`, and `apps/rwa-wizard/src/utils`
- [x] T002 Update `apps/rwa-wizard/src/App.tsx` to mount an application shell root instead of the current placeholder
- [x] T003 [P] Create `apps/rwa-wizard/src/app/providers/AppProviders.tsx` for shared providers, `AppConfigService` initialization, and client-side app composition
- [x] T004 [P] Create `apps/rwa-wizard/src/app/routes/AppRouter.tsx` for first-iteration app routing/state entry
- [x] T005 [P] Create `apps/rwa-wizard/vitest.config.ts` and `apps/rwa-wizard/src/test/setup.ts` for Vitest + `fake-indexeddb` test support

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core seams and infrastructure that MUST be ready before any user story work starts

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 [P] Define app-local domain types in `apps/rwa-wizard/src/types/wizard.ts` for drafts, target catalog entries, generation status, component inventory items, mock gap records, and expanded `ComplianceModuleOption` (with `requiredHooks`, `ModuleReviewInfo`, `ModuleConfigFieldMeta`)
- [x] T007 [P] Implement IndexedDB setup in `apps/rwa-wizard/src/storage/database.ts` using `@openzeppelin/ui-storage`
- [x] T008 [P] Implement the draft repository in `apps/rwa-wizard/src/storage/WizardDraftStorage.ts`
- [x] T009 [P] Create the draft storage hook/context in `apps/rwa-wizard/src/storage/useWizardDraftStorage.tsx`
- [x] T010 [P] Create the ordered target registry and feature overrides in `apps/rwa-wizard/src/registry/targets.ts`
- [x] T011 [P] Implement lazy target runtime loading and caching in `apps/rwa-wizard/src/registry/targetManager.ts`
- [x] T012 [P] Define codegen service interfaces and normalized DTOs in `apps/rwa-wizard/src/services/codegen/types.ts`
- [x] T013 [P] Implement the real Stellar-backed codegen service loader in `apps/rwa-wizard/src/services/codegen/codegenLoader.ts` (dynamically imports `@openzeppelin/codegen-rwa-stellar` and maps `ComplianceModuleRegistryEntry` → `ComplianceModuleOption` including `requiredHooks`, `review`, and `configFields`)
- [x] T014 [P] Implement the mock-backed codegen service (with `requiredHooks`, `review`, `configFields` on module options) and gap registry in `apps/rwa-wizard/src/services/codegen/mockCodegenService.ts` and `apps/rwa-wizard/src/services/codegen/mockGapRegistry.ts`
- [x] T015 Implement the codegen service resolver in `apps/rwa-wizard/src/services/codegen/index.ts`
- [x] T016 [P] Implement ZIP browser download orchestration in `apps/rwa-wizard/src/services/download/downloadZip.ts`
- [x] T017 [P] Create a field-path normalization helper for validation results in `apps/rwa-wizard/src/services/validation/normalizeValidation.ts`
- [x] T018 Create the shared wizard state container in `apps/rwa-wizard/src/app/state/wizardStore.ts`

**Checkpoint**: Foundation ready. Draft persistence, target registry, codegen boundaries, and app composition seams are in place.

---

## Phase 3: User Story 1 - Configure an RWA Project Through a Guided Wizard (Priority: P1) 🎯 MVP

**Goal**: Deliver the guided multi-step wizard, target selector, draft list, autosave, and import flow so users can build and resume Stellar drafts end to end, while keeping any future deployment placeholder hidden behind the shared feature-flag system.

**Independent Test**: A user can select Stellar, create a draft after entering meaningful content, complete and revisit wizard steps, autosave changes, resume drafts from local storage, and import a configuration into a new draft without backend support; with default flags, no deployment step is shown.

### Tests for User Story 1 ⚠️

> **NOTE**: Write these tests FIRST, ensure they FAIL before implementation

- [x] T019 [P] [US1] Add target registry tests in `apps/rwa-wizard/src/registry/targets.test.ts`
- [x] T020 [P] [US1] Add target manager tests in `apps/rwa-wizard/src/registry/targetManager.test.ts`
- [x] T021 [P] [US1] Add draft storage repository tests in `apps/rwa-wizard/src/storage/WizardDraftStorage.test.ts`
- [x] T022 [P] [US1] Add autosave hook tests in `apps/rwa-wizard/src/features/draft-management/hooks/useDraftAutosave.test.tsx`
- [x] T023 [P] [US1] Add wizard state/config mapping tests in `apps/rwa-wizard/src/features/wizard/state/useWizardDraftState.test.tsx`
- [x] T024 [P] [US1] Add deployment-placeholder feature-flag tests in `apps/rwa-wizard/src/app/config/featureFlags.test.ts`

### Implementation for User Story 1

- [x] T025 [P] [US1] Implement the sidebar target selector in `apps/rwa-wizard/src/features/target-catalog/components/TargetSelectorSidebar.tsx`
- [x] T026 [P] [US1] Implement the draft list surface in `apps/rwa-wizard/src/features/draft-management/components/DraftList.tsx`
- [x] T027 [P] [US1] Implement per-draft actions UI in `apps/rwa-wizard/src/features/draft-management/components/DraftListItem.tsx`
- [x] T028 [P] [US1] Implement configuration import UI in `apps/rwa-wizard/src/features/draft-management/components/ImportDraftButton.tsx`
- [ ] T029 [P] [US1] Implement the wizard shell and step frame in `apps/rwa-wizard/src/features/wizard/components/WizardShell.tsx` *(not implemented as a local file — wizard chrome is composed with `@openzeppelin/ui-components` `WizardLayout` in `AppRouter.tsx`)*
- [x] T030 [P] [US1] Implement the asset step in `apps/rwa-wizard/src/features/wizard/asset/AssetStep.tsx`
- [x] T031 [P] [US1] Implement the identity step and privacy warning in `apps/rwa-wizard/src/features/wizard/identity/IdentityStep.tsx` and `apps/rwa-wizard/src/features/wizard/identity/IdentityPrivacyNotice.tsx`
- [x] T032 [P] [US1] Implement the module-first compliance step in `apps/rwa-wizard/src/features/wizard/compliance/ComplianceStep.tsx`, `ModuleCatalog.tsx` (selectable module cards with review badges, required hooks, inline `ModuleConfigPanel.tsx` using `TextField`/`NumberField`), and `HookWiringPreview.tsx` (derived hook registration table)
- [x] T033 [P] [US1] Implement the access-control step in `apps/rwa-wizard/src/features/wizard/access-control/AccessControlStep.tsx`
- [x] T034 [P] [US1] Implement shared feature-flag access and a hidden-by-default deployment placeholder gate in `apps/rwa-wizard/src/app/config/featureFlags.ts` and `apps/rwa-wizard/src/features/wizard/deployment/DeploymentPlaceholder.tsx`
- [x] T035 [US1] Implement wizard draft state and `RWAConfig` mapping for the MVP flow without deployment-choice persistence in `apps/rwa-wizard/src/features/wizard/state/useWizardDraftState.ts`
- [x] T036 [US1] Implement autosave lifecycle wiring in `apps/rwa-wizard/src/features/draft-management/hooks/useDraftAutosave.ts`
- [x] T037 [US1] Wire the app shell, target selector, draft list, hidden future deployment placeholder gating, and wizard navigation together in `apps/rwa-wizard/src/app/routes/AppRouter.tsx` and `apps/rwa-wizard/src/App.tsx`

**Checkpoint**: User Story 1 is independently functional and testable as the MVP. *(One spec delta: T029 path — see note on T029.)*

---

## Phase 4: User Story 2 - Review, Export, and Hand Off a Draft for Generation (Priority: P1)

**Goal**: Add review/export/generation flows so users can inspect a completed draft, export it, and request ZIP generation with real or documented mock-backed behavior.

**Independent Test**: A valid Stellar draft can be reviewed, exported, validated, passed through the codegen boundary, and either downloaded as a ZIP or surfaced with a non-destructive failure/mock state.

### Tests for User Story 2 ⚠️

- [x] T038 [P] [US2] Add real/mock codegen service parity tests in `apps/rwa-wizard/src/services/codegen/codegenService.test.ts`
- [x] T039 [P] [US2] Add generation flow hook tests in `apps/rwa-wizard/src/features/generation/hooks/useGenerationFlow.test.tsx`
- [x] T040 [P] [US2] Add download helper tests in `apps/rwa-wizard/src/services/download/downloadZip.test.ts`

### Implementation for User Story 2

- [x] T041 [P] [US2] Implement the review step summary UI in `apps/rwa-wizard/src/features/wizard/review/ReviewStep.tsx`
- [x] T042 [P] [US2] Implement current-draft export UI in `apps/rwa-wizard/src/features/draft-management/components/ExportDraftButton.tsx`
- [x] T043 [P] [US2] Implement generation status UI in `apps/rwa-wizard/src/features/generation/components/GenerationStatusPanel.tsx`
- [x] T044 [P] [US2] Implement generation failure/recovery UI in `apps/rwa-wizard/src/features/generation/components/GenerationErrorState.tsx`
- [x] T045 [US2] Implement generation orchestration in `apps/rwa-wizard/src/features/generation/hooks/useGenerationFlow.ts`
- [x] T046 [US2] Wire review, export, and ZIP handoff flows in `apps/rwa-wizard/src/features/wizard/review/ReviewStep.tsx`
- [x] T047 [US2] Integrate browser ZIP delivery and coarse generation phases in `apps/rwa-wizard/src/services/download/downloadZip.ts` and `apps/rwa-wizard/src/features/generation/hooks/useGenerationFlow.ts`

**Checkpoint**: User Stories 1 and 2 both work independently. The shell can now produce the first complete user-facing outcome.

---

## Phase 5: User Story 3 - Deliver a Consistent Shared-Component Experience (Priority: P2)

**Goal**: Capture reusable patterns, incubate local candidate shared components, and document promotion readiness without blocking the first usable shell.

**Independent Test**: The implemented UI surfaces can be reviewed with a component inventory that clearly distinguishes reused, local-candidate, and promotable shared patterns, plus a mock gap register for remaining generator seams.

### Tests for User Story 3 ⚠️

- [x] T048 [P] [US3] Add component inventory classification helper tests in `apps/rwa-wizard/src/utils/componentInventory.test.ts`

### Implementation for User Story 3

- [x] T049 [P] [US3] Implement local wizard layout primitives in `apps/rwa-wizard/src/components/shared/WizardFrame.tsx` and `apps/rwa-wizard/src/components/shared/WizardSection.tsx`
- [x] T050 [P] [US3] Implement the component inventory classification helper in `apps/rwa-wizard/src/utils/componentInventory.ts`
- [x] T051 [US3] Refactor shared wizard-shell patterns into local reusable components in `apps/rwa-wizard/src/features/target-catalog/components/TargetSelectorSidebar.tsx`, `apps/rwa-wizard/src/features/wizard/components/WizardShell.tsx`, and `apps/rwa-wizard/src/features/wizard/review/ReviewStep.tsx`
- [x] T052 [US3] Create the component inventory artifact in `specs/002-wizard-ui-shell/component-inventory.md`
- [x] T053 [US3] Create the mock gap register artifact in `specs/002-wizard-ui-shell/mock-gap-register.md`
- [x] T054 [US3] Record each reviewed surface with component name, owning file, classification (`reused`, `local-candidate`, `promoted-shared`), rationale, and follow-up action in `specs/002-wizard-ui-shell/component-inventory.md`
- [x] T055 [US3] Record each active mock-backed gap with affected flow, mocked API seam, user-visible fallback, replacement trigger, owning task, and status in `specs/002-wizard-ui-shell/mock-gap-register.md`
- [x] T056 [US3] Record any component promoted during this feature with its shared UI example-coverage status and target example path in `specs/002-wizard-ui-shell/component-inventory.md`

**Checkpoint**: All user stories are functional, and the release artifacts needed for reuse/promotion decisions are in place.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finish cross-story hardening, cleanup, and release-readiness

- [ ] T057 [P] Finalize the draft storage schema/versioning notes in `apps/rwa-wizard/src/storage/database.ts` and `specs/002-wizard-ui-shell/quickstart.md`
- [ ] T058 Replace any remaining temporary generator mocks or explicitly mark deferred replacements in `apps/rwa-wizard/src/services/codegen/mockGapRegistry.ts` and `specs/002-wizard-ui-shell/mock-gap-register.md`
- [ ] T059 [P] Reconcile the component inventory with actual implemented surfaces in `specs/002-wizard-ui-shell/component-inventory.md`
- [ ] T060 [P] Run and fix app typecheck/lint/test issues touching `apps/rwa-wizard/src/App.tsx`, `apps/rwa-wizard/src/app/routes/AppRouter.tsx`, and `apps/rwa-wizard/src/test/setup.ts`
- [ ] T061 [P] Validate the documented end-to-end flow and performance checks against `specs/002-wizard-ui-shell/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies, can start immediately
- **Foundational (Phase 2)**: Depends on Setup, blocks all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only, defines the MVP
- **User Story 2 (Phase 4)**: Depends on Foundational and reuses US1 wizard/draft flow
- **User Story 3 (Phase 5)**: Depends on Foundational and is best done after US1/US2 surfaces exist
- **Polish (Phase 6)**: Depends on all selected user stories being complete

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational, no dependency on later stories
- **US2 (P1)**: Starts after Foundational; integrates with US1 draft/wizard outputs but should remain independently testable once those surfaces exist
- **US3 (P2)**: Relies on implemented UI surfaces from US1 and US2 to classify/promote patterns accurately

### Within Each User Story

- Tests for business logic MUST be written and fail before implementation
- Storage/registry/service contracts before feature wiring
- Wizard state before step integration
- Review/generation orchestration before ZIP delivery polish
- Artifact documentation after the relevant feature surfaces exist

### Parallel Opportunities

- Setup tasks marked `[P]` can run together
- Foundational tasks T006–T017 are largely parallel by file/concern
- US1 step components (T030–T034) can be built in parallel after state contracts exist
- US2 UI tasks (T041–T044) can run in parallel while the generation hook is prepared
- US3 artifact tasks (T052–T056) can run in parallel with local component refactors once the relevant surfaces exist

---

## Parallel Example: User Story 1

```text
# After foundational state, storage, and registry seams are ready:
Task T030: "Implement the asset step in apps/rwa-wizard/src/features/wizard/asset/AssetStep.tsx"
Task T031: "Implement the identity step in apps/rwa-wizard/src/features/wizard/identity/IdentityStep.tsx and apps/rwa-wizard/src/features/wizard/identity/IdentityPrivacyNotice.tsx"
Task T032: "Implement the compliance step in apps/rwa-wizard/src/features/wizard/compliance/ComplianceStep.tsx"
Task T033: "Implement the access-control step in apps/rwa-wizard/src/features/wizard/access-control/AccessControlStep.tsx"
Task T034: "Implement shared feature-flag access and a hidden-by-default deployment placeholder gate in apps/rwa-wizard/src/app/config/featureFlags.ts and apps/rwa-wizard/src/features/wizard/deployment/DeploymentPlaceholder.tsx"
```

## Parallel Example: User Story 2

```text
# Once generation contracts are defined:
Task T041: "Implement the review step summary UI in apps/rwa-wizard/src/features/wizard/review/ReviewStep.tsx"
Task T042: "Implement current-draft export UI in apps/rwa-wizard/src/features/draft-management/components/ExportDraftButton.tsx"
Task T043: "Implement generation status UI in apps/rwa-wizard/src/features/generation/components/GenerationStatusPanel.tsx"
Task T044: "Implement generation failure/recovery UI in apps/rwa-wizard/src/features/generation/components/GenerationErrorState.tsx"
```

## Parallel Example: User Story 3

```text
# After the shell surfaces exist:
Task T052: "Create the component inventory artifact in specs/002-wizard-ui-shell/component-inventory.md"
Task T053: "Create the mock gap register artifact in specs/002-wizard-ui-shell/mock-gap-register.md"
Task T049: "Implement local wizard layout primitives in apps/rwa-wizard/src/components/shared/WizardFrame.tsx and apps/rwa-wizard/src/components/shared/WizardSection.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Confirm draft lifecycle, target selector, and wizard navigation work independently

### Incremental Delivery

1. Setup + Foundational → stable app seams
2. US1 → first usable local-only wizard shell
3. US2 → review/export/generation ZIP workflow
4. US3 → reusable pattern inventory and promotion readiness
5. Polish → replace remaining mocks where possible and validate quickstart flow

### Parallel Team Strategy

With multiple developers after Foundational:

1. Developer A: US1 wizard steps, draft list, and autosave
2. Developer B: US2 review/export/generation flow
3. Developer C: US3 shared-component refactor and inventory artifacts once the main surfaces exist

---

## Notes

- Total tasks: **61**
- US1 tasks: **19** (`T019`–`T037`)
- US2 tasks: **10** (`T038`–`T047`)
- US3 tasks: **9** (`T048`–`T056`)
- Setup + Foundational + Polish tasks: **23**
- All tasks follow the required checklist format with checkbox, task ID, optional `[P]`, story label where required, and exact file paths
