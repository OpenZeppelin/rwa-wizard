import * as p from '@clack/prompts';

import type {
  ClaimTopic,
  IdentityControls,
  IdentityVerificationConfig,
  TrustedIssuer,
} from '@openzeppelin/rwa-config';

import type { ChainHints } from '../../generators/registry';
import { handleWizardCancel } from '../utils';

async function collectIdentityControls(): Promise<IdentityControls> {
  const addressFreezing = await p.confirm({
    message: 'Enable address freezing? (freeze all tokens of a holder)',
    initialValue: true,
  });
  handleWizardCancel(addressFreezing);

  const partialTokenFreezing = await p.confirm({
    message: 'Enable partial token freezing? (freeze a specific amount per holder)',
    initialValue: false,
  });
  handleWizardCancel(partialTokenFreezing);

  const recovery = await p.confirm({
    message: 'Enable wallet recovery? (recover tokens from a lost wallet)',
    initialValue: false,
  });
  handleWizardCancel(recovery);

  const forcedTransfers = await p.confirm({
    message: 'Enable forced transfers? (agent can move tokens between verified holders)',
    initialValue: false,
  });
  handleWizardCancel(forcedTransfers);

  return {
    addressFreezing: addressFreezing as boolean,
    partialTokenFreezing: partialTokenFreezing as boolean,
    recovery: recovery as boolean,
    forcedTransfers: forcedTransfers as boolean,
  };
}

async function collectClaimTopics(): Promise<ClaimTopic[]> {
  const topics: ClaimTopic[] = [];

  const addFirst = await p.confirm({
    message: 'Add a claim topic?',
    initialValue: true,
  });
  handleWizardCancel(addFirst);

  if (!addFirst) return topics;

  let addMore = true;
  while (addMore) {
    const id = await p.text({
      message: `Claim topic #${topics.length + 1} — ID (positive integer)`,
      validate: (v) => {
        const n = Number(v);
        if (!Number.isInteger(n) || n <= 0) return 'Must be a positive integer';
        if (topics.some((t) => t.id === n)) return `Topic ID ${n} already exists`;
      },
    });
    handleWizardCancel(id);

    const name = await p.text({
      message: `Claim topic #${topics.length + 1} — Name`,
      placeholder: 'e.g. KYC, AML, Accreditation',
      validate: (v) => {
        if (!v.trim()) return 'Name is required';
      },
    });
    handleWizardCancel(name);

    topics.push({ id: Number(id as string), name: (name as string).trim() });

    const more = await p.confirm({
      message: 'Add another claim topic?',
      initialValue: false,
    });
    handleWizardCancel(more);
    addMore = more as boolean;
  }

  return topics;
}

async function collectTrustedIssuers(
  topicIds: number[],
  hints: ChainHints
): Promise<TrustedIssuer[]> {
  const issuers: TrustedIssuer[] = [];

  if (topicIds.length === 0) {
    p.log.info('No claim topics defined — skipping trusted issuers.');
    return issuers;
  }

  const addFirst = await p.confirm({
    message: 'Add a trusted issuer?',
    initialValue: true,
  });
  handleWizardCancel(addFirst);

  if (!addFirst) return issuers;

  let addMore = true;
  while (addMore) {
    const address = await p.text({
      message: `Issuer #${issuers.length + 1} — Address`,
      placeholder: hints.addressPlaceholder,
      validate: (v) => {
        if (!v.trim()) return 'Address is required';
      },
    });
    handleWizardCancel(address);

    const selectedTopics = await p.multiselect({
      message: `Issuer #${issuers.length + 1} — Claim topics this issuer is trusted for`,
      options: topicIds.map((id) => ({ value: id, label: `Topic ${id}` })),
      required: true,
    });
    handleWizardCancel(selectedTopics);

    issuers.push({
      address: (address as string).trim(),
      claimTopics: selectedTopics as number[],
    });

    const more = await p.confirm({
      message: 'Add another trusted issuer?',
      initialValue: false,
    });
    handleWizardCancel(more);
    addMore = more as boolean;
  }

  return issuers;
}

export async function identityStep(hints: ChainHints): Promise<IdentityVerificationConfig> {
  p.log.step('Step 2/6 — Identity Configuration');

  const claimTopics = await collectClaimTopics();
  const trustedIssuers = await collectTrustedIssuers(
    claimTopics.map((t) => t.id),
    hints
  );
  const controls = await collectIdentityControls();

  return { claimTopics, trustedIssuers, controls };
}
