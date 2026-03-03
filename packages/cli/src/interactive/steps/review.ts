import * as p from '@clack/prompts';
import pc from 'picocolors';

import type { RWAConfig } from '@openzeppelin/rwa-config';

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

  lines.push('');
  lines.push(pc.bold('Compliance'));
  if (config.compliance.modules.length === 0) {
    lines.push('  Modules:   none');
  } else {
    for (const m of config.compliance.modules) {
      lines.push(`  - ${m.moduleId} (hook: ${m.hook})`);
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
  lines.push(`  Network:   ${config.deployment.network}`);

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
