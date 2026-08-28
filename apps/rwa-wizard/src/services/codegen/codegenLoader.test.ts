import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '@openzeppelin/ui-utils';

import { makeConfig } from '../../test/fixtures/wizardFixtures';
import { loadCodegenService } from './codegenLoader';
import { CodegenUnsupportedError } from './errors';

interface MockGenerateZipOptions {
  contractsLibraryPath?: string;
  allowUnderReviewModules?: boolean;
  onProgress?: (event: { phase: string; percentage: number; message?: string }) => void;
}

const {
  generateZipMock,
  generateZipWithIdentitySupportMock,
  getAvailableModulesMock,
  getCodegenRuntimeOptionsMock,
  getEcosystemMetadataMock,
  getUpstreamSourceRevisionMock,
  getUpstreamImportLinksMock,
  getGeneratedFileKindMock,
  getCodegenInfoBlurbMock,
  getDeployGuidanceMock,
  getComplianceConfigWarningsMock,
  hasComplianceConfigBlockingIssuesMock,
  isDemoAutoMintConfigReadyMock,
  validateMock,
} = vi.hoisted(() => ({
  validateMock: vi.fn(() => ({ valid: true, errors: [], warnings: [] })),
  getAvailableModulesMock: vi.fn(() => []),
  generateZipMock: vi.fn<
    (config: unknown, options?: MockGenerateZipOptions) => Promise<{ fileName: string; data: Blob }>
  >(async () => ({ fileName: 'test.zip', data: new Blob(['zip']) })),
  generateZipWithIdentitySupportMock: vi.fn<
    (config: unknown, options?: MockGenerateZipOptions) => Promise<{ fileName: string; data: Blob }>
  >(async () => ({ fileName: 'test-identity.zip', data: new Blob(['zip']) })),
  getCodegenRuntimeOptionsMock: vi.fn(),
  getEcosystemMetadataMock: vi.fn(() => undefined),
  getUpstreamSourceRevisionMock: vi.fn((_options?: unknown) => ({
    repoUrl: 'https://github.com/OpenZeppelin/stellar-contracts',
    commitHash: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    mode: 'git-revision' as const,
  })),
  getUpstreamImportLinksMock: vi.fn(() => ({
    language: 'rust',
    importLinePrefix: 'use ',
    targets: [{ identifier: 'stellar_access', path: 'packages/access' }],
  })),
  getGeneratedFileKindMock: vi.fn((_path: string) => 'unknown'),
  getCodegenInfoBlurbMock: vi.fn(() => ({
    title: 'Mock',
    description: 'Mock blurb',
    links: [],
  })),
  getDeployGuidanceMock: vi.fn(() => ({
    adminAddress: 'GADMIN',
    managerAddress: 'GADMIN',
    adminEqualsManager: true,
    networkDisplayName: 'Stellar Testnet',
    networkIsTestnet: true,
    demoAutoMintEligible: true,
    demoMintComplianceIssues: [],
  })),
  getComplianceConfigWarningsMock: vi.fn(() => []),
  hasComplianceConfigBlockingIssuesMock: vi.fn(() => false),
  isDemoAutoMintConfigReadyMock: vi.fn(() => true),
}));

vi.mock('./runtimeOptions', () => ({
  getCodegenRuntimeOptions: getCodegenRuntimeOptionsMock,
}));

vi.mock('@openzeppelin/codegen-core', () => ({
  toSummaryPhase: (phase: string) => phase,
}));

vi.mock('@openzeppelin/codegen-rwa-stellar', () => ({
  validate: validateMock,
  getAvailableModules: getAvailableModulesMock,
  // Explicit undefined so typeof pkg.generate !== 'function' (INV-7). A missing
  // mock export makes Vitest throw on access instead of the typed error.
  generate: undefined,
  generateZip: generateZipMock,
  generateZipWithIdentitySupport: generateZipWithIdentitySupportMock,
  getEcosystemMetadata: getEcosystemMetadataMock,
  getUpstreamSourceRevision: getUpstreamSourceRevisionMock,
  getUpstreamImportLinks: getUpstreamImportLinksMock,
  getGeneratedFileKind: getGeneratedFileKindMock,
  getCodegenInfoBlurb: getCodegenInfoBlurbMock,
  getDeployGuidance: getDeployGuidanceMock,
  getComplianceConfigWarnings: getComplianceConfigWarningsMock,
  hasComplianceConfigBlockingIssues: hasComplianceConfigBlockingIssuesMock,
  isDemoAutoMintConfigReady: isDemoAutoMintConfigReadyMock,
  isComplianceConfigBlockingWarningId: (id: string) =>
    id === 'initial-supply-exceeds-max-balance' || id === 'initial-supply-exceeds-supply-limit',
}));

describe('loadCodegenService', () => {
  beforeEach(() => {
    validateMock.mockClear();
    getAvailableModulesMock.mockClear();
    generateZipMock.mockClear();
    generateZipWithIdentitySupportMock.mockClear();
    getCodegenRuntimeOptionsMock.mockReset();
    getEcosystemMetadataMock.mockClear();
    getUpstreamSourceRevisionMock.mockClear();
    getUpstreamImportLinksMock.mockClear();
    getGeneratedFileKindMock.mockReset();
    getGeneratedFileKindMock.mockImplementation((_path: string) => 'unknown');
    getCodegenInfoBlurbMock.mockClear();
  });

  /**
   * The revision must be resolved with the same options generation runs under,
   * or a local-checkout build would advertise a pinned commit its manifest
   * never emits and every generated import link would point at the wrong tree.
   */
  it('resolves the upstream revision with the same base generate options', async () => {
    getCodegenRuntimeOptionsMock.mockReturnValue({ contractsLibraryPath: '../stellar-contracts' });

    const service = await loadCodegenService('stellar');
    service?.getUpstreamSourceRevision?.();

    expect(getUpstreamSourceRevisionMock).toHaveBeenCalledWith(
      expect.objectContaining({ contractsLibraryPath: '../stellar-contracts' })
    );
  });

  /**
   * The language a package reports has to be one the code pane renders, because
   * the decorator links only inside files whose language matches. A package
   * that reports its own spelling breaks that contract in a way the preview can
   * only express as an absence of links, so the seam rejects it by name.
   */
  it('passes through import links whose language the code preview renders', async () => {
    const service = await loadCodegenService('stellar');

    expect(service?.getUpstreamImportLinks?.()).toEqual({
      language: 'rust',
      importLinePrefix: 'use ',
      targets: [{ identifier: 'stellar_access', path: 'packages/access' }],
    });
  });

  it.each(['Rust', 'rs', 'rust-lang'])(
    'drops import links reported under the unrenderable language %s',
    async (language) => {
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
      getUpstreamImportLinksMock.mockReturnValueOnce({
        language,
        importLinePrefix: 'use ',
        targets: [{ identifier: 'stellar_access', path: 'packages/access' }],
      });

      const service = await loadCodegenService('stellar');

      expect(service?.getUpstreamImportLinks?.()).toBeNull();
      expect(warn).toHaveBeenCalledWith('CodegenLoader', expect.stringContaining(language));
      warn.mockRestore();
    }
  );

  it.each(['contract', 'script', 'provenance-and-docs', 'unknown'] as const)(
    'passes through generated file kind %s (INV-5)',
    async (kind) => {
      getGeneratedFileKindMock.mockReturnValueOnce(kind);

      const service = await loadCodegenService('stellar');

      expect(service?.getGeneratedFileKind?.('a/path')).toBe(kind);
      expect(getGeneratedFileKindMock).toHaveBeenCalledWith('a/path');
      expect(getGeneratedFileKindMock).toHaveBeenCalledTimes(1);
    }
  );

  it.each(['Contract', 'manifest', ''])(
    'degrades unrecognized generated file kind %j to unknown and keeps the path (INV-5)',
    async (kind) => {
      const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
      getGeneratedFileKindMock.mockImplementation((path: string) =>
        path === 'bad' ? kind : 'script'
      );

      const service = await loadCodegenService('stellar');

      expect(service?.getGeneratedFileKind?.('bad')).toBe('unknown');
      expect(service?.getGeneratedFileKind?.('good')).toBe('script');
      expect(warn).toHaveBeenCalledWith(
        'CodegenLoader',
        `Ignoring generated file kind "${kind}": not in the closed ranking set.`
      );
      const warnMessage = String(warn.mock.calls[0]?.[1] ?? '');
      expect(warnMessage, 'INV-13: warn interpolates the kind, not the draft').not.toContain(
        'GCEXAMPLEOWNER'
      );
      expect(warnMessage).not.toContain('Acme Real Estate Token');
      warn.mockRestore();
    }
  );

  it('keeps every tree path when one kind is unrecognized (INV-5)', async () => {
    const tree = {
      'contracts/example/src/contract.rs': 'pub fn f() {}',
      'scripts/deploy.sh': '#!/bin/sh\n',
      'config.json': '{}',
    } as const;
    const reported: Record<string, string> = {
      'contracts/example/src/contract.rs': 'contract',
      'scripts/deploy.sh': 'script',
      'config.json': 'manifest',
    };

    getGeneratedFileKindMock.mockImplementation((path: string) => reported[path] ?? 'unknown');

    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const service = await loadCodegenService('stellar');

    const classified: Record<string, string> = {};
    for (const path of Object.keys(tree)) {
      classified[path] = service!.getGeneratedFileKind!(path);
    }

    expect(
      Object.keys(classified).sort(),
      'INV-5: an unrecognized kind must not drop the file from the classified set'
    ).toEqual(Object.keys(tree).sort());
    expect(classified['config.json']).toBe('unknown');
    expect(classified['contracts/example/src/contract.rs']).toBe('contract');
    expect(classified['scripts/deploy.sh']).toBe('script');
    expect(warn).toHaveBeenCalledWith(
      'CodegenLoader',
      'Ignoring generated file kind "manifest": not in the closed ranking set.'
    );
    warn.mockRestore();
  });

  it('does not warn when the reported kind is in the closed set (INV-11)', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    getGeneratedFileKindMock.mockReturnValueOnce('contract');

    const service = await loadCodegenService('stellar');
    service?.getGeneratedFileKind?.('a/path');

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('calls getGeneratedFileKind with the path only (INV-4)', async () => {
    getGeneratedFileKindMock.mockReturnValueOnce('contract');

    const service = await loadCodegenService('stellar');
    service?.getGeneratedFileKind?.('a/path');

    expect(getGeneratedFileKindMock).toHaveBeenCalledTimes(1);
    expect(getGeneratedFileKindMock).toHaveBeenCalledWith('a/path');
    expect(getGeneratedFileKindMock.mock.calls[0]).toHaveLength(1);
  });

  it('allows under-review modules by default for stellar validation', async () => {
    const config = makeConfig();
    getCodegenRuntimeOptionsMock.mockReturnValue(undefined);

    const service = await loadCodegenService('stellar');
    await service?.validate(config);

    expect(validateMock).toHaveBeenCalledWith(config, {
      allowUnderReviewModules: true,
    });
  });

  it('forwards runtime options to validate', async () => {
    const config = makeConfig();
    getCodegenRuntimeOptionsMock.mockReturnValue({
      contractsLibraryPath: '/tmp/stellar-contracts',
      allowUnderReviewModules: true,
    });

    const service = await loadCodegenService('stellar');
    await service?.validate(config);

    expect(getCodegenRuntimeOptionsMock).toHaveBeenCalledWith('stellar');
    expect(validateMock).toHaveBeenCalledWith(config, {
      contractsLibraryPath: '/tmp/stellar-contracts',
      allowUnderReviewModules: true,
    });
  });

  it('allows under-review modules by default for stellar zip generation', async () => {
    const config = makeConfig();
    getCodegenRuntimeOptionsMock.mockReturnValue(undefined);

    const service = await loadCodegenService('stellar');
    expect(service).not.toBeNull();

    await service!.generateZip(config);

    expect(generateZipMock).toHaveBeenCalledWith(config, {
      allowUnderReviewModules: true,
    });
  });

  it('merges runtime options with progress callbacks for zip generation', async () => {
    const config = makeConfig();
    const onStatus = vi.fn();
    getCodegenRuntimeOptionsMock.mockReturnValue({
      contractsLibraryPath: '/tmp/stellar-contracts',
      allowUnderReviewModules: true,
    });

    generateZipMock.mockImplementationOnce(async (_config, options) => {
      options?.onProgress?.({ phase: 'packaging', percentage: 50, message: 'Halfway there' });
      return { fileName: 'test.zip', data: new Blob(['zip']) };
    });

    const service = await loadCodegenService('stellar');
    expect(service).not.toBeNull();

    const result = await service!.generateZip(config, { onStatus });

    expect(generateZipMock).toHaveBeenCalledTimes(1);
    expect(generateZipMock).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        contractsLibraryPath: '/tmp/stellar-contracts',
        allowUnderReviewModules: true,
        onProgress: expect.any(Function),
      })
    );
    expect(onStatus).toHaveBeenCalledWith({
      phase: 'packaging',
      message: 'Halfway there',
    });
    expect(result).toEqual({
      fileName: 'test.zip',
      data: expect.any(Blob),
    });
  });

  it('honors explicit runtime review overrides', async () => {
    const config = makeConfig();
    getCodegenRuntimeOptionsMock.mockReturnValue({
      allowUnderReviewModules: false,
    });

    const service = await loadCodegenService('stellar');
    await service?.validate(config);

    expect(validateMock).toHaveBeenCalledWith(config, {
      allowUnderReviewModules: false,
    });
  });

  it('uses identity-support zip generation when requested', async () => {
    const config = makeConfig();
    getCodegenRuntimeOptionsMock.mockReturnValue(undefined);

    const service = await loadCodegenService('stellar');
    await service!.generateZip(config, { includeIdentitySupport: true });

    expect(generateZipWithIdentitySupportMock).toHaveBeenCalledWith(config, {
      allowUnderReviewModules: true,
    });
    expect(generateZipMock).not.toHaveBeenCalled();
  });

  it('tracks supportsIdentitySupport from the zip function, not generate (INV-17)', async () => {
    const service = await loadCodegenService('stellar');
    expect(service?.supportsIdentitySupport).toBe(true);
  });

  it('returns null for unknown targets (INV-13)', async () => {
    expect(await loadCodegenService('evm')).toBeNull();
  });

  it('throws CodegenUnsupportedError when generate is missing and does not unzip (INV-7)', async () => {
    const service = await loadCodegenService('stellar');
    await expect(service!.generateFileTree(makeConfig())).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(CodegenUnsupportedError);
      if (err instanceof CodegenUnsupportedError) {
        expect(err.code).toBe('CODEGEN_GENERATE_UNSUPPORTED');
        expect(err.targetId).toBe('stellar');
      }
      return true;
    });
    expect(generateZipMock).not.toHaveBeenCalled();
    expect(generateZipWithIdentitySupportMock).not.toHaveBeenCalled();
  });
});
