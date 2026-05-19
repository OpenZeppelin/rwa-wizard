import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { GenerateOptions } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import {
  createMinimalConfig as createBaseMinimalConfig,
  createValidConfig,
} from './helpers/config';

import { generate } from '../src/index';

const COMPILE_TIMEOUT = 300_000; // 5 minutes
const LOCAL_STELLAR_CONTRACTS_PATH =
  process.env.STELLAR_CONTRACTS_PATH ?? '/Users/ghost/dev/repos/OpenZeppelin/stellar-contracts';

function hasStellarCli(): boolean {
  try {
    execSync('stellar --version', { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function hasRustWasmTarget(): boolean {
  try {
    const output = execSync('rustup target list --installed', {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return output.includes('wasm32');
  } catch {
    return false;
  }
}

function hasLocalContractsLibrary(): boolean {
  return (
    existsSync(join(LOCAL_STELLAR_CONTRACTS_PATH, 'packages/tokens')) &&
    existsSync(join(LOCAL_STELLAR_CONTRACTS_PATH, 'packages/access')) &&
    existsSync(join(LOCAL_STELLAR_CONTRACTS_PATH, 'packages/macros')) &&
    existsSync(join(LOCAL_STELLAR_CONTRACTS_PATH, 'packages/contract-utils'))
  );
}

function createFullConfig(overrides?: Partial<RWAConfig>): RWAConfig {
  return createValidConfig({
    token: {
      name: 'Compile Test Token',
      symbol: 'CTEST',
      decimals: 8,
      initialSupply: '1000000000',
      documentManager: { enabled: true },
    },
    identityVerification: {
      claimTopics: [{ id: 1, name: 'KYC' }],
      trustedIssuers: [{ address: 'GCEXAMPLEISSUER1', claimTopics: [1] }],
    },
    accessControl: {
      ownership: { type: 'single-owner', ownerAddress: 'GCEXAMPLEOWNER' },
      roles: [
        { name: 'Manager', symbol: 'manager', addresses: ['GCMGR1'] },
        { name: 'Agent', symbol: 'agent', addresses: ['GCAGENT1'] },
      ],
    },
    compliance: {
      modules: [
        { moduleId: 'supply-limit', config: { limit: 1_000_000 } },
        { moduleId: 'max-balance', config: { maxBalance: 50_000 } },
        { moduleId: 'country-restrict', config: { restrictedCountries: ['US'] } },
      ],
    },
    ...overrides,
  });
}

function createMinimalConfig(): RWAConfig {
  return createBaseMinimalConfig();
}

function writeGeneratedFiles(outputDir: string, files: Record<string, string | Uint8Array>): void {
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = join(outputDir, filePath);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    if (typeof content === 'string') {
      writeFileSync(fullPath, content, 'utf-8');
    } else {
      writeFileSync(fullPath, content);
    }
  }
}

async function runStellarBuild(projectDir: string): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    // Use async process execution to avoid blocking the Vitest worker event loop.
    const child = spawn('stellar', ['contract', 'build'], {
      cwd: projectDir,
      shell: '/bin/bash',
    });

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    child.stdout.on('data', (chunk) => stdoutChunks.push(String(chunk)));
    child.stderr.on('data', (chunk) => stderrChunks.push(String(chunk)));

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      // Ensure runaway builds are force-stopped.
      setTimeout(() => child.kill('SIGKILL'), 2_000);
    }, COMPILE_TIMEOUT);

    child.on('close', (code) => {
      clearTimeout(timeout);
      const output = [...stdoutChunks, ...stderrChunks].join('');
      if (timedOut) {
        resolve({
          success: false,
          output: `${output}\nBuild timed out after ${COMPILE_TIMEOUT}ms.`,
        });
        return;
      }
      resolve({ success: code === 0, output });
    });
  });
}

function generateProjectFiles(config: RWAConfig, options?: GenerateOptions) {
  return generate(config, options).files;
}

function writeGeneratedProject(
  testRoot: string,
  projectName: string,
  config: RWAConfig,
  options?: GenerateOptions
): string {
  const projectDir = join(testRoot, projectName);
  writeGeneratedFiles(projectDir, generateProjectFiles(config, options));
  return projectDir;
}

async function expectBuildSucceeds(
  projectDir: string,
  expectedWasms: string[],
  failureLabel: string
): Promise<void> {
  expect(existsSync(join(projectDir, 'Cargo.toml'))).toBe(true);
  expect(existsSync(join(projectDir, 'contracts/rwa-token/src/contract.rs'))).toBe(true);

  const buildResult = await runStellarBuild(projectDir);
  expect(buildResult.success, `${failureLabel}:\n${buildResult.output}`).toBe(true);

  for (const wasm of expectedWasms) {
    expect(buildResult.output).toContain(`${wasm}.wasm`);
  }
}

const defaultCompileSkipReason =
  !hasStellarCli() || !hasRustWasmTarget()
    ? 'Requires `stellar` CLI and Rust wasm32 target to be installed'
    : undefined;

const localCheckoutSkipReason = defaultCompileSkipReason
  ? defaultCompileSkipReason
  : !hasLocalContractsLibrary()
    ? 'Requires a local `stellar-contracts` checkout (set STELLAR_CONTRACTS_PATH if needed)'
    : undefined;

describe.skipIf(!!defaultCompileSkipReason)(
  'Compilation E2E — bundled generated contracts must compile',
  () => {
    const testRoot = join(tmpdir(), `codegen-compile-e2e-${Date.now()}`);

    beforeAll(() => {
      mkdirSync(testRoot, { recursive: true });
    });

    afterAll(() => {
      rmSync(testRoot, { recursive: true, force: true });
    });

    it(
      'should compile a full-featured bundled RWA project (modules + DocumentManager + roles)',
      async () => {
        const config = createFullConfig();
        const projectDir = writeGeneratedProject(testRoot, 'full-featured-bundled', config, {
          allowUnderReviewModules: true,
          ...(hasLocalContractsLibrary()
            ? { contractsLibraryPath: LOCAL_STELLAR_CONTRACTS_PATH }
            : {}),
        });

        await expectBuildSucceeds(
          projectDir,
          [
            'rwa_token',
            'compliance',
            'identity_verifier',
            'claim_topics_issuers',
            'identity_registry_storage',
            'supply_limit',
            'max_balance',
            'country_restrict',
          ],
          'Bundled compilation failed'
        );
      },
      COMPILE_TIMEOUT
    );

    it(
      'should compile a minimal RWA project (no DocumentManager, no roles)',
      async () => {
        const config = createMinimalConfig();
        const projectDir = writeGeneratedProject(testRoot, 'minimal-bundled', config, {
          ...(hasLocalContractsLibrary()
            ? { contractsLibraryPath: LOCAL_STELLAR_CONTRACTS_PATH }
            : {}),
        });

        await expectBuildSucceeds(projectDir, ['rwa_token'], 'Minimal bundled compilation failed');
      },
      COMPILE_TIMEOUT
    );
  }
);

describe.skipIf(!!localCheckoutSkipReason)(
  'Compilation E2E — local checkout override must remain compatible',
  () => {
    const testRoot = join(tmpdir(), `codegen-compile-local-e2e-${Date.now()}`);

    beforeAll(() => {
      mkdirSync(testRoot, { recursive: true });
    });

    afterAll(() => {
      rmSync(testRoot, { recursive: true, force: true });
    });

    it(
      'should compile a full-featured project with local path dependencies',
      async () => {
        const config = createFullConfig();
        const projectDir = writeGeneratedProject(testRoot, 'full-featured-local', config, {
          allowUnderReviewModules: true,
          contractsLibraryPath: LOCAL_STELLAR_CONTRACTS_PATH,
        });

        await expectBuildSucceeds(
          projectDir,
          ['rwa_token', 'supply_limit', 'max_balance', 'country_restrict'],
          'Local-checkout compilation failed'
        );
      },
      COMPILE_TIMEOUT
    );
  }
);
