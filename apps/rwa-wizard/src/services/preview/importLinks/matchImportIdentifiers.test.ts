import { describe, expect, it } from 'vitest';

import { matchImportIdentifiers } from './matchImportIdentifiers';

const IDENTIFIERS = ['pkg_access', 'pkg_tokens', 'pkg_macros'] as const;

describe('matchImportIdentifiers request/response (INV-5, INV-18)', () => {
  it('matches only identifiers it was given (INV-5)', () => {
    const text = 'import pkg_access::x; other_sdk::Env; app_token::Thing;';
    const matches = matchImportIdentifiers(text, 0, IDENTIFIERS);
    expect(matches.map((match) => match.identifier)).toEqual(['pkg_access']);
  });

  it('links only the identifier segment, not its :: suffixes (INV-5)', () => {
    const prefix = 'import ';
    const identifier = 'pkg_tokens';
    const text = `${prefix}${identifier}::fungible::{Base};`;
    const leafOffset = 10;

    const matches = matchImportIdentifiers(text, leafOffset, IDENTIFIERS);

    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe(identifier);
    expect(matches[0].start).toBe(leafOffset + prefix.length);
    expect(matches[0].end).toBe(matches[0].start + identifier.length);
  });

  it('runs on a single leaf string, not the full file (INV-18)', () => {
    const leaf = ' pkg_access::access_control::{';
    const matches = matchImportIdentifiers(leaf, 42, IDENTIFIERS);

    expect(matches).toHaveLength(1);
    expect(matches[0].start).toBe(42 + leaf.indexOf('pkg_access'));
  });

  it('matches on word boundaries, not on prefixes of longer identifiers (INV-5)', () => {
    expect(matchImportIdentifiers('pkg_accessory::x', 0, IDENTIFIERS)).toEqual([]);
  });

  it('recognises nothing when the package reports no targets (INV-5)', () => {
    expect(
      matchImportIdentifiers('import pkg_access::x;', 0, []),
      'the wizard has no identifiers of its own to fall back on'
    ).toEqual([]);
  });

  it('takes identifiers literally rather than as patterns', () => {
    const matches = matchImportIdentifiers('a.c and abc', 0, ['a.c']);

    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe('a.c');
  });
});

describe('matchImportIdentifiers fail-soft parsing (INV-7, INV-9)', () => {
  it('returns an empty list for empty input without throwing (INV-7)', () => {
    expect(matchImportIdentifiers('', 0, IDENTIFIERS)).toEqual([]);
  });

  it('is pure for repeated calls (INV-9)', () => {
    const text = 'pkg_macros';
    expect(matchImportIdentifiers(text, 5, IDENTIFIERS)).toEqual(
      matchImportIdentifiers(text, 5, IDENTIFIERS)
    );
  });
});
