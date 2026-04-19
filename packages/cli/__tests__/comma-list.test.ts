import { describe, expect, it } from 'vitest';

import { parseCommaSeparatedList } from '../src/utils/comma-list';

describe('parseCommaSeparatedList', () => {
  it('returns empty for comma-only or whitespace-only tokens', () => {
    expect(parseCommaSeparatedList(',')).toEqual([]);
    expect(parseCommaSeparatedList(' , , ')).toEqual([]);
    expect(parseCommaSeparatedList('')).toEqual([]);
  });

  it('trims and keeps non-empty tokens', () => {
    expect(parseCommaSeparatedList(' a , b ')).toEqual(['a', 'b']);
    expect(parseCommaSeparatedList('US,CA,UK')).toEqual(['US', 'CA', 'UK']);
  });
});
