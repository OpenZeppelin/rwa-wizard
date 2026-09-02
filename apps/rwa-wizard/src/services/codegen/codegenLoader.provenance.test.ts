import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  GenerateOptions,
  GenerationResult,
  ProvenanceEntry,
} from '@openzeppelin/codegen-core';
import { logger } from '@openzeppelin/ui-utils';

import { makeConfig } from '../../test/fixtures/wizardFixtures';
import { loadCodegenService } from './codegenLoader';
import { CodegenGenerationError } from './errors';

const { generateMock, generateZipMock } = vi.hoisted(() => ({
  generateMock: vi.fn<(config: unknown, options?: GenerateOptions) => GenerationResult>(),
  generateZipMock: vi.fn<
    (config: unknown, options?: GenerateOptions) => Promise<{ fileName: string; data: Blob }>
  >(async () => ({ fileName: 'test.zip', data: new Blob(['zip']) })),
}));

vi.mock('./runtimeOptions', () => ({ getCodegenRuntimeOptions: vi.fn(() => undefined) }));

vi.mock('@openzeppelin/codegen-rwa-stellar', () => ({
  validate: vi.fn(() => ({ valid: true, errors: [], warnings: [] })),
  getAvailableModules: vi.fn(() => []),
  generate: generateMock,
  generateZip: generateZipMock,
  // The wrapper probes every optional member; a vitest mock throws on a
  // missing export, so each one is declared absent explicitly.
  generateWithIdentitySupport: undefined,
  generateZipWithIdentitySupport: undefined,
  getEcosystemMetadata: undefined,
  getUpstreamSourceRevision: undefined,
  getUpstreamImportLinks: undefined,
  getGeneratedFileKind: undefined,
  getCodegenInfoBlurb: undefined,
  getDeployGuidance: undefined,
  getComplianceConfigWarnings: undefined,
  hasComplianceConfigBlockingIssues: undefined,
  isDemoAutoMintConfigReady: undefined,
  isComplianceConfigBlockingWarningId: undefined,
}));

const FILES = { 'a.txt': 'a', 'b.txt': 'b' };
const GOOD: ProvenanceEntry = { kind: 'file', paths: ['token.name'] };

function result(extra: Partial<Record<string, unknown>> = {}): GenerationResult {
  return { files: FILES, metadata: { configHash: 'h' }, ...extra } as unknown as GenerationResult;
}

async function service() {
  const svc = await loadCodegenService('stellar');
  if (!svc) throw new Error('expected a service');
  return svc;
}

/** Options a stellar target passes today, with no provenance requested. */
const BASE_OPTIONS = { allowUnderReviewModules: true };

describe('generateFileTree provenance — presence and switch (INV-1, INV-2)', () => {
  beforeEach(() => {
    generateMock.mockReset();
    generateZipMock.mockClear();
    vi.restoreAllMocks();
  });

  it('does not read result.provenance and returns no key when not requested', async () => {
    const gets: PropertyKey[] = [];
    const proxied = new Proxy(result({ provenance: { files: {} } }), {
      get(target, key, receiver) {
        gets.push(key);
        return Reflect.get(target, key, receiver);
      },
    });
    generateMock.mockReturnValue(proxied);
    const artifact = await (await service()).generateFileTree(makeConfig());
    expect(Object.keys(artifact)).toEqual(['files']);
    expect(gets).not.toContain('provenance');
    expect(generateMock.mock.calls[0]?.[1]).toEqual(BASE_OPTIONS);
  });

  it('returns the field when requested and the package recorded', async () => {
    const provenance = { files: { 'a.txt': { entries: [GOOD] } } };
    generateMock.mockReturnValue(result({ provenance }));
    const artifact = await (
      await service()
    ).generateFileTree(makeConfig(), {
      recordProvenance: true,
    });
    expect(artifact.files).toBe(FILES);
    expect(artifact.provenance).toEqual(provenance);
    expect(generateMock.mock.calls[0]?.[1]).toEqual({ ...BASE_OPTIONS, recordProvenance: true });
  });

  it.each([
    ['absent', {}],
    ['null', { provenance: null }],
    ['string', { provenance: 'x' }],
    ['no files', { provenance: {} }],
    ['files null', { provenance: { files: null } }],
  ])('%s provenance when requested → key absent, nothing logged', async (_label, extra) => {
    const warn = vi.spyOn(logger, 'warn');
    const debug = vi.spyOn(logger, 'debug');
    generateMock.mockReturnValue(result(extra));
    const artifact = await (
      await service()
    ).generateFileTree(makeConfig(), {
      recordProvenance: true,
    });
    expect(Object.prototype.hasOwnProperty.call(artifact, 'provenance')).toBe(false);
    expect(warn).not.toHaveBeenCalled();
    expect(debug).not.toHaveBeenCalled();
  });

  it('generateZip never forwards recordProvenance (INV-4)', async () => {
    await (await service()).generateZip(makeConfig(), { recordProvenance: true });
    expect(generateZipMock.mock.calls[0]?.[1]).toEqual(BASE_OPTIONS);
  });

  it('a throwing provenance getter surfaces as CodegenGenerationError, never a bare tree (INV-7)', async () => {
    const hostile = result();
    Object.defineProperty(hostile, 'provenance', {
      get() {
        throw new Error('hostile');
      },
    });
    generateMock.mockReturnValue(hostile);
    await expect(
      (await service()).generateFileTree(makeConfig(), { recordProvenance: true })
    ).rejects.toBeInstanceOf(CodegenGenerationError);
  });
});

describe('generateFileTree provenance — narrowing (INV-3, INV-9, INV-24)', () => {
  beforeEach(() => {
    generateMock.mockReset();
    vi.restoreAllMocks();
  });

  async function narrow(files: Record<string, unknown>) {
    generateMock.mockReturnValue(result({ provenance: { files } }));
    return (await service()).generateFileTree(makeConfig(), { recordProvenance: true });
  }

  it('drops per entry, keeps the rest, warns once (AS-3)', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const artifact = await narrow({
      a: { entries: [GOOD, { kind: 'bogus' }, { kind: 'file', paths: ['a..b'] }] },
      b: { entries: 'nope' },
      c: { entries: [] },
    });
    expect(artifact.provenance).toEqual({ files: { a: { entries: [GOOD] }, c: { entries: [] } } });
    expect(artifact.provenance?.files.a?.entries[0]).toBe(GOOD);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[1]);
    expect(message).toMatch(/2 entr(y|ies)/);
    expect(message).toMatch(/1 file/);
    expect(message).toMatch(/"a"|"b"/);
    expect(message).not.toContain('a..b');
  });

  it('all entries dropped in every file → { files: { a: { entries: [] } } }, not undefined', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const artifact = await narrow({ a: { entries: [{ kind: 'bogus' }] } });
    expect(artifact.provenance).toEqual({ files: { a: { entries: [] } } });
  });

  it('keeps root and empty path lists; paths arrays pass by reference (INV-12)', async () => {
    const root: ProvenanceEntry = { kind: 'file', paths: [''] };
    const empty: ProvenanceEntry = { kind: 'file', paths: [] };
    const artifact = await narrow({ a: { entries: [root, empty] } });
    expect(artifact.provenance?.files.a?.entries).toEqual([root, empty]);
    expect(artifact.provenance?.files.a?.entries[0]?.paths).toBe(root.paths);
  });

  it('200 bad entries in one file → still one warning', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    await narrow({ a: { entries: Array.from({ length: 200 }, () => ({ kind: 'bogus' })) } });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('warning never leaks a config value embedded in a hostile recorded path (INV-25)', async () => {
    const sentinel = 'SENTINEL-7f3a';
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    await narrow({
      'safe-file.txt': {
        entries: [{ kind: 'file', paths: [`token..name=${sentinel}`] }],
      },
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(sentinel);
  });

  it('valid result → zero warnings', async () => {
    const warn = vi.spyOn(logger, 'warn');
    await narrow({ a: { entries: [GOOD] } });
    expect(warn).not.toHaveBeenCalled();
  });

  it('a hostile getter inside an entry drops that entry only', async () => {
    const hostile = {} as Record<string, unknown>;
    Object.defineProperty(hostile, 'kind', {
      get() {
        throw new Error('hostile');
      },
    });
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const artifact = await narrow({ a: { entries: [hostile, GOOD] } });
    expect(artifact.provenance).toEqual({ files: { a: { entries: [GOOD] } } });
  });

  it('never mutates a deep-frozen package result', async () => {
    const frozenEntries = Object.freeze([GOOD, Object.freeze({ kind: 'bogus' })]);
    const provenance = Object.freeze({
      files: Object.freeze({ a: Object.freeze({ entries: frozenEntries }) }),
    });
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    generateMock.mockReturnValue(Object.freeze(result({ provenance })));
    const artifact = await (
      await service()
    ).generateFileTree(makeConfig(), {
      recordProvenance: true,
    });
    expect(artifact.provenance).toEqual({ files: { a: { entries: [GOOD] } } });
    expect(provenance.files.a.entries).toBe(frozenEntries);
  });

  it('uses core guards, not a local grammar (INV-3 static)', () => {
    const text = readFileSync(resolve(__dirname, 'codegenLoader.ts'), 'utf8');
    expect(text).toMatch(/hasProvenance/);
    expect(text).toMatch(/isProvenanceEntry/);
    expect(text).toMatch(/parseConfigPath/);
    expect(text).not.toMatch(/features\/wizard\/config-path/);
    expect(text).not.toMatch(/as any/);
  });
});
