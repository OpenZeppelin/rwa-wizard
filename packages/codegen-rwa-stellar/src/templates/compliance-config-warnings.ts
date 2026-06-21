import type { ComplianceModuleSelectionWarning } from '@openzeppelin/codegen-rwa-common';
import { evaluateComplianceSelectionWarnings } from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { STELLAR_COMPLIANCE_SELECTION_WARNING_RULES } from '../compliance-catalog-meta';
import { isDemoAutoMintEligible } from './demo-auto-mint';
import { getDemoMintCompliancePreflightIssues } from './demo-mint-compliance-preflight';

const DEMO_MINT_ISSUE_WARNING_IDS: Record<string, string> = {
  'supply-limit': 'initial-supply-exceeds-supply-limit',
  'max-balance': 'initial-supply-exceeds-max-balance',
  'country-allow': 'demo-mint-country-not-allowed',
  'country-restrict': 'demo-mint-country-restricted',
};

/** Warning ids that block Compliance / Generate until resolved. */
export const COMPLIANCE_CONFIG_BLOCKING_WARNING_IDS = [
  'initial-supply-exceeds-supply-limit',
  'initial-supply-exceeds-max-balance',
  'demo-mint-country-not-allowed',
  'demo-mint-country-restricted',
] as const;

export function isComplianceConfigBlockingWarningId(id: string): boolean {
  return (COMPLIANCE_CONFIG_BLOCKING_WARNING_IDS as readonly string[]).includes(id);
}

/** Maps demo-mint preflight module ids to wizard copy notice ids. */
export function getDemoMintComplianceWarningId(moduleId: string): string {
  return DEMO_MINT_ISSUE_WARNING_IDS[moduleId] ?? moduleId;
}

export interface ComplianceConfigWarningOptions {
  /** When true, include jurisdiction checks for the demo IRS country (756 / CH). */
  includeDemoCountryChecks?: boolean;
}

function hasConfiguredInitialSupply(config: RWAConfig): boolean {
  const { initialSupply } = config.token;
  return initialSupply !== undefined && initialSupply.trim().length > 0;
}

function toPreflightWarnings(
  config: RWAConfig,
  options: ComplianceConfigWarningOptions
): ComplianceModuleSelectionWarning[] {
  return getDemoMintCompliancePreflightIssues(config)
    .filter((issue) => {
      if (issue.moduleId === 'country-allow' || issue.moduleId === 'country-restrict') {
        return options.includeDemoCountryChecks ?? false;
      }
      return true;
    })
    .map((issue) => ({
      id: DEMO_MINT_ISSUE_WARNING_IDS[issue.moduleId] ?? issue.moduleId,
      relatedModuleIds: [issue.moduleId],
    }));
}

/**
 * Structural compliance config warnings for the wizard (ids only — copy in rwa-wizard-copy).
 */
export function getComplianceConfigWarnings(
  config: RWAConfig,
  options: ComplianceConfigWarningOptions = {}
): ComplianceModuleSelectionWarning[] {
  const selectedModuleIds = config.compliance.modules.map((entry) => entry.moduleId);
  const input = {
    compliance: config.compliance,
    initialSupply: config.token.initialSupply,
  };

  const warnings = evaluateComplianceSelectionWarnings(
    input,
    selectedModuleIds,
    STELLAR_COMPLIANCE_SELECTION_WARNING_RULES
  );

  const preflightWarnings = toPreflightWarnings(config, options);
  const warningIds = new Set(warnings.map((warning) => warning.id));
  for (const warning of preflightWarnings) {
    if (!warningIds.has(warning.id)) {
      warnings.push(warning);
      warningIds.add(warning.id);
    }
  }

  if (
    hasConfiguredInitialSupply(config) &&
    selectedModuleIds.length > 0 &&
    preflightWarnings.length === 0
  ) {
    warnings.push({
      id: 'initial-supply-compliance-reminder',
      relatedModuleIds: selectedModuleIds,
    });
  }

  return warnings;
}

/** True when config has demo-mint blockers or created-hook limit conflicts. */
export function hasComplianceConfigBlockingIssues(
  config: RWAConfig,
  options: ComplianceConfigWarningOptions = {}
): boolean {
  return getComplianceConfigWarnings(config, options).some((warning) =>
    isComplianceConfigBlockingWarningId(warning.id)
  );
}

/** Demo auto-mint export path is blocked when testnet + initial supply + unresolved conflicts. */
export function isDemoAutoMintConfigReady(config: RWAConfig): boolean {
  if (!isDemoAutoMintEligible(config)) {
    return true;
  }

  return !hasComplianceConfigBlockingIssues(config, { includeDemoCountryChecks: true });
}

export {
  getDemoMintCompliancePreflightIssues,
  hasBlockingDemoMintComplianceIssues,
} from './demo-mint-compliance-preflight';
