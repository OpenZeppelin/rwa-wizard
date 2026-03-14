# Feature Specification: RWA Wizard UI Shell

**Feature Branch**: `002-wizard-ui-shell`  
**Created**: 2026-03-13  
**Status**: Draft  
**Input**: User description: "RWA Wizard fronted app. Pure UI logic. No codegen bussiness logic. Codegend already implemented on a separate branch 001-stellar-rwa-codegen ( @rwa-wizard/specs/001-stellar-rwa-codegen ) Use prototype@oz-oss-apps/packages/rwa-wizard/src and the CLI wizard, as reference points. Do not rely on code quality of the prototype, it's a quick and dirty means to an end. Re-use existing components from openzeppelin-ui as much as possible, identify new components that need to be added to the library and the openzeppelin-ui example app. End goal a UI shell, skeleton to be pluged-in with the codegen package(s)."

## Clarifications

### Session 2026-03-13

- Q: What level of draft persistence should the first iteration support? → A: Local client-side draft persistence only, implemented with `@openzeppelin/ui-storage` using `role-manager` and `ui-builder` as reference patterns.
- Q: What draft-management model should the first iteration support? → A: Multiple local drafts with a simple draft list to create, resume, rename, and delete drafts.
- Q: How should draft persistence behave during editing? → A: Autosave while editing, plus explicit save/create/rename actions in the draft list, following the UI Builder wizard pattern.
- Q: How should target selection behave in the first iteration? → A: Use a sidebar target selector backed by a registry-style target catalog. Stellar is fully enabled; future targets such as EVM may appear in the catalog but must be disabled and labeled as coming soon until their codegen packages are ready.
- Q: What should successful generation produce in the first iteration? → A: A downloadable ZIP file as the primary successful generation outcome.
- Q: Should exported configs be importable in the first iteration? → A: Yes. Users should be able to import an exported config into a new draft, using the existing storage-package-backed functionality.
- Q: Should the deployment step be part of the MVP flow? → A: No. The MVP ends with ZIP export/generation. A deployment step may remain as future placeholder work, but it must be hidden by default behind the existing OpenZeppelin feature-flag system implemented through `@openzeppelin/ui-utils`.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Configure an RWA Project Through a Guided Wizard (Priority: P1)

A product builder starts from an empty draft and completes a guided multi-step wizard that captures all inputs needed for the supported RWA project type. The user can move through asset, identity, compliance, access-control, and review flows without losing prior choices, can create, resume, rename, or delete saved drafts entirely from client-side storage, and can understand which target ecosystems are available now versus coming later.

**Why this priority**: The core value of the feature is turning a complex configuration process into a guided, understandable flow. If users cannot reliably build a complete draft, the UI shell provides no meaningful value.

**Independent Test**: Can be fully tested by walking through the wizard from an empty draft, entering a valid minimum set of answers, navigating between steps, and verifying the draft remains complete and internally consistent.

**Acceptance Scenarios**:

1. **Given** a new user starts a draft, **When** they complete the required questions in each wizard stage, **Then** the wizard records the answers in a structured draft and marks progress through the flow.
2. **Given** a user revisits an earlier stage and changes a value, **When** they return to later stages, **Then** the wizard reflects the updated state and does not show stale downstream information.
3. **Given** a user leaves optional sections empty, **When** they continue through the wizard, **Then** the flow clearly records those omissions and still allows progress when the configuration remains valid.
4. **Given** a user saves or leaves an in-progress draft, **When** they reopen the application on the same client, **Then** they can resume that draft from persisted local storage without any backend dependency.
5. **Given** a user has multiple saved drafts, **When** they open the draft list, **Then** they can create a new draft, resume an existing one, rename it, or delete it from local storage.
6. **Given** a user edits an existing draft, **When** they change values during the wizard flow, **Then** those changes are autosaved in client-side storage while still allowing explicit draft-management actions from the draft list.
7. **Given** the sidebar shows available target ecosystems, **When** a user views the selector, **Then** currently supported targets are selectable while future targets remain visible but disabled with a clear coming-soon indication.
8. **Given** a user has an exported configuration file, **When** they import it, **Then** the application creates a new draft populated from that configuration rather than merging into the currently open draft.
9. **Given** a target is hidden from the first-iteration UI, **When** the user opens the selector, **Then** that target does not appear as an actionable or placeholder option.
10. **Given** a user attempts to open a disabled coming-soon target, **When** the UI responds, **Then** the current draft remains unchanged and the user receives a clear unsupported-target message.
11. **Given** the MVP feature flags are in their default state, **When** a user completes the wizard, **Then** no deployment step or deployment-choice UI is shown and ZIP generation/export remains the terminal user outcome.
12. **Given** a future deployment placeholder flag is enabled for development or staged rollout, **When** a user enters the wizard, **Then** the placeholder may appear without becoming a required part of the MVP ZIP-generation flow.

---

### User Story 2 - Review, Export, and Hand Off a Draft for Generation (Priority: P1)

A user reaches a final review stage where they can inspect a full summary of the draft, understand what output categories will be produced, export the configuration for reuse, and trigger a generation handoff that yields a downloadable ZIP file when the app-local codegen boundary is backed by an available in-browser generator integration. When parts of that integration are still incomplete, the UI shell can rely on temporary mocked behavior so the end-to-end wizard flow remains testable.

**Why this priority**: The wizard must end in a usable outcome even before deep integration is complete. Review, export, and handoff make the shell valuable immediately while respecting the boundary that generation logic lives elsewhere.

**Independent Test**: Can be fully tested by completing a draft, opening the review stage, exporting the configuration, and verifying that the generation action either executes through the supported in-browser generator path or explains why generation is unavailable without losing the draft.

**Acceptance Scenarios**:

1. **Given** a user has completed the wizard, **When** they open the review stage, **Then** they see a consolidated summary of all chosen values, unresolved issues, and the expected categories of generated outputs.
2. **Given** the supported in-browser generator integration is available, **When** the user confirms generation, **Then** the UI passes the current draft through the app-local codegen boundary and delivers a downloadable ZIP file as the primary successful outcome.
3. **Given** the supported in-browser generator integration is not available, **When** the user attempts generation, **Then** the UI clearly explains that generation is unavailable and still lets the user export the draft configuration.
4. **Given** a required generation capability is still missing from the in-progress codegen package, **When** the user exercises the affected wizard step or handoff state, **Then** the UI uses a documented temporary mock so design, navigation, and state transitions remain fully testable without blocking the rest of the flow.
5. **Given** generation fails or ZIP delivery cannot be completed, **When** the user returns to the draft, **Then** the draft remains editable and exportable and no successful artifact delivery is implied.

---

### User Story 3 - Deliver a Consistent Shared-Component Experience (Priority: P2)

A design-system maintainer or product team member can trace which parts of the wizard rely on existing shared UI building blocks and which generic patterns should first be proven locally in the wizard before later being promoted to the shared library and demonstrated in its example application.

**Why this priority**: Reuse is an explicit goal of the feature. Capturing component gaps prevents the wizard from drifting into one-off UI patterns and makes later expansion cheaper and more consistent.

**Independent Test**: Can be tested by reviewing the delivered screens and component inventory to confirm that shared patterns are reused where possible and any new reusable patterns are clearly identified, including example-application coverage status and target path for any promoted component.

**Acceptance Scenarios**:

1. **Given** a wizard screen uses a standard interaction pattern, **When** the feature is reviewed, **Then** that pattern is fulfilled by an existing shared component wherever a suitable one already exists.
2. **Given** the wizard needs a generic interaction pattern that does not yet exist in the shared library, **When** the gap is identified, **Then** it is first implemented locally as a candidate shared component and documented for later promotion rather than hidden inside a wizard-only screen.
3. **Given** a local candidate shared component has been validated for design and architecture, **When** it is promoted to the shared library, **Then** the component inventory records the corresponding example-application coverage status and target example path, and promotion is not considered complete until that example coverage exists.
4. **Given** the feature is ready for review, **When** the component inventory is inspected, **Then** it identifies each relevant pattern as reused, local candidate, or promoted shared component and records the reasoning for that classification.

---

### Edge Cases

- What happens when no compliance modules are currently available for the supported target? The wizard should present a clear empty state, allow the user to continue, and record that no modules were selected.
- What happens when a user removes or changes a value that makes a later stage incomplete? The wizard should keep the draft, mark the affected stage as needing attention, and prevent a misleading "ready" state.
- What happens when a user reaches review with intentionally empty optional sections such as initial supply, trusted issuers, or operator roles? The review stage should show those sections as omitted rather than as errors when omission is allowed.
- What happens when the generation handoff is disconnected, unsupported, or returns a failure? The UI should preserve the current draft, show an actionable status message, and avoid implying that artifacts were produced.
- What happens when the available capabilities for the supported target change, such as different network options or module availability? The wizard should display only currently supported choices and clearly flag any previously chosen option that is no longer available.
- What happens when the codegen package exposes the intended core API shape but not the full behavior needed by a wizard screen? The wizard should use temporary mocked behavior behind the same UI contract, and the missing integration should be recorded for replacement near the end of implementation.
- What happens when the prototype layout suggests a visual structure that does not map perfectly to existing shared component styling? The delivered screen should preserve the broader layout and information hierarchy while keeping the established styling of reused shared components intact.
- What happens when client-side persisted drafts become unavailable, corrupted, or exceed storage limits? The UI should keep the current editing session usable, communicate the storage problem clearly, and offer export so the user does not lose access to the draft contents.
- What happens when a user deletes a saved local draft? The UI should require clear confirmation before removal and ensure the deletion affects only the selected client-side record.
- What happens when a target is present in the selector but not yet supported by a ready codegen package? The target should remain visible for ecosystem awareness, but it must be disabled and clearly marked as coming soon so users cannot enter an unsupported flow.
- What happens when generation succeeds but the ZIP download cannot be completed on the client? The UI should clearly report that the generation result could not be delivered as a file and should avoid implying that the user already has the artifact.
- What happens when an imported configuration is invalid, outdated, or unsupported for the currently enabled target? The UI should reject it as a new draft, explain why it cannot be imported, and preserve the current draft unchanged.
- What happens when a target exists in the broader registry but is intentionally hidden in the current release? The target should not appear in the selector at all, and its absence should not disrupt ordering or enabled-target behavior.
- What happens when a draft contains identity-related information that could be sensitive on a shared browser profile? The UI should present a clear privacy warning before or during the relevant flow and should not imply server-side protection or backend storage.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide a guided wizard with the primary stages of asset setup, identity setup, compliance selection, access-control setup, and final review.
- **FR-001A**: The application MUST include a sidebar target selector backed by a target catalog so the UI can present both currently available and future target ecosystems consistently.
- **FR-001B**: The target catalog MUST support three distinct presentation states: enabled, visible-disabled, and hidden.
- **FR-001C**: Any future deployment-stage placeholder MUST be hidden by default in the MVP and may only be exposed through the existing OpenZeppelin feature-flag system implemented via `@openzeppelin/ui-utils` `AppConfigService` and established app-level feature-config overrides.
- **FR-002**: The system MUST allow users to create a complete draft containing all information required for the currently supported RWA configuration, including token settings, identity settings, compliance selections, ownership, and operator roles.
- **FR-003**: The system MUST show progress and completion state for each wizard stage so users understand where they are in the flow.
- **FR-004**: Users MUST be able to move backward and forward through the wizard without losing previously entered answers.
- **FR-005**: The system MUST validate required inputs before allowing a draft to be treated as review-ready and MUST present clear, field-level guidance when information is missing or invalid.
- **FR-006**: The system MUST support optional configuration paths, including omitting optional sections when the supported target allows them, and MUST present those omissions clearly in the review summary.
- **FR-007**: The system MUST provide a final review experience that summarizes the current draft, highlights blocking issues, and describes the categories of outputs the user should expect after generation.
- **FR-007A**: In the MVP default-flag state, the final review experience MUST present ZIP generation/export as the terminal outcome and MUST NOT require or reference a deployment choice.
- **FR-008**: Users MUST be able to export the current draft configuration in a portable structured format for reuse outside the UI shell.
- **FR-008A**: Users MUST be able to save and resume drafts using client-side persistence only; no backend or remote draft service is in scope for this feature.
- **FR-008B**: Client-side draft persistence MUST be implemented using `@openzeppelin/ui-storage`, following the established storage patterns already proven in the `role-manager` and `ui-builder` applications.
- **FR-008C**: The system MUST provide a simple local draft list that lets users create, resume, rename, and delete multiple client-side drafts.
- **FR-008D**: Draft changes MUST autosave during editing without requiring an explicit save button for the active draft, while the draft list continues to expose explicit create, rename, and delete actions.
- **FR-008E**: Users MUST be able to import a previously exported configuration file into a new draft.
- **FR-008F**: Configuration import MUST use the established storage-package-backed workflow and MUST NOT merge imported data into the currently open draft in the first iteration.
- **FR-008G**: A new persisted draft MUST be created only after the user provides meaningful draft content. Meaningful content means at least one persisted wizard field value has been intentionally set, a draft has been imported, or the draft has been explicitly named by the user.
- **FR-009**: The system MUST provide a distinct generation handoff action that passes the current draft to an app-local codegen boundary backed by the currently available in-browser generator integration.
- **FR-009A**: In the first iteration, the primary successful result of generation MUST be a downloadable ZIP file delivered to the client.
- **FR-010**: The system MUST NOT contain embedded code-generation, deployment, or artifact-assembly business logic; those responsibilities remain outside the UI shell.
- **FR-010A**: UI-shell responsibilities MAY include draft storage, import/export, target selection, generation handoff orchestration, browser download triggering, and status messaging, as long as the UI does not implement chain-specific generation rules or artifact construction logic itself.
- **FR-011**: If generation handoff is unavailable or fails, the system MUST preserve the user's draft and present a clear status explaining what happened and what the user can do next.
- **FR-011A**: After generation failure, ZIP-delivery failure, storage failure, or invalid import, the current draft MUST remain editable and exportable unless the user explicitly deletes it.
- **FR-012**: The system MUST align the wizard's configurable fields, option groupings, and output expectations with the current supported RWA configuration reference so the same user intent yields the same draft structure across UI and CLI experiences.
- **FR-013**: The system MUST present available compliance options based on the capabilities currently exposed by the supported generator integration, and it MAY expose future target-environment choices only when the corresponding deployment placeholder feature flag is enabled.
- **FR-013A**: The first iteration MUST have Stellar as a fully functional target in the selector. Fully functional means the user can create and persist Stellar drafts, complete the full wizard flow, review the draft, export/import config files, validate the draft, and request ZIP generation through the supported handoff path.
- **FR-013B**: Future targets may appear in the target catalog before they are implemented, but they MUST be disabled and explicitly labeled as coming soon until their corresponding codegen packages are ready for use.
- **FR-013C**: Targets that are not ready for user awareness in the current release MAY be hidden from the target catalog entirely.
- **FR-014**: Feature delivery MUST include a component inventory that distinguishes reused shared components, newly required reusable shared components, and wizard-specific shell components.
- **FR-014A**: The component inventory MUST record, for each relevant UI pattern, its classification (`reused`, `local candidate`, or `promoted shared component`), the reason for that classification, and any follow-up action required before release.
- **FR-015**: The first UI iteration MUST be testable end to end for layout, visuals, step progression, validation states, review, and handoff states even when parts of the codegen package are still incomplete.
- **FR-016**: When the UI depends on an unfinished codegen capability, the system MUST use a temporary mock aligned to the intended codegen API shape rather than inventing a conflicting interface.
- **FR-017**: Feature delivery MUST include a documented gap list of all temporary mocks, the codegen capability each mock stands in for, and a requirement that those mocks be replaced as one of the final implementation tasks for this feature.
- **FR-017A**: The mock gap register MUST record, for each temporary mock, the affected target, the missing real capability, the temporary behavior used in the UI, and the condition or task that triggers replacement with the real integration.
- **FR-018**: Newly identified reusable shared components MUST be built and validated locally in the wizard context first, and only then promoted to the shared UI library once their design and architecture are confirmed.
- **FR-019**: Every shared component promoted from the wizard into the shared UI library during this feature delivery MUST also record the corresponding shared UI example-application coverage status and target example path in the component inventory, and that promotion is not considered complete until the example coverage is added.
- **FR-020**: The wizard's layout and information hierarchy SHOULD follow the macro-level structure and screen composition patterns of the prototype where that helps preserve the intended experience.
- **FR-020A**: The first-iteration macro layout MUST preserve the prototype's composition pattern of a persistent left-side navigation area for target and draft access, a primary central wizard work area for step content, and a distinct review/handoff presentation area, while still reusing established shared component styling.
- **FR-021**: The system MUST NOT override or distort the established styling of existing shared UI components solely to achieve pixel-perfect visual parity with the prototype.
- **FR-022**: The UI shell MUST be able to serve as a stable front-end foundation for one or more generation packages without requiring the end-user workflow to be redesigned when those integrations are connected later.
- **FR-022A**: The UI MUST surface a clear privacy warning whenever the flow asks the user to enter or review identity-related information that may be sensitive in a client-side/browser-stored draft.

### Key Entities _(include if feature involves data)_

- **Wizard Draft**: The in-progress RWA project definition assembled by the user across all wizard stages. It contains the current answers, readiness state, and any unresolved issues.
- **Persisted Draft**: A client-side stored representation of a wizard draft that can be listed and resumed on the same client using the application's established storage package.
- **Draft List**: The client-side collection view that exposes saved drafts and supports create, resume, rename, and delete actions.
- **Wizard Stage**: A discrete section of the flow, such as asset, identity, compliance, access control, or review. Each stage has its own completion state and contributes a defined part of the draft. A deployment placeholder may exist as future, feature-flagged work but is not part of the MVP stage sequence.
- **Configuration Reference**: The canonical shape of the supported RWA draft that the wizard, CLI, and external generation packages are expected to interpret consistently.
- **Generation Handoff**: The boundary interaction where the UI shell submits the current draft to the app-local codegen boundary and receives availability, progress, success, or failure status from the currently wired in-browser generator integration.
- **Target Catalog**: The ordered set of target ecosystems presented in the sidebar selector, including both enabled targets and disabled coming-soon targets.
- **Capability Catalog**: The set of currently supported choices exposed to the wizard, such as module availability and target-environment options.
- **Component Inventory**: A delivery artifact that records which UI building blocks were reused from the shared library, which new reusable components were needed, which pieces remain wizard-specific, why each item received that classification, and any follow-up action required before release.
- **Mock Gap Register**: A delivery artifact that lists every temporary mock used to bridge unfinished codegen capabilities, the intended real integration it represents, the affected target, the temporary UI behavior used, and the planned replacement point near the end of implementation.
- **Local Candidate Shared Component**: A reusable interaction pattern first implemented within the wizard codebase so its design and architecture can be proven before migration into the shared UI library.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: At least 90% of representative users can complete the happy-path flow from an empty draft to the final review stage in 8 minutes or less without facilitator assistance.
- **SC-002**: 100% of inputs required for the initial supported RWA target can be entered, reviewed, and exported through the UI shell, with optional inputs clearly distinguishable from required ones.
- **SC-003**: At least 95% of users who reach the review stage can successfully export a draft or trigger a generation handoff on their first attempt.
- **SC-004**: 100% of tested unavailable-generation scenarios preserve the user's draft and display a clear, non-misleading status instead of implying successful output creation.
- **SC-005**: Every generic interaction pattern introduced by this feature is either fulfilled by an existing shared component or explicitly captured in the component inventory as a new reusable component with example coverage.
- **SC-006**: At least 90% of end-to-end test scenarios covering navigation, validation, optional paths, review, export, and generation-handoff states pass without manual workaround.
- **SC-007**: 100% of reviewed first-iteration target-catalog states clearly distinguish enabled, visible-disabled, and hidden targets, and no disabled target can be entered as if it were active.
- **SC-008**: 100% of reviewed draft round-trip scenarios cover save/resume, autosave after meaningful content, export, import-as-new, rename, delete, and recovery from invalid import without loss of the active draft.

## Assumptions

- The first release of the UI shell targets the Stellar RWA flow represented by the existing supported configuration and generation packages.
- Code generation already exists outside this feature and is treated as an external capability; this feature stops at configuration, review, export, and handoff, while allowing temporary mocked behavior to bridge unfinished codegen gaps.
- The application remains purely client-side for this feature; draft persistence uses `@openzeppelin/ui-storage` and does not depend on any backend service.
- The MVP ends with ZIP generation/export; any deployment-oriented step is future-facing placeholder work and must remain hidden unless explicitly enabled through the shared feature-flag system.
- The first iteration exposes a registry-style target selector experience similar to existing OpenZeppelin applications, but only Stellar is actionable; other targets may be visible as disabled coming-soon entries.
- The prototype and CLI wizard are reference points for scope, field coverage, and user flow, but the delivered UI shell is not required to preserve prototype-specific implementation choices.
- The prototype remains a valid reference for macro-level layout, screen composition, and overall design direction, but not for code structure or for forcing custom styling onto existing shared components.
- The shared OpenZeppelin UI library and its example application can accept reusable additions during the same delivery cycle, but only after those candidate components have been validated locally in the wizard context.
