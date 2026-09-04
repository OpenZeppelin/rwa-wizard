# @openzeppelin/rwa-config

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

## 0.1.0

### Minor Changes

- [#1](https://github.com/OpenZeppelin/rwa-wizard/pull/1) [`da6a352`](https://github.com/OpenZeppelin/rwa-wizard/commit/da6a3520913cd25da198e1803288720ad815b7d6) Thanks [@pasevin](https://github.com/pasevin)! - Initial release of shared RWA configuration types. Defines the declarative RWAConfig structure used across all chain-specific RWA code generators, including asset metadata, compliance modules, and access control settings.
