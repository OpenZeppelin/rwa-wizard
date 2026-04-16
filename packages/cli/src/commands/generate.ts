import { existsSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';

import type { GenerateOptions as CoreGenerateOptions } from '@openzeppelin/codegen-core';
import type { RWAConfig } from '@openzeppelin/rwa-config';

import type { GeneratorAdapter } from '../generators/registry';
import { getGenerator } from '../generators/registry';
import { runWizard } from '../interactive/wizard';
import { loadConfig } from '../utils/config-loader';
import { logger } from '../utils/logger';
import { writeFileTree, writeZip } from '../utils/output-writer';

export interface GenerateOptions {
  config?: string;
  output: string;
  zip?: boolean;
  chain: string;
  /** When true, pass through to stellar codegen (not for production). */
  allowUnderReviewModules?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function generateCommand(opts: GenerateOptions): Promise<void> {
  let adapter: GeneratorAdapter;
  try {
    adapter = getGenerator(opts.chain);
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  let config: RWAConfig;
  let useZip = opts.zip ?? false;
  let isInteractive = false;

  if (opts.config) {
    try {
      config = loadConfig(opts.config);
    } catch (err) {
      logger.error((err as Error).message);
      process.exit(1);
    }
  } else {
    isInteractive = true;
    const result = await runWizard(adapter);
    if (!result) process.exit(0);
    config = result.config;
    useZip = result.outputFormat === 'zip';
  }

  const coreOptions: CoreGenerateOptions | undefined = opts.allowUnderReviewModules
    ? { allowUnderReviewModules: true }
    : undefined;

  const validation = adapter.validate(config, coreOptions);

  if (validation.warnings.length > 0) {
    logger.warn('Validation warnings:');
    for (const w of validation.warnings) {
      logger.validationWarning(w.field, w.code, w.message);
    }
  }

  if (!validation.valid) {
    logger.error('Configuration is invalid:');
    for (const e of validation.errors) {
      logger.validationError(e.field, e.code, e.message);
    }
    process.exit(1);
  }

  let resolvedOutput = opts.output;

  if (useZip && isInteractive) {
    const abs = resolve(resolvedOutput);
    const needsZipPath = resolvedOutput === '.' || (existsSync(abs) && statSync(abs).isDirectory());

    if (needsZipPath) {
      const zipPath = await p.text({
        message: 'ZIP archive output path',
        placeholder: 'e.g. rwa-project.zip',
        defaultValue: 'rwa-project.zip',
        validate: (v) => {
          if (!v.trim()) return 'Path is required';
        },
      });

      if (p.isCancel(zipPath)) process.exit(0);
      resolvedOutput = zipPath as string;
    }
  }

  if (useZip && !isInteractive) {
    const abs = resolve(resolvedOutput);
    if (existsSync(abs) && statSync(abs).isDirectory()) {
      logger.error(
        'When using --zip, --output must be a file path (e.g. -o project.zip), not a directory.'
      );
      process.exit(1);
    }
  }

  const s = p.spinner();

  if (useZip) {
    s.start('Generating ZIP archive...');
    try {
      const zipResult = await adapter.generateZip(config, coreOptions);
      const writeResult = await writeZip(zipResult, resolvedOutput);
      s.stop('ZIP archive generated');

      logger.blank();
      logger.success('Generation complete');
      logger.summary([
        ['Output', writeResult.outputPath],
        ['Format', 'ZIP archive'],
        ['Files', String(writeResult.fileCount)],
        ['Size', formatBytes(writeResult.sizeBytes)],
        ['Generator', adapter.name],
        ['Config hash', zipResult.metadata.configHash],
      ]);
    } catch (err) {
      s.stop('Generation failed');
      logger.error((err as Error).message);
      process.exit(1);
    }
  } else {
    s.start('Generating project files...');
    try {
      const result = adapter.generate(config, coreOptions);
      const writeResult = writeFileTree(result, resolvedOutput);
      s.stop('Project files generated');

      logger.blank();
      logger.success('Generation complete');
      logger.summary([
        ['Output', writeResult.outputPath],
        ['Format', 'File tree'],
        ['Files', String(writeResult.fileCount)],
        ['Generator', adapter.name],
        ['Config hash', result.metadata.configHash],
      ]);
    } catch (err) {
      s.stop('Generation failed');
      logger.error((err as Error).message);
      process.exit(1);
    }
  }

  if (isInteractive) {
    await offerConfigExport(config);
  }

  logger.blank();
  p.outro(pc.green('Done!'));
}

async function offerConfigExport(config: RWAConfig): Promise<void> {
  const exportConfig = await p.confirm({
    message: 'Export configuration as JSON? (useful for re-running without the wizard)',
    initialValue: false,
  });

  if (p.isCancel(exportConfig) || !exportConfig) return;

  const exportPath = await p.text({
    message: 'Config export path',
    defaultValue: 'rwa-config.json',
    validate: (v) => {
      if (!v.trim()) return 'Path is required';
    },
  });

  if (p.isCancel(exportPath)) return;

  const absolutePath = resolve(exportPath as string);
  writeFileSync(absolutePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  logger.success(`Configuration exported to ${absolutePath}`);
}
