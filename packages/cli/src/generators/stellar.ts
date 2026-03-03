import type {
  GenerateOptions,
  GenerationResult,
  ProgressCallback,
  ValidationResult,
  ZipResult,
} from '@openzeppelin/codegen-core';
import {
  generate,
  generateZip,
  getAvailableModules,
  STELLAR_VALIDATION_CONSTANTS,
  validate,
} from '@openzeppelin/codegen-rwa-stellar';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { ComplianceModuleInfo, GeneratorAdapter } from './registry';

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
      { value: 'testnet', label: 'Testnet', hint: 'Stellar testnet (recommended for development)' },
      { value: 'mainnet', label: 'Mainnet', hint: 'Stellar mainnet (production)' },
    ],
  },

  generate(config: RWAConfig, options?: GenerateOptions): GenerationResult {
    return generate(config, options);
  },

  validate(config: RWAConfig): ValidationResult {
    return validate(config);
  },

  async generateZip(
    config: RWAConfig,
    options?: { onProgress?: ProgressCallback }
  ): Promise<ZipResult> {
    return generateZip(config, options);
  },

  getAvailableModules(): ComplianceModuleInfo[] {
    return getAvailableModules().map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      supportedHooks: [...m.supportedHooks],
    }));
  },
};
