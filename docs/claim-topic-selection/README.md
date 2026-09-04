# Claim-topic selection

> A claim topic can be defined in the configuration without being part of the deployment. That
> distinction lives on the published `ClaimTopic` type, and generators project it away before any
> chain-facing artefact is written.

## Overview

This set is for whoever next maintains `@openzeppelin/rwa-config` or a generator that reads claim
topics: the person adding a field to `ClaimTopic`, the person writing the next chain package, and
the person who has to decide whether a new emission site should walk indices or ids.

ERC-3643's `ClaimTopicsRegistry` exposes `addClaimTopic` and `removeClaimTopic`. There is no
on-chain inactive state. Membership of the on-chain registry _is_ selection, and the config's
historical shape mirrored that faithfully: a topic present in `claimTopics` was selected, and the
only way to deselect one was to remove it. Authoring needs a third state. A custom topic the user
typed should be turn-off-able without being thrown away. That state has no chain counterpart, so
it is authoring state one level above the registry, and the generator's job is to **project** it
out of every artefact the deployment reads while leaving it intact in the artefact the user
re-imports.

That framing changes what the feature is. It is not a filter you apply once at a package boundary
and forget. `config.json` is the authoring snapshot and the re-import vehicle, so it may carry
selection. `deploy.sh`, `bootstrap-demo-mint.sh`, and the README flowchart are chain-facing, so
they must not. The question at each emission site is which side of that cut it sits on.

The integration points are three exports and one field:

```ts
import { selectedClaimTopicIds, selectedClaimTopicIndices } from '@openzeppelin/codegen-rwa-common';
import { isClaimTopicSelected } from '@openzeppelin/rwa-config';
import type { ClaimTopic, RWAConfig } from '@openzeppelin/rwa-config';

export function projectSelectedIds(config: RWAConfig): readonly number[] {
  return selectedClaimTopicIds(config);
}

export function keepDefined(topic: ClaimTopic): boolean {
  // Defined topics stay in the array whether selected or not.
  // Ask through the predicate — never `topic.selected === true`.
  return true;
}

export function willDeploy(topic: ClaimTopic): boolean {
  return isClaimTopicSelected(topic);
}
```

`isClaimTopicSelected` lives in `@openzeppelin/rwa-config` beside the type that declares the
field, because the wizard and the CLI need the field's _meaning_ and must not import a generator
package to read their own schema. The two projection helpers live in
`@openzeppelin/codegen-rwa-common`, beside the compliance-module analogues
(`getUniqueModuleSelections`, `getSelectedModuleSummaries`), because which array positions survive
into a chain artefact is reusable RWA-domain generator behaviour. Both return integers. Neither
knows anything about Stellar.

## Quick start

### Read selection in a producer

```ts
import { isClaimTopicSelected, type ClaimTopic } from '@openzeppelin/rwa-config';

export function markUnselected(topic: ClaimTopic): ClaimTopic {
  // Omit when selected. Writing `selected: true` moves config.json on every draft
  // that has topics, because that file is JSON.stringify of the config.
  if (isClaimTopicSelected(topic) && topic.selected === undefined) return topic;
  const { selected: _drop, ...rest } = topic;
  return rest;
}

export function unselect(topic: ClaimTopic): ClaimTopic {
  return { ...topic, selected: false };
}
```

Absence and `true` both mean selected. Only an explicit `false` means defined-but-not-selected.
Ask through `isClaimTopicSelected`. The spellings `=== true` and `!!selected` both read every
pre-existing draft (no `selected` on any topic) as unselected, and silently empty the chain
projection of a config that still validates.

### Project selection in a generator

```ts
import type { LineBuilder } from '@openzeppelin/codegen-core';
import { selectedClaimTopicIds, selectedClaimTopicIndices } from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

export function emitClaimTopics(builder: LineBuilder<RWAConfig>): void {
  // One observe, both walks, inside the file's scope. Called bare, the helpers'
  // reads drain onto whichever emission follows.
  const topics = builder.observe((config) => ({
    indices: selectedClaimTopicIndices(config),
    ids: selectedClaimTopicIds(config),
  }));

  builder.line(`Claim Topics (${topics.value.indices.length})`);

  for (const index of topics.value.indices) {
    // Keep reading claimTopics[index] on the lines each topic shapes.
    // Handing the loop a detached topic object collapses per-line attribution.
    const topic = builder.config.identityVerification.claimTopics[index];
    if (topic === undefined) continue;
    builder.line(`add_claim_topic --claim_topic ${topic.id}`);
  }

  // Aggregate surfaces (a JSON array, a bash word list) use the ids.
  builder.line(`--claim_topics '[${topics.value.ids.join(', ')}]'`);
}
```

Return **indices**, not topics, for any loop that still needs to read the config. Return **ids**
for any line that emits the whole set at once. A count is not a substitute for either. See
[index-space-trap.md](./index-space-trap.md).

## Key concepts

**Projection, not filtering.** Selection is authoring state. Generators project it away from
chain-facing artefacts and leave it on `config.json`. Stripping unselected topics from the
in-memory config, or pruning them from every trusted issuer on unselect, would destroy the data
the feature exists to keep. Unselect behaves identically for predefined and custom topics, and
never prunes a trusted-issuer association. Deletion (`×`) still prunes; unselection does not.

**Omit when true.** Producers MUST omit `selected` when a topic is selected, and MUST delete the
key on re-select rather than write `true`. `config.json` is `JSON.stringify` of the config, so an
explicitly written `true` moves generated output on every draft that has topics (15 of 16 golden
fixtures). Absence means selected, so no existing draft changes on first read. That guarantee is
true by construction rather than by care. Document the asymmetry honestly: omit-when-true protects
`config.json`'s **bytes**, not its provenance. A recording reader records a read of an absent key,
so any selection walk adds one `claimTopics[i].selected` path per topic whether the field is
written or not.

**Indices, not a count.** The generator's internal contract carries
`claimTopicIndices: readonly number[]`. The heading number is `.length`; the loop iterates the
values. A count and the index space coincide only while every defined topic is selected. Under
selection they diverge, and a loop bounded by the selected count reads the first _n_ array
positions instead of the _n_ selected ones. That registers an unselected topic on-chain and skips
a selected one. The trap had two instances and only one became a type error. See
[index-space-trap.md](./index-space-trap.md).

**Non-final fixtures.** Unselecting the _final_ topic produces byte-correct output **with the
count-conflation bug present**, so a fixture or an oracle that uses the last position cannot fail
the failure it exists to catch. Any test for a positional filter must use a non-final element.
That mistake was made twice here, at two different levels, before it was caught.

**Gate, not error, for zero selected topics.** A config with no claim topics is valid. The
demo-mint script is gated on at least one selected claim topic rather than rejected, which also
closes a pre-existing hole: an empty topic list with a supply and a testnet target already emitted
malformed shell (`for DEMO_TOPIC in ; do`). An issuer left referencing zero _selected_ topics is a
validation error with its own code, `UNSELECTED_REFERENCE`, because that state would register an
issuer trusted for nothing on a real network.

## Documents

| Document                                       | What it covers                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| [index-space-trap.md](./index-space-trap.md)   | Why the contract carries indices, the second instance, the fixture rule |
| [api-reference.md](./api-reference.md)         | Every export, with full signatures                                      |
| [integration-guide.md](./integration-guide.md) | Producer and generator patterns, common mistakes                        |
| [CHANGELOG.md](./CHANGELOG.md)                 | Added / changed / migration                                             |

Related sets on either side of this one:

- The wizard column that _describes_ what a claim topic generates lives in
  [docs/rwa-wizard/field-impact](../rwa-wizard/field-impact/README.md). Selection there means
  "which location the column is describing", not "whether the topic deploys".
- The provenance capability that records which config paths each generated file read lives in
  [docs/codegen-core/provenance](../codegen-core/provenance/README.md). Selection walks are the
  reason omit-when-true does not protect provenance output.

## Safety

- **Ask through `isClaimTopicSelected`.** Inline `=== true` or `!!selected` empties the projection
  of every legacy draft. There is exactly one definition of the field's meaning.
- **Do not write `selected: true`.** Omit the key. Re-selecting deletes it. The ZIP-determinism rule
  requires that two drafts differing only in an unwritten default produce identical bytes.
- **Call the projection helpers inside `builder.observe`.** Called bare, their reads are not lost.
  They are misattributed to the next emission, which is worse.
- **Iterate indices; emit ids.** A loop that indexes `claimTopics` from `0..ids.length` type-checks
  and ships the wrong topics. See [index-space-trap.md](./index-space-trap.md).
- **Do not prune issuer associations on unselect.** References resolve against _defined_ topics.
  Unselecting a topic an issuer names must leave the draft valid. The validation rule that fires is
  the one for zero selected references, with a distinct code and a distinct remedy.
- **Gate the demo-mint script; do not invalidate the config.** Zero selected topics is legitimate.
  The script is meaningless without topics to sign, so its absence is the truthful output.
- **Keep reading `claimTopics[index]` on the lines each topic shapes.** Handing emission a list of
  detached topic objects attributes every claim-topic line to one read at the top of the file.
  Goldens still pass. Per-line attribution does not.
- **A green golden suite proves nothing about an unselected topic.** No golden fixture carries
  `selected: false`. The properties that catch a missed projection site are asserted directly.

## License

AGPL-3.0 — OpenZeppelin
