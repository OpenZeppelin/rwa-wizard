import * as p from '@clack/prompts';

import type { AccessControlConfig, OperatorRole, OwnershipModel } from '@openzeppelin/rwa-config';

import type { ChainHints } from '../../generators/registry';
import { parseCommaSeparatedList } from '../../utils/comma-list';

function handleCancel(value: unknown): void {
  if (p.isCancel(value)) {
    p.cancel('Wizard cancelled.');
    process.exit(0);
  }
}

async function collectOwnership(hints: ChainHints): Promise<OwnershipModel> {
  const ownershipType = await p.select({
    message: 'Ownership model',
    options: [
      { value: 'single-owner', label: 'Single Owner', hint: 'One address controls the contracts' },
      { value: 'multi-sig', label: 'Multi-Sig', hint: 'Multi-signature wallet as admin' },
      { value: 'dao', label: 'DAO', hint: 'DAO contract as admin' },
    ],
  });
  handleCancel(ownershipType);

  const address = await p.text({
    message:
      ownershipType === 'single-owner'
        ? 'Owner address'
        : ownershipType === 'multi-sig'
          ? 'Multi-sig address'
          : 'DAO contract address',
    placeholder: hints.addressPlaceholder,
    validate: (v) => {
      if (!v.trim()) return 'Address is required';
    },
  });
  handleCancel(address);

  const addr = (address as string).trim();
  if (ownershipType === 'single-owner') {
    return { type: 'single-owner', ownerAddress: addr };
  }
  return { type: ownershipType as 'multi-sig' | 'dao', address: addr };
}

async function collectRoles(hints: ChainHints): Promise<OperatorRole[]> {
  const roles: OperatorRole[] = [];
  const maxLen = hints.roleSymbolMaxLength;

  const addFirst = await p.confirm({
    message: 'Add operator roles?',
    initialValue: true,
  });
  handleCancel(addFirst);

  if (!addFirst) return roles;

  let addMore = true;
  while (addMore) {
    const name = await p.text({
      message: `Role #${roles.length + 1} — Name`,
      placeholder: 'e.g. Manager, Agent, Operator',
      validate: (v) => {
        if (!v.trim()) return 'Role name is required';
      },
    });
    handleCancel(name);

    const symbolInput = await p.text({
      message: `Role #${roles.length + 1} — Symbol (max ${maxLen} chars, leave empty to auto-generate)`,
      defaultValue: '',
      validate: (v) => {
        const t = v.trim();
        if (t && t.length > maxLen) return `Symbol must be ${maxLen} characters or fewer`;
      },
    });
    handleCancel(symbolInput);

    const addressesRaw = await p.text({
      message: `Role #${roles.length + 1} — Addresses (comma-separated)`,
      placeholder: hints.addressPlaceholder,
      validate: (v) => {
        if (parseCommaSeparatedList(v).length === 0) return 'At least one address is required';
      },
    });
    handleCancel(addressesRaw);

    const addresses = parseCommaSeparatedList(addressesRaw as string);

    const role: OperatorRole = {
      name: (name as string).trim(),
      addresses,
    };

    const sym = (symbolInput as string).trim();
    if (sym) {
      role.symbol = sym;
    }

    roles.push(role);

    const more = await p.confirm({
      message: 'Add another role?',
      initialValue: false,
    });
    handleCancel(more);
    addMore = more as boolean;
  }

  return roles;
}

export async function rolesStep(hints: ChainHints): Promise<AccessControlConfig> {
  p.log.step('Step 4/6 — Roles & Access Control');

  const ownership = await collectOwnership(hints);
  const roles = await collectRoles(hints);

  return { ownership, roles };
}
