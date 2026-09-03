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
  'notice.compliance.selection-warning.initial-supply-exceeds-supply-limit': {
    id: 'notice.compliance.selection-warning.initial-supply-exceeds-supply-limit',
    description:
      'Supply Limit is below initial supply. The `created` compliance hook will reject the mint — raise the limit to at least initial supply (or remove the module).',
  },
  'notice.compliance.selection-warning.initial-supply-exceeds-max-balance': {
    id: 'notice.compliance.selection-warning.initial-supply-exceeds-max-balance',
    description:
      'Max Balance is below initial supply. Admin cannot receive the full mint on the `created` hook — raise max balance to at least initial supply. In plain terms: this rule limits how many tokens any one wallet may hold. It applies to your Admin or treasury address too, not only outside investors. To mint the full initial amount to one address, raise the cap, mint in smaller batches, or split mints across multiple wallets.',
  },
  'notice.compliance.selection-warning.demo-mint-country-not-allowed': {
    id: 'notice.compliance.selection-warning.demo-mint-country-not-allowed',
    description:
      'Country Allow-list does not include CH (756). The testnet demo bootstrap registers Admin with Switzerland — allow CH or adjust the list before export.',
  },
  'notice.compliance.selection-warning.demo-mint-country-restricted': {
    id: 'notice.compliance.selection-warning.demo-mint-country-restricted',
    description:
      'Country Restriction blocks CH (756). The testnet demo bootstrap always uses Switzerland for Admin — remove CH from restricted countries to use demo auto-mint.',
  },
  'notice.compliance.selection-warning.initial-supply-compliance-reminder': {
    id: 'notice.compliance.selection-warning.initial-supply-compliance-reminder',
    description:
      'Initial supply is set with compliance modules selected. Mint runs the `created` hook — ensure limits and jurisdiction rules accommodate your mint recipient before deploying.',
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
  'notice.code-preview.trigger-show': {
    id: 'notice.code-preview.trigger-show',
    description: 'View generated code',
  },
  'notice.code-preview.trigger-hide': {
    id: 'notice.code-preview.trigger-hide',
    description: 'Hide generated code',
  },
  'notice.code-preview.sheet-label': {
    id: 'notice.code-preview.sheet-label',
    description: 'Generated project preview',
  },
  'notice.code-preview.generating': {
    id: 'notice.code-preview.generating',
    description: 'Generating preview…',
  },
  'notice.code-preview.no-file-selected': {
    id: 'notice.code-preview.no-file-selected',
    description: 'Select a file to view its generated source.',
  },
  'notice.code-preview.substitutions': {
    id: 'notice.code-preview.substitutions',
    description: 'Preview placeholders (not in your draft):',
  },
  'notice.code-preview.render-failed': {
    id: 'notice.code-preview.render-failed',
    description:
      'Preview could not render this content. Close and reopen the preview to try again.',
  },
  'notice.code-preview.generate-failed': {
    id: 'notice.code-preview.generate-failed',
    description: 'Preview generation failed. Check your configuration and try again.',
  },
  'notice.code-preview.tools-group': {
    id: 'notice.code-preview.tools-group',
    description: 'Preview layout',
  },
  'notice.code-preview.hide-file-tree': {
    id: 'notice.code-preview.hide-file-tree',
    description: 'Hide file tree',
  },
  'notice.code-preview.show-file-tree': {
    id: 'notice.code-preview.show-file-tree',
    description: 'Show file tree',
  },
  'notice.code-preview.maximize': {
    id: 'notice.code-preview.maximize',
    description: 'Maximize preview',
  },
  'notice.code-preview.restore-size': {
    id: 'notice.code-preview.restore-size',
    description: 'Restore preview size',
  },
  'notice.code-preview.file-tree-label': {
    id: 'notice.code-preview.file-tree-label',
    description: 'Generated project files',
  },
  'notice.code-preview.source-label': {
    id: 'notice.code-preview.source-label',
    description: '{path} source code',
  },
  'notice.code-preview.close': {
    id: 'notice.code-preview.close',
    description: 'Close generated code preview',
  },
  'notice.review.demo-mint-compliance-blocked': {
    id: 'notice.review.demo-mint-compliance-blocked',
    title: 'Fix these before generating',
    description:
      'Demo auto-mint runs a compliance preflight on the `created` hook. Adjust module limits in the Compliance step, or disable identity scaffolding.',
  },
} as const;
