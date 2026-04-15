# Quickstart: RWA Wizard UI Shell

## Goal

Verify the first iteration of the UI shell end to end:

- target selector renders with Stellar enabled and future targets disabled
- local draft list works with autosave
- wizard steps are navigable and validated
- config import/export works through the storage-backed flow
- generation handoff runs through the app-local codegen boundary and produces a ZIP download or a documented mock-backed equivalent
- deployment placeholder remains hidden by default unless explicitly enabled through the shared feature-flag system

## Prerequisites

- Node.js `>=20`
- `pnpm`
- local checkouts of:
  - `rwa-wizard`
  - `openzeppelin-ui`
  - `ui-builder`

## Setup

```bash
cd /path/to/rwa-wizard
pnpm install
pnpm dev:local
```

If codegen packages are being edited locally during verification, build them first:

```bash
pnpm --filter @openzeppelin/rwa-config build
pnpm --filter @openzeppelin/codegen-core build
pnpm --filter @openzeppelin/codegen-rwa-stellar build
```

## Run The App

```bash
pnpm --filter @openzeppelin/rwa-wizard-app dev
```

Open the local Vite URL in a browser.

## Verification Flow

### 1. Target Catalog

- Open the sidebar target selector.
- Confirm `stellar` is selectable.
- Confirm future ecosystems such as `evm` are visible but disabled with a `Coming Soon` style label.

### 2. Draft Management

- Create a new draft.
- Enter meaningful content in the first wizard step.
- Refresh the page and confirm the draft resumes from local storage.
- Rename the draft from the draft list.
- Duplicate the export/import loop by exporting a config file and importing it back as a new draft.
- Delete a non-active draft and confirm only that draft is removed.

### 3. Wizard Flow

- Complete the asset, identity, compliance, access-control, and review steps.
- Confirm no deployment step or deployment-choice UI is shown in the default MVP flag state.
- Confirm backward/forward navigation preserves entered values.
- Confirm required-field validation blocks invalid progress states.
- Confirm optional sections remain omitted rather than shown as failures.

### 4. Generation Handoff

- On a valid Stellar draft, trigger generation.
- Confirm the UI shows coarse handoff states such as validating/generating/packaging.
- Confirm the successful outcome is a ZIP download.
- If a documented mock gap is still active, confirm the UI clearly indicates mock-backed behavior without breaking the flow.

### 5. Performance Checks

- Confirm target selector metadata appears on first render without waiting for generator-package loading.
- Confirm autosave persists edits within roughly 1 second of idle time while navigation remains responsive.
- Confirm generation phase changes become visible immediately during the flow and successful ZIP completion feedback appears promptly after generation finishes.

### 6. Optional Feature-Flag Check

- Enable the future deployment placeholder through the shared `AppConfigService`-backed feature-flag path used by the other OpenZeppelin apps.
- Confirm the deployment placeholder can appear for development/staged rollout scenarios without becoming a required part of the MVP ZIP-generation flow.
- If future deployment-target controls are wired behind that flag, confirm they round-trip through `config.deployment.target` preset/custom objects rather than a legacy `deployment.network` string.
- Disable the flag again and confirm the placeholder is hidden with no impact on the default wizard path.

## Test Commands

```bash
pnpm --filter @openzeppelin/rwa-wizard-app typecheck
pnpm --filter @openzeppelin/rwa-wizard-app lint
pnpm --filter @openzeppelin/rwa-wizard-app test
```

## Expected Outcome

- The app remains fully client-side.
- Draft persistence uses `@openzeppelin/ui-storage`.
- Generation runs through the app-local in-browser codegen boundary rather than a backend service.
- The default MVP flow ends at ZIP generation/export without any visible deployment step.
- The UI shell works end to end even if some generator capabilities are still temporarily mocked.
- Any future deployment placeholder evolves from the same `RWAConfig` contract and writes `deployment.target`, not `deployment.network`.
- No unsupported target can be entered from the selector.
