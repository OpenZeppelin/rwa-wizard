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
├── components/           # React components
│   ├── Dashboard/       # Dashboard-related components
│   ├── Layout/          # Layout components (Header, Sidebar, etc.)
│   └── Shared/          # Shared/reusable components
├── core/                # Core business logic
│   ├── ecosystems/      # Blockchain ecosystem registry
│   └── storage/         # Storage services
├── hooks/               # React hooks
├── pages/               # Page components
└── types/               # TypeScript type definitions
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

