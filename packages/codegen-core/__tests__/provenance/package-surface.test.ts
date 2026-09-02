/**
 * Package-level properties of `provenance/`: source hygiene, chain-agnosticism,
 * browser safety, build output, strict typing.
 * INV-11, INV-29, INV-30, INV-31, INV-32, INV-33.
 * Category: Performance, Scalability & Re-usability (portability).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, expectTypeOf, it } from 'vitest';

import * as barrel from '../../src/index';
import { createConfigRecorder } from '../../src/provenance/config-recorder';
import type { ProvenanceEntry } from '../../src/provenance/types';
import type { GenerateOptions, GenerationResult, Generator } from '../../src/types';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROVENANCE_DIR = join(PACKAGE_ROOT, 'src', 'provenance');
const DIST_DIR = join(PACKAGE_ROOT, 'dist');

/** Source with block/line comments removed, so JSDoc prose never counts as code. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const sourceFiles = readdirSync(PROVENANCE_DIR)
  .filter((name) => name.endsWith('.ts'))
  .map((name) => {
    const text = readFileSync(join(PROVENANCE_DIR, name), 'utf8');
    return { name, text, code: stripComments(text) };
  });

/** Every public value export of the provenance surface (Design § Public surface). */
const PUBLIC_VALUES = [
  'CONFIG_RECORDER_PROBE_KEYS',
  'PROVENANCE_ENTRY_KINDS',
  'ROOT_CONFIG_PATH',
  'ProvenanceAttributionError',
  'ProvenanceScopeError',
  'ProvenanceViewMutationError',
  'createConfigRecorder',
  'createLineBuilder',
  'createPatchBuilder',
  'createProvenanceCollector',
  'filterProvenanceByPath',
  'formatConfigPath',
  'hasProvenance',
  'isProvenanceEntry',
  'isSecondaryAttribution',
  'matchesConfigPath',
  'mergeProvenance',
  'omitExactConfigPath',
  'parseConfigPath',
] as const;

describe('INV-11 — nothing in provenance/ logs or does I/O', () => {
  it('source has no console, logger, process, or node: imports', () => {
    expect(sourceFiles.length).toBe(12);
    for (const { name, code } of sourceFiles) {
      expect(code, name).not.toMatch(/\bconsole\./);
      expect(code, name).not.toMatch(/\blogger\b/);
      expect(code, name).not.toMatch(/\bprocess\./);
      expect(code, name).not.toMatch(/from ['"]node:/);
      expect(code, name).not.toMatch(/\bglobalThis\b/);
    }
  });
});

describe('INV-29 — no key is special-cased by name except the probe keys (and the array shell’s length)', () => {
  it("string literals in config-recorder.ts used as property keys are exactly 'toJSON', 'then', 'length'", () => {
    const recorder = sourceFiles.find((f) => f.name === 'config-recorder.ts');
    if (recorder === undefined) throw new Error('config-recorder.ts missing');
    // Comments are already stripped; drop import specifiers too — they are module paths, not keys.
    const code = recorder.code.replace(/^import[\s\S]*?;$/gm, '');
    const literals = [...code.matchAll(/'([^'\n]*)'/g)].map((m) => m[1]);
    const ALLOWED_NON_KEY = new Set([
      'string',
      'object', // typeof narrowing
      'closed', // ProvenanceScopeError reason
      'set',
      'delete',
      'define',
      'setPrototype',
      'preventExtensions', // mutation operation names
      'traversal',
      'terminal', // read classification (INV-35)
      '.',
      '[', // segment-boundary characters in the prune's ancestor walk
    ]);
    const keyLiterals = literals.filter((l) => l !== undefined && !ALLOWED_NON_KEY.has(l));
    expect(new Set(keyLiterals)).toEqual(new Set(['toJSON', 'then', 'length']));
  });
});

describe('INV-30 — provenance/ is chain-, file-, field- and wizard-agnostic', () => {
  const FORBIDDEN = [
    'stellar',
    'soroban',
    'evm',
    'RWAConfig',
    'token.',
    'compliance',
    'identityVerification',
    'accessControl',
    'Cargo',
    'deploy.sh',
    'README',
    'wizard',
  ];

  it.each(FORBIDDEN)('no source file contains %j', (word) => {
    for (const { name, text } of sourceFiles) {
      expect(text.includes(word), `${name} contains "${word}"`).toBe(false);
    }
  });

  it('imports are limited to ./ siblings, ../file-tree, ../source-patch and ../types', () => {
    for (const { name, text } of sourceFiles) {
      const specifiers = [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '');
      for (const spec of specifiers) {
        expect(
          spec.startsWith('./') ||
            spec === '../file-tree' ||
            spec === '../source-patch' ||
            spec === '../types',
          `${name} imports ${spec}`
        ).toBe(true);
      }
    }
  });

  it('exported types carry no UI prose fields (constitution §III structural-only)', () => {
    for (const { name, text } of sourceFiles) {
      expect(text, name).not.toMatch(/^\s*(readonly\s+)?(description|hint|label)\??\s*:/m);
    }
  });
});

describe('INV-31 — browser-safe, ES2020-lib only, no dependency, full surface built', () => {
  it('does not use Object.hasOwn (ES2022) or structuredClone', () => {
    for (const { name, code } of sourceFiles) {
      expect(code, name).not.toMatch(/Object\.hasOwn\(/);
      expect(code, name).not.toMatch(/structuredClone\(/);
    }
  });

  it('package.json keeps sideEffects: false and gains no dependency', () => {
    const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as {
      sideEffects?: boolean;
      dependencies?: Record<string, string>;
    };
    expect(pkg.sideEffects).toBe(false);
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['jszip']);
  });

  it('the src barrel exports every public value and does NOT export openConfigRecorder', () => {
    const exported: Record<string, unknown> = barrel;
    for (const name of PUBLIC_VALUES) expect(exported[name], name).toBeDefined();
    expect(exported['openConfigRecorder']).toBeUndefined();
    expect(exported['matchesConfigPathSegments']).toBeUndefined();
    expect(exported['isCanonicalIndexKey']).toBeUndefined();
  });

  const distBuilt =
    existsSync(join(DIST_DIR, 'index.mjs')) && existsSync(join(DIST_DIR, 'index.cjs'));

  it.skipIf(!distBuilt)(
    'dist/index.mjs exports the full provenance surface (run `pnpm build` first)',
    async () => {
      const esm: Record<string, unknown> = await import(join(DIST_DIR, 'index.mjs'));
      for (const name of PUBLIC_VALUES) expect(esm[name], name).toBeDefined();
      expect(esm['openConfigRecorder']).toBeUndefined();
    }
  );

  it.skipIf(!distBuilt)('dist/index.cjs exports the full provenance surface', () => {
    const require = createRequire(import.meta.url);
    const cjs: Record<string, unknown> = require(join(DIST_DIR, 'index.cjs')) as Record<
      string,
      unknown
    >;
    for (const name of PUBLIC_VALUES) expect(cjs[name], name).toBeDefined();
    expect(cjs['openConfigRecorder']).toBeUndefined();
  });

  it('a build is present so the dist assertions above actually ran', () => {
    expect(distBuilt, 'dist/ missing — run `pnpm --filter @openzeppelin/codegen-core build`').toBe(
      true
    );
  });
});

describe('INV-32 — additive: Generator unchanged, options/result widened only', () => {
  it('a Generator that ignores the flag still satisfies the interface (compile-time) and behaves unchanged', () => {
    const legacy: Generator<{ v: string }> = {
      name: 'legacy',
      version: '1',
      validate: () => ({ valid: true, errors: [], warnings: [] }),
      generate: (config) => ({
        files: { 'a.txt': config.v },
        metadata: {
          generatorName: 'legacy',
          generatorVersion: '1',
          generatedAt: 't',
          fileCount: 1,
          configHash: 'h',
        },
      }),
    };
    const on = legacy.generate({ v: 'x' }, { recordProvenance: true });
    const off = legacy.generate({ v: 'x' });
    expect(on).toEqual(off);
    expect('provenance' in on).toBe(false);
  });

  it('GenerateOptions.recordProvenance and GenerationResult.provenance are optional', () => {
    expectTypeOf<GenerateOptions['recordProvenance']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<GenerationResult>().toHaveProperty('provenance');
    const minimal: GenerationResult = {
      files: {},
      metadata: {
        generatorName: 'g',
        generatorVersion: '0',
        generatedAt: 't',
        fileCount: 0,
        configHash: 'h',
      },
    };
    expect(minimal.provenance).toBeUndefined();
  });

  it('Generator<T> has exactly name, version, validate, generate', () => {
    expectTypeOf<keyof Generator<object>>().toEqualTypeOf<
      'name' | 'version' | 'validate' | 'generate'
    >();
  });
});

describe('INV-33 — strict typing', () => {
  it('createConfigRecorder(cfg).view is exactly typeof cfg', () => {
    const cfg = { a: { b: [1, 2] }, c: 'x' as const };
    const { view } = createConfigRecorder(cfg);
    expectTypeOf(view).toEqualTypeOf<typeof cfg>();
  });

  it('ProvenanceEntry members are only kind | paths | range | secondaryPaths', () => {
    expectTypeOf<keyof ProvenanceEntry>().toEqualTypeOf<'kind' | 'paths'>();
    // INV-2: significance is a member of the `range` variant and of nothing else,
    // so `file` and `created` cannot carry it even by mistake.
    expectTypeOf<keyof Extract<ProvenanceEntry, { kind: 'range' }>>().toEqualTypeOf<
      'kind' | 'paths' | 'range' | 'secondaryPaths'
    >();
    expectTypeOf<keyof Extract<ProvenanceEntry, { kind: 'file' }>>().toEqualTypeOf<
      'kind' | 'paths'
    >();
    expectTypeOf<keyof Extract<ProvenanceEntry, { kind: 'created' }>>().toEqualTypeOf<
      'kind' | 'paths'
    >();
  });

  it('source contains no `any` and no eslint-disable', () => {
    for (const { name, code, text } of sourceFiles) {
      expect(code, name).not.toMatch(/\bany\b/);
      expect(text, name).not.toMatch(/eslint-disable/);
    }
  });
});
