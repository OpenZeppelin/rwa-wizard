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
 * The first configured role that `matches` and has at least one member address.
 *
 * Prefer this over `getResolvedRoleAssignments(config, options).find(...)`
 * whenever the question is about ONE role. That helper normalizes every role
 * before the caller filters, so asking "which role guards `mint`?" reads every
 * role's name, symbol AND member addresses. Under provenance recording those
 * reads become dependencies of whatever the caller emits next — which is how
 * every method guard in the RWA token contract came to claim an operator
 * address that cannot move a single line in that file.
 *
 * `matches` receives the raw role, so a caller comparing only names reads only
 * names; the matched role alone has its symbol and addresses read.
 *
 * The first matching role with members wins, exactly as filter-then-find did.
 * The one behavioural difference is the order in which a misconfigured role is
 * rejected: a symbol-less role reached before the match is now resolved (and so
 * may throw when no `generateRoleSymbol` is supplied) before its member list is
 * consulted. Every caller in this repository supplies one, so the path is
 * unreachable here, and it fails earlier rather than differently.
 */
export function findRoleWithMembers(
  config: AccessControlledConfig,
  matches: (role: OperatorRole) => boolean,
  options?: RoleResolutionOptions
): ResolvedRoleAssignment | undefined {
  const roles = config.accessControl.roles;

  for (let index = 0; index < roles.length; index += 1) {
    const role = roles[index];
    if (!matches(role)) continue;

    const addresses = getRoleAddresses(role.addresses);
    if (addresses.length === 0) continue;

    return { name: role.name, symbol: resolveRoleSymbol(role, options), addresses };
  }

  return undefined;
}

/**
 * Resolve the manager address, defaulting to the admin when no manager exists.
 */
export function getManagerAddress(
  config: AccessControlledConfig,
  options?: RoleResolutionOptions
): string {
  const managerRole = findRoleWithMembers(config, (role) => isManagerRole(role, options), options);

  return managerRole?.addresses[0] ?? getAdminAddress(config);
}

/** The manager role is wired by name, not granted like the operator roles. */
function isManagerRole(role: OperatorRole, options?: RoleResolutionOptions): boolean {
  return resolveRoleSymbol(role, options) === 'manager' || role.name.toLowerCase() === 'manager';
}

/**
 * Return configured role assignments excluding the manager role.
 *
 * The manager is excluded before its member list is read, so a role that never
 * reaches the constructor does not attribute its addresses to the roles that
 * do. Filtering after `getResolvedRoleAssignments` would normalize every role's
 * addresses first, and the emitted role constants — which contain no manager
 * address and cannot move when one changes — would claim them.
 */
export function getAdditionalRoleAssignments(
  config: AccessControlledConfig,
  options?: RoleResolutionOptions
): ResolvedRoleAssignment[] {
  const roles = config.accessControl.roles;
  const assignments: ResolvedRoleAssignment[] = [];

  for (let index = 0; index < roles.length; index += 1) {
    const role = roles[index];
    if (isManagerRole(role, options)) continue;

    const addresses = getRoleAddresses(role.addresses);
    if (addresses.length === 0) continue;

    assignments.push({ name: role.name, symbol: resolveRoleSymbol(role, options), addresses });
  }

  return assignments;
}
