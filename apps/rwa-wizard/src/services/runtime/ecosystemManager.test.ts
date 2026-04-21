import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { NetworkConfig } from '@openzeppelin/ui-types';

// We intentionally do NOT mock the `/metadata` subpath: it is a tiny, static,
// side-effect-free export, so letting the real adapter metadata flow through
// keeps the tests honest about the contract the manager actually sees at
// runtime. We mock `/networks` and the full adapter module to keep the test
// deterministic (stable network ids) and to avoid pulling SDK / wallet code
// into the test environment.

const stellarNetworksFixture: NetworkConfig[] = [
  { id: 'stellar-mainnet', ecosystem: 'stellar', name: 'Stellar Mainnet' } as NetworkConfig,
  { id: 'stellar-testnet', ecosystem: 'stellar', name: 'Stellar Testnet' } as NetworkConfig,
];

const evmNetworksFixture: NetworkConfig[] = [
  { id: 'ethereum', ecosystem: 'evm', name: 'Ethereum' } as NetworkConfig,
];

vi.mock('@openzeppelin/adapter-stellar/networks', () => ({
  networks: stellarNetworksFixture,
}));

vi.mock('@openzeppelin/adapter-evm/networks', () => ({
  networks: evmNetworksFixture,
}));

vi.mock('@openzeppelin/adapter-stellar', () => ({
  ecosystemDefinition: {
    id: 'stellar',
    networks: stellarNetworksFixture,
    capabilities: {},
    createRuntime: vi.fn(),
  },
}));

vi.mock('@openzeppelin/adapter-evm', () => ({
  ecosystemDefinition: {
    id: 'evm',
    networks: evmNetworksFixture,
    capabilities: {},
    createRuntime: vi.fn(),
  },
}));

describe('ecosystemManager', () => {
  let manager: typeof import('./ecosystemManager');

  beforeEach(async () => {
    vi.resetModules();
    manager = await import('./ecosystemManager');
  });

  describe('getEcosystemMetadata (sync)', () => {
    it('returns the real adapter metadata for supported ecosystems', () => {
      const stellar = manager.getEcosystemMetadata('stellar');
      const evm = manager.getEcosystemMetadata('evm');

      expect(stellar?.id).toBe('stellar');
      expect(stellar?.addressExample).toBeTruthy();
      expect(evm?.id).toBe('evm');
      expect(evm?.addressExample).toBeTruthy();
    });

    it('returns undefined for unsupported ecosystems', () => {
      expect(manager.getEcosystemMetadata('polkadot')).toBeUndefined();
    });
  });

  describe('getSupportedEcosystems', () => {
    it('lists every supported ecosystem id', () => {
      expect([...manager.getSupportedEcosystems()].sort()).toEqual(['evm', 'stellar']);
    });
  });

  describe('getNetworksByEcosystem', () => {
    it('returns the network configs for that ecosystem', async () => {
      const stellarResult = await manager.getNetworksByEcosystem('stellar');
      expect(stellarResult.map((n) => n.id)).toEqual(['stellar-mainnet', 'stellar-testnet']);

      const evmResult = await manager.getNetworksByEcosystem('evm');
      expect(evmResult.map((n) => n.id)).toEqual(['ethereum']);
    });

    it('returns the same array reference on repeat calls (cached)', async () => {
      const first = await manager.getNetworksByEcosystem('stellar');
      const second = await manager.getNetworksByEcosystem('stellar');
      expect(second).toBe(first);
    });

    it('returns empty array for unsupported ecosystems', async () => {
      expect(await manager.getNetworksByEcosystem('polkadot')).toEqual([]);
    });
  });

  describe('getAllNetworks', () => {
    it('returns the union of all supported ecosystems', async () => {
      const all = await manager.getAllNetworks();
      const ids = all.map((n) => n.id).sort();
      expect(ids).toEqual(['ethereum', 'stellar-mainnet', 'stellar-testnet']);
    });
  });

  describe('getEcosystemDefinition', () => {
    it('returns the full ecosystem export for supported ecosystems', async () => {
      const def = await manager.getEcosystemDefinition('stellar');
      expect(def?.id).toBe('stellar');
      expect(def?.networks).toEqual(stellarNetworksFixture);
    });

    it('returns the same promise on repeat calls (cached)', async () => {
      const first = manager.getEcosystemDefinition('stellar');
      const second = manager.getEcosystemDefinition('stellar');
      expect(await first).toBe(await second);
    });

    it('returns undefined for unsupported ecosystems', async () => {
      expect(await manager.getEcosystemDefinition('polkadot')).toBeUndefined();
    });
  });

  describe('getNetworkById', () => {
    it('finds a network across all supported ecosystems', async () => {
      const net = await manager.getNetworkById('ethereum');
      expect(net?.id).toBe('ethereum');
    });

    it('returns undefined when no ecosystem owns the id', async () => {
      expect(await manager.getNetworkById('unknown-net')).toBeUndefined();
    });
  });
});
