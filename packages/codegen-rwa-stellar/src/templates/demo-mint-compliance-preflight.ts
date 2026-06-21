import { getUniqueModuleSelections } from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import {
  getOptionalNumericCountryCodes,
  getOptionalScalarConfigValue,
  serializeNumericArray,
} from '../modules/descriptors/shared';
import { getModuleDescriptorById } from '../modules/registry';
import { DEMO_COUNTRY_CODE } from './demo-auto-mint';

/** Compliance hook checked before a demo mint in Scope A. */
export const DEMO_MINT_COMPLIANCE_HOOK = 'created' as const;

const DEMO_COUNTRY_NUMERIC = String(DEMO_COUNTRY_CODE);

export interface DemoMintCompliancePreflightIssue {
  moduleId: string;
  moduleName: string;
  hook: typeof DEMO_MINT_COMPLIANCE_HOOK;
  /** Plain-language explanation for generated README and bootstrap script output. */
  explanation: string;
  /** Whether the bootstrap script can apply a manager invoke to resolve this. */
  autoFixable: boolean;
  /** When true, demo bootstrap cannot proceed regardless of flags. */
  blocking: boolean;
  /** Suggested on-chain fix (manager/admin invoke) when autoFixable. */
  suggestedInvoke?: {
    functionName: string;
    args: string;
    signerRole: 'manager' | 'admin';
  };
}

/**
 * Analyze configured compliance modules against demo-mint requirements.
 *
 * Used by the wizard (proactive guidance) and by `bootstrap-demo-mint.sh`
 * (runtime preflight before mint).
 */
export function getDemoMintCompliancePreflightIssues(
  config: RWAConfig
): DemoMintCompliancePreflightIssue[] {
  const initialSupply = config.token.initialSupply;
  if (!initialSupply) return [];

  const issues: DemoMintCompliancePreflightIssue[] = [];
  const selectedModules = getUniqueModuleSelections(config.compliance.modules);

  for (const selection of selectedModules) {
    const descriptor = getModuleDescriptorById(selection.moduleId);
    if (!descriptor) continue;

    if (!descriptor.requiredHooks.includes(DEMO_MINT_COMPLIANCE_HOOK)) {
      continue;
    }

    switch (selection.moduleId) {
      case 'supply-limit': {
        const limit = getOptionalScalarConfigValue(selection, 'limit');
        if (limit && BigInt(limit) < BigInt(initialSupply)) {
          issues.push({
            moduleId: selection.moduleId,
            moduleName: descriptor.name,
            hook: DEMO_MINT_COMPLIANCE_HOOK,
            explanation: `Supply Limit is ${limit} base units but initialSupply is ${initialSupply}. The \`created\` hook runs before mint succeeds — total supply after mint would exceed the configured cap.`,
            autoFixable: true,
            blocking: false,
            suggestedInvoke: {
              functionName: 'set_supply_limit',
              args: `--token "$RWA_TOKEN_ADDRESS" --limit ${initialSupply} --operator "$MANAGER"`,
              signerRole: 'manager',
            },
          });
        }
        break;
      }
      case 'max-balance': {
        const maxBalance = getOptionalScalarConfigValue(selection, 'maxBalance');
        if (maxBalance && BigInt(maxBalance) < BigInt(initialSupply)) {
          issues.push({
            moduleId: selection.moduleId,
            moduleName: descriptor.name,
            hook: DEMO_MINT_COMPLIANCE_HOOK,
            explanation: `Max Balance is ${maxBalance} base units but initialSupply is ${initialSupply}. The \`created\` hook caps each recipient's balance — Admin cannot receive the full mint amount. Plain language: this is a per-wallet holding limit, not an investor-only rule; Admin and treasury mints are checked the same way. Raise the cap, mint in tranches, or split across wallets.`,
            autoFixable: true,
            blocking: false,
            suggestedInvoke: {
              functionName: 'set_max_balance',
              args: `--token "$RWA_TOKEN_ADDRESS" --max ${initialSupply} --operator "$MANAGER"`,
              signerRole: 'manager',
            },
          });
        }
        break;
      }
      case 'country-allow': {
        const allowed = getOptionalNumericCountryCodes(selection, 'allowedCountries');
        if (allowed.length === 0 || !allowed.includes(DEMO_COUNTRY_NUMERIC)) {
          const merged = [...new Set([...allowed, DEMO_COUNTRY_NUMERIC])];
          issues.push({
            moduleId: selection.moduleId,
            moduleName: descriptor.name,
            hook: DEMO_MINT_COMPLIANCE_HOOK,
            explanation:
              allowed.length === 0
                ? `Country Allow-list has no seeded countries. The demo script registers Admin with country ${DEMO_COUNTRY_CODE} (CH) in IRS — mint would revert on \`created\` until that country is allowed.`
                : `Country Allow-list does not include ${DEMO_COUNTRY_CODE} (CH). The demo script registers Admin with that residence country — mint would revert on \`created\`.`,
            autoFixable: true,
            blocking: false,
            suggestedInvoke: {
              functionName: 'batch_allow_countries',
              args: `--token "$RWA_TOKEN_ADDRESS" --countries ${serializeNumericArray(merged)} --operator "$MANAGER"`,
              signerRole: 'manager',
            },
          });
        }
        break;
      }
      case 'country-restrict': {
        const restricted = getOptionalNumericCountryCodes(selection, 'restrictedCountries');
        if (restricted.includes(DEMO_COUNTRY_NUMERIC)) {
          issues.push({
            moduleId: selection.moduleId,
            moduleName: descriptor.name,
            hook: DEMO_MINT_COMPLIANCE_HOOK,
            explanation: `Country Restriction blocks ${DEMO_COUNTRY_CODE} (CH). The demo script always registers Admin with that country — mint cannot pass on \`created\`. Regenerate without restricting CH, or mint manually with a different country profile.`,
            autoFixable: false,
            blocking: true,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  return issues;
}

export function hasBlockingDemoMintComplianceIssues(config: RWAConfig): boolean {
  return getDemoMintCompliancePreflightIssues(config).some((issue) => issue.blocking);
}
