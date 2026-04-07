# Local Development with openzeppelin-ui and openzeppelin-adapters

This guide explains how to develop the RWA Wizard against local copies of `@openzeppelin/ui-*` from [openzeppelin-ui](https://github.com/OpenZeppelin/openzeppelin-ui) and `@openzeppelin/adapter-*` from [openzeppelin-adapters](https://github.com/OpenZeppelin/openzeppelin-adapters).

## Quick Start

```bash
# 1. Clone all three repos as siblings
cd ~/dev/repos/OpenZeppelin
git clone git@github.com:OpenZeppelin/rwa-wizard.git
git clone git@github.com:OpenZeppelin/openzeppelin-ui.git
git clone git@github.com:OpenZeppelin/openzeppelin-adapters.git

# 2. Install dependencies in openzeppelin-ui
cd openzeppelin-ui
pnpm install

# 3. Install dependencies in openzeppelin-adapters
cd ../openzeppelin-adapters
pnpm install

# 4. Enable local packages in rwa-wizard (auto-builds both repos)
cd ../rwa-wizard
pnpm dev:local

# 5. Start development
pnpm dev
```

## How It Works

The local development setup uses the published `oz-ui-dev` CLI plus pnpm’s `.pnpmfile.cjs` at the **rwa-wizard monorepo root** to resolve dependencies when local families are enabled.

### Directory Structure

```text
~/dev/repos/OpenZeppelin/
├── rwa-wizard/                # This repo
├── openzeppelin-ui/           # UI packages
│   └── packages/
│       ├── types/             # @openzeppelin/ui-types
│       ├── utils/             # @openzeppelin/ui-utils
│       ├── styles/            # @openzeppelin/ui-styles
│       ├── components/        # @openzeppelin/ui-components
│       ├── renderer/          # @openzeppelin/ui-renderer
│       ├── react/             # @openzeppelin/ui-react
│       └── storage/           # @openzeppelin/ui-storage
└── openzeppelin-adapters/     # Adapter packages
    └── packages/
        ├── adapter-evm/       # @openzeppelin/adapter-evm
        ├── adapter-evm-core/  # @openzeppelin/adapter-evm-core
        ├── adapter-stellar/   # @openzeppelin/adapter-stellar
        ├── adapter-solana/    # @openzeppelin/adapter-solana
        ├── adapter-polkadot/  # @openzeppelin/adapter-polkadot
        └── adapter-midnight/  # @openzeppelin/adapter-midnight
```

The hook only rewrites adapter packages that appear in your dependency graph. See `.pnpmfile.cjs` for the exact list mapped for this monorepo.

## Commands

### Switch to Local UI + Adapter Packages

```bash
pnpm dev:local
```

This command:

1. Builds packages in local openzeppelin-ui (default `../openzeppelin-ui`)
2. Builds adapter packages in local openzeppelin-adapters (default `../openzeppelin-adapters`)
3. Delegates to the published `oz-ui-dev` CLI so the selected families are packed into `.packed-packages/local-dev` and installed through the config-driven pnpm hook

### Switch to Local UI Packages Only

```bash
pnpm dev:uikit:local
```

Use this when you only want local `@openzeppelin/ui-*` packages and want adapters to keep resolving from npm.

### Switch to Local Adapter Packages Only

```bash
pnpm dev:adapters:local
```

Use this when you only want local `@openzeppelin/adapter-*` packages and want UI packages to keep resolving from npm.

### Custom Paths

If your repos live elsewhere:

```bash
LOCAL_UI_PATH=/path/to/openzeppelin-ui LOCAL_ADAPTERS_PATH=/path/to/openzeppelin-adapters pnpm dev:local
```

### Switch Back to npm Packages

```bash
pnpm dev:npm
```

This delegates to `oz-ui-dev use remote`, which removes local manifests and reinstalls against published npm packages.

## Development Workflow

### UI packages

1. Edit `openzeppelin-ui/packages/*`
2. From **rwa-wizard** root: `pnpm dev:local`
3. Restart `pnpm dev` if needed

### Adapter packages

1. Edit `openzeppelin-adapters/packages/adapter-*`
2. From **rwa-wizard** root: `pnpm dev:local`
3. Restart `pnpm dev` if needed

### Hot reload (advanced)

```bash
# Terminal 1: openzeppelin-ui
cd openzeppelin-ui
pnpm build --watch   # if supported

# Terminal 2: openzeppelin-adapters
cd openzeppelin-adapters
pnpm --filter='./packages/adapter-*' build --watch   # if supported

# Terminal 3: rwa-wizard
cd rwa-wizard
pnpm dev
```

## Troubleshooting

### “Module not found”

```bash
pnpm dev:local
```

Or build upstream repos manually:

```bash
cd ../openzeppelin-ui && pnpm install && pnpm --filter='./packages/*' build
cd ../openzeppelin-adapters && pnpm install && pnpm --filter='./packages/adapter-*' build
```

### Changes not showing up

```bash
pnpm dev:local
pnpm dev
```

### Flaky installs after toggling local vs npm

```bash
pnpm clean
rm -rf node_modules
pnpm install   # or pnpm dev:local
```

### Confirm local resolution

During `pnpm dev:local` you should see logs similar to:

```text
Using local packages for /path/to/rwa-wizard
  ui: 7 tarballs -> /path/to/rwa-wizard/.packed-packages/local-dev/ui.json
  adapters: 5 tarballs -> /path/to/rwa-wizard/.packed-packages/local-dev/adapters.json
```

## Best Practices

1. Pull all three repos regularly so APIs stay in sync.
2. Rebuild after upstream changes before debugging the wizard.
3. Use registry versions in CI; local `file:` resolution is for development only.
4. Commit wizard, UI kit, and adapter changes in their respective repositories.
