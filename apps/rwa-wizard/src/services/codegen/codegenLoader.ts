import { toSummaryPhase } from '@openzeppelin/codegen-core';
import type { GenerateOptions } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import type {
  ComplianceModuleOption,
  GeneratedZipArtifact,
  GenerationStatus,
  TargetEcosystemMetadata,
} from '../../types/wizard';
import { getCodegenRuntimeOptions, type RuntimeGenerateOptions } from './runtimeOptions';
import type { RwaCodegenService, ValidationResultDTO } from './types';

/** Shape of a codegen package module (e.g. @openzeppelin/codegen-rwa-*). */
interface CodegenPackageModule {
  validate: (
    config: RWAConfig,
    options?: GenerateOptions
  ) => { valid: boolean; errors: unknown[]; warnings: unknown[] };
  getAvailableModules: () => Array<{
    id: string;
    name: string;
    description: string;
    requiredHooks: string[];
    review: { state: string; prUrl?: string };
    configFields: Array<{
      key: string;
      label: string;
      type: string;
      required: boolean;
      placeholder?: string;
      hint?: string;
    }>;
  }>;
  generateZip: (
    config: RWAConfig,
    options?: GenerateOptions
  ) => Promise<{ fileName: string; data: Blob }>;
  getEcosystemMetadata?: () => TargetEcosystemMetadata;
}

function getDefaultGenerateOptions(targetId: string): RuntimeGenerateOptions | undefined {
  switch (targetId) {
    case 'stellar':
      // The UI already exposes review-state badges for these modules, so generation
      // should stay available by default and keep the warning in generated output.
      return { allowUnderReviewModules: true };
    default:
      return undefined;
  }
}

function resolveGenerateOptions(targetId: string): RuntimeGenerateOptions | undefined {
  const runtimeOptions = getCodegenRuntimeOptions(targetId);
  const defaultOptions = getDefaultGenerateOptions(targetId);

  if (!runtimeOptions && !defaultOptions) {
    return undefined;
  }

  return {
    ...defaultOptions,
    ...runtimeOptions,
  };
}

function wrapCodegenPackage(targetId: string, pkg: CodegenPackageModule): RwaCodegenService {
  const baseGenerateOptions = resolveGenerateOptions(targetId);

  return {
    async validate(config: RWAConfig): Promise<ValidationResultDTO> {
      const result = pkg.validate(config, baseGenerateOptions);
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
        requiredHooks: [...m.requiredHooks],
        review: {
          state: m.review.state as ComplianceModuleOption['review']['state'],
          prUrl: m.review.prUrl,
        },
        configFields: m.configFields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type as 'number' | 'string' | 'string[]',
          required: f.required,
          placeholder: f.placeholder,
          hint: f.hint,
        })),
      }));
    },

    getEcosystemMetadata: pkg.getEcosystemMetadata ? () => pkg.getEcosystemMetadata!() : undefined,

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
      const generateOptions =
        baseGenerateOptions || onProgress
          ? {
              ...baseGenerateOptions,
              ...(onProgress ? { onProgress } : {}),
            }
          : undefined;
      const result = await pkg.generateZip(config, generateOptions);
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
      return wrapCodegenPackage(targetId, mod);
    }
    default:
      return null;
  }
}
