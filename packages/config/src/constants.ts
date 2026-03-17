import type { ClaimTopic } from './types';

// ---------------------------------------------------------------------------
// Predefined Claim Topics (chain-agnostic)
// ---------------------------------------------------------------------------

export const PREDEFINED_CLAIM_TOPICS: readonly ClaimTopic[] = [
  { id: 1, name: 'KYC', isCustom: false },
  { id: 2, name: 'AML', isCustom: false },
  { id: 3, name: 'Accreditation', isCustom: false },
  { id: 4, name: 'Tax Residency', isCustom: false },
] as const;

/** Minimum ID for user-defined custom claim topics */
export const MIN_CUSTOM_CLAIM_TOPIC_ID = 5;

/** Maximum number of claim topics per configuration */
export const MAX_CLAIM_TOPICS = 15;
