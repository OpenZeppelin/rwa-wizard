import * as p from '@clack/prompts';

import type { AccessControlConfig, OperatorRole, OwnershipModel } from '@openzeppelin/rwa-config';

import type { ChainHints, OperatorRolePreset } from '../../generators/registry';
import { parseCommaSeparatedList } from '../../utils/comma-list';
import { handleWizardCancel } from '../utils';

async function collectOwnership(hints: ChainHints): Promise<OwnershipModel> {
  const ownershipType = await p.select({
    message: 'Ownership model',
    options: [
      { value: 'single-owner', label: 'Single Owner', hint: 'One address controls the contracts' },
      { value: 'multi-sig', label: 'Multi-Sig', hint: 'Multi-signature wallet as admin' },
      { value: 'dao', label: 'DAO', hint: 'DAO contract as admin' },
    ],
  });
  handleWizardCancel(ownershipType);

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
  handleWizardCancel(address);

  const addr = (address as string).trim();
  if (ownershipType === 'single-owner') {
    return { type: 'single-owner', ownerAddress: addr };
  }
  return { type: ownershipType as 'multi-sig' | 'dao', address: addr };
}

async function collectCustomRole(hints: ChainHints, roleIndex: number): Promise<OperatorRole> {
  const name = await p.text({
    message: `Role #${roleIndex} — Name`,
    placeholder: 'e.g. Manager, Agent, Operator',
    validate: (v) => {
      if (!v.trim()) return 'Role name is required';
    },
  });
  handleWizardCancel(name);

  const symbolInput = await p.text({
    message: `Role #${roleIndex} — Symbol (max ${hints.roleSymbolMaxLength} chars, leave empty to auto-generate)`,
    defaultValue: '',
    validate: (v) => {
      const t = v.trim();
      if (t && t.length > hints.roleSymbolMaxLength) {
        return `Symbol must be ${hints.roleSymbolMaxLength} characters or fewer`;
      }
    },
  });
  handleWizardCancel(symbolInput);

  const addressesRaw = await p.text({
    message: `Role #${roleIndex} — Addresses (comma-separated)`,
    placeholder: hints.addressPlaceholder,
    validate: (v) => {
      if (parseCommaSeparatedList(v).length === 0) return 'At least one address is required';
    },
  });
  handleWizardCancel(addressesRaw);

  const role: OperatorRole = {
    name: (name as string).trim(),
    addresses: parseCommaSeparatedList(addressesRaw as string),
  };

  const sym = (symbolInput as string).trim();
  if (sym) {
    role.symbol = sym;
  }

  return role;
}

async function collectCustomRoles(hints: ChainHints, startIndex: number): Promise<OperatorRole[]> {
  const roles: OperatorRole[] = [];
  let addMore = true;

  while (addMore) {
    roles.push(await collectCustomRole(hints, startIndex + roles.length));
    const more = await p.confirm({
      message: 'Add another custom role?',
      initialValue: false,
    });
    handleWizardCancel(more);
    addMore = more as boolean;
  }

  return roles;
}

async function collectPresetRoles(
  presets: OperatorRolePreset[],
  hints: ChainHints
): Promise<OperatorRole[]> {
  const selected = await p.multiselect({
    message: 'Select predefined operator roles (space to toggle)',
    options: presets.map((preset) => ({
      value: preset.id,
      label: preset.name,
    })),
    required: false,
  });
  handleWizardCancel(selected);

  const roles: OperatorRole[] = [];
  for (const presetId of selected as string[]) {
    const preset = presets.find((entry) => entry.id === presetId);
    if (!preset) {
      continue;
    }

    const addressesRaw = await p.text({
      message: `${preset.name} — Addresses (comma-separated)`,
      placeholder: hints.addressPlaceholder,
      validate: (v) => {
        if (parseCommaSeparatedList(v).length === 0) return 'At least one address is required';
      },
    });
    handleWizardCancel(addressesRaw);

    const role: OperatorRole = {
      name: preset.name,
      addresses: parseCommaSeparatedList(addressesRaw as string),
    };
    if (preset.defaultSymbol) {
      role.symbol = preset.defaultSymbol;
    }
    roles.push(role);
  }

  return roles;
}

export async function rolesStep(
  hints: ChainHints,
  rolePresets: OperatorRolePreset[] = []
): Promise<AccessControlConfig> {
  p.log.step('Step 4/6 — Roles & Access Control');

  const ownership = await collectOwnership(hints);
  let roles: OperatorRole[] = [];

  if (rolePresets.length > 0) {
    roles = await collectPresetRoles(rolePresets, hints);

    const addCustom = await p.confirm({
      message: 'Add additional custom roles?',
      initialValue: false,
    });
    handleWizardCancel(addCustom);
    if (addCustom) {
      roles.push(...(await collectCustomRoles(hints, roles.length + 1)));
    }
  } else {
    const addFirst = await p.confirm({
      message: 'Add operator roles?',
      initialValue: true,
    });
    handleWizardCancel(addFirst);

    if (addFirst) {
      roles = await collectCustomRoles(hints, 1);
    }
  }

  return { ownership, roles };
}
