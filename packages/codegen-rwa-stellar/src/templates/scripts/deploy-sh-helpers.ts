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

/**
 * Build a shell-safe `stellar contract invoke` command.
 */
export function buildInvokeCommand(
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
