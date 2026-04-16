import { getAdditionalRoleAssignments, getManagerAddress } from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { roleSymbolToRustIdentifier } from '../../access-control';
import { generateRoleSymbol } from '../../constants';
import { shellEscape } from './deploy-sh-helpers';

const roleResolutionOptions = { generateRoleSymbol };

function serializeAddressVectorArg(addresses: readonly string[]): string {
  const json = `[${addresses.map((address) => JSON.stringify(address)).join(', ')}]`;
  return `"${shellEscape(json)}"`;
}

export function getManagerDeploymentAddress(config: RWAConfig): string {
  return getManagerAddress(config, roleResolutionOptions);
}

/**
 * Build the RWA token constructor argument list for `deploy.sh`.
 */
export function buildTokenConstructorArgs(config: RWAConfig): string {
  const args: string[] = [];
  args.push(`--name "${shellEscape(config.token.name)}"`);
  args.push(`--symbol "${shellEscape(config.token.symbol)}"`);
  args.push('--admin "$ADMIN"');
  args.push('--manager "$MANAGER"');
  args.push('--compliance "$COMPLIANCE_ADDRESS"');
  args.push('--identity_verifier "$IDENTITY_VERIFIER_ADDRESS"');

  for (const role of getAdditionalRoleAssignments(config, roleResolutionOptions)) {
    args.push(
      `--${roleSymbolToRustIdentifier(role.symbol)} ${serializeAddressVectorArg(role.addresses)}`
    );
  }

  return args.join(' \\\n  ');
}
