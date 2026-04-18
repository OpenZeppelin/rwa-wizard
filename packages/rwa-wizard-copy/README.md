# @openzeppelin/rwa-wizard-copy

Private workspace package that owns all **chain-neutral T-REX educational copy**
rendered by the RWA Wizard UI — short descriptions shown beneath titles and the
longer tooltip content ("infoCopy") revealed by info-icon affordances.

## Why it exists

T-REX / ERC-3643 vocabulary travels verbatim across blockchains:
address-level freezing, forced transfers, recovery, claim topics, trusted
issuers, and the compliance-module hook model are defined by the standard —
not by any particular execution environment. Duplicating that copy across
per-chain codegen packages would rot.

This package is the single source of truth for that prose. Per-chain codegen
packages (e.g. `@openzeppelin/codegen-rwa-stellar`) stay narrow: they describe
**what a chain can do** (ids, defaults, locks, hooks). The wizard app joins
them at the seam by id.

## Shape

```
src/
├── core/              chain-neutral T-REX vocabulary
├── overrides/         partial per-chain patches for unavoidable drift
└── resolve.ts         merges core + override, exposes category-scoped lookups
```

## Usage

```ts
import { getCopyForChain } from '@openzeppelin/rwa-wizard-copy';

const copy = getCopyForChain('stellar');

copy.adminControl('burnable');     // { description, infoCopy }
copy.identityControl('recovery');  // { description, infoCopy }
```

## Chain vs network

Chain *family* differences (Stellar vs EVM) live here, behind overrides.
Network-level UX (mainnet vs testnet faucets, explorers, gas estimates) does
**not** live here — that stays with each adapter's network catalog.

## Authoring rules (enforced by tests)

1. `infoCopy` must add context beyond `description` (distinctness test).
2. `core/` must not mention chain-specific tokens (`Stellar`, `EVM`, etc.) —
  put that in `overrides/<chain>.ts` (no-chain-leak test).
3. Every concept id consumed by the wizard app must be defined here
  (coverage test, lives in the wizard app).

