import { describe, expect, it } from 'vitest';

import { matchStellarCratesInText } from './matchStellarCratesInText';

describe('matchStellarCratesInText request/response (INV-5, INV-18)', () => {
  it('matches only the four mapped stellar_* identifiers (INV-5)', () => {
    const text = 'use stellar_access::x; soroban_sdk::Env; rwa_token::Thing;';
    const leafOffset = 0;
    const matches = matchStellarCratesInText(text, leafOffset);
    expect(matches.map((match) => match.crateId)).toEqual(['stellar_access']);
  });

  it('links only the identifier segment, not :: suffixes (INV-5)', () => {
    const prefix = 'use ';
    const crate = 'stellar_tokens';
    const suffix = '::fungible::{Base};';
    const text = prefix + crate + suffix;
    const leafOffset = 10;
    const matches = matchStellarCratesInText(text, leafOffset);
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe(crate);
    expect(matches[0].start).toBe(leafOffset + prefix.length);
    expect(matches[0].end).toBe(matches[0].start + crate.length);
  });

  it('runs on a single leaf string, not the full file (INV-18)', () => {
    const leaf = ' stellar_access::access_control::{';
    const matches = matchStellarCratesInText(leaf, 42);
    expect(matches).toHaveLength(1);
    expect(matches[0].start).toBe(42 + leaf.indexOf('stellar_access'));
  });
});

describe('matchStellarCratesInText fail-soft parsing (INV-7, INV-9)', () => {
  it('returns an empty list for empty input without throwing (INV-7)', () => {
    expect(matchStellarCratesInText('', 0)).toEqual([]);
  });

  it('is pure for repeated calls (INV-9)', () => {
    const text = 'stellar_macros';
    expect(matchStellarCratesInText(text, 5)).toEqual(matchStellarCratesInText(text, 5));
  });
});
