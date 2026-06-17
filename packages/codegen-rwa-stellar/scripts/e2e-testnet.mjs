#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { generateWithIdentitySupport, validate } from '../dist/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_STELLAR_IDENTITY = 'default';
const DEFAULT_OUTPUT_PREFIX = path.join(tmpdir(), 'stellar-rwa-e2e-testnet-');
const SIGNING_SECRET_HEX = '0000000000000000000000000000000000000000000000000000000000000000';
const SIGNING_PUBLIC_KEY_HEX = '3b6a27bcceb6a42d62a3a8d02a6f0d73653215771de243a63ac048a18b59da29';
const TEST_CLAIM_TOPIC = 1;
const ED25519_SCHEME = 101;
const ISO_COUNTRY = {
  CH: 756,
  US: 840,
};

const CONTRACT_LABELS = {
  cti: 'Claim Topics & Issuers',
  irs: 'Identity Registry Storage',
  identityVerifier: 'Identity Verifier',
  compliance: 'Compliance',
  supplyLimit: 'Supply Limit',
  maxBalance: 'Max Balance',
  countryRestrict: 'Country Restriction',
  countryAllow: 'Country Allow-list',
  timeTransfersLimits: 'Time-based Transfer Limits',
  transferAllow: 'Transfer Allow-list',
  token: 'BE2E Token',
};

function printUsage() {
  console.log(`Usage: pnpm e2e:testnet -- [options]

Options:
  --source-account <identity>      Stellar CLI identity or account used as deploy payer (default: ${DEFAULT_STELLAR_IDENTITY})
  --admin-source-account <identity>  CLI identity for admin/owner invokes (default: SOURCE_ACCOUNT)
  --manager-source-account <identity>  CLI identity for manager invokes (default: SOURCE_ACCOUNT)
  --split-roles                    Use separate funded admin and manager identities (creates manager if omitted)
  --sign-with-key <identity>       Optional signer override forwarded to Stellar CLI
  --output-dir <path>              Directory where the generated project will be written
  --network <name>                 Stellar CLI network name (default: testnet)
  --contracts-library-path <path>  Optional local stellar-contracts checkout override
  --keep-going                     Continue assertions after the first failed check
  --help                           Show this help

Environment:
  SOURCE_ACCOUNT / STELLAR_ACCOUNT Override the default deploy payer identity
  ADMIN_SOURCE_ACCOUNT             Admin/owner signer when owner != Manager (defaults to SOURCE_ACCOUNT)
  MANAGER_SOURCE_ACCOUNT           Manager signer when owner != Manager (defaults to SOURCE_ACCOUNT)
  SIGN_WITH_KEY / STELLAR_SIGN_WITH_KEY
                                   Used when --sign-with-key is omitted

Notes:
  - Happy path: run \`pnpm e2e:testnet\` with a funded Stellar CLI "${DEFAULT_STELLAR_IDENTITY}" identity.
  - When owner and Manager share one address, SOURCE_ACCOUNT alone is enough for deploy and post-deploy invokes.
  - For split owner/manager configs, set ADMIN_SOURCE_ACCOUNT and MANAGER_SOURCE_ACCOUNT (or pass --split-roles).
  - This script deploys real contracts on Stellar testnet.
  - It creates three funded temporary Stellar identities for test recipients.
  - The generated project includes upstream claim-issuer, identity, and sign-claim helpers.
`);
}

function parseArgs(argv) {
  const options = {
    sourceAccount:
      process.env.SOURCE_ACCOUNT || process.env.STELLAR_ACCOUNT || DEFAULT_STELLAR_IDENTITY,
    adminSourceAccount: process.env.ADMIN_SOURCE_ACCOUNT,
    managerSourceAccount: process.env.MANAGER_SOURCE_ACCOUNT,
    signWithKey: process.env.SIGN_WITH_KEY ?? process.env.STELLAR_SIGN_WITH_KEY,
    outputDir: undefined,
    network: 'testnet',
    contractsLibraryPath: undefined,
    keepGoing: false,
    splitRoles: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') continue;

    switch (arg) {
      case '--source-account':
        options.sourceAccount = argv[++index] ?? '';
        break;
      case '--admin-source-account':
        options.adminSourceAccount = argv[++index] ?? '';
        break;
      case '--manager-source-account':
        options.managerSourceAccount = argv[++index] ?? '';
        break;
      case '--split-roles':
        options.splitRoles = true;
        break;
      case '--sign-with-key':
        options.signWithKey = argv[++index] ?? '';
        break;
      case '--output-dir':
        options.outputDir = path.resolve(argv[++index] ?? '');
        break;
      case '--network':
        options.network = argv[++index] ?? 'testnet';
        break;
      case '--contracts-library-path':
        options.contractsLibraryPath = path.resolve(argv[++index] ?? '');
        break;
      case '--keep-going':
        options.keepGoing = true;
        break;
      case '--help':
        printUsage();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function runResult(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? result.error?.message ?? '',
    status: result.status,
  };
}

function mustRunResult(command, args, options = {}) {
  const result = runResult(command, args, options);
  if (!result.ok) {
    throw new Error(
      [`Command failed: ${command} ${args.join(' ')}`, result.stdout.trim(), result.stderr.trim()]
        .filter(Boolean)
        .join('\n')
    );
  }
  return result;
}

function mustRun(command, args, options = {}) {
  return mustRunResult(command, args, options).stdout.trim();
}

function ensureCommand(command, args, description) {
  const result = runResult(command, args);
  if (!result.ok) {
    throw new Error(`${description} is required to run the testnet e2e.`);
  }
}

function ensureRustWasmTarget() {
  ensureCommand('rustup', ['target', 'list', '--installed'], 'Rust with a wasm target');
  const targets = mustRun('rustup', ['target', 'list', '--installed']);
  if (!targets.includes('wasm32')) {
    throw new Error(
      'A Rust wasm target is required. Install one with `rustup target add wasm32v1-none`.'
    );
  }
}

function isLikelyAccountAddress(value) {
  return /^G[A-Z2-7]{55}$/.test(value);
}

function isLikelyContractAddress(value) {
  return /^C[A-Z2-7]{55}$/.test(value);
}

function resolveIdentityAddress(identity) {
  const normalized = identity?.trim();
  if (!normalized) return undefined;
  if (isLikelyAccountAddress(normalized)) return normalized;

  const resolved = runResult('stellar', ['keys', 'address', normalized]);
  const address = resolved.stdout.trim();
  return resolved.ok && isLikelyAccountAddress(address) ? address : undefined;
}

function resolveInvokeSourceAccount(env, role = 'deploy') {
  switch (role) {
    case 'admin':
      return env.ADMIN_SOURCE_ACCOUNT ?? env.SOURCE_ACCOUNT;
    case 'manager':
      return env.MANAGER_SOURCE_ACCOUNT ?? env.SOURCE_ACCOUNT;
    case 'deploy':
      return env.SOURCE_ACCOUNT;
    default:
      throw new Error(`Unknown invoke signer role: ${role}`);
  }
}

function verifyRoleSigner(roleLabel, expectedAddress, sourceIdentity) {
  const resolved = resolveIdentityAddress(sourceIdentity);
  if (!resolved) {
    throw new Error(
      `Could not resolve Stellar CLI identity for ${roleLabel}: ${sourceIdentity}. ` +
        'Ensure the identity exists or pass a G-address directly.'
    );
  }
  if (resolved !== expectedAddress) {
    throw new Error(
      `${roleLabel} signer mismatch: expected on-chain address ${expectedAddress}, ` +
        `but CLI identity "${sourceIdentity}" resolves to ${resolved}. ` +
        'Set ADMIN_SOURCE_ACCOUNT / MANAGER_SOURCE_ACCOUNT to identities that control the configured addresses.'
    );
  }
}

function resolveEnvironment(options) {
  const sourceAccount = options.sourceAccount?.trim();
  if (!sourceAccount) {
    throw new Error(
      'Missing source account. Pass --source-account <identity> or set SOURCE_ACCOUNT / STELLAR_ACCOUNT.'
    );
  }

  const adminSourceAccount = options.adminSourceAccount?.trim() || sourceAccount;
  const managerSourceAccount = options.managerSourceAccount?.trim() || sourceAccount;
  const adminAddress = resolveIdentityAddress(options.signWithKey?.trim() || adminSourceAccount);
  if (!adminAddress) {
    throw new Error(
      `Could not resolve a public account address for admin identity: ${adminSourceAccount}`
    );
  }

  const managerAddress =
    options.splitRoles || managerSourceAccount !== adminSourceAccount
      ? resolveIdentityAddress(managerSourceAccount)
      : adminAddress;
  if (!managerAddress) {
    throw new Error(
      `Could not resolve a public account address for manager identity: ${managerSourceAccount}`
    );
  }

  if (options.splitRoles && adminAddress === managerAddress) {
    throw new Error(
      '--split-roles requires admin and manager to resolve to different G-addresses.'
    );
  }

  if (adminAddress !== managerAddress) {
    verifyRoleSigner('Admin', adminAddress, adminSourceAccount);
    verifyRoleSigner('Manager', managerAddress, managerSourceAccount);
  }

  return {
    adminAddress,
    managerAddress,
    env: {
      SOURCE_ACCOUNT: sourceAccount,
      STELLAR_ACCOUNT: sourceAccount,
      ADMIN_SOURCE_ACCOUNT: adminSourceAccount,
      MANAGER_SOURCE_ACCOUNT: managerSourceAccount,
      ADMIN_ADDRESS: adminAddress,
      MANAGER_ADDRESS: managerAddress,
      ...(options.signWithKey
        ? {
            STELLAR_SIGN_WITH_KEY: options.signWithKey,
            SIGN_WITH_KEY: options.signWithKey,
          }
        : {}),
    },
  };
}

function writeGeneratedFiles(outputDir, files) {
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(outputDir, filePath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, typeof content === 'string' ? 'utf8' : undefined);
  }
}

function createFundedIdentity(label, options) {
  const name = `rwa-e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  mustRun('stellar', [
    'keys',
    'generate',
    name,
    '--fund',
    '--overwrite',
    '--network',
    options.network,
  ]);
  return {
    label,
    name,
    address: mustRun('stellar', ['keys', 'address', name]),
  };
}

function createBehaviorConfig(adminAddress, managerAddress, participants) {
  const allowedUsers = [
    adminAddress,
    managerAddress,
    participants.recipient.address,
    participants.blockedCountry.address,
  ];

  return {
    token: {
      name: 'Behavior E2E Token',
      symbol: 'BE2E',
      decimals: 7,
      administrativeControls: {
        burnable: true,
        mintable: true,
        pausable: true,
      },
      documentManager: {
        enabled: true,
      },
    },
    identityVerification: {
      claimTopics: [{ id: TEST_CLAIM_TOPIC, name: 'KYC' }],
      trustedIssuers: [],
      controls: {
        addressFreezing: true,
        partialTokenFreezing: true,
        recovery: true,
        forcedTransfers: true,
      },
    },
    compliance: {
      modules: [
        { moduleId: 'supply-limit', config: { limit: 1_000 } },
        { moduleId: 'max-balance', config: { maxBalance: 150 } },
        { moduleId: 'country-restrict', config: { restrictedCountries: ['US'] } },
        { moduleId: 'country-allow', config: { allowedCountries: ['CH'] } },
        {
          moduleId: 'time-transfers-limits',
          config: { limitDurationLedgers: 17_280, limitValue: 60 },
        },
        { moduleId: 'transfer-allow', config: { allowedUsers } },
      ],
    },
    accessControl: {
      ownership: {
        type: 'single-owner',
        ownerAddress: adminAddress,
      },
      roles: [
        {
          name: 'Manager',
          symbol: 'manager',
          addresses: [managerAddress],
        },
      ],
    },
    deployment: {
      target: {
        kind: 'preset',
        ecosystem: 'stellar',
        networkId: 'stellar-testnet',
      },
    },
  };
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseAddressByLabel(output, label) {
  const clean = stripAnsi(output);
  const match = clean.match(new RegExp(`${escapeRegExp(label)}\\s+(C[A-Z2-7]{55})`));
  if (!match) {
    throw new Error(`Could not find deployed address for "${label}" in deploy output.`);
  }
  return match[1];
}

function parseDeployAddresses(output) {
  return Object.fromEntries(
    Object.entries(CONTRACT_LABELS).map(([key, label]) => [key, parseAddressByLabel(output, label)])
  );
}

function stellarDeploy(projectDir, options, env, wasmName, constructorArgs) {
  return mustRun(
    'stellar',
    [
      'contract',
      'deploy',
      '--source-account',
      env.SOURCE_ACCOUNT,
      '--wasm',
      path.join(projectDir, 'target', 'wasm32v1-none', 'release', wasmName),
      '--network',
      options.network,
      '--',
      ...constructorArgs,
    ],
    { cwd: projectDir, env }
  );
}

function stellarInvoke(contractId, fnName, fnArgs, options, env, projectDir, signerRole = 'deploy') {
  return mustRunResult(
    'stellar',
    [
      'contract',
      'invoke',
      '--id',
      contractId,
      '--source-account',
      resolveInvokeSourceAccount(env, signerRole),
      '--network',
      options.network,
      '--',
      fnName,
      ...fnArgs,
    ],
    { cwd: projectDir, env }
  );
}

function stellarInvokeResult(
  contractId,
  fnName,
  fnArgs,
  options,
  env,
  projectDir,
  signerRole = 'deploy'
) {
  return runResult(
    'stellar',
    [
      'contract',
      'invoke',
      '--id',
      contractId,
      '--source-account',
      resolveInvokeSourceAccount(env, signerRole),
      '--network',
      options.network,
      '--',
      fnName,
      ...fnArgs,
    ],
    { cwd: projectDir, env }
  );
}

function stellarView(contractId, fnName, fnArgs, options, env, projectDir) {
  return mustRun(
    'stellar',
    [
      'contract',
      'invoke',
      '--id',
      contractId,
      '--source-account',
      env.SOURCE_ACCOUNT,
      '--network',
      options.network,
      '--send',
      'no',
      '--',
      fnName,
      ...fnArgs,
    ],
    { cwd: projectDir, env }
  );
}

function buildCountryProfile(countryCode) {
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

function parseSignedClaim(output) {
  const data = output.match(/--data\s+([0-9a-f]+)/i)?.[1];
  const signature = output.match(/--signature\s+([0-9a-f]+)/i)?.[1];
  if (!data || !signature) {
    throw new Error(`Could not parse signed claim output:\n${output}`);
  }
  return { data, signature };
}

function signClaim(projectDir, claimIssuer, identity, topic, options) {
  const output = mustRun(
    'cargo',
    [
      'run',
      '--manifest-path',
      path.join(projectDir, 'tools', 'sign-claim', 'Cargo.toml'),
      '--quiet',
      '--',
      '--secret-key',
      SIGNING_SECRET_HEX,
      '--claim-issuer',
      claimIssuer,
      '--identity',
      identity,
      '--claim-topic',
      String(topic),
      '--valid-for-days',
      '7',
      '--network',
      options.network,
    ],
    { cwd: projectDir }
  );
  return parseSignedClaim(output);
}

function registerIdentity(participant, contracts, options, env, projectDir) {
  const identityAddress = stellarDeploy(projectDir, options, env, 'rwa_identity_example.wasm', [
    '--owner',
    env.ADMIN_ADDRESS,
  ]);
  const claim = signClaim(
    projectDir,
    contracts.claimIssuer,
    identityAddress,
    TEST_CLAIM_TOPIC,
    options
  );

  stellarInvoke(
    identityAddress,
    'add_claim',
    [
      '--topic',
      String(TEST_CLAIM_TOPIC),
      '--scheme',
      String(ED25519_SCHEME),
      '--issuer',
      contracts.claimIssuer,
      '--signature',
      claim.signature,
      '--data',
      claim.data,
      '--uri',
      `e2e://${participant.label}/kyc`,
    ],
    options,
    env,
    projectDir,
    'deploy'
  );

  stellarInvoke(
    contracts.irs,
    'add_identity_country_data',
    [
      '--account',
      participant.address,
      '--identity',
      identityAddress,
      '--initial_profiles',
      buildCountryProfile(participant.country),
      '--operator',
      env.MANAGER_ADDRESS,
    ],
    options,
    env,
    projectDir,
    'manager'
  );

  return identityAddress;
}

function firstMeaningfulLine(value) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
}

function summarizeFailure(result) {
  const output = [result.stderr, result.stdout].filter(Boolean).join('\n');
  const errorLine = output
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('❌ error:') || line.startsWith('error:'));
  if (errorLine) {
    return `No tx submitted; ${errorLine.replace(/^❌\s*/, '')}`;
  }

  const contractError = output.match(/Error\((?:Contract|WasmVm),\s*#[0-9]+\)/);
  if (contractError) {
    return `No tx submitted; simulation rejected with ${contractError[0]}`;
  }

  return `No tx submitted; rejected${result.status ? ` with exit status ${result.status}` : ''}`;
}

function getTransactionLinks(result) {
  const output = [result.stderr, result.stdout].filter(Boolean).join('\n');
  return [
    ...new Set(
      [
        ...output.matchAll(
          /https:\/\/stellar\.expert\/explorer\/(?:testnet|public)\/tx\/[a-f0-9]{64}/gi
        ),
      ].map((match) => match[0])
    ),
  ];
}

function transactionProof(result, label = 'Transaction') {
  const links = getTransactionLinks(result);
  if (links.length > 0) {
    return `${label}: ${links.join(', ')}`;
  }

  const hash = [result.stderr, result.stdout]
    .filter(Boolean)
    .join('\n')
    .match(/Signing transaction:\s*([a-f0-9]{64})/i)?.[1];
  return hash ? `${label} hash: ${hash}` : undefined;
}

function joinProof(...parts) {
  return parts.filter(Boolean).join('; ');
}

function normalizeProof(value) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (value && typeof value === 'object' && typeof value.proof === 'string') {
    return value.proof.trim();
  }

  return undefined;
}

function createAssertionRunner(keepGoing) {
  const results = [];
  let stopped = false;

  function record(name, ok, detail = '', proof) {
    const normalizedProof = proof?.trim();
    results.push({ name, ok, detail, proof: normalizedProof });
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`);
    if (normalizedProof) {
      console.log(`  Proof: ${normalizedProof}`);
    }
    if (!ok && !keepGoing) {
      stopped = true;
    }
  }

  function shouldRun() {
    return keepGoing || !stopped;
  }

  return {
    results,
    expectSuccess(name, fn) {
      if (!shouldRun()) {
        return undefined;
      }
      try {
        const value = fn();
        record(name, true, '', normalizeProof(value));
        return value;
      } catch (error) {
        record(name, false, firstMeaningfulLine(error.message) ?? error.message);
        return undefined;
      }
    },
    expectFailure(name, fn) {
      if (!shouldRun()) {
        return;
      }
      try {
        const result = fn();
        if (result?.ok === false) {
          record(name, true, '', summarizeFailure(result));
          return;
        }
        record(name, false, 'operation succeeded unexpectedly');
      } catch {
        record(name, true);
      }
    },
  };
}

function getExplorerUrl(address, network) {
  const explorerNetwork =
    network === 'testnet' ? 'testnet' : network === 'mainnet' ? 'public' : undefined;
  if (!explorerNetwork) {
    return undefined;
  }

  if (isLikelyContractAddress(address)) {
    return `https://stellar.expert/explorer/${explorerNetwork}/contract/${address}`;
  }

  if (isLikelyAccountAddress(address)) {
    return `https://stellar.expert/explorer/${explorerNetwork}/account/${address}`;
  }

  return undefined;
}

function printFinalSummary(results, addresses, outputDir, options) {
  const passed = results.filter((result) => result.ok).length;
  const failed = results.length - passed;

  console.log('');
  console.log('E2E summary');
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Project: ${outputDir}`);
  console.log('');
  console.log('Deployed addresses');
  for (const [name, address] of Object.entries(addresses)) {
    if (isLikelyContractAddress(address) || isLikelyAccountAddress(address)) {
      console.log(`  ${name}: ${address}`);
      const explorerUrl = getExplorerUrl(address, options.network);
      if (explorerUrl) {
        console.log(`    Explorer: ${explorerUrl}`);
      }
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureCommand('stellar', ['--version'], 'Stellar CLI');
  ensureRustWasmTarget();

  if (options.splitRoles && !options.managerSourceAccount?.trim()) {
    console.log('Creating funded manager identity for split-role e2e...');
    options.managerSourceAccount = createFundedIdentity('manager', options).name;
  }

  const { adminAddress, managerAddress, env: baseEnv } = resolveEnvironment(options);
  const outputDir = options.outputDir ?? mkdtempSync(DEFAULT_OUTPUT_PREFIX);
  const env = { ...baseEnv };

  console.log(`Using deploy payer: ${env.SOURCE_ACCOUNT}`);
  console.log(`Using admin address: ${adminAddress}`);
  console.log(`Using manager address: ${managerAddress}`);
  if (adminAddress !== managerAddress) {
    console.log(`Using admin signer: ${env.ADMIN_SOURCE_ACCOUNT}`);
    console.log(`Using manager signer: ${env.MANAGER_SOURCE_ACCOUNT}`);
  }
  console.log(`Writing generated project to: ${outputDir}`);
  console.log('Creating funded recipient identities...');

  const participants = {
    source: { label: 'source', address: adminAddress, country: ISO_COUNTRY.CH },
    recipient: createFundedIdentity('recipient', options),
    blockedCountry: createFundedIdentity('blocked-country', options),
    unallowed: createFundedIdentity('unallowed', options),
  };
  participants.recipient.country = ISO_COUNTRY.CH;
  participants.blockedCountry.country = ISO_COUNTRY.US;
  participants.unallowed.country = ISO_COUNTRY.CH;

  const config = createBehaviorConfig(adminAddress, managerAddress, participants);
  const generateOptions = {
    allowUnderReviewModules: true,
    ...(options.contractsLibraryPath ? { contractsLibraryPath: options.contractsLibraryPath } : {}),
  };
  const validation = validate(config, generateOptions);
  if (!validation.valid) {
    const details = validation.errors
      .map((error) => `${error.field || '<root>'}: [${error.code}] ${error.message}`)
      .join('\n');
    throw new Error(`Config validation failed:\n${details}`);
  }

  console.log('Generating identity-enabled project...');
  const result = generateWithIdentitySupport(config, generateOptions);
  writeGeneratedFiles(outputDir, result.files);

  console.log('Building contracts...');
  chmodSync(path.join(outputDir, 'scripts', 'build.sh'), 0o755);
  execFileSync(path.join(outputDir, 'scripts', 'build.sh'), {
    cwd: outputDir,
    stdio: 'inherit',
  });

  console.log('Deploying generated stack...');
  chmodSync(path.join(outputDir, 'scripts', 'deploy.sh'), 0o755);
  const deployOutput = mustRun(path.join(outputDir, 'scripts', 'deploy.sh'), [], {
    cwd: outputDir,
    env,
  });
  const contracts = parseDeployAddresses(deployOutput);

  console.log('Deploying claim issuer and holder identities...');
  contracts.claimIssuer = stellarDeploy(outputDir, options, env, 'rwa_claim_issuer_example.wasm', [
    '--owner',
    adminAddress,
  ]);

  stellarInvoke(
    contracts.cti,
    'add_trusted_issuer',
    [
      '--trusted_issuer',
      contracts.claimIssuer,
      '--claim_topics',
      `[${TEST_CLAIM_TOPIC}]`,
      '--operator',
      managerAddress,
    ],
    options,
    env,
    outputDir,
    'manager'
  );
  stellarInvoke(
    contracts.claimIssuer,
    'allow_key',
    [
      '--public_key',
      SIGNING_PUBLIC_KEY_HEX,
      '--registry',
      contracts.cti,
      '--claim_topic',
      String(TEST_CLAIM_TOPIC),
    ],
    options,
    env,
    outputDir,
    'admin'
  );

  for (const participant of Object.values(participants)) {
    participant.identity = registerIdentity(participant, contracts, options, env, outputDir);
  }

  const assert = createAssertionRunner(options.keepGoing);
  console.log('');
  console.log('Running behavior assertions...');

  assert.expectSuccess('mint to verified CH source account', () => {
    const tx = stellarInvoke(
      contracts.token,
      'mint',
      ['--to', adminAddress, '--amount', '100', '--operator', adminAddress],
      options,
      env,
      outputDir,
      'admin'
    );
    const balance = stellarView(
      contracts.token,
      'balance',
      ['--account', adminAddress],
      options,
      env,
      outputDir
    );
    return { proof: joinProof(transactionProof(tx), `source balance is ${balance}`) };
  });

  assert.expectFailure('max-balance rejects mint above holder cap', () =>
    stellarInvokeResult(
      contracts.token,
      'mint',
      ['--to', adminAddress, '--amount', '60', '--operator', adminAddress],
      options,
      env,
      outputDir,
      'admin'
    )
  );

  assert.expectSuccess('manager raises max-balance for supply-limit check', () => {
    const tx = stellarInvoke(
      contracts.maxBalance,
      'set_max_balance',
      ['--token', contracts.token, '--max', '2000', '--operator', managerAddress],
      options,
      env,
      outputDir,
      'manager'
    );
    const maxBalance = stellarView(
      contracts.maxBalance,
      'get_max_balance',
      ['--token', contracts.token],
      options,
      env,
      outputDir
    );
    return {
      proof: joinProof(transactionProof(tx), `max-balance module reports max ${maxBalance}`),
    };
  });

  assert.expectFailure('supply-limit rejects mint above total cap', () =>
    stellarInvokeResult(
      contracts.token,
      'mint',
      ['--to', adminAddress, '--amount', '950', '--operator', adminAddress],
      options,
      env,
      outputDir,
      'admin'
    )
  );

  assert.expectSuccess('manager temporarily disallows source for transfer-allow check', () => {
    const tx = stellarInvoke(
      contracts.transferAllow,
      'disallow_user',
      ['--token', contracts.token, '--user', adminAddress, '--operator', managerAddress],
      options,
      env,
      outputDir,
      'manager'
    );
    const allowed = stellarView(
      contracts.transferAllow,
      'is_user_allowed',
      ['--token', contracts.token, '--user', adminAddress],
      options,
      env,
      outputDir
    );
    return { proof: joinProof(transactionProof(tx), `source allow-list status is ${allowed}`) };
  });

  assert.expectFailure('transfer-allow rejects transfer when neither party is listed', () =>
    stellarInvokeResult(
      contracts.token,
      'transfer',
      ['--from', adminAddress, '--to', participants.unallowed.address, '--amount', '1'],
      options,
      env,
      outputDir,
      'admin'
    )
  );

  assert.expectSuccess('manager re-allows source after transfer-allow check', () => {
    const tx = stellarInvoke(
      contracts.transferAllow,
      'allow_user',
      ['--token', contracts.token, '--user', adminAddress, '--operator', managerAddress],
      options,
      env,
      outputDir,
      'manager'
    );
    const allowed = stellarView(
      contracts.transferAllow,
      'is_user_allowed',
      ['--token', contracts.token, '--user', adminAddress],
      options,
      env,
      outputDir
    );
    return { proof: joinProof(transactionProof(tx), `source allow-list status is ${allowed}`) };
  });

  assert.expectFailure('country modules reject US recipient', () =>
    stellarInvokeResult(
      contracts.token,
      'transfer',
      ['--from', adminAddress, '--to', participants.blockedCountry.address, '--amount', '1'],
      options,
      env,
      outputDir,
      'admin'
    )
  );

  assert.expectSuccess('transfer to verified allowed CH recipient', () => {
    const tx = stellarInvoke(
      contracts.token,
      'transfer',
      ['--from', adminAddress, '--to', participants.recipient.address, '--amount', '50'],
      options,
      env,
      outputDir,
      'admin'
    );
    const sourceBalance = stellarView(
      contracts.token,
      'balance',
      ['--account', adminAddress],
      options,
      env,
      outputDir
    );
    const recipientBalance = stellarView(
      contracts.token,
      'balance',
      ['--account', participants.recipient.address],
      options,
      env,
      outputDir
    );
    return {
      proof: joinProof(
        transactionProof(tx),
        `source balance is ${sourceBalance}`,
        `recipient balance is ${recipientBalance}`
      ),
    };
  });

  assert.expectFailure('time-transfer limit rejects second transfer in window', () =>
    stellarInvokeResult(
      contracts.token,
      'transfer',
      ['--from', adminAddress, '--to', participants.recipient.address, '--amount', '20'],
      options,
      env,
      outputDir,
      'admin'
    )
  );

  printFinalSummary(
    assert.results,
    {
      sourceAccount: participants.source.address,
      managerAccount: managerAddress,
      recipientAccount: participants.recipient.address,
      blockedCountryAccount: participants.blockedCountry.address,
      unallowedAccount: participants.unallowed.address,
      sourceIdentity: participants.source.identity,
      recipientIdentity: participants.recipient.identity,
      blockedCountryIdentity: participants.blockedCountry.identity,
      unallowedIdentity: participants.unallowed.identity,
      ...contracts,
    },
    outputDir,
    options
  );
}

main();
