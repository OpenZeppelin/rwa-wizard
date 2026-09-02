import { AlertTriangle, Plus, X } from 'lucide-react';
import { useCallback } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import type {
  ClaimTopic,
  IdentityVerificationConfig,
  TrustedIssuer,
} from '@openzeppelin/rwa-config';
import { isClaimTopicSelected } from '@openzeppelin/rwa-config';
import {
  AddressFieldWithResolvedPreview,
  Button,
  Card,
  CardContent,
  Label,
} from '@openzeppelin/ui-components';
import { ResolvedAddressFieldPreviewWithNameResolution } from '@openzeppelin/ui-renderer';
import { cn } from '@openzeppelin/ui-utils';

import { useCopy } from '../../../../app/providers/useCopy';
import { useSectionCopy } from '../../../../app/providers/useStepCopy';
import { useWizardStore } from '../../../../app/state/useWizardStore';
import { ResolvedAddressDisplay } from '../../../../components/shared/ResolvedAddressDisplay';
import { SectionCardHeader } from '../../../../components/shared/SectionCardHeader';
import { TogglePill } from '../../../../components/shared/TogglePill';
import { useAddressing, useExplorer } from '../../../../services/runtime';
import { ISSUER_DRAFT_ANCHOR, issuerAnchor, issuerTopicsAnchor } from '../../focused-path';
import { useInspectAnchor, useIsInspected } from '../../inspected-anchor';
import { getIdentityStepIssues } from '../../validation/stepValidators';

interface IssuerDraftForm {
  address: string;
}

interface TrustedIssuersSectionProps {
  identity: IdentityVerificationConfig;
  maxTrustedIssuers: number;
  onUpdate: (patch: Partial<IdentityVerificationConfig>) => void;
}

export function TrustedIssuersSection({
  identity,
  maxTrustedIssuers,
  onUpdate,
}: TrustedIssuersSectionProps) {
  const addressing = useAddressing();
  const inspect = useInspectAnchor();
  const previewNetworkId = useWizardStore((s) => s.activeNetworkId) ?? undefined;
  const explorer = useExplorer();
  const sectionCopy = useSectionCopy('trusted-issuers');
  const copy = useCopy();
  const issuerAddressHelper = copy.fieldHelper('trusted-issuer.address').description;
  const duplicateMessage = copy.notice('trusted-issuer.duplicate').description;
  const noTopicsMessage = copy.notice('trusted-issuer.no-topics').description;
  const unselectedTopicsMessage = copy.notice('trusted-issuer.unselected-topics').description;
  const unknownTopicsMessage = copy.notice('trusted-issuer.unknown-topics').description;
  const topicNotDeployedMessage = copy.notice('trusted-issuer.topic-not-deployed').description;
  const atLimit = identity.trustedIssuers.length >= maxTrustedIssuers;
  const availableTopics = identity.claimTopics;
  const selectedTopics = availableTopics.filter(isClaimTopicSelected);
  const identityIssues = getIdentityStepIssues(identity);
  const showUnknownTopicsNotice = identityIssues.includes('trusted-issuer.unknown-topics');
  const showUnselectedTopicsNotice = identityIssues.includes('trusted-issuer.unselected-topics');

  const { control, handleSubmit, reset, watch } = useForm<IssuerDraftForm>({
    defaultValues: { address: '' },
    mode: 'onChange',
  });

  const previewAddress = useWatch({ control, name: 'address' });
  const draftAddress = watch('address');
  const trimmedDraft = draftAddress?.trim() ?? '';

  const isDuplicate = identity.trustedIssuers.some((iss) => iss.address === trimmedDraft);
  // Treat "no addressing adapter" as pass-through so we do not hard-block users
  // when the adapter capability snapshot has not resolved yet.
  const isValidAddress = !trimmedDraft || !addressing || addressing.isValidAddress(trimmedDraft);

  const handleAdd = useCallback(
    (data: IssuerDraftForm) => {
      const address = data.address.trim();
      if (!address || atLimit || isDuplicate) return;
      if (addressing && !addressing.isValidAddress(address)) return;
      const newIssuer: TrustedIssuer = {
        address,
        claimTopics: selectedTopics.map((t) => t.id),
      };
      onUpdate({ trustedIssuers: [...identity.trustedIssuers, newIssuer] });
      // Written, not inferred from where focus went — the same reason as the
      // custom-topic form, and here the ordering is genuinely different: this
      // runs through `handleSubmit`, which is async, so it lands a microtask
      // *after* the document click listener has already resolved the Add
      // button. The direct write still wins, because the listener's competing
      // write is to a draft anchor and `inspect` refuses those. It is the
      // refusal doing the work, not the ordering — do not "fix" one by
      // reordering the other. INV-19.
      inspect(issuerAnchor(address));
      reset({ address: '' });
      // Repeat entry: the next address goes in the same field. Safe for the
      // same reason as above — the draft anchor this focus resolves to is not
      // inspectable.
      document.getElementById('trusted-issuer-address')?.focus();
    },
    [
      atLimit,
      isDuplicate,
      addressing,
      selectedTopics,
      identity.trustedIssuers,
      onUpdate,
      inspect,
      reset,
    ]
  );

  const handleRemove = useCallback(
    (index: number) => {
      onUpdate({
        trustedIssuers: identity.trustedIssuers.filter((_, i) => i !== index),
      });
    },
    [identity.trustedIssuers, onUpdate]
  );

  const toggleIssuerTopic = useCallback(
    (issuerIndex: number, topicId: number) => {
      onUpdate({
        trustedIssuers: identity.trustedIssuers.map((iss, i) => {
          if (i !== issuerIndex) return iss;
          const has = iss.claimTopics.includes(topicId);
          return {
            ...iss,
            claimTopics: has
              ? iss.claimTopics.filter((id) => id !== topicId)
              : [...iss.claimTopics, topicId],
          };
        }),
      });
    },
    [identity.trustedIssuers, onUpdate]
  );

  return (
    <Card>
      <SectionCardHeader {...sectionCopy} />
      <CardContent className="space-y-4">
        {showUnknownTopicsNotice && (
          <div className="flex items-center gap-1.5 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>{unknownTopicsMessage}</span>
          </div>
        )}
        {showUnselectedTopicsNotice && (
          <div className="flex items-center gap-1.5 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>{unselectedTopicsMessage}</span>
          </div>
        )}
        {identity.trustedIssuers.map((issuer, index) => (
          <IssuerRow
            key={issuer.address}
            issuer={issuer}
            index={index}
            availableTopics={availableTopics}
            onRemove={handleRemove}
            onToggleTopic={toggleIssuerTopic}
            getExplorerUrl={explorer ? (addr) => explorer.getExplorerUrl(addr) : undefined}
            noTopicsMessage={noTopicsMessage}
            topicNotDeployedMessage={topicNotDeployedMessage}
          />
        ))}

        <div className="space-y-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <AddressFieldWithResolvedPreview
                id="trusted-issuer-address"
                name="address"
                label="Claim Issuer Contract Address"
                placeholder="Address of the deployed Claim Issuer contract"
                helperText={
                  isDuplicate
                    ? duplicateMessage
                    : availableTopics.length > 0
                      ? issuerAddressHelper
                      : undefined
                }
                control={control}
                addressing={addressing ?? undefined}
                validation={{ required: false }}
                previewAddress={previewAddress}
                previewNetworkId={previewNetworkId}
                preview={
                  <ResolvedAddressFieldPreviewWithNameResolution
                    address={previewAddress}
                    networkId={previewNetworkId}
                    addressing={addressing ?? undefined}
                  />
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              {/* Invisible label mirrors the AddressField's label height */}
              <Label className="invisible" aria-hidden="true">
                &nbsp;
              </Label>
              <div className="flex h-10 items-center">
                <Button
                  type="button"
                  data-config-anchor={ISSUER_DRAFT_ANCHOR}
                  onClick={handleSubmit(handleAdd)}
                  size="sm"
                  disabled={!trimmedDraft || atLimit || isDuplicate || !isValidAddress}
                >
                  <Plus className="mr-1 size-4" />
                  Add
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function IssuerRow({
  issuer,
  index,
  availableTopics,
  onRemove,
  onToggleTopic,
  getExplorerUrl,
  noTopicsMessage,
  topicNotDeployedMessage,
}: {
  issuer: TrustedIssuer;
  index: number;
  availableTopics: ClaimTopic[];
  onRemove: (index: number) => void;
  onToggleTopic: (issuerIndex: number, topicId: number) => void;
  getExplorerUrl?: (address: string) => string | null;
  noTopicsMessage: string;
  topicNotDeployedMessage: string;
}) {
  const hasNoTopics = issuer.claimTopics.length === 0;
  const anchor = issuerAnchor(issuer.address);
  const inspected = useIsInspected(anchor);

  return (
    <div
      // Moved here from the remove button below, not duplicated. One attribute
      // means the row and its `×` resolve to the same anchor by construction,
      // so inspection and removal cannot disagree about which issuer is meant —
      // two attributes could drift apart in a later edit and leave the user
      // inspecting row 2 and deleting row 1. INV-6.
      //
      // No `role`, no `tabIndex`: the row is not interactive and gains no tab
      // stop. The pointer path works through the document click listener and
      // the keyboard path through the outward walk from the controls already
      // inside it. INV-34.
      data-config-anchor={anchor}
      aria-current={inspected ? 'true' : undefined}
      className={cn(
        'space-y-3 rounded-lg border p-3',
        hasNoTopics ? 'border-destructive/50 bg-destructive/5' : 'border-border',
        inspected && 'ring-1 ring-primary'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <ResolvedAddressDisplay
          address={issuer.address}
          variant="chip"
          truncateWhenLabeled
          showCopyButton
          explorerUrl={getExplorerUrl?.(issuer.address) ?? undefined}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(index)}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Permitted Claim Topics</Label>
        <div
          data-config-anchor={issuerTopicsAnchor(issuer.address)}
          className="flex flex-wrap gap-1.5"
        >
          {availableTopics.map((topic) => {
            const issuerSelected = issuer.claimTopics.includes(topic.id);
            const deploySelected = isClaimTopicSelected(topic);
            return (
              <TogglePill
                key={topic.id}
                label={topic.name}
                selected={issuerSelected}
                onClick={() => onToggleTopic(index, topic.id)}
                className={
                  issuerSelected && !deploySelected
                    ? 'border-dashed border-muted-foreground/60 bg-muted/40 text-muted-foreground'
                    : undefined
                }
                ariaDescription={!deploySelected ? topicNotDeployedMessage : undefined}
              />
            );
          })}
        </div>
      </div>

      {hasNoTopics && (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span>{noTopicsMessage}</span>
        </div>
      )}
    </div>
  );
}
