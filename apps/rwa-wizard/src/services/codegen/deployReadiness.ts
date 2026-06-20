import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { DeployGuidanceDTO, RwaCodegenService } from './types';

/** Resolve deploy guidance through the active codegen service boundary. */
export function getDeployGuidanceFromService(
  service: RwaCodegenService | null,
  config: RWAConfig
): DeployGuidanceDTO | null {
  return service?.getDeployGuidance?.(config) ?? null;
}

/** Only pass identity scaffolding to generation when the active target supports it on testnet. */
export function resolveIncludeIdentitySupport(
  guidance: DeployGuidanceDTO | null,
  includeIdentitySupport: boolean
): boolean {
  if (!includeIdentitySupport || !guidance) {
    return false;
  }

  return guidance.networkIsTestnet;
}
