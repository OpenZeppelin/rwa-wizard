import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import { generate } from '../src/index';

const COMPILE_TIMEOUT = 300_000; // 5 minutes

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

function createFullConfig(overrides?: Partial<RWAConfig>): RWAConfig {
  return {
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
    compliance: { modules: [] },
    accessControl: {
      ownership: { type: 'single-owner', ownerAddress: 'GCEXAMPLEOWNER' },
      roles: [{ name: 'Manager', symbol: 'manager', addresses: ['GCMGR1'] }],
    },
    deployment: { network: 'testnet' },
    ...overrides,
  };
}

function createMinimalConfig(): RWAConfig {
  return {
    token: {
      name: 'Minimal Token',
      symbol: 'MIN',
      decimals: 7,
      documentManager: { enabled: false },
    },
    identityVerification: {
      claimTopics: [{ id: 1, name: 'KYC' }],
      trustedIssuers: [{ address: 'GCEXAMPLEISSUER1', claimTopics: [1] }],
    },
    compliance: { modules: [] },
    accessControl: {
      ownership: { type: 'single-owner', ownerAddress: 'GCEXAMPLEOWNER' },
      roles: [],
    },
    deployment: { network: 'testnet' },
  };
}

function writeGeneratedFiles(outputDir: string, files: Record<string, string>): void {
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = join(outputDir, filePath);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
  }
}

function runStellarBuild(projectDir: string): { success: boolean; output: string } {
  try {
    // `stellar contract build` writes build output to stderr (via cargo),
    // so we merge stderr into stdout to capture everything.
    const output = execSync('stellar contract build 2>&1', {
      cwd: projectDir,
      encoding: 'utf-8',
      shell: '/bin/bash',
      timeout: COMPILE_TIMEOUT,
    });
    return { success: true, output };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    const combined = [e.stdout, e.stderr].filter(Boolean).join('\n');
    return { success: false, output: combined };
  }
}

const skipReason =
  !hasStellarCli() || !hasRustWasmTarget()
    ? 'Requires `stellar` CLI and Rust wasm32 target to be installed'
    : undefined;

describe.skipIf(!!skipReason)('Compilation E2E — generated contracts must compile', () => {
  const testRoot = join(tmpdir(), `codegen-compile-e2e-${Date.now()}`);

  beforeAll(() => {
    mkdirSync(testRoot, { recursive: true });
  });

  afterAll(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it(
    'should compile a full-featured RWA project (with DocumentManager + roles)',
    () => {
      const config = createFullConfig();
      const result = generate(config);

      const projectDir = join(testRoot, 'full-featured');
      writeGeneratedFiles(projectDir, result.files);

      expect(existsSync(join(projectDir, 'Cargo.toml'))).toBe(true);
      expect(existsSync(join(projectDir, 'contracts/rwa-token/src/contract.rs'))).toBe(true);

      const buildResult = runStellarBuild(projectDir);
      expect(buildResult.success, `Compilation failed:\n${buildResult.output}`).toBe(true);

      const expectedWasms = [
        'rwa_token',
        'compliance',
        'identity_verifier',
        'claim_topics_issuers',
        'identity_registry_storage',
      ];

      for (const wasm of expectedWasms) {
        expect(buildResult.output).toContain(`${wasm}.wasm`);
      }
    },
    COMPILE_TIMEOUT
  );

  it(
    'should compile a minimal RWA project (no DocumentManager, no roles)',
    () => {
      const config = createMinimalConfig();
      const result = generate(config);

      const projectDir = join(testRoot, 'minimal');
      writeGeneratedFiles(projectDir, result.files);

      const buildResult = runStellarBuild(projectDir);
      expect(buildResult.success, `Compilation failed:\n${buildResult.output}`).toBe(true);
      expect(buildResult.output).toContain('rwa_token.wasm');
    },
    COMPILE_TIMEOUT
  );

  it(
    'should compile with multiple roles',
    () => {
      const config = createFullConfig({
        accessControl: {
          ownership: { type: 'single-owner', ownerAddress: 'GCEXAMPLEOWNER' },
          roles: [
            { name: 'Manager', symbol: 'manager', addresses: ['GCMGR1'] },
            { name: 'Agent', symbol: 'agent', addresses: ['GCAGENT1'] },
          ],
        },
      });
      const result = generate(config);

      const projectDir = join(testRoot, 'multi-role');
      writeGeneratedFiles(projectDir, result.files);

      const buildResult = runStellarBuild(projectDir);
      expect(buildResult.success, `Compilation failed:\n${buildResult.output}`).toBe(true);
      expect(buildResult.output).toContain('rwa_token.wasm');
    },
    COMPILE_TIMEOUT
  );
});
