import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChainHints } from '../../src/generators/registry';
import { assetStep } from '../../src/interactive/steps/asset';
import { createMockHints } from '../helpers';

const mockPrompts = vi.hoisted(() => ({
  text: vi.fn(),
  confirm: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn(),
  log: { step: vi.fn() },
}));

vi.mock('@clack/prompts', () => mockPrompts);

describe('assetStep', () => {
  let hints: ChainHints;

  beforeEach(() => {
    vi.clearAllMocks();
    hints = createMockHints();
  });

  it('should collect token name, symbol, decimals, and doc manager', async () => {
    mockPrompts.text
      .mockResolvedValueOnce('Acme Token')
      .mockResolvedValueOnce('ACME')
      .mockResolvedValueOnce('8');
    mockPrompts.confirm
      .mockResolvedValueOnce(false) // no initial supply
      .mockResolvedValueOnce(true); // enable doc manager

    const result = await assetStep(hints);

    expect(result.name).toBe('Acme Token');
    expect(result.symbol).toBe('ACME');
    expect(result.decimals).toBe(8);
    expect(result.initialSupply).toBeUndefined();
    expect(result.documentManager.enabled).toBe(true);
  });

  it('should collect initial supply when enabled', async () => {
    mockPrompts.text
      .mockResolvedValueOnce('Token')
      .mockResolvedValueOnce('TKN')
      .mockResolvedValueOnce('18')
      .mockResolvedValueOnce('1000000');
    mockPrompts.confirm
      .mockResolvedValueOnce(true) // yes initial supply
      .mockResolvedValueOnce(false); // disable doc manager

    const result = await assetStep(hints);

    expect(result.initialSupply).toBe('1000000');
    expect(result.documentManager.enabled).toBe(false);
  });

  it('should trim whitespace from name and symbol', async () => {
    mockPrompts.text
      .mockResolvedValueOnce('  Padded Name  ')
      .mockResolvedValueOnce('  PAD  ')
      .mockResolvedValueOnce('6');
    mockPrompts.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const result = await assetStep(hints);

    expect(result.name).toBe('Padded Name');
    expect(result.symbol).toBe('PAD');
  });

  it('should use default decimals from hints', async () => {
    mockPrompts.text
      .mockResolvedValueOnce('Token')
      .mockResolvedValueOnce('TKN')
      .mockResolvedValueOnce('18');
    mockPrompts.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await assetStep(hints);

    const decimalsCall = mockPrompts.text.mock.calls[2][0];
    expect(decimalsCall.defaultValue).toBe(String(hints.decimalsMax));
    expect(decimalsCall.message).toContain(`${hints.decimalsMin}`);
    expect(decimalsCall.message).toContain(`${hints.decimalsMax}`);
  });

  it('should pass validation constraints from hints for name', async () => {
    mockPrompts.text
      .mockResolvedValueOnce('Token')
      .mockResolvedValueOnce('TKN')
      .mockResolvedValueOnce('8');
    mockPrompts.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await assetStep(hints);

    const nameValidator = mockPrompts.text.mock.calls[0][0].validate;
    expect(nameValidator('')).toBeDefined();
    expect(nameValidator('  ')).toBeDefined();
    expect(nameValidator('x'.repeat(hints.tokenNameMaxLength + 1))).toBeDefined();
    expect(nameValidator('Valid Name')).toBeUndefined();
  });

  it('should pass validation constraints from hints for symbol', async () => {
    mockPrompts.text
      .mockResolvedValueOnce('Token')
      .mockResolvedValueOnce('TKN')
      .mockResolvedValueOnce('8');
    mockPrompts.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await assetStep(hints);

    const symbolValidator = mockPrompts.text.mock.calls[1][0].validate;
    expect(symbolValidator('')).toBeDefined();
    expect(symbolValidator('x'.repeat(hints.tokenSymbolMaxLength + 1))).toBeDefined();
    expect(symbolValidator('OK')).toBeUndefined();
  });

  it('should exit on cancel', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    mockPrompts.isCancel.mockReturnValueOnce(true);
    mockPrompts.text.mockResolvedValueOnce(Symbol('cancel'));

    await expect(assetStep(hints)).rejects.toThrow('exit');
    expect(mockPrompts.cancel).toHaveBeenCalled();
    mockExit.mockRestore();
  });
});
