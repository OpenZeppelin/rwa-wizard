# @openzeppelin/codegen-rwa-stellar

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

- [#68](https://github.com/OpenZeppelin/rwa-wizard/pull/68) [`a173041`](https://github.com/OpenZeppelin/rwa-wizard/commit/a1730415d66eb557caa4ad773c36658a90b79719) Thanks [@pasevin](https://github.com/pasevin)! - Distinguish attributions that _determine_ a line from those that merely
  _display_ its value.

  `codegen-core` gains an optional `secondaryPaths` on the `range` entry — a
  non-empty, sorted, duplicate-free subset of the entry's own `paths`, absent
  when nothing is secondary. A generator declares it at the emission:
  `ProvenanceScope.addRange` takes `{ secondaryPaths }` (the general
  per-attribution subset) and `LineSink.line` / `lines` / `block` take
  `{ secondary: true }` (the per-emission form that expands across exactly that
  emission's path union). Consumers ask `isSecondaryAttribution(entry, query)`
  rather than reading the field: significance is per attribution, so a prefix
  query is secondary only when _every_ path it matches is, and an entry the query
  does not match at all is never secondary.

  Absence means primary, and it means so structurally: no value anywhere holds
  `'primary'` or `'secondary'`, the only writer is the `addRange` call that
  created the range, and `createPatchBuilder` passes no options at all. A
  generator that declares nothing produces exactly the object it produced before.
  `addRange` throws `ProvenanceAttributionError('secondary-not-attributed')` — a
  new reason on the existing error, no new class — when a secondary path is not
  one the range attributes, and does so regardless of `recordProvenance`, so the
  bug cannot hide on a recording-off path.

  `codegen-rwa-stellar` declares it for the display-only regions of the generated
  `deploy.sh` and `bootstrap-demo-mint.sh`: banners, section headings,
  confirmation echoes, the network summary, the deployment summary and the
  initial-supply guidance. The deploy and invoke commands that consume the same
  fields stay primary, so a field such as `token.name` now reports its
  `--name` argument and its summary banner differently.

  No generated byte changes.

- [#67](https://github.com/OpenZeppelin/rwa-wizard/pull/67) [`6d1bd35`](https://github.com/OpenZeppelin/rwa-wizard/commit/6d1bd35f119959d53bbd99f0b88e47db666aa149) Thanks [@pasevin](https://github.com/pasevin)! - Add `getUpstreamSourceRevision(options?)`, which reports the repository and
  commit the generated crate imports resolve against — `{ repoUrl, commitHash,
mode }`, where `mode` is `'git-revision'` for the pinned default and
  `'local-path'` (with a `null` commit) when `contractsLibraryPath` points the
  manifest at a checkout.

  Add `getGeneratedFileKind(path)`, which reports a closed ranking kind
  (`contract` | `script` | `provenance-and-docs` | `unknown`) for one
  project-relative generated path so consumers can rank generated files without
  inferring layout from filenames.

  Consumers that link generated `use stellar_*` paths to upstream source can now
  read those coordinates directly instead of parsing them out of the generated
  `Cargo.toml` or README, which coupled them to template wording.

  Additive: no existing export or generated output changed.

### Patch Changes

- [#68](https://github.com/OpenZeppelin/rwa-wizard/pull/68) [`a173041`](https://github.com/OpenZeppelin/rwa-wizard/commit/a1730415d66eb557caa4ad773c36658a90b79719) Thanks [@pasevin](https://github.com/pasevin)! - Own the generated-file ranking vocabulary in `@openzeppelin/codegen-core`:
  `GENERATED_FILE_KINDS`, `GeneratedFileKind`, `PROVENANCE_AND_DOCS_KIND` and the
  `isGeneratedFileKind` guard. `@openzeppelin/codegen-rwa-stellar` re-exports the
  same names from core instead of declaring its own copy, so a second chain
  generator and every consumer narrow against one closed set. Generated bytes and
  `getGeneratedFileKind` results are unchanged.

- [#68](https://github.com/OpenZeppelin/rwa-wizard/pull/68) [`a173041`](https://github.com/OpenZeppelin/rwa-wizard/commit/a1730415d66eb557caa4ad773c36658a90b79719) Thanks [@pasevin](https://github.com/pasevin)! - Quieter Addresses provenance on role-guard scans: omit the
  `accessControl.roles` list root from pause / method / document-manager guard
  Observed reads via `omitExactConfigPath` (hazard 5). Generated contract bytes are
  unchanged; only provenance path lists move. Whole-list emits
  (`getAdditionalRoles`) keep the root.
- Updated dependencies [[`a173041`](https://github.com/OpenZeppelin/rwa-wizard/commit/a1730415d66eb557caa4ad773c36658a90b79719), [`a173041`](https://github.com/OpenZeppelin/rwa-wizard/commit/a1730415d66eb557caa4ad773c36658a90b79719), [`a173041`](https://github.com/OpenZeppelin/rwa-wizard/commit/a1730415d66eb557caa4ad773c36658a90b79719), [`a173041`](https://github.com/OpenZeppelin/rwa-wizard/commit/a1730415d66eb557caa4ad773c36658a90b79719), [`a173041`](https://github.com/OpenZeppelin/rwa-wizard/commit/a1730415d66eb557caa4ad773c36658a90b79719), [`a173041`](https://github.com/OpenZeppelin/rwa-wizard/commit/a1730415d66eb557caa4ad773c36658a90b79719)]:
  - @openzeppelin/rwa-config@0.2.0
  - @openzeppelin/codegen-rwa-common@0.2.0
  - @openzeppelin/codegen-core@0.2.0

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
