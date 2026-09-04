# The index-space trap

> The single most likely way claim-topic selection ships broken: a loop that bounds itself on a
> selected count, then uses the loop variable as an array index. The heading number and the index
> space coincide only while every defined topic is selected.

## What goes wrong

Before selection, the generator's internal contract carried `claimTopicCount: number`. The heading
printed that number, and the registration loop ran:

```ts
for (let index = 0; index < moduleAttribution.claimTopicCount; index += 1) {
  const topic = requireClaimTopic(config, index);
  // emit add_claim_topic --claim_topic ${topic.id}
}
```

That is correct for as long as every defined topic is selected. The count and the positions that
should emit are the same set. Under selection they diverge.

Take the three-topic list `[{1, KYC}, {2, AML}, {7, Accredited}]` and unselect topic 1 at index 0.

| What you have        | Value        |
| -------------------- | ------------ |
| Defined topics       | 1, 2, 7      |
| Selected topics      | 2, 7         |
| Selected count       | 2            |
| Naive loop runs      | index = 0, 1 |
| Naive loop reads     | topics 1, 2  |
| Correct registration | topics 2, 7  |

The script registers an unselected topic on-chain and never registers a selected one. Nothing in
the wizard shows it. That is the High-stakes failure: a wrong on-chain claim-topic set.

## Why the contract is an index list

`claimTopicCount` is gone. The contract carries:

```ts
interface PostDeployModuleAttribution {
  readonly claimTopicIndices: readonly number[];
}
```

The heading number is `claimTopicIndices.length`. The loop iterates the values:

```ts
for (const index of moduleAttribution.claimTopicIndices) {
  const topic = requireClaimTopic(config, index);
  // emit add_claim_topic --claim_topic ${topic.id}
}
```

A `readonly number[]` is not a valid `<` operand, so the naive count-bounded loop no longer
compiles at this site. The mistake becomes a type error rather than a golden that passes.

## The second instance, and why the type system does not catch it

The same conflation existed in `bootstrap-demo-mint.sh`'s `allow_key` loop, on a plain local rather
than on the attribution contract:

```ts
const topicIds = selectedClaimTopicIds(config); // [2, 7]
for (let index = 0; index < topicIds.length; index += 1) {
  const topic = config.identityVerification.claimTopics[index];
  // allow_key for topic.id
}
```

`topicIds` is a `readonly number[]` of _ids_. Its `.length` type-checks perfectly as a bound for
indexing `claimTopics`. Following an instruction that says "observe the ids and feed the loop"
literally ships `allow_key` for the wrong topics, in a file with no type-level protection at all.

Say this plainly: the trap had **two instances and only one became a type error**. The second runs
the same conflation on a local whose length is a valid bound for a different array. The fix is the
same shape as the first site. Observe both walks, iterate the indices, derive the aggregate lines
from the ids:

```ts
const topics = builder.observe((config) => ({
  indices: selectedClaimTopicIndices(config),
  ids: selectedClaimTopicIds(config),
}));

for (const index of topics.value.indices) {
  const topic = builder.config.identityVerification.claimTopics[index];
  // allow_key for this topic
}

const topicsJson = `[${topics.value.ids.join(', ')}]`;
const topicsBashList = topics.value.ids.join(' ');
```

The two helpers are derived one from the other (`selectedClaimTopicIds` walks
`selectedClaimTopicIndices`), so they cannot disagree for any of the three input states. They must
not: `deploy.sh` registers topics through the indices path while `bootstrap-demo-mint.sh` allows
the demo signing key through the ids path, and a one-state drift between them means the demo mint
signs claims for a topic the issuer was never allowed to sign.

## The fixture lesson

Unselecting the _final_ topic produces byte-correct output **with the bug present**.

Same list, topic 7 at the last position unselected. Selected count is 2. The naive loop runs
`index = 0, 1` and reads topics 1 and 2. That is exactly the correct output. The fixture passes
while the bug is present. A fixture that cannot fail is worse than no fixture, because it reads as
coverage.

The same arithmetic applies one level up, to a byte-identity oracle that compares
"present-and-false" against "absent from the array". With the final topic unselected, both
configurations emit `add_claim_topic 1, 2` under the bug, so the oracle passes too.

**Any test for a positional filter must use a non-final element.** Unselecting the last position
is optional additional coverage, not a substitute. That mistake was made twice here, at two
different levels, before it was caught.

## What to do in the next chain package

1. Carry selected indices on the internal contract, never a count.
2. Observe indices and ids in one `builder.observe` call inside the file's scope.
3. Iterate `for (const index of indices)` and keep reading `claimTopics[index]` on the lines each
   topic shapes.
4. Derive aggregate surfaces (`--claim_topics '[…]'`, `for TOPIC in …`) from the ids.
5. Pin a non-final unselection in every assertion that claims to catch a missed filter site.
6. Do not put the new fixtures in the golden matrix. An invalid issuer fixture fails the
   every-fixture-validates gate by name, and a golden directory changes the goldens tree OID.
   Assert the properties directly.

See [integration-guide.md](./integration-guide.md) for the full patterns, and
[api-reference.md](./api-reference.md) for the signatures.
