import { toSummaryPhase } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import type {
  ComplianceModuleOption,
  GeneratedZipArtifact,
  GenerationStatus,
} from '../../types/wizard';
import type { RwaCodegenService, ValidationResultDTO } from './types';

/** Shape of a codegen package module (e.g. @openzeppelin/codegen-rwa-*). */
interface CodegenPackageModule {
  validate: (config: RWAConfig) => { valid: boolean; errors: unknown[]; warnings: unknown[] };
  getAvailableModules: () => Array<{
    id: string;
    name: string;
    description: string;
    supportedHooks: unknown[];
  }>;
  generateZip: (
    config: RWAConfig,
    options?: {
      onProgress?: (event: { phase: string; percentage: number; message?: string }) => void;
    }
  ) => Promise<{ fileName: string; data: Blob }>;
}

function wrapCodegenPackage(pkg: CodegenPackageModule): RwaCodegenService {
  return {
    async validate(config: RWAConfig): Promise<ValidationResultDTO> {
      const result = pkg.validate(config);
      return {
        valid: result.valid,
        errors: result.errors.map((e: unknown) => {
          const err = e as { field: string; code: string; message: string };
          return { field: err.field, code: err.code, message: err.message };
        }),
        warnings: result.warnings.map((w: unknown) => {
          const warn = w as { field: string; code: string; message: string };
          return { field: warn.field, code: warn.code, message: warn.message };
        }),
      };
    },

    async getAvailableModules(): Promise<ComplianceModuleOption[]> {
      const modules = pkg.getAvailableModules();
      return modules.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        supportedHooks: [...m.supportedHooks] as ComplianceModuleOption['supportedHooks'],
      }));
    },

    async generateZip(
      config: RWAConfig,
      options?: { onStatus?: (status: GenerationStatus) => void }
    ): Promise<GeneratedZipArtifact> {
      const onProgress = options?.onStatus
        ? (event: { phase: string; percentage: number; message?: string }) => {
            options.onStatus?.({
              phase: toSummaryPhase(event.phase),
              message: event.message,
            });
          }
        : undefined;
      const result = await pkg.generateZip(config, { onProgress });
      return { fileName: result.fileName, data: result.data };
    },
  };
}

/**
 * Loads the codegen service for a target by dynamic import.
 * Only the selected target's package is loaded (same approach as UI Builder / Role Manager).
 */
export async function loadCodegenService(targetId: string): Promise<RwaCodegenService | null> {
  switch (targetId) {
    case 'stellar': {
      const mod = await import('@openzeppelin/codegen-rwa-stellar');
      return wrapCodegenPackage(mod);
    }
    default:
      return null;
  }
}
