import { Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import type { ClaimTopic } from '@openzeppelin/rwa-config';
import { MIN_CUSTOM_CLAIM_TOPIC_ID } from '@openzeppelin/rwa-config';
import { Button, Input, Label } from '@openzeppelin/ui-components';
import { cn } from '@openzeppelin/ui-utils';

import { Badge } from './Badge';

interface TopicToggleGroupProps {
  predefinedTopics: readonly ClaimTopic[];
  selectedTopics: ClaimTopic[];
  onToggle: (topic: ClaimTopic) => void;
  onAddCustom: (topic: ClaimTopic) => void;
  onRemove: (topicId: number) => void;
  maxTopics?: number;
}

export function TopicToggleGroup({
  predefinedTopics,
  selectedTopics,
  onToggle,
  onAddCustom,
  onRemove,
  maxTopics = 15,
}: TopicToggleGroupProps) {
  const [customName, setCustomName] = useState('');
  const [customId, setCustomId] = useState('');

  const selectedIds = useMemo(
    () => new Set(selectedTopics.map((topic) => topic.id)),
    [selectedTopics]
  );
  const atLimit = selectedTopics.length >= maxTopics;

  const handleAddCustom = useCallback(() => {
    const name = customName.trim();
    const id = parseInt(customId, 10);
    if (!name || isNaN(id) || id < MIN_CUSTOM_CLAIM_TOPIC_ID) return;
    if (selectedIds.has(id)) return;
    onAddCustom({ id, name, isCustom: true });
    setCustomName('');
    setCustomId('');
  }, [customName, customId, selectedIds, onAddCustom]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {predefinedTopics.map((topic) => {
          const isSelected = selectedIds.has(topic.id);
          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => onToggle(topic)}
              disabled={!isSelected && atLimit}
              className={cn(
                'cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-muted',
                !isSelected && atLimit && 'cursor-not-allowed opacity-50'
              )}
            >
              {topic.name} ({topic.id})
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <Label>Add Custom Topic</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Topic Name"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            className="flex-1"
            disabled={atLimit}
          />
          <Input
            placeholder={`Topic ID (>=${MIN_CUSTOM_CLAIM_TOPIC_ID})`}
            value={customId}
            onChange={(e) => setCustomId(e.target.value)}
            type="number"
            min={MIN_CUSTOM_CLAIM_TOPIC_ID}
            className="w-36"
            disabled={atLimit}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAddCustom}
            disabled={!customName.trim() || !customId || atLimit}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      {selectedTopics.length > 0 && (
        <div className="space-y-1.5">
          <Label>
            Selected Topics ({selectedTopics.length}/{maxTopics})
          </Label>
          <div className="flex flex-wrap gap-2">
            {selectedTopics.map((topic) => (
              <Badge key={topic.id} variant="outline" onRemove={() => onRemove(topic.id)}>
                {topic.name} ({topic.id})
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
