import * as p from '@clack/prompts';

import type {
  ClaimTopic,
  IdentityVerificationConfig,
  TrustedIssuer,
} from '@openzeppelin/rwa-config';

import type { ChainHints } from '../../generators/registry';

function handleCancel(value: unknown): void {
  if (p.isCancel(value)) {
    p.cancel('Wizard cancelled.');
    process.exit(0);
  }
}

async function collectClaimTopics(): Promise<ClaimTopic[]> {
  const topics: ClaimTopic[] = [];

  const addFirst = await p.confirm({
    message: 'Add a claim topic?',
    initialValue: true,
  });
  handleCancel(addFirst);

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
    handleCancel(id);

    const name = await p.text({
      message: `Claim topic #${topics.length + 1} — Name`,
      placeholder: 'e.g. KYC, AML, Accreditation',
      validate: (v) => {
        if (!v.trim()) return 'Name is required';
      },
    });
    handleCancel(name);

    topics.push({ id: Number(id as string), name: (name as string).trim() });

    const more = await p.confirm({
      message: 'Add another claim topic?',
      initialValue: false,
    });
    handleCancel(more);
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
  handleCancel(addFirst);

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
    handleCancel(address);

    const selectedTopics = await p.multiselect({
      message: `Issuer #${issuers.length + 1} — Claim topics this issuer is trusted for`,
      options: topicIds.map((id) => ({ value: id, label: `Topic ${id}` })),
      required: true,
    });
    handleCancel(selectedTopics);

    issuers.push({
      address: (address as string).trim(),
      claimTopics: selectedTopics as number[],
    });

    const more = await p.confirm({
      message: 'Add another trusted issuer?',
      initialValue: false,
    });
    handleCancel(more);
    addMore = more as boolean;
  }

  return issuers;
}

export async function identityStep(hints: ChainHints): Promise<IdentityVerificationConfig> {
  p.log.step('Step 2/5 — Identity Configuration');

  const claimTopics = await collectClaimTopics();
  const trustedIssuers = await collectTrustedIssuers(
    claimTopics.map((t) => t.id),
    hints
  );

  return { claimTopics, trustedIssuers };
}
