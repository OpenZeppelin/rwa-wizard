# Attribution Significance

> An optional mark that separates the lines which **determine** a deployment from the lines which
> merely **display** the same value — declared by the generator at the emit site, never inferred,
> and never defaulted.

A field can reach a generated file more than once. In the Stellar deploy script the configured
owner address reaches line 22 as `ADMIN="GCEXAMPLEOWNER"`, the variable every later `stellar`
invocation is signed against, and reaches line 31 inside an `echo` that prints the same address as
an example in an error message. Both lines genuinely depend on the field. Only one of them decides
anything.

Significance is how a generator says which is which. It is **additive and optional**: a generator
that declares nothing produces exactly the result it produced before this existed, and every
attribution in it is primary. Nothing is ever hidden or dropped because it is secondary — a
secondary attribution is a true attribution, reported in full, with one extra fact attached.

This page is for whoever writes the next generator. It has three parts worth reading in order: why
the default cannot be subverted, why the mark goes on the emission rather than on the helper that
formats the text, and why reading significance takes a function call instead of a property read.

## The default is structural

There is no value anywhere in the result that says `'primary'`. The representation is one optional
member on the `range` variant of `ProvenanceEntry`:

```ts
type RangeEntry = {
  readonly kind: 'range';
  readonly range: ProvenanceLineRange;
  readonly paths: readonly ConfigPath[];
  /** A non-empty, sorted, duplicate-free subset of `paths`. Absent when nothing is secondary. */
  readonly secondaryPaths?: readonly ConfigPath[];
};
```

Absence means primary. `[]` is never recorded — an empty secondary set _is_ the default, and one
state gets one spelling so that entry equality and golden comparison stay unambiguous. `file` and
`created` entries never carry the member at all.

The property that matters is not that the default is correct but that **it cannot be bypassed**.
The only writer of `secondaryPaths` is the `addRange` call that created the range it sits on:

- `ProvenanceScope.addRange(range, paths, options)` is the sole place the member is set, and it
  sets it from `options.secondaryPaths` in the same call that records the entry.
- `LineSink.line` / `lines` / `block` forward `options.secondary` into that one `addRange`, in the
  same call frame that computed the range and drained the paths.
- Nothing else can reach an entry afterwards. There is no setter, no post-pass over the recorded
  entries, no merge rule that combines two entries into one, and no code path that fills in a
  default.

That is a stronger guarantee than a validated default, and the difference is worth stating plainly.
A validated default has a writer and a checker: some code assigns `'primary'`, some other code
verifies the assignment, and "can a demotion be invented?" is answered by auditing every writer and
trusting the checker to have covered them. Here the question does not arise. There is one writer,
it is the range's own constructor, and an entry it never marked has no member to hold a mark. A
demotion cannot be invented because there is no mechanism that could invent one.

The same holds across the boundaries an entry crosses:

- **`mergeProvenance`** replaces per file key, wholesale. Every entry in a merged result is
  reference-identical to an entry of an input, so a merge cannot downgrade a primary entry to match
  a secondary one recorded for the same lines elsewhere.
- **A consumer that narrows untrusted input** — the wizard's codegen seam is the reference
  implementation — repairs a malformed mark by intersecting it with the entry's own `paths`.
  Intersection can only ever _promote_ a path to primary. No consumer can make a path secondary
  that the generator did not declare secondary.

## Mark at the emission, never at a helper

This is the mistake you will otherwise make, because it looks obviously right. This initiative's
own specification assumed it.

The Stellar generator formats every status line through one pure function:

```ts
export function shellEcho(msg: string): string {
  return `echo "${msg}"`;
}
```

It has 94 call sites. Marking there — teaching `shellEcho` to declare its output secondary, or
attaching the mark to any formatter like it — would be a one-line change that reads as if it
captured the whole idea, and it would be wrong at most of those sites.

A formatter returns a string. Where that string lands is the **caller's** decision, and most of
these callers push the string into an array that a builder emits as a single range alongside
something that is not display at all. Here is the real shape, from `scripts/deploy.sh`:

```
201  echo "${BOLD}  Deploying ACME Token ...${RST}"
202  RWA_TOKEN_ADDRESS=$(stellar contract deploy \
203    --source-account "$SOURCE_ACCOUNT" \
204    --wasm target/wasm32v1-none/release/rwa_token.wasm \
205    --network testnet \
     …
219  )
```

Lines 201–219 are **one** `range` entry, attributed to `token.name`, `token.symbol` and the
`accessControl.roles` paths, and it is primary. Line 201 is `shellEcho` output. A mark on the
formatter would have travelled up into that entry and demoted the range that actually deploys the
token — silently, with byte-identical output, and with nothing in the generated script looking
wrong.

Compare the same formatter two hundred lines later:

```
259  echo "${GREEN}  ✓ Claim topic 1 (KYC)${RST}"
```

Line 259 is its own emission, its own range, and it is marked secondary. Same formatter, opposite
verdicts, decided entirely by which emission the string ended up in — which is exactly the fact a
formatter cannot know about itself.

**So the mark goes where the range is created.** One emission, one range, one path union, one mark,
all reaching one `addRange` inside one call frame:

```ts
sink.lines(texts, paths, { secondary: true });
```

The consequence is worth the sentence it takes to say: **the site marked is the site emitted, by
construction.** Not by convention, and not by review. That also makes a misapplied mark a testable
condition rather than a reading exercise — a test can classify the emitted text of every recorded
range and compare the classification against the marks, in both directions, which is what the
Stellar package's display-grammar oracle does.

Two details fall out of the same rule:

- **`secondary` is never pending.** `EmitOptions` applies to the call it is passed to and nothing
  else. A zero-line emission — `lines([])` — leaves its _paths_ pending for the next emission that
  produces bytes, but discards the mark. A zero-line emission has no range, so it has nothing to be
  secondary about, and letting a mark survive to the next emission would rebuild exactly the
  travelling-mark mechanism this design exists to prevent.
- **An emission with no paths records nothing, mark included.** A range entry is created only when
  the path union is non-empty. `{ secondary: true }` never causes an entry to exist.

If your generator formats display text through helpers, wrap the helper and the emission into a
single function rather than pushing the mark down into the formatter:

```ts
import type { ConfigPath, LineSink } from '@openzeppelin/codegen-core';

/** Emit already-formed display-only lines as ONE range, marked secondary. */
export function emitDisplay(
  sink: LineSink,
  lines: readonly string[],
  paths?: readonly ConfigPath[]
): void {
  sink.lines(lines, paths, { secondary: true });
}

/** Emit a display-only `echo`. The formatter and the emission are one site. */
export function emitEcho(sink: LineSink, msg: string, paths?: readonly ConfigPath[]): void {
  emitDisplay(sink, [shellEcho(msg)], paths);
}
```

Keep `paths` in the signature. It is not decoration: real display-only emissions carry an explicit
attribution — a section heading that names the number of configured modules, say — and a
sole-argument `(sink, text)` shape pushes those sites back to a raw `sink.lines` call, reopening
the two-call split the wrapper exists to close.

## Reading significance: `isSecondaryAttribution`

```ts
function isSecondaryAttribution(entry: ProvenanceEntry, query: ConfigPath): boolean;
```

Consumers **read** significance through this function. They never compute it.

The reason it exists is a mismatch between two shapes. Queries are **prefix** queries: asking for
`token` matches every recorded path beneath it, because `matchesConfigPath` treats a
segment-boundary prefix as a match. Significance is recorded **per exact path**. Joining the two
has exactly one correct rule, and both of the shortcuts a consumer would reach for inline are wrong
in opposite directions.

Take one entry and one query:

```ts
const entry = {
  kind: 'range',
  range: { start: 12, end: 12 },
  paths: ['token.name', 'token.symbol'],
  secondaryPaths: ['token.symbol'],
} as const;
// query: 'token'
```

| Inline shortcut                        | Answer  | Why it is wrong                                                                  |
| -------------------------------------- | ------- | -------------------------------------------------------------------------------- |
| `entry.secondaryPaths !== undefined`   | `true`  | Demotes a range that **determines** `token.name`. The user loses a real finding. |
| `entry.secondaryPaths.includes(query)` | `false` | `'token'` is not a recorded path. Promotes everything a prefix query reaches.    |

The rule, which lives in the function so it lives in one place:

> An attribution is secondary **iff** the entry matches the query **and every matching path is
> secondary.**

For the entry above and the query `token`, the matching paths are both, one of them is primary, and
the answer is `false` — correct, because a query for `token` reaches something this range
determines. Query `token.symbol` and the answer is `true`.

The function returns `false` for every other case, and each `false` is deliberate:

- a `file` or `created` entry — significance is a claim about lines, not about a whole file;
- a `range` with no `secondaryPaths`;
- an entry that does not match the query at all — the non-empty guard is load-bearing, not a
  nicety, because `Array.prototype.every` over an empty list is vacuously `true`, and without it
  every entry matching nothing would come back secondary and silently demote every row a consumer
  is handed;
- an entry with any primary matching path.

It throws `RangeError` on a malformed query or a malformed recorded path, the same contract as
`filterProvenanceByPath`, and the query is parsed before the entry kind is narrowed so that a bad
query throws for every kind rather than only for marked ranges.

### Do not read `secondaryPaths` directly

Beyond being wrong for prefix queries, `secondaryPaths !== undefined` makes your consumer sensitive
to a distinction the canonical form is supposed to have erased. `[]` and absent both mean "nothing
is secondary", and `addRange` records only the latter — but an entry that arrives from outside your
process has not been through `addRange`. This is why a consumer narrowing untrusted provenance
should canonicalise as it repairs: intersect the declared mark with the entry's `paths`, and drop
the member entirely when the intersection is empty, so that key-absent stays the one spelling of
the default.

`isSecondaryAttribution` answers `false` for `secondaryPaths: []` either way. The canonicalisation
is what keeps a downstream reader who ignores this advice from disagreeing with it.

## A worked example: one address, two verdicts

Generated with `recordProvenance: true` against the Stellar generator's plain path. Both entries
belong to `scripts/deploy.sh`; both carry the identical two paths.

```
 22  ADMIN="GCEXAMPLEOWNER"
     …
 31    echo "Example: export STELLAR_ACCOUNT=<identity-for-GCEXAMPLEOWNER>"
```

```jsonc
// line 22 — the variable every later `stellar` invocation is signed against
{
  "kind": "range",
  "range": { "start": 22, "end": 22 },
  "paths": ["accessControl.ownership.ownerAddress", "accessControl.ownership.type"],
}
// line 31 — the same address, printed as an example inside an error branch
{
  "kind": "range",
  "range": { "start": 31, "end": 31 },
  "paths": ["accessControl.ownership.ownerAddress", "accessControl.ownership.type"],
  "secondaryPaths": ["accessControl.ownership.ownerAddress", "accessControl.ownership.type"],
}
```

Asking about the field the user is editing:

| Query                                  | Line 22 | Line 31 |
| -------------------------------------- | ------- | ------- |
| `accessControl.ownership.ownerAddress` | `false` | `true`  |
| `accessControl` (prefix)               | `false` | `true`  |
| `''` (root)                            | `false` | `true`  |
| `token.name` (no match)                | `false` | `false` |

Same file, same field, same two config paths, opposite verdicts. Nothing about the text of either
line was inspected to decide this — the generator declared it at each emit site, and the two sites
are eighteen lines and one control-flow branch apart in the template.

## Declaring significance in your own generator

Two layers, deliberately different.

**The primitive.** `addRange` takes an arbitrary subset, so significance can differ between the
paths of a single range:

```ts
scope.addRange({ start: 12, end: 12 }, ['token.name', 'token.symbol'], {
  secondaryPaths: ['token.symbol'],
});
```

The subset rule is enforced: a secondary path the range does not attribute throws
`ProvenanceAttributionError('secondary-not-attributed')`, naming the offending paths and the file
and never a config value. It throws whether or not recording is enabled — the same discipline as
the range shape check — so a template bug cannot hide on a caller's recording-off path, and it
throws before any state is written, so a rejected `addRange` leaves the scope exactly as it was.

**The ergonomic form.** `EmitOptions.secondary` expands to that emission's entire path union — the
paths drained since the previous emission, the pending window, and `extraPaths`:

```ts
b.line(`ADMIN="${b.config.accessControl.ownership.ownerAddress}"`); // primary
b.line(`  echo "Example: ${example}"`, ownerPaths, { secondary: true }); // secondary
```

Only the literal `true` marks. This is the layer real templates use, because a display-only
emission is display-only for everything it reads.

### The two boundaries apply opposite rules, on purpose

`addRange` **throws** on a malformed mark. A consumer narrowing provenance that arrived from a
published package should **repair** it by intersection and keep the entry.

That asymmetry is a property, not an inconsistency, and neither rule belongs at the other boundary.
`addRange`'s caller is your own template, covered by your own suite: a bad subset is a bug to
surface loudly before release. A narrowing consumer's input comes from a package it does not
control, where one malformed byte of metadata must never cost the user information — a throwing
narrowing step turns a single bad mark into zero provenance affordances on every field of every
generation.

## What is expressible but not yet produced

A **mixed-significance entry** — one `range` whose `secondaryPaths` is a _proper_ subset of its
`paths` — is fully expressible through `addRange` and answered correctly by
`isSecondaryAttribution` for exact, prefix and root queries. Both are covered by tests that
construct the shape directly.

No current template produces one. The Stellar generator marks through `EmitOptions.secondary`,
which expands uniformly across an emission's whole path union, so every entry it produces is either
wholly marked or unmarked, and a standing test asserts that across the whole golden matrix. The
mixed shape is therefore **specified and queryable, but not exercised end to end** by a generator
today.

This is stated rather than implied because the alternative reading — "the tests are green, so a
generator must be producing it" — is wrong, and because the obvious way to manufacture a producing
case is a mistake. Splitting an emission so that a display span gets its own range would mark more
finely, but it would change the recorded range set of a file whose output must stay byte-identical.
Coarse and correct beats fine and output-altering. If a future generator needs the mixed shape, it
should reach for `addRange` directly rather than split an emission that already exists.

## Common mistakes

- **Marking the formatter instead of the emission.** The one this page exists for. A formatter
  cannot know which range its output lands in, and in the real generator most of its output lands
  in ranges that determine the deployment.
- **Reading `secondaryPaths` instead of calling `isSecondaryAttribution`.** Both inline shortcuts
  are wrong, in opposite directions, and each one is what a reader writes first.
- **Treating `secondaryPaths: []` as meaningful.** It is not the canonical form. Canonicalise on
  the way in and the distinction never reaches your rendering code.
- **Expecting `{ secondary: true }` to survive a zero-line emission.** Paths are pending across
  `lines([])`; the mark is not.
- **Hiding secondary rows.** Significance ranks; it does not filter. A secondary attribution is a
  true statement that the field reaches those lines, and dropping it silently costs the user
  information they cannot get back from the output.
- **Marking a `file` or `created` entry.** The type forbids it and `isSecondaryAttribution` returns
  `false` for both. A file-level entry claims the file depends on the field, which is a claim about
  the file rather than about a line.
- **Assuming a green golden suite says anything about marks.** Marking changes no generated byte by
  design, so a wrongly marked site is byte-perfect and golden-green — the same trap that applies to
  ranges. See [attribution-hazards.md § Two proofs, not one](./attribution-hazards.md#two-proofs-not-one).

## API Reference

See [api-reference.md § Result helpers](./api-reference.md#result-helpers) for
`isSecondaryAttribution`, [§ Collector](./api-reference.md#collector) for `AddRangeOptions` and
`addRange`, [§ Line attribution](./api-reference.md#line-attribution) for `EmitOptions`, and
[§ Errors](./api-reference.md#errors) for the `secondary-not-attributed` reason.

## See also

- [README.md](./README.md) — what provenance is and how a generator opts in.
- [line-attribution.md](./line-attribution.md) — the emit builders, the emit-site rule, and the
  lint guard. Significance rides on the same emissions; read that page first.
- [attribution-hazards.md](./attribution-hazards.md) — why byte identity and honest attribution are
  independent proofs.
- [integration-guide.md](./integration-guide.md) — adopting the capability and answering field
  queries, including how a consumer ranks by significance.
