import * as p from '@clack/prompts';

import type {
  CustomDeploymentTarget,
  DeploymentConfig,
  DeploymentTarget,
  PresetDeploymentTarget,
} from '@openzeppelin/rwa-config';

import type { ChainHints, GeneratorAdapter } from '../../generators/registry';
import { handleWizardCancel } from '../utils';

/** RPC endpoints may be HTTP(S) or WebSocket(S). */
const RPC_URL_PROTOCOLS = new Set(['http:', 'https:', 'ws:', 'wss:']);

/** Block explorer links are normal web URLs only. */
const EXPLORER_URL_PROTOCOLS = new Set(['http:', 'https:']);

function validateUrl(
  input: string,
  required: boolean,
  allowedProtocols: Set<string>,
  protocolHint: string
): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) {
    return required ? 'URL is required' : undefined;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return 'Invalid URL';
  }
  if (!allowedProtocols.has(parsed.protocol)) {
    return `URL must use ${protocolHint}`;
  }
  return undefined;
}

function validateRpcUrl(input: string, required: boolean): string | undefined {
  return validateUrl(input, required, RPC_URL_PROTOCOLS, 'http(s) or ws(s)');
}

function validateExplorerUrl(input: string, required: boolean): string | undefined {
  return validateUrl(input, required, EXPLORER_URL_PROTOCOLS, 'http(s)');
}

async function collectPresetTarget(adapter: GeneratorAdapter): Promise<PresetDeploymentTarget> {
  const { networks } = adapter.hints;
  if (networks.length === 0) {
    throw new Error(
      `Adapter "${adapter.chain}" exposes no preset networks. Enable custom RPC or register networks in its hints.`
    );
  }

  const networkId = await p.select({
    message: 'Target network',
    options: networks.map((n) => ({ value: n.value, label: n.label, hint: n.hint })),
  });
  handleWizardCancel(networkId);

  return {
    kind: 'preset',
    ecosystem: adapter.chain,
    networkId: networkId as string,
  };
}

async function collectCustomTarget(adapter: GeneratorAdapter): Promise<CustomDeploymentTarget> {
  const rpcUrl = await p.text({
    message: 'RPC URL',
    placeholder: adapter.hints.customRpcPlaceholder ?? 'https://example.com/rpc',
    validate: (v) => validateRpcUrl(v, true),
  });
  handleWizardCancel(rpcUrl);

  const explorerInput = await p.text({
    message: 'Explorer URL (optional)',
    defaultValue: '',
    validate: (v) => validateExplorerUrl(v, false),
  });
  handleWizardCancel(explorerInput);

  const labelInput = await p.text({
    message: 'Label shown in generated output (optional)',
    defaultValue: '',
  });
  handleWizardCancel(labelInput);

  const target: CustomDeploymentTarget = {
    kind: 'custom',
    ecosystem: adapter.chain,
    rpcUrl: (rpcUrl as string).trim(),
  };

  const explorer = (explorerInput as string).trim();
  if (explorer) {
    target.explorerUrl = explorer;
  }
  const label = (labelInput as string).trim();
  if (label) {
    target.label = label;
  }
  return target;
}

async function collectSourceAccount(hints: ChainHints): Promise<string | undefined> {
  const enabled = await p.confirm({
    message: 'Specify a source account? (defaults to CLI signer)',
    initialValue: false,
  });
  handleWizardCancel(enabled);
  if (!enabled) return undefined;

  const account = await p.text({
    message: 'Source account',
    placeholder: hints.addressPlaceholder,
    validate: (v) => (!v.trim() ? 'Source account is required' : undefined),
  });
  handleWizardCancel(account);
  return (account as string).trim();
}

async function collectDeploymentTarget(adapter: GeneratorAdapter): Promise<DeploymentTarget> {
  const supportsCustomRpc = adapter.hints.supportsCustomRpc !== false;
  const hasPresets = adapter.hints.networks.length > 0;

  if (supportsCustomRpc && hasPresets) {
    const kind = await p.select({
      message: 'Deployment target type',
      options: [
        {
          value: 'preset',
          label: 'Preset network',
          hint: "Use one of the adapter's known networks",
        },
        {
          value: 'custom',
          label: 'Custom RPC',
          hint: 'Point at any custom endpoint',
        },
      ],
      initialValue: 'preset',
    });
    handleWizardCancel(kind);
    return kind === 'custom' ? collectCustomTarget(adapter) : collectPresetTarget(adapter);
  }

  if (supportsCustomRpc) {
    return collectCustomTarget(adapter);
  }

  return collectPresetTarget(adapter);
}

export async function deploymentStep(adapter: GeneratorAdapter): Promise<DeploymentConfig> {
  p.log.step('Step 5/6 — Deployment Target');

  const target = await collectDeploymentTarget(adapter);
  const sourceAccount = await collectSourceAccount(adapter.hints);

  return sourceAccount ? { target, sourceAccount } : { target };
}
