# Integration guide — claim-topic selection

How to write selection, how to project it, and the mistakes that ship an on-chain defect.

## Pattern 1: Produce a topic without writing `selected: true`

```ts
import { isClaimTopicSelected, type ClaimTopic } from '@openzeppelin/rwa-config';

export function addCustomTopic(id: number, name: string): ClaimTopic {
  // Selected by absence. Do not write selected: true.
  return { id, name, isCustom: true };
}

export function unselectTopic(topic: ClaimTopic): ClaimTopic {
  return { ...topic, selected: false };
}

export function reselectTopic(topic: ClaimTopic): ClaimTopic {
  // Delete the key. Do not write selected: true.
  const { selected: _drop, ...rest } = topic;
  return rest;
}

export function chipShowsSelected(topic: ClaimTopic): boolean {
  return isClaimTopicSelected(topic);
}
```

Unselect behaves identically for predefined and custom topics. The asymmetry between them belongs
to the wizard's controls, not to the field: after SF-17 both chip modes put configuration on a
dedicated control — claim-topic chips pass `onToggleSelection` so the checkmark toggles deploy
selection while the body is inspect-only; a custom chip's `×` remains the sole delete path. Do not
treat the body click as the configuration action.

**Never prune a trusted issuer's `claimTopics` on unselect.** Deletion still prunes. Unselection
does not. An issuer left referencing only unselected topics becomes a validation error with code
`UNSELECTED_REFERENCE`; that is recoverable by re-selecting, which is the whole point.

## Pattern 2: Project selection inside one observe scope

```ts
import type { LineBuilder } from '@openzeppelin/codegen-core';
import { selectedClaimTopicIds, selectedClaimTopicIndices } from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

export function emitDeployClaimTopics(builder: LineBuilder<RWAConfig>): void {
  const topics = builder.observe((config) => ({
    indices: selectedClaimTopicIndices(config),
    ids: selectedClaimTopicIds(config),
  }));

  if (topics.value.indices.length === 0) return;

  builder.line(`Claim Topics (${topics.value.indices.length})`);

  for (const index of topics.value.indices) {
    const topic = builder.config.identityVerification.claimTopics[index];
    if (topic === undefined) continue;
    builder.line(`add_claim_topic --claim_topic ${topic.id}`);
  }
}
```

One observe, both walks. The heading and the loop share the same recorded path set. Splitting them
into two observes is legal and worse: the second walk's `.id` reads either duplicate attribution or
land on a different range.

## Pattern 3: Narrow an issuer's topic list at emission, not at unselect

```ts
import type { RWAConfig } from '@openzeppelin/rwa-config';

export function issuerSelectedTopics(
  issuer: RWAConfig['identityVerification']['trustedIssuers'][number],
  selectedIds: ReadonlySet<number>
): number[] {
  return issuer.claimTopics.filter((id) => selectedIds.has(id));
}
```

The association stays stored. Only the chain-facing line is narrowed. An empty result after the
filter cannot reach a generated file through a valid config: `UNSELECTED_REFERENCE` makes
`generate()` throw first.

## Pattern 4: Gate a file that is meaningless without topics

```ts
import { selectedClaimTopicIds } from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

export function shouldEmitDemoMint(
  config: RWAConfig,
  includeIdentitySupport: boolean,
  eligibleTarget: boolean,
  hasSupply: boolean
): boolean {
  return (
    includeIdentitySupport &&
    eligibleTarget &&
    hasSupply &&
    selectedClaimTopicIds(config).length > 0
  );
}
```

Prefer a gate over a validation error when the _config_ is legitimate and only the _file_ is
meaningless. A config with no claim requirements validates today; making it invalid would break
configs that already ship. The gate also closes the pre-existing hole where
`claimTopics: []` plus supply plus testnet emitted `for DEMO_TOPIC in ; do`.

Observe the selected ids _before_ any in-scope assertion that depends on them, and derive the
assertion from the already-observed value. Putting the claim-topic read inside a predicate that
runs bare at the top of the file lands `claimTopics[i].selected` on the shebang.

## Pattern 5: Assert a positional filter with a non-final element

```ts
import { generateWithIdentitySupport } from '@openzeppelin/codegen-rwa-stellar';
import type { RWAConfig } from '@openzeppelin/rwa-config';

export function unselectNonFinal(config: RWAConfig): RWAConfig {
  const topics = config.identityVerification.claimTopics;
  if (topics.length < 2) throw new Error('need a non-final position');
  return {
    ...config,
    identityVerification: {
      ...config.identityVerification,
      claimTopics: topics.map((topic, index) =>
        index === 0 ? { ...topic, selected: false } : topic
      ),
    },
  };
}

export function emittedClaimTopicIds(config: RWAConfig): number[] {
  const { files } = generateWithIdentitySupport(config);
  const raw = files['scripts/deploy.sh'] ?? '';
  const script = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
  const ids: number[] = [];
  for (const match of script.matchAll(/--claim_topic (\d+)/g)) {
    ids.push(Number(match[1]));
  }
  return ids;
}
```

Unselecting the last topic produces byte-correct output with the count-conflation bug present. A
fixture or an oracle that uses the last position cannot fail the failure it exists to catch. See
[index-space-trap.md](./index-space-trap.md#the-fixture-lesson).

## Common mistakes

- **Writing `selected: true`.** Moves `config.json` on every draft that has topics. Omit the key.
- **Testing `topic.selected === true` or `!!topic.selected`.** Both read every legacy draft as
  unselected and empty the chain projection. Use `isClaimTopicSelected`.
- **Bounding a loop on `ids.length` then indexing `claimTopics`.** Type-checks. Ships the wrong
  topics. Iterate the indices.
- **Handing emission a list of detached topic objects.** Goldens pass. Per-line attribution
  collapses to one read at the top of the file.
- **Calling the helpers outside `observe`.** Reads drain onto the next emission. The Trusted
  Issuers heading picking up `claimTopics[i].selected` is the signature.
- **Pruning issuer associations on unselect.** Irreversible data loss the feature exists to
  prevent. Leave the association; let validation catch the zero-selected case.
- **Rejecting a config with zero selected topics.** Legitimate today. Gate the demo-mint script
  instead.
- **Putting the claim-topic gate read inside `isDemoAutoMintEligible`.** Lands selection paths on
  the shebang. Observe first, derive the assertion from the observed value.
- **Unselecting the final topic in a trap fixture.** Passes with the bug present. Use a non-final
  element.
- **Adding the new fixtures to the golden matrix.** An all-unselected-issuer fixture fails the
  every-fixture-validates gate; a golden directory changes the goldens tree OID. Assert directly.

## Where this sits relative to the other doc sets

| Concern                                         | Document set                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------- |
| `ClaimTopic.selected`, projection, this guide   | [claim-topic-selection](./README.md)                                |
| Which location the preview column is describing | [field-impact / selection](../rwa-wizard/field-impact/selection.md) |
| Recording which config paths a file read        | [codegen-core / provenance](../codegen-core/provenance/README.md)   |
| Why absent-key reads still attribute            | [provenance Safety](../codegen-core/provenance/README.md#safety)    |
