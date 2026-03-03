import * as p from '@clack/prompts';

import type { TokenConfig } from '@openzeppelin/rwa-config';

import type { ChainHints } from '../../generators/registry';

function handleCancel(value: unknown): void {
  if (p.isCancel(value)) {
    p.cancel('Wizard cancelled.');
    process.exit(0);
  }
}

export async function assetStep(hints: ChainHints): Promise<TokenConfig> {
  p.log.step('Step 1/5 — Asset Configuration');

  const name = await p.text({
    message: 'Token name',
    placeholder: 'e.g. My RWA Token',
    validate: (v) => {
      if (!v.trim()) return 'Token name is required';
      if (v.length > hints.tokenNameMaxLength)
        return `Token name must be ${hints.tokenNameMaxLength} characters or fewer`;
    },
  });
  handleCancel(name);

  const symbol = await p.text({
    message: 'Token symbol',
    placeholder: 'e.g. MRWA',
    validate: (v) => {
      if (!v.trim()) return 'Token symbol is required';
      if (v.length > hints.tokenSymbolMaxLength)
        return `Token symbol must be ${hints.tokenSymbolMaxLength} characters or fewer`;
    },
  });
  handleCancel(symbol);

  const decimalsStr = await p.text({
    message: `Decimals (${hints.decimalsMin}–${hints.decimalsMax})`,
    defaultValue: String(hints.decimalsMax),
    validate: (v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < hints.decimalsMin || n > hints.decimalsMax)
        return `Decimals must be an integer ${hints.decimalsMin}–${hints.decimalsMax}`;
    },
  });
  handleCancel(decimalsStr);

  const hasInitialSupply = await p.confirm({
    message: 'Set an initial supply?',
    initialValue: false,
  });
  handleCancel(hasInitialSupply);

  let initialSupply: string | undefined;
  if (hasInitialSupply) {
    const supplyValue = await p.text({
      message: 'Initial supply (whole units)',
      placeholder: 'e.g. 1000000',
      validate: (v) => {
        if (!v.trim()) return 'Supply is required if enabled';
        try {
          if (BigInt(v) <= 0n) return 'Supply must be positive';
        } catch {
          return 'Supply must be a valid integer';
        }
      },
    });
    handleCancel(supplyValue);
    initialSupply = supplyValue as string;
  }

  const docManager = await p.confirm({
    message: 'Enable Document Manager?',
    initialValue: true,
  });
  handleCancel(docManager);

  return {
    name: (name as string).trim(),
    symbol: (symbol as string).trim(),
    decimals: Number(decimalsStr as string),
    ...(initialSupply ? { initialSupply } : {}),
    documentManager: { enabled: docManager as boolean },
  };
}
