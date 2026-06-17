import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChainHints, OperatorRolePreset } from '../../src/generators/registry';
import { rolesStep } from '../../src/interactive/steps/roles';
import { createMockHints } from '../helpers';

const mockPrompts = vi.hoisted(() => ({
  text: vi.fn(),
  confirm: vi.fn(),
  select: vi.fn(),
  multiselect: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn(),
  log: { step: vi.fn() },
}));

vi.mock('@clack/prompts', () => mockPrompts);

describe('rolesStep', () => {
  let hints: ChainHints;

  beforeEach(() => {
    vi.clearAllMocks();
    hints = createMockHints();
  });

  it('should collect ownership and roles', async () => {
    mockPrompts.select.mockResolvedValueOnce('single-owner');
    mockPrompts.text.mockResolvedValueOnce('GCOWNERADDR');
    mockPrompts.confirm
      .mockResolvedValueOnce(true) // add roles
      .mockResolvedValueOnce(false); // stop adding roles
    mockPrompts.text
      .mockResolvedValueOnce('Manager') // role name
      .mockResolvedValueOnce('mgr') // role symbol
      .mockResolvedValueOnce('GCMGR1,GCMGR2'); // addresses

    const result = await rolesStep(hints);

    expect(result.ownership).toEqual({ type: 'single-owner', ownerAddress: 'GCOWNERADDR' });
    expect(result.roles).toHaveLength(1);
    expect(result.roles[0].name).toBe('Manager');
    expect(result.roles[0].symbol).toBe('mgr');
    expect(result.roles[0].addresses).toEqual(['GCMGR1', 'GCMGR2']);
  });

  it('should handle multi-sig ownership', async () => {
    mockPrompts.select.mockResolvedValueOnce('multi-sig');
    mockPrompts.text.mockResolvedValueOnce('GCMULTISIGADDR');
    mockPrompts.confirm.mockResolvedValueOnce(false); // no roles

    const result = await rolesStep(hints);

    expect(result.ownership).toEqual({ type: 'multi-sig', address: 'GCMULTISIGADDR' });
  });

  it('should handle DAO ownership', async () => {
    mockPrompts.select.mockResolvedValueOnce('dao');
    mockPrompts.text.mockResolvedValueOnce('GCDAOADDR');
    mockPrompts.confirm.mockResolvedValueOnce(false); // no roles

    const result = await rolesStep(hints);

    expect(result.ownership).toEqual({ type: 'dao', address: 'GCDAOADDR' });
  });

  it('should allow skipping roles', async () => {
    mockPrompts.select.mockResolvedValueOnce('single-owner');
    mockPrompts.text.mockResolvedValueOnce('GCOWNER');
    mockPrompts.confirm.mockResolvedValueOnce(false); // no roles

    const result = await rolesStep(hints);

    expect(result.roles).toEqual([]);
  });

  it('should allow multiple roles', async () => {
    mockPrompts.select.mockResolvedValueOnce('single-owner');
    mockPrompts.text.mockResolvedValueOnce('GCOWNER');
    mockPrompts.confirm
      .mockResolvedValueOnce(true) // add roles
      .mockResolvedValueOnce(true) // add another
      .mockResolvedValueOnce(false); // stop
    mockPrompts.text
      .mockResolvedValueOnce('Manager') // role 1 name
      .mockResolvedValueOnce('') // role 1 symbol (empty = auto)
      .mockResolvedValueOnce('GCMGR1') // role 1 addresses
      .mockResolvedValueOnce('Agent') // role 2 name
      .mockResolvedValueOnce('agent') // role 2 symbol
      .mockResolvedValueOnce('GCAGENT1'); // role 2 addresses

    const result = await rolesStep(hints);

    expect(result.roles).toHaveLength(2);
    expect(result.roles[0].name).toBe('Manager');
    expect(result.roles[0].symbol).toBeUndefined();
    expect(result.roles[1].name).toBe('Agent');
    expect(result.roles[1].symbol).toBe('agent');
  });

  it('should use address placeholder from hints', async () => {
    mockPrompts.select.mockResolvedValueOnce('single-owner');
    mockPrompts.text.mockResolvedValueOnce('GCOWNER');
    mockPrompts.confirm.mockResolvedValueOnce(false);

    await rolesStep(hints);

    const ownerCall = mockPrompts.text.mock.calls[0][0];
    expect(ownerCall.placeholder).toBe(hints.addressPlaceholder);
  });

  it('should reject address inputs that parse to no tokens', async () => {
    mockPrompts.select.mockResolvedValueOnce('single-owner');
    mockPrompts.text.mockResolvedValueOnce('GCOWNER');
    mockPrompts.confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    mockPrompts.text
      .mockResolvedValueOnce('Manager')
      .mockResolvedValueOnce('mgr')
      .mockResolvedValueOnce('GCMGR1');

    await rolesStep(hints);

    const addressPrompt = mockPrompts.text.mock.calls[3][0] as {
      validate?: (v: string) => string | undefined;
    };
    expect(addressPrompt.validate?.(',')).toBe('At least one address is required');
    expect(addressPrompt.validate?.(' , , ')).toBe('At least one address is required');
    expect(addressPrompt.validate?.('G1')).toBeUndefined();
  });

  it('should use roleSymbolMaxLength from hints for validation', async () => {
    mockPrompts.select.mockResolvedValueOnce('single-owner');
    mockPrompts.text.mockResolvedValueOnce('GCOWNER');
    mockPrompts.confirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    mockPrompts.text
      .mockResolvedValueOnce('Role')
      .mockResolvedValueOnce('sym')
      .mockResolvedValueOnce('GCADDR');

    await rolesStep(hints);

    const symbolCall = mockPrompts.text.mock.calls[2][0];
    expect(symbolCall.message).toContain(`max ${hints.roleSymbolMaxLength}`);
    const validator = symbolCall.validate;
    const longSymbol = 'x'.repeat(hints.roleSymbolMaxLength + 1);
    expect(validator(longSymbol)).toBeDefined();
    expect(validator('ok')).toBeUndefined();
  });

  it('should configure predefined roles when presets are provided', async () => {
    const presets: OperatorRolePreset[] = [
      { id: 'manager', name: 'Manager', defaultSymbol: 'manager' },
      { id: 'minter', name: 'Minting', defaultSymbol: 'minting' },
    ];

    mockPrompts.select.mockResolvedValueOnce('single-owner');
    mockPrompts.text.mockResolvedValueOnce('GCOWNERADDR');
    mockPrompts.multiselect.mockResolvedValueOnce(['manager']);
    mockPrompts.text.mockResolvedValueOnce('GCMGR1');
    mockPrompts.confirm.mockResolvedValueOnce(false);

    const result = await rolesStep(hints, presets);

    expect(result.roles).toEqual([{ name: 'Manager', symbol: 'manager', addresses: ['GCMGR1'] }]);
    expect(mockPrompts.multiselect).toHaveBeenCalled();
  });
});
