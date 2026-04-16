import * as p from '@clack/prompts';
import pc from 'picocolors';

import type {
  AdministrativeControls,
  DeploymentTarget,
  IdentityControls,
  RWAConfig,
} from '@openzeppelin/rwa-config';

function handleCancel(value: unknown): void {
  if (p.isCancel(value)) {
    p.cancel('Wizard cancelled.');
    process.exit(0);
  }
}

const CORE_CONTRACTS = [
  'RWA Token',
  'Compliance',
  'Identity Verifier',
  'Claim Topics & Issuers',
  'Identity Registry Storage',
];

function formatEnabledFlags(flags: Record<string, boolean>): string {
  const enabled = Object.entries(flags)
    .filter(([, v]) => v)
    .map(([k]) => k);
  return enabled.length === 0 ? 'none' : enabled.join(', ');
}

function formatAdministrativeControls(controls: AdministrativeControls): string {
  return formatEnabledFlags({
    burnable: controls.burnable,
    mintable: controls.mintable,
    pausable: controls.pausable,
  });
}

function formatIdentityControls(controls: IdentityControls): string {
  return formatEnabledFlags({
    addressFreezing: controls.addressFreezing,
    partialTokenFreezing: controls.partialTokenFreezing,
    recovery: controls.recovery,
    forcedTransfers: controls.forcedTransfers,
  });
}

function formatDeploymentTarget(target: DeploymentTarget): string {
  if (target.kind === 'preset') {
    return `preset ${target.ecosystem}/${target.networkId}`;
  }
  const label = target.label ? ` [${target.label}]` : '';
  return `custom ${target.ecosystem}${label} — ${target.rpcUrl}`;
}

function buildSummary(config: RWAConfig): string {
  const lines: string[] = [];

  lines.push(pc.bold('Token'));
  lines.push(`  Name:      ${config.token.name}`);
  lines.push(`  Symbol:    ${config.token.symbol}`);
  lines.push(`  Decimals:  ${config.token.decimals}`);
  if (config.token.initialSupply) {
    lines.push(`  Supply:    ${config.token.initialSupply}`);
  }
  lines.push(`  Doc Mgr:   ${config.token.documentManager.enabled ? 'enabled' : 'disabled'}`);
  lines.push(`  Admin:     ${formatAdministrativeControls(config.token.administrativeControls)}`);

  lines.push('');
  lines.push(pc.bold('Identity'));
  lines.push(`  Topics:    ${config.identityVerification.claimTopics.length}`);
  for (const t of config.identityVerification.claimTopics) {
    lines.push(`    - [${t.id}] ${t.name}`);
  }
  lines.push(`  Issuers:   ${config.identityVerification.trustedIssuers.length}`);
  for (const i of config.identityVerification.trustedIssuers) {
    lines.push(`    - ${i.address} (topics: ${i.claimTopics.join(', ')})`);
  }
  lines.push(`  Controls:  ${formatIdentityControls(config.identityVerification.controls)}`);

  lines.push('');
  lines.push(pc.bold('Compliance'));
  if (config.compliance.modules.length === 0) {
    lines.push('  Modules:   none');
  } else {
    for (const m of config.compliance.modules) {
      lines.push(`  - ${m.moduleId}`);
    }
  }

  lines.push('');
  lines.push(pc.bold('Access Control'));
  lines.push(`  Ownership: ${config.accessControl.ownership.type}`);
  lines.push(`  Roles:     ${config.accessControl.roles.length}`);
  for (const r of config.accessControl.roles) {
    lines.push(
      `  - ${r.name}${r.symbol ? ` [${r.symbol}]` : ''} (${r.addresses.length} address${r.addresses.length !== 1 ? 'es' : ''})`
    );
  }

  lines.push('');
  lines.push(pc.bold('Deployment'));
  lines.push(`  Target:    ${formatDeploymentTarget(config.deployment.target)}`);
  if (config.deployment.sourceAccount) {
    lines.push(`  Source:    ${config.deployment.sourceAccount}`);
  }

  lines.push('');
  lines.push(pc.bold('Contracts to generate'));
  for (const name of CORE_CONTRACTS) {
    lines.push(`  ${pc.green('●')} ${name}`);
  }
  for (const m of config.compliance.modules) {
    lines.push(`  ${pc.green('●')} Module: ${m.moduleId}`);
  }
  const total = CORE_CONTRACTS.length + config.compliance.modules.length;
  lines.push(pc.dim(`  ${total} contracts total`));

  return lines.join('\n');
}

export async function reviewStep(config: RWAConfig): Promise<boolean> {
  p.log.step('Step 5/5 — Review & Generate');

  p.note(buildSummary(config), 'Configuration Summary');

  const confirmed = await p.confirm({
    message: 'Generate project with this configuration?',
    initialValue: true,
  });
  handleCancel(confirmed);

  return confirmed as boolean;
}
