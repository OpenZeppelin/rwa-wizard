import { describe, expect, it } from 'vitest';

import { getCopyForChain } from '../resolve';

describe('STELLAR_OVERRIDE', () => {
  it('introduces the stellar target entry not present in core', () => {
    const copy = getCopyForChain('stellar');
    const target = copy.target('stellar');
    expect(target.title).toBe('Stellar');
    expect(target.description).toMatch(/Stellar/);
  });
});
