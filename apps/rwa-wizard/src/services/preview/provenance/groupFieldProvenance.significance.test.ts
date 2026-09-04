/**
 * SF-11 — the one call site, as behaviour.
 *
 * The wizard REPORTS significance and never produces it. There is exactly one
 * expression in `apps/rwa-wizard/src` that yields a `FieldProvenanceSignificance`
 * — the ternary in `toRows` — and the static half of that claim is counted in
 * `fieldProvenance.boundary.test.ts`. This file is the behavioural half: that
 * the value the ternary produces is the value core's `isSecondaryAttribution`
 * returned for that entry and THAT query.
 *
 * The oracle is the real core function, called independently in the test. That
 * makes these tests a comparison against the rule rather than a restatement of
 * the implementation: inverting the ternary, dropping the query argument, or
 * substituting the entry's own paths for the query all fail here.
 *
 * INV-1, INV-8, INV-10.
 */
import { describe, expect, it } from 'vitest';

import { filterProvenanceByPath, isSecondaryAttribution } from '@openzeppelin/codegen-core';
import type { FileProvenance, FileTree, ProvenanceEntry } from '@openzeppelin/codegen-core';

import {
  ownershipAddressPath,
  roleAddressesPath,
  tokenPaths,
  type ConfigPath,
} from '../../../features/wizard/config-path';
import type { StructuralGeneratedFileKind } from '../../../types/wizard';
import { groupFieldProvenance } from './groupFieldProvenance';
import type { PreviewProvenanceSource } from './types';

const IDENTITY = 'hash|identity:0|service:svc-1';
const UNKNOWN_KIND = (): StructuralGeneratedFileKind => 'unknown';

const DEPLOY = 'scripts/deploy.sh';
const CONTRACT = 'contracts/src/lib.rs';

const OWNER = ownershipAddressPath({ type: 'single-owner', ownerAddress: '' });
const SYMBOL = tokenPaths.symbol;
const NAME = tokenPaths.name;

/**
 * A marked `range` entry. `secondaryPaths` is spelled here as the package would
 * report it — a subset of `paths` — and the entries below are HAND-BUILT rather
 * than harvested from a real generation, deliberately and by instruction.
 *
 * SF-10 INV-34 records that a single entry whose marks are a PROPER SUBSET of
 * its paths is expressible and queryable but not producible by any current
 * Stellar template: one emission yields one range and one uniform mark. Its
 * violation scenario names this stage — "a later reader builds SF-11's
 * mixed-row presentation against a case no fixture produces". A test that went
 * looking for this shape in real output would find nothing and quietly assert
 * a case that does not exist, and splitting an emission to manufacture one
 * would change the recorded range set and break SF-10 AS-3.
 */
function marked(
  start: number,
  end: number,
  paths: readonly ConfigPath[],
  secondaryPaths: readonly ConfigPath[]
): ProvenanceEntry {
  return {
    kind: 'range',
    range: { start, end },
    paths: [...paths],
    secondaryPaths: [...secondaryPaths],
  };
}

function unmarked(start: number, end: number, ...paths: ConfigPath[]): ProvenanceEntry {
  return { kind: 'range', range: { start, end }, paths };
}

function source(files: Record<string, readonly ProvenanceEntry[]>): PreviewProvenanceSource {
  const tree: FileTree = {};
  const provenanceFiles: Record<string, FileProvenance> = {};
  for (const [path, entries] of Object.entries(files)) {
    tree[path] = '';
    provenanceFiles[path] = { entries: [...entries] };
  }
  return {
    identity: IDENTITY,
    files: tree,
    provenance: { files: provenanceFiles },
    kindOf: UNKNOWN_KIND,
  };
}

// ---------------------------------------------------------------------------
// INV-1: every rendered significance is the one core returned for that query
// ---------------------------------------------------------------------------

/**
 * A corpus covering every shape the rule distinguishes: unmarked, fully marked,
 * partially marked, marked-but-non-matching, a prefix query answered over
 * several recorded paths, and the non-range kinds the rule always answers
 * `false` for.
 */
const CORPUS: Record<string, readonly ProvenanceEntry[]> = {
  [DEPLOY]: [
    unmarked(3, 3, OWNER),
    marked(9, 12, [SYMBOL], [SYMBOL]),
    marked(20, 24, [OWNER, SYMBOL], [SYMBOL]),
    marked(31, 31, [NAME, SYMBOL], [NAME, SYMBOL]),
    marked(40, 44, [roleAddressesPath(0)], [roleAddressesPath(0)]),
  ],
  [CONTRACT]: [
    unmarked(4, 4, NAME),
    { kind: 'created', paths: [NAME] },
    marked(11, 18, [NAME], [NAME]),
  ],
};

const QUERIES: readonly ConfigPath[] = [
  OWNER,
  SYMBOL,
  NAME,
  roleAddressesPath(0),
  'token',
  'accessControl',
  tokenPaths.decimals,
];

describe('toRows — significance is the value core returned for this query (INV-1)', () => {
  it.each(QUERIES)('%s: every emitted row matches the rule computed independently', (query) => {
    const result = groupFieldProvenance(source(CORPUS), query);

    // Matching is core's rule, taken from core — SF-5 owns it and re-implementing
    // it here would substitute a hand-rolled oracle for the real one. What this
    // table is an independent oracle FOR is the significance verdict, which is
    // computed below from `isSecondaryAttribution` rather than read back from
    // the value under test.
    const matched = filterProvenanceByPath(source(CORPUS).provenance, query);

    for (const emitted of result.groups) {
      const entries = (matched.files[emitted.path]?.entries ?? []).filter(
        (entry) => entry.kind === 'range'
      );
      const expected = entries.map((entry) =>
        isSecondaryAttribution(entry, query) ? 'secondary' : 'primary'
      );
      // `toRows` sorts ranges by start line; the corpus is already in that
      // order, so a positional comparison is well defined.
      const actual = emitted.rows.filter((row) => row.kind === 'range').map((r) => r.significance);

      expect(actual).toEqual(expected);
    }
  });

  it('the corpus produces BOTH values, so the table above is not vacuous', () => {
    // A table over a corpus that happens to be all-primary would pass against an
    // implementation that hard-coded `'primary'`. This is the assertion that
    // makes inverting the ternary a failure rather than a shrug.
    const seen = new Set(
      QUERIES.flatMap((query) =>
        groupFieldProvenance(source(CORPUS), query).groups.flatMap((g) =>
          g.rows.map((row) => row.significance)
        )
      )
    );

    expect([...seen].sort()).toEqual(['primary', 'secondary']);
  });

  it('an unmarked range is primary and a fully marked one is secondary, in the same file', () => {
    const result = groupFieldProvenance(
      source({ [DEPLOY]: [unmarked(3, 3, SYMBOL), marked(9, 12, [SYMBOL], [SYMBOL])] }),
      SYMBOL
    );

    expect(result.groups[0]?.rows).toEqual([
      { kind: 'range', range: { startLine: 3, endLine: 3 }, significance: 'primary' },
      { kind: 'range', range: { startLine: 9, endLine: 12 }, significance: 'secondary' },
    ]);
  });

  it('a range whose mark covers only a SIBLING path stays primary for this query', () => {
    // `secondaryPaths.length > 0` — the shortcut a reader writes first — would
    // demote this row. The rule is per matching path, and the matching path here
    // is not marked.
    const entry = marked(20, 24, [OWNER, SYMBOL], [SYMBOL]);
    const result = groupFieldProvenance(source({ [DEPLOY]: [entry] }), OWNER);

    expect(isSecondaryAttribution(entry, OWNER)).toBe(false);
    expect(result.groups[0]?.rows[0]?.significance).toBe('primary');
  });

  it('a prefix query is answered per attribution, not by membership of the mark', () => {
    // `secondaryPaths.includes(query)` — the other shortcut — would promote this
    // row, because the query `token` is not literally in the mark. The rule says
    // every path the prefix reaches is marked, so the row is secondary.
    const entry = marked(31, 31, [NAME, SYMBOL], [NAME, SYMBOL]);
    const result = groupFieldProvenance(source({ [DEPLOY]: [entry] }), 'token');

    expect(entry.kind === 'range' && entry.secondaryPaths?.includes('token')).toBe(false);
    expect(isSecondaryAttribution(entry, 'token')).toBe(true);
    expect(result.groups[0]?.rows[0]?.significance).toBe('secondary');
  });

  it('a prefix query reaching one marked and one unmarked path stays primary', () => {
    const entry = marked(31, 31, [NAME, SYMBOL], [NAME]);
    const result = groupFieldProvenance(source({ [DEPLOY]: [entry] }), 'token');

    expect(result.groups[0]?.rows[0]?.significance).toBe('primary');
  });
});

// ---------------------------------------------------------------------------
// INV-10: significance is a property of the QUERY, not of the line
// ---------------------------------------------------------------------------

describe('toRows — ADMIN="GCEXAMPLEOWNER" is primary for the owner field and secondary for the symbol (INV-10)', () => {
  /**
   * One emitted line, two attributions. It is the line that sets the deploy
   * admin — so for the owner-address field it DETERMINES the deployment — and it
   * also happens to carry the token symbol, for which it merely shows the value.
   *
   * HAND-BUILT, per SF-10 INV-34: this is a mixed-significance entry, whose
   * marks are a proper subset of its paths, and no current template produces one.
   * The shape is nonetheless legal, queryable, and exactly what the seam exists
   * to answer — which is why it is the clearest demonstration in the suite that
   * this is reported data and not a heuristic. A heuristic that looked at the
   * file (`.sh`), the command (`echo`) or the line text would have to give this
   * one line a single answer, and both single answers are wrong for one field.
   */
  const ADMIN_LINE = marked(201, 201, [OWNER, SYMBOL], [SYMBOL]);
  const tree = source({ [DEPLOY]: [ADMIN_LINE] });

  it('the same line is primary when the owner-address field asks', () => {
    const result = groupFieldProvenance(tree, OWNER);

    expect(result.groups).toEqual([
      {
        path: DEPLOY,
        kind: 'unknown',
        rows: [{ kind: 'range', range: { startLine: 201, endLine: 201 }, significance: 'primary' }],
      },
    ]);
  });

  it('the same line is secondary when the symbol field asks', () => {
    const result = groupFieldProvenance(tree, SYMBOL);

    expect(result.groups[0]?.rows).toEqual([
      { kind: 'range', range: { startLine: 201, endLine: 201 }, significance: 'secondary' },
    ]);
  });

  it('the two answers are the same row on opposite sides, not two different rows', () => {
    const asOwner = groupFieldProvenance(tree, OWNER).groups[0]?.rows[0];
    const asSymbol = groupFieldProvenance(tree, SYMBOL).groups[0]?.rows[0];

    expect(asOwner?.kind).toBe('range');
    expect(asSymbol?.kind).toBe('range');
    expect(asOwner?.kind === 'range' && asOwner.range).toEqual(
      asSymbol?.kind === 'range' ? asSymbol.range : undefined
    );
    expect(asOwner?.significance).not.toBe(asSymbol?.significance);
  });

  it('no verdict is cached across fields: the owner answer is unchanged after the symbol asks', () => {
    // A per-line or per-entry memo would make significance a property of the
    // line. The result of the third call must equal the first, byte for byte.
    const first = groupFieldProvenance(tree, OWNER);
    groupFieldProvenance(tree, SYMBOL);
    const third = groupFieldProvenance(tree, OWNER);

    expect(third).toEqual(first);
    expect(third.path).toBe(OWNER);
  });

  it('the query order does not change either answer', () => {
    const symbolFirst = groupFieldProvenance(tree, SYMBOL);
    const ownerSecond = groupFieldProvenance(tree, OWNER);
    const ownerFirstAgain = groupFieldProvenance(source({ [DEPLOY]: [ADMIN_LINE] }), OWNER);

    expect(ownerSecond).toEqual(ownerFirstAgain);
    expect(symbolFirst.groups[0]?.rows[0]?.significance).toBe('secondary');
  });

  it('each result is stamped with the path it was computed for', () => {
    expect(groupFieldProvenance(tree, OWNER).path).toBe(OWNER);
    expect(groupFieldProvenance(tree, SYMBOL).path).toBe(SYMBOL);
  });

  it('the entry itself is untouched by either query', () => {
    groupFieldProvenance(tree, OWNER);
    groupFieldProvenance(tree, SYMBOL);

    expect(ADMIN_LINE).toEqual({
      kind: 'range',
      range: { start: 201, end: 201 },
      paths: [OWNER, SYMBOL],
      secondaryPaths: [SYMBOL],
    });
  });
});

// ---------------------------------------------------------------------------
// INV-8: `file` and `created` rows can never be demoted, and there is no
// absent state on the wizard side to coalesce
// ---------------------------------------------------------------------------

describe('toRows — the non-range kinds are primary by their type (INV-8)', () => {
  it('a whole-file row is primary even when the file also holds a marked range for another field', () => {
    const result = groupFieldProvenance(
      source({
        [CONTRACT]: [{ kind: 'file', paths: [NAME] }, marked(11, 18, [SYMBOL], [SYMBOL])],
      }),
      NAME
    );

    expect(result.groups[0]?.rows).toEqual([{ kind: 'file', significance: 'primary' }]);
  });

  it('a created row is primary', () => {
    const result = groupFieldProvenance(
      source({ [CONTRACT]: [{ kind: 'created', paths: [NAME] }] }),
      NAME
    );

    expect(result.groups[0]?.rows).toEqual([{ kind: 'created', significance: 'primary' }]);
  });

  it('a mark smuggled onto a `file` entry is answered `false` by the rule and renders primary', () => {
    // The type forbids this and the loader drops it (SF-10), but the rule is the
    // last line of defence: `isSecondaryAttribution` returns `false` for every
    // non-range kind, so even a bypassing fixture cannot demote a whole file.
    const hostile: ProvenanceEntry = JSON.parse(
      JSON.stringify({ kind: 'file', paths: [NAME], secondaryPaths: [NAME] })
    );
    const result = groupFieldProvenance(source({ [CONTRACT]: [hostile] }), NAME);

    expect(isSecondaryAttribution(hostile, NAME)).toBe(false);
    expect(result.groups[0]?.rows).toEqual([{ kind: 'file', significance: 'primary' }]);
  });

  it.each(QUERIES)('%s: every row carries a significance — never undefined', (query) => {
    for (const g of groupFieldProvenance(source(CORPUS), query).groups) {
      for (const row of g.rows) {
        expect(['primary', 'secondary']).toContain(row.significance);
      }
    }
  });

  it.each(QUERIES)('%s: only ranged rows are ever secondary', (query) => {
    for (const g of groupFieldProvenance(source(CORPUS), query).groups) {
      for (const row of g.rows) {
        if (row.significance === 'secondary') expect(row.kind).toBe('range');
      }
    }
  });
});
