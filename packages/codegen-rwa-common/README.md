# @openzeppelin/codegen-rwa-common

Shared RWA-domain helper logic for OpenZeppelin code generators. This package sits between `@openzeppelin/rwa-config` and chain-specific generators, and is intended for reusable generator behavior that is specific to the RWA domain but not tied to any one chain.

## Install

```bash
npm install @openzeppelin/codegen-rwa-common
```

## What This Package Owns

- Ownership-model admin resolution
- Manager-role fallback resolution
- Normalized role assignment shaping
- Compliance-module selection deduplication
- Compliance-module summary shaping for README/CLI/UI output
- Claim-topic selection projection (`selectedClaimTopicIndices`, `selectedClaimTopicIds`)
- Reuse of neutral default role symbols from `@openzeppelin/rwa-config`

It does **not** own chain-specific symbol constraints or identifier formatting. Those stay in each chain package.

## API Reference

### Functions

| Function                                                | Description                                                                      |
| ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `getAdminAddress(config)`                               | Resolve the effective admin address from `accessControl.ownership`               |
| `getResolvedRoleAssignments(config, options?)`          | Normalize configured roles into `{ name, symbol, addresses }` records            |
| `getManagerAddress(config, options?)`                   | Resolve the manager role address, falling back to the admin address              |
| `getAdditionalRoleAssignments(config, options?)`        | Return role assignments excluding the manager role                               |
| `getUniqueModuleSelections(selections)`                 | Deduplicate module selections by `moduleId`, keeping first-seen order            |
| `selectedClaimTopicIndices(config)`                     | Ascending positions of selected claim topics (projection; call inside `observe`) |
| `selectedClaimTopicIds(config)`                         | Ids of selected claim topics, derived from the indices walk                      |
| `formatModuleConfigSummary(config, preferredKeys)`      | Build a compact summary string for module config values                          |
| `getSelectedModuleSummaries(selections, resolveModule)` | Normalize selected modules into display-ready summary rows                       |
| `getUnderReviewModules(selections, resolveModule)`      | Return unique under-review module notices                                        |

### Types

| Type                       | Description                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `ResolvedRoleAssignment`   | `{ name, symbol, addresses }`                                                              |
| `RoleResolutionOptions`    | Optional callbacks such as `generateRoleSymbol(name)` for chain-specific fallback behavior |
| `SelectedModuleSummary`    | `{ id, name, hooks, configSummary, reviewSummary }` for display surfaces                   |
| `UnderReviewModuleSummary` | `{ id, name, prUrl? }` for under-review notices                                            |

## Example

```typescript
import {
  getAdditionalRoleAssignments,
  getAdminAddress,
  getManagerAddress,
} from '@openzeppelin/codegen-rwa-common';
import { generateRoleSymbol } from '@openzeppelin/codegen-rwa-stellar';

const roleOptions = { generateRoleSymbol };

const admin = getAdminAddress(config);
const manager = getManagerAddress(config, roleOptions);
const extraRoles = getAdditionalRoleAssignments(config, roleOptions);
```

If all configured roles provide explicit symbols, or use one of the neutral defaults from `DEFAULT_ROLE_SYMBOLS`, the callback is optional. Custom role names usually need a chain-specific `generateRoleSymbol()` function supplied by the generator package.

## Design Notes

- **RWA-domain, not chain-domain**: Logic here should be reusable across Stellar, EVM, and future RWA generators.
- **Behavior-light config package**: This package exists so `@openzeppelin/rwa-config` can remain schema-first.
- **No chain-specific formatting**: Helpers such as Rust identifier normalization belong in chain packages, not here.
- **Claim-topic selection**: The field's meaning (`isClaimTopicSelected`) lives in `@openzeppelin/rwa-config`. The projection every chain generator needs lives here. Full docs: [claim-topic selection](../../docs/claim-topic-selection/README.md).

## License

AGPL-3.0 — OpenZeppelin
