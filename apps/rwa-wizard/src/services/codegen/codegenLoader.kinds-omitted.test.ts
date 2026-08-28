import { describe, expect, it, vi } from 'vitest';

import { loadCodegenService } from './codegenLoader';

vi.mock('./runtimeOptions', () => ({
  getCodegenRuntimeOptions: () => undefined,
}));

vi.mock('@openzeppelin/codegen-core', () => ({
  toSummaryPhase: (phase: string) => phase,
}));

vi.mock('@openzeppelin/codegen-rwa-stellar', () => ({
  validate: () => ({ valid: true, errors: [], warnings: [] }),
  getAvailableModules: () => [],
  generate: undefined,
  generateZip: async () => ({ fileName: 'test.zip', data: new Blob(['zip']) }),
  generateZipWithIdentitySupport: async () => ({
    fileName: 'test-identity.zip',
    data: new Blob(['zip']),
  }),
  getEcosystemMetadata: () => undefined,
  getUpstreamSourceRevision: () => ({
    repoUrl: 'https://github.com/OpenZeppelin/stellar-contracts',
    commitHash: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    mode: 'git-revision' as const,
  }),
  getUpstreamImportLinks: () => ({
    language: 'rust',
    importLinePrefix: 'use ',
    targets: [{ identifier: 'stellar_access', path: 'packages/access' }],
  }),
  // INV-6: omitted export. Explicit undefined so Vitest does not throw on access.
  getGeneratedFileKind: undefined,
  getCodegenInfoBlurb: () => ({ title: 'Mock', description: 'Mock blurb', links: [] }),
  getDeployGuidance: () => undefined,
  getComplianceConfigWarnings: () => [],
  hasComplianceConfigBlockingIssues: () => false,
  isDemoAutoMintConfigReady: () => true,
  isComplianceConfigBlockingWarningId: () => false,
}));

describe('loadCodegenService omitted getGeneratedFileKind (INV-6)', () => {
  it('leaves the method undefined when the package omits the export', async () => {
    const service = await loadCodegenService('stellar');
    expect(service).not.toBeNull();
    expect(service!.getGeneratedFileKind).toBeUndefined();
    expect(service!.getGeneratedFileKind?.('config.json') ?? 'unknown').toBe('unknown');
  });
});
