import type { ComplianceModuleSelection, RWAConfig } from '@openzeppelin/rwa-config';

const STELLAR_MODULE_ID_MIGRATIONS: Readonly<Record<string, string>> = {
  'transfer-restrict': 'transfer-allow',
};

function migrateComplianceModule(module: ComplianceModuleSelection): ComplianceModuleSelection {
  const migratedId = STELLAR_MODULE_ID_MIGRATIONS[module.moduleId];
  if (!migratedId) {
    return module;
  }

  return { ...module, moduleId: migratedId };
}

/**
 * Apply forward-compatible migrations to a stored or imported Stellar RWA config.
 */
export function migrateStellarRwaConfig(config: RWAConfig): RWAConfig {
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
