import type { CodegenInfoBlurb } from '@openzeppelin/codegen-core';

import { getContractsLibraryRepositoryUrl } from './contracts-library-meta';

/** Stellar protocol SEP-0057 — standard contract types (WASM interface classification). */
export const STELLAR_SEP_0057_CONTRACT_TYPES_URL =
  'https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0057.md';

/**
 * Introductory copy for the Stellar/Soroban RWA generator: ERC-3643 / T-REX context,
 * upstream contracts repo (synced revision), and Stellar ecosystem reference.
 */
export function getCodegenInfoBlurb(): CodegenInfoBlurb {
  return {
    title: 'Issue a regulated real-world asset on Stellar',
    description:
      'Generate the smart contracts to issue a regulated real-world asset (e.g. a fund, bond, or private equity share) as a token on Stellar — with built-in investor eligibility, transfer restrictions, and recovery controls. Follows ERC-3643 (T-REX), the institutional standard for permissioned digital securities, on OpenZeppelin’s audited Stellar contracts.',
    links: [
      {
        label: 'OpenZeppelin Stellar contracts (audited templates used by this wizard)',
        href: getContractsLibraryRepositoryUrl(),
      },
      {
        label: 'Stellar contract-type standard (SEP-0057)',
        href: STELLAR_SEP_0057_CONTRACT_TYPES_URL,
      },
    ],
  };
}
