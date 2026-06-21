import type { RWAConfig } from '@openzeppelin/rwa-config';

import { resolveStellarDeploymentTarget } from '../deployment/target';

/** Hardcoded demo Ed25519 key pair — testnet education only, never use in production. */
export const DEMO_SIGNING_SECRET_HEX =
  '0000000000000000000000000000000000000000000000000000000000000000';
export const DEMO_SIGNING_PUBLIC_KEY_HEX =
  '3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29';

/** Ed25519 claim scheme id used by upstream identity contracts. */
export const DEMO_ED25519_SCHEME = 101;

/** Demo holder country (Switzerland / CH) for IRS country profile registration. */
export const DEMO_COUNTRY_CODE = 756;

export function hasConfiguredInitialSupply(config: RWAConfig): boolean {
  const { initialSupply } = config.token;
  if (initialSupply === undefined) return false;
  return initialSupply.trim().length > 0;
}

/**
 * Scope A demo auto-mint script is emitted only for testnet exports with a
 * configured initial supply and identity scaffolding enabled at generation time.
 */
export function isDemoAutoMintEligible(config: RWAConfig): boolean {
  if (!hasConfiguredInitialSupply(config)) return false;

  const deployment = resolveStellarDeploymentTarget(config.deployment.target);
  return deployment.networkFlag.includes('testnet');
}
