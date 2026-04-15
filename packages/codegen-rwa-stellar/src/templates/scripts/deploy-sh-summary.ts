import type { RWAConfig } from '@openzeppelin/rwa-config';

import { resolveStellarDeploymentTarget } from '../../deployment/target';
import {
  CLR,
  shellEcho,
  shellEchoRaw,
  shellSection,
  THIN_SEPARATOR,
  type DeployedContract,
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

  lines.push(shellEcho(`${CLR.dim}${THIN_SEPARATOR}${CLR.rst}`));
  lines.push(shellEchoRaw('  Contract                       Address'));
  lines.push(shellEcho(`${CLR.dim}${THIN_SEPARATOR}${CLR.rst}`));

  for (const contract of contracts) {
    const paddedName = contract.name.padEnd(30);
    lines.push(shellEcho(`  ${CLR.green}${paddedName}${CLR.rst} \${${contract.varName}}`));
  }

  lines.push(shellEcho(`${CLR.dim}${THIN_SEPARATOR}${CLR.rst}`));

  if (explorerUrlTemplate) {
    lines.push('echo ""');
    lines.push(shellEcho(`  ${CLR.bold}Contract Explorer Links:${CLR.rst}`));
    for (const contract of contracts) {
      lines.push(shellEcho(`    ${contract.name}:`));
      lines.push(
        shellEcho(
          `${CLR.dim}      ${explorerUrlTemplate.replace('__CONTRACT_ADDRESS__', `\${${contract.varName}}`)}${CLR.rst}`
        )
      );
    }
  }

  return lines;
}
