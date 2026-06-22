import { getAdminAddress, getUniqueModuleSelections } from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { resolveStellarDeploymentTarget } from '../../deployment/target';
import { getOptionalScalarConfigValue } from '../../modules/descriptors/shared';
import {
  DEMO_COUNTRY_CODE,
  DEMO_ED25519_SCHEME,
  DEMO_SIGNING_PUBLIC_KEY_HEX,
  DEMO_SIGNING_SECRET_HEX,
  hasConfiguredInitialSupply,
  isDemoAutoMintEligible,
} from '../demo-auto-mint';
import {
  DEMO_MINT_COMPLIANCE_HOOK,
  getDemoMintCompliancePreflightIssues,
} from '../demo-mint-compliance-preflight';
import {
  buildColorPreamble,
  buildDeploySection,
  buildInvokeCommand,
  buildRoleSignerPreflightChecks,
  buildViewCommand,
  moduleVarName,
  shellBacktickLiteral,
  shellEcho,
  shellEscape,
  shellSection,
  shellSingleQuoteLiteral,
  shellSubsection,
} from './deploy-sh-helpers';

function buildCountryProfileJson(countryCode: number): string {
  return JSON.stringify([
    {
      country: {
        Individual: {
          Residence: countryCode,
        },
      },
      metadata: null,
    },
  ]);
}

function buildManifestLoader(contractVarNames: readonly string[]): string[] {
  const lines: string[] = [];
  lines.push('load_manifest_field() {');
  lines.push('  local key="$1"');
  lines.push(
    '  grep -o "\\"${key}\\": \\"[^\\"]*\\"" deployment-manifest.json | head -1 | sed \'s/.*: "\\([^"]*\\)"/\\1/\''
  );
  lines.push('}');
  lines.push('');
  lines.push('if [ ! -f deployment-manifest.json ]; then');
  lines.push('  echo "Missing deployment-manifest.json — run ./scripts/deploy.sh first."');
  lines.push('  exit 1');
  lines.push('fi');
  lines.push('');
  lines.push('MANIFEST_NETWORK="$(load_manifest_field network)"');
  for (const varName of contractVarNames) {
    lines.push(`${varName}="$(load_manifest_field ${varName})"`);
    lines.push(`if [ -z "$${varName}" ]; then`);
    lines.push(`  echo "deployment-manifest.json is missing contracts.${varName}"`);
    lines.push('  exit 1');
    lines.push('fi');
  }
  lines.push('ADMIN="$(load_manifest_field admin)"');
  lines.push('MANAGER="$(load_manifest_field manager)"');
  lines.push('if [ -z "$ADMIN" ] || [ -z "$MANAGER" ]; then');
  lines.push('  echo "deployment-manifest.json is missing admin or manager addresses."');
  lines.push('  exit 1');
  lines.push('fi');
  return lines;
}

function buildArgumentParsing(): string[] {
  return [
    'COMPLIANCE_PREFLIGHT_ONLY=false',
    'for __bootstrap_arg in "$@"; do',
    '  case "$__bootstrap_arg" in',
    '    --preflight)',
    '      COMPLIANCE_PREFLIGHT_ONLY=true',
    '      ;;',
    '  esac',
    'done',
    'unset __bootstrap_arg',
  ];
}

function echoSuggestedManagerInvoke(
  lines: string[],
  modVar: string,
  functionName: string,
  args: string,
  networkFlag: string
): void {
  const command = buildInvokeCommand(modVar, functionName, args, networkFlag, 'manager');
  lines.push(shellEcho('    Run this Manager invoke manually, then re-run this script:'));
  for (const commandLine of command.split('\n')) {
    lines.push(`  echo "      ${shellEscape(commandLine)}"`);
  }
}

function buildOnChainLimitReadLines(
  config: RWAConfig,
  networkFlag: string,
  moduleId: 'supply-limit' | 'max-balance',
  viewFn: string,
  shellVar: string,
  configuredLabel: string
): string[] {
  const selection = getUniqueModuleSelections(config.compliance.modules).find(
    (entry) => entry.moduleId === moduleId
  );
  if (!selection) return [];

  const configuredValue = getOptionalScalarConfigValue(
    selection,
    moduleId === 'supply-limit' ? 'limit' : 'maxBalance'
  );
  const modVar = `$${moduleVarName(moduleId)}`;
  const lines: string[] = [];

  lines.push('echo ""');
  lines.push(
    shellEcho(`${'${BOLD}'}  Reading on-chain ${shellEscape(configuredLabel)}...${'${RST}'}`)
  );
  lines.push(
    `${shellVar}=$(${buildViewCommand(modVar, viewFn, '--token "$RWA_TOKEN_ADDRESS"', networkFlag)} 2>/dev/null | grep -Eo '[0-9]+' | tail -1 || true)`
  );
  if (configuredValue) {
    lines.push(
      shellEcho(
        `    Wizard config at generation: ${shellEscape(configuredValue)} · Mint amount: $INITIAL_SUPPLY base units`
      )
    );
  }
  lines.push(shellEcho(`    On-chain value now: $${shellVar} (compare before minting)`));

  return lines;
}

function buildCompliancePreflightSection(config: RWAConfig, networkFlag: string): string[] {
  const issues = getDemoMintCompliancePreflightIssues(config);
  const lines: string[] = [];

  lines.push('extract_numeric_cli_output() {');
  lines.push('  echo "$1" | grep -Eo \'[0-9]+\' | tail -1');
  lines.push('}');
  lines.push('');
  lines.push('verify_compliance_for_demo_mint() {');
  lines.push('  local failed=0');
  lines.push('  echo ""');
  lines.push(
    ...shellSubsection(
      `Compliance preflight — ${shellBacktickLiteral(DEMO_MINT_COMPLIANCE_HOOK)} hook before mint`
    )
  );
  lines.push(
    shellEcho(
      `  Mint runs Compliance modules registered on ${shellBacktickLiteral(DEMO_MINT_COMPLIANCE_HOOK)} in the same transaction.`
    )
  );
  lines.push(
    shellEcho(
      `  Demo mint amount: $INITIAL_SUPPLY base units · Demo IRS country: ${DEMO_COUNTRY_CODE} (CH)`
    )
  );
  lines.push(
    shellEcho(
      '  This script never changes module limits — run the suggested Manager invokes yourself.'
    )
  );

  lines.push(
    ...buildOnChainLimitReadLines(
      config,
      networkFlag,
      'supply-limit',
      'get_supply_limit',
      'ON_CHAIN_SUPPLY_LIMIT',
      'supply limit'
    )
  );
  lines.push(
    ...buildOnChainLimitReadLines(
      config,
      networkFlag,
      'max-balance',
      'get_max_balance',
      'ON_CHAIN_MAX_BALANCE',
      'max balance'
    )
  );

  if (issues.length === 0) {
    lines.push('echo ""');
    lines.push(
      shellEcho(
        `${'${GREEN}'}  ✓ Wizard config has no ${shellBacktickLiteral(DEMO_MINT_COMPLIANCE_HOOK)} conflicts for this demo mint.${'${RST}'}`
      )
    );
    lines.push('  return 0');
    lines.push('}');
    return lines;
  }

  for (const issue of issues) {
    lines.push('echo ""');
    lines.push(shellEcho(`${'${BOLD}'}  ${shellEscape(issue.moduleName)}${'${RST}'}`));
    lines.push(shellEcho(`    ${shellEscape(issue.explanation)}`));

    if (issue.suggestedInvoke) {
      const modVar = `$${moduleVarName(issue.moduleId)}`;
      echoSuggestedManagerInvoke(
        lines,
        modVar,
        issue.suggestedInvoke.functionName,
        issue.suggestedInvoke.args,
        networkFlag
      );
    }

    lines.push('  failed=1');
  }

  lines.push('echo ""');
  lines.push('  if [ "$failed" -ne 0 ]; then');
  lines.push(
    shellEcho(
      `${'${YELLOW}'}  Compliance preflight failed — mint would revert on ${shellBacktickLiteral(DEMO_MINT_COMPLIANCE_HOOK)}.${'${RST}'}`
    )
  );
  lines.push(
    shellEcho(
      '  Fix limits in the wizard and regenerate, or run the Manager invokes printed above, then re-run this script.'
    )
  );
  lines.push('    return 1');
  lines.push('  fi');
  lines.push(shellEcho(`${'${GREEN}'}  ✓ Compliance preflight passed for demo mint.${'${RST}'}`));
  lines.push('  return 0');
  lines.push('}');

  return lines;
}

/**
 * Generates `scripts/bootstrap-demo-mint.sh` — a testnet-only educational script
 * that deploys example claim issuer + identity contracts, onboards Admin, and
 * mints the configured initial supply after `./scripts/deploy.sh`.
 */
export function generateBootstrapDemoMintSh(config: RWAConfig): string {
  if (!isDemoAutoMintEligible(config)) {
    throw new Error('bootstrap-demo-mint.sh requires testnet target and configured initialSupply');
  }

  const deployment = resolveStellarDeploymentTarget(config.deployment.target);
  const networkFlag = deployment.networkFlag;
  const adminAddress = getAdminAddress(config);
  const initialSupply = config.token.initialSupply!;
  const claimTopics = config.identityVerification.claimTopics;
  const topicIds = claimTopics.map((topic) => topic.id);
  const topicsBashList = topicIds.join(' ');
  const topicsJson = `[${topicIds.join(', ')}]`;
  const countryProfileJson = buildCountryProfileJson(DEMO_COUNTRY_CODE);

  const contractVarNames = [
    'CTI_ADDRESS',
    'IRS_ADDRESS',
    'RWA_TOKEN_ADDRESS',
    ...getUniqueModuleSelections(config.compliance.modules).map((selection) =>
      moduleVarName(selection.moduleId)
    ),
  ];

  const sections: string[] = [];
  sections.push('#!/bin/bash');
  sections.push('set -e');
  sections.push('');
  sections.push(...buildColorPreamble());
  sections.push('');
  sections.push(...buildArgumentParsing());
  sections.push('');
  sections.push(...shellSection('Demo Auto-Mint Bootstrap (TESTNET ONLY — NOT PRODUCTION KYC)'));
  sections.push(
    shellEcho(
      '  Educational Scope A: deploy example claim issuer, onboard Admin with demo claims, mint initialSupply.'
    )
  );
  sections.push(
    shellEcho('  Uses a hardcoded demo Ed25519 signing key — never use this flow in production.')
  );
  sections.push(
    shellEcho(
      '  Flag: --preflight (compliance check only — run after deploy.sh, before onboarding/mint)'
    )
  );
  sections.push('echo ""');
  sections.push('');
  sections.push(`DEMO_SIGNING_SECRET_HEX="${DEMO_SIGNING_SECRET_HEX}"`);
  sections.push(`DEMO_SIGNING_PUBLIC_KEY_HEX="${DEMO_SIGNING_PUBLIC_KEY_HEX}"`);
  sections.push(`DEMO_COUNTRY_CODE=${DEMO_COUNTRY_CODE}`);
  sections.push(`ED25519_SCHEME=${DEMO_ED25519_SCHEME}`);
  sections.push(`INITIAL_SUPPLY="${shellEscape(initialSupply)}"`);
  sections.push(`MINT_RECIPIENT="${shellEscape(adminAddress)}"`);
  sections.push(`ADMIN="${shellEscape(adminAddress)}"`);
  sections.push('');
  sections.push('SOURCE_ACCOUNT="${SOURCE_ACCOUNT:-${STELLAR_ACCOUNT:-}}"');
  sections.push('ADMIN_SOURCE_ACCOUNT="${ADMIN_SOURCE_ACCOUNT:-$SOURCE_ACCOUNT}"');
  sections.push('MANAGER_SOURCE_ACCOUNT="${MANAGER_SOURCE_ACCOUNT:-$SOURCE_ACCOUNT}"');
  sections.push('');
  sections.push('if [ -z "$SOURCE_ACCOUNT" ]; then');
  sections.push('  echo "Missing Stellar source account."');
  sections.push('  echo "Set SOURCE_ACCOUNT or STELLAR_ACCOUNT to a funded testnet CLI identity."');
  sections.push('  exit 1');
  sections.push('fi');
  sections.push('');
  sections.push(...buildManifestLoader(contractVarNames));
  sections.push('');
  sections.push(...buildRoleSignerPreflightChecks());
  sections.push('');
  sections.push('if ! echo "$MANIFEST_NETWORK" | grep -qi testnet; then');
  sections.push(
    shellEcho(
      `${'${RED}'}  ✗ bootstrap-demo-mint.sh is testnet-only. Current manifest network: $MANIFEST_NETWORK${'${RST}'}`
    )
  );
  sections.push('  exit 1');
  sections.push('fi');
  sections.push('');
  sections.push(
    'if [ ! -f target/wasm32v1-none/release/rwa_claim_issuer_example.wasm ] || [ ! -f target/wasm32v1-none/release/rwa_identity_example.wasm ]; then'
  );
  sections.push('  echo "Missing example WASM artifacts — run ./scripts/build.sh first."');
  sections.push('  exit 1');
  sections.push('fi');
  sections.push('');
  sections.push(...buildCompliancePreflightSection(config, networkFlag));
  sections.push('');
  sections.push('if [ "$COMPLIANCE_PREFLIGHT_ONLY" = true ]; then');
  sections.push('  verify_compliance_for_demo_mint');
  sections.push('  exit $?');
  sections.push('fi');
  sections.push('');

  sections.push(...shellSubsection('Deploy example claim issuer'));
  sections.push(
    buildDeploySection(
      'CLAIM_ISSUER_ADDRESS',
      'Example Claim Issuer',
      'rwa-claim-issuer-example',
      '--owner "$ADMIN"',
      networkFlag,
      undefined
    )
  );
  sections.push('');

  sections.push(...shellSubsection('Register demo issuer in CTI'));
  sections.push(
    buildInvokeCommand(
      '$CTI_ADDRESS',
      'add_trusted_issuer',
      `--trusted_issuer "$CLAIM_ISSUER_ADDRESS" --claim_topics '${topicsJson}' --operator "$MANAGER"`,
      networkFlag
    )
  );
  sections.push(
    shellEcho(`${'${GREEN}'}  ✓ Registered demo issuer for claim topics ${topicsJson}${'${RST}'}`)
  );
  sections.push('');

  for (const topic of claimTopics) {
    sections.push(
      buildInvokeCommand(
        '$CLAIM_ISSUER_ADDRESS',
        'allow_key',
        `--public_key ${DEMO_SIGNING_PUBLIC_KEY_HEX} --registry "$CTI_ADDRESS" --claim_topic ${topic.id}`,
        networkFlag,
        'admin'
      )
    );
    sections.push(
      shellEcho(
        `${'${GREEN}'}  ✓ Allowed demo signing key for topic ${topic.id} (${shellEscape(topic.name)})${'${RST}'}`
      )
    );
  }
  sections.push('');

  sections.push(...shellSubsection('Deploy identity for Admin and register in IRS'));
  sections.push(
    buildDeploySection(
      'IDENTITY_ADDRESS',
      'Example Identity',
      'rwa-identity-example',
      '--owner "$ADMIN"',
      networkFlag,
      undefined
    )
  );
  sections.push('');

  sections.push('sign_demo_claim() {');
  sections.push('  local topic="$1"');
  sections.push('  cargo run --manifest-path tools/sign-claim/Cargo.toml --quiet -- \\');
  sections.push('    --secret-key "$DEMO_SIGNING_SECRET_HEX" \\');
  sections.push('    --claim-issuer "$CLAIM_ISSUER_ADDRESS" \\');
  sections.push('    --identity "$IDENTITY_ADDRESS" \\');
  sections.push('    --claim-topic "$topic" \\');
  sections.push('    --valid-for-days 7 \\');
  sections.push(`    --network ${networkFlag.replace('--network ', '')}`);
  sections.push('}');
  sections.push('');
  sections.push('parse_signed_claim() {');
  sections.push('  local output="$1"');
  sections.push(`  CLAIM_DATA=$(echo "$output" | awk '/--data/{print $2}')`);
  sections.push(`  CLAIM_SIGNATURE=$(echo "$output" | awk '/--signature/{print $2}')`);
  sections.push('  if [ -z "$CLAIM_DATA" ] || [ -z "$CLAIM_SIGNATURE" ]; then');
  sections.push('    echo "Could not parse signed claim output:"');
  sections.push('    echo "$output"');
  sections.push('    exit 1');
  sections.push('  fi');
  sections.push('}');
  sections.push('');

  sections.push(`for DEMO_TOPIC in ${topicsBashList}; do`);
  sections.push('  echo ""');
  sections.push(shellEcho(`${'${BOLD}'}  Signing demo claim for topic $DEMO_TOPIC...${'${RST}'}`));
  sections.push('  SIGN_OUTPUT="$(sign_demo_claim "$DEMO_TOPIC")"');
  sections.push('  parse_signed_claim "$SIGN_OUTPUT"');
  sections.push(
    buildInvokeCommand(
      '$IDENTITY_ADDRESS',
      'add_claim',
      '--topic "$DEMO_TOPIC" --scheme "$ED25519_SCHEME" --issuer "$CLAIM_ISSUER_ADDRESS" --signature "$CLAIM_SIGNATURE" --data "$CLAIM_DATA" --uri "demo://admin/kyc"',
      networkFlag,
      'admin'
    )
  );
  sections.push(shellEcho(`${'${GREEN}'}  ✓ Added demo claim for topic $DEMO_TOPIC${'${RST}'}`));
  sections.push('done');
  sections.push('');

  sections.push(
    buildInvokeCommand(
      '$IRS_ADDRESS',
      'add_identity_country_data',
      `--account "$MINT_RECIPIENT" --identity "$IDENTITY_ADDRESS" --initial_profiles '${shellSingleQuoteLiteral(countryProfileJson)}' --operator "$MANAGER"`,
      networkFlag
    )
  );
  sections.push(
    shellEcho(`${'${GREEN}'}  ✓ Registered Admin in IRS with demo country profile${'${RST}'}`)
  );
  sections.push('');

  sections.push('verify_compliance_for_demo_mint || exit 1');
  sections.push('');

  sections.push(...shellSubsection('Mint configured initial supply to Admin'));
  sections.push(
    buildInvokeCommand(
      '$RWA_TOKEN_ADDRESS',
      'mint',
      `--to "$MINT_RECIPIENT" --amount "$INITIAL_SUPPLY" --operator "$ADMIN"`,
      networkFlag,
      'admin'
    )
  );
  sections.push(
    shellEcho(
      `${'${GREEN}'}  ✓ Minted $INITIAL_SUPPLY base units to Admin ($MINT_RECIPIENT)${'${RST}'}`
    )
  );
  sections.push('');
  sections.push(...shellSection('Demo Auto-Mint Complete'));
  sections.push(shellEcho('  Recipient: $MINT_RECIPIENT'));
  sections.push(shellEcho('  Amount:    $INITIAL_SUPPLY base units'));
  sections.push(shellEcho('  Reminder: demo keys and example contracts — not production KYC.'));
  sections.push('');

  return sections.join('\n');
}

export function shouldGenerateBootstrapDemoMintScript(
  config: RWAConfig,
  includeIdentitySupport: boolean
): boolean {
  return (
    includeIdentitySupport && isDemoAutoMintEligible(config) && hasConfiguredInitialSupply(config)
  );
}
