import { AlertTriangle, Plus, X } from 'lucide-react';
import { useCallback } from 'react';
import { useForm } from 'react-hook-form';

import type {
  ClaimTopic,
  IdentityVerificationConfig,
  TrustedIssuer,
} from '@openzeppelin/rwa-config';
import {
  AddressDisplay,
  AddressField,
  Button,
  Card,
  CardContent,
  Label,
} from '@openzeppelin/ui-components';
import { cn } from '@openzeppelin/ui-utils';

import { useCopy } from '../../../app/providers/useCopy';
import { useSectionCopy } from '../../../app/providers/useStepCopy';
import { SectionCardHeader } from '../../../components/shared/SectionCardHeader';
import { TogglePill } from '../../../components/shared/TogglePill';
import { useAddressing, useExplorer } from '../../../services/runtime';

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
  const explorer = useExplorer();
  const sectionCopy = useSectionCopy('trusted-issuers');
  const copy = useCopy();
  const issuerAddressHelper = copy.fieldHelper('trusted-issuer.address').description;
  const duplicateMessage = copy.notice('trusted-issuer.duplicate').description;
  const invalidAddressMessage = copy.notice('trusted-issuer.invalid-address').description;
  const noTopicsMessage = copy.notice('trusted-issuer.no-topics').description;
  const atLimit = identity.trustedIssuers.length >= maxTrustedIssuers;
  const availableTopics = identity.claimTopics;

  const { control, handleSubmit, reset, watch } = useForm<IssuerDraftForm>({
    defaultValues: { address: '' },
    mode: 'onChange',
  });

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
        claimTopics: availableTopics.map((t) => t.id),
      };
      onUpdate({ trustedIssuers: [...identity.trustedIssuers, newIssuer] });
      reset({ address: '' });
    },
    [atLimit, isDuplicate, addressing, availableTopics, identity.trustedIssuers, onUpdate, reset]
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

  const validationMessage = isDuplicate
    ? duplicateMessage
    : trimmedDraft && !isValidAddress
      ? invalidAddressMessage
      : undefined;

  return (
    <Card>
      <SectionCardHeader {...sectionCopy} />
      <CardContent className="space-y-4">
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
          />
        ))}

        <div className="space-y-1">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <AddressField
                id="trusted-issuer-address"
                name="address"
                label="Claim Issuer Contract Address"
                placeholder="Address of the deployed Claim Issuer contract"
                control={control}
                addressing={addressing ?? undefined}
                validation={{ required: false }}
              />
            </div>
            <Button
              type="button"
              onClick={handleSubmit(handleAdd)}
              size="sm"
              disabled={!trimmedDraft || atLimit || isDuplicate || !isValidAddress}
              className="mb-0.5"
            >
              <Plus className="mr-1 size-4" />
              Add
            </Button>
          </div>
          {(validationMessage || availableTopics.length > 0) && (
            <p
              className={cn(
                'text-xs',
                validationMessage ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {validationMessage ?? issuerAddressHelper}
            </p>
          )}
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
}: {
  issuer: TrustedIssuer;
  index: number;
  availableTopics: ClaimTopic[];
  onRemove: (index: number) => void;
  onToggleTopic: (issuerIndex: number, topicId: number) => void;
  getExplorerUrl?: (address: string) => string | null;
  noTopicsMessage: string;
}) {
  const hasNoTopics = issuer.claimTopics.length === 0;

  return (
    <div
      className={cn(
        'space-y-3 rounded-lg border p-3',
        hasNoTopics ? 'border-destructive/50 bg-destructive/5' : 'border-border'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <AddressDisplay
          address={issuer.address}
          variant="inline"
          truncate={false}
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
        <div className="flex flex-wrap gap-1.5">
          {availableTopics.map((topic) => (
            <TogglePill
              key={topic.id}
              label={topic.name}
              selected={issuer.claimTopics.includes(topic.id)}
              onClick={() => onToggleTopic(index, topic.id)}
            />
          ))}
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
