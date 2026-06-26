# @openzeppelin/codegen-rwa-stellar

## 0.1.1

### Patch Changes

- [#40](https://github.com/OpenZeppelin/rwa-wizard/pull/40) [`273eaab`](https://github.com/OpenZeppelin/rwa-wizard/commit/273eaabdc36254c3281d4b274dc8519f30bbf860) Thanks [@pasevin](https://github.com/pasevin)! - chore(deps): bump `@openzeppelin/adapter-stellar` to `^2.1.1`

  Adopt the latest published `@openzeppelin/adapter-stellar` release, which (together with the matching `@openzeppelin/adapter-evm` and `@openzeppelin/ui-*` bumps in the app) resolves the outstanding Dependabot transitive security advisories upstream.

## 0.1.0

### Minor Changes

- [#1](https://github.com/OpenZeppelin/rwa-wizard/pull/1) [`da6a352`](https://github.com/OpenZeppelin/rwa-wizard/commit/da6a3520913cd25da198e1803288720ad815b7d6) Thanks [@pasevin](https://github.com/pasevin)! - Initial release of the Stellar/Soroban RWA project generator. Produces complete multi-contract Rust projects from declarative configuration, including token contracts, compliance modules, deployer scripts, and workspace-level Cargo configuration.

- [#29](https://github.com/OpenZeppelin/rwa-wizard/pull/29) [`d43d224`](https://github.com/OpenZeppelin/rwa-wizard/commit/d43d224969054dc94b7ff57defa2d5e168769fe2) Thanks [@pasevin](https://github.com/pasevin)! - Add testnet Scope A demo auto-mint (`bootstrap-demo-mint.sh`), compliance preflight warnings, and wizard gating for demo mint readiness.

- [#28](https://github.com/OpenZeppelin/rwa-wizard/pull/28) [`1acd986`](https://github.com/OpenZeppelin/rwa-wizard/commit/1acd986be0d1b022fecbad6f42f517aff253f716) Thanks [@pasevin](https://github.com/pasevin)! - Add deploy preflight and shared deploy guidance for generated Stellar projects, improve generated README accuracy (identity scaffolding, WASM counts, signer quick start), and print deploy next steps after CLI generation.

- [#12](https://github.com/OpenZeppelin/rwa-wizard/pull/12) [`b051be9`](https://github.com/OpenZeppelin/rwa-wizard/commit/b051be9149c3b2afce3884fba80621f23cc5f5b0) Thanks [@pasevin](https://github.com/pasevin)! - Add `CodegenInfoBlurb` types and exports in `@openzeppelin/codegen-core`. `@openzeppelin/codegen-rwa-stellar` adds `getCodegenInfoBlurb()`, contracts library repository metadata, and SEP-0057 reference links for the RWA wizard asset step and other consumers.

### Patch Changes

- [#25](https://github.com/OpenZeppelin/rwa-wizard/pull/25) [`ba73c37`](https://github.com/OpenZeppelin/rwa-wizard/commit/ba73c37835b6e2d67a2cec712d1d6769d168336b) Thanks [@pasevin](https://github.com/pasevin)! - Clarify that identity-support generation (`--include-identity-support` / `generateWithIdentitySupport`) is development and testnet scaffolding only, not a production onboarding stack.

- [#26](https://github.com/OpenZeppelin/rwa-wizard/pull/26) [`d2912e5`](https://github.com/OpenZeppelin/rwa-wizard/commit/d2912e538f25d317a99f1809a94138e1ee98a868) Thanks [@pasevin](https://github.com/pasevin)! - Add chain-neutral compliance catalog metadata (categories, runtime prerequisites, selection warnings, config value kinds), refresh compliance step UI and copy, migrate address lists to `@openzeppelin/ui-components` `AddressListField` (3.2.0), and store operator roles by display name.

- Updated dependencies [[`da6a352`](https://github.com/OpenZeppelin/rwa-wizard/commit/da6a3520913cd25da198e1803288720ad815b7d6), [`3c3c8d7`](https://github.com/OpenZeppelin/rwa-wizard/commit/3c3c8d77b1ada2e1a99df4459111339bf0f184a4), [`da6a352`](https://github.com/OpenZeppelin/rwa-wizard/commit/da6a3520913cd25da198e1803288720ad815b7d6), [`d2912e5`](https://github.com/OpenZeppelin/rwa-wizard/commit/d2912e538f25d317a99f1809a94138e1ee98a868), [`d43d224`](https://github.com/OpenZeppelin/rwa-wizard/commit/d43d224969054dc94b7ff57defa2d5e168769fe2), [`b051be9`](https://github.com/OpenZeppelin/rwa-wizard/commit/b051be9149c3b2afce3884fba80621f23cc5f5b0)]:
  - @openzeppelin/codegen-core@0.1.0
  - @openzeppelin/codegen-rwa-common@0.1.0
  - @openzeppelin/rwa-config@0.1.0
