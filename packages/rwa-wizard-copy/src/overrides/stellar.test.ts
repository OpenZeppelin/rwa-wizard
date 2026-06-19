import { describe, expect, it } from 'vitest';

import { getCopyForChain } from '../resolve';

describe('STELLAR_OVERRIDE', () => {
  it('introduces the stellar target entry not present in core', () => {
    const copy = getCopyForChain('stellar');
    const target = copy.target('stellar');
    expect(target.title).toBe('Stellar');
    expect(target.description).toMatch(/Stellar/);
  });

  it('keeps Stellar-specific module field units in the override layer', () => {
    const copy = getCopyForChain('stellar');

    expect(copy.moduleField('initial-lockup-period', 'lockupPeriodLedgers').description).toMatch(
      /ledgers/
    );
    expect(copy.moduleField('time-transfers-limits', 'limitDurationLedgers').description).toMatch(
      /ledgers/
    );
  });

  it('keeps Soroban-specific manager role phrasing in the override layer', () => {
    const copy = getCopyForChain('stellar');
    const manager = copy.role('manager');

    expect(manager.description).toMatch(/set_compliance_address/);
    expect(manager.infoCopy).toMatch(/only_role/);
  });

  it('documents testnet identity scaffolding for the review step tooltip', () => {
    const copy = getCopyForChain('stellar');
    const notice = copy.notice('review.identity-support-scaffolding');

    expect(notice.title).toBe('Testnet identity scaffolding');
    expect(notice.description).toMatch(/not production KYC/i);
    expect(notice.infoCopy).toMatch(/claim issuer/i);
    expect(notice.infoCopy).toMatch(/tools\/sign-claim/);
  });

  it('documents deploy readiness copy for the review step panel', () => {
    const copy = getCopyForChain('stellar');

    expect(copy.notice('review.before-deploy').description).toMatch(/STELLAR_ACCOUNT/);
    expect(copy.notice('review.deploy-signer-ack').description).toMatch(/Stellar CLI identity/i);
  });

  it('points post-generation success dialog to README instead of repeating deploy steps', () => {
    const copy = getCopyForChain('stellar');
    const notice = copy.notice('generation.post-download');

    expect(notice.title).toBe('After download');
    expect(notice.description).toMatch(/README\.md/i);
    expect(notice.description).not.toMatch(/stellar keys generate/i);
  });
});
