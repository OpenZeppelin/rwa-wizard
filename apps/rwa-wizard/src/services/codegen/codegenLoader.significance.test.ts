/**
 * SF-10 — the seam. What the loader does with a significance mark it does not
 * trust, and what it must never do because of one.
 * INV-15, INV-16, INV-17, INV-18, INV-23, INV-26.
 * Category: Auth Boundary + Side-Effect Ordering & Observability + Sensitive Data.
 *
 * The organising fact: the mark is a PRESENTATIONAL hint, and a presentational
 * hint must never cost the user information. Every assertion below is a
 * restatement of that in one direction or another — the repair can only promote,
 * a bad mark never drops an entry, and the diagnostic never claims a drop that
 * did not happen.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  GenerateOptions,
  GenerationResult,
  ProvenanceEntry,
} from '@openzeppelin/codegen-core';
import { createProvenanceCollector, isSecondaryAttribution } from '@openzeppelin/codegen-core';
import { logger } from '@openzeppelin/ui-utils';

import { makeConfig } from '../../test/fixtures/wizardFixtures';
import { loadCodegenService } from './codegenLoader';

const { generateMock, generateZipMock } = vi.hoisted(() => ({
  generateMock: vi.fn<(config: unknown, options?: GenerateOptions) => GenerationResult>(),
  generateZipMock: vi.fn<
    (config: unknown, options?: GenerateOptions) => Promise<{ fileName: string; data: Blob }>
  >(async () => ({ fileName: 'test.zip', data: new Blob(['zip']) })),
}));

vi.mock('./runtimeOptions', () => ({ getCodegenRuntimeOptions: vi.fn(() => undefined) }));

vi.mock('@openzeppelin/codegen-rwa-stellar', () => ({
  validate: vi.fn(() => ({ valid: true, errors: [], warnings: [] })),
  getAvailableModules: vi.fn(() => []),
  generate: generateMock,
  generateZip: generateZipMock,
  generateWithIdentitySupport: undefined,
  generateZipWithIdentitySupport: undefined,
  getEcosystemMetadata: undefined,
  getUpstreamSourceRevision: undefined,
  getUpstreamImportLinks: undefined,
  getGeneratedFileKind: undefined,
  getCodegenInfoBlurb: undefined,
  getDeployGuidance: undefined,
  getComplianceConfigWarnings: undefined,
  hasComplianceConfigBlockingIssues: undefined,
  isDemoAutoMintConfigReady: undefined,
  isComplianceConfigBlockingWarningId: undefined,
}));

const FILES = { 'a.txt': 'a' };

function result(files: Record<string, unknown>): GenerationResult {
  return {
    files: FILES,
    metadata: { configHash: 'h' },
    provenance: { files },
  } as unknown as GenerationResult;
}

async function narrow(files: Record<string, unknown>) {
  generateMock.mockReturnValue(result(files));
  const svc = await loadCodegenService('stellar');
  if (!svc) throw new Error('expected a service');
  const artifact = await svc.generateFileTree(makeConfig(), { recordProvenance: true });
  return artifact.provenance;
}

/** A well-formed `range` entry with whatever mark the case needs. */
const ranged = (paths: readonly string[], secondaryPaths?: unknown): ProvenanceEntry =>
  (secondaryPaths === undefined
    ? { kind: 'range', range: { start: 1, end: 2 }, paths }
    : { kind: 'range', range: { start: 1, end: 2 }, paths, secondaryPaths }) as ProvenanceEntry;

const hasKey = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const entriesOf = (
  provenance: { files: Record<string, { entries: readonly ProvenanceEntry[] }> } | undefined,
  filePath: string
): readonly ProvenanceEntry[] => provenance?.files[filePath]?.entries ?? [];

beforeEach(() => {
  generateMock.mockReset();
  vi.restoreAllMocks();
});

describe('INV-16 — repair is by intersection, and can only promote', () => {
  it('a mark naming one attributed and one unattributed path keeps the attributed one', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const provenance = await narrow({ f: { entries: [ranged(['a', 'b'], ['b', 'c'])] } });
    const [entry] = entriesOf(provenance, 'f');
    expect(entry?.kind === 'range' ? entry.secondaryPaths : undefined).toEqual(['b']);
    expect(entry?.paths).toEqual(['a', 'b']);
  });

  it('a fully disjoint mark drops the key and keeps the entry with its paths intact', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const provenance = await narrow({ f: { entries: [ranged(['a', 'b'], ['c'])] } });
    const [entry] = entriesOf(provenance, 'f');
    expect(entry).toBeDefined();
    if (entry === undefined) return;
    expect(hasKey(entry, 'secondaryPaths')).toBe(false);
    expect(entry.paths).toEqual(['a', 'b']);
  });

  it.each([
    ['a string', 'nope'],
    ['an array of numbers', [1, 2]],
    ['null', null],
    ['an object', {}],
    ['a boolean', true],
  ])('a mark that is %s is treated as undeclared and the entry is kept', async (_label, value) => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const provenance = await narrow({ f: { entries: [ranged(['a', 'b'], value)] } });
    const [entry] = entriesOf(provenance, 'f');
    expect(entry).toBeDefined();
    if (entry === undefined) return;
    expect(hasKey(entry, 'secondaryPaths')).toBe(false);
    expect(entry.paths).toEqual(['a', 'b']);
  });

  it('duplicates and disorder are normalised', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const provenance = await narrow({ f: { entries: [ranged(['a', 'b'], ['b', 'b', 'a'])] } });
    const [entry] = entriesOf(provenance, 'f');
    expect(entry?.kind === 'range' ? entry.secondaryPaths : undefined).toEqual(['a', 'b']);
  });

  it('a mark on a `file` or `created` entry is dropped and the entry is kept', async () => {
    // The type forbids it; untrusted input does not care. INV-2 restated at the
    // boundary, because a file-level demotion is a claim about the whole file.
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const provenance = await narrow({
      f: {
        entries: [
          { kind: 'file', paths: ['a'], secondaryPaths: ['a'] },
          { kind: 'created', paths: ['b'], secondaryPaths: ['b'] },
        ],
      },
    });
    const entries = entriesOf(provenance, 'f');
    expect(entries).toHaveLength(2);
    for (const entry of entries) expect(hasKey(entry, 'secondaryPaths')).toBe(false);
    expect(entries.map((entry) => entry.paths)).toEqual([['a'], ['b']]);
  });

  it('promote-only, over a corpus: the repaired set is always a subset of the declared set', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const DECLARED: readonly (readonly string[])[] = [
      ['a'],
      ['b'],
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'd'],
      ['a', 'a', 'b'],
      ['b', 'a'],
      [],
    ];
    for (const declared of DECLARED) {
      const provenance = await narrow({ f: { entries: [ranged(['a', 'b'], declared)] } });
      const [entry] = entriesOf(provenance, 'f');
      const repaired = entry?.kind === 'range' ? (entry.secondaryPaths ?? []) : [];
      const declaredSet = new Set(declared);
      for (const path of repaired) {
        expect(declaredSet.has(path), `${path} was invented from ${JSON.stringify(declared)}`).toBe(
          true
        );
      }
      // …and no site was lost by the repair.
      expect(entry?.paths).toEqual(['a', 'b']);
    }
  });

  /**
   * SF-10 Tests finding #1 — found as a defect, fixed at Code Draft revision 2.
   *
   * INV-16 says an empty repaired set drops the key entirely, so the app never
   * holds INV-1's forbidden second spelling of "nothing is secondary". A
   * reported `secondaryPaths: []` used to slip past, because
   * `repairSecondaryPaths`' reference-identity early return fired first: `[]` is
   * trivially identical to its own repair, so the entry came back unchanged
   * before the empty-drop branch was reached. The fix is ordering — emptiness is
   * tested before identity — and this pair of tests is what holds it.
   *
   * The defect was never a demotion, which is why it was safe to land the stage
   * with it: `isSecondaryAttribution` answers `false` for every query either way
   * (its non-empty `matching` guard sees nothing to match), so no site was ever
   * lost. What was lost is the canonical-form guarantee the seam hands SF-11 — a
   * consumer taking D6's forbidden `secondaryPaths !== undefined` shortcut would
   * read this entry as marked, and a `toStrictEqual` against an unmarked entry
   * would differ. The second test below pins the harmlessness so a future
   * regression is diagnosed correctly rather than mistaken for a demotion.
   */
  it('a reported `secondaryPaths: []` drops the key', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const provenance = await narrow({ f: { entries: [ranged(['a', 'b'], [])] } });
    const [entry] = entriesOf(provenance, 'f');
    expect(entry).toBeDefined();
    if (entry === undefined) return;
    expect(hasKey(entry, 'secondaryPaths')).toBe(false);
  });

  it('the empty mark answers `false` for every query — no site is demoted', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const provenance = await narrow({ f: { entries: [ranged(['a', 'b'], [])] } });
    const [entry] = entriesOf(provenance, 'f');
    if (entry === undefined) throw new Error('expected an entry');
    for (const query of ['a', 'b', '']) {
      expect(isSecondaryAttribution(entry, query), query).toBe(false);
    }
    expect(entry.paths).toEqual(['a', 'b']);
  });

  it('a well-formed mark passes through unchanged', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const provenance = await narrow({ f: { entries: [ranged(['a', 'b'], ['a', 'b'])] } });
    const [entry] = entriesOf(provenance, 'f');
    expect(entry?.kind === 'range' ? entry.secondaryPaths : undefined).toEqual(['a', 'b']);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('INV-17 — the mark can never cost a site', () => {
  it('keys, entry counts, order and every `paths` array survive a malformed mark', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const withMarks = {
      f: {
        entries: [{ kind: 'file', paths: ['a'] }, ranged(['a', 'b'], ['zzz']), ranged(['c'], 42)],
      },
      g: { entries: [ranged(['d'], ['d'])] },
    };
    const withoutMarks = {
      f: {
        entries: [{ kind: 'file', paths: ['a'] }, ranged(['a', 'b']), ranged(['c'])],
      },
      g: { entries: [ranged(['d'])] },
    };

    const marked = await narrow(withMarks);
    const stripped = await narrow(withoutMarks);

    expect(Object.keys(marked?.files ?? {})).toEqual(Object.keys(stripped?.files ?? {}));
    for (const key of Object.keys(stripped?.files ?? {})) {
      const a = entriesOf(marked, key);
      const b = entriesOf(stripped, key);
      expect(a.length, key).toBe(b.length);
      expect(
        a.map((entry) => entry.paths),
        key
      ).toEqual(b.map((entry) => entry.paths));
      expect(
        a.map((entry) => entry.kind),
        key
      ).toEqual(b.map((entry) => entry.kind));
    }
  });

  it('an entry whose mark is malformed AND whose paths are unparsable is dropped for the PATH reason', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    await narrow({
      f: { entries: [ranged(['a..b'], ['zzz']), ranged(['ok'], ['ok'])] },
    });
    const message = String(warn.mock.calls[0]?.[1]);
    expect(message).toMatch(/1 entries/);
    // The drop is attributed to the path, and NOT also counted as a repair —
    // the entry never reached the repair, so counting it twice would inflate
    // both numbers for one fault.
    expect(message).toMatch(/0 significance marks repaired/);
  });

  it('a throwing `secondaryPaths` getter is treated as undeclared, not as an exception', async () => {
    // `isProvenanceEntry` tolerates hostile getters by design and runs BEFORE
    // the repair, so the entry is kept — and then read. Without the guard the
    // throw would cross the seam, which nothing at this seam may do.
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const hostile: Record<string, unknown> = {
      kind: 'range',
      range: { start: 1, end: 2 },
      paths: ['a'],
    };
    Object.defineProperty(hostile, 'secondaryPaths', {
      enumerable: true,
      get() {
        throw new Error('hostile');
      },
    });

    const provenance = await narrow({ f: { entries: [hostile] } });
    const [entry] = entriesOf(provenance, 'f');
    expect(entry?.paths).toEqual(['a']);
    expect(entry?.kind).toBe('range');
  });

  it('`isProvenanceEntry` is not extended — the loader source has no secondaryPaths clause in its keep decision', () => {
    const text = readFileSync(resolve(__dirname, 'codegenLoader.ts'), 'utf8');
    const keepDecision = text.slice(
      text.indexOf('function toProvenance'),
      text.indexOf('function toProvenance') + 2500
    );
    // The repair happens after the keep decision, never inside it.
    const keepLine = keepDecision
      .split('\n')
      .find((line) => line.includes('isProvenanceEntry(entry)'));
    expect(keepLine).toBeDefined();
    expect(keepLine).not.toMatch(/secondaryPaths/);
  });
});

describe('INV-18 — reference identity, with exactly one exception', () => {
  it('an unrepaired entry is the package’s own object; its repaired sibling is not', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const clean = ranged(['a', 'b'], ['a', 'b']);
    const dirty = ranged(['c', 'd'], ['d', 'e']);
    const untouched = ranged(['x']);

    generateMock.mockReturnValue(
      result({ f: { entries: [clean, dirty, untouched] }, g: { entries: [untouched] } })
    );
    const svc = await loadCodegenService('stellar');
    if (!svc) throw new Error('expected a service');
    const artifact = await svc.generateFileTree(makeConfig(), { recordProvenance: true });
    const entries = entriesOf(artifact.provenance, 'f');

    expect(entries[0]).toBe(clean); // needed no repair
    expect(entries[1]).not.toBe(dirty); // the one exception
    expect(entries[2]).toBe(untouched); // a sibling is untouched by its neighbour
    expect(entriesOf(artifact.provenance, 'g')[0]).toBe(untouched);
  });

  it('the repaired entry differs ONLY in `secondaryPaths`', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const dirty = ranged(['c', 'd'], ['d', 'e']);
    const provenance = await narrow({ f: { entries: [dirty] } });
    const [entry] = entriesOf(provenance, 'f');
    if (entry?.kind !== 'range' || dirty.kind !== 'range') throw new Error('expected ranges');

    expect(entry.kind).toBe(dirty.kind);
    expect(entry.range).toEqual(dirty.range);
    expect(entry.paths).toBe(dirty.paths); // nothing rebuilt that did not need rebuilding
    expect(entry.secondaryPaths).toEqual(['d']);
  });

  it('the repair branch is not entered gratuitously — a clean tree allocates no entry', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const clean = ranged(['a', 'b'], ['a', 'b']);
    const provenance = await narrow({ f: { entries: [clean] } });
    expect(entriesOf(provenance, 'f')[0]).toBe(clean);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('INV-23 — one warning per generation; repairs are counted, never conflated with drops', () => {
  const message = (warn: ReturnType<typeof vi.spyOn>): string => String(warn.mock.calls[0]?.[1]);

  it('repairs only → exactly one warn, repaired counted, dropped reported as 0', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    await narrow({ f: { entries: [ranged(['a'], ['z']), ranged(['b'], ['y'])] } });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(message(warn)).toMatch(/0 entries/);
    expect(message(warn)).toMatch(/2 significance marks repaired/);
  });

  it('drops only → one warn, repairs reported as 0', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    await narrow({ f: { entries: [{ kind: 'bogus' }] } });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(message(warn)).toMatch(/1 entries/);
    expect(message(warn)).toMatch(/0 significance marks repaired/);
  });

  it('both → still exactly one warn, both counts correct', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    await narrow({
      f: { entries: [{ kind: 'bogus' }, ranged(['a'], ['z'])] },
      g: { entries: 'nope' },
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(message(warn)).toMatch(/1 entries/);
    expect(message(warn)).toMatch(/1 files/);
    expect(message(warn)).toMatch(/1 significance marks repaired/);
  });

  it('neither → no warn at all', async () => {
    const warn = vi.spyOn(logger, 'warn');
    await narrow({ f: { entries: [ranged(['a'], ['a']), ranged(['b'])] } });
    expect(warn).not.toHaveBeenCalled();
  });

  it('a hundred repairs across many files → still exactly one warn', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const files: Record<string, unknown> = {};
    for (let i = 0; i < 100; i += 1) {
      files[`f${i}`] = { entries: [ranged(['a'], ['unattributed'])] };
    }
    await narrow(files);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(message(warn)).toMatch(/100 significance marks repaired/);
  });
});

describe('INV-26 — the warning carries counts and one file key, nothing else', () => {
  it('a config value smuggled into a mark never reaches the console', async () => {
    const sentinel = 'SENTINEL-4b19';
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    await narrow({
      'safe-file.txt': { entries: [ranged(['a'], [`token.name=${sentinel}`])] },
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(sentinel);
    // The one file key it does carry is the file key, which is not user data.
    expect(String(warn.mock.calls[0]?.[1])).toContain('safe-file.txt');
  });

  it('no recorded path appears in the message even when the mark is entirely paths', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    await narrow({ f: { entries: [ranged(['a'], ['deployment.target.rpcUrl'])] } });
    expect(String(warn.mock.calls[0]?.[1])).not.toContain('deployment.target.rpcUrl');
  });
});

describe('INV-15 — opposite rules at the two boundaries, and the reason is recorded', () => {
  it('THE SAME malformed shape throws at `addRange` and is repaired at the loader', async () => {
    // This test exists to be broken by anyone who "unifies" the two rules. They
    // are not an inconsistency: `addRange`'s caller is our own template, covered
    // by our own suite, so a bad subset is a bug to surface loudly before
    // release. The loader's input arrives from a published package the app does
    // not control, where a malformed mark must never cost the user information.
    // A throwing loader turns one bad byte of package metadata into ZERO
    // provenance affordances on every field, for every generation.
    const collector = createProvenanceCollector({ token: { name: 'Alpha' } }, { enabled: true });
    expect(() =>
      collector.record('f', (scope) => {
        scope.addRange({ start: 1, end: 2 }, ['a'], { secondaryPaths: ['zzz'] });
      })
    ).toThrow(/secondary/i);

    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const provenance = await narrow({ f: { entries: [ranged(['a'], ['zzz'])] } });
    const [entry] = entriesOf(provenance, 'f');
    expect(entry).toBeDefined();
    if (entry === undefined) return;
    expect(hasKey(entry, 'secondaryPaths')).toBe(false);
    expect(entry.paths).toEqual(['a']);
  });

  it('the loader never throws on a hostile mark, whatever its shape', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const shapes: unknown[] = [
      'x',
      42,
      null,
      {},
      [null],
      [{}],
      Array.from({ length: 1000 }, (_, i) => `p${i}`),
    ];
    for (const shape of shapes) {
      await expect(narrow({ f: { entries: [ranged(['a'], shape)] } })).resolves.toBeDefined();
    }
  });

  it('both rules are documented where a reader would otherwise unify them', () => {
    const loader = readFileSync(resolve(__dirname, 'codegenLoader.ts'), 'utf8');
    expect(loader).toMatch(/asymmetry|must not be unified|THROWS/i);
    expect(loader).toMatch(/intersection/i);
  });
});
