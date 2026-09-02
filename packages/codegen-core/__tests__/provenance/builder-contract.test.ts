/**
 * Cross-module obligations for SF-2.
 *
 * These tests cover properties that cannot be proved by one builder's focused
 * suite: the public type contract, exact module-state boundary, scope
 * confinement, error propagation, resource bounds, and browser-safe hygiene.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, expectTypeOf, it } from 'vitest';

import * as publicApi from '../../src/index';
import {
  createLineBuilder,
  createPatchBuilder,
  createProvenanceCollector,
  ProvenanceAttributionError,
  ProvenanceScopeError,
} from '../../src/provenance';
import type {
  LineBuilder,
  LineSink,
  PatchBuilder,
  PatchSink,
  ProvenanceAttributionErrorReason,
  ProvenanceScope,
} from '../../src/provenance';
import type { FixtureConfig } from './builder-fixtures';
import { createSpyScope } from './builder-fixtures';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO_ROOT = join(PACKAGE_ROOT, '..', '..');
const PROVENANCE_DIR = join(PACKAGE_ROOT, 'src', 'provenance');
const BUILDER_MODULES = [
  'builder-registry.ts',
  'line-builder.ts',
  'line-ranges.ts',
  'patch-builder.ts',
] as const;
const BUILDER_TESTS = [
  'builder-contract.test.ts',
  'builder-registry.test.ts',
  'line-builder.test.ts',
  'line-ranges.test.ts',
  'no-early-config-read.test.ts',
  'patch-builder.test.ts',
] as const;

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

function withoutComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('INV-9 / INV-24 — the public builder contract is exact', () => {
  it('sink methods return void and expose only their three emission methods', () => {
    expectTypeOf<keyof LineSink>().toEqualTypeOf<'line' | 'lines' | 'block'>();
    expectTypeOf<keyof PatchSink>().toEqualTypeOf<
      'replaceExact' | 'insertBeforeExact' | 'insertAfterExact'
    >();
    expectTypeOf<ReturnType<LineSink['line']>>().toEqualTypeOf<void>();
    expectTypeOf<ReturnType<LineSink['lines']>>().toEqualTypeOf<void>();
    expectTypeOf<ReturnType<LineSink['block']>>().toEqualTypeOf<void>();
    expectTypeOf<ReturnType<PatchSink['replaceExact']>>().toEqualTypeOf<void>();
    expectTypeOf<ReturnType<PatchSink['insertBeforeExact']>>().toEqualTypeOf<void>();
    expectTypeOf<ReturnType<PatchSink['insertAfterExact']>>().toEqualTypeOf<void>();
  });

  it('builder and error unions contain exactly the designed members', () => {
    expectTypeOf<keyof LineBuilder<FixtureConfig>>().toEqualTypeOf<
      'config' | 'observe' | 'lineCount' | 'text' | keyof LineSink
    >();
    expectTypeOf<keyof PatchBuilder<FixtureConfig>>().toEqualTypeOf<
      'config' | 'observe' | 'current' | 'text' | keyof PatchSink
    >();
    expectTypeOf<ProvenanceAttributionErrorReason>().toEqualTypeOf<
      'reads-before-builder' | 'builder-exists' | 'emit-after-text' | 'secondary-not-attributed'
    >();
  });

  it('folder-private arithmetic and registry helpers are absent from the root barrel', () => {
    expect(publicApi).not.toHaveProperty('regionToLineRange');
    expect(publicApi).not.toHaveProperty('countNewlines');
    expect(publicApi).not.toHaveProperty('bindScope');
    expect(publicApi).not.toHaveProperty('createAttributionCursor');
  });
});

describe('INV-10 / INV-27 — failures stay typed, preserve their origin, and leak no values', () => {
  it('a drain failure and an addRange failure propagate as the same objects', () => {
    const drainSentinel = new Error('drain sentinel');
    const drainBase = createSpyScope();
    let drainCalls = 0;
    const throwingDrain: ProvenanceScope<FixtureConfig> = {
      filePath: drainBase.filePath,
      config: drainBase.config,
      drain() {
        drainCalls += 1;
        if (drainCalls === 1) return [];
        throw drainSentinel;
      },
      addRange: drainBase.addRange,
    };
    const drainBuilder = createLineBuilder(throwingDrain);
    let caughtDrain: unknown;
    try {
      drainBuilder.line('x');
    } catch (error) {
      caughtDrain = error;
    }
    expect(caughtDrain).toBe(drainSentinel);

    const rangeSentinel = new RangeError('range sentinel');
    const rangeBase = createSpyScope();
    const throwingRange: ProvenanceScope<FixtureConfig> = {
      filePath: rangeBase.filePath,
      config: rangeBase.config,
      drain: rangeBase.drain,
      addRange() {
        throw rangeSentinel;
      },
    };
    const rangeBuilder = createLineBuilder(throwingRange);
    rangeBase.read('settings.name');
    let caughtRange: unknown;
    try {
      rangeBuilder.line('x', ['settings.name']);
    } catch (error) {
      caughtRange = error;
    }
    expect(caughtRange).toBe(rangeSentinel);
  });

  it('all attribution reasons expose the stable code and omit emitted config values', () => {
    const secret = 'SECRET-CONFIG-VALUE';
    for (const reason of [
      'reads-before-builder',
      'builder-exists',
      'emit-after-text',
    ] satisfies readonly ProvenanceAttributionErrorReason[]) {
      const error = new ProvenanceAttributionError(reason, 'templates/output.txt', [
        'settings.name',
      ]);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ProvenanceAttributionError');
      expect(error.code).toBe('PROVENANCE_ATTRIBUTION');
      expect(error.reason).toBe(reason);
      expect(error.message).toContain('templates/output.txt');
      expect(error.message).not.toContain(secret);
    }
  });
});

describe('INV-14 — a hoisted read can travel honestly through observe()', () => {
  it('attributes an observed value to the later emitting line under a real collector', () => {
    const collector = createProvenanceCollector({ message: 'derived early' }, { enabled: true });
    const text = collector.record('templates/observed.txt', (scope) => {
      const builder = createLineBuilder(scope);
      const observed = builder.observe((config) => config.message);
      builder.line('header');
      builder.line(observed.value, observed.paths);
      return builder.text();
    });
    const entries = collector.result()?.files['templates/observed.txt']?.entries ?? [];
    const ranges = entries.filter((entry) => entry.kind === 'range');

    expect(text).toBe('header\nderived early');
    expect(ranges).toEqual([{ kind: 'range', range: { start: 2, end: 2 }, paths: ['message'] }]);
  });
});

describe('INV-18 / INV-20 — module state is exactly one weak claim registry', () => {
  it('builder-registry has exactly one module-level declaration and it is a WeakSet', () => {
    const registry = withoutComments(source(join(PROVENANCE_DIR, 'builder-registry.ts')));
    const moduleDeclarations = registry.match(/^(?:export\s+)?(?:const|let|var)\s+.*$/gm) ?? [];
    expect(moduleDeclarations).toEqual(['const claimedScopes = new WeakSet<object>();']);

    for (const file of ['line-builder.ts', 'line-ranges.ts', 'patch-builder.ts']) {
      const code = withoutComments(source(join(PROVENANCE_DIR, file)));
      expect(
        code.match(/^(?:export\s+)?(?:const|let|var)\s+.*$/gm) ?? [],
        `${file} must not declare module-held mutable state`
      ).toEqual([]);
    }
  });

  it('interleaved line and patch builders produce the same per-scope transcripts as solo runs', () => {
    const runLine = () => {
      const scope = createSpyScope();
      const builder = createLineBuilder(scope);
      scope.read('line');
      builder.line('LINE');
      builder.text();
      return scope.calls;
    };
    const runPatch = () => {
      const scope = createSpyScope();
      const builder = createPatchBuilder(scope, 'before\nMARK\nafter');
      scope.read('patch');
      builder.insertAfterExact('MARK', '\nPATCH');
      builder.text();
      return scope.calls;
    };

    const lineScope = createSpyScope();
    const patchScope = createSpyScope();
    const line = createLineBuilder(lineScope);
    const patch = createPatchBuilder(patchScope, 'before\nMARK\nafter');
    lineScope.read('line');
    line.line('LINE');
    patchScope.read('patch');
    patch.insertAfterExact('MARK', '\nPATCH');
    line.text();
    patch.text();

    expect(lineScope.calls).toEqual(runLine());
    expect(patchScope.calls).toEqual(runPatch());
  });
});

describe('INV-21 — scopes confine reads and ranges to one file', () => {
  it('two real file scopes cannot read or attribute through each other', () => {
    const collector = createProvenanceCollector({ left: 'L', right: 'R' }, { enabled: true });
    let firstScope: ProvenanceScope<{ left: string; right: string }> | undefined;

    collector.record('left.txt', (scope) => {
      firstScope = scope;
      const builder = createLineBuilder(scope);
      builder.line(builder.config.left);
      return builder.text();
    });
    if (firstScope === undefined) throw new Error('test setup failed to capture the first scope');
    const closedFirstScope = firstScope;

    collector.record('right.txt', (scope) => {
      expect(() => closedFirstScope.config.left).toThrow(ProvenanceScopeError);
      const builder = createLineBuilder(scope);
      builder.line(builder.config.right);
      return builder.text();
    });

    const files = collector.result()?.files;
    expect(files?.['left.txt']?.entries.flatMap((entry) => entry.paths)).toEqual(['left', 'left']);
    expect(files?.['right.txt']?.entries.flatMap((entry) => entry.paths)).toEqual([
      'right',
      'right',
    ]);
  });
});

describe('INV-25 / INV-26 — cost and file-shape bounds', () => {
  it('line emission never scans accumulated text and joins the element array only in text()', () => {
    const code = withoutComments(source(join(PROVENANCE_DIR, 'line-builder.ts')));
    expect(code.match(/elements\.join\(separator\)/g)).toHaveLength(1);
    expect(code).not.toMatch(/elements\.(?:slice|map|reduce|forEach|indexOf|includes|filter)\(/);
    expect(code).not.toMatch(/\.split\(/);
  });

  it('accepts a 1 MiB block without changing one byte and attributes its full content range', () => {
    const block = 'x\n'.repeat(512 * 1024);
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    scope.read('large');
    builder.block(block);

    expect(builder.text()).toBe(block);
    expect(scope.ranges).toEqual([{ range: { start: 1, end: 512 * 1024 }, paths: ['large'] }]);
  });

  it('keeps 5,000 same-path emissions as 5,000 distinct ranges', () => {
    const scope = createSpyScope();
    const builder = createLineBuilder(scope);
    for (let index = 0; index < 5_000; index += 1) {
      scope.read('shared');
      builder.line(`line-${index}`);
    }
    builder.text();

    expect(scope.ranges).toHaveLength(5_000);
    expect(scope.ranges[0]?.range).toEqual({ start: 1, end: 1 });
    expect(scope.ranges[4_999]?.range).toEqual({ start: 5_000, end: 5_000 });
  });
});

describe('INV-28 / INV-29 / INV-30 — portability and source hygiene', () => {
  it('a non-RWA config uses both builders through the public API', () => {
    const collector = createProvenanceCollector(
      { greeting: 'hello', replacement: 'WORLD' },
      { enabled: true }
    );
    const lineText = collector.record('generic.txt', (scope) => {
      const builder = createLineBuilder(scope);
      builder.line(builder.config.greeting);
      return builder.text();
    });
    const patchText = collector.record('generic.patch', (scope) => {
      const builder = createPatchBuilder(scope, 'hello TARGET');
      builder.replaceExact('TARGET', builder.config.replacement);
      return builder.text();
    });
    const files = collector.result()?.files;

    expect(lineText).toBe('hello');
    expect(patchText).toBe('hello WORLD');
    expect(files?.['generic.txt']?.entries[1]).toEqual({
      kind: 'range',
      range: { start: 1, end: 1 },
      paths: ['greeting'],
    });
    expect(files?.['generic.patch']?.entries[1]).toEqual({
      kind: 'range',
      range: { start: 1, end: 1 },
      paths: ['replacement'],
    });
  });

  it('builder modules and tests use no unsafe casts, disables, Node APIs, or post-ES2020 methods', () => {
    const unsafeTypePattern = new RegExp(
      '\\bas\\s+' + 'any\\b|:\\s*' + 'any\\b|eslint-' + 'disable'
    );
    for (const file of BUILDER_MODULES) {
      const text = source(join(PROVENANCE_DIR, file));
      const code = withoutComments(text);
      expect(code, file).not.toMatch(unsafeTypePattern);
      expect(code, file).not.toMatch(
        /from ['"]node:|\bprocess\.|\bglobalThis\b|Object\.hasOwn\(|\.replaceAll\(|\.at\(/
      );
    }
    for (const file of BUILDER_TESTS) {
      const text = source(join(PACKAGE_ROOT, '__tests__', 'provenance', file));
      expect(text, file).not.toMatch(unsafeTypePattern);
    }
  });

  it('the guard has no I/O or chain vocabulary, while RWAConfig appears only in repo configuration', () => {
    const rule = withoutComments(
      source(join(REPO_ROOT, '.eslint', 'rules', 'no-early-config-read.cjs'))
    );
    expect(rule).not.toMatch(
      /\bconsole\.|\blogger\b|\bprocess\.|setTimeout|setInterval|from ['"]node:/
    );
    for (const word of ['stellar', 'soroban', 'evm', 'RWAConfig', 'wizard']) {
      expect(rule.includes(word), `guard contains "${word}"`).toBe(false);
    }
    expect(source(join(REPO_ROOT, 'eslint.config.cjs'))).toContain("configTypes: ['RWAConfig']");
  });
});

// ---------------------------------------------------------------------------
// INV-13 — nothing is logged; the builders and the guard have no I/O
// ---------------------------------------------------------------------------

describe('INV-13 — no logging and no I/O in the provenance source or the guard', () => {
  it('every provenance module and every guard rule is free of logging, timers, and I/O', () => {
    // A misattribution the guard cannot prove is an error or nothing — never a
    // warning. `.eslint/utils.cjs` is pre-existing repo tooling outside this
    // invariant's scope (`src/provenance/**` and `.eslint/rules/**`).
    const ioPattern =
      /\bconsole\s*\.|\blogger\s*\.|\bprocess\s*\.|\bset(?:Timeout|Interval|Immediate)\s*\(|\bqueueMicrotask\s*\(|['"]node:|\brequire\s*\(\s*['"](?:fs|path|os|child_process|http|https)['"]/;

    const audited: Array<readonly [string, string]> = [];
    for (const file of readdirSync(PROVENANCE_DIR).filter((name) => name.endsWith('.ts'))) {
      audited.push([`src/provenance/${file}`, source(join(PROVENANCE_DIR, file))] as const);
    }
    const rulesDir = join(REPO_ROOT, '.eslint', 'rules');
    for (const file of readdirSync(rulesDir).filter((name) => name.endsWith('.cjs'))) {
      audited.push([`.eslint/rules/${file}`, source(join(rulesDir, file))] as const);
    }
    audited.push([
      '.eslint/plugin-provenance.cjs',
      source(join(REPO_ROOT, '.eslint', 'plugin-provenance.cjs')),
    ] as const);

    // guard the directory reads themselves: an empty sweep must not pass vacuously
    const auditedNames = audited.map(([label]) => label);
    for (const module of BUILDER_MODULES) {
      expect(auditedNames, 'builder module missing from the I/O sweep').toContain(
        `src/provenance/${module}`
      );
    }
    expect(auditedNames).toContain('.eslint/rules/no-early-config-read.cjs');
    expect(auditedNames).toContain('.eslint/plugin-provenance.cjs');

    const offenders = audited.flatMap(([label, text]) =>
      withoutComments(text)
        .split('\n')
        .map((line, index) => ({ text: line.trim(), number: index + 1 }))
        .filter((entry) => ioPattern.test(entry.text))
        .map((entry) => `${label}:${entry.number} ${entry.text}`)
    );
    expect(offenders, 'logging or I/O reached provenance source or the guard').toEqual([]);
  });
});
