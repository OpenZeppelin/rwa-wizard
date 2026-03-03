import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { GeneratorAdapter } from '../generators/registry';
import { getGenerator } from '../generators/registry';
import { loadConfig } from '../utils/config-loader';
import { logger } from '../utils/logger';

export interface ValidateOptions {
  config: string;
  chain: string;
}

export function validateCommand(opts: ValidateOptions): void {
  let adapter: GeneratorAdapter;
  try {
    adapter = getGenerator(opts.chain);
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  let config: RWAConfig;
  try {
    config = loadConfig(opts.config);
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  const result = adapter.validate(config);

  if (result.warnings.length > 0) {
    logger.header(`Warnings (${result.warnings.length}):`);
    for (const w of result.warnings) {
      logger.validationWarning(w.field, w.code, w.message);
    }
  }

  if (!result.valid) {
    logger.header(`Errors (${result.errors.length}):`);
    for (const e of result.errors) {
      logger.validationError(e.field, e.code, e.message);
    }
    logger.blank();
    logger.error('Configuration is invalid');
    process.exit(1);
  }

  logger.blank();
  logger.success('Configuration is valid');
}
