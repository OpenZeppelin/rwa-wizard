import { vi } from 'vitest';

import type { GenerationResult, ValidationResult, ZipResult } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { ChainHints, GeneratorAdapter } from '../src/generators/registry';

export function createValidConfig(overrides?: Partial<RWAConfig>): RWAConfig {
  return {
    token: {
      name: 'Test Token',
      symbol: 'TEST',
      decimals: 8,
      administrativeControls: { burnable: true, mintable: true, pausable: true },
      documentManager: { enabled: true },
    },
    identityVerification: {
      claimTopics: [{ id: 1, name: 'KYC' }],
      trustedIssuers: [{ address: 'GCEXAMPLEISSUER1', claimTopics: [1] }],
      controls: {
        addressFreezing: true,
        partialTokenFreezing: false,
        recovery: false,
        forcedTransfers: false,
      },
    },
    compliance: { modules: [] },
    accessControl: {
      ownership: { type: 'single-owner', ownerAddress: 'GCEXAMPLEOWNER' },
      roles: [{ name: 'Manager', symbol: 'manager', addresses: ['GCMGR1'] }],
    },
    deployment: {
      target: { kind: 'preset', ecosystem: 'stellar', networkId: 'stellar-testnet' },
    },
    ...overrides,
  };
}

export function createMockHints(): ChainHints {
  return {
    addressPlaceholder: 'e.g. 0x1234...',
    tokenNameMaxLength: 32,
    tokenSymbolMaxLength: 12,
    decimalsMin: 0,
    decimalsMax: 18,
    roleSymbolMaxLength: 9,
    networks: [
      { value: 'stellar-testnet', label: 'Testnet' },
      { value: 'stellar-mainnet', label: 'Mainnet' },
    ],
  };
}

export function createMockGenerationResult(
  overrides?: Partial<GenerationResult>
): GenerationResult {
  return {
    files: { 'src/main.rs': 'fn main() {}', 'Cargo.toml': '[package]' },
    metadata: {
      generatorName: 'mock',
      generatorVersion: '0.0.0',
      generatedAt: new Date().toISOString(),
      fileCount: 2,
      configHash: 'abc123',
    },
    ...overrides,
  };
}

export function createMockZipResult(overrides?: Partial<ZipResult>): ZipResult {
  return {
    data: new Blob(['fake-zip-content']),
    fileName: 'test.zip',
    metadata: {
      generatorName: 'mock',
      generatorVersion: '0.0.0',
      generatedAt: new Date().toISOString(),
      fileCount: 5,
      configHash: 'abc123',
    },
    ...overrides,
  };
}

export function createMockValidationResult(
  overrides?: Partial<ValidationResult>
): ValidationResult {
  return {
    valid: true,
    errors: [],
    warnings: [],
    ...overrides,
  };
}

export function createMockAdapter(overrides?: Partial<GeneratorAdapter>): GeneratorAdapter {
  return {
    name: 'Mock Generator',
    chain: 'mock',
    hints: createMockHints(),
    generate: vi.fn<() => GenerationResult>().mockReturnValue(createMockGenerationResult()),
    validate: vi.fn<() => ValidationResult>().mockReturnValue(createMockValidationResult()),
    generateZip: vi.fn<() => Promise<ZipResult>>().mockResolvedValue(createMockZipResult()),
    getAvailableModules: vi.fn().mockReturnValue([]),
    getOperatorRolePresets: vi.fn().mockReturnValue([]),
    ...overrides,
  } as GeneratorAdapter;
}
