# @openzeppelin/rwa-config

Shared, chain-agnostic configuration types for OpenZeppelin RWA (Real World Asset) code generators. This package defines the canonical `RWAConfig` shape consumed by all chain-specific generators.

## Install

```bash
npm install @openzeppelin/rwa-config
```

## RWAConfig Type Reference

```typescript
import type { RWAConfig } from '@openzeppelin/rwa-config';

const config: RWAConfig = {
  token: {
    name: 'Acme Real Estate Token',
    symbol: 'ACME',
    decimals: 18,
    initialSupply: '1000000000000000000000000', // optional, bigint string
    documentManager: { enabled: true },
  },
  identityVerification: {
    claimTopics: [
      { id: 1, name: 'KYC' },
      { id: 2, name: 'AML' },
    ],
    trustedIssuers: [{ address: 'GCEXAMPLEISSUER1...', claimTopics: [1, 2] }],
  },
  compliance: {
    modules: [{ moduleId: 'supply-cap', hook: 'creation' }],
  },
  accessControl: {
    ownership: { type: 'single-owner', ownerAddress: 'GCEXAMPLEOWNER...' },
    roles: [
      { name: 'Manager', symbol: 'manager', addresses: ['GCMGR...'] },
      { name: 'Agent', addresses: ['GCAGENT...'] }, // symbol auto-generated
    ],
  },
  deployment: {
    network: 'testnet',
    sourceAccount: 'GCDEPLOYER...', // optional
  },
};
```

## Types

### `RWAConfig`

Root configuration object with the following sections:

| Field                  | Type                         | Description                                            |
| ---------------------- | ---------------------------- | ------------------------------------------------------ |
| `token`                | `TokenConfig`                | Token name, symbol, decimals, supply, document manager |
| `identityVerification` | `IdentityVerificationConfig` | Claim topics and trusted issuers                       |
| `compliance`           | `ComplianceConfig`           | Compliance module selections                           |
| `accessControl`        | `AccessControlConfig`        | Ownership model and operator roles                     |
| `deployment`           | `DeploymentConfig`           | Target network and deployer account                    |

### `TokenConfig`

| Field                     | Type      | Required | Description                                |
| ------------------------- | --------- | -------- | ------------------------------------------ |
| `name`                    | `string`  | Yes      | Token name                                 |
| `symbol`                  | `string`  | Yes      | Token symbol                               |
| `decimals`                | `number`  | Yes      | Decimal places                             |
| `initialSupply`           | `string`  | No       | Initial supply as bigint-compatible string |
| `documentManager.enabled` | `boolean` | Yes      | Enable document management                 |

### `IdentityVerificationConfig`

| Field            | Type              | Description                                  |
| ---------------- | ----------------- | -------------------------------------------- |
| `claimTopics`    | `ClaimTopic[]`    | `{ id: number, name: string }`               |
| `trustedIssuers` | `TrustedIssuer[]` | `{ address: string, claimTopics: number[] }` |

### `ComplianceConfig`

| Field     | Type                          | Description                   |
| --------- | ----------------------------- | ----------------------------- |
| `modules` | `ComplianceModuleSelection[]` | `{ moduleId, hook, config? }` |

`ComplianceHook` values: `'transfer'` | `'creation'` | `'destruction'`

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

| Export                       | Kind  | Description                           |
| ---------------------------- | ----- | ------------------------------------- |
| `RWAConfig`                  | type  | Root configuration interface          |
| `TokenConfig`                | type  | Token parameters                      |
| `IdentityVerificationConfig` | type  | Identity setup                        |
| `ComplianceConfig`           | type  | Compliance modules                    |
| `AccessControlConfig`        | type  | Ownership and roles                   |
| `DeploymentConfig`           | type  | Deployment target                     |
| `ClaimTopic`                 | type  | Claim topic entry                     |
| `TrustedIssuer`              | type  | Trusted issuer entry                  |
| `ComplianceModuleSelection`  | type  | Module selection                      |
| `ComplianceHook`             | type  | Hook type union                       |
| `OwnershipModel`             | type  | Ownership discriminated union         |
| `OperatorRole`               | type  | Role definition                       |
| `DEFAULT_ROLE_SYMBOLS`       | value | Well-known role name → symbol mapping |

## Design Notes

- **Chain-agnostic**: No validation constraints, numeric limits, or chain-specific constants live here. Each generator (e.g., `@openzeppelin/codegen-rwa-stellar`) defines its own validation rules.
- **Type-only boundary**: This package primarily exports TypeScript types. The only runtime value is `DEFAULT_ROLE_SYMBOLS`.

## License

AGPL-3.0 — OpenZeppelin
