import { Plus, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import type {
  ClaimTopic,
  IdentityVerificationConfig,
  TrustedIssuer,
} from '@openzeppelin/rwa-config';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@openzeppelin/ui-components';
import { cn } from '@openzeppelin/ui-utils';

import { Badge } from '../../../components/shared/Badge';
import { useAddressing } from '../../../services/runtime';

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
  const [draftAddress, setDraftAddress] = useState('');
  const [touched, setTouched] = useState(false);
  const atLimit = identity.trustedIssuers.length >= maxTrustedIssuers;
  const availableTopics = identity.claimTopics;

  const validationError = useMemo(() => {
    if (!touched || !draftAddress.trim()) return undefined;
    if (addressing && !addressing.isValidAddress(draftAddress.trim())) {
      return 'Invalid address format for the selected chain';
    }
    if (identity.trustedIssuers.some((iss) => iss.address === draftAddress.trim())) {
      return 'Issuer already added';
    }
    return undefined;
  }, [touched, draftAddress, addressing, identity.trustedIssuers]);

  const canAdd = draftAddress.trim() && !atLimit && !validationError;

  const handleAdd = useCallback(() => {
    const address = draftAddress.trim();
    if (!address || atLimit) return;
    if (addressing && !addressing.isValidAddress(address)) return;
    const newIssuer: TrustedIssuer = { address, claimTopics: [] };
    onUpdate({ trustedIssuers: [...identity.trustedIssuers, newIssuer] });
    setDraftAddress('');
    setTouched(false);
  }, [draftAddress, atLimit, addressing, identity.trustedIssuers, onUpdate]);

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
      <CardHeader>
        <CardTitle>Trusted Issuers</CardTitle>
        <CardDescription>
          Configure trusted authorities that can issue identity claims.
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
          />
        ))}

        <div className="space-y-2">
          <Label>Issuer Contract Address</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Enter issuer contract address"
              value={draftAddress}
              onChange={(e) => {
                setDraftAddress(e.target.value);
                if (!touched) setTouched(true);
              }}
              disabled={atLimit}
              className={cn(
                'flex-1',
                validationError && 'border-destructive focus-visible:ring-destructive'
              )}
            />
          </div>
          {validationError && <p className="text-xs text-destructive">{validationError}</p>}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Permitted Claim Topics</Label>
            <div className="flex flex-wrap gap-1">
              {availableTopics.map((t) => (
                <Badge key={t.id} variant="outline">
                  {t.name}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAdd}
              disabled={!canAdd}
              className="gap-1.5"
            >
              <Plus className="size-4" />
              Add Trusted Issuer
            </Button>
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
}: {
  issuer: TrustedIssuer;
  index: number;
  availableTopics: ClaimTopic[];
  onRemove: (index: number) => void;
  onToggleTopic: (issuerIndex: number, topicId: number) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-sm">{issuer.address}</span>
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
      <div className="flex flex-wrap gap-1.5">
        {availableTopics.map((topic) => {
          const isPermitted = issuer.claimTopics.includes(topic.id);
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => onToggleTopic(index, topic.id)}
              className={cn(
                'rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
                isPermitted
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted'
              )}
            >
              {topic.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
