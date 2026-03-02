import type { ValidationRule } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { generateRoleSymbol, STELLAR_VALIDATION_CONSTANTS } from '../constants';

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

  return { errors, warnings: [] };
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
  const { network } = config.deployment;

  if (!network || network.trim().length === 0) {
    errors.push({
      field: 'deployment.network',
      code: 'REQUIRED_FIELD',
      message: 'Deployment network is required',
    });
  }

  return { errors, warnings: [] };
};

// ---------------------------------------------------------------------------
// Compliance module validation rules
// ---------------------------------------------------------------------------

export const validateComplianceModules: ValidationRule<RWAConfig> = (config) => {
  const errors = [];
  const { modules } = config.compliance;

  // No modules registered yet — any moduleId is unsupported until Phase 7
  const availableModuleIds = new Set<string>();

  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i];

    if (!availableModuleIds.has(mod.moduleId)) {
      errors.push({
        field: `compliance.modules[${i}].moduleId`,
        code: 'UNSUPPORTED_MODULE',
        message: `Compliance module "${mod.moduleId}" is not available. No modules are currently implemented.`,
      });
    }
  }

  return { errors, warnings: [] };
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
