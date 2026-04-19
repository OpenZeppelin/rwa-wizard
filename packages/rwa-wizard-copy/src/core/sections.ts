import type { ConceptDictionary } from '../types';

/**
 * Section-level card headers — the title visible above the card and the
 * deeper educational copy surfaced via its info-icon tooltip. Section ids
 * are the canonical wizard vocabulary and stay stable across chains.
 */
export const SECTIONS_COPY: ConceptDictionary = {
  'section.token-information': {
    id: 'section.token-information',
    title: 'Token Information',
    description: '',
    infoCopy:
      'Public metadata and precision for your security token. These values are written into the token contract at deployment and are visible to wallets, block explorers, and any downstream integrators.',
  },
  'section.administrative-controls': {
    id: 'section.administrative-controls',
    title: 'Administrative Controls',
    description: '',
    infoCopy:
      'Protocol-level capabilities authorized operators can exercise after deployment — minting to verified investors, burning to retire supply, and pausing the contract in an emergency. Locked controls are baked into the generated contract; who holds each role is decided in Access Control.',
  },
  'section.document-manager': {
    id: 'section.document-manager',
    title: 'Document Manager',
    description: '',
    infoCopy:
      'Optional ERC-1643-style document registry that lets operators attach regulatory disclosures — prospectuses, subscription agreements, periodic reports — directly to the token contract. Each document is referenced by name with an off-chain URI and an on-chain content hash so investors can verify integrity.',
  },
  'section.implementation-approach': {
    id: 'section.implementation-approach',
    title: 'Implementation Approach',
    description: '',
    infoCopy:
      'How the Identity Verifier decides whether a wallet is eligible to hold the token. T-REX defines a pluggable verification interface; this wizard currently scaffolds the default claim-based stack (Claim Topics & Issuers + Identity Registry Storage + on-chain claim validation). Merkle-tree and zero-knowledge verifiers are allowed by the standard but not yet generated here.',
  },
  'section.claim-topics': {
    id: 'section.claim-topics',
    title: 'Claim Topics',
    description: '',
    infoCopy:
      'A **claim topic** is a numeric identifier that declares what must be true about an investor before they can receive this token — for example KYC verified, AML screened, accredited, or a particular tax residency. On every mint and transfer the Identity Verifier checks that the recipient’s ONCHAINID carries a matching claim signed by a trusted issuer. Topic IDs are not globally standardized: 1–4 are project conventions and custom topics must use IDs ≥ 5.',
  },
  'section.trusted-issuers': {
    id: 'section.trusted-issuers',
    title: 'Trusted Issuers',
    description: '',
    infoCopy:
      'A **trusted issuer** is the on-chain Claim Issuer contract used by a KYC provider, custodian, or jurisdictional authority to sign claims about investors. The Trusted Issuers Registry maps each issuer to the topics they are authorized to sign; a claim counts only if it was signed by an issuer trusted for its topic. Each issuer must be permitted for at least one claim topic.',
  },
  'section.identity-controls': {
    id: 'section.identity-controls',
    title: 'Identity Controls',
    description: '',
    infoCopy:
      'Privileged capabilities that let authorized operators intervene on investor balances under regulatory mandates — freezing addresses, freezing a partial amount of tokens, recovering balances from a lost wallet, or forcing transfers to satisfy a court order. Enabled on the generated contract and gated per-role in Access Control.',
  },
  'section.ownership-model': {
    id: 'section.ownership-model',
    title: 'Ownership Model',
    description: '',
    infoCopy:
      'Who holds the admin role on the deployed token contract. The admin is the only account that can grant or revoke other operator roles — treat this as the root of trust for the whole token.',
  },
  'section.operator-roles': {
    id: 'section.operator-roles',
    title: 'Operator Roles',
    description: '',
    infoCopy:
      'Grant specific privileges to day-to-day operators without giving them full admin rights. Each role maps to an on-chain RBAC role that gates a small set of entry points. You can assign multiple addresses per role and rotate them later through the admin account.',
  },
} as const;
