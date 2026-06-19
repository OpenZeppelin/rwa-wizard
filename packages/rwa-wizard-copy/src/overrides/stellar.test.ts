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

  it('keeps Stellar address examples on the address-list placeholders', () => {
    const copy = getCopyForChain('stellar');
    expect(copy.fieldHelper('address-list.placeholder').description).toMatch(/G\.\.\./);
    expect(copy.fieldHelper('address-list.bulk-placeholder').description).toMatch(/G\.\.\./);
  });
});
