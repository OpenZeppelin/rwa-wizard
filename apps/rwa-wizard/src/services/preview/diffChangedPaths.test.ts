import { describe, expect, it } from 'vitest';

import type { FileTree } from '@openzeppelin/codegen-core';

import { diffChangedPaths } from './diffChangedPaths';

function tree(entries: FileTree): FileTree {
  return { ...entries };
}

describe('diffChangedPaths content rules (INV-1, INV-2)', () => {
  it('includes paths only present in current (added files)', () => {
    const baseline = tree({ 'README.md': 'same' });
    const current = tree({
      'README.md': 'same',
      'compliance/supply-limit/src/lib.rs': 'new module',
    });

    expect(diffChangedPaths(baseline, current)).toEqual(['compliance/supply-limit/src/lib.rs']);
  });

  it('includes paths whose contents changed and excludes equal paths', () => {
    const baseline = tree({
      'config.json': '{"name":"old"}',
      'deploy.sh': '#!/bin/sh',
      'README.md': 'old readme',
    });
    const current = tree({
      'config.json': '{"name":"new"}',
      'deploy.sh': '#!/bin/sh',
      'README.md': 'old readme',
    });

    expect(diffChangedPaths(baseline, current), 'INV-2: only config.json content changed').toEqual([
      'config.json',
    ]);
  });

  it('never emits baseline-only paths (removed files)', () => {
    const baseline = tree({
      'config.json': '{}',
      'removed-only.txt': 'gone from current',
    });
    const current = tree({ 'config.json': '{}' });

    expect(
      diffChangedPaths(baseline, current),
      'INV-1: removed baseline paths are not in current keys'
    ).toEqual([]);
  });

  it('marks every current path when baseline is empty', () => {
    const current = tree({
      'config.json': '{}',
      'deploy.sh': 'script',
    });

    expect(diffChangedPaths({}, current)).toEqual(['config.json', 'deploy.sh']);
  });
});

describe('diffChangedPaths blast-radius fixtures (INV-2)', () => {
  const sharedUnchanged = {
    'rwa-token/src/contract.rs': 'contract body unchanged',
    'Cargo.toml': '[workspace]',
  };

  it('identity-only edit touches deploy/config/readme, not contract.rs', () => {
    const baseline = tree({
      ...sharedUnchanged,
      'deploy.sh': 'identity off',
      'config.json': '{"identity":false}',
      'README.md': 'identity readme',
    });
    const current = tree({
      ...sharedUnchanged,
      'deploy.sh': 'identity on',
      'config.json': '{"identity":true}',
      'README.md': 'identity readme v2',
    });

    const changed = diffChangedPaths(baseline, current);
    expect(changed).toEqual(['README.md', 'config.json', 'deploy.sh']);
    expect(changed.some((path) => path.includes('contract.rs'))).toBe(false);
  });

  it('compliance module add marks new module files plus shared manifests', () => {
    const baseline = tree({
      ...sharedUnchanged,
      'deploy.sh': 'base',
      'config.json': '{}',
      'README.md': 'base',
    });
    const current = tree({
      ...sharedUnchanged,
      'compliance/supply-limit/src/lib.rs': 'module',
      'compliance/supply-limit/Cargo.toml': '[package]',
      'compliance/supply-limit/README.md': 'module readme',
      'deploy.sh': 'with module',
      'config.json': '{"modules":["supply-limit"]}',
      'README.md': 'with module',
    });

    const changed = diffChangedPaths(baseline, current);
    expect(changed).toEqual([
      'README.md',
      'compliance/supply-limit/Cargo.toml',
      'compliance/supply-limit/README.md',
      'compliance/supply-limit/src/lib.rs',
      'config.json',
      'deploy.sh',
    ]);
  });
});

describe('diffChangedPaths ordering and edge cases (INV-3, INV-8, INV-10, INV-14)', () => {
  it('returns lexicographically sorted paths regardless of input key order', () => {
    const baseline = tree({ 'z.txt': 'a', 'm.txt': 'a' });
    const current = tree({ 'b.txt': 'new', 'z.txt': 'b', 'm.txt': 'a' });

    expect(diffChangedPaths(baseline, current)).toEqual(['b.txt', 'z.txt']);
  });

  it('is pure: repeated calls with the same inputs yield equal arrays', () => {
    const baseline = tree({ 'a.txt': '1' });
    const current = tree({ 'a.txt': '2', 'b.txt': '3' });
    const first = diffChangedPaths(baseline, current);
    const second = diffChangedPaths(baseline, current);
    expect(first).toEqual(second);
    expect(first).toEqual(['a.txt', 'b.txt']);
  });

  it('returns [] for empty current even when baseline is populated (INV-14)', () => {
    const baseline = tree({ 'config.json': '{}', 'deploy.sh': 'script' });
    expect(diffChangedPaths(baseline, {})).toEqual([]);
  });

  it('does not throw for empty trees', () => {
    expect(() => diffChangedPaths({}, {})).not.toThrow();
  });
});
