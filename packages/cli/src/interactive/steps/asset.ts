import * as p from '@clack/prompts';

import type { AdministrativeControls, TokenConfig } from '@openzeppelin/rwa-config';

import type { ChainHints } from '../../generators/registry';
import { handleWizardCancel } from '../utils';

async function collectAdministrativeControls(): Promise<AdministrativeControls> {
  const burnable = await p.confirm({
    message: 'Allow the admin to burn tokens? (burnable)',
    initialValue: true,
  });
  handleWizardCancel(burnable);

  const mintable = await p.confirm({
    message: 'Allow the admin to mint new supply? (mintable)',
    initialValue: true,
  });
  handleWizardCancel(mintable);

  const pausable = await p.confirm({
    message: 'Allow the admin to pause the contract? (pausable)',
    initialValue: true,
  });
  handleWizardCancel(pausable);

  return {
    burnable: burnable as boolean,
    mintable: mintable as boolean,
    pausable: pausable as boolean,
  };
}

export async function assetStep(hints: ChainHints): Promise<TokenConfig> {
  p.log.step('Step 1/6 — Asset Configuration');

  const name = await p.text({
    message: 'Token name',
    placeholder: 'e.g. My RWA Token',
    validate: (v) => {
      const t = v.trim();
      if (!t) return 'Token name is required';
      if (t.length > hints.tokenNameMaxLength)
        return `Token name must be ${hints.tokenNameMaxLength} characters or fewer`;
    },
  });
  handleWizardCancel(name);

  const symbol = await p.text({
    message: 'Token symbol',
    placeholder: 'e.g. MRWA',
    validate: (v) => {
      const t = v.trim();
      if (!t) return 'Token symbol is required';
      if (t.length > hints.tokenSymbolMaxLength)
        return `Token symbol must be ${hints.tokenSymbolMaxLength} characters or fewer`;
    },
  });
  handleWizardCancel(symbol);

  const decimalsStr = await p.text({
    message: `Decimals (${hints.decimalsMin}–${hints.decimalsMax})`,
    defaultValue: String(hints.decimalsMax),
    validate: (v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < hints.decimalsMin || n > hints.decimalsMax)
        return `Decimals must be an integer ${hints.decimalsMin}–${hints.decimalsMax}`;
    },
  });
  handleWizardCancel(decimalsStr);

  const hasInitialSupply = await p.confirm({
    message: 'Set an initial supply?',
    initialValue: false,
  });
  handleWizardCancel(hasInitialSupply);

  let initialSupply: string | undefined;
  if (hasInitialSupply) {
    const supplyValue = await p.text({
      message: 'Initial supply (whole units)',
      placeholder: 'e.g. 1000000',
      validate: (v) => {
        const t = v.trim();
        if (!t) return 'Supply is required if enabled';
        try {
          if (BigInt(t) <= 0n) return 'Supply must be positive';
        } catch {
          return 'Supply must be a valid integer';
        }
      },
    });
    handleWizardCancel(supplyValue);
    initialSupply = (supplyValue as string).trim();
  }

  const docManager = await p.confirm({
    message: 'Enable Document Manager?',
    initialValue: true,
  });
  handleWizardCancel(docManager);

  const administrativeControls = await collectAdministrativeControls();

  return {
    name: (name as string).trim(),
    symbol: (symbol as string).trim(),
    decimals: Number(decimalsStr as string),
    ...(initialSupply ? { initialSupply } : {}),
    administrativeControls,
    documentManager: { enabled: docManager as boolean },
  };
}
