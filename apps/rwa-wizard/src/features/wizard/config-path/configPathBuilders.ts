import type {
  ClaimTopic,
  ComplianceModuleSelection,
  OperatorRole,
  OwnershipModel,
  TrustedIssuer,
} from '@openzeppelin/rwa-config';

import type { ConfigPath } from './configPath';

/** Scalars and booleans — constant paths, one per unlocked asset-step input. INV-12. */
export const tokenPaths = Object.freeze({
  name: 'token.name',
  symbol: 'token.symbol',
  decimals: 'token.decimals',
  initialSupply: 'token.initialSupply',
  documentManagerEnabled: 'token.documentManager.enabled',
} as const satisfies Record<string, ConfigPath>);

/** The ownership discriminant is a real location the generator reads. INV-12. */
export const ownershipTypePath = 'accessControl.ownership.type' satisfies ConfigPath;

/**
 * Feature-control toggles, from the structural meta id. The id *is* the config
 * member name. Only called for unlocked metas — locked ones render no input
 * and are never wrapped (INV-3). The id is not validated here; the registry
 * test guards INV-6.
 */
export function administrativeControlPath(controlId: string): ConfigPath {
  return `token.administrativeControls.${controlId}` as ConfigPath;
}

export function identityControlPath(controlId: string): ConfigPath {
  return `identityVerification.controls.${controlId}` as ConfigPath;
}

/**
 * Variant member: the address input's path follows the selected variant even
 * though the DOM node does not change. Exhaustive — adding a variant to
 * `OwnershipModel` fails to compile here first. INV-10.
 */
export function ownershipAddressPath(model: OwnershipModel): ConfigPath {
  switch (model.type) {
    case 'single-owner':
      return 'accessControl.ownership.ownerAddress';
    case 'multi-sig':
    case 'dao':
      return 'accessControl.ownership.address';
    default: {
      const exhaustive: never = model;
      return exhaustive;
    }
  }
}

// Indexed entries — the index is the entry's position in the current config. INV-11.

export function trustedIssuerAddressPath(index: number): ConfigPath {
  return `identityVerification.trustedIssuers[${index}].address`;
}

/** The whole nested array: the pills collectively edit one value (design decision 7). */
export function trustedIssuerClaimTopicsPath(index: number): ConfigPath {
  return `identityVerification.trustedIssuers[${index}].claimTopics`;
}

export function claimTopicPath(index: number): ConfigPath {
  return `identityVerification.claimTopics[${index}]`;
}

/**
 * The whole issuer entry, for controls that add or remove an issuer rather than
 * edit a member. Mirrors `moduleEntryPath`. INV-11.
 */
export function trustedIssuerPath(index: number): ConfigPath {
  return `identityVerification.trustedIssuers[${index}]`;
}

export function moduleEntryPath(index: number): ConfigPath {
  return `compliance.modules[${index}]`;
}

export function moduleConfigFieldPath(index: number, fieldKey: string): ConfigPath {
  return `compliance.modules[${index}].config.${fieldKey}`;
}

export function roleAddressesPath(index: number): ConfigPath {
  return `accessControl.roles[${index}].addresses`;
}

// Pending-entry index: the position an entry keyed by id occupies now, or the
// position it would occupy when the wizard's append handler adds it (the array
// length). Each reads exactly the array and the id, so a memo over one has
// exactly those two inputs (INV-15). Never -1, never throws. INV-8.

function pendingIndex<T>(entries: readonly T[], matches: (entry: T) => boolean): number {
  const index = entries.findIndex(matches);
  return index === -1 ? entries.length : index;
}

export function moduleIndex(
  modules: readonly ComplianceModuleSelection[],
  moduleId: string
): number {
  return pendingIndex(modules, (entry) => entry.moduleId === moduleId);
}

export function roleIndex(roles: readonly OperatorRole[], roleName: string): number {
  return pendingIndex(roles, (role) => role.name === roleName);
}

export function claimTopicIndex(topics: readonly ClaimTopic[], topicId: number): number {
  return pendingIndex(topics, (topic) => topic.id === topicId);
}

export function nextTrustedIssuerIndex(issuers: readonly TrustedIssuer[]): number {
  return issuers.length;
}

/**
 * Position of the issuer with this address, or the position it would occupy if
 * appended. Keyed by address rather than by render index because the index is
 * draft state and goes stale the moment an earlier issuer is removed, whereas
 * the address is already the React key and is uniqueness-guarded by
 * `TrustedIssuersSection`'s `isDuplicate`. Mirrors `moduleIndex` / `roleIndex`:
 * never -1, never throws. INV-8.
 */
export function trustedIssuerIndex(issuers: readonly TrustedIssuer[], address: string): number {
  return pendingIndex(issuers, (issuer) => issuer.address === address);
}
