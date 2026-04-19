import { describe, expect, it, vi } from 'vitest';

import { coreCopy, formatCopy, getCopyForChain } from './resolve';

describe('getCopyForChain', () => {
  it('returns the core entry for an administrative control on a chain with no override', () => {
    const copy = getCopyForChain('evm');
    const burnable = copy.adminControl('burnable');
    expect(burnable.id).toBe('admin.burnable');
    expect(burnable.description).toMatch(/burn-role operator/);
    expect(burnable.infoCopy).toBeTruthy();
  });

  it('returns the core entry for an identity control', () => {
    const copy = getCopyForChain('stellar');
    const recovery = copy.identityControl('recovery');
    expect(recovery.id).toBe('identity.recovery');
    expect(recovery.description.length).toBeGreaterThan(0);
  });

  it('exposes every category accessor added for the migration', () => {
    const copy = getCopyForChain('stellar');
    expect(copy.role('minter').description).toMatch(/verified investors/);
    expect(copy.hook('canTransfer').title).toBe('Can Transfer (pre-check)');
    expect(copy.module('supply-limit').description).toMatch(/supply/i);
    expect(copy.moduleField('supply-limit', 'limit').description).toMatch(/smallest token unit/);
    expect(copy.wizardStep('asset').title).toBe('Asset Configuration');
    expect(copy.section('token-information').infoCopy).toBeTruthy();
    expect(copy.fieldHelper('token.name').description).toMatch(/\{maxLength\}/);
    expect(copy.notice('identity.privacy').title).toBe('Privacy Notice');
    expect(copy.ownershipModel('multi-sig').title).toBe('Multi-Sig Owner');
    expect(copy.verificationApproach('claim-based').title).toBe('Claim-Based Verification');
  });

  it('warns and returns a placeholder on unknown ids instead of crashing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const copy = getCopyForChain('stellar');
    const result = copy.adminControl('does-not-exist');
    expect(result.description).toBe('');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('missing entry for "admin.does-not-exist"')
    );
    warn.mockRestore();
  });
});

describe('coreCopy', () => {
  it('resolves chain-neutral categories without a chain override', () => {
    expect(coreCopy.wizardStep('asset').title).toBe('Asset Configuration');
    expect(coreCopy.notice('dashboard.intro').description).toMatch(/ERC-3643/);
  });
});

describe('formatCopy', () => {
  it('substitutes named placeholders', () => {
    expect(formatCopy('Up to {max} characters', { max: 50 })).toBe('Up to 50 characters');
  });

  it('leaves unknown placeholders intact so template bugs are visible', () => {
    expect(formatCopy('Up to {max} characters', {})).toBe('Up to {max} characters');
  });
});
