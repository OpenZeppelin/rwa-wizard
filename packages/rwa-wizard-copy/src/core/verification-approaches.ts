import type { ConceptDictionary } from '../types';

/**
 * Identity verification approaches — how the Identity Verifier decides whether
 * a wallet is eligible to hold the token. T-REX defines a pluggable
 * verification interface; today the wizard scaffolds only the default
 * claim-based stack, but the vocabulary is forward-compatible with
 * Merkle-tree and zero-knowledge variants the standard also allows.
 */
export const VERIFICATION_APPROACHES_COPY: ConceptDictionary = {
  'verificationApproach.claim-based': {
    id: 'verificationApproach.claim-based',
    title: 'Claim-Based Verification',
    description:
      'Each investor holds an ONCHAINID contract carrying cryptographic claims (KYC, AML, accreditation, …) signed by trusted issuers. Every mint and transfer calls into the Identity Verifier, which checks that the required claims are present and signed by an authorized issuer.',
  },
} as const;
