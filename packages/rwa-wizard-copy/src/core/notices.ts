import type { ConceptDictionary } from '../types';

/**
 * Notices — standalone prose blocks that are not attached to a form field
 * or a concept lookup: warning banners, empty-state messages, dashboard
 * tooltips that live on UI chrome rather than a data concept.
 */
export const NOTICES_COPY: ConceptDictionary = {
  'notice.identity.privacy': {
    id: 'notice.identity.privacy',
    title: 'Privacy Notice',
    description:
      'The configuration you enter here — claim topic IDs, trusted issuer contract addresses, control flags — never leaves your browser; it is persisted only to local storage until you export or deploy. T-REX itself is designed so that personally identifiable information never touches the chain: only hashes and cryptographically signed claims are stored in each investor’s ONCHAINID. Anything you do publish on-chain (claim topics, issuer contract addresses, configured compliance rules) will be visible to anyone.',
  },
  'notice.compliance.hook-wiring-preview': {
    id: 'notice.compliance.hook-wiring-preview',
    title: 'Hook Wiring Preview',
    description:
      'How the Compliance contract will route token operations. Modules run on post-operation hooks (`transferred`, `created`, `destroyed`) inside the same transaction, so a module can still reject and revert the full operation. Each selected module is automatically registered on every hook it requires.',
  },
  'notice.compliance.module-catalog.empty': {
    id: 'notice.compliance.module-catalog.empty',
    description: 'No compliance modules are available for the selected target.',
  },
  'notice.compliance.module-catalog.under-review-label': {
    id: 'notice.compliance.module-catalog.under-review-label',
    description: 'Under Review',
    infoCopy:
      'The upstream contract for this module has not yet been merged into the OpenZeppelin RWA release. Selecting it is fine for experimentation and audits; follow the linked PR for production readiness.',
  },
  'notice.trusted-issuer.no-topics': {
    id: 'notice.trusted-issuer.no-topics',
    description: 'Select at least one claim topic for this issuer',
  },
  'notice.trusted-issuer.duplicate': {
    id: 'notice.trusted-issuer.duplicate',
    description: 'Issuer already added',
  },
} as const;
