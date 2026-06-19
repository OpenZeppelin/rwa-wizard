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
      'How the Compliance contract will route token operations. Modules run on post-operation hooks (`transferred`, `created`, `destroyed`) inside the same transaction, so a module can still reject and revert the full operation. Each selected module is automatically registered on every hook it requires. Hooks without modules are shown for completeness.',
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
  'notice.compliance.module-category.supply-and-balance': {
    id: 'notice.compliance.module-category.supply-and-balance',
    title: 'Supply & balance',
    description: 'Caps on total issuance and per-investor holdings.',
  },
  'notice.compliance.module-category.jurisdiction': {
    id: 'notice.compliance.module-category.jurisdiction',
    title: 'Jurisdiction',
    description: 'Country-based allow or deny rules tied to identity registry data.',
  },
  'notice.compliance.module-category.access-and-velocity': {
    id: 'notice.compliance.module-category.access-and-velocity',
    title: 'Access & velocity',
    description: 'Transfer gates, lockups, and rolling send limits.',
  },
  'notice.compliance.module-prerequisite.identity-registry': {
    id: 'notice.compliance.module-prerequisite.identity-registry',
    description: 'Needs identity registry',
    infoCopy:
      'Deploy wiring succeeds without holder onboarding, but this module reads investor country or identity data from the identity registry at runtime. Register holders before expecting transfers or mints to pass.',
  },
  'notice.compliance.selection-warning.country-allow-and-restrict': {
    id: 'notice.compliance.selection-warning.country-allow-and-restrict',
    description:
      'Country Allow-list and Country Restriction are inverse policies. Confirm the combined lists express your intended jurisdiction model before deploying.',
  },
  'notice.compliance.selection-warning.transfer-allow-empty-list': {
    id: 'notice.compliance.selection-warning.transfer-allow-empty-list',
    description:
      'Transfer Allow-list is selected without seed addresses. Deploy will succeed, but peer transfers remain blocked until you allow accounts on-chain.',
  },
  'notice.compliance.selection-warning.initial-supply-requires-manual-mint': {
    id: 'notice.compliance.selection-warning.initial-supply-requires-manual-mint',
    description:
      'Initial supply is configured but generation does not auto-mint. Mint manually only after recipients satisfy identity verification and any selected compliance modules.',
  },
  'notice.compliance.hook-wiring-preview.empty-hook': {
    id: 'notice.compliance.hook-wiring-preview.empty-hook',
    description: 'No modules registered on this hook.',
  },
  'notice.trusted-issuer.no-topics': {
    id: 'notice.trusted-issuer.no-topics',
    description: 'Select at least one claim topic for this issuer',
  },
  'notice.trusted-issuer.duplicate': {
    id: 'notice.trusted-issuer.duplicate',
    description: 'Issuer already added',
  },
  'notice.review.before-deploy': {
    id: 'notice.review.before-deploy',
    title: 'Before you deploy',
    description: 'Review the deploy checklist before generating your project archive.',
  },
  'notice.review.configured-admin': {
    id: 'notice.review.configured-admin',
    title: 'Configured Admin',
    description: 'Admin address embedded in the generated deploy script.',
  },
} as const;
