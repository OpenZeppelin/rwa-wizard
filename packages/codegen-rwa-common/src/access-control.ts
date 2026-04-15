import { DEFAULT_ROLE_SYMBOLS, type OperatorRole, type RWAConfig } from '@openzeppelin/rwa-config';

export interface ResolvedRoleAssignment {
  name: string;
  symbol: string;
  addresses: string[];
}

export interface RoleResolutionOptions {
  generateRoleSymbol?: (roleName: string) => string;
}

type AccessControlledConfig = Pick<RWAConfig, 'accessControl'>;

/**
 * Normalize configured role members, trimming blanks and preserving order.
 */
function getRoleAddresses(addresses: readonly string[]): string[] {
  return [
    ...new Set(addresses.map((address) => address.trim()).filter((address) => address.length > 0)),
  ];
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
    const addresses = getRoleAddresses(role.addresses);
    if (addresses.length === 0) {
      return [];
    }

    return [
      {
        name: role.name,
        symbol: resolveRoleSymbol(role, options),
        addresses,
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

  return managerRole?.addresses[0] ?? getAdminAddress(config);
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
