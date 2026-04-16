import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deploymentStep } from '../../src/interactive/steps/deployment';
import { createMockAdapter, createMockHints } from '../helpers';

const mockPrompts = vi.hoisted(() => ({
  select: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn(),
  log: { step: vi.fn(), info: vi.fn() },
}));

vi.mock('@clack/prompts', () => mockPrompts);

describe('deploymentStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should build a preset target when the user picks preset', async () => {
    const adapter = createMockAdapter({ chain: 'stellar' });
    mockPrompts.select
      .mockResolvedValueOnce('preset') // target kind
      .mockResolvedValueOnce('stellar-testnet'); // network
    mockPrompts.confirm.mockResolvedValueOnce(false); // no source account

    const result = await deploymentStep(adapter);

    expect(result).toEqual({
      target: {
        kind: 'preset',
        ecosystem: 'stellar',
        networkId: 'stellar-testnet',
      },
    });
    expect(mockPrompts.text).not.toHaveBeenCalled();
  });

  it('should build a custom target with only the RPC URL when optional fields are blank', async () => {
    const adapter = createMockAdapter({ chain: 'stellar' });
    mockPrompts.select.mockResolvedValueOnce('custom');
    mockPrompts.text
      .mockResolvedValueOnce('https://rpc.example.com') // rpcUrl
      .mockResolvedValueOnce('') // explorerUrl
      .mockResolvedValueOnce(''); // label
    mockPrompts.confirm.mockResolvedValueOnce(false);

    const result = await deploymentStep(adapter);

    expect(result).toEqual({
      target: {
        kind: 'custom',
        ecosystem: 'stellar',
        rpcUrl: 'https://rpc.example.com',
      },
    });
  });

  it('should include explorerUrl and label when provided on custom targets', async () => {
    const adapter = createMockAdapter({ chain: 'stellar' });
    mockPrompts.select.mockResolvedValueOnce('custom');
    mockPrompts.text
      .mockResolvedValueOnce('https://rpc.example.com')
      .mockResolvedValueOnce('https://explorer.example.com')
      .mockResolvedValueOnce('Staging');
    mockPrompts.confirm.mockResolvedValueOnce(false);

    const result = await deploymentStep(adapter);

    expect(result.target).toEqual({
      kind: 'custom',
      ecosystem: 'stellar',
      rpcUrl: 'https://rpc.example.com',
      explorerUrl: 'https://explorer.example.com',
      label: 'Staging',
    });
  });

  it('should attach a sourceAccount when the user opts in', async () => {
    const adapter = createMockAdapter({ chain: 'stellar' });
    mockPrompts.select.mockResolvedValueOnce('preset').mockResolvedValueOnce('stellar-testnet');
    mockPrompts.confirm.mockResolvedValueOnce(true); // opt into source account
    mockPrompts.text.mockResolvedValueOnce('  GCSRC123  '); // trimmed

    const result = await deploymentStep(adapter);

    expect(result.sourceAccount).toBe('GCSRC123');
  });

  it('should skip the target-kind prompt when the adapter opts out of custom RPC', async () => {
    const hints = createMockHints();
    hints.supportsCustomRpc = false;
    const adapter = createMockAdapter({ chain: 'stellar', hints });
    mockPrompts.select.mockResolvedValueOnce('stellar-mainnet'); // network (no kind prompt)
    mockPrompts.confirm.mockResolvedValueOnce(false);

    const result = await deploymentStep(adapter);

    expect(result.target).toEqual({
      kind: 'preset',
      ecosystem: 'stellar',
      networkId: 'stellar-mainnet',
    });
    expect(mockPrompts.select).toHaveBeenCalledOnce();
  });

  it('should skip the target-kind prompt when the adapter has no presets', async () => {
    const hints = createMockHints();
    hints.networks = [];
    const adapter = createMockAdapter({ chain: 'stellar', hints });
    mockPrompts.text
      .mockResolvedValueOnce('https://rpc.example.com')
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce('');
    mockPrompts.confirm.mockResolvedValueOnce(false);

    const result = await deploymentStep(adapter);

    expect(result.target).toEqual({
      kind: 'custom',
      ecosystem: 'stellar',
      rpcUrl: 'https://rpc.example.com',
    });
    expect(mockPrompts.select).not.toHaveBeenCalled();
  });

  it('should throw when neither presets nor custom RPC are available', async () => {
    const hints = createMockHints();
    hints.networks = [];
    hints.supportsCustomRpc = false;
    const adapter = createMockAdapter({ chain: 'stellar', hints });

    await expect(deploymentStep(adapter)).rejects.toThrow(/no preset networks/);
  });
});
