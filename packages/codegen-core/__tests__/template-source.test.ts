import { describe, expect, it } from 'vitest';

import {
  assertTemplateSnapshotCompleteness,
  createSnapshotTemplateSource,
  getTemplateSourceKey,
  type TemplateManifestEntry,
  type TemplateSnapshot,
} from '../src/template-source';

type ExampleTemplateKind = 'primary' | 'secondary';

const manifest: readonly TemplateManifestEntry<ExampleTemplateKind>[] = [
  { kind: 'primary', id: 'alpha', sourcePath: 'fixtures/alpha.txt' },
  { kind: 'secondary', id: 'alpha', sourcePath: 'fixtures/alpha.meta' },
];

function createSnapshot(): TemplateSnapshot {
  return {
    metadata: {
      sourceRepoUrl: 'https://example.com/contracts.git',
      sourceCommitHash: 'abc123',
      syncedAt: '2026-01-01T00:00:00.000Z',
    },
    templates: {
      [getTemplateSourceKey('primary', 'alpha')]: {
        sourcePath: 'fixtures/alpha.txt',
        content: 'alpha contents',
      },
      [getTemplateSourceKey('secondary', 'alpha')]: {
        sourcePath: 'fixtures/alpha.meta',
        content: 'alpha metadata',
      },
    },
  };
}

describe('Template Source Helpers', () => {
  it('builds stable template keys', () => {
    expect(getTemplateSourceKey('primary', 'alpha')).toBe('primary:alpha');
  });

  it('asserts snapshot completeness against a manifest', () => {
    expect(() => assertTemplateSnapshotCompleteness(createSnapshot(), manifest)).not.toThrow();
  });

  it('throws when the snapshot is missing a manifest entry', () => {
    const incomplete = createSnapshot();
    delete incomplete.templates[getTemplateSourceKey('secondary', 'alpha')];

    expect(() => assertTemplateSnapshotCompleteness(incomplete, manifest)).toThrow(
      'Template snapshot is missing secondary:alpha'
    );
  });

  it('wraps a snapshot into a template source', () => {
    const source = createSnapshotTemplateSource(createSnapshot(), {
      strategy: 'bundled-snapshot',
      sourceRepoUrl: 'https://example.com/contracts.git',
      sourceCommitHash: 'abc123',
      syncedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(source.getTemplate('primary', 'alpha')).toBe('alpha contents');
    expect(source.getTemplatePayload('secondary', 'alpha')).toEqual({
      sourcePath: 'fixtures/alpha.meta',
      content: 'alpha metadata',
    });
  });
});
