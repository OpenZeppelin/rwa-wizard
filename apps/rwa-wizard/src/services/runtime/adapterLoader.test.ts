import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CapabilityFactoryMap, EcosystemExport } from '@openzeppelin/ui-types';

function createMockEcosystemExport(overrides: Partial<CapabilityFactoryMap> = {}): EcosystemExport {
  return {
    id: 'stellar',
    name: 'Stellar',
    ecosystem: 'stellar' as const,
    networks: [],
    capabilities: {
      addressing: () => ({
        isValidAddress: (addr: string) => addr.startsWith('G') || addr.startsWith('C'),
      }),
      explorer: () => ({
        getExplorerUrl: (addr: string) => `https://stellar.expert/${addr}`,
      }),
      networkCatalog: () => ({
        getNetworks: () => [],
      }),
      uiLabels: () => ({
        getUiLabels: () => ({}),
      }),
      ...overrides,
    },
    createRuntime: vi.fn(),
  } as unknown as EcosystemExport;
}

vi.mock('@openzeppelin/adapter-stellar', () => ({
  ecosystemDefinition: createMockEcosystemExport(),
}));

vi.mock('@openzeppelin/adapter-evm', () => ({
  ecosystemDefinition: createMockEcosystemExport({
    addressing: () => ({
      isValidAddress: (addr: string) => addr.startsWith('0x') && addr.length === 42,
    }),
  }),
}));

describe('adapterLoader', () => {
  let loadAdapterCapabilities: typeof import('./adapterLoader').loadAdapterCapabilities;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('./adapterLoader');
    loadAdapterCapabilities = mod.loadAdapterCapabilities;
  });

  it('loads stellar adapter capabilities', async () => {
    const caps = await loadAdapterCapabilities('stellar');
    expect(caps).not.toBeNull();
    expect(caps!.addressing).toBeDefined();
    expect(caps!.networkCatalog).toBeDefined();
    expect(caps!.uiLabels).toBeDefined();
    expect(typeof caps!.createExplorer).toBe('function');
  });

  it('stellar addressing validates addresses', async () => {
    const caps = await loadAdapterCapabilities('stellar');
    expect(caps!.addressing.isValidAddress('GABC')).toBe(true);
    expect(caps!.addressing.isValidAddress('0xDEF')).toBe(false);
  });

  it('loads evm adapter capabilities', async () => {
    const caps = await loadAdapterCapabilities('evm');
    expect(caps).not.toBeNull();
    expect(caps!.addressing.isValidAddress('0x' + 'a'.repeat(40))).toBe(true);
  });

  it('returns null for unknown targets', async () => {
    const caps = await loadAdapterCapabilities('polkadot');
    expect(caps).toBeNull();
  });

  it('creates explorer from factory', async () => {
    const caps = await loadAdapterCapabilities('stellar');
    const explorer = caps!.createExplorer({} as never);
    const url = explorer.getExplorerUrl('GABC');
    expect(url).toContain('GABC');
  });
});
