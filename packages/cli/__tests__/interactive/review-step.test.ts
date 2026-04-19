import { beforeEach, describe, expect, it, vi } from 'vitest';

import { reviewStep } from '../../src/interactive/steps/review';
import { createValidConfig } from '../helpers';

const mockPrompts = vi.hoisted(() => ({
  confirm: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn(),
  note: vi.fn(),
  log: { step: vi.fn() },
}));

vi.mock('@clack/prompts', () => mockPrompts);

describe('reviewStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display a summary and return true on confirmation', async () => {
    mockPrompts.confirm.mockResolvedValueOnce(true);

    const result = await reviewStep(createValidConfig());

    expect(result).toBe(true);
    expect(mockPrompts.note).toHaveBeenCalledOnce();
    expect(mockPrompts.log.step).toHaveBeenCalledWith('Step 6/6 — Review & Generate');
  });

  it('should return false when user declines', async () => {
    mockPrompts.confirm.mockResolvedValueOnce(false);

    const result = await reviewStep(createValidConfig());

    expect(result).toBe(false);
  });

  it('should include all core contracts in the summary', async () => {
    mockPrompts.confirm.mockResolvedValueOnce(true);

    await reviewStep(createValidConfig());

    const summary = mockPrompts.note.mock.calls[0][0] as string;
    expect(summary).toContain('RWA Token');
    expect(summary).toContain('Compliance');
    expect(summary).toContain('Identity Verifier');
    expect(summary).toContain('Claim Topics & Issuers');
    expect(summary).toContain('Identity Registry Storage');
    expect(summary).toContain('5 contracts total');
  });

  it('should include token details in the summary', async () => {
    mockPrompts.confirm.mockResolvedValueOnce(true);

    const config = createValidConfig();
    await reviewStep(config);

    const summary = mockPrompts.note.mock.calls[0][0] as string;
    expect(summary).toContain('Test Token');
    expect(summary).toContain('TEST');
    expect(summary).toContain('8');
  });

  it('should include initial supply when configured', async () => {
    mockPrompts.confirm.mockResolvedValueOnce(true);

    const config = createValidConfig();
    config.token.initialSupply = '999999';
    await reviewStep(config);

    const summary = mockPrompts.note.mock.calls[0][0] as string;
    expect(summary).toContain('999999');
  });

  it('should include compliance modules in contract list', async () => {
    mockPrompts.confirm.mockResolvedValueOnce(true);

    const config = createValidConfig();
    config.compliance.modules = [
      { moduleId: 'supply-cap', hook: 'creation' },
      { moduleId: 'transfer-limit', hook: 'transfer' },
    ];
    await reviewStep(config);

    const summary = mockPrompts.note.mock.calls[0][0] as string;
    expect(summary).toContain('supply-cap');
    expect(summary).toContain('transfer-limit');
    expect(summary).toContain('7 contracts total');
  });

  it('should include identity details', async () => {
    mockPrompts.confirm.mockResolvedValueOnce(true);

    const config = createValidConfig();
    await reviewStep(config);

    const summary = mockPrompts.note.mock.calls[0][0] as string;
    expect(summary).toContain('KYC');
    expect(summary).toContain('GCEXAMPLEISSUER1');
  });

  it('should include role details with symbol', async () => {
    mockPrompts.confirm.mockResolvedValueOnce(true);

    const config = createValidConfig();
    await reviewStep(config);

    const summary = mockPrompts.note.mock.calls[0][0] as string;
    expect(summary).toContain('Manager');
    expect(summary).toContain('[manager]');
    expect(summary).toContain('single-owner');
  });

  it('should show deployment network', async () => {
    mockPrompts.confirm.mockResolvedValueOnce(true);

    const config = createValidConfig();
    await reviewStep(config);

    const summary = mockPrompts.note.mock.calls[0][0] as string;
    expect(summary).toContain('testnet');
  });
});
