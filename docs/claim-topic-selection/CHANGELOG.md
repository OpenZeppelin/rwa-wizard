# Changelog — claim-topic selection

Package-level release notes are generated from `.changeset/` into each package's `CHANGELOG.md`.
This file tracks the claim-topic selection documentation set.

## Unreleased (minor: `@openzeppelin/rwa-config`, `@openzeppelin/codegen-rwa-common`, `@openzeppelin/codegen-rwa-stellar`) — 2026-08-31

### Added

- `ClaimTopic.selected?: boolean` on `@openzeppelin/rwa-config`. Absence and `true` both mean
  selected; only an explicit `false` means defined but not selected. Producers omit the field when
  selected and delete the key on re-select.
- `isClaimTopicSelected(topic)` in `@openzeppelin/rwa-config` — the single definition of the
  field's meaning (`!== false`).
- `selectedClaimTopicIndices(config)` and `selectedClaimTopicIds(config)` in
  `@openzeppelin/codegen-rwa-common` — the projection every chain generator needs. Both return
  integers and carry no chain knowledge.
- Validation code `UNSELECTED_REFERENCE` when a trusted issuer references only unselected claim
  topics. Distinct from `REQUIRED_FIELD` because the remedy is different.
- A fourth precondition on `shouldGenerateBootstrapDemoMintScript`: at least one selected claim
  topic. Also closes the pre-existing empty-list malformed-shell hole.

### Changed

- Stellar chain-projection artefacts (`deploy.sh`, `bootstrap-demo-mint.sh`, README flowchart)
  emit only selected topics. `config.json` is unchanged: it is the authoring snapshot and carries
  the full list.
- The deploy template's internal contract carries `claimTopicIndices: readonly number[]` and no
  longer carries `claimTopicCount`. The heading uses `.length`; the loop iterates the values.
- Trusted-issuer topic lists are narrowed to selected ids at emission. The stored association is
  never pruned by unselection.

### Guarantees

- Absence means selected. Every existing draft generates byte-identically. No migration, no
  backfill, no default applied at load.
- Omit-when-true protects `config.json` bytes, not provenance output. A recording reader records a
  read of an absent key.
- Unselect is identical for predefined and custom topics and never prunes a trusted-issuer
  association.
- References resolve against defined topics. Unselecting a topic an issuer names does not
  invalidate the draft.
- Zero selected topics overall remains valid; the demo-mint script is gated rather than rejected.
- Per-line provenance attribution survives: emission keeps reading `claimTopics[index]` on the
  lines each topic shapes.

### Migration

None for consumers. An additive optional field; absence means selected. Producers that write
topics must omit `selected` when the topic is selected. Generators that walk claim topics must
project through `selectedClaimTopicIndices` / `selectedClaimTopicIds` inside an `observe` scope,
iterate indices, and never bound a `claimTopics` loop on a selected count or an ids length. See
[index-space-trap.md](./index-space-trap.md).
