import { describe, expect, it } from 'vitest';

import { CORE_DICT } from './index';

/**
 * Tokens that tie a piece of copy to a specific chain family, ecosystem,
 * toolchain, or language. Anything matching these belongs in
 * `overrides/<chain>.ts`, not in `core/`.
 *
 * We intentionally do **not** ban T-REX vocabulary that is part of the
 * standard (ONCHAINID, canTransfer, canCreate, transferred, created,
 * destroyed, Identity Registry, Claim Topics, Trusted Issuers) — those are
 * chain-neutral by definition.
 */
const BANNED_TOKENS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /\bStellar\b/i, label: 'Stellar' },
  { pattern: /\bSoroban\b/i, label: 'Soroban' },
  { pattern: /\bEthereum\b/i, label: 'Ethereum' },
  { pattern: /\bEVM\b/, label: 'EVM' },
  { pattern: /\bSolidity\b/i, label: 'Solidity' },
  { pattern: /\bRust\b/, label: 'Rust' },
  { pattern: /\bCargo\b/, label: 'Cargo' },
  { pattern: /\bWASM\b/i, label: 'WASM' },
];

describe('core dictionary: no chain-specific leaks', () => {
  it('has no banned tokens in description or infoCopy', () => {
    const leaks: string[] = [];
    for (const entry of Object.values(CORE_DICT)) {
      const corpus = `${entry.description}\n${entry.infoCopy ?? ''}`;
      for (const { pattern, label } of BANNED_TOKENS) {
        if (pattern.test(corpus)) {
          leaks.push(`${entry.id} mentions "${label}"`);
        }
      }
    }
    expect(leaks, `move chain-specific phrasing into overrides/:\n  ${leaks.join('\n  ')}`).toEqual(
      []
    );
  });
});
