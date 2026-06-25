# @openzeppelin/codegen-rwa-common

## 0.1.0

### Minor Changes

- [#1](https://github.com/OpenZeppelin/rwa-wizard/pull/1) [`3c3c8d7`](https://github.com/OpenZeppelin/rwa-wizard/commit/3c3c8d77b1ada2e1a99df4459111339bf0f184a4) Thanks [@pasevin](https://github.com/pasevin)! - Initial release of shared RWA-domain generator helpers. Provides reusable access-control and role-resolution utilities that sit between the schema-only config package and chain-specific code generators such as Stellar and future EVM generators.

- [#26](https://github.com/OpenZeppelin/rwa-wizard/pull/26) [`d2912e5`](https://github.com/OpenZeppelin/rwa-wizard/commit/d2912e538f25d317a99f1809a94138e1ee98a868) Thanks [@pasevin](https://github.com/pasevin)! - Add chain-neutral compliance catalog metadata (categories, runtime prerequisites, selection warnings, config value kinds), refresh compliance step UI and copy, migrate address lists to `@openzeppelin/ui-components` `AddressListField` (3.2.0), and store operator roles by display name.

### Patch Changes

- [#29](https://github.com/OpenZeppelin/rwa-wizard/pull/29) [`d43d224`](https://github.com/OpenZeppelin/rwa-wizard/commit/d43d224969054dc94b7ff57defa2d5e168769fe2) Thanks [@pasevin](https://github.com/pasevin)! - Add testnet Scope A demo auto-mint (`bootstrap-demo-mint.sh`), compliance preflight warnings, and wizard gating for demo mint readiness.

- Updated dependencies [[`da6a352`](https://github.com/OpenZeppelin/rwa-wizard/commit/da6a3520913cd25da198e1803288720ad815b7d6)]:
  - @openzeppelin/rwa-config@0.1.0
