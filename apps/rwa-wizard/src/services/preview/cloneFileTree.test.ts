import { describe, expect, it } from 'vitest';

import type { FileTree } from '@openzeppelin/codegen-core';

import { cloneFileTree } from './cloneFileTree';

describe('cloneFileTree snapshot isolation (INV-9)', () => {
  it('returns a new top-level object', () => {
    const original: FileTree = { 'README.md': 'readme' };
    const copy = cloneFileTree(original);
    expect(copy).not.toBe(original);
    expect(copy).toEqual(original);
  });

  it('reuses string instances but isolates the map from key add/remove', () => {
    const shared = 'shared string';
    const original: FileTree = { 'a.txt': shared };
    const copy = cloneFileTree(original);

    expect(copy['a.txt']).toBe(shared);
    original['b.txt'] = 'added';
    delete original['a.txt'];
    expect(copy).toEqual({ 'a.txt': shared });
  });

  it('copies Uint8Array values into a new buffer', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const original: FileTree = { 'bin.dat': bytes };
    const copy = cloneFileTree(original);

    expect(copy['bin.dat']).not.toBe(bytes);
    expect(copy['bin.dat']).toEqual(bytes);
    (copy['bin.dat'] as Uint8Array)[0] = 99;
    expect(bytes[0]).toBe(1);
  });

  it('isolates snapshot from later in-place mutation of string values', () => {
    const original: FileTree = { 'config.json': '{"v":1}' };
    const copy = cloneFileTree(original);
    original['config.json'] = '{"v":2}';
    expect(copy['config.json']).toBe('{"v":1}');
  });
});
