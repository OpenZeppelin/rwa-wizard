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
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from '@openzeppelin/ui-components';
import { cn } from '@openzeppelin/ui-utils';

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
  const atLimit = identity.trustedIssuers.length >= maxTrustedIssuers;
  const availableTopics = identity.claimTopics;

  const { control, handleSubmit, reset, watch } = useForm<IssuerDraftForm>({
    defaultValues: { address: '' },
    mode: 'onChange',
  });

  const draftAddress = watch('address');

  const isDuplicate = identity.trustedIssuers.some((iss) => iss.address === draftAddress?.trim());

  const handleAdd = useCallback(
    (data: IssuerDraftForm) => {
      const address = data.address.trim();
      if (!address || atLimit || isDuplicate) return;
      const newIssuer: TrustedIssuer = {
        address,
        claimTopics: availableTopics.map((t) => t.id),
      };
      onUpdate({ trustedIssuers: [...identity.trustedIssuers, newIssuer] });
      reset({ address: '' });
    },
    [atLimit, isDuplicate, availableTopics, identity.trustedIssuers, onUpdate, reset]
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

  const duplicateValidation = isDuplicate ? 'Issuer already added' : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trusted Issuers</CardTitle>
        <CardDescription>
          Configure trusted authorities that can issue identity claims. Each issuer must be
          permitted to verify at least one claim topic.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {identity.trustedIssuers.map((issuer, index) => (
          <IssuerRow
            key={index}
            issuer={issuer}
            index={index}
            availableTopics={availableTopics}
            onRemove={handleRemove}
            onToggleTopic={toggleIssuerTopic}
            getExplorerUrl={explorer ? (addr) => explorer.getExplorerUrl(addr) : undefined}
          />
        ))}

        <div className="space-y-1">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <AddressField
                id="trusted-issuer-address"
                name="address"
                label="Issuer Contract Address"
                placeholder="Enter issuer contract address"
                control={control}
                addressing={addressing ?? undefined}
                validation={{ required: false }}
              />
            </div>
            <Button
              type="button"
              onClick={handleSubmit(handleAdd)}
              size="sm"
              disabled={!draftAddress?.trim() || atLimit || isDuplicate}
              className="mb-0.5"
            >
              <Plus className="mr-1 size-4" />
              Add
            </Button>
          </div>
          {(duplicateValidation || availableTopics.length > 0) && (
            <p className="text-xs text-muted-foreground">
              {duplicateValidation ?? 'New issuers are auto-permitted for all claim topics.'}
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
}: {
  issuer: TrustedIssuer;
  index: number;
  availableTopics: ClaimTopic[];
  onRemove: (index: number) => void;
  onToggleTopic: (issuerIndex: number, topicId: number) => void;
  getExplorerUrl?: (address: string) => string | null;
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
          <span>Select at least one claim topic for this issuer</span>
        </div>
      )}
    </div>
  );
}
