export const SEPARATOR = '═══════════════════════════════════════════════════════════════';
export const THIN_SEPARATOR = '───────────────────────────────────────────────────────────────';

export interface DeployedContract {
  name: string;
  varName: string;
}

export function shellEcho(msg: string): string {
  return `echo "${msg}"`;
}

export function shellEchoRaw(msg: string): string {
  return `echo '${msg}'`;
}

export function shellSection(title: string): string[] {
  return [
    'echo ""',
    shellEcho(SEPARATOR),
    shellEcho(`  ${title}`),
    shellEcho(SEPARATOR),
    'echo ""',
  ];
}

export function shellSubsection(title: string): string[] {
  return ['echo ""', shellEcho(THIN_SEPARATOR), shellEcho(`  ${title}`), shellEcho(THIN_SEPARATOR)];
}

function buildExplorerLine(explorerUrlTemplate: string | undefined, varName: string): string {
  if (!explorerUrlTemplate) return '';
  return shellEcho(
    `  Explorer: ${explorerUrlTemplate.replace('__CONTRACT_ADDRESS__', `\${${varName}}`)}`
  );
}

/**
 * Build the raw `stellar contract deploy` command for a contract crate.
 */
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
 */
export function buildDeploySection(
  varName: string,
  displayName: string,
  crateName: string,
  constructorArgs: string,
  networkFlag: string,
  explorerUrlTemplate: string | undefined
): string {
  const lines: string[] = [];

  lines.push(shellEcho(`  Deploying ${displayName}...`));
  lines.push(`${varName}=$(${buildDeployCommand(crateName, constructorArgs, networkFlag)})`);
  lines.push(`if [ $? -ne 0 ] || [ -z "$${varName}" ]; then`);
  lines.push(`  echo "  ✗ Failed to deploy ${displayName} (${crateName})"`);
  lines.push('  exit 1');
  lines.push('fi');
  lines.push(shellEcho(`  ✓ ${displayName}: \${${varName}}`));
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
