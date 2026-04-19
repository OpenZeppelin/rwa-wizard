import type { ConceptDictionary } from '../types';

/**
 * Notices — standalone prose blocks that are not attached to a form field
 * or a concept lookup: warning banners, empty-state messages, dashboard
 * intros, tooltips that live on UI chrome rather than a data concept.
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
      'How the Compliance contract will route token operations. Pre-check hooks (`canTransfer`, `canCreate`) run before the action and can block it; post-state hooks (`transferred`, `created`, `destroyed`) run after a successful action so modules can update internal counters. Each selected module is automatically registered on every hook it requires.',
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
  'notice.trusted-issuer.invalid-address': {
    id: 'notice.trusted-issuer.invalid-address',
    description: 'Invalid address format for this network',
  },
  'notice.dashboard.intro': {
    id: 'notice.dashboard.intro',
    description:
      'Scaffold a production-ready ERC-3643 / T-REX real-world-asset token project. The wizard walks you through the five pieces of a T-REX deployment — token metadata, identity verification (claim topics & trusted issuers), modular compliance rules, role-based access control, and a final review — and generates a project you can audit, customize, and deploy to your chosen target ecosystem.',
  },
  'notice.dashboard.sub-intro': {
    id: 'notice.dashboard.sub-intro',
    description:
      'Pick a target and start a new project from the sidebar, or reopen a draft from Recent Assets. Drafts are stored only in your browser; nothing is sent to a server.',
  },
} as const;
