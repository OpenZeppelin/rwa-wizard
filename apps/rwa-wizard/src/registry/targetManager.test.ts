import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RwaCodegenService } from '../services/codegen/types';
import type { TargetAdapterCapabilities } from '../services/runtime/types';

const mockService: RwaCodegenService = {
  validate: vi.fn().mockResolvedValue({ valid: true, errors: [], warnings: [] }),
  getAvailableModules: vi.fn().mockResolvedValue([
    {
      id: 'supply-limit',
      name: 'Supply Limit',
      category: 'supply-and-balance',
      runtimePrerequisites: [],
      requiredHooks: ['created', 'destroyed'],
      review: { state: 'stable' },
      configFields: [],
    },
  ]),
  getEcosystemMetadata: vi.fn().mockReturnValue({
    administrativeControls: [],
    identityControls: [],
    operatorRoles: [],
    complianceHooks: [],
    complianceCatalog: {
      moduleCategories: ['supply-and-balance'],
      selectionWarningRules: [],
    },
    limits: { maxModulesPerHook: 20, maxTrustedIssuers: 50 },
  }),
  generateZip: vi.fn(),
};

const mockAdapterCapabilities: TargetAdapterCapabilities = {
  addressing: { isValidAddress: (addr: string) => addr.startsWith('C') && addr.length === 56 },
  networkCatalog: {
    getNetworks: () => [
      {
        id: 'stellar-testnet',
        name: 'Stellar Testnet',
        ecosystem: 'stellar' as const,
        network: 'stellar',
        type: 'testnet' as const,
        isTestnet: true,
        exportConstName: 'stellarTestnet',
        horizonUrl: 'https://horizon-testnet.stellar.org',
        sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
        networkPassphrase: 'Test SDF Network ; September 2015',
      },
    ],
  },
  uiLabels: { getUiLabels: () => ({ transactionFee: 'Gas Fee' }) },
  createExplorer: () => ({
    getExplorerUrl: (addr: string) => `https://stellar.expert/explorer/testnet/account/${addr}`,
  }),
};

vi.mock('../services/codegen', () => ({
  ensureCodegenLoaded: vi.fn().mockResolvedValue(undefined),
  getCodegenService: vi.fn().mockReturnValue(mockService),
}));

vi.mock('../services/runtime', () => ({
  ensureAdapterLoaded: vi.fn().mockResolvedValue(undefined),
  getAdapterCapabilities: vi.fn().mockReturnValue(mockAdapterCapabilities),
}));

let loadRuntime: typeof import('./targetManager').loadRuntime;
let getTargetCapabilitySnapshot: typeof import('./targetManager').getTargetCapabilitySnapshot;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import('./targetManager');
  loadRuntime = mod.loadRuntime;
  getTargetCapabilitySnapshot = mod.getTargetCapabilitySnapshot;
});

describe('targetManager', () => {
  describe('loadRuntime', () => {
    it('loads runtime for an enabled target (stellar)', async () => {
      const runtime = await loadRuntime('stellar');
      expect(runtime.targetId).toBe('stellar');
      expect(runtime.codegenService).toBeDefined();
      expect(typeof runtime.codegenService!.validate).toBe('function');
    });

    it('includes adapter capabilities in the loaded runtime', async () => {
      const runtime = await loadRuntime('stellar');
      expect(runtime.adapterCapabilities).toBeDefined();
      expect(runtime.adapterCapabilities?.addressing).toBeDefined();
      expect(runtime.adapterCapabilities?.networkCatalog).toBeDefined();
      expect(runtime.adapterCapabilities?.uiLabels).toBeDefined();
      expect(typeof runtime.adapterCapabilities?.createExplorer).toBe('function');
    });

    it('addressing capability validates addresses', async () => {
      const runtime = await loadRuntime('stellar');
      const addressing = runtime.adapterCapabilities!.addressing;
      expect(addressing.isValidAddress('C'.padEnd(56, 'A'))).toBe(true);
      expect(addressing.isValidAddress('invalid')).toBe(false);
    });

    it('rejects unknown targets', async () => {
      await expect(loadRuntime('nonexistent')).rejects.toThrow('target/unknown');
    });

    it('rejects disabled (coming-soon) targets', async () => {
      await expect(loadRuntime('evm')).rejects.toThrow('target/disabled');
    });

    it('caches loaded runtimes', async () => {
      const first = await loadRuntime('stellar');
      const second = await loadRuntime('stellar');
      expect(first).toBe(second);
    });
  });

  describe('getTargetCapabilitySnapshot', () => {
    it('returns modules for an enabled target', async () => {
      const snapshot = await getTargetCapabilitySnapshot('stellar');
      expect(snapshot.targetId).toBe('stellar');
      expect(snapshot.availableModules.length).toBeGreaterThan(0);
    });

    it('populates networkOptions from NetworkCatalogCapability', async () => {
      const snapshot = await getTargetCapabilitySnapshot('stellar');
      expect(snapshot.networkOptions).toBeDefined();
      expect(snapshot.networkOptions!.length).toBe(1);
      expect(snapshot.networkOptions![0].value).toBe('stellar-testnet');
      expect(snapshot.networkOptions![0].label).toBe('Stellar Testnet');
      expect(snapshot.networkOptions![0].hint).toBe('Testnet');
    });

    it('does not include a mocked flag', async () => {
      const snapshot = await getTargetCapabilitySnapshot('stellar');
      expect(snapshot).not.toHaveProperty('mocked');
    });
  });
});
