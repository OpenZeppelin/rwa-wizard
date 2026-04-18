import { useCallback } from 'react';

import type { ClaimTopic, IdentityVerificationConfig } from '@openzeppelin/rwa-config';
import { MAX_CLAIM_TOPICS, PREDEFINED_CLAIM_TOPICS } from '@openzeppelin/rwa-config';
import { Card, CardContent } from '@openzeppelin/ui-components';

import { useSectionCopy } from '../../../app/providers/useStepCopy';
import { SectionCardHeader } from '../../../components/shared/SectionCardHeader';
import { TopicToggleGroup } from '../../../components/shared/TopicToggleGroup';

interface ClaimTopicsSectionProps {
  identity: IdentityVerificationConfig;
  onUpdate: (patch: Partial<IdentityVerificationConfig>) => void;
}

export function ClaimTopicsSection({ identity, onUpdate }: ClaimTopicsSectionProps) {
  const sectionCopy = useSectionCopy('claim-topics');
  /**
   * When a topic is removed we also prune it from every trusted issuer so the
   * persisted config never references orphaned topic ids.
   */
  const pruneIssuerTopics = useCallback(
    (topicId: number) =>
      identity.trustedIssuers.map((iss) =>
        iss.claimTopics.includes(topicId)
          ? { ...iss, claimTopics: iss.claimTopics.filter((id) => id !== topicId) }
          : iss
      ),
    [identity.trustedIssuers]
  );

  const handleToggle = useCallback(
    (topic: ClaimTopic) => {
      const exists = identity.claimTopics.some((t) => t.id === topic.id);
      if (exists) {
        onUpdate({
          claimTopics: identity.claimTopics.filter((t) => t.id !== topic.id),
          trustedIssuers: pruneIssuerTopics(topic.id),
        });
      } else {
        onUpdate({
          claimTopics: [...identity.claimTopics, topic],
        });
      }
    },
    [identity.claimTopics, onUpdate, pruneIssuerTopics]
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
        trustedIssuers: pruneIssuerTopics(topicId),
      });
    },
    [identity.claimTopics, onUpdate, pruneIssuerTopics]
  );

  return (
    <Card>
      <SectionCardHeader {...sectionCopy} />
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
