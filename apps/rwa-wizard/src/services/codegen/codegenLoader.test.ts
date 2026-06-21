import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeConfig } from '../../test/fixtures/wizardFixtures';
import { loadCodegenService } from './codegenLoader';

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
  generateZip: generateZipMock,
  generateZipWithIdentitySupport: generateZipWithIdentitySupportMock,
  getEcosystemMetadata: getEcosystemMetadataMock,
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
    getCodegenRuntimeOptionsMock.mockReset();
    getEcosystemMetadataMock.mockClear();
    getCodegenInfoBlurbMock.mockClear();
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
});
