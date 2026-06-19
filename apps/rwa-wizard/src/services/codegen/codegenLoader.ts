import { toSummaryPhase } from '@openzeppelin/codegen-core';
import type {
  CodegenInfoBlurb,
  GenerateOptions,
  ProgressCallback,
} from '@openzeppelin/codegen-core';
import type {
  ComplianceModuleCategoryId,
  ComplianceModuleConfigValueKind,
  ComplianceModuleRuntimePrerequisiteId,
} from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import type {
  GeneratedZipArtifact,
  GenerationStatus,
  StructuralComplianceModuleOption,
  StructuralEcosystemMetadata,
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
    category: ComplianceModuleCategoryId;
    runtimePrerequisites: readonly ComplianceModuleRuntimePrerequisiteId[];
    requiredHooks: string[];
    review: { state: string; prUrl?: string };
    configFields: Array<{
      key: string;
      label: string;
      type: string;
      required: boolean;
      placeholder?: string;
      valueKind?: ComplianceModuleConfigValueKind;
    }>;
  }>;
  generateZip: (
    config: RWAConfig,
    options?: GenerateOptions
  ) => Promise<{ fileName: string; data: Blob }>;
  getEcosystemMetadata?: () => StructuralEcosystemMetadata;
  getCodegenInfoBlurb?: () => CodegenInfoBlurb;
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

/**
 * Merge base generate options with the call-site progress callback.
 *
 * Precedence (call-site wins over base):
 *   1. Every field of `baseGenerateOptions` (the runtime + default options
 *      resolved for this target).
 *   2. The call-site `onProgress` handler, when provided. This deliberately
 *      overrides any `onProgress` that might live in the base options so the
 *      streaming UI attached by the hook always receives the events.
 *
 * Returns `undefined` when there is nothing to pass so the underlying
 * package's own defaults remain active.
 */
function buildGenerateOptions(
  base: RuntimeGenerateOptions | undefined,
  onProgress: ProgressCallback | undefined
): GenerateOptions | undefined {
  if (!base && !onProgress) return undefined;
  return {
    ...base,
    ...(onProgress ? { onProgress } : {}),
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

    async getAvailableModules(): Promise<StructuralComplianceModuleOption[]> {
      const modules = pkg.getAvailableModules();
      return modules.map((m) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        runtimePrerequisites: [...m.runtimePrerequisites],
        requiredHooks: [...m.requiredHooks],
        review: {
          state: m.review.state as StructuralComplianceModuleOption['review']['state'],
          prUrl: m.review.prUrl,
        },
        configFields: m.configFields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type as 'number' | 'string' | 'string[]',
          required: f.required,
          placeholder: f.placeholder,
          valueKind:
            f.valueKind as StructuralComplianceModuleOption['configFields'][number]['valueKind'],
        })),
      }));
    },

    getEcosystemMetadata: pkg.getEcosystemMetadata ? () => pkg.getEcosystemMetadata!() : undefined,

    getCodegenInfoBlurb: pkg.getCodegenInfoBlurb ? () => pkg.getCodegenInfoBlurb!() : undefined,

    async generateZip(
      config: RWAConfig,
      options?: { onStatus?: (status: GenerationStatus) => void }
    ): Promise<GeneratedZipArtifact> {
      const onProgress: ProgressCallback | undefined = options?.onStatus
        ? (event) => {
            options.onStatus?.({
              phase: toSummaryPhase(event.phase),
              message: event.message,
            });
          }
        : undefined;
      const generateOptions = buildGenerateOptions(baseGenerateOptions, onProgress);
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
