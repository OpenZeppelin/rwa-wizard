import type { RWAConfig } from '@openzeppelin/rwa-config';
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
  // Identity is entirely optional from a config-shape standpoint. We only
  // guard against stale issuer addresses that would fail the adapter check —
  // the Add-issuer UI already prevents new invalid addresses, so this catches
  // drift from imports or older drafts.
  const { trustedIssuers } = config.identityVerification;
  if (!ctx.addressing) return true;
  return trustedIssuers.every((iss) => ctx.addressing!.isValidAddress(iss.address));
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
