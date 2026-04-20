import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ComplianceModuleInfo } from '../../src/generators/registry';
import { complianceStep } from '../../src/interactive/steps/compliance';

const mockPrompts = vi.hoisted(() => ({
  multiselect: vi.fn(),
  select: vi.fn(),
  text: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn(),
  log: { step: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@clack/prompts', () => mockPrompts);

function makeModule(overrides: Partial<ComplianceModuleInfo> = {}): ComplianceModuleInfo {
  return {
    id: 'cap',
    name: 'Supply Cap',
    description: 'Limits supply',
    requiredHooks: ['created'],
    review: { state: 'stable' },
    configFields: [],
    ...overrides,
  };
}

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
    mockPrompts.multiselect.mockResolvedValueOnce([]);

    const result = await complianceStep([makeModule()]);

    expect(result.modules).toEqual([]);
  });

  it('should register selected module with no config fields and without a hook property', async () => {
    mockPrompts.multiselect.mockResolvedValueOnce(['cap']);

    const result = await complianceStep([makeModule()]);

    expect(result.modules).toEqual([{ moduleId: 'cap', config: undefined }]);
    expect(mockPrompts.log.info).toHaveBeenCalledWith(
      expect.stringContaining('auto-registered on hooks: created')
    );
  });

  it('should warn when the selected module is under review', async () => {
    mockPrompts.multiselect.mockResolvedValueOnce(['cap']);

    await complianceStep([
      makeModule({
        review: { state: 'under-review', prUrl: 'https://example.com/pr/42' },
      }),
    ]);

    expect(mockPrompts.log.warn).toHaveBeenCalledWith(expect.stringContaining('under review'));
    expect(mockPrompts.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('https://example.com/pr/42')
    );
  });

  it('should prompt for each configField and attach parsed values', async () => {
    mockPrompts.multiselect.mockResolvedValueOnce(['limit']);
    mockPrompts.text
      .mockResolvedValueOnce('100') // number field
      .mockResolvedValueOnce('US, CA, UK'); // string[] field

    const result = await complianceStep([
      makeModule({
        id: 'limit',
        name: 'Country Limit',
        description: 'Allowed countries',
        requiredHooks: ['canTransfer', 'created'],
        configFields: [
          { key: 'maxSupply', label: 'Max supply', type: 'number', required: true },
          { key: 'countries', label: 'Countries', type: 'string[]', required: true },
        ],
      }),
    ]);

    expect(result.modules).toEqual([
      { moduleId: 'limit', config: { maxSupply: 100, countries: ['US', 'CA', 'UK'] } },
    ]);
  });

  it('should reject required string[] when input parses to no tokens', async () => {
    mockPrompts.multiselect.mockResolvedValueOnce(['limit']);
    mockPrompts.text.mockResolvedValueOnce('100').mockResolvedValueOnce('US, CA');

    await complianceStep([
      makeModule({
        id: 'limit',
        name: 'Country Limit',
        description: 'Allowed countries',
        requiredHooks: ['canTransfer', 'created'],
        configFields: [
          { key: 'maxSupply', label: 'Max supply', type: 'number', required: true },
          { key: 'countries', label: 'Countries', type: 'string[]', required: true },
        ],
      }),
    ]);

    const countriesPrompt = mockPrompts.text.mock.calls[1][0] as {
      validate?: (input: string) => string | undefined;
    };
    expect(countriesPrompt.validate?.(',')).toBe('Countries is required');
    expect(countriesPrompt.validate?.(' , , ')).toBe('Countries is required');
    expect(countriesPrompt.validate?.('US')).toBeUndefined();
  });

  it('should handle multiple selected modules', async () => {
    mockPrompts.multiselect.mockResolvedValueOnce(['cap', 'limit']);

    const result = await complianceStep([
      makeModule(),
      makeModule({ id: 'limit', name: 'Transfer Limit', requiredHooks: ['canTransfer'] }),
    ]);

    expect(result.modules).toHaveLength(2);
    expect(result.modules[0]).toEqual({ moduleId: 'cap', config: undefined });
    expect(result.modules[1]).toEqual({ moduleId: 'limit', config: undefined });
  });
});
