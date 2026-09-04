import { describe, expect, it } from 'vitest';

import type { FileProvenanceGroup } from '../../../services/preview';
import {
  createdRow,
  fileRow,
  group,
  mixedGroups,
  rangeRow,
  tallGroups,
} from '../../../test/helpers/impactHarness';
import { toImpactGroups } from './fieldImpactView';

/**
 * The partition. Everything here is about what the column must NOT do to the
 * rows it is handed: not merge them, not cap them, not re-index them, not hide a
 * file, and not decide significance for itself.
 */
describe('toImpactGroups', () => {
  // -------------------------------------------------------------------------
  // INV-4 — one row per site, no merging, no capping, equal standing
  // -------------------------------------------------------------------------
  describe('conserves every site (INV-4)', () => {
    it('renders the measured worst case in full — 22 rows over two files', () => {
      const views = toImpactGroups(tallGroups());
      const rows = views.reduce(
        (total, view) => total + view.primary.length + view.secondary.length,
        0
      );
      expect(rows).toBe(22);
      expect(views[0]!.primary).toHaveLength(20);
      expect(views[1]!.primary).toHaveLength(2);
    });

    it('keeps two ranges that share a startLine but differ in endLine as two rows', () => {
      // A "dedupe" that keys on the start line would silently answer 1 where the
      // generator reported 2, and the column would be confidently wrong in a way
      // indistinguishable from a correct answer.
      const views = toImpactGroups([group('a.rs', [rangeRow(10, 12), rangeRow(10, 40)])]);
      expect(views[0]!.primary).toHaveLength(2);
      expect(views[0]!.primary.map((entry) => entry.row)).toEqual([
        rangeRow(10, 12),
        rangeRow(10, 40),
      ]);
    });

    it('keeps two identical rows as two rows', () => {
      const views = toImpactGroups([group('a.rs', [rangeRow(10, 12), rangeRow(10, 12)])]);
      expect(views[0]!.primary).toHaveLength(2);
    });

    it('gives file, created and range rows equal standing in one list', () => {
      const views = toImpactGroups([group('a.rs', [createdRow(), fileRow(), rangeRow(3, 4)])]);
      expect(views[0]!.primary.map((entry) => entry.row.kind)).toEqual([
        'created',
        'file',
        'range',
      ]);
      expect(views[0]!.secondary).toHaveLength(0);
    });

    it('preserves the seam order inside each partition', () => {
      const views = toImpactGroups(mixedGroups());
      expect(views[0]!.primary.map((entry) => entry.rowIndex)).toEqual([0, 2]);
      expect(views[0]!.secondary.map((entry) => entry.rowIndex)).toEqual([1, 3]);
    });

    it('scales linearly past the worst case without capping', () => {
      const many = Array.from({ length: 250 }, (_, index) => rangeRow(index + 1, index + 1));
      const views = toImpactGroups([group('a.rs', many)]);
      expect(views[0]!.primary).toHaveLength(250);
    });
  });

  // -------------------------------------------------------------------------
  // INV-5 clause 1 — the index is captured before the partition
  // -------------------------------------------------------------------------
  describe('pairs each row with its unpartitioned index (INV-5)', () => {
    it('does not re-index within a partition — the collision is unrepresentable', () => {
      // Per-partition indices make primary[0] and secondary[0] both `path#0`.
      // React then reuses one row's DOM node for the other, and activating a
      // row under "Mentions" reveals a different site's range. Nothing
      // throws, and it reproduces only for a file with mixed significance.
      const views = toImpactGroups(mixedGroups());
      const view = views[0]!;
      expect(view.primary.map((entry) => entry.rowIndex)).toEqual([0, 2]);
      expect(view.secondary.map((entry) => entry.rowIndex)).toEqual([1, 3]);
    });

    it('yields keys unique across the whole rendered list', () => {
      // Distinct paths, as the seam emits them: one group per file. The union
      // must produce one key per site with no collision between the two lists a
      // mixed file contributes to.
      const views = toImpactGroups([
        ...mixedGroups(),
        group('contracts/rwa-token/src/contract.rs', [
          rangeRow(1, 4),
          rangeRow(9, 9, 'secondary'),
          rangeRow(20, 26),
        ]),
      ]);
      const keys = views.flatMap((view) =>
        [...view.primary, ...view.secondary].map((entry) => `${view.path}#${entry.rowIndex}`)
      );
      expect(keys).toHaveLength(7);
      expect(new Set(keys).size, 'duplicate row keys').toBe(keys.length);
    });

    it('keeps indices aligned with the input array for a secondary-first file', () => {
      const views = toImpactGroups([
        group('a.rs', [rangeRow(1, 1, 'secondary'), rangeRow(2, 2), rangeRow(3, 3, 'secondary')]),
      ]);
      expect(views[0]!.secondary.map((entry) => entry.rowIndex)).toEqual([0, 2]);
      expect(views[0]!.primary.map((entry) => entry.rowIndex)).toEqual([1]);
    });
  });

  // -------------------------------------------------------------------------
  // INV-6 — no filter of its own
  // -------------------------------------------------------------------------
  describe('adds no hiding rule of its own (INV-6)', () => {
    it('renders every group it is handed, one-to-one and in order', () => {
      const input: readonly FileProvenanceGroup[] = [
        group('README.md', [fileRow()]),
        group('docs/GUIDE.md', [fileRow()]),
        group('contracts/rwa-token/src/contract.rs', [rangeRow(1, 2)]),
      ];
      const views = toImpactGroups(input);
      expect(views.map((view) => view.path)).toEqual(input.map((entry) => entry.path));
    });

    it('does not drop a markdown file the seam chose to include', () => {
      // File hiding is entirely the seam's, asked once at `groupFieldProvenance`.
      // A second rule here diverges the day a generator adds a kind, and the
      // user sees a file the tree shows but the column says their field misses.
      const views = toImpactGroups([group('README.md', [fileRow()])]);
      expect(views).toHaveLength(1);
      expect(views[0]!.leaf).toBe('README.md');
    });

    it('does not drop a group whose declared kind is the hidden one', () => {
      // `provenance-and-docs` is the kind the seam hides. If it reaches the
      // column at all, the seam decided to send it, and re-deciding here is what
      // makes the two rules diverge.
      const docs: FileProvenanceGroup = {
        path: 'docs/DEPLOY.md',
        kind: 'provenance-and-docs',
        rows: [createdRow()],
      };
      expect(toImpactGroups([docs])).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // INV-8 — significance is read, never computed
  // -------------------------------------------------------------------------
  describe('reads significance and never computes it (INV-8)', () => {
    it('keeps a row primary when declared primary, whatever its file is called', () => {
      // SF-11 AS-4's no-branch-on-text rule, asserted at the consuming end: a
      // shell script is exactly as primary as a contract when the query says so.
      const views = toImpactGroups([group('scripts/deploy.sh', [rangeRow(4, 4)])]);
      expect(views[0]!.primary).toHaveLength(1);
      expect(views[0]!.secondary).toHaveLength(0);
    });

    it('keeps a row secondary when declared secondary, in a contract source file', () => {
      const views = toImpactGroups([
        group('contracts/rwa-token/src/contract.rs', [rangeRow(4, 4, 'secondary')]),
      ]);
      expect(views[0]!.secondary).toHaveLength(1);
      expect(views[0]!.primary).toHaveLength(0);
    });

    it('treats file and created rows as primary — the literal the types pin', () => {
      const views = toImpactGroups([group('a.rs', [fileRow()]), group('b.rs', [createdRow()])]);
      expect(views[0]!.primary).toHaveLength(1);
      expect(views[1]!.primary).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // INV-3 — subtractive presentation
  // -------------------------------------------------------------------------
  describe('is subtractive (INV-3)', () => {
    it('produces an empty secondary side for an all-primary field', () => {
      // The measured worst case is all primary, so the busiest field must read
      // exactly as it would with no significance axis at all.
      for (const view of toImpactGroups(tallGroups())) {
        expect(view.secondary).toHaveLength(0);
      }
    });

    it('never invents a secondary side', () => {
      const views = toImpactGroups([group('a.rs', [fileRow(), createdRow(), rangeRow(1, 2)])]);
      expect(views.every((view) => view.secondary.length === 0)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // INV-22 — cost is linear in the site count
  // -------------------------------------------------------------------------
  describe('is linear in the site count (INV-22)', () => {
    it('reads each input row exactly once', () => {
      const rows = Array.from({ length: 40 }, (_, index) => rangeRow(index + 1, index + 1));
      const reads = new Map<number, number>();
      const watched = rows.map(
        (row, index) =>
          new Proxy(row, {
            get(target, property, receiver) {
              if (property === 'significance') reads.set(index, (reads.get(index) ?? 0) + 1);
              return Reflect.get(target, property, receiver);
            },
          })
      );

      toImpactGroups([group('a.rs', watched)]);

      expect(reads.size, 'every row must be visited').toBe(rows.length);
      expect(
        [...reads.values()].every((count) => count === 1),
        'one pass, not two'
      ).toBe(true);
    });

    it('is a one-to-one map over the group array', () => {
      const input = [...tallGroups(), ...mixedGroups()];
      expect(toImpactGroups(input)).toHaveLength(input.length);
    });
  });

  it('splits the path for the two-line heading on every group', () => {
    const views = toImpactGroups(tallGroups());
    expect(views[0]).toMatchObject({
      path: 'contracts/rwa-token/src/contract.rs',
      directory: 'contracts/rwa-token/src',
      leaf: 'contract.rs',
    });
    expect(views[1]).toMatchObject({ directory: 'scripts', leaf: 'deploy.sh' });
  });

  it('is total for an empty input', () => {
    expect(toImpactGroups([])).toEqual([]);
  });
});
