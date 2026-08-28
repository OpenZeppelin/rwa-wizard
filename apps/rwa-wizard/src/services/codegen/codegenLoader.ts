import { toSummaryPhase } from '@openzeppelin/codegen-core';
import type {
  CodegenInfoBlurb,
  GenerateOptions,
  GenerationResult,
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
  StructuralComplianceModuleOption,
  StructuralEcosystemMetadata,
  StructuralUpstreamImportLinks,
  StructuralUpstreamSourceRevision,
} from '../../types/wizard';
import { CodegenUnsupportedError, toCodegenError } from './errors';
import { getCodegenRuntimeOptions, type RuntimeGenerateOptions } from './runtimeOptions';
import type {
  DeployGuidanceDTO,
  GenerateArtifactOptions,
  GeneratedFileTreeArtifact,
  RwaCodegenService,
  ValidationResultDTO,
} from './types';

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
  generate?: (config: RWAConfig, options?: GenerateOptions) => GenerationResult;
  generateWithIdentitySupport?: (config: RWAConfig, options?: GenerateOptions) => GenerationResult;
  getEcosystemMetadata?: () => StructuralEcosystemMetadata;
  getUpstreamSourceRevision?: (options?: GenerateOptions) => StructuralUpstreamSourceRevision;
  getUpstreamImportLinks?: () => StructuralUpstreamImportLinks;
  getCodegenInfoBlurb?: () => CodegenInfoBlurb;
  generateZipWithIdentitySupport?: (
    config: RWAConfig,
    options?: GenerateOptions
  ) => Promise<{ fileName: string; data: Blob }>;
  getDeployGuidance?: (config: RWAConfig) => DeployGuidanceDTO;
  getComplianceConfigWarnings?: (
    config: RWAConfig,
    options?: { includeDemoCountryChecks?: boolean }
  ) => Array<{ id: string; relatedModuleIds: readonly string[] }>;
  hasComplianceConfigBlockingIssues?: (
    config: RWAConfig,
    options?: { includeDemoCountryChecks?: boolean }
  ) => boolean;
  isDemoAutoMintConfigReady?: (config: RWAConfig) => boolean;
  isComplianceConfigBlockingWarningId?: (id: string) => boolean;
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

function onProgressFrom(
  onStatus: GenerateArtifactOptions['onStatus']
): ProgressCallback | undefined {
  return onStatus
    ? (event) => {
        onStatus({
          phase: toSummaryPhase(event.phase),
          message: event.message,
        });
      }
    : undefined;
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

    // Resolved with the same base options generation uses, so a local-checkout
    // build reports the unpinned coordinates its manifest actually emits.
    getUpstreamSourceRevision: pkg.getUpstreamSourceRevision
      ? () => pkg.getUpstreamSourceRevision!(baseGenerateOptions)
      : undefined,

    getUpstreamImportLinks: pkg.getUpstreamImportLinks
      ? () => pkg.getUpstreamImportLinks!()
      : undefined,

    getCodegenInfoBlurb: pkg.getCodegenInfoBlurb ? () => pkg.getCodegenInfoBlurb!() : undefined,

    getDeployGuidance: pkg.getDeployGuidance
      ? (config) => pkg.getDeployGuidance!(config)
      : undefined,

    getComplianceConfigWarnings: pkg.getComplianceConfigWarnings
      ? (config, options) => pkg.getComplianceConfigWarnings!(config, options)
      : undefined,

    hasComplianceConfigBlockingIssues: pkg.hasComplianceConfigBlockingIssues
      ? (config, options) => pkg.hasComplianceConfigBlockingIssues!(config, options)
      : undefined,

    isDemoAutoMintConfigReady: pkg.isDemoAutoMintConfigReady
      ? (config) => pkg.isDemoAutoMintConfigReady!(config)
      : undefined,

    isComplianceConfigBlockingWarningId: pkg.isComplianceConfigBlockingWarningId
      ? (id) => pkg.isComplianceConfigBlockingWarningId!(id)
      : undefined,

    supportsIdentitySupport: Boolean(pkg.generateZipWithIdentitySupport),

    async generateZip(
      config: RWAConfig,
      options?: GenerateArtifactOptions
    ): Promise<GeneratedZipArtifact> {
      const generateOptions = buildGenerateOptions(
        baseGenerateOptions,
        onProgressFrom(options?.onStatus)
      );
      const zipFn =
        options?.includeIdentitySupport && pkg.generateZipWithIdentitySupport
          ? pkg.generateZipWithIdentitySupport.bind(pkg)
          : pkg.generateZip.bind(pkg);
      const result = await zipFn(config, generateOptions);
      return { fileName: result.fileName, data: result.data };
    },

    async generateFileTree(
      config: RWAConfig,
      options?: GenerateArtifactOptions
    ): Promise<GeneratedFileTreeArtifact> {
      // INV-7: do not call a missing generate, do not unzip ZIP as fallback.
      if (typeof pkg.generate !== 'function') {
        throw new CodegenUnsupportedError(targetId);
      }

      // INV-5 / INV-16: same options merge as ZIP; no invented packaging event.
      const generateOptions = buildGenerateOptions(
        baseGenerateOptions,
        onProgressFrom(options?.onStatus)
      );

      // INV-4 / INV-9 / INV-15 / INV-19: one generate dispatch, never validate()
      // and never generateZip.
      const generateFn =
        options?.includeIdentitySupport && pkg.generateWithIdentitySupport
          ? pkg.generateWithIdentitySupport.bind(pkg)
          : pkg.generate.bind(pkg);

      try {
        const result = generateFn(config, generateOptions);
        // INV-1 / INV-2 / INV-20: return package files as-is, no prefix, no clone.
        return { files: result.files };
      } catch (err) {
        // INV-8 / INV-18: typed rejection, never a partial tree.
        toCodegenError(err);
      }
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
