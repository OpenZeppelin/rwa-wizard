# Line Attribution

> Emit builders that record which config fields produced which **lines** of a generated file —
> computed from the text the builder is about to produce, never by searching the output
> afterwards.

The collector in [README.md](./README.md) answers "which fields did this file read?". The
builders on this page answer the sharper question: "which fields produced _line 47_?" They are for
whoever writes the next generator — a chain package, a CLI, an agent — and they are the API every
template in a provenance-recording generator is written against.

Everything here is additive. A generator that does not use a builder keeps working, and a builder
bound to a disabled collector runs the identical control flow and records nothing.

## The one rule

**A config read must happen at the emit site, not before it.**

A builder attributes each emission to the paths read _since the previous emission_. It has no
other information: it sees strings going out and path names coming back from the recorder, and it
cannot know that a string you handed it was built from a field you read twenty lines earlier. So a
value read early and emitted late is attributed to whichever line was current **when the read
happened** — not to the line it actually shapes.

That is the whole design, and everything below is a consequence of it.

```ts
const b = createLineBuilder(scope);

b.line('#!/bin/bash'); // line 1 — no reads, no range
b.line('set -e'); // line 2 — no reads, no range
b.line(`ADMIN="${b.config.roles.admin}"`); // line 3 ← roles.admin
```

The read of `roles.admin` sits inside the template literal, so it happens while the argument to
`line` is being evaluated — after emission 2 and before emission 3. It lands on line 3, which is
the line it produced.

## Quick Start

```ts
import { createLineBuilder, createProvenanceCollector } from '@openzeppelin/codegen-core';
import type { FileTree, ProvenanceResult, ProvenanceScope } from '@openzeppelin/codegen-core';

interface ScriptConfig {
  roles: { admin: string; manager: string };
  deployment: { target: string };
  modules: Array<{ id: string; enabled: boolean }>;
}

function renderDeployScript(scope: ProvenanceScope<ScriptConfig>): string {
  const b = createLineBuilder(scope);

  b.line('#!/bin/bash');
  b.line('set -e');
  b.line('');
  b.line(`ADMIN="${b.config.roles.admin}"`);
  b.line(`MANAGER="${b.config.roles.manager}"`);
  b.line(`NETWORK="${b.config.deployment.target}"`);

  for (const module of b.config.modules) {
    if (!module.enabled) continue;
    b.line(`deploy_module "${module.id}"`);
  }

  return b.text();
}

export function generate(config: ScriptConfig): {
  files: FileTree;
  provenance: ProvenanceResult | undefined;
} {
  const collector = createProvenanceCollector(config, { enabled: true });
  const files = collector.createFile('scripts/deploy.sh', renderDeployScript);
  return { files, provenance: collector.result() };
}
```

The recorded ranges say exactly what a reader would say by eye:

```jsonc
{
  "scripts/deploy.sh": {
    "entries": [
      {
        "kind": "file",
        "paths": [
          "deployment.target",
          "modules",
          "modules[0].enabled",
          "modules[0].id",
          "roles.admin",
          "roles.manager",
        ],
      },
      { "kind": "range", "range": { "start": 4, "end": 4 }, "paths": ["roles.admin"] },
      { "kind": "range", "range": { "start": 5, "end": 5 }, "paths": ["roles.manager"] },
      { "kind": "range", "range": { "start": 6, "end": 6 }, "paths": ["deployment.target"] },
      {
        "kind": "range",
        "range": { "start": 7, "end": 7 },
        "paths": ["modules", "modules[0].enabled", "modules[0].id"],
      },
    ],
  },
}
```

Lines 1–3 carry no range: nothing was read to produce them, and a range is recorded only when an
emission has at least one path. The loop's own reads — `modules`, and the `enabled` test that
decided this iteration emits at all — ride the line the iteration produced, which is the honest
answer to "why is this line here?".

## Why you will get this wrong the first time

Because the shape that breaks the rule is the shape existing generator code is already written in.
Here is the opening of `generateDeploySh`, the largest template in the shipped Stellar generator,
lightly trimmed:

```ts
export function generateDeploySh(
  config: RWAConfig,
  options?: DeployScriptGenerationOptions
): string {
  const deployment = resolveStellarDeploymentTarget(config.deployment.target);
  const networkFlag = deployment.networkFlag;
  const adminAddress = getAdminAddress(config);
  const managerAddress = getManagerDeploymentAddress(config);
  const wasmCrateNames = getDeploymentCrateNames(config);
  const sections: string[] = [];

  sections.push('#!/bin/bash');
  sections.push('set -e');
  // …200 more pushes, using the values read above

  return sections.join('\n');
}
```

Every config read is hoisted to the top of the function, hundreds of lines above the emissions
they shape. This is normal, readable TypeScript. It is also precisely the arrangement the builder
cannot attribute, and you should expect to meet it in every template you migrate.

There are two failure modes, and they are not equally forgiving:

**Reads above the builder — throws.** The builder must be the first thing that touches its scope.
Its constructor drains the scope, and if anything was read before, it refuses to build:

```
ProvenanceAttributionError: Config was read before the builder for "scripts/deploy.sh" existed:
[deployment.target, roles.admin]. Create the builder first and compute config-derived values with
builder.observe(...).
```

This one is loud, names the file, names the paths, and fails on the first test run whether or not
recording is enabled. You cannot ship it by accident.

**Reads below the builder, used after an emission — silent.** Move `createLineBuilder` to the top
of the function and the throw goes away, but the misattribution does not:

```ts
const b = createLineBuilder(scope);
const adminAddress = b.config.roles.admin; // read here…

b.line('#!/bin/bash'); // …so roles.admin is attributed to LINE 1
b.line('set -e');
b.line(`ADMIN="${adminAddress}"`); // the line it actually shapes carries nothing
```

The generated bytes are identical. The file entry is identical. Only the _ranges_ are wrong, and
nothing at runtime can tell — the builder has no way to know that `adminAddress` came from config
rather than from a literal. Clicking `roles.admin` in the wizard would highlight the shebang.

That is the gap the ESLint rule exists to close.

## The guard: `provenance/no-early-config-read`

A syntactic ESLint rule, already wired into `pnpm lint` for every codegen package's `src/`:

```js
// eslint.config.cjs
const provenancePlugin = require('./.eslint/plugin-provenance.cjs');

module.exports = [
  // …
  {
    files: ['packages/codegen-*/src/**/*.ts'],
    plugins: { provenance: provenancePlugin },
    rules: {
      'provenance/no-early-config-read': ['error', { configTypes: ['RWAConfig'] }],
    },
  },
];
```

It needs no type information and no `parserOptions.project`. Builders are recognised by the core
factory and type names (`createLineBuilder`, `createPatchBuilder`, `LineBuilder`, `LineSink`,
`PatchBuilder`, `PatchSink`, `ProvenanceScope`); the config types a generator threads through its
own helpers are named per package via `configTypes`, which is what keeps the rule chain-agnostic.
In a file with no builder the rule is inert.

It reports three things. Run it on the broken `deploy.sh` shape above and you get, verbatim:

```
packages/codegen-core/src/generate-deploy-sh.ts
   6:34  error  Config is read here, before the builder declared on line 10 exists; these reads
                are attributed to whatever that builder emits first. Move the read below the
                builder, or into its observe(...)
   7:9   error  "adminAddress" is derived from config at line 7 and used after an intervening
                emission at line 11; the read will be attributed to the wrong line. Compute it
                with b.observe(...) and pass .paths to the emitting call
  21:3   error  "admin.value" shapes this emission but "admin.paths" is not passed to it; the
                lines it produces would carry none of the config paths it was computed from
```

Each report names the file, the line, the offending binding, and the emission that intervened.
The third fires when you reached for `observe` but forgot to hand the emission its paths — the
one way to use the escape hatch and still lose the attribution.

The fix is always one of three moves: **inline the read into the emitting call**, **move the read
below the builder**, or — when the value genuinely has to be computed once and used several times
— **route it through `observe`**.

### What counts as an emission

Two things, and the second is easy to miss. The obvious one is a builder's own emit method —
`line`, `lines`, `block`, `replaceExact`, `insertBeforeExact`, `insertAfterExact`. The other is
**a call that hands the builder to a helper**: the helper emits through it, so the boundary is at
the call site even though no emit method is named there.

```ts
const patcher = createPatchBuilder(scope, upstream);
const decimals = patcher.config.token.decimals; // read here…
applyAllPatches(patcher, patcher.config); // …every edit happens in here…
patcher.replaceExact('x', String(decimals)); // …and the read landed on the first of them
```

This matters most for patch-based contract templates, which typically delegate _every_ edit to a
helper family and emit nothing directly. Treating only the direct calls as boundaries leaves such
a file with no boundary at all, so nothing hoisted above the delegation can be reported — the
guard is loaded, running, and structurally unable to see the file's only hazard. `rwa-token.ts`
was in exactly that state until the operator-role address mis-attribution was traced back to it.

The corollary is that a helper taking a `LineSink`/`PatchSink` is a boundary for its caller, which
is the correct reading: threading the sink is what makes each line land where it is written, and
the value hoisted past the threading is still hoisted.

### Reads inside `observe` do not taint their binding

The taint analysis does not descend into a `<builder>.observe(...)` callback. Whatever such a
callback reads is recorded against the value it returns, and the returned `Observed` carries its
own paths, so a binding is not config-derived merely because an observe nested inside its
initialiser touches config:

```ts
// Not a hoist: an array of Observed, each carrying its own paths.
const tokenGuards = GUARD_PATCHES.map((patch) =>
  patcher.observe((config) => buildAccessAttribute(config, patch.aliases, 'operator'))
);
```

Without this exemption the rule is also vulnerable to a name collision: it has no scope analysis,
so an unannotated `(config) => …` callback parameter would be taken for the file's real
`config: RWAConfig` parameter and taint anything built from it.

### Loop variables are not hoists

`for (const module of b.config.modules)` binds a live element view, not a hoisted value. Every
`module.id` read inside the body records at the moment it happens, so the rule exempts it by
design. An _alias_, though — `const roles = b.config.roles` — is not exempt, even though
`roles.admin` reads lazily: reading the `roles` object is itself a dependency, and it lands on
whatever emission is current at the alias. Inline it or `observe` it.

## `observe`: holding a value across an emission

`observe` runs a computation under the recording view, returns the value **and** the paths it
read, and attributes them to nothing on its own. You then pass those paths to every emission the
value shapes.

```ts
function renderSummary(scope: ProvenanceScope<ScriptConfig>): string {
  const b = createLineBuilder(scope);

  // Computed once, used on two separate lines.
  const enabled = b.observe((c) => c.modules.filter((m) => m.enabled).map((m) => m.id));

  b.line('# Deployment summary');
  b.line(`# ${enabled.value.length} module(s) enabled`, enabled.paths);
  b.line('');
  b.line(`MODULES="${enabled.value.join(' ')}"`, enabled.paths);

  return b.text();
}
```

Both lines carry the module paths, because both lines genuinely depend on them. `extraPaths` is a
**union**, never a replacement — an emission that interpolates a live read _and_ an observed value
records both.

Return primitives, ids, or fresh objects from `observe`. Returning a slice of the config hands
back views whose scope has closed; the first read on one throws `ProvenanceScopeError('closed')`.

## Marking an emission secondary

Every emission takes an optional third argument. Today it carries one member:

```ts
b.line(`ADMIN="${b.config.roles.admin}"`); // primary — determines the deployment
b.line(`  echo "Example: ${example}"`, adminPaths, { secondary: true }); // displays it
```

`secondary: true` marks **every** path the emission attributes — those drained since the previous
emission, the pending window, and `extraPaths` — as displayed rather than determining. Absence
means primary, and only the literal `true` marks.

The mark rides the same call as the range and the path union, and that is the point. It is
**never pending**: `lines([])` carries its paths to the next emission that produces bytes but
discards the mark, because a zero-line emission has no range to be secondary about. And an
emission whose path union is empty records no entry, so `{ secondary: true }` never brings an
entry into existence.

The consequence for template authors is the rule worth remembering: **mark at the emission, never
at the helper that formats the text.** A formatter cannot know which range its output lands in,
and in a real generator most of it lands in ranges that determine the deployment. Wrap the
formatter and the emission into one function instead. See
[significance.md](./significance.md) for the full argument and the real range a helper-level mark
would have demoted.

## The patch builder

For files produced by patching upstream source text rather than by emitting lines. It wraps the
three exact-match primitives one-for-one, so the bytes are unchanged:

```ts
import { createPatchBuilder } from '@openzeppelin/codegen-core';
import type { ProvenanceScope } from '@openzeppelin/codegen-core';

function patchToken(scope: ProvenanceScope<ScriptConfig>, upstream: string): string {
  const p = createPatchBuilder(scope, upstream);

  p.replaceExact('__ADMIN__', p.config.roles.admin);
  p.insertAfterExact(
    'use crate::prelude;',
    `\nconst NETWORK: &str = "${p.config.deployment.target}";`
  );

  return p.text();
}
```

`text()` is byte-identical to calling `replaceExact` / `insertAfterExact` in the same order on the
same source. The replacement-pattern semantics of the underlying functions are untouched, `$&`
included.

What differs from the line builder:

- **Regions, not lines.** Each edit is tracked as a byte region of the _current_ text and shifted
  by every later edit. Regions become line ranges once, at `text()`, resolved against the final
  text — so an edit near the top that pushes everything down does not invalidate the ranges
  recorded for edits below it.
- **Upstream lines carry no attribution.** Only bytes this builder wrote are attributed. Lines
  that came from the source text and were never touched appear in no range.
- **A replacement is attributed even when the bytes do not change.** `p.replaceExact(x, x)`
  records a region. This is deliberate: a guard line that reads `accessControl.mode` and happens
  to match upstream still _depends_ on `accessControl.mode`, and skipping the call would lose
  that.
- **Inserts exclude the marker** when the written piece carries it verbatim — only the inserted
  bytes are attributed, not the marker they anchor to.
- **`current`** is the text after every edit so far, as a plain string. Reading it records
  nothing.
- **A missing snippet throws before any state moves.** `replaceExact` fails fast on an absent
  search string, and the builder's regions and text are exactly as they were.

## What the builders promise — and what they don't

The details in this section decide whether a migration preserves bytes. Read them before
converting a template.

**`text()` is `elements.join(separator)`.** Nothing more. The builder adds attribution to bytes it
never touches; it does not normalise, trim, reindent, or append a trailing newline.

**The separator is not inferred — pass it explicitly.** It defaults to `'\n'`. A template that
joined its parts with anything else must say so, or the output changes:

```ts
// was: parts.join(' \\\n  ')
const b = createLineBuilder(scope, { separator: ' \\\n  ' });
```

**`line` and `block` are the same operation.** `block` is `line` with a name that says the text is
expected to span several lines. There is no behavioural difference, and `line` accepts embedded
`'\n'` perfectly well. Use whichever reads better at the call site.

**`lines()` records one range for the whole array.** Not one per element. The paths were read
before the call, so the builder has no per-element information and will not invent any. If you
need per-line rows, thread the `LineSink` into the helper and let it emit line by line — that is
byte-identical and gives true per-line granularity.

**An empty array emits nothing and leaves paths pending.** `lines([])` pushes no element and
records no range, but the paths read since the previous emission are _not_ discarded — they move
to pending and attribute to the next emission that produces bytes. A conditional that read config
and emitted nothing has influenced what comes next, not what came before.

**`lineCount` is what `text()` would have now** — `0` before the first emission, and it counts
lines, so three single-line emissions with the default separator give `3`.

**A range is recorded only when the path union is non-empty.** Emissions that read nothing produce
no `range` entry at all, rather than an entry with empty paths.

**Nothing is pruned, filtered, reordered-with-loss, or invented.** Every string handed to a
builder comes back out. The pruning that turns `settings` + `settings.name` into just
`settings.name` already happened in the recorder, per window, before the builder ever sees a
string.

**`text()` seals the builder.** It is idempotent and memoised; any emission, patch, or `observe`
after it throws `emit-after-text`, because it would describe lines the returned text does not
have. Paths still pending at `text()` attribute to nothing — they cannot have shaped bytes that
were already fixed — but they remain in the file's `file` entry.

**One builder per scope.** A second `createLineBuilder` or `createPatchBuilder` on the same scope
throws `builder-exists`. Two builders would split the drain and misattribute silently.

**Ranges carry paths and positions, never config values.** So do the error messages and the lint
reports.

**Any separator, any terminator convention, any emission size.** No file shape is assumed.
`'\r\n'` counts as one terminator, through its `'\n'`. A range covers the lines holding at least
one character other than `'\n'`/`'\r'`; an emission of only terminators attributes to the single
line it starts on, so a `block` ending in `'\n'` does not claim the blank line after it.

## Migrating a template

The recipe, in the order that keeps each step checkable:

1. **Take the scope, not the config.** Change the signature from `(config: MyConfig)` to
   `(scope: ProvenanceScope<MyConfig>)`, and create the builder as the very first statement.
   Anything left reading `config` above it now throws with the paths named.
2. **Replace the accumulator.** `const sections: string[] = []` becomes the builder;
   `sections.push(x)` becomes `b.line(x)`; `sections.push(...xs)` becomes `b.lines(xs)`;
   `sections.join(sep)` becomes `b.text()` with `{ separator: sep }` if `sep` is not `'\n'`.
3. **Push the hoisted reads down to their emit sites.** This is the bulk of the work and the whole
   point. `pnpm lint` names every remaining one with a file, a line, and the intervening emission.
4. **Route what genuinely can't move through `observe`.** A value used on several lines, or one
   that costs real work, is computed once with `observe` and passed as `extraPaths` to each
   emission it shapes. The guard's third message catches a `.value` used without its `.paths`.
5. **Give helpers a `LineSink` or `PatchSink`, not the builder.** A sink exposes only the emission
   methods — no `config`, no `observe`, no `text`. A helper that needs config takes it as an
   explicit parameter, which is exactly what makes its reads visible to the guard through
   `configTypes`.
6. **Prove the bytes did not move.** The migration is only correct if `text()` equals the previous
   `join`, character for character. Assert that against the pre-migration output before trusting
   any range.
7. **Prove the attribution is honest, separately.** Byte identity says nothing about whether a range
   holds the lines its field determines — recording never changes output, so every attribution bug
   is byte-neutral and golden-green. See
   [attribution-hazards.md](./attribution-hazards.md#two-proofs-not-one).

### Worked examples

The Stellar generator's templates are migrated, byte-frozen against goldens, and readable end to
end. Two of them cover both builders:

- **A push/join script.**
  [`packages/codegen-rwa-stellar/src/templates/scripts/deploy-sh.ts`](../../../packages/codegen-rwa-stellar/src/templates/scripts/deploy-sh.ts)
  — the largest template in the generator, and the one whose pre-migration opening is quoted in
  [Why you will get this wrong the first time](#why-you-will-get-this-wrong-the-first-time). It
  shows the builder created before the seven bindings that used to be hoisted, `observe` for values
  reused across lines, per-index observation of a config array, and a `LineSink` threaded into
  helpers ([`deploy-sh-post-deploy.ts`](../../../packages/codegen-rwa-stellar/src/templates/scripts/deploy-sh-post-deploy.ts)).
- **A patched contract source.**
  [`packages/codegen-rwa-stellar/src/templates/contracts/rwa-token.ts`](../../../packages/codegen-rwa-stellar/src/templates/contracts/rwa-token.ts)
  — upstream Rust patched for decimals, configured roles and optional document-manager support. It
  shows one `observe` per method guard rather than one for all of them, and a conditional edit that
  still carries the paths consulted to decide it.

Both keep their pre-migration `(config) => string` export by delegating through a disabled
collector, so existing callers and unit tests are untouched while the template has exactly one
implementation. [attribution-hazards.md § Worked examples](./attribution-hazards.md#worked-examples)
is a guided read of both, and the rest of that page is the four mis-attribution classes this
migration produced.

## Common mistakes

- **Hoisting reads to the top of the template.** The default shape of existing code and the reason
  the guard exists. Reads above the builder throw; reads below it, used after an emission, are
  silent until `pnpm lint` runs.
- **Aliasing a config object.** `const roles = b.config.roles` attributes `roles` to whatever is
  current at the alias, and under prefix matching that line then answers a `roles.admin` query it
  has nothing to do with. Inline the read or `observe` it.
- **Looping over a config array with `for…of`.** The iterator's final read fires _after_ the last
  body emission and drains onto whatever comes next — usually the following section's heading.
  Index against a count you observed instead. The three sibling hazards, each reproduced runnably,
  are in [attribution-hazards.md](./attribution-hazards.md#the-hazard-catalogue).
- **Giving a possibly-empty span its own paths.** An interpolation that renders `''` on some
  configurations contributes no characters but still hands the block its paths, so the range lands
  on the neighbours. Contribute the paths only when the span holds a character other than `'\n'` or
  `'\r'` — and check _every_ possibly-empty span in the block, not just the first.
- **Building a descriptor to read one constant off it.** Recording sees property reads, not intent:
  a helper that assembles a rich object is a dependency on every field it consulted, even if you
  use one config-free member of the result.
- **Using `observe(...).value` without passing `.paths`.** The lines the value shapes carry none of
  the config paths it came from — an emission that silently depends on nothing. Caught by the
  guard.
- **Marking a formatter instead of an emission.** A helper that returns display text has no idea
  which range its output will land in. Mark at the `sink` call. See
  [significance.md § Mark at the emission, never at a helper](./significance.md#mark-at-the-emission-never-at-a-helper).
- **Expecting `{ secondary: true }` to survive `lines([])`.** Paths are pending across a zero-line
  emission; the mark is not.
- **Expecting `lines(array)` to give one range per element.** It gives one range covering all of
  them. Thread a `LineSink` into the helper if you need per-line rows.
- **Forgetting a non-default separator.** The one migration mistake that changes bytes. Everything
  else on this list changes only attribution.
- **Assuming `lines([])` discards its pending reads.** It carries them to the next emission that
  produces bytes.
- **Emitting after `text()`.** Throws `emit-after-text`. Build the whole file, then seal it once.
- **Binding two builders to one scope.** Throws `builder-exists`. One file, one builder.
- **Skipping a byte-identical replacement in a patch.** An early return on "the configured value
  already matches upstream" loses a real dependency. Call `replaceExact(x, x)` unconditionally.
- **Trusting ranges without a byte-equality test.** Recording never changes output, so a migration
  that broke the text is a bug the provenance data will not reveal.

## API Reference

See [api-reference.md § Line attribution](./api-reference.md#line-attribution) for every exported
type and function, [§ Errors](./api-reference.md#errors) for `ProvenanceAttributionError`, and
[significance.md](./significance.md) for `EmitOptions.secondary` and the primary/secondary axis.
