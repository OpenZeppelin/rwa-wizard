import type { ComplianceModuleSelection, RWAConfig } from './types';

const MODULE_ID_MIGRATIONS: Readonly<Record<string, string>> = {
  'transfer-restrict': 'transfer-allow',
};

function migrateComplianceModule(module: ComplianceModuleSelection): ComplianceModuleSelection {
  const migratedId = MODULE_ID_MIGRATIONS[module.moduleId];
  if (!migratedId) {
    return module;
  }

  return { ...module, moduleId: migratedId };
}

/**
 * Apply forward-compatible migrations to a stored or imported RWA config.
 */
export function migrateRwaConfig(config: RWAConfig): RWAConfig {
  const modules = config.compliance.modules.map(migrateComplianceModule);
  const changed = modules.some((module, index) => module !== config.compliance.modules[index]);
  if (!changed) {
    return config;
  }

  return {
    ...config,
    compliance: {
      ...config.compliance,
      modules,
    },
  };
}
