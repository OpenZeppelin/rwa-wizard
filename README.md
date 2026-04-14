# RWA Wizard 🧭

> Wizard-based configuration interface for real-world asset token projects across multiple blockchain ecosystems.

## Project Status

This project is currently in development.

[OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/OpenZeppelin/rwa-wizard)
[Scorecard supply-chain security](https://github.com/OpenZeppelin/rwa-wizard/actions/workflows/scorecard.yml)
[OpenSSF Best Practices](https://www.bestpractices.dev/projects/11773)
[CLA Assistant](https://github.com/OpenZeppelin/rwa-wizard/actions/workflows/cla.yml)
[License: AGPL v3](https://www.gnu.org/licenses/agpl-3.0)
[CI](https://github.com/OpenZeppelin/rwa-wizard/actions/workflows/ci.yml)
[Conventional Commits](https://conventionalcommits.org)
[Commitizen friendly](http://commitizen.github.io/cz-cli/)
[TypeScript](https://www.typescriptlang.org/)
[React](https://reactjs.org/)
[Tailwind CSS](https://tailwindcss.com/)
[Vite](https://vitejs.dev/)
[pnpm](https://pnpm.io/)

## Table of Contents

- [Monorepo Structure](#monorepo-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Available Scripts](#available-scripts)
- [Local Development with UI Builder](#local-development-with-ui-builder)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Code Style](#code-style)
- [Commit Convention](#commit-convention)
- [Contributing](#contributing)
- [License](#license)

## Monorepo Structure

This project is organized as a monorepo with the following applications and packages:

- **apps/rwa-wizard**: The main React application for configuring RWA token projects.
- **packages/codegen-core**: Chain-agnostic code generation primitives such as file trees, ZIP assembly, validation, template sources, and deterministic hashing.
- **packages/codegen-rwa-common**: Shared RWA-domain generator helpers such as ownership and role resolution.
- **packages/codegen-rwa-stellar**: The Stellar/Soroban RWA project generator.
- **packages/config**: Chain-agnostic `RWAConfig` types and defaults shared by generators and the app.
- **packages/components**: Shared React UI components.
- **packages/hooks**: Shared React hooks for state management and business logic.

## Getting Started

### Prerequisites

- **Node.js**: v20+ (LTS recommended)
- **pnpm**: v10+ (`corepack enable` recommended)

### Installation

1. Clone the repository:
  ```bash
   git clone https://github.com/OpenZeppelin/rwa-wizard.git
   cd rwa-wizard
  ```
2. Install dependencies:
  ```bash
   pnpm install
  ```
3. Build all packages:
  ```bash
   pnpm build
  ```
4. Start the development server:
  ```bash
   pnpm dev
  ```
5. Open your browser and navigate to `http://localhost:5173`

## Available Scripts


| Script                | Description                                                       |
| --------------------- | ----------------------------------------------------------------- |
| `pnpm dev`            | Start the development server (`apps/rwa-wizard`)                  |
| `pnpm dev:all`        | Start all workspace packages in watch mode                        |
| `pnpm build`          | Build all packages and apps                                       |
| `pnpm build:packages` | Build all workspace packages under `packages/*`                   |
| `pnpm build:app`      | Build only the wizard app                                         |
| `pnpm test`           | Run tests across the workspace                                    |
| `pnpm test:all`       | Run all tests in parallel                                         |
| `pnpm test:coverage`  | Run tests with coverage reports                                   |
| `pnpm typecheck`      | Run TypeScript type checking                                      |
| `pnpm lint`           | Run ESLint across the workspace                                   |
| `pnpm lint:fix`       | Fix ESLint issues                                                 |
| `pnpm format`         | Format code with Prettier                                         |
| `pnpm format:check`   | Check formatting without changes                                  |
| `pnpm fix-all`        | Run Prettier, then ESLint fix                                     |
| `pnpm dev:local`      | Rewire UI dependencies to local `openzeppelin-ui` / `ui-builder`  |
| `pnpm dev:npm`        | Restore npm-based UI dependencies after local package development |
| `pnpm commit`         | Create a commit using Commitizen                                  |
| `pnpm changeset`      | Create a changeset for versioning                                 |
| `pnpm clean`          | Clean build artifacts                                             |


## Local Development with UI Builder

This project can consume packages from the [UI Builder](https://github.com/OpenZeppelin/ui-builder) repository. To develop against local changes:

1. **Enable local packages**:
  ```bash
   pnpm dev:local
  ```
   This automatically builds the local `openzeppelin-ui` packages (defaults to `../openzeppelin-ui`)
   and installs dependencies with `LOCAL_UI=true`.
2. **Switch back to npm packages** (before committing):
  ```bash
   pnpm dev:npm
  ```
3. **Custom path** (optional):
  ```bash
   LOCAL_UI_PATH=/path/to/openzeppelin-ui pnpm dev:local
  ```

## Project Structure

```text
rwa-wizard/
├── apps/
│   └── rwa-wizard/          # Main React application
│       ├── src/             # Application source code
│       ├── index.html       # HTML entry point
│       ├── vite.config.ts   # Vite configuration
│       └── package.json     # App dependencies
├── packages/
│   ├── codegen-core/        # Chain-agnostic codegen infrastructure
│   │   ├── src/
│   │   ├── tsdown.config.ts # Build configuration
│   │   └── package.json
│   ├── codegen-rwa-common/  # Shared RWA-domain generator helpers
│   │   ├── src/
│   │   ├── tsdown.config.ts # Build configuration
│   │   └── package.json
│   ├── codegen-rwa-stellar/ # Stellar/Soroban RWA generator
│   │   ├── src/
│   │   ├── tsdown.config.ts # Build configuration
│   │   └── package.json
│   ├── config/              # Shared RWAConfig schema and defaults
│   │   ├── src/
│   │   ├── tsdown.config.ts # Build configuration
│   │   └── package.json
│   ├── components/          # Shared UI components
│   │   ├── src/
│   │   ├── tsdown.config.ts # Build configuration
│   │   └── package.json
│   └── hooks/               # Shared React hooks
│       ├── src/
│       ├── tsdown.config.ts # Build configuration
│       └── package.json
├── scripts/                 # Development helper scripts
├── specs/                   # Feature specifications
├── test/                    # Shared test setup
├── .changeset/              # Versioning configuration
├── .github/                 # GitHub Actions workflows
├── .husky/                  # Git hooks
├── package.json             # Root workspace configuration
├── pnpm-workspace.yaml      # PNPM workspace definition
├── tsconfig.base.json       # Base TypeScript configuration
├── eslint.config.cjs        # ESLint configuration
├── tailwind.config.cjs      # Tailwind CSS configuration
└── vitest.shared.config.ts  # Shared test configuration
```

## Tech Stack

- **React 19**: Modern React with hooks and concurrent features
- **TypeScript 5**: Type-safe development
- **Vite 7**: Fast development server and build tool
- **Tailwind CSS**: Utility-first CSS framework
- **Vitest**: Fast unit testing framework
- **tsdown**: TypeScript library bundler
- **pnpm**: Fast, disk-efficient package manager
- **ESLint + Prettier**: Code quality and formatting
- **Husky + lint-staged**: Git hooks for quality gates
- **Commitlint**: Conventional commit enforcement
- **Changesets**: Version management and changelogs

## Code Style

### Git Hooks

This project uses Husky to enforce code quality:

- **pre-commit**: Runs lint-staged (Prettier → ESLint)
- **pre-push**: Runs full lint and format check
- **commit-msg**: Enforces conventional commit format

### Formatting

For consistent code formatting:

```bash
# Format and lint all files
pnpm fix-all
```

## Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/). Use the interactive commit tool:

```bash
pnpm commit
```

Examples:

```text
feat(rwa-wizard): add wizard step scaffold
fix(hooks): resolve state update race condition
docs: update README with setup instructions
chore: update dependencies
```

## Contributing

1. Create a feature branch from `main`
2. Make your changes following the code style guidelines
3. Write tests for new functionality
4. Create a changeset: `pnpm changeset`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

*This project uses [@openzeppelin/ui-components](https://www.npmjs.com/package/@openzeppelin/ui-components) for shared UI components.*