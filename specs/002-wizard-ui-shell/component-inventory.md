# Component Inventory: RWA Wizard UI Shell

**Feature**: `002-wizard-ui-shell`
**Date**: 2026-04-13
**Classification Key**: `reused` = from `@openzeppelin/ui-`* packages · `local-candidate` = app-local, may be promoted · `promoted-shared` = validated locally and promoted upstream

---

## 1. Reused Shared Components (`@openzeppelin/ui-*`)

These components are consumed directly from published OpenZeppelin UI packages. No promotion action needed.


| Component                                                               | Source Package                | Usage Context                                                      |
| ----------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------ |
| `Button`                                                                | `@openzeppelin/ui-components` | Action triggers across all wizard steps and draft management       |
| `SidebarButton`                                                         | `@openzeppelin/ui-components` | Navigation and target creation in sidebar                          |
| `SidebarLayout`                                                         | `@openzeppelin/ui-components` | App-level sidebar chrome                                           |
| `SidebarSection`                                                        | `@openzeppelin/ui-components` | Sidebar grouping for nav, drafts, tools                            |
| `WizardLayout`                                                          | `@openzeppelin/ui-components` | Multi-step wizard container with step navigation                   |
| `Header`                                                                | `@openzeppelin/ui-components` | App header bar with mobile sidebar toggle                          |
| `Footer`                                                                | `@openzeppelin/ui-components` | App footer                                                         |
| `Form`                                                                  | `@openzeppelin/ui-components` | React Hook Form wrapper for wizard steps                           |
| `TextField`                                                             | `@openzeppelin/ui-components` | Text inputs in asset, identity, and compliance steps               |
| `NumberField`                                                           | `@openzeppelin/ui-components` | Numeric inputs for decimals, supply, topic IDs, module config      |
| `AddressField`                                                          | `@openzeppelin/ui-components` | Address input with validation in access-control and identity       |
| `AddressDisplay`                                                        | `@openzeppelin/ui-components` | Read-only address display with copy and explorer link              |
| `Label`                                                                 | `@openzeppelin/ui-components` | Form field labels                                                  |
| `Accordion` / `AccordionItem` / `AccordionTrigger` / `AccordionContent` | `@openzeppelin/ui-components` | Expandable sections in compliance review and access-control review |
| `Card` / `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` | `@openzeppelin/ui-components` | Configuration summary card in review step                          |
| `cn`                                                                    | `@openzeppelin/ui-utils`      | Tailwind class merging utility                                     |
| `EntityStorage` / `createDexieDatabase`                                 | `@openzeppelin/ui-storage`    | IndexedDB persistence for draft records                            |
| `AppConfigService`                                                      | `@openzeppelin/ui-utils`      | Feature flag access for deployment placeholder gating              |


---

## 2. Local-Candidate Components (Wizard-Specific Shared)

Reusable patterns built locally in `apps/rwa-wizard/src/components/shared/`. Eligible for future promotion to `@openzeppelin/ui-components` after validation with a second consumer.


| Component                                        | Owning File                                 | Rationale                                                                                           | Follow-Up Action                                                                                   |
| ------------------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `Badge`                                          | `components/shared/Badge.tsx`               | Multi-variant badge with optional remove button; used across compliance, identity, and review steps | Evaluate for promotion after second app consumer; check against any existing `ui-components` badge |
| `SelectableCard`                                 | `components/shared/SelectableCard.tsx`      | Interactive card with selection state, icon, and badge; used for compliance module selection        | Promote if module catalog pattern is needed in UI Builder or Role Manager                          |
| `ReadOnlyFeatureCard`                            | `components/shared/ReadOnlyFeatureCard.tsx` | Display-only feature toggle card with lock icon; used for admin/identity controls                   | Evaluate; may overlap with future read-only toggle patterns                                        |
| `TogglePill`                                     | `components/shared/TogglePill.tsx`          | Compact toggle chip with selected/deselected states and optional remove; used for claim topics      | Strong candidate for promotion — generic enough for tag/filter UIs                                 |
| `TopicToggleGroup`                               | `components/shared/TopicToggleGroup.tsx`    | Predefined + custom topic picker with limit enforcement; identity-step-specific                     | Less generic; keep local unless second consumer emerges                                            |
| `AddressListInput`                               | `components/shared/AddressListInput.tsx`    | Address list builder with add/remove, duplicate detection, and explorer links                       | Strong candidate — reusable across any multi-address input scenario                                |
| `ConfigSummary`                                  | `components/shared/ConfigSummary.tsx`       | Read-only RWAConfig summary composed of section renderers inside a Card                             | Wizard-specific; keep local unless a shared config-review pattern emerges                          |
| `Table` / `TableBody` / `TableRow` / `TableCell` | `components/shared/Table.tsx`               | Lightweight unstyled table primitives; used in config summary sections                              | Evaluate — `ui-components` may already have or plan table primitives                               |
| `WizardFrame`                                    | `components/shared/WizardFrame.tsx`         | Step-level layout wrapper with consistent h2 heading + description                                  | New in Phase 5; evaluate for `ui-components` if wizard layout patterns generalize                  |
| `WizardSection`                                  | `components/shared/WizardSection.tsx`       | Sub-section layout with h3 heading + description and configurable spacing                           | New in Phase 5; pairs with WizardFrame for consistent step structure                               |
| `ErrorBanner`                                    | `components/shared/ErrorBanner.tsx`         | Inline error callout with variant, optional retry, and dismiss actions                              | Strong candidate — generic error banner usable by any app surface                                  |
| `ErrorBannerStack`                               | `components/shared/ErrorBannerStack.tsx`    | Ordered list of keyed banner entries to present multiple concurrent errors                          | Pairs with `ErrorBanner`; promote together                                                         |
| `InfoTooltip`                                    | `components/shared/InfoTooltip.tsx`         | Lightweight info tooltip used next to form labels and section headers                               | Evaluate — may overlap with future `ui-components` tooltip primitive                               |
| `SectionCardHeader`                              | `components/shared/SectionCardHeader.tsx`   | Card header composed of icon + title + description used across wizard sections                      | Wizard-specific styling; keep local unless second consumer emerges                                 |


---

## 3. Feature-Specific Components (Not Directly Promotable)

These are tightly coupled to wizard domain logic. They are not promotion candidates but are inventoried for completeness.


| Component                 | Owning File                                                     | Role                                                                        |
| ------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `AppRouter`               | `app/routes/AppRouter.tsx`                                      | Top-level router + app shell layout                                         |
| `AppSidebar`              | `app/routes/AppSidebar.tsx`                                     | Sidebar composition (targets, drafts, navigation, import/export)            |
| `DashboardPage`           | `app/routes/DashboardPage.tsx`                                  | `/` landing page with target entry points                                   |
| `WizardPage`              | `features/wizard/WizardPage.tsx`                                | Presentational wizard page wiring hooks + `WizardLayout` + step content     |
| `TargetSelectorSidebar`   | `features/target-catalog/components/TargetSelectorSidebar.tsx`  | Renders target create buttons using `SidebarButton`                         |
| `DraftList`               | `features/draft-management/components/DraftList.tsx`            | Lists persisted drafts in sidebar                                           |
| `DraftListItem`           | `features/draft-management/components/DraftListItem.tsx`        | Individual draft entry with actions                                         |
| `DraftDeleteDialog`       | `features/draft-management/components/DraftDeleteDialog.tsx`    | Confirmation dialog before removing a persisted draft                       |
| `DraftImportDialog`       | `features/draft-management/components/DraftImportDialog.tsx`    | Dialog that previews an import payload before creating a draft              |
| `ImportDraftButton`       | `features/draft-management/components/ImportDraftButton.tsx`    | File-import trigger for JSON config                                         |
| `ExportDraftButton`       | `features/draft-management/components/ExportDraftButton.tsx`    | Export current draft as JSON                                                |
| `AssetStep`               | `features/wizard/steps/asset/AssetStep.tsx`                     | Asset configuration step (uses `WizardFrame`)                               |
| `TokenBasics`             | `features/wizard/steps/asset/TokenBasics.tsx`                   | Token name/symbol/decimals form fields                                      |
| `AdministrativeControls`  | `features/wizard/steps/asset/AdministrativeControls.tsx`        | Admin toggle grid                                                           |
| `DocumentManagerSection`  | `features/wizard/steps/asset/DocumentManagerSection.tsx`        | Document manager toggle                                                     |
| `IdentityStep`            | `features/wizard/steps/identity/IdentityStep.tsx`               | Identity configuration step (uses `WizardFrame`)                            |
| `IdentityPrivacyNotice`   | `features/wizard/steps/identity/IdentityPrivacyNotice.tsx`      | Privacy warning callout                                                     |
| `ClaimTopicsSection`      | `features/wizard/steps/identity/ClaimTopicsSection.tsx`         | Claim topic selection with `TopicToggleGroup`                               |
| `TrustedIssuersSection`   | `features/wizard/steps/identity/TrustedIssuersSection.tsx`      | Trusted issuer list builder                                                 |
| `IdentityControlsSection` | `features/wizard/steps/identity/IdentityControlsSection.tsx`    | Identity feature toggles                                                    |
| `ImplementationApproach`  | `features/wizard/steps/identity/ImplementationApproach.tsx`     | Read-only implementation info                                               |
| `ComplianceStep`          | `features/wizard/steps/compliance/ComplianceStep.tsx`           | Compliance module step (uses `WizardFrame`)                                 |
| `ModuleCatalog`           | `features/wizard/steps/compliance/ModuleCatalog.tsx`            | Selectable module cards with review badges and inline config                |
| `ModuleConfigPanel`       | `features/wizard/steps/compliance/ModuleConfigPanel.tsx`        | Inline per-module config form rendered inside `ModuleCatalog` cards         |
| `HookWiringPreview`       | `features/wizard/steps/compliance/HookWiringPreview.tsx`        | Derived hook registration table                                             |
| `AccessControlStep`       | `features/wizard/steps/access-control/AccessControlStep.tsx`    | Access control step (uses `WizardFrame`)                                    |
| `OwnershipModelSection`   | `features/wizard/steps/access-control/OwnershipModelSection.tsx`| Single-owner / multi-sig / DAO selector                                     |
| `OperatorRolesSection`    | `features/wizard/steps/access-control/OperatorRolesSection.tsx` | Operator role assignment                                                    |
| `ReviewStep`              | `features/wizard/steps/review/ReviewStep.tsx`                   | Review and generate step (uses `WizardFrame`)                               |
| `DeploymentPlaceholder`   | `features/wizard/steps/deployment/DeploymentPlaceholder.tsx`    | Hidden feature-flagged deployment step                                      |
| `GenerationDialog`        | `features/generation/components/GenerationDialog.tsx`           | Modal that hosts generation status and error panels                         |
| `GenerationStatusPanel`   | `features/generation/components/GenerationStatusPanel.tsx`      | Generation progress indicator                                               |
| `GenerationErrorState`    | `features/generation/components/GenerationErrorState.tsx`       | Generation failure display with retry                                       |


---

## 4. Promoted Components

No components have been promoted to `@openzeppelin/ui-components` during this feature. The following are the strongest candidates for future promotion once a second consumer exists:


| Component                           | Readiness                                                  | Blocker                                                                    |
| ----------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| `TogglePill`                        | High — generic tag/filter pattern                          | Needs example coverage in `ui-components`                                  |
| `AddressListInput`                  | High — reusable multi-address builder                      | Needs example coverage; verify `AddressField` compatibility across targets |
| `ErrorBanner` / `ErrorBannerStack`  | High — generic error surface usable by any app shell       | Needs example coverage in `ui-components`                                  |
| `Badge`                             | Medium — check overlap with existing `ui-components` badge | May need variant consolidation                                             |
| `Table` primitives                  | Medium — lightweight and unstyled                          | Check if `ui-components` has planned table primitives                      |
| `WizardFrame` / `WizardSection`     | Medium — consistent layout primitives                      | Only relevant if other apps adopt multi-step wizard patterns               |
| `InfoTooltip`                       | Low/Medium — small utility wrapper                         | Confirm no overlap with planned `ui-components` tooltip primitive          |


---

## Summary


| Classification                    | Count |
| --------------------------------- | ----- |
| Reused (`@openzeppelin/ui-*`)     | 18    |
| Local-Candidate (shared)          | 14    |
| Feature-Specific (not promotable) | 31    |
| Promoted                          | 0     |


