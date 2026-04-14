import { DEFAULT_ROLE_SYMBOLS, type OperatorRole, type RWAConfig } from '@openzeppelin/rwa-config';

export interface ResolvedRoleAssignment {
  name: string;
  symbol: string;
  address: string;
}

export interface RoleResolutionOptions {
  generateRoleSymbol?: (roleName: string) => string;
}

type AccessControlledConfig = Pick<RWAConfig, 'accessControl'>;

/**
 * Pick the first non-empty address configured for a role.
 */
function getSingleRoleAddress(addresses: readonly string[]): string | undefined {
  return addresses.find((address) => address.trim().length > 0);
}

/**
 * Resolve the effective symbol for a configured operator role.
 */
function resolveRoleSymbol(role: OperatorRole, options?: RoleResolutionOptions): string {
  const explicitSymbol = role.symbol?.trim();
  if (explicitSymbol) {
    return explicitSymbol;
  }

  const defaultSymbol = DEFAULT_ROLE_SYMBOLS[role.name.trim().toLowerCase()];
  if (defaultSymbol) {
    return defaultSymbol;
  }

  if (!options?.generateRoleSymbol) {
    throw new Error(
      `Role "${role.name}" is missing a symbol and no role symbol generator was provided.`
    );
  }

  return options.generateRoleSymbol(role.name);
}

/**
 * Resolve the effective admin address from the configured ownership model.
 */
export function getAdminAddress(config: AccessControlledConfig): string {
  const ownership = config.accessControl.ownership;
  return ownership.type === 'single-owner' ? ownership.ownerAddress : ownership.address;
}

/**
 * Normalize configured roles into symbol and address assignments.
 */
export function getResolvedRoleAssignments(
  config: AccessControlledConfig,
  options?: RoleResolutionOptions
): ResolvedRoleAssignment[] {
  return config.accessControl.roles.flatMap((role) => {
    const address = getSingleRoleAddress(role.addresses);
    if (!address) {
      return [];
    }

    return [
      {
        name: role.name,
        symbol: resolveRoleSymbol(role, options),
        address,
      },
    ];
  });
}

/**
 * Resolve the manager address, defaulting to the admin when no manager exists.
 */
export function getManagerAddress(
  config: AccessControlledConfig,
  options?: RoleResolutionOptions
): string {
  const managerRole = getResolvedRoleAssignments(config, options).find(
    (role) => role.symbol === 'manager' || role.name.toLowerCase() === 'manager'
  );

  return managerRole?.address ?? getAdminAddress(config);
}

/**
 * Return configured role assignments excluding the manager role.
 */
export function getAdditionalRoleAssignments(
  config: AccessControlledConfig,
  options?: RoleResolutionOptions
): ResolvedRoleAssignment[] {
  return getResolvedRoleAssignments(config, options).filter(
    (role) => role.symbol !== 'manager' && role.name.toLowerCase() !== 'manager'
  );
}
