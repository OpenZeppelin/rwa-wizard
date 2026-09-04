# API reference — claim-topic selection

Every public member this change adds or reshapes. Signatures are from the published packages.

## `@openzeppelin/rwa-config`

### `ClaimTopic.selected?: boolean`

Whether this topic is part of the configuration to be deployed.

| Input state | Meaning                  |
| ----------- | ------------------------ |
| absent      | selected                 |
| `true`      | selected                 |
| `false`     | defined but not selected |

Absence and `true` are equivalent for every reader. Producers MUST omit the field when a topic is
selected rather than writing `true`, and re-selecting MUST delete the key. `config.json` is
`JSON.stringify` of this object, so an explicitly written `true` moves generated output on every
draft that has topics. ZIP output must be deterministic from a given `RWAConfig`: two drafts
differing only in an unwritten default must produce identical bytes.

The omit-when-true rule protects `config.json`'s bytes. It says nothing about provenance output. A
recording reader records a read of an absent key, so any selection walk records one path per topic
whether the field is written or not.

Selection is authoring state with no on-chain counterpart. ERC-3643's `ClaimTopicsRegistry`
exposes only `addClaimTopic` / `removeClaimTopic` and has no inactive state. Generators project
the field away; they never persist it into an artefact the deployment reads.

`IdentityVerificationConfig`, `TrustedIssuer`, and `IdentityControls` are unchanged.
`keyof IdentityVerificationConfig` remains `'claimTopics' | 'trustedIssuers' | 'controls'`.

### `isClaimTopicSelected(topic: ClaimTopic): boolean`

```ts
import { isClaimTopicSelected } from '@openzeppelin/rwa-config';
import type { ClaimTopic } from '@openzeppelin/rwa-config';

export function isClaimTopicSelected(topic: ClaimTopic): boolean;
```

Whether `topic` is part of the configuration to be deployed. The single definition of the field's
meaning: `topic.selected !== false`.

Lives beside the type that declares the field because the wizard and the CLI need the meaning and
must not import a generator package to read their own schema. The projection built on top of it
lives in `@openzeppelin/codegen-rwa-common`.

Reads `selected` by property access only. An `ownKeys` trap (object spread, `Object.keys`,
`JSON.stringify`) would record the topic's bare element path terminally under a recording reader,
which no pruning removes. `'selected' in topic` and `Object.hasOwn(topic, 'selected')` are safe.

**Wrong spellings that agree on today's data and still empty a legacy draft:**

```ts
topic.selected === true; // absent → false → unselected
!!topic.selected; // absent → false → unselected
```

---

## `@openzeppelin/codegen-rwa-common`

### `selectedClaimTopicIndices(config: RWAConfig): readonly number[]`

```ts
import { selectedClaimTopicIndices } from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

export function selectedClaimTopicIndices(config: RWAConfig): readonly number[];
```

Ascending positions in `config.identityVerification.claimTopics` that are selected.

Returns indices, not topics. Emission sites must keep reading `config…claimTopics[index]` on the
lines each topic shapes so per-line provenance attribution survives. Handing them detached topic
objects attributes every claim-topic line to one read at the top of the file, and every golden
still passes.

A count is not a substitute. A loop bounded by the selected count reads the first _n_ array
positions instead of the _n_ selected ones. See [index-space-trap.md](./index-space-trap.md).

MUST be called inside a `builder.observe(…)` scope so the per-topic `selected` reads are captured
by that scope. Called bare, its reads drain onto whichever emission follows. They are not lost.
They are misattributed.

Pure, one allocation, deliberately not memoised. Under provenance the config is a recording proxy
whose views are already cached one per target, so a cache keyed on it would survive across
`observe` scopes and make the second call record no reads at all.

### `selectedClaimTopicIds(config: RWAConfig): readonly number[]`

```ts
import { selectedClaimTopicIds } from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

export function selectedClaimTopicIds(config: RWAConfig): readonly number[];
```

The `id` of every selected claim topic, ascending by array position.

The aggregate form, for surfaces that emit the whole set on one line: a `--claim_topics '[…]'`
argument, a `for TOPIC in …` word list, a confirmation echo that prints the set. Those lines are
legitimately shaped by every topic at once, so one observed read attributed to the one line it
shapes is correct there.

Derived from `selectedClaimTopicIndices` rather than walking the array again, so the two cannot
disagree for any of the three input states. An indices walk records `.selected` on every topic;
this additionally records `.id` on the selected ones. A caller that needs both walks records both,
and its attribution carries a `claimTopics[i].id` segment as a result.

---

## `@openzeppelin/codegen-rwa-stellar` — internal contract

The package's public API (`generate`, `generateWithIdentitySupport`, `generateZip`, `validate`,
`shouldGenerateBootstrapDemoMintScript`, `isDemoAutoMintEligible`) is unchanged in signature.
What changed is the internal attribution contract the deploy templates share, and one gate input.

### `PostDeployModuleAttribution.claimTopicIndices`

```ts
interface PostDeployModuleAttribution {
  readonly claimTopicIndices: readonly number[];
  readonly claimTopicPaths: readonly ConfigPath[];
  readonly selectedClaimTopicIds: ReadonlySet<number>;
}
```

Positions in `config.identityVerification.claimTopics` that are selected, ascending. Replaces the
`claimTopicCount: number` this interface used to carry. The heading number is
`claimTopicIndices.length`; the loop iterates the values. `selectedClaimTopicIds` is carried
through from the caller's single `observe` rather than rebuilt, so the issuer-topic filter adds no
read of its own.

### `shouldGenerateBootstrapDemoMintScript` (package-internal)

Not a published export. Used by `generateWithIdentitySupport` to decide whether
`scripts/bootstrap-demo-mint.sh` exists. Signature:

```ts
function shouldGenerateBootstrapDemoMintScript(
  config: RWAConfig,
  includeIdentitySupport: boolean
): boolean;
```

Four preconditions (all must hold):

1. `includeIdentitySupport`
2. `isDemoAutoMintEligible(config)` (testnet / eligible target)
3. configured initial supply
4. **at least one selected claim topic** (`selectedClaimTopicIds(config).length > 0`)

The fourth closes a defect that predates selection: a config with `claimTopics: []` is
`valid: true` and used to generate `for DEMO_TOPIC in ; do` and `--claim_topics '[]'`. The remedy
is the gate rather than a validation error, because a config with no claim requirements is
legitimate. The demo script signs claims for the configured topics; with none selected it has no
work to do, and its absence is the truthful output.

`isDemoAutoMintEligible` deliberately does not gain the claim-topic input. It is called bare
inside the script's own scope, where a claim-topic read would land on the shebang.

Consumers observe the gate through the generated file tree: when the precondition fails,
`scripts/bootstrap-demo-mint.sh` is absent from the result.

### Validation: `UNSELECTED_REFERENCE`

A new branch in `validateTrustedIssuers`, after the existing reference check so the two never
double-report:

| Condition                                       | Code                   | Remedy                              |
| ----------------------------------------------- | ---------------------- | ----------------------------------- |
| `issuer.claimTopics.length === 0`               | `REQUIRED_FIELD`       | Add a topic                         |
| references an id not in the defined list        | `INVALID_REFERENCE`    | Fix or remove the bad id            |
| every referenced id exists but none is selected | `UNSELECTED_REFERENCE` | Re-select one, or remove the issuer |

References still resolve against **defined** topics. Unselecting a topic an issuer names never
invalidates a draft. That is what makes unselection non-destructive rather than merely reversible.

A distinct code rather than `REQUIRED_FIELD`, because the two states have different remedies. A
consumer that cannot distinguish them shows the wrong instruction, and the wizard is a consumer
whose job is telling the user what to do next.

`validateClaimTopics` is unchanged. Duplicate ids are wrong regardless of selection; the array is
the authoring list.

### Unchanged by design

| Surface                         | Why untouched                                                            |
| ------------------------------- | ------------------------------------------------------------------------ |
| `config.json` emission          | Authoring snapshot; carries the full list including `selected: false`    |
| Public generator / validate API | Additive optional field; absence means selected                          |
| `MAX_CLAIM_TOPICS`              | Bounds defined topics, not selected ones                                 |
| Anchor resolution               | The topic keeps its array slot; unselect/re-select does not move indices |
