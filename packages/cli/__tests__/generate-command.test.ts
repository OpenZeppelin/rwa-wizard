import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateCommand } from '../src/commands/generate';
import { getGenerator } from '../src/generators/registry';
import { runWizard } from '../src/interactive/wizard';
import { loadConfig } from '../src/utils/config-loader';
import { logger } from '../src/utils/logger';
import { writeFileTree, writeZip } from '../src/utils/output-writer';
import {
  createMockAdapter,
  createMockGenerationResult,
  createMockZipResult,
  createValidConfig,
} from './helpers';

vi.mock('../src/generators/registry');
vi.mock('../src/utils/config-loader');
vi.mock('../src/utils/output-writer');
vi.mock('../src/interactive/wizard');
vi.mock('../src/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    plain: vi.fn(),
    success: vi.fn(),
    blank: vi.fn(),
    summary: vi.fn(),
    validationError: vi.fn(),
    validationWarning: vi.fn(),
  },
}));
vi.mock('@clack/prompts', () => ({
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  outro: vi.fn(),
  confirm: vi.fn().mockResolvedValue(false),
  text: vi.fn(),
  isCancel: vi.fn().mockReturnValue(false),
}));

class ExitError extends Error {
  constructor(public code: number | undefined) {
    super(`process.exit(${code})`);
  }
}

describe('generateCommand', () => {
  const mockAdapter = createMockAdapter();
  vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new ExitError(code as number);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGenerator).mockReturnValue(mockAdapter);
    vi.mocked(mockAdapter.validate).mockReturnValue({ valid: true, errors: [], warnings: [] });
    vi.mocked(mockAdapter.generate).mockReturnValue(createMockGenerationResult());
    vi.mocked(mockAdapter.generateZip).mockResolvedValue(createMockZipResult());
    vi.mocked(writeFileTree).mockReturnValue({
      outputPath: '/output',
      fileCount: 5,
      isZip: false,
    });
    vi.mocked(writeZip).mockResolvedValue({
      outputPath: '/out.zip',
      fileCount: 5,
      isZip: true,
      sizeBytes: 128,
    });
  });

  describe('headless mode (--config)', () => {
    it('should load config and generate file tree', async () => {
      vi.mocked(loadConfig).mockReturnValue(createValidConfig());

      await generateCommand({ config: 'test.json', output: '/output', chain: 'stellar' });

      expect(loadConfig).toHaveBeenCalledWith('test.json');
      expect(mockAdapter.validate).toHaveBeenCalled();
      expect(mockAdapter.generate).toHaveBeenCalled();
      expect(writeFileTree).toHaveBeenCalled();
      expect(logger.success).toHaveBeenCalledWith('Generation complete');
    });

    it('should generate ZIP when --zip flag is set', async () => {
      vi.mocked(loadConfig).mockReturnValue(createValidConfig());

      await generateCommand({
        config: 'test.json',
        output: '/out.zip',
        zip: true,
        chain: 'stellar',
      });

      expect(mockAdapter.generateZip).toHaveBeenCalled();
      expect(writeZip).toHaveBeenCalled();
      expect(logger.success).toHaveBeenCalledWith('Generation complete');
    });

    it('should exit when --zip is combined with a directory --output', async () => {
      vi.mocked(loadConfig).mockReturnValue(createValidConfig());
      const dir = join(tmpdir(), `rwa-cli-zip-dir-${Date.now()}`);
      mkdirSync(dir, { recursive: true });
      try {
        await expect(
          generateCommand({
            config: 'test.json',
            output: dir,
            zip: true,
            chain: 'stellar',
          })
        ).rejects.toThrow(ExitError);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('When using --zip')
        );
        expect(mockAdapter.generateZip).not.toHaveBeenCalled();
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it('should pass allowUnderReviewModules to validate, generateZip, and generate', async () => {
      vi.mocked(loadConfig).mockReturnValue(createValidConfig());

      await generateCommand({
        config: 'test.json',
        output: '/out.zip',
        zip: true,
        chain: 'stellar',
        allowUnderReviewModules: true,
      });

      expect(mockAdapter.validate).toHaveBeenCalledWith(expect.any(Object), {
        allowUnderReviewModules: true,
      });
      expect(mockAdapter.generateZip).toHaveBeenCalledWith(expect.any(Object), {
        allowUnderReviewModules: true,
      });
    });

    it('should not offer config export in headless mode', async () => {
      vi.mocked(loadConfig).mockReturnValue(createValidConfig());

      await generateCommand({ config: 'test.json', output: '/output', chain: 'stellar' });

      const prompts = await import('@clack/prompts');
      expect(prompts.confirm).not.toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('should exit with code 1 on validation failure', async () => {
      vi.mocked(loadConfig).mockReturnValue(createValidConfig());
      vi.mocked(mockAdapter.validate).mockReturnValue({
        valid: false,
        errors: [{ field: 'x', code: 'ERR', message: 'fail' }],
        warnings: [],
      });

      await expect(
        generateCommand({ config: 'test.json', output: '/output', chain: 'stellar' })
      ).rejects.toThrow(ExitError);
      expect(logger.error).toHaveBeenCalledWith('Configuration is invalid:');
      expect(mockAdapter.generate).not.toHaveBeenCalled();
    });

    it('should display warnings but continue generating', async () => {
      vi.mocked(loadConfig).mockReturnValue(createValidConfig());
      vi.mocked(mockAdapter.validate).mockReturnValue({
        valid: true,
        errors: [],
        warnings: [{ field: 'x', code: 'WARN', message: 'warning' }],
      });

      await generateCommand({ config: 'test.json', output: '/output', chain: 'stellar' });

      expect(logger.plain).toHaveBeenCalledWith('Validation warnings:');
      expect(logger.validationWarning).toHaveBeenCalled();
      expect(mockAdapter.generate).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should exit with code 1 on unknown chain', async () => {
      vi.mocked(getGenerator).mockImplementation(() => {
        throw new Error('Unknown chain "bad"');
      });

      await expect(
        generateCommand({ config: 'test.json', output: '/output', chain: 'bad' })
      ).rejects.toThrow(ExitError);
      expect(logger.error).toHaveBeenCalledWith('Unknown chain "bad"');
    });

    it('should exit with code 1 on config load failure', async () => {
      vi.mocked(loadConfig).mockImplementation(() => {
        throw new Error('Config file not found');
      });

      await expect(
        generateCommand({ config: 'missing.json', output: '/output', chain: 'stellar' })
      ).rejects.toThrow(ExitError);
      expect(logger.error).toHaveBeenCalledWith('Config file not found');
    });

    it('should exit with code 1 on generation failure', async () => {
      vi.mocked(loadConfig).mockReturnValue(createValidConfig());
      vi.mocked(mockAdapter.generate).mockImplementation(() => {
        throw new Error('Generation exploded');
      });

      await expect(
        generateCommand({ config: 'test.json', output: '/output', chain: 'stellar' })
      ).rejects.toThrow(ExitError);
      expect(logger.error).toHaveBeenCalledWith('Generation exploded');
    });
  });

  describe('interactive mode', () => {
    it('should run wizard when no --config is provided', async () => {
      vi.mocked(runWizard).mockResolvedValue({
        config: createValidConfig(),
        outputFormat: 'files',
      });

      await generateCommand({ output: '/output', chain: 'stellar' });

      expect(runWizard).toHaveBeenCalledWith(mockAdapter, { outputFormat: undefined });
      expect(mockAdapter.generate).toHaveBeenCalled();
    });

    it('should pass --zip override to the wizard and skip the format prompt', async () => {
      vi.mocked(runWizard).mockResolvedValue({
        config: createValidConfig(),
        outputFormat: 'zip',
      });

      await generateCommand({ output: '/out.zip', chain: 'stellar', zip: true });

      expect(runWizard).toHaveBeenCalledWith(mockAdapter, { outputFormat: 'zip' });
      expect(mockAdapter.generateZip).toHaveBeenCalled();
      expect(writeZip).toHaveBeenCalled();
    });

    it('should exit gracefully when wizard is cancelled', async () => {
      vi.mocked(runWizard).mockResolvedValue(null);

      await expect(generateCommand({ output: '/output', chain: 'stellar' })).rejects.toThrow(
        ExitError
      );
      expect(mockAdapter.generate).not.toHaveBeenCalled();
    });

    it('should use ZIP format when wizard selects it', async () => {
      vi.mocked(runWizard).mockResolvedValue({
        config: createValidConfig(),
        outputFormat: 'zip',
      });

      await generateCommand({ output: '/out.zip', chain: 'stellar' });

      expect(mockAdapter.generateZip).toHaveBeenCalled();
      expect(writeZip).toHaveBeenCalled();
    });

    it('should prompt for a zip file path when the default output is a directory', async () => {
      const prompts = await import('@clack/prompts');
      vi.mocked(prompts.text).mockResolvedValueOnce('/tmp/rwa-out.zip');

      vi.mocked(runWizard).mockResolvedValue({
        config: createValidConfig(),
        outputFormat: 'zip',
      });

      await generateCommand({ output: '.', chain: 'stellar' });

      expect(prompts.text).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'ZIP archive output path' })
      );
      expect(writeZip).toHaveBeenCalledWith(expect.any(Object), '/tmp/rwa-out.zip');
    });
  });
});
