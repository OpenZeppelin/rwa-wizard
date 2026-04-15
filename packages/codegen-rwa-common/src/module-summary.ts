import type { ComplianceModuleSelection } from '@openzeppelin/rwa-config';

export interface ModuleSummaryConfigField {
  key: string;
}

export interface ModuleSummaryReview {
  state: 'stable' | 'under-review';
  prUrl?: string;
}

export interface ModuleSummarySource {
  id: string;
  name: string;
  requiredHooks: readonly string[];
  configFields: readonly ModuleSummaryConfigField[];
  review: ModuleSummaryReview;
}

export interface SelectedModuleSummary {
  id: string;
  name: string;
  hooks: string[];
  configSummary: string;
  reviewSummary: string;
}

export interface UnderReviewModuleSummary {
  id: string;
  name: string;
  prUrl?: string;
}

/**
 * Deduplicate module selections by moduleId while preserving first-seen order.
 */
export function getUniqueModuleSelections(
  selections: readonly ComplianceModuleSelection[]
): ComplianceModuleSelection[] {
  const byId = new Map<string, ComplianceModuleSelection>();

  for (const selection of selections) {
    if (!byId.has(selection.moduleId)) {
      byId.set(selection.moduleId, selection);
    }
  }

  return [...byId.values()];
}

/**
 * Render one module config value into a concise display string.
 */
export function formatModuleConfigValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).join(', ');
  }

  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Format module config values into a concise human-readable summary.
 */
export function formatModuleConfigSummary(
  config: Record<string, unknown>,
  preferredKeys: readonly string[]
): string {
  const configKeys = Object.keys(config);
  if (configKeys.length === 0) {
    return 'None';
  }

  const remainingKeys = configKeys.filter((key) => !preferredKeys.includes(key)).sort();
  const orderedKeys = [...preferredKeys.filter((key) => key in config), ...remainingKeys];
  const parts = orderedKeys.flatMap((key) => {
    const value = config[key];
    if (value === undefined || value === null) {
      return [];
    }

    if (typeof value === 'string' && value.trim().length === 0) {
      return [];
    }

    if (Array.isArray(value) && value.length === 0) {
      return [];
    }

    return [`\`${key}=${formatModuleConfigValue(value)}\``];
  });

  return parts.length > 0 ? parts.join(', ') : 'None';
}

/**
 * Render a review summary suitable for compact README/CLI tables.
 */
export function formatModuleReviewSummary(review: ModuleSummaryReview): string {
  if (review.state === 'under-review') {
    return review.prUrl ? `Under review ([PR](${review.prUrl}))` : 'Under review';
  }

  return 'Stable';
}

/**
 * Build summary rows for selected compliance modules.
 */
export function getSelectedModuleSummaries(
  selections: readonly ComplianceModuleSelection[],
  resolveModule: (moduleId: string) => ModuleSummarySource | undefined
): SelectedModuleSummary[] {
  return getUniqueModuleSelections(selections).flatMap((selection) => {
    const entry = resolveModule(selection.moduleId);
    if (!entry) {
      return [];
    }

    return [
      {
        id: entry.id,
        name: entry.name,
        hooks: [...entry.requiredHooks],
        configSummary: formatModuleConfigSummary(
          selection.config ?? {},
          entry.configFields.map((field) => field.key)
        ),
        reviewSummary: formatModuleReviewSummary(entry.review),
      },
    ];
  });
}

/**
 * Return unique under-review modules selected in the config.
 */
export function getUnderReviewModules(
  selections: readonly ComplianceModuleSelection[],
  resolveModule: (moduleId: string) => ModuleSummarySource | undefined
): UnderReviewModuleSummary[] {
  return getUniqueModuleSelections(selections).flatMap((selection) => {
    const entry = resolveModule(selection.moduleId);
    if (!entry || entry.review.state !== 'under-review') {
      return [];
    }

    return [
      {
        id: entry.id,
        name: entry.name,
        prUrl: entry.review.prUrl,
      },
    ];
  });
}
