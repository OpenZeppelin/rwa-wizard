import { describe, expect, it, vi } from 'vitest';

import type { FileTree } from '@openzeppelin/codegen-core';

import { completeDraft } from '../../test/helpers/previewConfig';
import { diffChangedPaths } from './diffChangedPaths';
import * as fileContentsEqualModule from './fileContentsEqual';
import { listChangedPaths } from './listChangedPaths';
import { createStepFileTreeSnapshot } from './stepFileTreeSnapshot';

function tree(entries: FileTree): FileTree {
  return { ...entries };
}

describe('listChangedPaths null snapshot (INV-5)', () => {
  it('returns [] when snapshot is null regardless of current tree or hash', () => {
    const current = tree({ 'config.json': '{"changed":true}' });
    expect(listChangedPaths(null, current, 'any-hash')).toEqual([]);
    expect(listChangedPaths(null, current, 'same-as-would-be')).toEqual([]);
    expect(listChangedPaths(null, {}, 'hash')).toEqual([]);
  });
});

describe('listChangedPaths config-hash fast path (INV-6, INV-13)', () => {
  it('returns [] when currentConfigHash equals snapshot.configHash without byte comparison', () => {
    const spy = vi.spyOn(fileContentsEqualModule, 'fileContentsEqual');
    const previewConfig = completeDraft();
    const snapshot = createStepFileTreeSnapshot(tree({ 'a.txt': 'baseline' }), previewConfig);
    const current = tree({ 'a.txt': 'different bytes but hash says equal' });

    const result = listChangedPaths(snapshot, current, snapshot.configHash);

    expect(result, 'INV-6: identical hash must yield empty changed set').toEqual([]);
    expect(spy, 'INV-13: hash match must skip fileContentsEqual').not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('returns exactly diffChangedPaths when hashes differ', () => {
    const baseline = tree({ 'deploy.sh': 'v1', 'README.md': 'same' });
    const current = tree({ 'deploy.sh': 'v2', 'README.md': 'same' });
    const snapshot = createStepFileTreeSnapshot(baseline, completeDraft());
    const expected = diffChangedPaths(baseline, current);

    expect(
      listChangedPaths(snapshot, current, 'hash-that-differs-from-snapshot'),
      'INV-6: differing hash must delegate to diff unchanged'
    ).toEqual(expected);
    expect(expected).toEqual(['deploy.sh']);
  });

  it('agrees with diff across fixtures: hashEqual ? [] : diffChangedPaths', () => {
    const baseline = tree({
      'config.json': '{}',
      'deploy.sh': 'base',
      'README.md': 'readme',
    });

    const fixtures: Array<{
      name: string;
      current: FileTree;
      currentHash: string;
      snapshotHash: string;
    }> = [
      {
        name: 'unchanged tree',
        current: tree({ ...baseline }),
        currentHash: 'hash-a',
        snapshotHash: 'hash-a',
      },
      {
        name: 'one file edited',
        current: tree({ ...baseline, 'config.json': '{"changed":true}' }),
        currentHash: 'hash-b',
        snapshotHash: 'hash-a',
      },
      {
        name: 'file added',
        current: tree({ ...baseline, 'new.txt': 'added' }),
        currentHash: 'hash-c',
        snapshotHash: 'hash-a',
      },
      {
        name: 'empty current',
        current: {},
        currentHash: 'hash-d',
        snapshotHash: 'hash-a',
      },
    ];

    for (const fixture of fixtures) {
      const snapshot = { files: baseline, configHash: fixture.snapshotHash };
      const diff = diffChangedPaths(baseline, fixture.current);
      const expected = fixture.currentHash === fixture.snapshotHash ? [] : diff;

      expect(
        listChangedPaths(snapshot, fixture.current, fixture.currentHash),
        `INV-6 fixture "${fixture.name}"`
      ).toEqual(expected);
    }
  });

  it('documents generator contract: forced equal hash with differing bytes yields [] while diff would not', () => {
    const baseline = tree({ 'config.json': 'entry', 'deploy.sh': 'entry' });
    const current = tree({ 'config.json': 'edited', 'deploy.sh': 'entry' });
    const snapshot = { files: baseline, configHash: 'forced-equal' };

    const slowPath = diffChangedPaths(baseline, current);
    expect(slowPath, 'sanity: byte diff detects the config.json edit').toEqual(['config.json']);

    expect(
      listChangedPaths(snapshot, current, 'forced-equal'),
      'INV-6: fast path trusts hash; silent disagreement here would hide marks (generator/hash contract)'
    ).toEqual([]);

    expect(slowPath.length).toBeGreaterThan(0);
  });
});

describe('listChangedPaths slow-path delegation (INV-1, INV-10)', () => {
  it('only returns paths present in current', () => {
    const baseline = tree({ 'gone.txt': 'only in baseline', 'stay.txt': 'same' });
    const current = tree({ 'stay.txt': 'changed' });
    const snapshot = createStepFileTreeSnapshot(baseline, completeDraft());

    expect(listChangedPaths(snapshot, current, 'different-hash')).toEqual(['stay.txt']);
  });

  it('is pure: repeated calls with the same inputs yield equal arrays', () => {
    const snapshot = createStepFileTreeSnapshot(tree({ 'a.txt': '1' }), completeDraft());
    const current = tree({ 'a.txt': '2' });
    const hash = 'other-hash';
    expect(listChangedPaths(snapshot, current, hash)).toEqual(
      listChangedPaths(snapshot, current, hash)
    );
  });
});
