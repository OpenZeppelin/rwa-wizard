import { DEFAULT_WIZARD_NETWORK_ID } from '../../utils/defaultRwaConfig';

export { DEFAULT_WIZARD_NETWORK_ID };

/**
 * Path to the codegen wizard for a deployment network (adapter `NetworkConfig.id`).
 */
export function wizardPath(networkId: string): string {
  return `/wizard/${encodeURIComponent(networkId)}`;
}

/**
 * Returns the `networkId` path segment for `/wizard/:networkId`, or `null` if the pathname is not a wizard route.
 */
export function parseWizardNetworkSegment(pathname: string): string | null {
  const match = pathname.match(/^\/wizard\/([^/]+)\/?$/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export function isWizardRoutePath(pathname: string): boolean {
  return parseWizardNetworkSegment(pathname) !== null;
}

/**
 * Default `/wizard/...` network for a chain target when starting a new project.
 * Extend when additional ecosystems ship with known default networks.
 */
export function defaultWizardNetworkIdForTarget(targetId: string): string {
  switch (targetId) {
    case 'stellar':
      return DEFAULT_WIZARD_NETWORK_ID;
    case 'evm':
      return DEFAULT_WIZARD_NETWORK_ID;
    default:
      return DEFAULT_WIZARD_NETWORK_ID;
  }
}
