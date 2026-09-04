/**
 * SF-10 — `isSecondaryAttribution`, the only place significance is decided.
 * INV-5, INV-6, INV-29 (signature), INV-34 (queryable).
 * Category: Request/Response Contract.
 *
 * D6 exists because both naive checks are available inline at every consumer:
 * `entry.secondaryPaths !== undefined` and `entry.secondaryPaths.includes(query)`.
 * The case table below is built so that each naive check is *wrong* in at least
 * one cell, and the comment on that cell says which one it catches — a later
 * reader who "simplifies" the predicate breaks a test that explains itself.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  filterProvenanceByPath,
  isSecondaryAttribution,
} from '../../src/provenance/provenance-result';
import type {
  ConfigPath,
  ProvenanceEntry,
  ProvenanceLineRange,
  ProvenanceResult,
} from '../../src/provenance/types';
import { ROOT_CONFIG_PATH } from '../../src/provenance/types';

const RANGE: ProvenanceLineRange = { start: 1, end: 2 };

function range(
  paths: readonly ConfigPath[],
  secondaryPaths?: readonly ConfigPath[]
): ProvenanceEntry {
  return secondaryPaths === undefined
    ? { kind: 'range', range: RANGE, paths }
    : { kind: 'range', range: RANGE, paths, secondaryPaths };
}

/** The naive checks D6 exists to prevent, so each case can name the one it catches. */
const naivePresence = (entry: ProvenanceEntry): boolean =>
  entry.kind === 'range' && entry.secondaryPaths !== undefined;
const naiveIncludes = (entry: ProvenanceEntry, query: ConfigPath): boolean =>
  entry.kind === 'range' && (entry.secondaryPaths?.includes(query) ?? false);

describe('INV-5 — secondary iff the entry matches and EVERY matching path is secondary', () => {
  const mixed = range(['token.name', 'token.symbol'], ['token.symbol']);

  it('case 1 — prefix query over a mixed entry is primary (catches the presence check)', () => {
    expect(isSecondaryAttribution(mixed, 'token')).toBe(false);
    // The presence check would demote a range that determines `token.name`.
    expect(naivePresence(mixed)).toBe(true);
  });

  it('case 2 — the exact secondary path is secondary', () => {
    expect(isSecondaryAttribution(mixed, 'token.symbol')).toBe(true);
  });

  it('case 3 — a fully-marked entry answers a prefix query true (catches the includes check)', () => {
    const fully = range(['token.name'], ['token.name']);
    expect(isSecondaryAttribution(fully, 'token')).toBe(true);
    // `includes('token')` is false here and would wrongly promote.
    expect(naiveIncludes(fully, 'token')).toBe(false);
  });

  it('case 4 — an entry that matches nothing is primary: the vacuity guard', () => {
    // `every` over an empty set is `true`. Without the `matching.length > 0`
    // guard EVERY unrelated entry in the tree — the overwhelming majority —
    // answers secondary, and SF-11 is forbidden from holding a second opinion.
    const unrelated = range(['deployment.target.kind'], ['deployment.target.kind']);
    expect(isSecondaryAttribution(unrelated, 'token')).toBe(false);
  });

  it('case 5 — `paths: []` matches no query, including the root', () => {
    const empty = range([], ['token.name']);
    expect(isSecondaryAttribution(empty, 'token.name')).toBe(false);
    expect(isSecondaryAttribution(empty, ROOT_CONFIG_PATH)).toBe(false);
  });

  it('case 6 — an unmarked range entry is primary for every query', () => {
    const unmarked = range(['token.name', 'token.symbol']);
    for (const query of ['token', 'token.name', 'token.symbol', ROOT_CONFIG_PATH]) {
      expect(isSecondaryAttribution(unmarked, query), query).toBe(false);
    }
  });

  it('case 7 — `file` and `created` entries are primary whatever their paths', () => {
    const file: ProvenanceEntry = { kind: 'file', paths: ['token.name'] };
    const created: ProvenanceEntry = { kind: 'created', paths: ['token.name'] };
    for (const query of ['token', 'token.name', ROOT_CONFIG_PATH]) {
      expect(isSecondaryAttribution(file, query), `file/${query}`).toBe(false);
      expect(isSecondaryAttribution(created, query), `created/${query}`).toBe(false);
    }
  });

  it('case 8 — the root query is true for a fully-marked entry and false for a partly-marked one', () => {
    const fully = range(['token.name', 'token.symbol'], ['token.name', 'token.symbol']);
    expect(isSecondaryAttribution(fully, ROOT_CONFIG_PATH)).toBe(true);
    expect(isSecondaryAttribution(mixed, ROOT_CONFIG_PATH)).toBe(false);
  });

  it('case 9 — a recorded ancestor answers a descendant query', () => {
    // The whole-object read: the range attributed `token`, the user asked
    // `token.name`. Same ancestor-or-equal rule as the row list uses.
    const ancestor = range(['token'], ['token']);
    expect(isSecondaryAttribution(ancestor, 'token.name')).toBe(true);
    expect(naiveIncludes(ancestor, 'token.name')).toBe(false);
  });

  it('case 10 — a malformed query is a RangeError for every entry kind', () => {
    const kinds: readonly ProvenanceEntry[] = [
      mixed,
      range(['token.name']),
      { kind: 'file', paths: ['token.name'] },
      { kind: 'created', paths: ['token.name'] },
    ];
    for (const malformed of ['token..name', 'token[']) {
      for (const entry of kinds) {
        expect(
          () => isSecondaryAttribution(entry, malformed),
          `${entry.kind}/${malformed}`
        ).toThrow(RangeError);
        // Same contract as the row list, so a consumer needs one try/catch.
        expect(() =>
          filterProvenanceByPath({ files: { f: { entries: [entry] } } }, malformed)
        ).toThrow(RangeError);
      }
    }
  });

  describe('case 11 — a malformed RECORDED path throws under every entry ordering', () => {
    // The eager filter is deliberately stricter than `filterProvenanceByPath`'s
    // short-circuiting `some`: it parses every recorded path, so the throw does
    // not depend on where the bad path sits. Code Draft flagged this as
    // "believed never to disagree on the answer" — the cells below verify it
    // rather than inherit it, and the last one records where they DO differ.
    const orderings: ReadonlyArray<readonly [string, readonly ConfigPath[]]> = [
      ['malformed first', ['token..name', 'token.symbol']],
      ['malformed last', ['token.symbol', 'token..name']],
      ['malformed in the middle', ['token.name', 'token..name', 'token.symbol']],
      ['malformed alone', ['token..name']],
    ];

    it.each(orderings)('%s → RangeError', (_label, paths) => {
      const entry = range(paths, paths);
      expect(() => isSecondaryAttribution(entry, 'token')).toThrow(RangeError);
    });

    it('throws even when the malformed path could not have matched the query', () => {
      const entry = range(['deployment..target', 'token.name'], ['token.name']);
      expect(() => isSecondaryAttribution(entry, 'token.name')).toThrow(RangeError);
    });

    it('the divergence from `filterProvenanceByPath` is in reporting, never in the answer', () => {
      // `some` stops at the first match, so a malformed path AFTER a matching one
      // is never parsed and the row list quietly keeps the entry. The predicate
      // parses it and throws. Both are defensible; what matters is that neither
      // ever returns a DIFFERENT boolean — the failure mode is a throw, not a
      // wrong answer, so INV-6's implication cannot be violated by this gap.
      const entry = range(['token.name', 'zzz..bad'], ['token.name', 'zzz..bad']);
      const result: ProvenanceResult = { files: { f: { entries: [entry] } } };

      expect(filterProvenanceByPath(result, 'token.name').files.f?.entries).toEqual([entry]);
      expect(() => isSecondaryAttribution(entry, 'token.name')).toThrow(RangeError);

      // Reverse the order and the row list throws too — its throw is
      // position-dependent, the predicate's is not.
      const reversed = range(['aaa..bad', 'token.name'], ['token.name']);
      expect(() =>
        filterProvenanceByPath({ files: { f: { entries: [reversed] } } }, 'token.name')
      ).toThrow(RangeError);
      expect(() => isSecondaryAttribution(reversed, 'token.name')).toThrow(RangeError);
    });
  });
});

describe('INV-6 — significance is only ever asserted about an attribution that exists', () => {
  const CORPUS: readonly ProvenanceEntry[] = [
    range(['token.name', 'token.symbol'], ['token.symbol']),
    range(['token.name'], ['token.name']),
    range(['token'], ['token']),
    range(['token.name', 'token.symbol']),
    range([], ['token.name']),
    range(['compliance.modules[0].moduleId'], ['compliance.modules[0].moduleId']),
    range(['compliance.modules[1].moduleId', 'compliance.modules[0].moduleId']),
    range([ROOT_CONFIG_PATH], [ROOT_CONFIG_PATH]),
    { kind: 'file', paths: ['token.name'] },
    { kind: 'created', paths: ['token.name'] },
  ];

  /** Every recorded path, its proper prefixes, the root, and a few near-misses. */
  const QUERIES: readonly ConfigPath[] = [
    ROOT_CONFIG_PATH,
    'token',
    'token.name',
    'token.symbol',
    'token.namespace',
    'compliance',
    'compliance.modules',
    'compliance.modules[0]',
    'compliance.modules[0].moduleId',
    'compliance.modules[1].moduleId',
    'deployment.target.kind',
  ];

  it('true implies the row list keeps the entry, over every (entry, query) pair', () => {
    const violations: string[] = [];
    for (const entry of CORPUS) {
      for (const query of QUERIES) {
        if (!isSecondaryAttribution(entry, query)) continue;
        const kept = filterProvenanceByPath({ files: { f: { entries: [entry] } } }, query);
        if (kept.files.f?.entries.length !== 1) {
          violations.push(`${JSON.stringify(entry)} @ ${JSON.stringify(query)}`);
        }
      }
    }
    expect(violations.join('\n'), 'entries reported secondary but not kept').toBe('');
  });

  it('the segment-boundary rule is used, not a string prefix', () => {
    // `startsWith`/`includes` would match `token.namespace` for the query
    // `token.name`, so significance would be asserted about a field the entry
    // never mentions — while the row list, using the correct rule, shows no row.
    const namespaced = range(['token.namespace'], ['token.namespace']);
    expect(isSecondaryAttribution(namespaced, 'token.name')).toBe(false);
    expect('token.namespace'.startsWith('token.name')).toBe(true);
  });

  it('an index is matched by value, not by text', () => {
    const first = range(['compliance.modules[0].moduleId'], ['compliance.modules[0].moduleId']);
    expect(isSecondaryAttribution(first, 'compliance.modules[0]')).toBe(true);
    expect(isSecondaryAttribution(first, 'compliance.modules[1]')).toBe(false);
  });

  it('`provenance-result.ts` contains no second matching implementation', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const source = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '..',
        '..',
        'src',
        'provenance',
        'provenance-result.ts'
      ),
      'utf8'
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/\.startsWith\(/);
    expect(code).not.toMatch(/\.includes\(.*query/);
    // One shared rule, reached from both functions.
    expect([...code.matchAll(/matchesConfigPathSegments\(/g)]).toHaveLength(2);
  });
});

describe('INV-29 — the predicate speaks only the existing vocabulary', () => {
  it('its signature mentions only ProvenanceEntry and ConfigPath', () => {
    expectTypeOf(isSecondaryAttribution).toEqualTypeOf<
      (entry: ProvenanceEntry, query: ConfigPath) => boolean
    >();
  });

  it('it is total: no undefined, no third state', () => {
    const answers = new Set(
      [range(['token.name'], ['token.name']), range(['token.name'])].map((entry) =>
        isSecondaryAttribution(entry, 'token.name')
      )
    );
    expect(answers).toEqual(new Set([true, false]));
  });
});
