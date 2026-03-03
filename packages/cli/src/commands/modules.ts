import type { GeneratorAdapter } from '../generators/registry';
import { getGenerator } from '../generators/registry';
import { logger } from '../utils/logger';

export interface ModulesOptions {
  chain: string;
}

export function modulesCommand(opts: ModulesOptions): void {
  let adapter: GeneratorAdapter;
  try {
    adapter = getGenerator(opts.chain);
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  const modules = adapter.getAvailableModules();

  if (modules.length === 0) {
    logger.info('No compliance modules available for this chain.');
    return;
  }

  logger.header(`Available compliance modules for ${opts.chain}:`);

  for (const mod of modules) {
    logger.moduleEntry(mod.id, mod.name, mod.description, mod.supportedHooks);
  }
}
