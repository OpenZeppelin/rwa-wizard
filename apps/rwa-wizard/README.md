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

# Ensure sibling repos are built first:
# cd ../openzeppelin-ui && pnpm install && pnpm build
# cd ../openzeppelin-adapters && pnpm install && pnpm --filter './packages/adapter-*' build

# UI-only or adapters-only (see root package.json scripts):
# pnpm dev:uikit:local
# pnpm dev:adapters:local

# To switch back to npm registry packages
pnpm dev:npm
```

### How It Works

The local development workflow uses pnpm's [`readPackage` hook](https://pnpm.io/pnpmfile#hooksreadpackagepkg-context) via `.pnpmfile.cjs` together with `.openzeppelin-dev.json` to rewrite dependencies at install time:

1. When `LOCAL_UI=true` / `LOCAL_ADAPTERS=true` are set (e.g. via `pnpm dev:local`), the hook intercepts package resolution
2. `@openzeppelin/ui-*` dependencies map to paths under `LOCAL_UI_PATH` (default `../openzeppelin-ui`)
3. `@openzeppelin/adapter-*` dependencies map to paths under `LOCAL_ADAPTERS_PATH` (default `../openzeppelin-adapters`)

**Benefits:**

- `package.json` stays unchanged (no committed `file:` overrides)
- Switching between local and npm is a single script + `pnpm install`
- Paths are configurable via `LOCAL_UI_PATH` and `LOCAL_ADAPTERS_PATH`

See `.pnpmfile.cjs` and `.openzeppelin-dev.json` at the monorepo root for the full implementation.

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
