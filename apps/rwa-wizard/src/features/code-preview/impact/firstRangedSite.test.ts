import { describe, expect, it } from 'vitest';

import {
  createdRow,
  fileRow,
  group,
  mixedGroups,
  rangeRow,
} from '../../../test/helpers/impactHarness';
import { tokenPaths } from '../../wizard/config-path';
import { toImpactGroups } from './fieldImpactView';
import { firstRangedSite, resolveActiveRangedSite, resolveActiveSite } from './firstRangedSite';

/**
 * SF-21 INV-4 / INV-5 / INV-10 / INV-15 — the pure finder and site resolver.
 *
 * Auto-select's correctness bottoms out here: wrong display-order walk → wrong
 * first site; consolation `file`/`created` return → AS-3 broken; identity by
 * line numbers → yank after regeneration.
 */

describe('firstRangedSite (SF-21 INV-4)', () => {
  it('returns null for empty groups — INV-4 empty → null', () => {
    expect(firstRangedSite([])).toBeNull();
  });

  it('returns null when every row is file or created — INV-4 / INV-10 AS-3', () => {
    const views = toImpactGroups([
      group('contracts/a.rs', [fileRow(), createdRow()]),
      group('scripts/deploy.sh', [fileRow()]),
    ]);
    expect(
      firstRangedSite(views),
      'file/created-only groups must not synthesise a consolation jump'
    ).toBeNull();
  });

  it('returns the first primary range before any secondary — INV-4 display order', () => {
    // mixedGroups: primary at indices 0,2; secondary at 1,3. First primary wins
    // even though a secondary sits earlier in the unpartitioned list.
    const views = toImpactGroups(mixedGroups());
    expect(firstRangedSite(views)).toEqual({
      filePath: 'scripts/deploy.sh',
      rowIndex: 0,
      range: { startLine: 12, endLine: 18 },
    });
  });

  it('falls through to the first secondary when primary has no range — INV-4', () => {
    const views = toImpactGroups([
      group('a.rs', [fileRow(), rangeRow(9, 11, 'secondary'), rangeRow(20, 22, 'secondary')]),
    ]);
    expect(firstRangedSite(views)).toEqual({
      filePath: 'a.rs',
      rowIndex: 1,
      range: { startLine: 9, endLine: 11 },
    });
  });

  it('skips leading file/created in primary and takes the first range — INV-4', () => {
    const views = toImpactGroups([
      group('a.rs', [createdRow(), fileRow(), rangeRow(3, 4), rangeRow(10, 12)]),
    ]);
    expect(firstRangedSite(views)).toEqual({
      filePath: 'a.rs',
      rowIndex: 2,
      range: { startLine: 3, endLine: 4 },
    });
  });

  it('prefers an earlier group over a later group with smaller line numbers — INV-4', () => {
    // Display order is group array order, not startLine sort. A later file's
    // line 1 must not beat an earlier file's line 100.
    const views = toImpactGroups([
      group('contracts/late-lines.rs', [rangeRow(100, 110)]),
      group('scripts/early-lines.sh', [rangeRow(1, 2)]),
    ]);
    expect(firstRangedSite(views)).toEqual({
      filePath: 'contracts/late-lines.rs',
      rowIndex: 0,
      range: { startLine: 100, endLine: 110 },
    });
  });

  it('never returns a file or created row even when they precede ranges in another group', () => {
    const views = toImpactGroups([
      group('README.md', [createdRow(), fileRow()]),
      group('scripts/deploy.sh', [rangeRow(12, 18)]),
    ]);
    const site = firstRangedSite(views);
    expect(site?.filePath).toBe('scripts/deploy.sh');
    expect(site?.range).toEqual({ startLine: 12, endLine: 18 });
  });
});

describe('resolveActiveRangedSite (SF-21 INV-5)', () => {
  const subject = tokenPaths.name;

  it('resolves the same (filePath, rowIndex) after every range shifts by N — INV-5', () => {
    // Identity is not line numbers. After regeneration the site still resolves
    // and carries the *new* range (SF-13 refresh split / INV-5).
    const before = toImpactGroups(mixedGroups());
    const site = {
      configPath: subject,
      filePath: 'scripts/deploy.sh',
      rowIndex: 2,
      rowKind: 'range' as const,
    };
    expect(resolveActiveRangedSite(before, site)).toEqual({
      filePath: 'scripts/deploy.sh',
      rowIndex: 2,
      range: { startLine: 41, endLine: 47 },
    });

    const after = toImpactGroups([
      group('scripts/deploy.sh', [
        rangeRow(22, 28),
        rangeRow(30, 30, 'secondary'),
        rangeRow(51, 57),
        rangeRow(62, 65, 'secondary'),
      ]),
    ]);
    expect(resolveActiveRangedSite(after, site)).toEqual({
      filePath: 'scripts/deploy.sh',
      rowIndex: 2,
      range: { startLine: 51, endLine: 57 },
    });
  });

  it('returns null when the site is gone from the groups — INV-5 boundary', () => {
    const views = toImpactGroups([group('scripts/deploy.sh', [fileRow()])]);
    expect(
      resolveActiveRangedSite(views, {
        configPath: subject,
        filePath: 'scripts/deploy.sh',
        rowIndex: 0,
        rowKind: 'range',
      })
    ).toBeNull();
  });

  it('returns null when the site still exists but is no longer a range — INV-5 failure', () => {
    // Same index, kind flipped to file — must not synthesise a range jump.
    const views = toImpactGroups([group('scripts/deploy.sh', [fileRow(), rangeRow(1, 2)])]);
    expect(
      resolveActiveRangedSite(views, {
        configPath: subject,
        filePath: 'scripts/deploy.sh',
        rowIndex: 0,
        rowKind: 'range',
      }),
      'a non-range at the remembered index must not resolve as ranged'
    ).toBeNull();
  });

  it('returns null when the file path is absent — INV-5 failure', () => {
    const views = toImpactGroups(mixedGroups());
    expect(
      resolveActiveRangedSite(views, {
        configPath: subject,
        filePath: 'contracts/missing.rs',
        rowIndex: 0,
        rowKind: 'range',
      })
    ).toBeNull();
  });

  it('resolves a secondary-partition site by unpartitioned rowIndex — INV-5', () => {
    const views = toImpactGroups(mixedGroups());
    expect(
      resolveActiveRangedSite(views, {
        configPath: subject,
        filePath: 'scripts/deploy.sh',
        rowIndex: 1,
        rowKind: 'range',
      })
    ).toEqual({
      filePath: 'scripts/deploy.sh',
      rowIndex: 1,
      range: { startLine: 20, endLine: 20 },
    });
  });
});

describe('resolveActiveSite (SF-21 INV-5 / B-2)', () => {
  const subject = tokenPaths.name;

  it('resolves a file row by (filePath, rowIndex, rowKind)', () => {
    const views = toImpactGroups([group('README.md', [fileRow(), rangeRow(1, 2)])]);
    expect(
      resolveActiveSite(views, {
        configPath: subject,
        filePath: 'README.md',
        rowIndex: 0,
        rowKind: 'file',
      })
    ).toEqual({
      filePath: 'README.md',
      rowIndex: 0,
      row: fileRow(),
    });
  });

  it('returns null when rowKind no longer matches — file/created must not upgrade to range', () => {
    const views = toImpactGroups([group('README.md', [rangeRow(1, 2)])]);
    expect(
      resolveActiveSite(views, {
        configPath: subject,
        filePath: 'README.md',
        rowIndex: 0,
        rowKind: 'file',
      })
    ).toBeNull();
  });
});

describe('finder purity (SF-21 INV-15)', () => {
  it('firstRangedSite and resolveActiveRangedSite are synchronous pure walks', () => {
    // Behavioural half of INV-15: no throw, deterministic, no mutation of input.
    const views = toImpactGroups(mixedGroups());
    const frozen = structuredClone(views);
    const a = firstRangedSite(views);
    const b = firstRangedSite(views);
    expect(a).toEqual(b);
    expect(views).toEqual(frozen);
    expect(
      resolveActiveRangedSite(views, {
        configPath: tokenPaths.name,
        filePath: a!.filePath,
        rowIndex: a!.rowIndex,
        rowKind: 'range',
      })
    ).toEqual(a);
  });
});
