# @openzeppelin/rwa-wizard-cli

## 0.1.2

### Patch Changes

- Updated dependencies [[`a173041`](https://github.com/OpenZeppelin/rwa-wizard/commit/a1730415d66eb557caa4ad773c36658a90b79719), [`a173041`](https://github.com/OpenZeppelin/rwa-wizard/commit/a1730415d66eb557caa4ad773c36658a90b79719), [`a173041`](https://github.com/OpenZeppelin/rwa-wizard/commit/a1730415d66eb557caa4ad773c36658a90b79719), [`a173041`](https://github.com/OpenZeppelin/rwa-wizard/commit/a1730415d66eb557caa4ad773c36658a90b79719), [`a173041`](https://github.com/OpenZeppelin/rwa-wizard/commit/a1730415d66eb557caa4ad773c36658a90b79719), [`a173041`](https://github.com/OpenZeppelin/rwa-wizard/commit/a1730415d66eb557caa4ad773c36658a90b79719), [`6d1bd35`](https://github.com/OpenZeppelin/rwa-wizard/commit/6d1bd35f119959d53bbd99f0b88e47db666aa149)]:
  - @openzeppelin/rwa-config@0.2.0
  - @openzeppelin/codegen-rwa-stellar@0.2.0
  - @openzeppelin/codegen-core@0.2.0

## 0.1.1

### Patch Changes

- Updated dependencies [[`273eaab`](https://github.com/OpenZeppelin/rwa-wizard/commit/273eaabdc36254c3281d4b274dc8519f30bbf860)]:
  - @openzeppelin/codegen-rwa-stellar@0.1.1

## 0.1.0

### Minor Changes

- [#2](https://github.com/OpenZeppelin/rwa-wizard/pull/2) [`cf610d0`](https://github.com/OpenZeppelin/rwa-wizard/commit/cf610d06780da3fcc1154d5e578177516b18ffe9) Thanks [@pasevin](https://github.com/pasevin)! - Initial release of the RWA Wizard CLI. Provides interactive step-by-step wizard and headless JSON config modes for generating RWA token projects, with file tree or ZIP output. Includes validation, compliance module listing, and a generator adapter architecture for multi-chain support (Stellar/Soroban first).

### Patch Changes

- [#25](https://github.com/OpenZeppelin/rwa-wizard/pull/25) [`ba73c37`](https://github.com/OpenZeppelin/rwa-wizard/commit/ba73c37835b6e2d67a2cec712d1d6769d168336b) Thanks [@pasevin](https://github.com/pasevin)! - Clarify that identity-support generation (`--include-identity-support` / `generateWithIdentitySupport`) is development and testnet scaffolding only, not a production onboarding stack.

- [#29](https://github.com/OpenZeppelin/rwa-wizard/pull/29) [`d43d224`](https://github.com/OpenZeppelin/rwa-wizard/commit/d43d224969054dc94b7ff57defa2d5e168769fe2) Thanks [@pasevin](https://github.com/pasevin)! - Add testnet Scope A demo auto-mint (`bootstrap-demo-mint.sh`), compliance preflight warnings, and wizard gating for demo mint readiness.

- [#28](https://github.com/OpenZeppelin/rwa-wizard/pull/28) [`1acd986`](https://github.com/OpenZeppelin/rwa-wizard/commit/1acd986be0d1b022fecbad6f42f517aff253f716) Thanks [@pasevin](https://github.com/pasevin)! - Add deploy preflight and shared deploy guidance for generated Stellar projects, improve generated README accuracy (identity scaffolding, WASM counts, signer quick start), and print deploy next steps after CLI generation.

- Updated dependencies [[`da6a352`](https://github.com/OpenZeppelin/rwa-wizard/commit/da6a3520913cd25da198e1803288720ad815b7d6), [`da6a352`](https://github.com/OpenZeppelin/rwa-wizard/commit/da6a3520913cd25da198e1803288720ad815b7d6), [`da6a352`](https://github.com/OpenZeppelin/rwa-wizard/commit/da6a3520913cd25da198e1803288720ad815b7d6), [`ba73c37`](https://github.com/OpenZeppelin/rwa-wizard/commit/ba73c37835b6e2d67a2cec712d1d6769d168336b), [`d2912e5`](https://github.com/OpenZeppelin/rwa-wizard/commit/d2912e538f25d317a99f1809a94138e1ee98a868), [`d43d224`](https://github.com/OpenZeppelin/rwa-wizard/commit/d43d224969054dc94b7ff57defa2d5e168769fe2), [`1acd986`](https://github.com/OpenZeppelin/rwa-wizard/commit/1acd986be0d1b022fecbad6f42f517aff253f716), [`b051be9`](https://github.com/OpenZeppelin/rwa-wizard/commit/b051be9149c3b2afce3884fba80621f23cc5f5b0)]:
  - @openzeppelin/codegen-core@0.1.0
  - @openzeppelin/codegen-rwa-stellar@0.1.0
  - @openzeppelin/rwa-config@0.1.0
