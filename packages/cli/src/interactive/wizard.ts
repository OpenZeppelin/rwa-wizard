import * as p from '@clack/prompts';

import type { DeploymentConfig, RWAConfig } from '@openzeppelin/rwa-config';

import { assetStep } from './steps/asset';
import { complianceStep } from './steps/compliance';
import { identityStep } from './steps/identity';
import { reviewStep } from './steps/review';
import { rolesStep } from './steps/roles';

import type { GeneratorAdapter } from '../generators/registry';

function handleCancel(value: unknown): void {
  if (p.isCancel(value)) {
    p.cancel('Wizard cancelled.');
    process.exit(0);
  }
}

async function deploymentStep(adapter: GeneratorAdapter): Promise<DeploymentConfig> {
  const network = await p.select({
    message: 'Target network',
    options: adapter.hints.networks.map((n) => ({
      value: n.value,
      label: n.label,
      hint: n.hint,
    })),
  });
  handleCancel(network);

  return { network: network as string };
}

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
  handleCancel(outputFormat);

  return { config, outputFormat: outputFormat as 'files' | 'zip' };
}
