import * as p from '@clack/prompts';

import type { RWAConfig } from '@openzeppelin/rwa-config';

import { assetStep } from './steps/asset';
import { complianceStep } from './steps/compliance';
import { deploymentStep } from './steps/deployment';
import { identityStep } from './steps/identity';
import { reviewStep } from './steps/review';
import { rolesStep } from './steps/roles';

import type { GeneratorAdapter } from '../generators/registry';
import { handleWizardCancel } from './utils';

export interface WizardResult {
  config: RWAConfig;
  outputFormat: 'files' | 'zip';
}

export async function runWizard(adapter: GeneratorAdapter): Promise<WizardResult | null> {
  p.intro(`RWA Wizard — ${adapter.name}`);

  const { hints } = adapter;

  const token = await assetStep(hints);
  const identityVerification = await identityStep(hints);

  const availableModules = adapter.getAvailableModules();
  const compliance = await complianceStep(availableModules);

  const accessControl = await rolesStep(hints);
  const deployment = await deploymentStep(adapter);

  const config: RWAConfig = {
    token,
    identityVerification,
    compliance,
    accessControl,
    deployment,
  };

  const confirmed = await reviewStep(config);
  if (!confirmed) {
    p.cancel('Generation cancelled.');
    return null;
  }

  const outputFormat = await p.select({
    message: 'Output format',
    options: [
      { value: 'files', label: 'File tree', hint: 'Write files directly to the output directory' },
      { value: 'zip', label: 'ZIP archive', hint: 'Package as a downloadable ZIP file' },
    ],
  });
  handleWizardCancel(outputFormat);

  return { config, outputFormat: outputFormat as 'files' | 'zip' };
}
