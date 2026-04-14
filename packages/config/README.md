# @openzeppelin/rwa-config

Shared, chain-agnostic configuration types for OpenZeppelin RWA (Real World Asset) generators. This package defines the canonical `RWAConfig` shape consumed by the app and by chain-specific code generators.

## Install

```bash
npm install @openzeppelin/rwa-config
```

## Example

```typescript
import type { RWAConfig } from '@openzeppelin/rwa-config';

const config: RWAConfig = {
  token: {
    name: 'Acme Real Estate Token',
    symbol: 'ACME',
    decimals: 18,
    initialSupply: '1000000',
    administrativeControls: {
      burnable: true,
      mintable: true,
      pausable: true,
    },
    documentManager: { enabled: true },
  },
  identityVerification: {
    claimTopics: [
      { id: 1, name: 'KYC' },
      { id: 2, name: 'AML' },
    ],
    trustedIssuers: [{ address: 'GCEXAMPLEISSUER1...', claimTopics: [1, 2] }],
    controls: {
      addressFreezing: true,
      partialTokenFreezing: true,
      recovery: true,
      forcedTransfers: true,
    },
  },
  compliance: {
    modules: [
      {
        moduleId: 'supply-limit',
        config: { limit: 1000000 },
      },
    ],
  },
  accessControl: {
    ownership: { type: 'single-owner', ownerAddress: 'GCEXAMPLEOWNER...' },
    roles: [
      { name: 'Manager', symbol: 'manager', addresses: ['GCMGR...'] },
      { name: 'Agent', addresses: ['GCAGENT...'] },
    ],
  },
  deployment: {
    network: 'testnet',
    sourceAccount: 'GCDEPLOYER...',
  },
};
```

## Type Reference

### `RWAConfig`

Root configuration object with the following sections:


| Field                  | Type                         | Description                                          |
| ---------------------- | ---------------------------- | ---------------------------------------------------- |
| `token`                | `TokenConfig`                | Token metadata, controls, and document manager       |
| `identityVerification` | `IdentityVerificationConfig` | Claim topics, trusted issuers, and identity controls |
| `compliance`           | `ComplianceConfig`           | Selected compliance modules and module config        |
| `accessControl`        | `AccessControlConfig`        | Ownership model and operator roles                   |
| `deployment`           | `DeploymentConfig`           | Target network and optional deployer account         |


### `TokenConfig`


| Field                     | Type      | Required | Description                                |
| ------------------------- | --------- | -------- | ------------------------------------------ |
| `name`                    | `string`  | Yes      | Token name                                 |
| `symbol`                  | `string`  | Yes      | Token symbol                               |
| `decimals`                | `number`  | Yes      | Decimal places                             |
| `initialSupply`           | `string`  | No       | Initial supply as bigint-compatible string |
| `administrativeControls`  | `object`  | Yes      | Burnable, mintable, and pausable toggles   |
| `documentManager.enabled` | `boolean` | Yes      | Enable document management                 |


### `IdentityVerificationConfig`


| Field            | Type               | Description                                       |
| ---------------- | ------------------ | ------------------------------------------------- |
| `claimTopics`    | `ClaimTopic[]`     | `{ id, name, isCustom? }`                         |
| `trustedIssuers` | `TrustedIssuer[]`  | `{ address, claimTopics }`                        |
| `controls`       | `IdentityControls` | Address freezing, recovery, and transfer controls |


### `ComplianceConfig`


| Field     | Type                          | Description                                 |
| --------- | ----------------------------- | ------------------------------------------- |
| `modules` | `ComplianceModuleSelection[]` | Selected modules as `{ moduleId, config? }` |


`ComplianceHook` is an opaque string type. Each ecosystem defines its valid hook set separately. Hooks are not stored in `ComplianceModuleSelection`; generators derive them from their module registry metadata at generation time.

### `AccessControlConfig`


| Field       | Type             | Description                           |
| ----------- | ---------------- | ------------------------------------- |
| `ownership` | `OwnershipModel` | `single-owner`, `multi-sig`, or `dao` |
| `roles`     | `OperatorRole[]` | `{ name, symbol?, addresses }`        |


### `DeploymentConfig`


| Field           | Type     | Required | Description                                     |
| --------------- | -------- | -------- | ----------------------------------------------- |
| `network`       | `string` | Yes      | Target network (`"testnet"`, `"mainnet"`, etc.) |
| `sourceAccount` | `string` | No       | Deployer account address                        |


## Exports


| Export                       | Kind  | Description                                   |
| ---------------------------- | ----- | --------------------------------------------- |
| `RWAConfig`                  | type  | Root configuration interface                  |
| `TokenConfig`                | type  | Token parameters                              |
| `IdentityVerificationConfig` | type  | Identity setup                                |
| `ComplianceConfig`           | type  | Compliance modules                            |
| `AccessControlConfig`        | type  | Ownership and roles                           |
| `DeploymentConfig`           | type  | Deployment target                             |
| `ClaimTopic`                 | type  | Claim topic entry                             |
| `TrustedIssuer`              | type  | Trusted issuer entry                          |
| `ComplianceModuleSelection`  | type  | Module selection                              |
| `ComplianceHook`             | type  | Hook identifier (`string`, ecosystem-defined) |
| `OwnershipModel`             | type  | Ownership discriminated union                 |
| `OperatorRole`               | type  | Role definition                               |
| `DEFAULT_ROLE_SYMBOLS`       | value | Well-known role name to symbol mapping        |


## Design Notes

- **Chain-agnostic**: No chain-specific validation limits, runtime policies, or generator behavior live here.
- **Schema-first**: This package defines the shape of config data; shared runtime helper logic now lives in generator packages such as `@openzeppelin/codegen-rwa-common`.
- **Minimal runtime surface**: The main runtime export is `DEFAULT_ROLE_SYMBOLS`, which provides neutral default symbol mappings for well-known roles.

## License

AGPL-3.0 — OpenZeppelin