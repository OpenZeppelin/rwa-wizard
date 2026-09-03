import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import {
  cloneFileTree,
  createStepFileTreeSnapshot,
  diffChangedPaths,
  fileContentsEqual,
  listChangedPaths,
} from './index';

const PREVIEW_DIR = dirname(fileURLToPath(import.meta.url));

const STEP_MARKER_SOURCES = [
  'cloneFileTree.ts',
  'diffChangedPaths.ts',
  'fileContentsEqual.ts',
  'listChangedPaths.ts',
  'stepFileTreeSnapshot.ts',
] as const;

const FORBIDDEN_IMPORT = /(?:from\s+|import\s*\(\s*)['"]@openzeppelin\/codegen-rwa-stellar['"]/;

/** Opaque to these helpers — they only ever compare it for equality. */
const ENTRY_KEY = 'config-a|identity:0|service:svc-1';

describe('preview step-marker module boundary (INV-11, INV-16)', () => {
  it('step-marker modules do not import @openzeppelin/codegen-rwa-stellar', () => {
    const violations: string[] = [];
    for (const file of STEP_MARKER_SOURCES) {
      const source = readFileSync(join(PREVIEW_DIR, file), 'utf8');
      const hits = source.split('\n').filter((line) => FORBIDDEN_IMPORT.test(line));
      if (hits.length > 0) {
        violations.push(`${file}: ${hits.map((line) => line.trim()).join(' | ')}`);
      }
    }
    expect(
      violations,
      'INV-11: diff helpers hash via codegen-core only; generate stays in SF-6 loader'
    ).toEqual([]);
  });

  it('exports sync pure helpers from services/preview, not RwaCodegenService methods', () => {
    expect(typeof cloneFileTree).toBe('function');
    expect(typeof diffChangedPaths).toBe('function');
    expect(typeof fileContentsEqual).toBe('function');
    expect(typeof listChangedPaths).toBe('function');
    expect(typeof createStepFileTreeSnapshot).toBe('function');
    for (const fn of [
      cloneFileTree,
      diffChangedPaths,
      fileContentsEqual,
      listChangedPaths,
      createStepFileTreeSnapshot,
    ]) {
      expect(fn.constructor.name, 'INV-16: helpers are plain functions').toBe('Function');
    }
  });

  it('can be embedded by a host with plain FileTree maps (INV-16)', () => {
    const snapshot = createStepFileTreeSnapshot({ 'a.txt': '1' }, ENTRY_KEY);
    expect(listChangedPaths(snapshot, { 'a.txt': '2' }, 'other')).toEqual(['a.txt']);
  });
});

describe('preview step-marker purity (INV-8, INV-10, INV-12)', () => {
  it('does not throw for empty trees, null snapshot, or large key sets', () => {
    const snapshot = createStepFileTreeSnapshot({}, ENTRY_KEY);
    const large: Record<string, string> = {};
    for (let i = 0; i < 50; i++) large[`file-${i}.txt`] = `body-${i}`;

    expect(() => diffChangedPaths({}, {})).not.toThrow();
    expect(() => listChangedPaths(null, large, 'h')).not.toThrow();
    expect(() => listChangedPaths(snapshot, large, 'other')).not.toThrow();
  });

  it('does not log during pure transforms (INV-12)', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const snapshot = createStepFileTreeSnapshot({ 'a.txt': '1' }, ENTRY_KEY);

    cloneFileTree({ 'a.txt': '1' });
    fileContentsEqual('a', 'b');
    diffChangedPaths({ 'a.txt': '1' }, { 'a.txt': '2' });
    listChangedPaths(snapshot, { 'a.txt': '2' }, 'other');

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe('preview step-marker return shape (INV-15)', () => {
  it('returns only path strings, never file bodies', () => {
    const snapshot = createStepFileTreeSnapshot(
      { 'secret.json': '{"owner":"sensitive"}' },
      ENTRY_KEY
    );
    const changed = listChangedPaths(
      snapshot,
      { 'secret.json': '{"owner":"changed"}' },
      'other-hash'
    );
    expect(changed).toEqual(['secret.json']);
    for (const path of changed) {
      expect(path.includes('sensitive')).toBe(false);
      expect(path.includes('owner')).toBe(false);
    }
  });
});
