import type { ConceptDictionary } from '../types';

/**
 * Wizard step copy — the title, one-line subtitle, and deeper explanation
 * shown at the top of each step. Step ids match `WizardStepId` in the app.
 */
export const WIZARD_STEPS_COPY: ConceptDictionary = {
  'wizardStep.asset': {
    id: 'wizardStep.asset',
    title: 'Asset Configuration',
    description:
      'Define token metadata and the administrative capabilities exposed by the deployed contract.',
    infoCopy:
      'Token metadata (name, symbol, decimals, initial supply) is written into the contract at deployment. Administrative capabilities — minting, burning, pausing, document management — are what authorized operators can do post-deployment; who holds each role is decided in Access Control.',
  },
  'wizardStep.identity': {
    id: 'wizardStep.identity',
    title: 'Identity Configuration',
    description:
      'Configure the claims investors must hold, which issuers may sign them, and the identity-lifecycle controls operators can use.',
    infoCopy:
      'In ERC-3643 (T-REX), every recipient of a token must hold a verified on-chain identity (ONCHAINID) that carries the claims your jurisdiction requires. Here you declare which claims the token enforces, who is allowed to sign them, and which identity-lifecycle controls (freeze, recovery, forced transfer) operators can use.',
  },
  'wizardStep.compliance': {
    id: 'wizardStep.compliance',
    title: 'Compliance Modules',
    description: 'Select the pluggable rules the contract will enforce on every token operation.',
    infoCopy:
      'Compliance modules are pluggable rules the T-REX Compliance contract runs on every token operation. Pre-check hooks (`canTransfer`, `canCreate`) can veto a transaction; post-state hooks (`transferred`, `created`, `destroyed`) update accumulators such as supply counters. Each module auto-registers on the hooks it needs.',
  },
  'wizardStep.access-control': {
    id: 'wizardStep.access-control',
    title: 'Roles & Access Control',
    description: 'Choose the contract admin and assign addresses to each operator role.',
    infoCopy:
      "The owner is the sole admin initially granted the right to assign other roles. Operator addresses receive their roles at deployment via OpenZeppelin's RBAC module and can be rotated later on-chain.",
  },
  'wizardStep.review': {
    id: 'wizardStep.review',
    title: 'Review & Generate',
    description: 'Review your configuration and generate a downloadable project.',
    infoCopy:
      'Clicking Generate produces a self-contained project — contract sources, deploy and wiring scripts, and a README — zipped for download. Generation never deploys anything on-chain; configured addresses (owner, operators, trusted issuers) are only baked into the generated project.',
  },
} as const;
