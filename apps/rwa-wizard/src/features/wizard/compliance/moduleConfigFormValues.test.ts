import { describe, expect, it } from 'vitest';

import type { ModuleConfigFieldMeta } from '../../../types/wizard';
import { fromFormValues, hasPendingStringArrayInput } from './moduleConfigFormValues';

const stringArrayField: ModuleConfigFieldMeta = {
  key: 'restrictedCountries',
  label: 'Restricted Countries',
  type: 'string[]',
  required: false,
};

describe('hasPendingStringArrayInput', () => {
  it('is true when a string[] value ends with a comma', () => {
    expect(hasPendingStringArrayInput([stringArrayField], { restrictedCountries: 'US,' })).toBe(
      true
    );
    expect(hasPendingStringArrayInput([stringArrayField], { restrictedCountries: 'US, ' })).toBe(
      true
    );
  });

  it('is false when there is no trailing comma', () => {
    expect(hasPendingStringArrayInput([stringArrayField], { restrictedCountries: 'US, CA' })).toBe(
      false
    );
  });
});

describe('fromFormValues (string[])', () => {
  it('strips a trailing comma before splitting so blur-flush matches intent', () => {
    expect(fromFormValues([stringArrayField], { restrictedCountries: 'US,' })).toEqual({
      restrictedCountries: ['US'],
    });
  });

  it('parses a comma-separated list', () => {
    expect(fromFormValues([stringArrayField], { restrictedCountries: 'US, CA' })).toEqual({
      restrictedCountries: ['US', 'CA'],
    });
  });
});
