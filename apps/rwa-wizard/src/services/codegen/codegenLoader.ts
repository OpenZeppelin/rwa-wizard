import {
  hasProvenance,
  isProvenanceEntry,
  parseConfigPath,
  toSummaryPhase,
} from '@openzeppelin/codegen-core';
import type {
  CodegenInfoBlurb,
  FileProvenance,
  GenerateOptions,
  GenerationResult,
  ProgressCallback,
  ProvenanceEntry,
  ProvenanceResult,
} from '@openzeppelin/codegen-core';
import type {
  ComplianceModuleCategoryId,
  ComplianceModuleConfigValueKind,
  ComplianceModuleRuntimePrerequisiteId,
} from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';
import { isCodeViewLanguage } from '@openzeppelin/ui-components/code-view';
import { logger } from '@openzeppelin/ui-utils';

import {
  isStructuralGeneratedFileKind,
  type GeneratedZipArtifact,
  type StructuralComplianceModuleOption,
  type StructuralEcosystemMetadata,
  type StructuralGeneratedFileKind,
  type StructuralUpstreamImportLinks,
  type StructuralUpstreamImportTarget,
  type StructuralUpstreamSourceRevision,
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

/**
 * Import links as a codegen package reports them, before this app has checked
 * anything: the language is whatever string the package chose.
 */
interface ReportedImportLinks {
  readonly language: string;
  readonly importLinePrefix: string;
  readonly targets: readonly StructuralUpstreamImportTarget[];
}

/**
 * Narrows a package's reported links to what the code pane can act on.
 *
 * The decorator only links inside files whose language matches, so a package
 * reporting `Rust` or `rs` produces a preview with no links and no complaint —
 * a contract broken in one package and observable only as an absence in the
 * other. Failing it here names the package and the value.
 */
function toImportLinks(reported: ReportedImportLinks): StructuralUpstreamImportLinks | null {
  if (!isCodeViewLanguage(reported.language)) {
    logger.warn(
      'CodegenLoader',
      `Ignoring upstream import links: language "${reported.language}" is not one the code preview can render.`
    );
    return null;
  }

  return {
    language: reported.language,
    importLinePrefix: reported.importLinePrefix,
    targets: reported.targets,
  };
}

/**
 * Narrows a package's reported kind to the closed set this app ranks on.
 *
 * Unlike `toImportLinks`, a bad value degrades that path to `unknown` and
 * leaves every other path alone. A file with an unknown kind is still a
 * file the user needs to see; a link with an unrenderable language is not
 * a link. Do not unify these two seams.
 */
function toGeneratedFileKind(reported: string): StructuralGeneratedFileKind {
  if (isStructuralGeneratedFileKind(reported)) return reported;
  logger.warn(
    'CodegenLoader',
    `Ignoring generated file kind "${reported}": not in the closed ranking set.`
  );
  return 'unknown';
}

/**
 * Whether every recorded path parses in core's dialect. `filterProvenanceByPath`
 * throws `RangeError` on a malformed recorded path, so rejecting here is what
 * lets the app-side grouper promise it never throws. SF-5 INV-3 / INV-7.
 */
function hasParsablePaths(entry: ProvenanceEntry): boolean {
  try {
    for (const path of entry.paths) parseConfigPath(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Repairs an entry's significance mark by INTERSECTION, and returns the entry
 * itself when nothing needed repairing.
 *
 * `secondaryPaths` becomes `declared ∩ paths`, sorted and deduped; an empty
 * result drops the key entirely, and a non-array or non-string-array is treated
 * as undeclared. A mark on a `file` or `created` entry — which the type forbids
 * but untrusted input can carry — is dropped.
 *
 * The rule is intersection rather than rejection because the repair can then
 * only ever PROMOTE a path to primary, never demote one: no path becomes
 * secondary that the package did not declare secondary, and no site is ever
 * lost — only an unjustifiable demotion. It is also the same rule specified for
 * a hypothetical entry-level merge, so there is one rule to remember.
 *
 * Note the asymmetry with core's `addRange`, which THROWS on the same condition.
 * That is deliberate and the two must not be unified: `addRange`'s caller is our
 * own template, covered by our own suite, so a bad subset is a bug to surface
 * loudly before release. This function's input arrives from a published package
 * the app does not control, where a malformed mark must never cost the user
 * information. A throwing loader would turn one bad byte of package metadata
 * into zero provenance affordances on every field (SF-5 INV-7).
 */
function repairSecondaryPaths(entry: ProvenanceEntry): ProvenanceEntry {
  let declared: unknown;
  try {
    declared = (entry as { readonly secondaryPaths?: unknown }).secondaryPaths;
  } catch {
    declared = undefined; // a hostile getter is a malformed mark, not an exception
  }
  if (declared === undefined) return entry;

  if (entry.kind === 'range') {
    const attributed = new Set<string>(entry.paths);
    const repaired = Array.isArray(declared)
      ? [
          ...new Set(
            (declared as readonly unknown[]).filter(
              (path): path is string => typeof path === 'string' && attributed.has(path)
            )
          ),
        ].sort()
      : [];
    // Emptiness is tested BEFORE identity, and the order is load-bearing: a
    // reported `secondaryPaths: []` is trivially identical to its own repair, so
    // an identity-first check returns it unchanged and the key survives. `[]` is
    // not a spelling of "nothing is secondary" — the canonical form is key-absent
    // (INV-1), and the seam owes SF-11 that guarantee even though an empty mark
    // demotes nothing.
    if (repaired.length === 0) {
      const { secondaryPaths: _dropped, ...rest } = entry;
      return rest;
    }
    // Reference identity is preserved unless the mark actually changed (SF-5 INV-24).
    if (
      Array.isArray(declared) &&
      declared.length === repaired.length &&
      repaired.every((path, index) => declared[index] === path)
    ) {
      return entry;
    }
    return { ...entry, secondaryPaths: repaired };
  }

  const { secondaryPaths: _dropped, ...rest } = entry as typeof entry & {
    readonly secondaryPaths?: unknown;
  };
  return rest;
}

/**
 * Narrows a package's reported provenance to what the app can act on.
 *
 * Rule, decided once (SF-5 INV-3): DROP PER ENTRY, KEEP THE REST. An entry is
 * kept iff core's `isProvenanceEntry` accepts it and every recorded path
 * parses. A file whose `entries` is not an array is dropped whole; a file
 * whose entries were all dropped stays as `{ entries: [] }` so coverage
 * reasoning downstream is about the generator, not this filter. At most one
 * `logger.warn` per generation, carrying counts and one file key — never a
 * recorded path or entry body (INV-9, INV-25). Returns `undefined` only when
 * `hasProvenance(result)` is false; an all-dropped result is `{ files: {} }`,
 * because "recorded nothing readable" is still "the generator records" (INV-8).
 *
 * Why not null-the-whole like `toImportLinks`: an import-link table with a bad
 * language is unusable as a whole; a provenance result with one bad entry
 * still truthfully describes every other file, and nulling it would turn one
 * template slip into zero affordances on every field.
 *
 * A malformed significance mark is REPAIRED, never a reason to drop: it has no
 * influence on which entries survive, so a presentational hint can never cost
 * the user a site (see `repairSecondaryPaths`). Repairs are counted separately
 * and never folded into `droppedEntries` — a repaired entry was not dropped,
 * and overloading the count would make the diagnostic assert something false.
 *
 * Reads only; the returned containers are fresh, the kept entry objects are the
 * package's own by reference (INV-24) — except an entry whose mark needed
 * repair, which is a fresh object equal to the input in every other member.
 */
function toProvenance(result: GenerationResult): ProvenanceResult | undefined {
  if (!hasProvenance(result)) return undefined;

  const files: Record<string, FileProvenance> = {};
  let droppedEntries = 0;
  let droppedFiles = 0;
  let repairedMarks = 0;
  let firstOffendingKey: string | undefined;

  for (const [filePath, reported] of Object.entries<unknown>(result.provenance.files)) {
    const entries: unknown =
      typeof reported === 'object' && reported !== null
        ? (reported as { entries?: unknown }).entries
        : undefined;
    if (!Array.isArray(entries)) {
      droppedFiles += 1;
      firstOffendingKey ??= filePath;
      continue;
    }

    const kept: ProvenanceEntry[] = [];
    for (const entry of entries as readonly unknown[]) {
      if (isProvenanceEntry(entry) && hasParsablePaths(entry)) {
        const repaired = repairSecondaryPaths(entry);
        if (repaired !== entry) {
          repairedMarks += 1;
          firstOffendingKey ??= filePath;
        }
        kept.push(repaired);
      } else {
        droppedEntries += 1;
        firstOffendingKey ??= filePath;
      }
    }
    files[filePath] = { entries: kept };
  }

  if (droppedEntries > 0 || droppedFiles > 0 || repairedMarks > 0) {
    logger.warn(
      'CodegenLoader',
      `Ignoring unreadable provenance: ${droppedEntries} entries and ${droppedFiles} files dropped, ${repairedMarks} significance marks repaired (first at ${JSON.stringify(firstOffendingKey)}).`
    );
  }

  return { files };
}

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
  getUpstreamImportLinks?: () => ReportedImportLinks;
  getGeneratedFileKind?: (path: string) => string;
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
 *   3. `recordProvenance: true`, only when the call site asked for it. The
 *      two-argument form produces an object byte-identical to before SF-5,
 *      so the ZIP path and the no-request path are unchanged (SF-5 INV-4).
 *
 * Returns `undefined` when there is nothing to pass so the underlying
 * package's own defaults remain active.
 */
function buildGenerateOptions(
  base: RuntimeGenerateOptions | undefined,
  onProgress: ProgressCallback | undefined,
  recordProvenance?: boolean
): GenerateOptions | undefined {
  if (!base && !onProgress && recordProvenance !== true) return undefined;
  return {
    ...base,
    ...(onProgress ? { onProgress } : {}),
    ...(recordProvenance === true ? { recordProvenance: true } : {}),
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
      ? () => toImportLinks(pkg.getUpstreamImportLinks!())
      : undefined,

    // INV-4: path only — kind is layout, not a generation. Do not forward
    // baseGenerateOptions. INV-5: narrow per path; do not drop the file.
    // INV-6: no try/catch; a throw here is a package bug.
    getGeneratedFileKind: pkg.getGeneratedFileKind
      ? (path) => toGeneratedFileKind(pkg.getGeneratedFileKind!(path))
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
      // SF-5 INV-2: `recordProvenance` is forwarded verbatim and is the single switch.
      const generateOptions = buildGenerateOptions(
        baseGenerateOptions,
        onProgressFrom(options?.onStatus),
        options?.recordProvenance
      );

      // INV-4 / INV-9 / INV-15 / INV-19: one generate dispatch, never validate()
      // and never generateZip.
      const generateFn =
        options?.includeIdentitySupport && pkg.generateWithIdentitySupport
          ? pkg.generateWithIdentitySupport.bind(pkg)
          : pkg.generate.bind(pkg);

      try {
        const result = generateFn(config, generateOptions);
        // SF-5 INV-2: detection is field presence on *this* result, and only when
        // asked — a package that records unconditionally is not "supported"
        // until requested. A throwing `provenance` getter is a package bug of
        // the same class as `generate` throwing and surfaces through
        // `toCodegenError` below (SF-5 INV-7).
        const provenance = options?.recordProvenance === true ? toProvenance(result) : undefined;
        // INV-1 / INV-2 / INV-20: return package files as-is, no prefix, no clone.
        // SF-5 INV-1: two literals, so absence is key-absence, never `undefined`.
        return provenance === undefined
          ? { files: result.files }
          : { files: result.files, provenance };
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
