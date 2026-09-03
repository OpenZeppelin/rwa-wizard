import { describe, expect, it, vi } from 'vitest';

import type { FileTree } from '@openzeppelin/codegen-core';

import { diffChangedPaths } from './diffChangedPaths';
import * as fileContentsEqualModule from './fileContentsEqual';
import { listChangedPaths } from './listChangedPaths';
import { createStepFileTreeSnapshot } from './stepFileTreeSnapshot';

function tree(entries: FileTree): FileTree {
  return { ...entries };
}

/** Same config, same service — only the identity-support generate option differs. */
const KEY_IDENTITY_OFF = 'config-a|identity:0|service:svc-1';
const KEY_IDENTITY_ON = 'config-a|identity:1|service:svc-1';
/** Same config, same options — only the service differs. */
const KEY_OTHER_SERVICE = 'config-a|identity:0|service:svc-2';

describe('listChangedPaths null snapshot (INV-5)', () => {
  it('returns [] when snapshot is null regardless of current tree or key', () => {
    const current = tree({ 'config.json': '{"changed":true}' });
    expect(listChangedPaths(null, current, 'any-key')).toEqual([]);
    expect(listChangedPaths(null, current, 'same-as-would-be')).toEqual([]);
    expect(listChangedPaths(null, {}, 'key')).toEqual([]);
  });
});

describe('listChangedPaths generate-key fast path (INV-6, INV-13)', () => {
  it('returns [] when currentGenerateKey equals snapshot.generateKey without byte comparison', () => {
    const spy = vi.spyOn(fileContentsEqualModule, 'fileContentsEqual');
    const snapshot = createStepFileTreeSnapshot(tree({ 'a.txt': 'baseline' }), KEY_IDENTITY_OFF);
    const current = tree({ 'a.txt': 'different bytes but key says equal' });

    const result = listChangedPaths(snapshot, current, snapshot.generateKey);

    expect(result, 'INV-6: identical key must yield empty changed set').toEqual([]);
    expect(spy, 'INV-13: key match must skip fileContentsEqual').not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('returns exactly diffChangedPaths when keys differ', () => {
    const baseline = tree({ 'deploy.sh': 'v1', 'README.md': 'same' });
    const current = tree({ 'deploy.sh': 'v2', 'README.md': 'same' });
    const snapshot = createStepFileTreeSnapshot(baseline, KEY_IDENTITY_OFF);
    const expected = diffChangedPaths(baseline, current);

    expect(
      listChangedPaths(snapshot, current, 'key-that-differs-from-snapshot'),
      'INV-6: differing key must delegate to diff unchanged'
    ).toEqual(expected);
    expect(expected).toEqual(['deploy.sh']);
  });

  /**
   * The key previously fronted the config hash alone. Each case here holds the
   * config fixed and varies exactly one of the other generate inputs, which is
   * the only way a key that ignores that dimension can be caught: with the
   * config-only key both of these returned `[]` and the change marks vanished.
   */
  describe('dimensions the key must cover beyond the config', () => {
    const baseline = tree({ 'contracts/token.rs': 'v1' });
    const current = tree({
      'contracts/token.rs': 'v1',
      'contracts/identity.rs': 'added by identity support',
    });

    it('marks changes when only the identity-support option differs', () => {
      const snapshot = createStepFileTreeSnapshot(baseline, KEY_IDENTITY_OFF);

      expect(listChangedPaths(snapshot, current, KEY_IDENTITY_ON)).toEqual([
        'contracts/identity.rs',
      ]);
    });

    it('marks changes when only the codegen service differs', () => {
      const snapshot = createStepFileTreeSnapshot(baseline, KEY_IDENTITY_OFF);

      expect(listChangedPaths(snapshot, current, KEY_OTHER_SERVICE)).toEqual([
        'contracts/identity.rs',
      ]);
    });
  });

  it('agrees with diff across fixtures: keyEqual ? [] : diffChangedPaths', () => {
    const baseline = tree({
      'config.json': '{}',
      'deploy.sh': 'base',
      'README.md': 'readme',
    });

    const fixtures: Array<{
      name: string;
      current: FileTree;
      currentKey: string;
      snapshotKey: string;
    }> = [
      {
        name: 'unchanged tree',
        current: tree({ ...baseline }),
        currentKey: 'key-a',
        snapshotKey: 'key-a',
      },
      {
        name: 'one file edited',
        current: tree({ ...baseline, 'config.json': '{"changed":true}' }),
        currentKey: 'key-b',
        snapshotKey: 'key-a',
      },
      {
        name: 'file added',
        current: tree({ ...baseline, 'new.txt': 'added' }),
        currentKey: 'key-c',
        snapshotKey: 'key-a',
      },
      {
        name: 'empty current',
        current: {},
        currentKey: 'key-d',
        snapshotKey: 'key-a',
      },
    ];

    for (const fixture of fixtures) {
      const snapshot = { files: baseline, generateKey: fixture.snapshotKey };
      const diff = diffChangedPaths(baseline, fixture.current);
      const expected = fixture.currentKey === fixture.snapshotKey ? [] : diff;

      expect(
        listChangedPaths(snapshot, fixture.current, fixture.currentKey),
        `INV-6 fixture "${fixture.name}"`
      ).toEqual(expected);
    }
  });

  it('documents generator contract: forced equal key with differing bytes yields [] while diff would not', () => {
    const baseline = tree({ 'config.json': 'entry', 'deploy.sh': 'entry' });
    const current = tree({ 'config.json': 'edited', 'deploy.sh': 'entry' });
    const snapshot = { files: baseline, generateKey: 'forced-equal' };

    const slowPath = diffChangedPaths(baseline, current);
    expect(slowPath, 'sanity: byte diff detects the config.json edit').toEqual(['config.json']);

    expect(
      listChangedPaths(snapshot, current, 'forced-equal'),
      'INV-6: fast path trusts the key; a key missing an input hides marks (generator/key contract)'
    ).toEqual([]);

    expect(slowPath.length).toBeGreaterThan(0);
  });
});

describe('listChangedPaths slow-path delegation (INV-1, INV-10)', () => {
  it('only returns paths present in current', () => {
    const baseline = tree({ 'gone.txt': 'only in baseline', 'stay.txt': 'same' });
    const current = tree({ 'stay.txt': 'changed' });
    const snapshot = createStepFileTreeSnapshot(baseline, KEY_IDENTITY_OFF);

    expect(listChangedPaths(snapshot, current, 'different-key')).toEqual(['stay.txt']);
  });

  it('is pure: repeated calls with the same inputs yield equal arrays', () => {
    const snapshot = createStepFileTreeSnapshot(tree({ 'a.txt': '1' }), KEY_IDENTITY_OFF);
    const current = tree({ 'a.txt': '2' });
    const key = 'other-key';
    expect(listChangedPaths(snapshot, current, key)).toEqual(
      listChangedPaths(snapshot, current, key)
    );
  });
});
