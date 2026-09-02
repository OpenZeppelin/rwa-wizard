import { isClaimTopicSelected, type RWAConfig } from '@openzeppelin/rwa-config';
import type { AddressingCapability } from '@openzeppelin/ui-types';

import type { ComplianceModuleOption, WizardStepId } from '../../../types/wizard';
import {
  TOKEN_DECIMALS_MAX,
  TOKEN_DECIMALS_MIN,
  TOKEN_NAME_MAX_LENGTH,
  TOKEN_SYMBOL_MAX_LENGTH,
} from './stepConstraints';

/**
 * Extra context a step validator may need beyond the raw config (e.g. the
 * addressing adapter for the current target, or the module catalog used to
 * determine which config fields are required).
 *
 * All fields are optional and validators must degrade gracefully when they
 * are missing — this keeps the wizard usable while the capability snapshot
 * is still resolving.
 */
export interface StepValidationContext {
  addressing?: AddressingCapability;
  availableModules?: ComplianceModuleOption[];
  /** When false, compliance step blocks progression (config conflicts with initial supply / demo mint). */
  complianceConfigReady?: boolean;
}

// ---------------------------------------------------------------------------
// Per-step validators (pure, config-driven)
// ---------------------------------------------------------------------------

function isValidAssetStep(config: RWAConfig): boolean {
  const { name, symbol, decimals, initialSupply } = config.token;

  // Length is evaluated after trimming so a user who types the maximum number
  // of visible characters with a trailing space is not spuriously blocked —
  // edit-site handlers trim before persisting, keeping this consistent.
  const trimmedName = name.trim();
  if (!trimmedName) return false;
  if (trimmedName.length > TOKEN_NAME_MAX_LENGTH) return false;

  const trimmedSymbol = symbol.trim();
  if (!trimmedSymbol) return false;
  if (trimmedSymbol.length > TOKEN_SYMBOL_MAX_LENGTH) return false;

  if (!Number.isInteger(decimals)) return false;
  if (decimals < TOKEN_DECIMALS_MIN || decimals > TOKEN_DECIMALS_MAX) return false;

  // Initial supply is optional, but when provided must be a non-negative integer.
  if (initialSupply !== undefined && initialSupply !== '') {
    if (!/^\d+$/.test(initialSupply.trim())) return false;
  }

  return true;
}

function isValidIdentityStep(config: RWAConfig, ctx: StepValidationContext): boolean {
  return isValidIdentityStepCore(config, ctx);
}

/**
 * Whether any trusted issuer references only claim topics that are defined but
 * not selected for deployment (codegen `UNSELECTED_REFERENCE`).
 */
export function identityStepHasUnselectedIssuerTopics(
  identity: RWAConfig['identityVerification']
): boolean {
  const { trustedIssuers, claimTopics } = identity;
  const validTopicIds = new Set(claimTopics.map((topic) => topic.id));
  const selectedTopicIds = new Set(
    claimTopics.filter(isClaimTopicSelected).map((topic) => topic.id)
  );

  for (const issuer of trustedIssuers) {
    if (issuer.claimTopics.length === 0) continue;
    if (issuer.claimTopics.some((id) => !validTopicIds.has(id))) continue;
    if (!issuer.claimTopics.some((id) => selectedTopicIds.has(id))) return true;
  }
  return false;
}

/**
 * Whether any trusted issuer references a claim-topic id absent from
 * `claimTopics` (codegen `INVALID_REFERENCE`). Reachable via Import / pre-prune
 * drafts — no pill exists for the orphan id, so the step must surface a banner.
 */
export function identityStepHasOrphanIssuerTopics(
  identity: RWAConfig['identityVerification']
): boolean {
  const validTopicIds = new Set(identity.claimTopics.map((topic) => topic.id));
  for (const issuer of identity.trustedIssuers) {
    if (issuer.claimTopics.some((id) => !validTopicIds.has(id))) return true;
  }
  return false;
}

/** Copy notice ids for identity-step blockers surfaced in the UI. */
export function getIdentityStepIssues(
  identity: RWAConfig['identityVerification']
): readonly string[] {
  const issues: string[] = [];
  if (identityStepHasOrphanIssuerTopics(identity)) {
    issues.push('trusted-issuer.unknown-topics');
  }
  if (identityStepHasUnselectedIssuerTopics(identity)) {
    issues.push('trusted-issuer.unselected-topics');
  }
  return issues;
}

function isValidIdentityStepCore(config: RWAConfig, ctx: StepValidationContext): boolean {
  // Mirror codegen's issuer gates (empty address, empty/invalid topic refs,
  // UNSELECTED_REFERENCE) so Next cannot leave a draft the preview already
  // rejects. Selection meaning comes from `isClaimTopicSelected` — the same
  // primitive codegen uses — rather than ad-hoc message strings.
  const { trustedIssuers, claimTopics } = config.identityVerification;
  const validTopicIds = new Set(claimTopics.map((topic) => topic.id));
  const selectedTopicIds = new Set(
    claimTopics.filter(isClaimTopicSelected).map((topic) => topic.id)
  );

  for (const issuer of trustedIssuers) {
    const trimmed = issuer.address.trim();
    if (!trimmed) return false;
    if (ctx.addressing && !ctx.addressing.isValidAddress(trimmed)) return false;

    if (issuer.claimTopics.length === 0) return false;
    if (issuer.claimTopics.some((id) => !validTopicIds.has(id))) return false;
    if (!issuer.claimTopics.some((id) => selectedTopicIds.has(id))) return false;
  }

  return true;
}

function isValidComplianceStep(config: RWAConfig, ctx: StepValidationContext): boolean {
  if (ctx.complianceConfigReady === false) return false;
  if (!ctx.availableModules) return true;
  for (const selection of config.compliance.modules) {
    const meta = ctx.availableModules.find((m) => m.id === selection.moduleId);
    if (!meta) continue;
    for (const field of meta.configFields) {
      if (!field.required) continue;
      const value = selection.config?.[field.key];
      if (value === undefined || value === null || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
    }
  }
  return true;
}

function getOwnerAddress(ownership: RWAConfig['accessControl']['ownership']): string {
  // Exhaustive switch — adding a new ownership variant fails compilation here
  // until this function and the rest of the wizard acknowledge it explicitly.
  switch (ownership.type) {
    case 'single-owner':
      return ownership.ownerAddress;
    case 'multi-sig':
    case 'dao':
      return ownership.address;
    default: {
      const _exhaustive: never = ownership;
      return _exhaustive;
    }
  }
}

function isValidAccessControlStep(config: RWAConfig, ctx: StepValidationContext): boolean {
  const trimmed = getOwnerAddress(config.accessControl.ownership).trim();
  if (!trimmed) return false;
  if (ctx.addressing && !ctx.addressing.isValidAddress(trimmed)) return false;

  // Operator role addresses are optional — users may intentionally leave a
  // role unassigned. The address-list inputs already reject invalid entries
  // before they reach the config.
  return true;
}

function isValidDeploymentStep(): boolean {
  // Placeholder step today; treat as always valid so it never blocks progression.
  return true;
}

function isValidReviewStep(ctx: StepValidationContext): boolean {
  return ctx.complianceConfigReady !== false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns true when the given step's data is complete and within bounds.
 *
 * This is the single source of truth the wizard shell uses to enable or
 * disable the Next button. Each step validator is pure and composable;
 * callers pass in whatever context (addressing adapter, module catalog)
 * they already have at hand.
 */
export function isStepValid(
  stepId: WizardStepId,
  config: RWAConfig,
  ctx: StepValidationContext = {}
): boolean {
  switch (stepId) {
    case 'asset':
      return isValidAssetStep(config);
    case 'identity':
      return isValidIdentityStep(config, ctx);
    case 'compliance':
      return isValidComplianceStep(config, ctx);
    case 'access-control':
      return isValidAccessControlStep(config, ctx);
    case 'deployment':
      return isValidDeploymentStep();
    case 'review':
      return isValidReviewStep(ctx);
  }
}
