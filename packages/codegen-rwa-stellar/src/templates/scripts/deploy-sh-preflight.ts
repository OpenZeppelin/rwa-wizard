import type { RWAConfig } from '@openzeppelin/rwa-config';

import { resolveStellarDeploymentTarget } from '../../deployment/target';
import { shellEcho, shellEscape, type DeployedContract } from './deploy-sh-helpers';

function wasmArtifactPath(crateName: string): string {
  return `target/wasm32v1-none/release/${crateName.replace(/-/g, '_')}.wasm`;
}

/**
 * Parse `--preflight` from script arguments to validate readiness without deploying.
 */
export function buildArgumentParsing(): string[] {
  return [
    'PREFLIGHT_ONLY=false',
    'for __deploy_arg in "$@"; do',
    '  case "$__deploy_arg" in',
    '    --preflight)',
    '      PREFLIGHT_ONLY=true',
    '      ;;',
    '  esac',
    'done',
    'unset __deploy_arg',
  ];
}

/**
 * Verify expected WASM artifacts exist (user must run build.sh first).
 */
export function buildWasmPreflightCheck(crateNames: readonly string[]): string[] {
  const lines: string[] = [];
  lines.push('verify_wasm_artifacts() {');
  lines.push('  local missing=0');
  for (const crateName of crateNames) {
    const wasmPath = wasmArtifactPath(crateName);
    lines.push(`  if [ ! -f "${wasmPath}" ]; then`);
    lines.push(`    echo "  ✗ Missing ${wasmPath}"`);
    lines.push('    missing=1');
    lines.push('  fi');
  }
  lines.push('  if [ "$missing" -ne 0 ]; then');
  lines.push('    echo ""');
  lines.push('    echo "Run ./scripts/build.sh first to compile workspace contracts."');
  lines.push('    exit 1');
  lines.push('  fi');
  lines.push('}');
  lines.push('');
  lines.push('verify_wasm_artifacts');
  return lines;
}

/**
 * Exit successfully after preflight when `--preflight` was passed.
 */
export function buildPreflightExit(): string[] {
  return [
    'if [ "$PREFLIGHT_ONLY" = true ]; then',
    '  echo ""',
    shellEcho('  ✓ Preflight checks passed — ready to deploy.'),
    '  echo "    Run ./scripts/deploy.sh without --preflight to deploy."',
    '  exit 0',
    'fi',
  ];
}

/**
 * Write deployed contract addresses to `deployment-manifest.json` after success.
 */
export function buildDeploymentManifestWrite(
  contracts: readonly DeployedContract[],
  config: RWAConfig
): string[] {
  const deployment = resolveStellarDeploymentTarget(config.deployment.target);
  const shellSafeNetwork = shellEscape(deployment.displayName);
  const shellSafeTokenName = shellEscape(config.token.name);
  const shellSafeTokenSymbol = shellEscape(config.token.symbol);

  const contractJsonLines = contracts.map(
    (contract) => `    "${contract.varName}": "$${contract.varName}"`
  );

  return [
    'write_deployment_manifest() {',
    '  cat > deployment-manifest.json <<MANIFEST',
    '{',
    `  "network": "${shellSafeNetwork}",`,
    `  "tokenName": "${shellSafeTokenName}",`,
    `  "tokenSymbol": "${shellSafeTokenSymbol}",`,
    '  "admin": "$ADMIN",',
    '  "manager": "$MANAGER",',
    '  "deploySigner": "$SOURCE_ACCOUNT",',
    '  "adminSigner": "$ADMIN_SOURCE_ACCOUNT",',
    '  "managerSigner": "$MANAGER_SOURCE_ACCOUNT",',
    '  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",',
    '  "contracts": {',
    contractJsonLines.join(',\n'),
    '  }',
    '}',
    'MANIFEST',
    '  echo ""',
    shellEcho('  ✓ Wrote deployment-manifest.json'),
    '}',
    'write_deployment_manifest',
  ];
}
