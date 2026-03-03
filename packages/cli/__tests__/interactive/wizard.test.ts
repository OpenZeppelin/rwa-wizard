import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GeneratorAdapter } from '../../src/generators/registry';
import { runWizard } from '../../src/interactive/wizard';
import { createMockAdapter, createMockHints } from '../helpers';

const mockPrompts = vi.hoisted(() => ({
  intro: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
  text: vi.fn(),
  multiselect: vi.fn(),
  note: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn(),
  log: { step: vi.fn(), info: vi.fn() },
}));

vi.mock('@clack/prompts', () => mockPrompts);

function setupFullWizardMocks(): void {
  let textCallIndex = 0;
  const textResponses = [
    'Test Token', // asset: name
    'TEST', // asset: symbol
    '8', // asset: decimals
    '1', // identity: topic ID
    'KYC', // identity: topic name
    'GCISSUER1', // identity: issuer address
    'GCOWNER', // roles: owner address
    'Manager', // roles: role name
    'mgr', // roles: role symbol
    'GCMGR1', // roles: role addresses
  ];
  mockPrompts.text.mockImplementation(() =>
    Promise.resolve(textResponses[textCallIndex++] ?? 'default')
  );

  let confirmCallIndex = 0;
  const confirmResponses = [
    false, // asset: no initial supply
    true, // asset: enable doc manager
    true, // identity: add claim topic
    false, // identity: stop adding topics
    true, // identity: add trusted issuer
    false, // identity: stop adding issuers
    true, // roles: add roles
    false, // roles: stop adding roles
    true, // review: confirm
  ];
  mockPrompts.confirm.mockImplementation(() =>
    Promise.resolve(confirmResponses[confirmCallIndex++] ?? false)
  );

  mockPrompts.multiselect
    .mockResolvedValueOnce([]) // compliance: no modules
    .mockResolvedValueOnce([1]); // identity: issuer topics

  mockPrompts.select
    .mockResolvedValueOnce('single-owner') // roles: ownership type (step 4)
    .mockResolvedValueOnce('testnet') // deployment: network (step 4.5)
    .mockResolvedValueOnce('files'); // output format (after review)
}

describe('runWizard', () => {
  let adapter: GeneratorAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = createMockAdapter();
  });

  it('should return a complete RWAConfig and output format', async () => {
    setupFullWizardMocks();

    const result = await runWizard(adapter);

    expect(result).not.toBeNull();
    expect(result!.config.token.name).toBe('Test Token');
    expect(result!.config.token.symbol).toBe('TEST');
    expect(result!.config.deployment.network).toBe('testnet');
    expect(result!.outputFormat).toBe('files');
  });

  it('should display intro with adapter name', async () => {
    setupFullWizardMocks();

    await runWizard(adapter);

    expect(mockPrompts.intro).toHaveBeenCalledWith(expect.stringContaining(adapter.name));
  });

  it('should return null when user declines at review', async () => {
    let textCallIndex = 0;
    const textResponses = [
      'Test Token',
      'TEST',
      '8',
      '1',
      'KYC',
      'GCISSUER1',
      'GCOWNER',
      'Manager',
      'mgr',
      'GCMGR1',
    ];
    mockPrompts.text.mockImplementation(() =>
      Promise.resolve(textResponses[textCallIndex++] ?? 'default')
    );

    let confirmCallIndex = 0;
    const confirmResponses = [
      false,
      true,
      true,
      false,
      true,
      false,
      true,
      false,
      false, // review: DECLINE
    ];
    mockPrompts.confirm.mockImplementation(() =>
      Promise.resolve(confirmResponses[confirmCallIndex++] ?? false)
    );

    mockPrompts.multiselect.mockResolvedValueOnce([]).mockResolvedValueOnce([1]);
    mockPrompts.select.mockResolvedValueOnce('single-owner').mockResolvedValueOnce('testnet');

    const result = await runWizard(adapter);

    expect(result).toBeNull();
  });

  it('should pass adapter hints to all steps', async () => {
    const customHints = createMockHints();
    customHints.addressPlaceholder = 'CUSTOM_PLACEHOLDER';
    adapter = createMockAdapter();
    (adapter as { hints: typeof customHints }).hints = customHints;

    setupFullWizardMocks();

    await runWizard(adapter);

    const textCalls = mockPrompts.text.mock.calls;
    const placeholders = textCalls.filter(
      (c: unknown[]) => (c[0] as { placeholder?: string })?.placeholder === 'CUSTOM_PLACEHOLDER'
    );
    expect(placeholders.length).toBeGreaterThan(0);
  });
});
