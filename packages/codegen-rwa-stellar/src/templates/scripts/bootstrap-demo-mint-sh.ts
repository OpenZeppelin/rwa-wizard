import type { ProvenanceScope } from '@openzeppelin/codegen-core';
import { createLineBuilder } from '@openzeppelin/codegen-core';
import {
  getAdminAddress,
  getUniqueModuleSelections,
  selectedClaimTopicIds,
  selectedClaimTopicIndices,
} from '@openzeppelin/codegen-rwa-common';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import { resolveStellarDeploymentTarget } from '../../deployment/target';
import { getOptionalScalarConfigValue } from '../../modules/descriptors/shared';
import { renderDetached } from '../contracts/detached-scope';
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
  emitEcho,
  moduleVarName,
  shellBacktickLiteral,
  shellEcho,
  shellEscape,
  shellSection,
  shellSingleQuoteLiteral,
  shellSubsection,
  unionConfigPaths,
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
export const BOOTSTRAP_DEMO_MINT_PATH = 'scripts/bootstrap-demo-mint.sh';

export function generateBootstrapDemoMintShInScope(scope: ProvenanceScope<RWAConfig>): string {
  // INV-17: the builder is created before ANY config read, so none of the eight
  // values this script hoists can drain onto the shebang (INV-35).
  const builder = createLineBuilder(scope, { separator: '\n' });

  // Observed BEFORE the precondition assertion below, and both walks together.
  //
  // The order is the invariant, not a style choice. `bindScope.observe` stashes
  // whatever was read before it into `pending`, and the first emission — the
  // shebang — takes `pending`. So a claim-topic read made by the assertion
  // itself would put `identityVerification.claimTopics[i].selected` on
  // `#!/bin/bash`, and a user clicking a claim-topic chip would be shown the
  // shebang as a line their selection shapes. Observing first, then deriving the
  // assertion from `topics.value`, adds no read at all.
  //
  // BOTH walks, because the two emission shapes need different spaces: the
  // aggregate lines (`--claim_topics`, `for DEMO_TOPIC in …`) need ids, and the
  // `allow_key` loop needs INDICES. An id list cannot drive that loop —
  // `topicIds.length` type-checks perfectly as a bound for indexing
  // `claimTopics`, which is the same count/index conflation `deploy.sh` now
  // makes a compile error, in a file with no interface to protect it.
  const topics = builder.observe((config) => ({
    indices: selectedClaimTopicIndices(config),
    ids: selectedClaimTopicIds(config),
  }));

  // Equivalent to `shouldGenerateBootstrapDemoMintScript` minus the caller's
  // identity-support flag, which this scope cannot see. The eligibility predicate
  // is observed so its deployment-target / initialSupply reads attribute to
  // nothing: a bare `isDemoAutoMintEligible(builder.config)` left those paths in
  // the window, the next `observe` stashed them into `pending`, and the shebang
  // took them — so focusing Initial Supply highlighted `#!/bin/bash`. Claim-topic
  // emptiness still derives from the already-observed `topics` value (INV-21).
  const eligible = builder.observe((config) => isDemoAutoMintEligible(config));
  if (!eligible.value || topics.value.ids.length === 0) {
    throw new Error(
      'bootstrap-demo-mint.sh requires testnet target, configured initialSupply and at least one selected claim topic'
    );
  }

  // INV-24: observed once, paths carried to every emission that uses the value.
  const deploymentTarget = builder.observe((config) =>
    resolveStellarDeploymentTarget(config.deployment.target)
  );
  const admin = builder.observe((config) => getAdminAddress(config));
  const supply = builder.observe((config) => config.token.initialSupply ?? '');
  const moduleVarNames = builder.observe((config) =>
    getUniqueModuleSelections(config.compliance.modules).map((selection) =>
      moduleVarName(selection.moduleId)
    )
  );

  const networkFlag = deploymentTarget.value.networkFlag;
  const networkPaths = deploymentTarget.paths;
  const adminAddress = admin.value;
  const initialSupply = supply.value;
  const topicIds = topics.value.ids;
  const topicsBashList = topicIds.join(' ');
  const topicsJson = `[${topicIds.join(', ')}]`;
  const countryProfileJson = buildCountryProfileJson(DEMO_COUNTRY_CODE);

  const contractVarNames = [
    'CTI_ADDRESS',
    'IRS_ADDRESS',
    'RWA_TOKEN_ADDRESS',
    ...moduleVarNames.value,
  ];

  builder.line('#!/bin/bash');
  builder.line('set -e');
  builder.line('');
  builder.lines(buildColorPreamble());
  builder.line('');
  builder.lines(buildArgumentParsing());
  builder.line('');
  builder.lines(shellSection('Demo Auto-Mint Bootstrap (TESTNET ONLY — NOT PRODUCTION KYC)'));
  builder.line(
    shellEcho(
      '  Educational Scope A: deploy example claim issuer, onboard Admin with demo claims, mint initialSupply.'
    )
  );
  builder.line(
    shellEcho('  Uses a hardcoded demo Ed25519 signing key — never use this flow in production.')
  );
  builder.line(
    shellEcho(
      '  Flag: --preflight (compliance check only — run after deploy.sh, before onboarding/mint)'
    )
  );
  builder.line('echo ""');
  builder.line('');
  builder.line(`DEMO_SIGNING_SECRET_HEX="${DEMO_SIGNING_SECRET_HEX}"`);
  builder.line(`DEMO_SIGNING_PUBLIC_KEY_HEX="${DEMO_SIGNING_PUBLIC_KEY_HEX}"`);
  builder.line(`DEMO_COUNTRY_CODE=${DEMO_COUNTRY_CODE}`);
  builder.line(`ED25519_SCHEME=${DEMO_ED25519_SCHEME}`);
  builder.line(`INITIAL_SUPPLY="${shellEscape(initialSupply)}"`, supply.paths);
  builder.line(`MINT_RECIPIENT="${shellEscape(adminAddress)}"`, admin.paths);
  builder.line(`ADMIN="${shellEscape(adminAddress)}"`, admin.paths);
  builder.line('');
  builder.line('SOURCE_ACCOUNT="${SOURCE_ACCOUNT:-${STELLAR_ACCOUNT:-}}"');
  builder.line('ADMIN_SOURCE_ACCOUNT="${ADMIN_SOURCE_ACCOUNT:-$SOURCE_ACCOUNT}"');
  builder.line('MANAGER_SOURCE_ACCOUNT="${MANAGER_SOURCE_ACCOUNT:-$SOURCE_ACCOUNT}"');
  builder.line('');
  builder.line('if [ -z "$SOURCE_ACCOUNT" ]; then');
  builder.line('  echo "Missing Stellar source account."');
  builder.line('  echo "Set SOURCE_ACCOUNT or STELLAR_ACCOUNT to a funded testnet CLI identity."');
  builder.line('  exit 1');
  builder.line('fi');
  builder.line('');
  builder.lines(buildManifestLoader(contractVarNames), moduleVarNames.paths);
  builder.line('');
  builder.lines(buildRoleSignerPreflightChecks());
  builder.line('');
  builder.line('if ! echo "$MANIFEST_NETWORK" | grep -qi testnet; then');
  builder.line(
    shellEcho(
      `${'${RED}'}  ✗ bootstrap-demo-mint.sh is testnet-only. Current manifest network: $MANIFEST_NETWORK${'${RST}'}`
    )
  );
  builder.line('  exit 1');
  builder.line('fi');
  builder.line('');
  builder.line(
    'if [ ! -f target/wasm32v1-none/release/rwa_claim_issuer_example.wasm ] || [ ! -f target/wasm32v1-none/release/rwa_identity_example.wasm ]; then'
  );
  builder.line('  echo "Missing example WASM artifacts — run ./scripts/build.sh first."');
  builder.line('  exit 1');
  builder.line('fi');
  builder.line('');
  builder.lines(buildCompliancePreflightSection(builder.config, networkFlag), networkPaths);
  builder.line('');
  builder.line('if [ "$COMPLIANCE_PREFLIGHT_ONLY" = true ]; then');
  builder.line('  verify_compliance_for_demo_mint');
  builder.line('  exit $?');
  builder.line('fi');
  builder.line('');

  builder.lines(shellSubsection('Deploy example claim issuer'));
  builder.line(
    buildDeploySection(
      'CLAIM_ISSUER_ADDRESS',
      'Example Claim Issuer',
      'rwa-claim-issuer-example',
      '--owner "$ADMIN"',
      networkFlag,
      undefined
    ),
    networkPaths
  );
  builder.line('');

  builder.lines(shellSubsection('Register demo issuer in CTI'));
  builder.line(
    buildInvokeCommand(
      '$CTI_ADDRESS',
      'add_trusted_issuer',
      `--trusted_issuer "$CLAIM_ISSUER_ADDRESS" --claim_topics '${topicsJson}' --operator "$MANAGER"`,
      networkFlag
    ),
    unionConfigPaths(networkPaths, topics.paths)
  );
  emitEcho(
    builder,
    `${'${GREEN}'}  ✓ Registered demo issuer for claim topics ${topicsJson}${'${RST}'}`,
    topics.paths
  );
  builder.line('');

  // Iterates the observed SELECTED INDICES. `topicIds.length` used to bound this
  // loop, which conflated a count of ids with the index space of the array; that
  // is correct only while every defined topic is selected. `for...of` over a
  // plain local is safe where it is not over a config array: this array is not a
  // recording view, so the iterator's final read after the last body emission
  // records nothing and drains nothing onto the blank line that follows
  // (INV-35). Each topic is still read inside the lines it shapes.
  for (const index of topics.value.indices) {
    const topic = builder.config.identityVerification.claimTopics[index];
    if (topic === undefined) continue;
    builder.line(
      buildInvokeCommand(
        '$CLAIM_ISSUER_ADDRESS',
        'allow_key',
        `--public_key ${DEMO_SIGNING_PUBLIC_KEY_HEX} --registry "$CTI_ADDRESS" --claim_topic ${topic.id}`,
        networkFlag,
        'admin'
      ),
      networkPaths
    );
    emitEcho(
      builder,
      `${'${GREEN}'}  ✓ Allowed demo signing key for topic ${builder.config.identityVerification.claimTopics[index]?.id} (${shellEscape(builder.config.identityVerification.claimTopics[index]?.name ?? '')})${'${RST}'}`
    );
  }
  builder.line('');

  builder.lines(shellSubsection('Deploy identity for Admin and register in IRS'));
  builder.line(
    buildDeploySection(
      'IDENTITY_ADDRESS',
      'Example Identity',
      'rwa-identity-example',
      '--owner "$ADMIN"',
      networkFlag,
      undefined
    ),
    networkPaths
  );
  builder.line('');

  builder.line('sign_demo_claim() {');
  builder.line('  local topic="$1"');
  builder.line('  cargo run --manifest-path tools/sign-claim/Cargo.toml --quiet -- \\');
  builder.line('    --secret-key "$DEMO_SIGNING_SECRET_HEX" \\');
  builder.line('    --claim-issuer "$CLAIM_ISSUER_ADDRESS" \\');
  builder.line('    --identity "$IDENTITY_ADDRESS" \\');
  builder.line('    --claim-topic "$topic" \\');
  builder.line('    --valid-for-days 7 \\');
  builder.line(`    --network ${networkFlag.replace('--network ', '')}`, networkPaths);
  builder.line('}');
  builder.line('');
  builder.line('parse_signed_claim() {');
  builder.line('  local output="$1"');
  builder.line(`  CLAIM_DATA=$(echo "$output" | awk '/--data/{print $2}')`);
  builder.line(`  CLAIM_SIGNATURE=$(echo "$output" | awk '/--signature/{print $2}')`);
  builder.line('  if [ -z "$CLAIM_DATA" ] || [ -z "$CLAIM_SIGNATURE" ]; then');
  builder.line('    echo "Could not parse signed claim output:"');
  builder.line('    echo "$output"');
  builder.line('    exit 1');
  builder.line('  fi');
  builder.line('}');
  builder.line('');

  builder.line(`for DEMO_TOPIC in ${topicsBashList}; do`, topics.paths);
  builder.line('  echo ""');
  builder.line(shellEcho(`${'${BOLD}'}  Signing demo claim for topic $DEMO_TOPIC...${'${RST}'}`));
  builder.line('  SIGN_OUTPUT="$(sign_demo_claim "$DEMO_TOPIC")"');
  builder.line('  parse_signed_claim "$SIGN_OUTPUT"');
  builder.line(
    buildInvokeCommand(
      '$IDENTITY_ADDRESS',
      'add_claim',
      '--topic "$DEMO_TOPIC" --scheme "$ED25519_SCHEME" --issuer "$CLAIM_ISSUER_ADDRESS" --signature "$CLAIM_SIGNATURE" --data "$CLAIM_DATA" --uri "demo://admin/kyc"',
      networkFlag,
      'admin'
    ),
    networkPaths
  );
  builder.line(shellEcho(`${'${GREEN}'}  ✓ Added demo claim for topic $DEMO_TOPIC${'${RST}'}`));
  builder.line('done');
  builder.line('');

  builder.line(
    buildInvokeCommand(
      '$IRS_ADDRESS',
      'add_identity_country_data',
      `--account "$MINT_RECIPIENT" --identity "$IDENTITY_ADDRESS" --initial_profiles '${shellSingleQuoteLiteral(countryProfileJson)}' --operator "$MANAGER"`,
      networkFlag
    ),
    networkPaths
  );
  builder.line(
    shellEcho(`${'${GREEN}'}  ✓ Registered Admin in IRS with demo country profile${'${RST}'}`)
  );
  builder.line('');

  builder.line('verify_compliance_for_demo_mint || exit 1');
  builder.line('');

  builder.lines(shellSubsection('Mint configured initial supply to Admin'));
  builder.line(
    buildInvokeCommand(
      '$RWA_TOKEN_ADDRESS',
      'mint',
      `--to "$MINT_RECIPIENT" --amount "$INITIAL_SUPPLY" --operator "$ADMIN"`,
      networkFlag,
      'admin'
    ),
    networkPaths
  );
  builder.line(
    shellEcho(
      `${'${GREEN}'}  ✓ Minted $INITIAL_SUPPLY base units to Admin ($MINT_RECIPIENT)${'${RST}'}`
    )
  );
  builder.line('');
  builder.lines(shellSection('Demo Auto-Mint Complete'));
  builder.line(shellEcho('  Recipient: $MINT_RECIPIENT'));
  builder.line(shellEcho('  Amount:    $INITIAL_SUPPLY base units'));
  builder.line(shellEcho('  Reminder: demo keys and example contracts — not production KYC.'));
  builder.line('');

  return builder.text();
}

export function generateBootstrapDemoMintSh(config: RWAConfig): string {
  return renderDetached(config, BOOTSTRAP_DEMO_MINT_PATH, (scope) =>
    generateBootstrapDemoMintShInScope(scope)
  );
}

/**
 * Whether `scripts/bootstrap-demo-mint.sh` is part of this generation.
 *
 * Four preconditions, and the set is COMPLETE in a falsifiable sense: every
 * config-derived value the script interpolates into an unquoted shell word list
 * or a JSON array is non-empty whenever this returns `true`. `topicsBashList`
 * (`for DEMO_TOPIC in …`) and `topicsJson` (`--claim_topics '[…]'`) are covered
 * by the selected-topic precondition; `initialSupply` by the supply
 * precondition; `networkFlag` by the target precondition; the admin address by
 * `REQUIRED_FIELD` plus `generate()` throwing on an invalid config. An empty
 * module list is well-formed here.
 *
 * The selected-topic precondition also closes a defect that predates selection:
 * a config with `claimTopics: []` is `valid: true` today and generates
 * `for DEMO_TOPIC in ; do` — malformed shell, on a user's machine. The remedy is
 * the gate rather than a validation error, because a config with no claim
 * requirements is legitimate: the demo script signs claims for the configured
 * topics, so with none selected it has no work to do and its absence is the
 * truthful output.
 *
 * `isDemoAutoMintEligible` deliberately does NOT gain the claim-topic input —
 * that lives on this gate alone. Inside the script scope the predicate is
 * `observe`d so its reads attribute to nothing rather than draining onto the
 * shebang (the compute-early/emit-late hazard).
 */
export function shouldGenerateBootstrapDemoMintScript(
  config: RWAConfig,
  includeIdentitySupport: boolean
): boolean {
  return (
    includeIdentitySupport &&
    isDemoAutoMintEligible(config) &&
    hasConfiguredInitialSupply(config) &&
    selectedClaimTopicIds(config).length > 0
  );
}
