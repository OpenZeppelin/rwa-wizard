# RWA Wizard Application

A React-based application for configuring real-world asset token projects across multiple blockchain networks.

## Getting Started

### Prerequisites

- Node.js >= 20.19.0
- pnpm >= 10.22.0

### Installation

```bash
# From the monorepo root
pnpm install
```

### Development

```bash
# Start the development server
pnpm dev

# Or from monorepo root
pnpm --filter @openzeppelin/rwa-wizard-app dev
```

### Testing

```bash
# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## Architecture

### Core Modules

| Module  | Description                                               | Documentation                              |
| ------- | --------------------------------------------------------- | ------------------------------------------ |
| Storage | IndexedDB persistence layer for contracts and preferences | [Storage Docs](src/core/storage/README.md) |

## Project Structure

```text
apps/rwa-wizard/src/
├── app/                       # Cross-cutting app concerns
│   ├── config/                # Feature flags, AppConfigService bootstrap
│   ├── providers/             # React context providers (copy, adapter caps, …)
│   ├── routes/                # AppRouter, AppSidebar, DashboardPage, constants
│   └── state/                 # External wizardStore + useWizardStore selector hook
├── assets/                    # Static assets (icons, images)
├── components/                # Shared presentational components
│   └── shared/                # ErrorBanner(Stack), AddressListInput, …
├── features/                  # Feature-sliced modules
│   ├── draft-management/      # IndexedDB draft list + import/export
│   ├── generation/            # Codegen flow + dialog
│   ├── target-catalog/        # Target selector sidebar
│   └── wizard/                # Wizard shell
│       ├── WizardPage.tsx     # Presentational page (consumes hooks below)
│       ├── hooks/             # useWizardSession, useWizardSteps, useTargetRuntime
│       ├── state/             # useWizardDraftState (local form state)
│       ├── steps/             # One folder per wizard step
│       │   ├── access-control/
│       │   ├── asset/
│       │   ├── compliance/
│       │   ├── deployment/
│       │   ├── identity/
│       │   └── review/
│       └── validation/        # Per-step validators + constraints
├── registry/                  # Target registry (Stellar, EVM, …)
├── services/                  # Pure services (codegen loader, downloads, runtime)
├── storage/                   # WizardDraftStorage (IndexedDB) + React hooks
├── test/                      # Shared test fixtures
├── types/                     # Wizard domain types (TargetId, WizardStepId, …)
└── utils/                     # Small helpers (errorReporting, defaultRwaConfig, …)
```

## Scripts

| Script               | Description               |
| -------------------- | ------------------------- |
| `pnpm dev`           | Start development server  |
| `pnpm build`         | Build for production      |
| `pnpm preview`       | Preview production build  |
| `pnpm test`          | Run tests                 |
| `pnpm test:watch`    | Run tests in watch mode   |
| `pnpm test:coverage` | Run tests with coverage   |
| `pnpm typecheck`     | TypeScript type checking  |
| `pnpm lint`          | Run ESLint                |
| `pnpm lint:fix`      | Run ESLint with auto-fix  |
| `pnpm format`        | Format code with Prettier |
| `pnpm format:check`  | Check code formatting     |

## Local Development with UI Kit and Adapters

When developing against local changes to `@openzeppelin/ui-*` and/or `@openzeppelin/adapter-*` packages:

```bash
# From the monorepo root, enable local packages (UI + adapters)
pnpm dev:local

# UI-only or adapters-only (see root package.json scripts):
# pnpm dev:uikit:local
# pnpm dev:adapters:local

# To switch back to npm registry packages
pnpm dev:npm
```

### How It Works

The local development workflow uses the published `oz-ui-dev` CLI together with pnpm's `[readPackage` hook](https://pnpm.io/pnpmfile#hooksreadpackagepkg-context) via `.pnpmfile.cjs` and `.openzeppelin-dev.json` at the monorepo root:

1. `oz-ui-dev use local` builds and packs the selected families from your sibling checkouts.
2. The generated manifests are written under `.packed-packages/local-dev`.
3. During install, `.pnpmfile.cjs` rewrites `@openzeppelin/ui-*` and `@openzeppelin/adapter-*` dependencies to those packed artifacts, or falls back to configured repo paths when needed.

**Benefits:**

- `package.json` stays unchanged (no committed `file:` overrides)
- Switching between local and npm is a single command
- Paths are configurable via `LOCAL_UI_PATH` and `LOCAL_ADAPTERS_PATH`

See the root `[docs/LOCAL_DEVELOPMENT.md](../../docs/LOCAL_DEVELOPMENT.md)` guide for clone layout, troubleshooting, and workflow details.

## Analytics

The app reports Google Analytics 4 events through the shared `AnalyticsProvider` / `AnalyticsService` from `@openzeppelin/ui-react` (`VITE_GA_TAG_ID`; disabled unless the `analytics_enabled` feature flag is on). Wizard-specific events live in `src/hooks/useRwaWizardAnalytics.ts`; the network dimensions are resolved by `src/hooks/useAnalyticsNetworkContext.ts` from the active `/wizard/:networkId` route (preset deployment target first, URL segment second).

Rules:

- `network_id` and `ecosystem` are registered GA custom dimensions. Do not rename any parameter below.
- Every string dimension falls back to the literal `'unknown'` — never `undefined` or an empty string, which GA4 silently drops.
- Never send account addresses or free-form user text. `error_snippet` is whitespace-collapsed and truncated to 120 characters.

| Event                  | Parameters                                                                 | Fired from                                      | When                                                   |
| ---------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| `page_view`            | `page_title`, `page_path`                                                  | `components/analytics/TrackedRoute.tsx`         | Route pathname changes on `/wizard/:networkId`         |
| `wizard_step`          | `step_number`, `step_name`, `network_id`, `ecosystem`                      | `features/wizard/WizardPage.tsx`                | Step navigation (1-indexed step being entered)         |
| `target_selected`      | `target_id`, `network_id`, `ecosystem`                                     | `app/routes/AppSidebar.tsx`                     | "Create … RWA" click; network is the destination route |
| `draft_opened`         | `source` (`sidebar_recent`)                                                | `app/routes/AppSidebar.tsx`                     | Recent-asset row click                                 |
| `projects_imported`    | `count`                                                                    | `features/draft-management/…/DraftImportDialog` | JSON import succeeded                                  |
| `config_exported`      | `export_scope` (`single_draft` \| `all_drafts`), `network_id`, `ecosystem` | `WizardPage.tsx` / `AppSidebar.tsx`             | Export Configuration / sidebar Export click            |
| `project_generated`    | `target_id`, `zip_file_name`, `network_id`, `ecosystem`                    | `features/wizard/WizardPage.tsx`                | Once per successful generation job                     |
| `generation_failed`    | `target_id`, `error_snippet` (≤120 chars), `network_id`, `ecosystem`       | `features/wizard/WizardPage.tsx`                | Once per failed generation job                         |
| `wizard_cancelled`     | `target_id`, `network_id`, `ecosystem`                                     | `features/wizard/WizardPage.tsx`                | Cancel on the wizard chrome                            |
| `zip_download_clicked` | `target_id`, `network_id`, `ecosystem`                                     | `features/wizard/WizardPage.tsx`                | Download on the success dialog                         |
| `address_book_opened`  | `network_id`, `ecosystem`                                                  | `components/AddressBook/AddressBookDialog.tsx`  | Dialog opens (false → true), not on network change     |

`network_id` is the adapter `NetworkConfig.id` (e.g. `stellar-testnet`); `ecosystem` is `stellar` / `evm`. Outside the wizard route (or before the network catalogue has loaded) both are `'unknown'`.

## Codegen Runtime Overrides

The app can forward build-time runtime options into `@openzeppelin/codegen-rwa-stellar` so the browser shell can exercise the upstream-enabled generator features during local development.

```bash
RWA_WIZARD_STELLAR_CONTRACTS_LIBRARY_PATH=/absolute/path/to/stellar-contracts \
RWA_WIZARD_STELLAR_ALLOW_UNDER_REVIEW_MODULES=true \
pnpm dev
```

These variables are read when the Vite dev server starts:

- `RWA_WIZARD_STELLAR_CONTRACTS_LIBRARY_PATH`: forwards `contractsLibraryPath` to the Stellar codegen package.
- `RWA_WIZARD_STELLAR_ALLOW_UNDER_REVIEW_MODULES=true`: forwards `allowUnderReviewModules` so under-review compliance modules can be exercised from the UI shell.

## Dependencies

### Runtime

- `@openzeppelin/ui-types` - Shared TypeScript types
- `@openzeppelin/ui-utils` - Utility functions
- `@openzeppelin/ui-styles` - Shared styles (Tailwind CSS 4)
- `@openzeppelin/ui-components` - UI components (shadcn/ui based)
- `@openzeppelin/ui-renderer` - Transaction form rendering
- `@openzeppelin/ui-react` - React context providers and hooks
- `@openzeppelin/ui-storage` - IndexedDB storage utilities
- `@openzeppelin/adapter-evm` - EVM blockchain adapter (runtime / capabilities)
- `@openzeppelin/adapter-stellar` - Stellar blockchain adapter (runtime / capabilities)
- `react` - React framework
- `react-dom` - React DOM bindings
- `react-router-dom` - Routing
- `lucide-react` - Icons

### Dev Dependencies

- `vite` - Build tool
- `vitest` - Testing framework
- `tailwindcss` - CSS framework
- `fake-indexeddb` - IndexedDB mock for testing
