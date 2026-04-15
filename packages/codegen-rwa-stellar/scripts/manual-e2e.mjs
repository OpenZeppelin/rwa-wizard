#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { generate, validate } from '../dist/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');

const PLACEHOLDER_ADDRESS = '__STELLAR_E2E_ADDRESS__';
const DEFAULT_CONFIG_PATH = path.join(
  repoRoot,
  'packages',
  'cli',
  'examples',
  'stellar-full-e2e.json'
);
const DEFAULT_OUTPUT_PREFIX = path.join(tmpdir(), 'stellar-rwa-manual-e2e-');

function printUsage() {
  console.log(`Usage: pnpm --filter @openzeppelin/codegen-rwa-stellar test:manual:e2e -- [options]

Options:
  --config <path>                  Path to the source RWA config JSON file
  --output-dir <path>              Directory where the generated project will be written
  --address <stellar-address>      Replace "${PLACEHOLDER_ADDRESS}" in the config
  --source-account <identity>      Source account / identity for generated deploy.sh
  --sign-with-key <identity>       Optional signer override forwarded to Stellar CLI
  --contracts-library-path <path>  Optional local stellar-contracts checkout override
  --help                           Show this help

Environment:
  STELLAR_E2E_ADDRESS              Used when --address is omitted
  SOURCE_ACCOUNT / STELLAR_ACCOUNT Used when --source-account is omitted
  SIGN_WITH_KEY / STELLAR_SIGN_WITH_KEY
                                   Used when --sign-with-key is omitted

Notes:
  - The default sample config lives at ${DEFAULT_CONFIG_PATH}
  - The generated project is built with scripts/build.sh and deployed with scripts/deploy.sh
  - For the default sample, --address must be a signable Stellar account address (G...)
  - The deploy script resolves SOURCE_ACCOUNT first, then falls back to STELLAR_ACCOUNT
  - The chosen source account must be able to authorize the operator/admin address used
`);
}

function parseArgs(argv) {
  const options = {
    configPath: DEFAULT_CONFIG_PATH,
    outputDir: undefined,
    address: process.env.STELLAR_E2E_ADDRESS,
    sourceAccount: process.env.SOURCE_ACCOUNT ?? process.env.STELLAR_ACCOUNT,
    signWithKey: process.env.SIGN_WITH_KEY ?? process.env.STELLAR_SIGN_WITH_KEY,
    contractsLibraryPath: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--') {
      continue;
    }

    switch (arg) {
      case '--config':
        options.configPath = path.resolve(argv[++index] ?? '');
        break;
      case '--output-dir':
        options.outputDir = path.resolve(argv[++index] ?? '');
        break;
      case '--address':
        options.address = argv[++index] ?? '';
        break;
      case '--source-account':
        options.sourceAccount = argv[++index] ?? '';
        break;
      case '--sign-with-key':
        options.signWithKey = argv[++index] ?? '';
        break;
      case '--contracts-library-path':
        options.contractsLibraryPath = path.resolve(argv[++index] ?? '');
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

function ensureCommand(command, args, description) {
  try {
    execFileSync(command, args, { stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    throw new Error(`${description} is required to run the manual e2e.`);
  }
}

function ensureRustWasmTarget() {
  ensureCommand('rustup', ['target', 'list', '--installed'], 'Rust with a wasm target');

  const targets = execFileSync('rustup', ['target', 'list', '--installed'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  if (!targets.includes('wasm32')) {
    throw new Error(
      'A Rust wasm target is required to run the manual e2e. Install one with `rustup target add wasm32v1-none`.'
    );
  }
}

function isLikelyAccountAddress(value) {
  return /^G[A-Z2-7]{55}$/.test(value);
}

function isLikelyContractAddress(value) {
  return /^C[A-Z2-7]{55}$/.test(value);
}

function replacePlaceholderAddresses(value, address) {
  if (typeof value === 'string') {
    return value === PLACEHOLDER_ADDRESS ? address : value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => replacePlaceholderAddresses(entry, address));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        replacePlaceholderAddresses(entry, address),
      ])
    );
  }

  return value;
}

function configContainsPlaceholder(config) {
  return JSON.stringify(config).includes(PLACEHOLDER_ADDRESS);
}

function writeGeneratedFiles(outputDir, files) {
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(outputDir, filePath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, typeof content === 'string' ? 'utf8' : undefined);
  }
}

function resolveIdentityAddress(identity) {
  const normalized = identity?.trim();
  if (!normalized) return undefined;
  if (isLikelyAccountAddress(normalized)) {
    return normalized;
  }

  try {
    const resolved = execFileSync('stellar', ['keys', 'address', normalized], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    return isLikelyAccountAddress(resolved) ? resolved : undefined;
  } catch {
    return undefined;
  }
}

function resolveDeployEnvironment(options) {
  const sourceAccount = options.sourceAccount?.trim();
  if (!sourceAccount) {
    throw new Error(
      'Missing deploy source account. Pass --source-account <identity> or set SOURCE_ACCOUNT / STELLAR_ACCOUNT before running the manual e2e. Example: --source-account alice'
    );
  }

  const signWithKey = options.signWithKey?.trim();

  return {
    SOURCE_ACCOUNT: sourceAccount,
    STELLAR_ACCOUNT: sourceAccount,
    ...(signWithKey
      ? {
          SIGN_WITH_KEY: signWithKey,
          STELLAR_SIGN_WITH_KEY: signWithKey,
        }
      : {}),
  };
}

function validateManualE2EAddress(address, deployEnvironment) {
  const normalizedAddress = address?.trim();
  if (!normalizedAddress) {
    return;
  }

  if (isLikelyContractAddress(normalizedAddress)) {
    throw new Error(
      `The manual E2E sample expects a signable Stellar account address (G...), but received contract address ${normalizedAddress}. Pass the public account address for the identity you want to use as owner/manager/operator.`
    );
  }

  if (!isLikelyAccountAddress(normalizedAddress)) {
    throw new Error(
      `Unsupported --address value: ${normalizedAddress}. The manual E2E sample expects a public Stellar account address (G...).`
    );
  }

  const authIdentity = deployEnvironment.STELLAR_SIGN_WITH_KEY ?? deployEnvironment.SOURCE_ACCOUNT;
  const authAddress = resolveIdentityAddress(authIdentity);
  if (authAddress && authAddress !== normalizedAddress) {
    throw new Error(
      `The manual E2E sample requires the configured operator/admin address to match the signing identity. --address resolved to ${normalizedAddress}, but ${authIdentity} resolves to ${authAddress}. Use the matching public key for --address or choose a source/signing identity that owns ${normalizedAddress}.`
    );
  }
}

function runScript(projectDir, relativeScriptPath, envOverrides = {}) {
  const scriptPath = path.join(projectDir, relativeScriptPath);
  chmodSync(scriptPath, 0o755);
  execFileSync(scriptPath, {
    cwd: projectDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...envOverrides,
    },
  });
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!existsSync(options.configPath)) {
    throw new Error(`Config file not found: ${options.configPath}`);
  }

  ensureCommand('stellar', ['--version'], 'Stellar CLI');
  ensureRustWasmTarget();
  const deployEnvironment = resolveDeployEnvironment(options);
  validateManualE2EAddress(options.address, deployEnvironment);

  const rawConfig = JSON.parse(readFileSync(options.configPath, 'utf8'));
  const config =
    configContainsPlaceholder(rawConfig) && options.address
      ? replacePlaceholderAddresses(rawConfig, options.address)
      : rawConfig;

  if (configContainsPlaceholder(config)) {
    throw new Error(
      `Config still contains ${PLACEHOLDER_ADDRESS}. Pass --address (or STELLAR_E2E_ADDRESS) or provide a fully resolved config file.`
    );
  }

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

  if (validation.warnings.length > 0) {
    console.log('Validation warnings:');
    for (const warning of validation.warnings) {
      console.log(`- ${warning.field || '<root>'}: [${warning.code}] ${warning.message}`);
    }
    console.log('');
  }

  const outputDir = options.outputDir ?? mkdtempSync(DEFAULT_OUTPUT_PREFIX);

  console.log(`Using config: ${options.configPath}`);
  console.log(`Writing generated project to: ${outputDir}`);
  if (options.address) {
    console.log(`Using operator/admin address: ${options.address}`);
  }
  console.log(`Using deploy source account: ${deployEnvironment.SOURCE_ACCOUNT}`);
  if (deployEnvironment.STELLAR_SIGN_WITH_KEY) {
    console.log(`Using explicit Stellar CLI signer: ${deployEnvironment.STELLAR_SIGN_WITH_KEY}`);
  }
  console.log('Generating project...');

  const result = generate(config, generateOptions);
  writeGeneratedFiles(outputDir, result.files);

  console.log('Running generated build script...');
  runScript(outputDir, path.join('scripts', 'build.sh'));

  console.log('Running generated deploy script...');
  console.log(
    'The deploy script will reuse SOURCE_ACCOUNT / STELLAR_ACCOUNT for every deploy and invoke command.'
  );
  runScript(outputDir, path.join('scripts', 'deploy.sh'), deployEnvironment);

  console.log('Manual e2e completed successfully.');
  console.log(`Generated project remains available at: ${outputDir}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
