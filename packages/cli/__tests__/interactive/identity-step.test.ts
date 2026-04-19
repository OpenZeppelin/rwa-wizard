import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChainHints } from '../../src/generators/registry';
import { identityStep } from '../../src/interactive/steps/identity';
import { createMockHints } from '../helpers';

const mockPrompts = vi.hoisted(() => ({
  text: vi.fn(),
  confirm: vi.fn(),
  multiselect: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
  cancel: vi.fn(),
  log: { step: vi.fn(), info: vi.fn() },
}));

vi.mock('@clack/prompts', () => mockPrompts);

describe('identityStep', () => {
  let hints: ChainHints;

  beforeEach(() => {
    vi.clearAllMocks();
    hints = createMockHints();
  });

  it('should collect claim topics and trusted issuers', async () => {
    mockPrompts.confirm
      .mockResolvedValueOnce(true) // add a claim topic
      .mockResolvedValueOnce(false) // don't add another topic
      .mockResolvedValueOnce(true) // add a trusted issuer
      .mockResolvedValueOnce(false); // don't add another issuer
    mockPrompts.text
      .mockResolvedValueOnce('1') // topic ID
      .mockResolvedValueOnce('KYC') // topic name
      .mockResolvedValueOnce('GCISSUER1'); // issuer address
    mockPrompts.multiselect.mockResolvedValueOnce([1]); // topics for issuer

    const result = await identityStep(hints);

    expect(result.claimTopics).toEqual([{ id: 1, name: 'KYC' }]);
    expect(result.trustedIssuers).toEqual([{ address: 'GCISSUER1', claimTopics: [1] }]);
  });

  it('should return empty arrays when user skips topics', async () => {
    mockPrompts.confirm.mockResolvedValueOnce(false); // don't add topics

    const result = await identityStep(hints);

    expect(result.claimTopics).toEqual([]);
    expect(result.trustedIssuers).toEqual([]);
  });

  it('should skip issuers when no claim topics exist', async () => {
    mockPrompts.confirm.mockResolvedValueOnce(false); // no topics

    const result = await identityStep(hints);

    expect(result.trustedIssuers).toEqual([]);
    expect(mockPrompts.log.info).toHaveBeenCalledWith(
      'No claim topics defined — skipping trusted issuers.'
    );
  });

  it('should allow multiple claim topics', async () => {
    mockPrompts.confirm
      .mockResolvedValueOnce(true) // add first topic
      .mockResolvedValueOnce(true) // add another topic
      .mockResolvedValueOnce(false) // stop adding topics
      .mockResolvedValueOnce(false); // skip issuers
    mockPrompts.text
      .mockResolvedValueOnce('1')
      .mockResolvedValueOnce('KYC')
      .mockResolvedValueOnce('2')
      .mockResolvedValueOnce('AML');

    const result = await identityStep(hints);

    expect(result.claimTopics).toHaveLength(2);
    expect(result.claimTopics[0]).toEqual({ id: 1, name: 'KYC' });
    expect(result.claimTopics[1]).toEqual({ id: 2, name: 'AML' });
  });

  it('should allow multiple trusted issuers', async () => {
    mockPrompts.confirm
      .mockResolvedValueOnce(true) // add topic
      .mockResolvedValueOnce(false) // stop topics
      .mockResolvedValueOnce(true) // add issuer
      .mockResolvedValueOnce(true) // add another issuer
      .mockResolvedValueOnce(false); // stop issuers
    mockPrompts.text
      .mockResolvedValueOnce('1')
      .mockResolvedValueOnce('KYC')
      .mockResolvedValueOnce('GCISSUER1')
      .mockResolvedValueOnce('GCISSUER2');
    mockPrompts.multiselect.mockResolvedValueOnce([1]).mockResolvedValueOnce([1]);

    const result = await identityStep(hints);

    expect(result.trustedIssuers).toHaveLength(2);
    expect(result.trustedIssuers[0].address).toBe('GCISSUER1');
    expect(result.trustedIssuers[1].address).toBe('GCISSUER2');
  });

  it('should use address placeholder from hints', async () => {
    mockPrompts.confirm
      .mockResolvedValueOnce(true) // add topic
      .mockResolvedValueOnce(false) // stop topics
      .mockResolvedValueOnce(true) // add issuer
      .mockResolvedValueOnce(false); // stop issuers
    mockPrompts.text
      .mockResolvedValueOnce('1')
      .mockResolvedValueOnce('KYC')
      .mockResolvedValueOnce('GCISSUER1');
    mockPrompts.multiselect.mockResolvedValueOnce([1]);

    await identityStep(hints);

    const issuerCall = mockPrompts.text.mock.calls[2][0];
    expect(issuerCall.placeholder).toBe(hints.addressPlaceholder);
  });
});
