import { useCallback } from 'react';

import type { ClaimTopic, IdentityVerificationConfig } from '@openzeppelin/rwa-config';
import { MAX_CLAIM_TOPICS, PREDEFINED_CLAIM_TOPICS } from '@openzeppelin/rwa-config';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@openzeppelin/ui-components';

import { TopicToggleGroup } from '../../../components/shared/TopicToggleGroup';

interface ClaimTopicsSectionProps {
  identity: IdentityVerificationConfig;
  onUpdate: (patch: Partial<IdentityVerificationConfig>) => void;
}

export function ClaimTopicsSection({ identity, onUpdate }: ClaimTopicsSectionProps) {
  const handleToggle = useCallback(
    (topic: ClaimTopic) => {
      const exists = identity.claimTopics.some((t) => t.id === topic.id);
      if (exists) {
        onUpdate({
          claimTopics: identity.claimTopics.filter((t) => t.id !== topic.id),
        });
      } else {
        onUpdate({
          claimTopics: [...identity.claimTopics, topic],
        });
      }
    },
    [identity.claimTopics, onUpdate]
  );

  const handleAddCustom = useCallback(
    (topic: ClaimTopic) => {
      onUpdate({
        claimTopics: [...identity.claimTopics, topic],
      });
    },
    [identity.claimTopics, onUpdate]
  );

  const handleRemove = useCallback(
    (topicId: number) => {
      onUpdate({
        claimTopics: identity.claimTopics.filter((t) => t.id !== topicId),
      });
    },
    [identity.claimTopics, onUpdate]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Claim Topics</CardTitle>
        <CardDescription>
          Select claim topics to verify (max {MAX_CLAIM_TOPICS}). Predefined: KYC (1), AML (2),
          Accreditation (3), Tax Residency (4).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TopicToggleGroup
          predefinedTopics={PREDEFINED_CLAIM_TOPICS}
          selectedTopics={identity.claimTopics}
          onToggle={handleToggle}
          onAddCustom={handleAddCustom}
          onRemove={handleRemove}
          maxTopics={MAX_CLAIM_TOPICS}
        />
      </CardContent>
    </Card>
  );
}
