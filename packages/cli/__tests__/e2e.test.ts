import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const CLI_ROOT = join(__dirname, '..');
const CLI_BIN = join(CLI_ROOT, 'dist', 'index.mjs');
const EXAMPLE_CONFIG = join(CLI_ROOT, 'examples', 'stellar-basic.json');

function runCli(args: string): string {
  return execSync(`node ${CLI_BIN} ${args}`, {
    cwd: CLI_ROOT,
    encoding: 'utf-8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

function runCliExpectFail(args: string): { stderr: string; status: number } {
  try {
    execSync(`node ${CLI_BIN} ${args}`, {
      cwd: CLI_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1' },
    });
    return { stderr: '', status: 0 };
  } catch (err) {
    const e = err as { stderr?: string; status?: number };
    return { stderr: e.stderr ?? '', status: e.status ?? 1 };
  }
}

describe('CLI E2E', () => {
  const tmpDir = join(tmpdir(), `cli-e2e-${Date.now()}`);

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('--help', () => {
    it('should display help text with all commands', () => {
      const output = runCli('--help');
      expect(output).toContain('rwa-wizard');
      expect(output).toContain('generate');
      expect(output).toContain('validate');
      expect(output).toContain('modules');
    });
  });

  describe('--version', () => {
    it('should display the package version', () => {
      const output = runCli('--version');
      expect(output.trim()).toBe('0.0.0');
    });
  });

  describe('validate', () => {
    it('should validate a valid config file successfully', () => {
      const output = runCli(`validate -c ${EXAMPLE_CONFIG}`);
      expect(output).toContain('valid');
    });

    it('should fail for a nonexistent config file', () => {
      const { status } = runCliExpectFail('validate -c /nonexistent/file.json');
      expect(status).not.toBe(0);
    });

    it('should fail for malformed JSON', () => {
      mkdirSync(tmpDir, { recursive: true });
      const badConfig = join(tmpDir, 'bad.json');
      writeFileSync(badConfig, '{ not json }');

      const { status } = runCliExpectFail(`validate -c ${badConfig}`);
      expect(status).not.toBe(0);
    });
  });

  describe('generate (file tree)', () => {
    it('should generate a complete project from config', () => {
      runCli(`generate -c ${EXAMPLE_CONFIG} -o ${tmpDir}`);

      expect(existsSync(join(tmpDir, 'Cargo.toml'))).toBe(true);
      expect(existsSync(join(tmpDir, 'contracts/rwa-token/src/contract.rs'))).toBe(true);
      expect(existsSync(join(tmpDir, 'contracts/compliance/src/contract.rs'))).toBe(true);
      expect(existsSync(join(tmpDir, 'contracts/identity-verifier/src/contract.rs'))).toBe(true);
      expect(existsSync(join(tmpDir, 'contracts/claim-topics-issuers/src/contract.rs'))).toBe(true);
      expect(existsSync(join(tmpDir, 'contracts/identity-registry-storage/src/contract.rs'))).toBe(
        true
      );
      expect(existsSync(join(tmpDir, 'scripts/deploy.sh'))).toBe(true);
      expect(existsSync(join(tmpDir, 'scripts/build.sh'))).toBe(true);
      expect(existsSync(join(tmpDir, 'README.md'))).toBe(true);
    });

    it('should embed config.json with the right token symbol', () => {
      runCli(`generate -c ${EXAMPLE_CONFIG} -o ${tmpDir}`);

      const configJson = readFileSync(join(tmpDir, 'config.json'), 'utf-8');
      const config = JSON.parse(configJson);
      expect(config.token.symbol).toBe('MRWA');
      expect(config.token.name).toBe('My RWA Token');
    });

    it('should generate all 5 core contracts', () => {
      runCli(`generate -c ${EXAMPLE_CONFIG} -o ${tmpDir}`);

      const contractDirs = [
        'rwa-token',
        'compliance',
        'identity-verifier',
        'claim-topics-issuers',
        'identity-registry-storage',
      ];

      for (const dir of contractDirs) {
        expect(existsSync(join(tmpDir, 'contracts', dir, 'src', 'contract.rs'))).toBe(true);
        expect(existsSync(join(tmpDir, 'contracts', dir, 'src', 'lib.rs'))).toBe(true);
        expect(existsSync(join(tmpDir, 'contracts', dir, 'Cargo.toml'))).toBe(true);
      }
    });
  });

  describe('generate (ZIP)', () => {
    it('should generate a non-empty ZIP archive', () => {
      mkdirSync(tmpDir, { recursive: true });
      const zipPath = join(tmpDir, 'output.zip');

      runCli(`generate -c ${EXAMPLE_CONFIG} -o ${zipPath} --zip`);

      expect(existsSync(zipPath)).toBe(true);
      expect(statSync(zipPath).size).toBeGreaterThan(100);
    });
  });

  describe('modules', () => {
    it('should run without error', () => {
      const output = runCli('modules');
      expect(output).toBeDefined();
    });

    it('should accept a --chain flag', () => {
      const output = runCli('modules --chain stellar');
      expect(output).toBeDefined();
    });
  });

  describe('generate help', () => {
    it('should display generate command options', () => {
      const output = runCli('generate --help');
      expect(output).toContain('--config');
      expect(output).toContain('--output');
      expect(output).toContain('--zip');
      expect(output).toContain('--chain');
    });
  });
});
