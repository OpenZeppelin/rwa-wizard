import { describe, expect, it } from 'vitest';

import { DEFAULT_ROLE_SYMBOLS } from '../src/defaults';

describe('DEFAULT_ROLE_SYMBOLS', () => {
  it('should contain the three default role symbols', () => {
    expect(DEFAULT_ROLE_SYMBOLS).toEqual({
      manager: 'manager',
      agent: 'agent',
      operator: 'operator',
    });
  });

  it('should be a plain object with string values', () => {
    for (const [key, value] of Object.entries(DEFAULT_ROLE_SYMBOLS)) {
      expect(typeof key).toBe('string');
      expect(typeof value).toBe('string');
    }
  });
});
