import { useCallback } from 'react';

import type { ClaimTopic, IdentityVerificationConfig } from '@openzeppelin/rwa-config';
import {
  isClaimTopicSelected,
  MAX_CLAIM_TOPICS,
  PREDEFINED_CLAIM_TOPICS,
} from '@openzeppelin/rwa-config';
import { Card, CardContent } from '@openzeppelin/ui-components';

import { useSectionCopy } from '../../../../app/providers/useStepCopy';
import { SectionCardHeader } from '../../../../components/shared/SectionCardHeader';
import { TopicToggleGroup } from '../../../../components/shared/TopicToggleGroup';

interface ClaimTopicsSectionProps {
  identity: IdentityVerificationConfig;
  onUpdate: (patch: Partial<IdentityVerificationConfig>) => void;
}

/** Unselect — SF-16 Integration Patterns. Never touches trustedIssuers. INV-9. */
function unselectTopic(topics: ClaimTopic[], topicId: number): ClaimTopic[] {
  return topics.map((topic) => (topic.id === topicId ? { ...topic, selected: false } : topic));
}

/** Reselect — deletes the key (omit-when-true). Never appends; preserves array index. INV-9. */
function reselectTopic(topics: ClaimTopic[], topicId: number): ClaimTopic[] {
  return topics.map((topic) => {
    if (topic.id !== topicId) return topic;
    const { selected: _dropped, ...rest } = topic;
    return rest;
  });
}

/**
 * Ensure a predefined catalogue topic is present and selected.
 * Only path that may append — used when the topic is absent from the array. INV-9.
 */
function selectAbsentPredefined(topics: ClaimTopic[], topic: ClaimTopic): ClaimTopic[] {
  return [...topics, topic];
}

export function ClaimTopicsSection({ identity, onUpdate }: ClaimTopicsSectionProps) {
  const sectionCopy = useSectionCopy('claim-topics');
  /**
   * When a topic is removed we also prune it from every trusted issuer so the
   * persisted config never references orphaned topic ids. INV-10: this is the
   * sole caller of prune — × only, never the selection control.
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
      const existing = identity.claimTopics.find((t) => t.id === topic.id);
      if (!existing) {
        // Absent predefined → append (sole append path). INV-9 shape 1.
        onUpdate({ claimTopics: selectAbsentPredefined(identity.claimTopics, topic) });
        return;
      }
      if (isClaimTopicSelected(existing)) {
        // Present and selected → write selected: false. Never prune. INV-9/10.
        onUpdate({ claimTopics: unselectTopic(identity.claimTopics, topic.id) });
        return;
      }
      // Present and unselected → omit-when-true reselect, same index. INV-9 shape 3.
      onUpdate({ claimTopics: reselectTopic(identity.claimTopics, topic.id) });
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
