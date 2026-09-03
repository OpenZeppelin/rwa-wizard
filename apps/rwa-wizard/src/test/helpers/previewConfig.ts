import { getAvailableModules } from '@openzeppelin/codegen-rwa-stellar';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { PreviewModuleCatalog } from '../../services/preview';
import type {
  StructuralComplianceModuleOption,
  StructuralModuleConfigFieldMeta,
} from '../../types/wizard';
import { createDefaultRwaConfig } from '../../utils/defaultRwaConfig';

/** Stellar account StrKey shape. Preview owner must fail this. */
export const STELLAR_ACCOUNT_STRKEY = /^G[A-Z2-7]{55}$/;

export function completeDraft(overrides: Partial<RWAConfig> = {}): RWAConfig {
  const base = createDefaultRwaConfig();
  return {
    ...base,
    ...overrides,
    token: {
      ...base.token,
      name: 'Acme Token',
      symbol: 'ACM',
      ...(overrides.token ?? {}),
    },
    accessControl: {
      ...base.accessControl,
      ownership: { type: 'single-owner', ownerAddress: 'GCOWNER' },
      ...(overrides.accessControl ?? {}),
    },
  };
}

export function moduleOption(
  partial: Pick<StructuralComplianceModuleOption, 'id'> &
    Partial<Omit<StructuralComplianceModuleOption, 'id'>>
): StructuralComplianceModuleOption {
  return {
    name: partial.name ?? partial.id,
    category: partial.category ?? 'supply-and-balance',
    runtimePrerequisites: partial.runtimePrerequisites ?? [],
    requiredHooks: partial.requiredHooks ?? ['created'],
    review: partial.review ?? { state: 'stable' },
    configFields: partial.configFields ?? [],
    ...partial,
  };
}

export function requiredNumberField(
  key: string,
  placeholder = 'e.g. 1000000'
): StructuralModuleConfigFieldMeta {
  return {
    key,
    label: key,
    type: 'number',
    required: true,
    placeholder,
  };
}

export function optionalStringArrayField(key: string): StructuralModuleConfigFieldMeta {
  return {
    key,
    label: key,
    type: 'string[]',
    required: false,
    placeholder: 'e.g. US, KP',
  };
}

export function stellarPreviewCatalog(): PreviewModuleCatalog {
  return getAvailableModules().map((entry) => ({
    id: entry.id,
    name: entry.name,
    category: entry.category,
    runtimePrerequisites: [...entry.runtimePrerequisites],
    requiredHooks: [...entry.requiredHooks],
    review: {
      state: entry.review.state,
      prUrl: entry.review.prUrl,
    },
    configFields: entry.configFields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      required: field.required,
      placeholder: field.placeholder,
      valueKind: field.valueKind,
    })),
  }));
}

export const supplyLimitCatalog: PreviewModuleCatalog = [
  moduleOption({
    id: 'supply-limit',
    name: 'Supply Limit',
    configFields: [requiredNumberField('limit')],
  }),
];
