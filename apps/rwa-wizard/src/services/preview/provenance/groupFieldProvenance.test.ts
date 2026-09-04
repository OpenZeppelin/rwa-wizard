import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import type { FileTree, ProvenanceEntry, ProvenanceResult } from '@openzeppelin/codegen-core';

import {
  administrativeControlPath,
  claimTopicPath,
  identityControlPath,
  moduleConfigFieldPath,
  moduleEntryPath,
  ownershipAddressPath,
  ownershipTypePath,
  roleAddressesPath,
  tokenPaths,
  trustedIssuerAddressPath,
  trustedIssuerClaimTopicsPath,
  type ConfigPath,
} from '../../../features/wizard/config-path';
import type { StructuralGeneratedFileKind } from '../../../types/wizard';
import { groupFieldProvenance } from './groupFieldProvenance';
import type { PreviewProvenanceSource } from './types';

const IDENTITY = 'hash|identity:0|service:svc-1';
const UNKNOWN_KIND = (): StructuralGeneratedFileKind => 'unknown';

function fileEntry(...paths: string[]): ProvenanceEntry {
  return { kind: 'file', paths };
}
function createdEntry(...paths: string[]): ProvenanceEntry {
  return { kind: 'created', paths };
}
function rangeEntry(start: number, end: number, ...paths: string[]): ProvenanceEntry {
  return { kind: 'range', range: { start, end }, paths };
}

function source(
  provenance: ProvenanceResult,
  overrides: Partial<PreviewProvenanceSource> = {}
): PreviewProvenanceSource {
  const files: FileTree = {};
  for (const key of Object.keys(provenance.files)) files[key] = '';
  return { identity: IDENTITY, files, provenance, kindOf: UNKNOWN_KIND, ...overrides };
}

const NAME = tokenPaths.name;
const SYMBOL = tokenPaths.symbol;

describe('groupFieldProvenance — matching (INV-10, INV-12)', () => {
  it('returns one group when the file read exactly the queried path', () => {
    const result = groupFieldProvenance(
      source({ files: { 'a.txt': { entries: [fileEntry(NAME)] } } }),
      NAME
    );
    expect(result.groups.map((g) => g.path)).toEqual(['a.txt']);
  });

  it('a file that read only token.name does not answer a token.symbol query', () => {
    const src = source({ files: { 'name-only.txt': { entries: [fileEntry(NAME)] } } });
    expect(groupFieldProvenance(src, SYMBOL).groups).toEqual([]);
    expect(groupFieldProvenance(src, tokenPaths.decimals).groups).toEqual([]);
    expect(groupFieldProvenance(src, NAME).groups.map((group) => group.path)).toEqual([
      'name-only.txt',
    ]);
  });

  it('an ancestor query matches a descendant read (module tick case)', () => {
    const src = source({
      files: { 'm.txt': { entries: [fileEntry('compliance.modules[0].config.limit')] } },
    });
    expect(groupFieldProvenance(src, 'compliance.modules[0]').groups).toHaveLength(1);
    expect(groupFieldProvenance(src, 'compliance.modules[1]').groups).toEqual([]);
  });

  it('a root-path entry matches every query and shows as a file row when kind is unknown', () => {
    const src = source({ files: { 'dump.txt': { entries: [fileEntry('')] } } });
    expect(groupFieldProvenance(src, NAME).groups[0]?.rows).toEqual([
      { kind: 'file', significance: 'primary' },
    ]);
    expect(groupFieldProvenance(src, 'accessControl.ownership.type').groups).toHaveLength(1);
  });

  it('a field no file reads yields the explicit empty (AS-4)', () => {
    const src = source({ files: { 'a.txt': { entries: [fileEntry(NAME)] } } });
    expect(groupFieldProvenance(src, tokenPaths.initialSupply)).toEqual({
      identity: IDENTITY,
      path: tokenPaths.initialSupply,
      groups: [],
    });
  });

  it('is draft-blind: token.initialSupply is answered from recorded paths alone (INV-11)', () => {
    const src = source({
      files: {
        'contract.txt': {
          entries: [
            fileEntry(NAME, tokenPaths.initialSupply),
            rangeEntry(12, 12, tokenPaths.initialSupply),
          ],
        },
      },
    });
    expect(groupFieldProvenance(src, tokenPaths.initialSupply).groups).toEqual([
      {
        path: 'contract.txt',
        kind: 'unknown',
        rows: [{ kind: 'range', range: { startLine: 12, endLine: 12 }, significance: 'primary' }],
      },
    ]);
  });

  it('is total for every SF-6 config-path builder shape (INV-7)', () => {
    const paths: readonly ConfigPath[] = [
      ...Object.values(tokenPaths),
      administrativeControlPath('pause'),
      identityControlPath('registry'),
      ownershipTypePath,
      ownershipAddressPath({ type: 'single-owner', ownerAddress: 'GOWNER' }),
      ownershipAddressPath({ type: 'multi-sig', address: 'GMULTISIG' }),
      ownershipAddressPath({ type: 'dao', address: 'GDAO' }),
      trustedIssuerAddressPath(2),
      trustedIssuerClaimTopicsPath(2),
      claimTopicPath(2),
      moduleEntryPath(1),
      moduleConfigFieldPath(1, 'limit'),
      roleAddressesPath(1),
    ];
    const src = source({ files: { 'root.txt': { entries: [fileEntry('')] } } });

    for (const path of paths) {
      expect(() => groupFieldProvenance(src, path), `lookup threw for ${path}`).not.toThrow();
    }
  });
});

describe('groupFieldProvenance — tree membership (INV-5)', () => {
  it('drops provenance keys that are not own keys of the tree, silently', () => {
    const src = source(
      { files: { 'ghost.txt': { entries: [fileEntry(NAME)] } } },
      { files: { 'a.txt': '' } }
    );
    expect(groupFieldProvenance(src, NAME).groups).toEqual([]);
  });

  it('uses own-key membership: "constructor" on an empty tree produces nothing', () => {
    const src = source({ files: { constructor: { entries: [fileEntry(NAME)] } } }, { files: {} });
    expect(groupFieldProvenance(src, NAME).groups).toEqual([]);
  });

  it('an own key named "toString" is a real file', () => {
    const src = source({ files: { toString: { entries: [fileEntry(NAME)] } } });
    expect(groupFieldProvenance(src, NAME).groups).toHaveLength(1);
  });

  it('never reads file content — membership only (INV-23)', () => {
    const get = vi.fn(() => 'x'.repeat(1_000));
    const files: FileTree = {};
    Object.defineProperty(files, 'big.txt', { enumerable: true, get });
    const src = source({ files: { 'big.txt': { entries: [fileEntry(NAME)] } } }, { files });
    expect(groupFieldProvenance(src, NAME).groups).toHaveLength(1);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('groupFieldProvenance — hiding by kind (INV-13)', () => {
  const prov: ProvenanceResult = { files: { 'README.md': { entries: [fileEntry(NAME)] } } };

  it('hides a file whose kind is provenance-and-docs', () => {
    const src = source(prov, { kindOf: () => 'provenance-and-docs' });
    expect(groupFieldProvenance(src, NAME).groups).toEqual([]);
  });

  it.each(['unknown', 'script', 'contract'] as const)(
    'shows a file of kind %s and carries it',
    (kind) => {
      const src = source(prov, { kindOf: () => kind });
      expect(groupFieldProvenance(src, NAME).groups[0]?.kind).toBe(kind);
    }
  );

  it('asks kindOf once per surviving file and never for a key absent from the tree', () => {
    const kindOf = vi.fn<(path: string) => StructuralGeneratedFileKind>(() => 'unknown');
    const src = source(
      {
        files: {
          'a.txt': { entries: [fileEntry(NAME)] },
          'ghost.txt': { entries: [fileEntry(NAME)] },
          'unrelated.txt': { entries: [fileEntry(SYMBOL)] },
        },
      },
      { files: { 'a.txt': '', 'unrelated.txt': '' }, kindOf }
    );
    groupFieldProvenance(src, NAME);
    expect(kindOf.mock.calls).toEqual([['a.txt']]);
  });
});

describe('groupFieldProvenance — one row per site (INV-14)', () => {
  it('ranges suppress the whole-file row and sort by start line', () => {
    const src = source({
      files: {
        'a.txt': {
          entries: [fileEntry(NAME), rangeEntry(20, 21, NAME), rangeEntry(3, 5, NAME)],
        },
      },
    });
    expect(groupFieldProvenance(src, NAME).groups[0]?.rows).toEqual([
      { kind: 'range', range: { startLine: 3, endLine: 5 }, significance: 'primary' },
      { kind: 'range', range: { startLine: 20, endLine: 21 }, significance: 'primary' },
    ]);
  });

  it('only the matching ranges survive; the file entry does not resurrect a whole-file row', () => {
    const src = source({
      files: {
        'a.txt': {
          entries: [fileEntry(NAME, SYMBOL), rangeEntry(1, 1, NAME), rangeEntry(7, 9, SYMBOL)],
        },
      },
    });
    expect(groupFieldProvenance(src, SYMBOL).groups[0]?.rows).toEqual([
      { kind: 'range', range: { startLine: 7, endLine: 9 }, significance: 'primary' },
    ]);
  });

  it('created only → one created row', () => {
    const src = source({
      files: { 'a.txt': { entries: [createdEntry('compliance.modules[0]')] } },
    });
    expect(groupFieldProvenance(src, 'compliance.modules[0]').groups[0]?.rows).toEqual([
      { kind: 'created', significance: 'primary' },
    ]);
  });

  it('file only → one file row', () => {
    const src = source({ files: { 'a.txt': { entries: [fileEntry(NAME)] } } });
    expect(groupFieldProvenance(src, NAME).groups[0]?.rows).toEqual([
      { kind: 'file', significance: 'primary' },
    ]);
  });

  it('file + created fed together → one created row', () => {
    const src = source({ files: { 'a.txt': { entries: [fileEntry(NAME), createdEntry(NAME)] } } });
    expect(groupFieldProvenance(src, NAME).groups[0]?.rows).toEqual([
      { kind: 'created', significance: 'primary' },
    ]);
  });

  it('range rows are fresh objects, not the entry range (INV-24)', () => {
    const entry = rangeEntry(4, 4, NAME);
    const src = source({ files: { 'a.txt': { entries: [fileEntry(NAME), entry] } } });
    const row = groupFieldProvenance(src, NAME).groups[0]?.rows[0];
    expect(row?.kind).toBe('range');
    if (row?.kind === 'range') {
      expect(row.range).not.toBe(entry.kind === 'range' ? entry.range : undefined);
    }
  });
});

describe('groupFieldProvenance — ordering and echo (INV-15)', () => {
  it('sorts groups by path in code-unit order regardless of insertion order', () => {
    const prov: ProvenanceResult = {
      files: {
        'z.txt': { entries: [fileEntry(NAME)] },
        'a.txt': { entries: [fileEntry(NAME)] },
        'B.txt': { entries: [fileEntry(NAME)] },
        'm.txt': { entries: [fileEntry(NAME)] },
      },
    };
    const src = source(prov, { files: { 'm.txt': '', 'a.txt': '', 'z.txt': '', 'B.txt': '' } });
    expect(groupFieldProvenance(src, NAME).groups.map((g) => g.path)).toEqual([
      'B.txt',
      'a.txt',
      'm.txt',
      'z.txt',
    ]);
  });

  it('echoes identity and path; two lookups agree', () => {
    const src = source({ files: { 'a.txt': { entries: [fileEntry(NAME)] } } });
    const first = groupFieldProvenance(src, NAME);
    expect(first.identity).toBe(IDENTITY);
    expect(first.path).toBe(NAME);
    expect(groupFieldProvenance(src, NAME)).toEqual(first);
  });

  it('does not throw over a deep-frozen source', () => {
    const prov: ProvenanceResult = Object.freeze({
      files: Object.freeze({
        'a.txt': Object.freeze({ entries: Object.freeze([fileEntry(NAME)]) }),
      }),
    });
    expect(() => groupFieldProvenance(source(prov), NAME)).not.toThrow();
  });
});

describe('groupFieldProvenance — static seam rules (INV-10, INV-11, INV-22, INV-27)', () => {
  const dir = resolve(__dirname);
  const sources = readdirSync(dir)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => [name, readFileSync(resolve(dir, name), 'utf8')] as const);

  it.each(sources)('%s consults neither the draft nor a second matching rule', (_name, text) => {
    expect(text).not.toMatch(/resolveConfigPath|createDefaultRwaConfig/);
    expect(text).not.toMatch(/matchesConfigPath|parseConfigPath/);
    expect(text).not.toMatch(/\.split\('\.'\)|\.startsWith\(|new RegExp/);
    expect(text).not.toMatch(/\btry\b|\bthrow\b/);
    expect(text).not.toMatch(/logger|console\./);
    expect(text).not.toMatch(
      /stellar|soroban|\.rs\b|Cargo|deploy|README|config\.json|contracts\//i
    );
  });
});

// Type-level: a wizard ConfigPath is accepted without a cast.
const _typed: ConfigPath = tokenPaths.name;
void _typed;
