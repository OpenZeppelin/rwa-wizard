/**
 * Escape a string for safe embedding inside double-quoted shell strings.
 * Prevents shell injection via user-controlled config values.
 */
export function shellEscape(value: string): string {
  return value.replace(/[\\"$`!]/g, '\\$&');
}

export const SEPARATOR = '═══════════════════════════════════════════════════════════════';
export const THIN_SEPARATOR = '───────────────────────────────────────────────────────────────';

/**
 * Bash variable references for ANSI colors.
 * The actual escape codes are defined by {@link buildColorPreamble} at the top of the script.
 */
export const CLR = {
  bold: '${BOLD}',
  dim: '${DIM}',
  green: '${GREEN}',
  red: '${RED}',
  cyan: '${CYAN}',
  yellow: '${YELLOW}',
  rst: '${RST}',
} as const;

export interface DeployedContract {
  name: string;
  varName: string;
}

/**
 * Shell preamble that defines ANSI color variables.
 * Colors are automatically disabled when stdout is not a terminal (piped output).
 */
export function buildColorPreamble(): string[] {
  return [
    'if [ -t 1 ]; then',
    "  BOLD=$'\\033[1m'    DIM=$'\\033[2m'",
    "  GREEN=$'\\033[32m'  RED=$'\\033[31m'  CYAN=$'\\033[36m'  YELLOW=$'\\033[33m'",
    "  RST=$'\\033[0m'",
    'else',
    "  BOLD='' DIM='' GREEN='' RED='' CYAN='' YELLOW='' RST=''",
    'fi',
  ];
}

/**
 * Emit an `echo "..."` command for content that is already shell-safe.
 *
 * Escape any user-controlled text with `shellEscape()` before passing it here.
 * Leave ANSI placeholders and runtime shell variables unescaped when they are
 * intentionally meant to expand during script execution.
 */
export function shellEcho(msg: string): string {
  return `echo "${msg}"`;
}

/** Wrap text in backticks safe for double-quoted bash `echo` (avoids command substitution). */
export function shellBacktickLiteral(text: string): string {
  return '\\`' + text + '\\`';
}

export function shellEchoRaw(msg: string): string {
  return `echo '${msg}'`;
}

/**
 * Build a section header. `title` must already be safe for double-quoted echo output.
 */
export function shellSection(title: string): string[] {
  return [
    'echo ""',
    'echo ""',
    shellEcho(`${CLR.bold}${CLR.cyan}${SEPARATOR}${CLR.rst}`),
    shellEcho(`${CLR.bold}${CLR.cyan}  ${title}${CLR.rst}`),
    shellEcho(`${CLR.bold}${CLR.cyan}${SEPARATOR}${CLR.rst}`),
    'echo ""',
  ];
}

/**
 * Build a subsection header. `title` must already be safe for double-quoted echo output.
 */
export function shellSubsection(title: string): string[] {
  return [
    'echo ""',
    shellEcho(`${CLR.bold}${THIN_SEPARATOR}${CLR.rst}`),
    shellEcho(`${CLR.bold}  ${title}${CLR.rst}`),
    shellEcho(`${CLR.bold}${THIN_SEPARATOR}${CLR.rst}`),
  ];
}

export function renderExplorerUrlForEcho(explorerUrlTemplate: string, varName: string): string {
  const contractAddressSentinel = '__CONTRACT_ADDRESS_SENTINEL__';
  return shellEscape(
    explorerUrlTemplate.replace('__CONTRACT_ADDRESS__', contractAddressSentinel)
  ).replace(contractAddressSentinel, `\${${varName}}`);
}

function buildExplorerLine(explorerUrlTemplate: string | undefined, varName: string): string {
  if (!explorerUrlTemplate) return '';
  return shellEcho(
    `${CLR.dim}    Explorer: ${renderExplorerUrlForEcho(explorerUrlTemplate, varName)}${CLR.rst}`
  );
}

function buildDeployCommand(
  crateName: string,
  constructorArgs: string,
  networkFlag: string
): string {
  return `stellar contract deploy \\
  --source-account "$SOURCE_ACCOUNT" \\
  --wasm target/wasm32v1-none/release/${crateName.replace(/-/g, '_')}.wasm \\
  ${networkFlag} \\
  -- \\
  ${constructorArgs}`;
}

/**
 * Build a shell section that deploys one contract and captures its address.
 *
 * @param stepLabel - Optional progress label like `[1/4]` shown before the contract name.
 */
export function buildDeploySection(
  varName: string,
  displayName: string,
  crateName: string,
  constructorArgs: string,
  networkFlag: string,
  explorerUrlTemplate: string | undefined,
  stepLabel?: string
): string {
  const lines: string[] = [];
  const prefix = stepLabel ? `${stepLabel} ` : '';
  const shellSafeDisplayName = shellEscape(displayName);

  lines.push(shellEcho(`${CLR.bold}  ${prefix}Deploying ${shellSafeDisplayName} ...${CLR.rst}`));
  lines.push(`${varName}=$(${buildDeployCommand(crateName, constructorArgs, networkFlag)})`);
  lines.push(`if [ $? -ne 0 ] || [ -z "$${varName}" ]; then`);
  lines.push(
    `  echo "${CLR.red}  ✗ Failed to deploy ${shellSafeDisplayName} (${crateName})${CLR.rst}"`
  );
  lines.push('  exit 1');
  lines.push('fi');
  lines.push(shellEcho(`${CLR.green}  ✓ ${shellSafeDisplayName}: \${${varName}}${CLR.rst}`));
  const explorerLine = buildExplorerLine(explorerUrlTemplate, varName);
  if (explorerLine) {
    lines.push(explorerLine);
  }

  return lines.join('\n');
}

/** Which configured Stellar CLI identity should sign an invoke transaction. */
export type InvokeSignerRole = 'admin' | 'manager' | 'deploy';

function resolveInvokeSourceAccountVar(role: InvokeSignerRole): string {
  switch (role) {
    case 'admin':
      return '$ADMIN_SOURCE_ACCOUNT';
    case 'manager':
      return '$MANAGER_SOURCE_ACCOUNT';
    case 'deploy':
      return '$SOURCE_ACCOUNT';
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

/**
 * Build a shell-safe `stellar contract invoke` command.
 *
 * Post-deploy calls must sign with the CLI identity that controls the on-chain
 * `operator` address (manager role) or the contract admin, not always the
 * deploy payer account.
 */
export function buildInvokeCommand(
  contractAddr: string,
  fnName: string,
  args: string,
  networkFlag: string,
  signerRole: InvokeSignerRole = 'manager'
): string {
  const sourceAccountVar = resolveInvokeSourceAccountVar(signerRole);
  const commandLines = [
    'stellar contract invoke \\',
    `  --id ${contractAddr} \\`,
    `  --source-account "${sourceAccountVar}" \\`,
    `  ${networkFlag} \\`,
    '  -- \\',
    `  ${fnName}`,
  ];

  if (args.trim().length > 0) {
    commandLines[commandLines.length - 1] += ' \\';
    commandLines.push(`  ${args}`);
  }

  return commandLines.join('\n');
}

/**
 * Build a read-only `stellar contract invoke` (`--send no`) for on-chain views.
 */
export function buildViewCommand(
  contractAddr: string,
  fnName: string,
  args: string,
  networkFlag: string
): string {
  const commandLines = [
    'stellar contract invoke \\',
    `  --id ${contractAddr} \\`,
    '  --source-account "$SOURCE_ACCOUNT" \\',
    `  ${networkFlag} \\`,
    '  --send no \\',
    '  -- \\',
    `  ${fnName}`,
  ];

  if (args.trim().length > 0) {
    commandLines[commandLines.length - 1] += ' \\';
    commandLines.push(`  ${args}`);
  }

  return commandLines.join('\n');
}

/**
 * Convert a module id into the shell variable name used in `deploy.sh`.
 */
export function moduleVarName(moduleId: string): string {
  return `MODULE_${moduleId.toUpperCase().replace(/-/g, '_')}_ADDRESS`;
}

/**
 * Bash helpers that resolve Stellar CLI identities to G-addresses and verify
 * configured signers match on-chain admin/manager addresses when they differ.
 */
export function buildRoleSignerPreflightChecks(): string[] {
  return [
    'resolve_cli_identity_address() {',
    '  local identity="$1"',
    '  if [[ "$identity" =~ ^G[A-Z2-7]{55}$ ]]; then',
    '    echo "$identity"',
    '    return 0',
    '  fi',
    '  local resolved',
    '  resolved="$(stellar keys address "$identity" 2>/dev/null | tr -d \'[:space:]\' || true)"',
    '  if [[ "$resolved" =~ ^G[A-Z2-7]{55}$ ]]; then',
    '    echo "$resolved"',
    '    return 0',
    '  fi',
    '  return 1',
    '}',
    '',
    'verify_role_signer() {',
    '  local role_label="$1"',
    '  local expected_address="$2"',
    '  local source_account="$3"',
    '  local resolved',
    '  if ! resolved="$(resolve_cli_identity_address "$source_account")"; then',
    `    echo "${CLR.red}  ✗ Could not resolve Stellar CLI identity for \${role_label}: \${source_account}${CLR.rst}"`,
    '    echo "    Ensure the identity exists (stellar keys generate <name> --fund ...) or pass a G-address directly."',
    '    exit 1',
    '  fi',
    '  if [ "$resolved" != "$expected_address" ]; then',
    `    echo "${CLR.red}  ✗ \${role_label} signer mismatch${CLR.rst}"`,
    '    echo "    Expected on-chain address: $expected_address"',
    '    echo "    CLI identity \\"$source_account\\" resolves to: $resolved"',
    '    echo "    Set ADMIN_SOURCE_ACCOUNT / MANAGER_SOURCE_ACCOUNT to identities that control the configured addresses."',
    '    exit 1',
    '  fi',
    '}',
    '',
    'verify_role_signer "Admin" "$ADMIN" "$ADMIN_SOURCE_ACCOUNT"',
    'verify_role_signer "Manager" "$MANAGER" "$MANAGER_SOURCE_ACCOUNT"',
  ];
}
