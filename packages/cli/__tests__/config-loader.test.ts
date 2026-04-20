import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { loadConfig } from '../src/utils/config-loader';
import { createValidConfig } from './helpers';

const TMP_DIR = join(tmpdir(), `cli-test-config-${Date.now()}`);
const CONFIG_PATH = join(TMP_DIR, 'test-config.json');

describe('loadConfig', () => {
  beforeAll(() => {
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterAll(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    try {
      rmSync(CONFIG_PATH, { force: true });
    } catch {
      // ignore
    }
  });

  it('should load and parse valid JSON config', () => {
    const config = createValidConfig();
    writeFileSync(CONFIG_PATH, JSON.stringify(config));

    const loaded = loadConfig(CONFIG_PATH);
    expect(loaded.token.name).toBe('Test Token');
    expect(loaded.token.symbol).toBe('TEST');
    expect(loaded.token.decimals).toBe(8);
  });

  it('should preserve all config fields through round-trip', () => {
    const config = createValidConfig({
      token: { ...createValidConfig().token, initialSupply: '999' },
    });
    writeFileSync(CONFIG_PATH, JSON.stringify(config));

    const loaded = loadConfig(CONFIG_PATH);
    expect(loaded.token.initialSupply).toBe('999');
    expect(loaded.identityVerification.claimTopics).toHaveLength(1);
    expect(loaded.accessControl.roles).toHaveLength(1);
  });

  it('should throw for a nonexistent file', () => {
    expect(() => loadConfig('/nonexistent/path/config.json')).toThrow('Config file not found');
  });

  it('should throw for invalid JSON', () => {
    writeFileSync(CONFIG_PATH, '{ this is not valid json }');
    expect(() => loadConfig(CONFIG_PATH)).toThrow('Invalid JSON');
  });

  it('should include file path in error messages', () => {
    const badPath = join(TMP_DIR, 'missing.json');
    expect(() => loadConfig(badPath)).toThrow(badPath);
  });

  it('should resolve relative paths', () => {
    writeFileSync(CONFIG_PATH, JSON.stringify(createValidConfig()));
    const loaded = loadConfig(CONFIG_PATH);
    expect(loaded).toBeDefined();
    expect(loaded.token).toBeDefined();
  });
});
