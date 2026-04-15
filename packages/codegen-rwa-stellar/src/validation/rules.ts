import type { ValidationRule } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { generateRoleSymbol, STELLAR_VALIDATION_CONSTANTS } from '../constants';
import {
  getStellarPresetNetworkById,
  getSupportedStellarPresetNetworkIds,
} from '../deployment/target';
import { getModuleById, getRegisteredModuleIds } from '../modules/registry';

const I128_MAX = BigInt('170141183460469231731687303715884105727');

// ---------------------------------------------------------------------------
// Token validation rules
// ---------------------------------------------------------------------------

export const validateTokenName: ValidationRule<RWAConfig> = (config) => {
  const errors = [];
  const { name } = config.token;

  if (!name || name.trim().length === 0) {
    errors.push({
      field: 'token.name',
      code: 'REQUIRED_FIELD',
      message: 'Token name is required',
    });
  } else {
    const byteLength = new TextEncoder().encode(name).length;
    if (byteLength > STELLAR_VALIDATION_CONSTANTS.TOKEN_NAME_MAX_LENGTH) {
      errors.push({
        field: 'token.name',
        code: 'MAX_LENGTH_EXCEEDED',
        message: `Token name exceeds ${STELLAR_VALIDATION_CONSTANTS.TOKEN_NAME_MAX_LENGTH} bytes (got ${byteLength} bytes UTF-8)`,
      });
    }
  }

  return { errors, warnings: [] };
};

export const validateTokenSymbol: ValidationRule<RWAConfig> = (config) => {
  const errors = [];
  const { symbol } = config.token;

  if (!symbol || symbol.trim().length === 0) {
    errors.push({
      field: 'token.symbol',
      code: 'REQUIRED_FIELD',
      message: 'Token symbol is required',
    });
  } else if (symbol.length > STELLAR_VALIDATION_CONSTANTS.TOKEN_SYMBOL_MAX_LENGTH) {
    errors.push({
      field: 'token.symbol',
      code: 'MAX_LENGTH_EXCEEDED',
      message: `Token symbol exceeds ${STELLAR_VALIDATION_CONSTANTS.TOKEN_SYMBOL_MAX_LENGTH} characters (got ${symbol.length})`,
    });
  }

  return { errors, warnings: [] };
};

export const validateDecimals: ValidationRule<RWAConfig> = (config) => {
  const errors = [];
  const { decimals } = config.token;

  if (
    !Number.isInteger(decimals) ||
    decimals < STELLAR_VALIDATION_CONSTANTS.DECIMALS_MIN ||
    decimals > STELLAR_VALIDATION_CONSTANTS.DECIMALS_MAX
  ) {
    errors.push({
      field: 'token.decimals',
      code: 'INVALID_RANGE',
      message: `Decimals must be an integer between ${STELLAR_VALIDATION_CONSTANTS.DECIMALS_MIN} and ${STELLAR_VALIDATION_CONSTANTS.DECIMALS_MAX} (got ${decimals})`,
    });
  }

  return { errors, warnings: [] };
};

export const validateInitialSupply: ValidationRule<RWAConfig> = (config) => {
  const errors = [];
  const warnings = [];
  const { initialSupply } = config.token;

  if (initialSupply === undefined) {
    return { errors: [], warnings: [] };
  }

  let value: bigint;
  try {
    value = BigInt(initialSupply);
  } catch {
    errors.push({
      field: 'token.initialSupply',
      code: 'INVALID_FORMAT',
      message: `Initial supply must be a valid numeric string (got "${initialSupply}")`,
    });
    return { errors, warnings: [] };
  }

  if (value < 0n) {
    errors.push({
      field: 'token.initialSupply',
      code: 'INVALID_RANGE',
      message: 'Initial supply must be non-negative',
    });
  } else if (value > I128_MAX) {
    errors.push({
      field: 'token.initialSupply',
      code: 'I128_OVERFLOW',
      message: `Initial supply exceeds Soroban i128 maximum (${I128_MAX.toString()})`,
    });
  }

  warnings.push({
    field: 'token.initialSupply',
    code: 'MANUAL_VERIFIED_MINT_REQUIRED',
    message:
      'Stellar deploy.sh does not auto-mint initial supply. The generated project does not scaffold the upstream claim-issuer and per-holder identity contracts required to onboard a verified mint recipient, so mint manually after identity bootstrap.',
  });

  return { errors, warnings };
};

// ---------------------------------------------------------------------------
// Identity verification validation rules
// ---------------------------------------------------------------------------

export const validateClaimTopics: ValidationRule<RWAConfig> = (config) => {
  const errors = [];
  const { claimTopics } = config.identityVerification;

  const seen = new Set<number>();
  for (const topic of claimTopics) {
    if (seen.has(topic.id)) {
      errors.push({
        field: 'identityVerification.claimTopics',
        code: 'DUPLICATE_ENTRY',
        message: `Duplicate claim topic ID: ${topic.id}`,
      });
      break;
    }
    seen.add(topic.id);
  }

  return { errors, warnings: [] };
};

export const validateTrustedIssuers: ValidationRule<RWAConfig> = (config) => {
  const errors = [];
  const { claimTopics, trustedIssuers } = config.identityVerification;
  const validTopicIds = new Set(claimTopics.map((t) => t.id));

  for (let i = 0; i < trustedIssuers.length; i++) {
    const issuer = trustedIssuers[i];

    if (!issuer.address || issuer.address.trim().length === 0) {
      errors.push({
        field: `identityVerification.trustedIssuers[${i}].address`,
        code: 'REQUIRED_FIELD',
        message: `Trusted issuer at index ${i} must have a non-empty address`,
      });
    }

    if (issuer.claimTopics.length === 0) {
      errors.push({
        field: `identityVerification.trustedIssuers[${i}].claimTopics`,
        code: 'REQUIRED_FIELD',
        message: `Trusted issuer at index ${i} must reference at least one claim topic`,
      });
    } else {
      const invalidRefs = issuer.claimTopics.filter((id) => !validTopicIds.has(id));
      if (invalidRefs.length > 0) {
        errors.push({
          field: `identityVerification.trustedIssuers[${i}].claimTopics`,
          code: 'INVALID_REFERENCE',
          message: `Trusted issuer at index ${i} references non-existent claim topic IDs: ${invalidRefs.join(', ')}`,
        });
      }
    }
  }

  return { errors, warnings: [] };
};

// ---------------------------------------------------------------------------
// Access control validation rules
// ---------------------------------------------------------------------------

export const validateOwnership: ValidationRule<RWAConfig> = (config) => {
  const errors = [];
  const { ownership } = config.accessControl;

  if (ownership.type === 'single-owner') {
    if (!ownership.ownerAddress || ownership.ownerAddress.trim().length === 0) {
      errors.push({
        field: 'accessControl.ownership.ownerAddress',
        code: 'REQUIRED_FIELD',
        message: 'Owner address is required for single-owner model',
      });
    }
  } else if (ownership.type === 'multi-sig' || ownership.type === 'dao') {
    if (!ownership.address || ownership.address.trim().length === 0) {
      errors.push({
        field: 'accessControl.ownership.address',
        code: 'REQUIRED_FIELD',
        message: `Address is required for ${ownership.type} ownership model`,
      });
    }
  }

  return { errors, warnings: [] };
};

export const validateRoles: ValidationRule<RWAConfig> = (config) => {
  const errors = [];
  const { roles } = config.accessControl;
  const maxSymbolLen = STELLAR_VALIDATION_CONSTANTS.ROLE_SYMBOL_MAX_LENGTH;

  for (let i = 0; i < roles.length; i++) {
    const role = roles[i];

    if (!role.name || role.name.trim().length === 0) {
      errors.push({
        field: `accessControl.roles[${i}].name`,
        code: 'REQUIRED_FIELD',
        message: `Role at index ${i} must have a non-empty name`,
      });
    }

    if (role.symbol !== undefined && role.symbol.length > maxSymbolLen) {
      errors.push({
        field: `accessControl.roles[${i}].symbol`,
        code: 'MAX_LENGTH_EXCEEDED',
        message: `Role symbol at index ${i} exceeds ${maxSymbolLen} characters (got ${role.symbol.length})`,
      });
    }
  }

  const resolvedSymbols = roles
    .filter((r) => r.name && r.name.trim().length > 0)
    .map((r) => r.symbol ?? generateRoleSymbol(r.name));

  const symbolSet = new Set<string>();
  for (const sym of resolvedSymbols) {
    if (symbolSet.has(sym)) {
      errors.push({
        field: 'accessControl.roles',
        code: 'DUPLICATE_ENTRY',
        message: `Duplicate role symbol: "${sym}" (including auto-generated symbols)`,
      });
      break;
    }
    symbolSet.add(sym);
  }

  return { errors, warnings: [] };
};

// ---------------------------------------------------------------------------
// Deployment validation rules
// ---------------------------------------------------------------------------

export const validateDeployment: ValidationRule<RWAConfig> = (config) => {
  const errors = [];
  const target = config.deployment?.target;

  if (!target) {
    errors.push({
      field: 'deployment.target',
      code: 'REQUIRED_FIELD',
      message: 'Deployment target is required',
    });

    return { errors, warnings: [] };
  }

  if (!target.ecosystem || target.ecosystem.trim().length === 0) {
    errors.push({
      field: 'deployment.target.ecosystem',
      code: 'REQUIRED_FIELD',
      message: 'Deployment target ecosystem is required',
    });
  } else if (target.ecosystem !== 'stellar') {
    errors.push({
      field: 'deployment.target.ecosystem',
      code: 'UNSUPPORTED_ECOSYSTEM',
      message: `codegen-rwa-stellar only supports deployment targets for the "stellar" ecosystem (got "${target.ecosystem}")`,
    });
  }

  if (target.kind === 'preset') {
    if (!target.networkId || target.networkId.trim().length === 0) {
      errors.push({
        field: 'deployment.target.networkId',
        code: 'REQUIRED_FIELD',
        message: 'Preset deployment target networkId is required',
      });
    } else if (!getStellarPresetNetworkById(target.networkId)) {
      errors.push({
        field: 'deployment.target.networkId',
        code: 'UNSUPPORTED_NETWORK',
        message: `Unsupported Stellar preset network "${target.networkId}". Supported networks: ${getSupportedStellarPresetNetworkIds().join(', ')}`,
      });
    }
  } else if (target.kind === 'custom') {
    if (!target.rpcUrl || target.rpcUrl.trim().length === 0) {
      errors.push({
        field: 'deployment.target.rpcUrl',
        code: 'REQUIRED_FIELD',
        message: 'Custom deployment target rpcUrl is required',
      });
    }

    if (target.explorerUrl !== undefined) {
      if (target.explorerUrl.trim().length === 0) {
        errors.push({
          field: 'deployment.target.explorerUrl',
          code: 'INVALID_FORMAT',
          message: 'Custom deployment target explorerUrl cannot be empty when provided',
        });
      } else {
        try {
          new URL(target.explorerUrl);
        } catch {
          errors.push({
            field: 'deployment.target.explorerUrl',
            code: 'INVALID_FORMAT',
            message: `Custom deployment target explorerUrl must be a valid URL (got "${target.explorerUrl}")`,
          });
        }
      }
    }
  } else {
    errors.push({
      field: 'deployment.target.kind',
      code: 'INVALID_VALUE',
      message: 'Deployment target kind must be "preset" or "custom"',
    });
  }

  return { errors, warnings: [] };
};

// ---------------------------------------------------------------------------
// Compliance module validation rules
// ---------------------------------------------------------------------------

export const validateComplianceModules: ValidationRule<RWAConfig> = (config) => {
  const errors: Array<{ field: string; code: string; message: string }> = [];
  const warnings: Array<{ field: string; code: string; message: string }> = [];
  const { modules } = config.compliance;
  const availableModuleIds = getRegisteredModuleIds();
  const seen = new Set<string>();

  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i];

    if (!availableModuleIds.has(mod.moduleId)) {
      errors.push({
        field: `compliance.modules[${i}].moduleId`,
        code: 'UNSUPPORTED_MODULE',
        message: `Compliance module "${mod.moduleId}" is not available. Supported modules: ${[...availableModuleIds].join(', ')}`,
      });
      continue;
    }

    if (seen.has(mod.moduleId)) {
      errors.push({
        field: `compliance.modules[${i}].moduleId`,
        code: 'DUPLICATE_MODULE',
        message: `Compliance module "${mod.moduleId}" is selected more than once`,
      });
      continue;
    }
    seen.add(mod.moduleId);

    const entry = getModuleById(mod.moduleId);
    if (!entry) continue;

    if (entry.review.state === 'under-review') {
      warnings.push({
        field: `compliance.modules[${i}].moduleId`,
        code: 'UNDER_REVIEW_MODULE',
        message: `Module "${entry.name}" is under review${entry.review.prUrl ? ` (${entry.review.prUrl})` : ''} — not recommended for production`,
      });
    }

    for (const field of entry.configFields) {
      if (field.required) {
        const val = mod.config?.[field.key];
        if (val === undefined || val === null || val === '') {
          errors.push({
            field: `compliance.modules[${i}].config.${field.key}`,
            code: 'REQUIRED_MODULE_CONFIG',
            message: `Module "${entry.name}" requires config field "${field.label}"`,
          });
        }
      }
    }
  }

  return { errors, warnings };
};

// ---------------------------------------------------------------------------
// Aggregate: all RWA validation rules
// ---------------------------------------------------------------------------

export const rwaValidationRules: ValidationRule<RWAConfig>[] = [
  validateTokenName,
  validateTokenSymbol,
  validateDecimals,
  validateInitialSupply,
  validateClaimTopics,
  validateTrustedIssuers,
  validateOwnership,
  validateRoles,
  validateDeployment,
  validateComplianceModules,
];
