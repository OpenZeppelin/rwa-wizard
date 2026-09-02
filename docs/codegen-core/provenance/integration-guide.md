# Provenance — Integration Guide

How to adopt the capability in a generator, compose it through a second generate path, answer
field queries as a consumer, attach line ranges, and prove the adoption is honest. Every snippet
compiles against the package's exported types; the config type is a stand-in you replace with your
own.

Throughout, `MyConfig` is:

```ts
interface MyConfig {
  settings: { name: string; symbol: string; decimals: number };
  members: Array<{ id: string; address: string }>;
  modules: Array<{ id: string; limit?: number }>;
  locked: { policy: string };
}
```

## Pattern 1: Adopt the capability in a generator

The shape every adopting generator follows. Four rules, in order of appearance:

1. **Validate on the raw config**, before any scope exists.
2. **One collector per `generate()` call**, enabled iff the caller asked.
3. **Every emitted file inside its own `createFile` scope**, reading through `scope.config`.
4. **Hash on the raw config**, then attach `collector.result()` only when it is defined.

```ts
import {
  computeConfigHash,
  createProvenanceCollector,
  mergeFileTrees,
} from '@openzeppelin/codegen-core';
import type {
  FileTree,
  GenerateOptions,
  GenerationResult,
  Generator,
  ProvenanceCollector,
  ValidationResult,
} from '@openzeppelin/codegen-core';

// Existing templates keep their signatures. The view is typed as MyConfig, so
// `(config: MyConfig) => string` accepts it unchanged.
function renderManifest(config: MyConfig): string {
  return [`name = "${config.settings.name}"`, `symbol = "${config.settings.symbol}"`].join('\n');
}

function renderMembers(config: MyConfig): string {
  return config.members.map((m) => `${m.id} ${m.address}`).join('\n');
}

function renderModule(config: MyConfig, id: string): string {
  const mod = config.modules.find((m) => m.id === id);
  return `module ${id}: limit=${mod?.limit ?? 'none'}`;
}

export class MyGenerator implements Generator<MyConfig> {
  readonly name = 'my-generator';
  readonly version = '1.0.0';

  validate(config: MyConfig): ValidationResult {
    // Raw read. `locked.policy` will appear in no file's provenance.
    const errors =
      config.locked.policy === ''
        ? [{ field: 'locked.policy', code: 'REQUIRED_FIELD', message: 'policy is required' }]
        : [];
    return { valid: errors.length === 0, errors, warnings: [] };
  }

  generate(config: MyConfig, options?: GenerateOptions): GenerationResult {
    const validation = this.validate(config); // (1) raw
    if (!validation.valid) throw new Error(validation.errors.map((e) => e.message).join('; '));

    const collector = createProvenanceCollector(config, {
      enabled: options?.recordProvenance === true, // (2)
    });

    let files: FileTree = mergeFileTrees(
      collector.createFile('manifest.toml', (s) => renderManifest(s.config)), // (3)
      collector.createFile('members.txt', (s) => renderMembers(s.config))
    );
    files = mergeFileTrees(files, this.generateModuleFiles(collector));

    const result: GenerationResult = {
      files,
      metadata: {
        generatorName: this.name,
        generatorVersion: this.version,
        generatedAt: new Date().toISOString(),
        fileCount: Object.keys(files).length,
        configHash: computeConfigHash(config), // (4) raw
      },
    };
    const provenance = collector.result();
    return provenance === undefined ? result : { ...result, provenance };
  }

  private generateModuleFiles(collector: ProvenanceCollector<MyConfig>): FileTree {
    // A decision made outside any template: which module files exist at all.
    // `observe` records what the decision read without attributing it to a file;
    // the paths become each governed file's `created` entry.
    const enabled = collector.observe((c) => c.modules.map((m) => m.id));

    let files: FileTree = {};
    for (const id of enabled.value) {
      files = mergeFileTrees(
        files,
        collector.createFile(`modules/${id}.txt`, (s) => renderModule(s.config, id), {
          createdBy: enabled.paths,
        })
      );
    }
    return files;
  }
}
```

With `{ recordProvenance: true }`, `modules/<id>.txt` carries a `created` entry with
`['modules', 'modules[0].id', …]` (`modules` because `.map` read the array itself; the `modules[0]`
traversal is pruned) and a `file` entry with what `renderModule` read.
With the flag absent or `false`, the result is byte-identical and has no `provenance` key.

### Why the order matters

The collector attributes a read to a file only when the read went through **that file's**
`scope.config`. Everything else — `validate(config)`, `computeConfigHash(config)`, a direct
`config.x` inside `generate`, a read inside `observe` — attributes to nothing. That is not a
limitation to work around; it is the property that makes the answer honest. A config field that
only a validator consults (a locked control, a policy switch, a feature gate) should appear in no
file's provenance, because changing it changes no file. Whole-run recording — wrapping the entire
`generate()` in one view — makes every file depend on every field the validator touched, and
because bytes do not change, nothing but a provenance test notices.

### Migrating an existing generator

Working through a generator that already emits files with `createFile` / `mergeFileTrees`:

1. Create the collector right after validation: `const collector = createProvenanceCollector(config, { enabled: options?.recordProvenance === true })`.
2. At each emit site, replace `createFile(path, render(config))` with
   `collector.createFile(path, (s) => render(s.config))`. The path literal moves, the template does
   not change.
3. Where a file's existence is decided by config (a loop over enabled modules, a feature toggle),
   wrap the decision in `collector.observe` and pass `.paths` as `createdBy` to the files it
   governs.
4. Check that nothing between the collector's creation and `result()` reads `config` directly for
   the purpose of producing file text. Reads for validation, hashing, and metadata stay on the raw
   object deliberately.
5. Attach `collector.result()` to the returned result when defined.
6. Add the three tests under [Prove your adoption is honest](#prove-your-adoption-is-honest).

Helpers called from inside a template need no change: they receive the view as their config
argument and their reads attribute to the current file. Do **not** call `collector.createFile`
from inside a helper that is itself running inside a scope — that throws
`ProvenanceScopeError('nested')`.

`MyGenerator` above is a stand-in. The shipped example of this shape is the Stellar generator:
[`packages/codegen-rwa-stellar/src/stellar-rwa-generator.ts`](../../../packages/codegen-rwa-stellar/src/stellar-rwa-generator.ts)
is the composition root — one collector created after validation, every emission scoped, per-index
observation for the module files' `createdBy`, and the result attached by conditional spread — and
[`src/templates/identity-support.ts`](../../../packages/codegen-rwa-stellar/src/templates/identity-support.ts)
is the second generate path described in Pattern 2, merging provenance argument-for-argument with
its file trees.

Line-level adoption is a second, larger job on top of this one:
[line-attribution.md § Migrating a template](./line-attribution.md#migrating-a-template) is the
recipe, and [attribution-hazards.md](./attribution-hazards.md) is what that migration got wrong
four times over with every generated byte unchanged. Read it before you start, not after.

## Pattern 2: Compose through a wrapper or second generate path

A generator that offers a second entry point — a variant that re-emits some files and adds
others — records the variant's files with its own collector and merges. Later wins per file key,
wholesale: a re-emitted file's earlier entries described text that no longer exists.

```ts
import {
  createProvenanceCollector,
  hasProvenance,
  mergeFileTrees,
  mergeProvenance,
} from '@openzeppelin/codegen-core';
import type { GenerateOptions, GenerationResult } from '@openzeppelin/codegen-core';

export function generateWithExtras(
  base: (config: MyConfig, options?: GenerateOptions) => GenerationResult,
  config: MyConfig,
  options?: GenerateOptions
): GenerationResult {
  const result = base(config, options); // forwards recordProvenance

  const collector = createProvenanceCollector(config, {
    enabled: options?.recordProvenance === true,
  });
  const extras = mergeFileTrees(
    // Re-emits README.md: its provenance entries are replaced, not merged.
    collector.createFile(
      'README.md',
      ({ config: c }) => `# ${c.settings.name}\n\nDecimals: ${c.settings.decimals}\n`
    ),
    collector.createFile('EXTRAS.txt', ({ config: c }) => `${c.members.length} members\n`)
  );
  const extrasProvenance = collector.result();

  const files = mergeFileTrees(result.files, extras);
  const merged: GenerationResult = {
    ...result,
    files,
    metadata: { ...result.metadata, fileCount: Object.keys(files).length },
  };
  if (!hasProvenance(result) || extrasProvenance === undefined) return merged;
  return { ...merged, provenance: mergeProvenance(result.provenance, extrasProvenance) };
}
```

`mergeProvenance` mirrors `mergeFileTrees`: use it wherever you already merge trees from two
paths, with the same argument order. The base result's `configHash` is untouched — provenance is a
field of the result the hash already identifies, so there is no second hash to keep in sync.

## Pattern 3: Answer "which files depend on this field?"

A consumer — a UI, a CLI, an agent — asks for provenance and filters by the field's path. The
path dialect is the one validation errors already use, so a form field that knows its
`ValidationError.field` already knows its query.

```ts
import {
  filterProvenanceByPath,
  hasProvenance,
  isSecondaryAttribution,
} from '@openzeppelin/codegen-core';
import type { GenerationResult, ProvenanceLineRange } from '@openzeppelin/codegen-core';

export interface FieldImpact {
  filePath: string;
  /** Present for line-level hits; absent for whole-file or existence hits. */
  range?: ProvenanceLineRange;
  reason: 'content' | 'lines' | 'existence';
  /** `true` when these lines only DISPLAY the field's value rather than determine it. */
  secondary: boolean;
}

/**
 * `undefined` — this generator does not record provenance; show no affordance.
 * `[]`        — no generated file depends on the field; say so explicitly.
 */
export function impactOf(result: GenerationResult, fieldPath: string): FieldImpact[] | undefined {
  if (!hasProvenance(result)) return undefined;

  const hits = filterProvenanceByPath(result.provenance, fieldPath);
  const impacts: FieldImpact[] = [];
  for (const [filePath, { entries }] of Object.entries(hits.files)) {
    for (const entry of entries) {
      // Read significance; never derive it. `false` for every non-range entry.
      const secondary = isSecondaryAttribution(entry, fieldPath);
      switch (entry.kind) {
        case 'range':
          impacts.push({ filePath, range: entry.range, reason: 'lines', secondary });
          break;
        case 'created':
          impacts.push({ filePath, reason: 'existence', secondary });
          break;
        case 'file':
          impacts.push({ filePath, reason: 'content', secondary });
          break;
      }
    }
  }
  return impacts;
}
```

Three things a consumer typically layers on top:

- **Rank by significance, do not filter by it.** `isSecondaryAttribution(entry, fieldPath)` is the
  only correct way to ask — a query is a prefix query while a mark is per exact path, so neither
  `entry.secondaryPaths !== undefined` nor `entry.secondaryPaths?.includes(fieldPath)` gives the
  right answer, and they fail in opposite directions. Sort primary hits first and present secondary
  ones as visibly lesser; never drop them, because a secondary hit is still a true statement that
  the field reaches those lines. An entry that arrives without a mark is primary — do not infer
  one. See [significance.md](./significance.md).
- **Canonicalise a mark that crossed a trust boundary.** If provenance arrives as JSON, intersect
  each `secondaryPaths` with the entry's own `paths` and drop the member when the intersection is
  empty. Intersection can only promote to primary, so a malformed mark costs the user nothing;
  rejecting the entry instead would cost them a real attribution.
- **Hide by kind.** A file that serialises the whole config (a `config.json`) legitimately
  records the root path `''` and therefore matches every query. If that is noise for your users,
  drop `file` entries whose `paths` is exactly `['']` at the consumer, not at the generator — the
  generator's record is honest.
- **Narrow untrusted input.** If provenance arrives as JSON from a process you do not control,
  run each entry through `isProvenanceEntry` before switching on `kind`. It never throws and
  returns `false` for unknown kinds, so a newer generator's entry kind degrades to "skipped"
  rather than a crash.

Run the generator once with `recordProvenance: true` and keep the result: the files and their
provenance arrive together, so there is nothing to keep in sync and no second cache to key.

## Pattern 4: Attribute lines with `drain` and `addRange`

> **Prefer a builder.** `createLineBuilder` and `createPatchBuilder` implement this pattern
> correctly — the line arithmetic, the pending-paths handling, and the guards against the
> hoisted-read hazard — and an ESLint rule enforces their one requirement. Reach for raw
> `drain`/`addRange` only when a template's shape fits neither builder. See
> [line-attribution.md](./line-attribution.md).

`scope.drain()` returns the paths read since the previous drain; `scope.addRange` attaches them to
a 1-indexed inclusive line range, optionally with an `AddRangeOptions.secondaryPaths` subset
declaring which of those attributions merely display their value. Together they let a template say which fields produced which
lines. The pattern is: emit a line, drain, record the range.

```ts
import { createProvenanceCollector } from '@openzeppelin/codegen-core';
import type { ProvenanceScope } from '@openzeppelin/codegen-core';

function renderManifestWithLines(scope: ProvenanceScope<MyConfig>): string {
  const c = scope.config;
  const lines: string[] = [];

  const emit = (text: string): void => {
    lines.push(text);
    const paths = scope.drain(); // what this line's construction read
    if (paths.length > 0) scope.addRange({ start: lines.length, end: lines.length }, paths);
  };

  emit(`name = "${c.settings.name}"`); // range 1–1 ← settings.name
  emit(`symbol = "${c.settings.symbol}"`); // range 2–2 ← settings.symbol
  emit(''); // no reads, no range
  emit(`members = ${c.members.length}`); // range 4–4 ← members

  return lines.join('\n');
}

export function manifestWithProvenance(config: MyConfig) {
  const collector = createProvenanceCollector(config, { enabled: true });
  const files = collector.createFile('manifest.toml', renderManifestWithLines);
  return { files, provenance: collector.result() };
}
```

Rules that keep ranges honest:

- Drain **after** constructing the line's text, so the reads land on the line that used them.
  A value computed early and emitted late needs `collector.observe` — compute under `observe`,
  keep the `paths`, and pass them to `addRange` when the line that uses the value is emitted.
- `addRange` validates only the range's shape (`1 <= start <= end`, integers). It cannot check
  the range against the final text, because the text does not exist yet. If your template
  post-processes the joined string (indentation, patching, trailing newline), compute ranges
  against the final line numbering.
- Drained paths are still in the file's `file` entry; `drain` moves a cursor, it does not remove
  anything.
- A drain after `c.settings.name` yields `['settings.name']`: the `settings` step was a traversal
  and is pruned at report time. Do not prune again in a builder; `drain` already reports the
  minimal honest set. A drain after `if (c.settings)` alone yields `['settings']`, because the
  object itself was the dependency.
- Do not `await` inside `produce`. The scope closes when `produce` returns; a read after that
  throws `ProvenanceScopeError('closed')`.

## Prove your adoption is honest

Three tests, all cheap, that every adopting generator should carry. They are the only way to
catch a scoping mistake, because bytes never change.

```ts
import { describe, expect, it } from 'vitest';

import { hasProvenance } from '@openzeppelin/codegen-core';

import { MyGenerator } from './my-generator';
import { createTestConfig } from './test-config';

describe('provenance adoption', () => {
  const generator = new MyGenerator();

  it('recording never changes generated bytes or configHash', () => {
    const on = generator.generate(createTestConfig(), { recordProvenance: true });
    const off = generator.generate(createTestConfig(), { recordProvenance: false });
    const absent = generator.generate(createTestConfig());

    expect(on.files).toEqual(off.files);
    expect(on.files).toEqual(absent.files);
    expect(on.metadata.configHash).toBe(off.metadata.configHash);
    expect('provenance' in off).toBe(false);
    expect('provenance' in absent).toBe(false);
  });

  it('every emitted file is recorded', () => {
    const result = generator.generate(createTestConfig(), { recordProvenance: true });
    if (!hasProvenance(result)) throw new Error('expected provenance');
    expect(Object.keys(result.provenance.files).sort()).toEqual(Object.keys(result.files).sort());
  });

  it('fields consulted only by validation appear in no file', () => {
    const result = generator.generate(createTestConfig(), { recordProvenance: true });
    if (!hasProvenance(result)) throw new Error('expected provenance');
    const allPaths = Object.values(result.provenance.files).flatMap((f) =>
      f.entries.flatMap((e) => e.paths)
    );
    expect(allPaths.some((p) => p === 'locked' || p.startsWith('locked.'))).toBe(false);
  });
});
```

If a generator has a second generate path, run all three against it too. A generator that hashes
a derived object rather than the raw config still passes the first test, provided the derivation
reads the raw config and not a view.

## Common mistakes

- **Reading the raw `config` inside a template.** A template that closes over the outer `config`
  variable instead of using `scope.config` produces the right text and records nothing. The
  coverage test passes (the file has a `file` entry) but its `paths` is empty. Pass the view in;
  do not capture the raw object.
- **Validating or hashing through the view.** `this.validate(scope.config)` or
  `computeConfigHash(scope.config)` inside a scope attributes every field the validator or
  serialiser touched to that file — including locked controls. Both belong outside every scope, on
  the raw object.
- **Wrapping `generate()` in one big scope.** Same failure at larger scale: every file depends on
  everything. One scope per file.
- **Calling `collector.createFile` from a helper that runs inside a scope.** Throws
  `ProvenanceScopeError('nested')` on the first test run, enabled or not. Helpers take the view and
  return text; the caller owns the scope.
- **Returning config slices from `observe`.** `observe((c) => c.modules.filter(...))` returns an
  array of views whose scope has closed; the first `m.id` read in a later template throws
  `ProvenanceScopeError('closed')`. Return ids, primitives, or fresh objects.
- **Mutating or cloning the config in a template.** `scope.config.settings.name = x` throws
  `ProvenanceViewMutationError`; `structuredClone(scope.config)` throws `DataCloneError`. Both are
  latent bugs the recorder makes visible — a template that mutated config was already corrupting
  later files silently.
- **Async `produce`.** `record`/`createFile` are synchronous; a `Promise`-returning `produce`
  passes through, but reads after the first `await` throw `closed`. Do config reads before any
  `await`, or restructure so the scope wraps only synchronous rendering.
- **Reading `result.provenance` without `hasProvenance`.** On a generator that does not record it,
  the field is absent. The type says `ProvenanceResult | undefined`, so TypeScript catches the
  direct read, but the habit to build is the presence test.
- **Treating an absent key as "depends on nothing".** A file key missing from `provenance.files`
  means the generator emitted it outside a scope. "Depends on nothing" is a `file` entry with
  `paths: []`.
- **Computing significance at the consumer.** Reading `secondaryPaths` inline is wrong for prefix
  queries in both directions, and treating an unmarked entry as anything but primary invents a
  demotion the generator never declared. Call `isSecondaryAttribution`.
- **Matching paths with `startsWith`.** `'settings.nameX'.startsWith('settings.name')` is `true`;
  `matchesConfigPath('settings.nameX', 'settings.name')` is `false`. Always use
  `matchesConfigPath` or `filterProvenanceByPath`.
- **Calling `result()` early.** It closes the collector; any later `createFile` throws `closed`.
  Call it once, after the last file.
- **Expecting `Object.isFrozen(view)` to reflect the config.** The view is a `Proxy` over a fresh
  shell and reports `false` even for a frozen config. Freeze checks belong on the raw object.
