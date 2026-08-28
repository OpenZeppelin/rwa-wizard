import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeConfig } from '../../test/fixtures/wizardFixtures';
import { loadCodegenService } from './codegenLoader';
import { CodegenGenerationError, CodegenInvalidConfigError } from './errors';

interface MockGenerateOptions {
  contractsLibraryPath?: string;
  allowUnderReviewModules?: boolean;
  onProgress?: (event: { phase: string; percentage: number; message?: string }) => void;
}

const PLAIN_FILES = {
  'Cargo.toml': '[workspace]\n',
  'README.md': '# plain\n',
};

const IDENTITY_FILES = {
  ...PLAIN_FILES,
  'identity/README.md': '# identity\n',
};

const {
  generateMock,
  generateWithIdentitySupportMock,
  generateZipMock,
  generateZipWithIdentitySupportMock,
  getCodegenRuntimeOptionsMock,
  validateMock,
} = vi.hoisted(() => ({
  validateMock: vi.fn(() => ({ valid: true, errors: [], warnings: [] })),
  generateMock: vi.fn<
    (config: unknown, options?: MockGenerateOptions) => { files: Record<string, string> }
  >(() => ({ files: { ...PLAIN_FILES } })),
  generateWithIdentitySupportMock: vi.fn<
    (config: unknown, options?: MockGenerateOptions) => { files: Record<string, string> }
  >(() => ({ files: { ...IDENTITY_FILES } })),
  generateZipMock: vi.fn<
    (config: unknown, options?: MockGenerateOptions) => Promise<{ fileName: string; data: Blob }>
  >(async () => ({ fileName: 'test.zip', data: new Blob(['zip']) })),
  generateZipWithIdentitySupportMock: vi.fn<
    (config: unknown, options?: MockGenerateOptions) => Promise<{ fileName: string; data: Blob }>
  >(async () => ({
    fileName: 'test-identity.zip',
    data: new Blob(['zip']),
  })),
  getCodegenRuntimeOptionsMock: vi.fn(),
}));

vi.mock('./runtimeOptions', () => ({
  getCodegenRuntimeOptions: getCodegenRuntimeOptionsMock,
}));

vi.mock('@openzeppelin/codegen-core', () => ({
  toSummaryPhase: (phase: string) => phase,
}));

vi.mock('@openzeppelin/codegen-rwa-stellar', () => ({
  validate: validateMock,
  getAvailableModules: vi.fn(() => []),
  generate: generateMock,
  generateWithIdentitySupport: generateWithIdentitySupportMock,
  generateZip: generateZipMock,
  generateZipWithIdentitySupport: generateZipWithIdentitySupportMock,
  getEcosystemMetadata: vi.fn(() => undefined),
  getUpstreamSourceRevision: vi.fn(() => ({
    repoUrl: 'https://github.com/OpenZeppelin/stellar-contracts',
    commitHash: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    mode: 'git-revision' as const,
  })),
  getUpstreamImportLinks: vi.fn(() => ({
    language: 'rust',
    importLinePrefix: 'use ',
    targets: [{ identifier: 'stellar_access', path: 'packages/access' }],
  })),
  getCodegenInfoBlurb: vi.fn(() => ({ title: 'Mock', description: 'Mock blurb', links: [] })),
  getDeployGuidance: vi.fn(),
  getComplianceConfigWarnings: vi.fn(() => []),
  hasComplianceConfigBlockingIssues: vi.fn(() => false),
  isDemoAutoMintConfigReady: vi.fn(() => true),
  isComplianceConfigBlockingWarningId: () => false,
}));

describe('generateFileTree loader dispatch', () => {
  beforeEach(() => {
    validateMock.mockClear();
    generateMock.mockClear();
    generateWithIdentitySupportMock.mockClear();
    generateZipMock.mockClear();
    generateZipWithIdentitySupportMock.mockClear();
    getCodegenRuntimeOptionsMock.mockReset();
    generateMock.mockImplementation(() => ({ files: { ...PLAIN_FILES } }));
    generateWithIdentitySupportMock.mockImplementation(() => ({ files: { ...IDENTITY_FILES } }));
  });

  describe('request/response', () => {
    it('returns a complete files map matching the generate result (INV-1)', async () => {
      const service = await loadCodegenService('stellar');
      const result = await service!.generateFileTree(makeConfig());
      expect(result.files).toEqual(PLAIN_FILES);
      expect(result.files).not.toBeNull();
    });

    it('keeps project-relative keys with no ZIP root prefix (INV-2)', async () => {
      const service = await loadCodegenService('stellar');
      const { files } = await service!.generateFileTree(makeConfig());
      expect(Object.keys(files).some((key) => key.startsWith('tst-rwa/'))).toBe(false);
      expect(Object.keys(files)).toEqual(Object.keys(PLAIN_FILES));
    });

    it('accepts the same options bag as generateZip (INV-3)', async () => {
      const service = await loadCodegenService('stellar');
      const onStatus = vi.fn();
      await service!.generateFileTree(makeConfig(), {
        onStatus,
        includeIdentitySupport: false,
      });
      await service!.generateZip(makeConfig(), { onStatus, includeIdentitySupport: false });
      expect(generateMock).toHaveBeenCalled();
      expect(generateZipMock).toHaveBeenCalled();
    });

    it('calls generateWithIdentitySupport when the flag is true (INV-4)', async () => {
      const service = await loadCodegenService('stellar');
      const { files } = await service!.generateFileTree(makeConfig(), {
        includeIdentitySupport: true,
      });
      expect(generateWithIdentitySupportMock).toHaveBeenCalledTimes(1);
      expect(generateMock).not.toHaveBeenCalled();
      expect(files).toEqual(IDENTITY_FILES);
    });

    it('calls plain generate when the flag is omitted or false (INV-4)', async () => {
      const service = await loadCodegenService('stellar');
      await service!.generateFileTree(makeConfig());
      await service!.generateFileTree(makeConfig(), { includeIdentitySupport: false });
      expect(generateMock).toHaveBeenCalledTimes(2);
      expect(generateWithIdentitySupportMock).not.toHaveBeenCalled();
    });

    it('merges the same generate options as generateZip (INV-5)', async () => {
      const config = makeConfig();
      const onStatus = vi.fn();
      getCodegenRuntimeOptionsMock.mockReturnValue({
        contractsLibraryPath: '/tmp/stellar-contracts',
        allowUnderReviewModules: true,
      });
      const service = await loadCodegenService('stellar');
      await service!.generateFileTree(config, { onStatus });
      await service!.generateZip(config, { onStatus });

      const treeOptions = generateMock.mock.calls[0]?.[1];
      const zipOptions = generateZipMock.mock.calls[0]?.[1];
      expect(treeOptions).toMatchObject({
        contractsLibraryPath: '/tmp/stellar-contracts',
        allowUnderReviewModules: true,
      });
      expect(zipOptions).toMatchObject({
        contractsLibraryPath: '/tmp/stellar-contracts',
        allowUnderReviewModules: true,
      });
      expect(typeof treeOptions?.onProgress).toBe('function');
      expect(typeof zipOptions?.onProgress).toBe('function');
    });

    it('defaults stellar preview to allowUnderReviewModules: true (INV-5)', async () => {
      getCodegenRuntimeOptionsMock.mockReturnValue(undefined);
      const config = makeConfig();
      const service = await loadCodegenService('stellar');
      await service!.generateFileTree(config);
      expect(generateMock).toHaveBeenCalledWith(config, {
        allowUnderReviewModules: true,
      });
    });
  });

  describe('error semantics', () => {
    it('maps Invalid configuration: throws to CodegenInvalidConfigError and does not resolve a tree (INV-8)', async () => {
      generateMock.mockImplementation(() => {
        throw new Error('Invalid configuration: token.name required');
      });
      const service = await loadCodegenService('stellar');
      const pending = service!.generateFileTree(makeConfig());
      await expect(pending).rejects.toBeInstanceOf(CodegenInvalidConfigError);
      await expect(pending).rejects.toMatchObject({ code: 'CODEGEN_INVALID_CONFIG' });
    });

    it('maps other throws to CodegenGenerationError (INV-8)', async () => {
      generateMock.mockImplementation(() => {
        throw new Error('boom');
      });
      const service = await loadCodegenService('stellar');
      await expect(service!.generateFileTree(makeConfig())).rejects.toSatisfy((err: unknown) => {
        expect(err).toBeInstanceOf(CodegenGenerationError);
        if (err instanceof CodegenGenerationError) {
          expect(err.code).toBe('CODEGEN_GENERATION_FAILED');
          expect(err.message).toBe('boom');
        }
        return true;
      });
    });

    it('does not call validate before generate (INV-9)', async () => {
      const service = await loadCodegenService('stellar');
      await service!.generateFileTree(makeConfig());
      generateMock.mockImplementation(() => {
        throw new Error('Invalid configuration: token.name required');
      });
      await expect(service!.generateFileTree(makeConfig())).rejects.toBeInstanceOf(
        CodegenInvalidConfigError
      );
      expect(
        validateMock,
        'INV-9: generateFileTree must not pre-flight validate()'
      ).not.toHaveBeenCalled();
    });
  });

  describe('idempotency', () => {
    it('returns equal files maps for two sequential calls (INV-11)', async () => {
      const config = Object.freeze(makeConfig());
      const service = await loadCodegenService('stellar');
      const first = await service!.generateFileTree(config);
      const second = await service!.generateFileTree(config);
      expect(first.files).toEqual(second.files);
      expect(generateMock).toHaveBeenCalledTimes(2);
    });

    it('does not mutate a previously returned files map on a later call (INV-12)', async () => {
      let call = 0;
      generateMock.mockImplementation(() => {
        call += 1;
        return { files: { 'README.md': `v${call}` } };
      });
      const service = await loadCodegenService('stellar');
      const first = await service!.generateFileTree(makeConfig());
      await service!.generateFileTree(makeConfig());
      expect(first.files['README.md']).toBe('v1');
    });
  });

  describe('side-effect ordering', () => {
    it('does not call generateZip or generateZipWithIdentitySupport (INV-15)', async () => {
      const service = await loadCodegenService('stellar');
      await service!.generateFileTree(makeConfig(), { includeIdentitySupport: true });
      expect(generateZipMock).not.toHaveBeenCalled();
      expect(generateZipWithIdentitySupportMock).not.toHaveBeenCalled();
    });

    it('does not emit a packaging onStatus event (INV-16)', async () => {
      generateMock.mockImplementation((_config, options) => {
        options?.onProgress?.({ phase: 'validating', percentage: 10, message: 'check' });
        options?.onProgress?.({ phase: 'generating', percentage: 50, message: 'write' });
        return { files: { ...PLAIN_FILES } };
      });
      const phases: string[] = [];
      const service = await loadCodegenService('stellar');
      await service!.generateFileTree(makeConfig(), {
        onStatus: (status) => phases.push(status.phase),
      });
      expect(phases).toEqual(['validating', 'generating']);
      expect(phases).not.toContain('packaging');
    });

    it('does not invent a success onStatus when generate throws (INV-18)', async () => {
      generateMock.mockImplementation(() => {
        throw new Error('boom');
      });
      const phases: string[] = [];
      const service = await loadCodegenService('stellar');
      await expect(
        service!.generateFileTree(makeConfig(), {
          onStatus: (status) => phases.push(status.phase),
        })
      ).rejects.toBeInstanceOf(CodegenGenerationError);
      expect(phases).not.toContain('success');
    });

    it('leaves generateZip identity dispatch on the zip functions (INV-17)', async () => {
      const service = await loadCodegenService('stellar');
      expect(service!.supportsIdentitySupport).toBe(true);
      await service!.generateZip(makeConfig(), { includeIdentitySupport: true });
      expect(generateZipWithIdentitySupportMock).toHaveBeenCalledTimes(1);
      expect(generateZipMock).not.toHaveBeenCalled();
      expect(generateWithIdentitySupportMock).not.toHaveBeenCalled();
    });
  });

  describe('resource limits', () => {
    it('performs exactly one generate call per invocation (INV-19)', async () => {
      const service = await loadCodegenService('stellar');
      await service!.generateFileTree(makeConfig());
      expect(generateMock).toHaveBeenCalledTimes(1);
      expect(generateWithIdentitySupportMock).not.toHaveBeenCalled();
    });

    it('returns the package files reference without cloning (INV-20)', async () => {
      const packageFiles = { 'README.md': '# once\n' };
      generateMock.mockImplementation(() => ({ files: packageFiles }));
      const service = await loadCodegenService('stellar');
      const result = await service!.generateFileTree(makeConfig());
      expect(result.files).toBe(packageFiles);
    });
  });

  describe('portability', () => {
    it('returns a thenable even when generate is synchronous (INV-23)', async () => {
      const service = await loadCodegenService('stellar');
      const pending = service!.generateFileTree(makeConfig());
      expect(typeof pending.then).toBe('function');
      await pending;
    });

    it('rejects rather than throwing synchronously when generate fails (INV-23)', async () => {
      generateMock.mockImplementation(() => {
        throw new Error('boom');
      });
      const service = await loadCodegenService('stellar');
      let threwSync = false;
      let pending: Promise<unknown> | undefined;
      try {
        pending = service!.generateFileTree(makeConfig());
      } catch {
        threwSync = true;
      }
      expect(threwSync, 'INV-23: SF-8 catches rejections, not sync throws').toBe(false);
      await expect(pending).rejects.toBeInstanceOf(CodegenGenerationError);
    });
  });
});
