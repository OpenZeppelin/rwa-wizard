import type {
  GenerateOptions,
  GenerationResult,
  ValidationResult,
  ZipResult,
} from '@openzeppelin/codegen-core';
import { generateZip as coreGenerateZip } from '@openzeppelin/codegen-core';
import {
  generate,
  generateRoleSymbol,
  generateWithIdentitySupport,
  generateZip,
  getAvailableModules,
  getEcosystemMetadata,
  sanitizeDirectoryName,
  STELLAR_VALIDATION_CONSTANTS,
  validate,
} from '@openzeppelin/codegen-rwa-stellar';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { ComplianceModuleInfo, GeneratorAdapter, OperatorRolePreset } from './registry';

export const stellarAdapter: GeneratorAdapter = {
  name: 'Stellar/Soroban RWA Generator',
  chain: 'stellar',

  hints: {
    addressPlaceholder: 'e.g. GABCD...WXYZ',
    tokenNameMaxLength: STELLAR_VALIDATION_CONSTANTS.TOKEN_NAME_MAX_LENGTH,
    tokenSymbolMaxLength: STELLAR_VALIDATION_CONSTANTS.TOKEN_SYMBOL_MAX_LENGTH,
    decimalsMin: STELLAR_VALIDATION_CONSTANTS.DECIMALS_MIN,
    decimalsMax: STELLAR_VALIDATION_CONSTANTS.DECIMALS_MAX,
    roleSymbolMaxLength: STELLAR_VALIDATION_CONSTANTS.ROLE_SYMBOL_MAX_LENGTH,
    networks: [
      {
        value: 'stellar-testnet',
        label: 'Testnet',
        hint: 'Stellar testnet (recommended for development)',
      },
      {
        value: 'stellar-mainnet',
        label: 'Mainnet',
        hint: 'Stellar mainnet (production)',
      },
    ],
    supportsCustomRpc: true,
    customRpcPlaceholder: 'https://soroban-testnet.stellar.org:443',
  },

  getOperatorRolePresets(): OperatorRolePreset[] {
    return getEcosystemMetadata().operatorRoles.map((role) => ({
      id: role.id,
      name: role.name,
      defaultSymbol: generateRoleSymbol(role.name),
    }));
  },

  generate(config: RWAConfig, options?: GenerateOptions): GenerationResult {
    return generate(config, options);
  },

  generateWithIdentitySupport(config: RWAConfig, options?: GenerateOptions): GenerationResult {
    return generateWithIdentitySupport(config, options);
  },

  validate(config: RWAConfig, options?: GenerateOptions): ValidationResult {
    return validate(config, options);
  },

  async generateZip(config: RWAConfig, options?: GenerateOptions): Promise<ZipResult> {
    return generateZip(config, options);
  },

  async generateZipWithIdentitySupport(
    config: RWAConfig,
    options?: GenerateOptions
  ): Promise<ZipResult> {
    const result = generateWithIdentitySupport(config, options);
    const dirName = sanitizeDirectoryName(config.token.symbol);
    return coreGenerateZip(result, dirName, { onProgress: options?.onProgress });
  },

  getAvailableModules(): ComplianceModuleInfo[] {
    return getAvailableModules().map((m) => ({
      id: m.id,
      name: m.name,
      requiredHooks: [...m.requiredHooks],
      review: { state: m.review.state, ...(m.review.prUrl ? { prUrl: m.review.prUrl } : {}) },
      configFields: m.configFields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required,
        ...(f.placeholder !== undefined ? { placeholder: f.placeholder } : {}),
      })),
    }));
  },
};
