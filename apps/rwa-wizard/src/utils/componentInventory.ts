import type { ComponentInventoryItem } from '../types/wizard';

const SHARED_PACKAGE_PATTERNS = [
  '@openzeppelin/ui-components',
  '@openzeppelin/ui-react',
  '@openzeppelin/ui-renderer',
  '@openzeppelin/ui-styles',
  '@openzeppelin/ui-utils',
  '@openzeppelin/ui-types',
  '@openzeppelin/ui-storage',
];

interface ClassifyInput {
  componentName: string;
  owningFile: string;
  rationale: string;
  classificationOverride?: ComponentInventoryItem['classification'];
  followUpAction?: string;
}

/**
 * Derives a classification for a component based on its owning file path.
 * Components from `@openzeppelin/ui-*` packages are classified as `reused`;
 * app-local components default to `local-candidate` unless overridden.
 */
export function classifyComponent(input: ClassifyInput): ComponentInventoryItem {
  const { componentName, owningFile, rationale, classificationOverride, followUpAction } = input;

  if (classificationOverride) {
    return {
      componentName,
      owningFile,
      classification: classificationOverride,
      rationale,
      followUpAction,
    };
  }

  const isSharedPackage = SHARED_PACKAGE_PATTERNS.some((pkg) => owningFile.includes(pkg));

  return {
    componentName,
    owningFile,
    classification: isSharedPackage ? 'reused' : 'local-candidate',
    rationale,
    followUpAction,
  };
}

/**
 * Returns true when a component is a viable candidate for promotion
 * to the shared `@openzeppelin/ui-components` library.
 */
export function isPromotionCandidate(item: ComponentInventoryItem): boolean {
  return item.classification === 'local-candidate';
}

type ClassificationGroup = Record<
  ComponentInventoryItem['classification'],
  ComponentInventoryItem[]
>;

/** Groups inventory items by their classification for reporting. */
export function groupByClassification(items: ComponentInventoryItem[]): ClassificationGroup {
  const groups: ClassificationGroup = {
    reused: [],
    'local-candidate': [],
    'promoted-shared': [],
  };
  for (const item of items) {
    groups[item.classification].push(item);
  }
  return groups;
}

/** Filters inventory to items eligible for upstream promotion. */
export function getPromotionCandidates(items: ComponentInventoryItem[]): ComponentInventoryItem[] {
  return items.filter(isPromotionCandidate);
}
