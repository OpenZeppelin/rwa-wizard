import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { ProvenanceResult } from '@openzeppelin/codegen-core';

import type { CodePreviewPhase } from './hooks/useCodePreview';

import { tokenPaths } from '../wizard/config-path';
import { toPreviewProvenanceState } from './provenanceState';

const KEY = 'hash|identity:0|service:svc-1';
const PROVENANCE: ProvenanceResult = {
  files: { 'a.txt': { entries: [{ kind: 'file', paths: [tokenPaths.name] }] } },
};

function ready(provenance?: ProvenanceResult, generateKey = KEY): CodePreviewPhase {
  return {
    kind: 'ready',
    files: { 'a.txt': '' },
    configHash: 'hash',
    substitutedKeys: [],
    changedPaths: [],
    generateKey,
    ...(provenance ? { provenance } : {}),
  };
}

const unknown = () => 'unknown' as const;

describe('toPreviewProvenanceState (INV-8, INV-19)', () => {
  it.each<CodePreviewPhase>([
    { kind: 'idle' },
    { kind: 'loading' },
    { kind: 'error', substitutedKeys: [], messages: ['x'] },
  ])('$kind → none', (phase) => {
    expect(toPreviewProvenanceState(phase, unknown)).toEqual({ kind: 'none' });
  });

  it('ready without provenance → unsupported stamped with the tree key', () => {
    expect(toPreviewProvenanceState(ready(), unknown)).toEqual({
      kind: 'unsupported',
      identity: KEY,
    });
  });

  it('ready with provenance → available whose lookup is stamped with the tree key', () => {
    const state = toPreviewProvenanceState(ready(PROVENANCE), unknown);
    expect(state.kind).toBe('available');
    if (state.kind !== 'available') return;
    expect(state.identity).toBe(KEY);
    const result = state.lookup(tokenPaths.name);
    expect(result.identity).toBe(KEY);
    expect(result.groups.map((g) => g.path)).toEqual(['a.txt']);
  });

  it('an all-dropped result ({ files: {} }) is available with empty groups, not unsupported', () => {
    const state = toPreviewProvenanceState(ready({ files: {} }), unknown);
    expect(state.kind).toBe('available');
    if (state.kind !== 'available') return;
    expect(state.lookup(tokenPaths.name).groups).toEqual([]);
  });

  it('lookup hides by the injected kindOf', () => {
    const state = toPreviewProvenanceState(ready(PROVENANCE), () => 'provenance-and-docs');
    if (state.kind !== 'available') throw new Error('expected available');
    expect(state.lookup(tokenPaths.name).groups).toEqual([]);
  });

  it('lookup is a captured closure: it answers for the phase it was built from', () => {
    const state = toPreviewProvenanceState(ready(PROVENANCE), unknown);
    const later = toPreviewProvenanceState(ready({ files: {} }, 'other'), unknown);
    if (state.kind !== 'available' || later.kind !== 'available')
      throw new Error('expected available');
    expect(state.lookup(tokenPaths.name).identity).toBe(KEY);
    expect(state.lookup(tokenPaths.name).groups).toHaveLength(1);
    expect(later.lookup(tokenPaths.name).identity).toBe('other');
  });

  it('module never reads the draft, logs, or throws (INV-11, INV-22, INV-7)', () => {
    const text = readFileSync(resolve(__dirname, 'provenanceState.ts'), 'utf8');
    expect(text).not.toMatch(/resolveConfigPath|createDefaultRwaConfig|@openzeppelin\/rwa-config'/);
    expect(text).not.toMatch(/logger|console\./);
    expect(text).not.toMatch(/\btry\b|\bthrow\b/);
    expect(text).not.toMatch(/ui-storage|localStorage|sessionStorage/);
  });
});
