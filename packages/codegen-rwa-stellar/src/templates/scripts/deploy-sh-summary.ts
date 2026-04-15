import type { RWAConfig } from '@openzeppelin/rwa-config';

import { resolveStellarDeploymentTarget } from '../../deployment/target';
import {
  type DeployedContract,
  THIN_SEPARATOR,
  shellEcho,
  shellEchoRaw,
  shellSection,
} from './deploy-sh-helpers';

export function buildDeploymentSummary(
  contracts: DeployedContract[],
  config: RWAConfig,
  explorerUrlTemplate: string | undefined
): string[] {
  const lines: string[] = [];
  const deployment = resolveStellarDeploymentTarget(config.deployment.target);

  lines.push(
    ...shellSection(`Deployment Complete — ${config.token.name} (${config.token.symbol})`)
  );

  lines.push(shellEcho('  Network:  ' + deployment.displayName));
  lines.push(shellEcho('  Admin:    $ADMIN'));
  lines.push(shellEcho('  Signer:   $SOURCE_ACCOUNT'));
  lines.push('echo ""');

  lines.push(shellEcho(THIN_SEPARATOR));
  lines.push(shellEchoRaw('  Contract                       Address'));
  lines.push(shellEcho(THIN_SEPARATOR));

  for (const contract of contracts) {
    const paddedName = contract.name.padEnd(30);
    lines.push(shellEcho(`  ${paddedName} \${${contract.varName}}`));
  }

  lines.push(shellEcho(THIN_SEPARATOR));

  if (explorerUrlTemplate) {
    lines.push('echo ""');
    lines.push(shellEcho('  Contract Explorer Links:'));
    for (const contract of contracts) {
      lines.push(shellEcho(`    ${contract.name}:`));
      lines.push(
        shellEcho(
          `      ${explorerUrlTemplate.replace('__CONTRACT_ADDRESS__', `\${${contract.varName}}`)}`
        )
      );
    }
  }

  return lines;
}
