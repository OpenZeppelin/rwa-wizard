import { Command } from 'commander';

import { generateCommand } from './commands/generate';
import { modulesCommand } from './commands/modules';
import { validateCommand } from './commands/validate';
import { registerGenerator } from './generators/registry';
import { stellarAdapter } from './generators/stellar';
import { logger } from './utils/logger';

registerGenerator(stellarAdapter);

const program = new Command();

program
  .name('rwa-wizard')
  .description('CLI tool for generating RWA token projects')
  .version('0.0.0');

program
  .command('generate')
  .description('Generate an RWA token project. Runs interactively if no config file is provided.')
  .option('-c, --config <path>', 'JSON config file (headless mode)')
  .option('-o, --output <path>', 'Output directory or ZIP file path')
  .option('--zip', 'Output as a ZIP archive instead of a file tree')
  .option(
    '--allow-under-review-modules',
    'Allow compliance modules marked as under review upstream (not for production)'
  )
  .option('--chain <name>', 'Target chain', 'stellar')
  .action(
    async (opts: {
      config?: string;
      output?: string;
      zip?: boolean;
      chain: string;
      allowUnderReviewModules?: boolean;
    }) => {
      if (!opts.output) {
        if (opts.config) {
          logger.error('--output is required when using --config');
          process.exit(1);
        }
        opts.output = '.';
      }

      await generateCommand({
        config: opts.config,
        output: opts.output,
        zip: opts.zip,
        chain: opts.chain,
        allowUnderReviewModules: opts.allowUnderReviewModules,
      });
    }
  );

program
  .command('validate')
  .description('Validate an RWA config file without generating')
  .requiredOption('-c, --config <path>', 'JSON config file to validate')
  .option(
    '--allow-under-review-modules',
    'Allow compliance modules marked as under review upstream (not for production)'
  )
  .option('--chain <name>', 'Target chain', 'stellar')
  .action((opts: { config: string; chain: string; allowUnderReviewModules?: boolean }) => {
    validateCommand({
      config: opts.config,
      chain: opts.chain,
      allowUnderReviewModules: opts.allowUnderReviewModules,
    });
  });

program
  .command('modules')
  .description('List available compliance modules')
  .option('--chain <name>', 'Target chain', 'stellar')
  .action((opts: { chain: string }) => {
    modulesCommand({ chain: opts.chain });
  });

program.parseAsync(process.argv);
