# @openzeppelin/codegen-rwa-common

## 0.2.0

### Minor Changes

- [#68](https://github.com/OpenZeppelin/rwa-wizard/pull/68) [`a173041`](https://github.com/OpenZeppelin/rwa-wizard/commit/a1730415d66eb557caa4ad773c36658a90b79719) Thanks [@pasevin](https://github.com/pasevin)! - Give a claim topic somewhere to be defined but not selected, and make the chain
  projection honour it.

  `rwa-config` gains an optional `selected?: boolean` on `ClaimTopic` and one
  export, `isClaimTopicSelected` — the single definition of the field's meaning.
  The field has three input states and the first two are equivalent: absence and
  `true` are both selected, only an explicit `false` is not, so the predicate is
  `!== false`. Producers MUST omit the field when a topic is selected and MUST
  delete the key on re-select rather than write `true`: `config.json` is
  `JSON.stringify` of the config, and ZIP output must be deterministic from a
  given `RWAConfig`, so two drafts differing only in an unwritten default must
  produce identical bytes. Every existing draft therefore generates
  byte-identically, and there is no migration, no backfill and no default applied
  at load.

  `codegen-rwa-common` gains `selectedClaimTopicIndices` and
  `selectedClaimTopicIds` — the projection every chain generator needs, since
  ERC-3643's `ClaimTopicsRegistry` has no inactive state on any chain. Both return
  integers and carry no chain knowledge.

  `codegen-rwa-stellar` projects selection onto the chain-projection artefacts:
  `deploy.sh` registers and echoes only the selected topics and narrows each
  trusted issuer's topic list to them, `bootstrap-demo-mint.sh` allows the demo
  signing key and signs demo claims for only the selected set, and the README
  flowchart counts them. `config.json` is deliberately unchanged — it is the
  authoring snapshot and the re-import vehicle, it carries every defined topic
  including unselected ones, and `deploy.sh` does not read it.

  The generator's internal contract carries selected **indices**, not a count.
  Those two coincide only while every defined topic is selected; under selection
  they diverge, and a loop bounded by the selected count reads the first _n_ array
  positions instead of the _n_ selected ones — registering an unselected topic
  on-chain and never registering a selected one, with nothing in the wizard
  showing it.

  Two behaviours change at the boundaries. A trusted issuer whose every referenced
  claim topic exists but is unselected is now a validation error with its own code,
  `UNSELECTED_REFERENCE`, distinct from `REQUIRED_FIELD` because the remedy is
  different — switch one back on, or remove the issuer. References still resolve
  against **defined** topics, so unselecting a topic an issuer names never
  invalidates a draft. And `scripts/bootstrap-demo-mint.sh` gains a fourth
  precondition, at least one selected claim topic, which also fixes a defect that
  predates selection: a config with `claimTopics: []` validated as `true` and
  generated `for DEMO_TOPIC in ; do` and `--claim_topics '[]'`.

- [#68](https://github.com/OpenZeppelin/rwa-wizard/pull/68) [`a173041`](https://github.com/OpenZeppelin/rwa-wizard/commit/a1730415d66eb557caa4ad773c36658a90b79719) Thanks [@pasevin](https://github.com/pasevin)! - Add `findRoleWithMembers` for targeted role resolution without normalizing every
  role's member addresses. `getManagerAddress` now uses it so manager resolution
  reads only the manager role (or falls back to admin) instead of every role in
  the list.

  Behaviour change vs the previous filter-then-find pattern: matching roles now
  resolve their symbol (`resolveRoleSymbol`) before the member-address filter.
  A symbol-less role that also has zero members — previously skipped quietly and
  able to fall through to the admin address — now throws when no
  `generateRoleSymbol` option is supplied. Callers that always pass
  `generateRoleSymbol` (including every in-repo path) are unaffected.

### Patch Changes

- Updated dependencies [[`a173041`](https://github.com/OpenZeppelin/rwa-wizard/commit/a1730415d66eb557caa4ad773c36658a90b79719)]:
  - @openzeppelin/rwa-config@0.2.0

## 0.1.0

### Minor Changes

- [#1](https://github.com/OpenZeppelin/rwa-wizard/pull/1) [`3c3c8d7`](https://github.com/OpenZeppelin/rwa-wizard/commit/3c3c8d77b1ada2e1a99df4459111339bf0f184a4) Thanks [@pasevin](https://github.com/pasevin)! - Initial release of shared RWA-domain generator helpers. Provides reusable access-control and role-resolution utilities that sit between the schema-only config package and chain-specific code generators such as Stellar and future EVM generators.

- [#26](https://github.com/OpenZeppelin/rwa-wizard/pull/26) [`d2912e5`](https://github.com/OpenZeppelin/rwa-wizard/commit/d2912e538f25d317a99f1809a94138e1ee98a868) Thanks [@pasevin](https://github.com/pasevin)! - Add chain-neutral compliance catalog metadata (categories, runtime prerequisites, selection warnings, config value kinds), refresh compliance step UI and copy, migrate address lists to `@openzeppelin/ui-components` `AddressListField` (3.2.0), and store operator roles by display name.

### Patch Changes

- [#29](https://github.com/OpenZeppelin/rwa-wizard/pull/29) [`d43d224`](https://github.com/OpenZeppelin/rwa-wizard/commit/d43d224969054dc94b7ff57defa2d5e168769fe2) Thanks [@pasevin](https://github.com/pasevin)! - Add testnet Scope A demo auto-mint (`bootstrap-demo-mint.sh`), compliance preflight warnings, and wizard gating for demo mint readiness.

- Updated dependencies [[`da6a352`](https://github.com/OpenZeppelin/rwa-wizard/commit/da6a3520913cd25da198e1803288720ad815b7d6)]:
  - @openzeppelin/rwa-config@0.1.0
