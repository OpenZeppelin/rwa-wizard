import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ComplianceModuleInfo } from '../../src/generators/registry';
import { complianceStep } from '../../src/interactive/steps/compliance';

const mockPrompts = vi.hoisted(() => ({
  multiselect: vi.fn(),
  select: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn(),
  log: { step: vi.fn(), info: vi.fn() },
}));

vi.mock('@clack/prompts', () => mockPrompts);

describe('complianceStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty modules when none are available', async () => {
    const result = await complianceStep([]);

    expect(result.modules).toEqual([]);
    expect(mockPrompts.log.info).toHaveBeenCalledWith(
      'No compliance modules available for this chain.'
    );
  });

  it('should return empty modules when user selects none', async () => {
    const modules: ComplianceModuleInfo[] = [
      { id: 'cap', name: 'Supply Cap', description: 'Limits supply', supportedHooks: ['creation'] },
    ];
    mockPrompts.multiselect.mockResolvedValueOnce([]);

    const result = await complianceStep(modules);

    expect(result.modules).toEqual([]);
  });

  it('should auto-assign hook when module has only one supported hook', async () => {
    const modules: ComplianceModuleInfo[] = [
      { id: 'cap', name: 'Supply Cap', description: 'Limits supply', supportedHooks: ['creation'] },
    ];
    mockPrompts.multiselect.mockResolvedValueOnce(['cap']);

    const result = await complianceStep(modules);

    expect(result.modules).toEqual([{ moduleId: 'cap', hook: 'creation' }]);
    expect(mockPrompts.log.info).toHaveBeenCalledWith(
      expect.stringContaining('auto-assigned to "creation"')
    );
    expect(mockPrompts.select).not.toHaveBeenCalled();
  });

  it('should prompt for hook selection when module supports multiple hooks', async () => {
    const modules: ComplianceModuleInfo[] = [
      {
        id: 'limit',
        name: 'Transfer Limit',
        description: 'Limits transfers',
        supportedHooks: ['transfer', 'creation'],
      },
    ];
    mockPrompts.multiselect.mockResolvedValueOnce(['limit']);
    mockPrompts.select.mockResolvedValueOnce('transfer');

    const result = await complianceStep(modules);

    expect(result.modules).toEqual([{ moduleId: 'limit', hook: 'transfer' }]);
    expect(mockPrompts.select).toHaveBeenCalledOnce();
  });

  it('should handle multiple selected modules', async () => {
    const modules: ComplianceModuleInfo[] = [
      { id: 'cap', name: 'Supply Cap', description: 'Limits supply', supportedHooks: ['creation'] },
      {
        id: 'limit',
        name: 'Transfer Limit',
        description: 'Limits transfers',
        supportedHooks: ['transfer', 'creation'],
      },
    ];
    mockPrompts.multiselect.mockResolvedValueOnce(['cap', 'limit']);
    mockPrompts.select.mockResolvedValueOnce('transfer');

    const result = await complianceStep(modules);

    expect(result.modules).toHaveLength(2);
    expect(result.modules[0]).toEqual({ moduleId: 'cap', hook: 'creation' });
    expect(result.modules[1]).toEqual({ moduleId: 'limit', hook: 'transfer' });
  });
});
