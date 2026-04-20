import { Plus } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';

import type { ClaimTopic } from '@openzeppelin/rwa-config';
import { MIN_CUSTOM_CLAIM_TOPIC_ID } from '@openzeppelin/rwa-config';
import { Button, Label, NumberField, TextField } from '@openzeppelin/ui-components';

import { TogglePill } from './TogglePill';

interface CustomTopicForm {
  name: string;
  id: number | '';
}

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
  const { control, reset, watch } = useForm<CustomTopicForm>({
    defaultValues: { name: '', id: '' },
    mode: 'onChange',
  });

  const watchedName = watch('name');
  const watchedId = watch('id');

  const selectedIds = useMemo(
    () => new Set(selectedTopics.map((topic) => topic.id)),
    [selectedTopics]
  );
  const atLimit = selectedTopics.length >= maxTopics;

  const predefinedIds = useMemo(
    () => new Set(predefinedTopics.map((t) => t.id)),
    [predefinedTopics]
  );
  const customTopics = useMemo(
    () => selectedTopics.filter((t) => !predefinedIds.has(t.id)),
    [selectedTopics, predefinedIds]
  );

  const parsedId = typeof watchedId === 'number' ? watchedId : parseInt(String(watchedId), 10);
  // Guard against colliding with *any* predefined topic id, not just the ones
  // currently selected, so a future addition to PREDEFINED_CLAIM_TOPICS cannot
  // create ambiguous duplicates at runtime.
  const isIdTaken = selectedIds.has(parsedId) || predefinedIds.has(parsedId);
  const canAddCustom =
    !!String(watchedName).trim() &&
    !isNaN(parsedId) &&
    parsedId >= MIN_CUSTOM_CLAIM_TOPIC_ID &&
    !isIdTaken &&
    !atLimit;

  const handleAddCustom = useCallback(() => {
    const name = String(watchedName).trim();
    if (!name || isNaN(parsedId) || parsedId < MIN_CUSTOM_CLAIM_TOPIC_ID) return;
    if (selectedIds.has(parsedId) || predefinedIds.has(parsedId)) return;
    onAddCustom({ id: parsedId, name, isCustom: true });
    reset({ name: '', id: '' });
  }, [watchedName, parsedId, selectedIds, predefinedIds, onAddCustom, reset]);

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-muted-foreground">
          {selectedTopics.length}/{maxTopics} selected
        </Label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {predefinedTopics.map((topic) => {
            const isSelected = selectedIds.has(topic.id);
            return (
              <TogglePill
                key={topic.id}
                label={topic.name}
                detail={topic.id}
                selected={isSelected}
                onClick={() => onToggle(topic)}
                disabled={!isSelected && atLimit}
              />
            );
          })}
          {customTopics.map((topic) => (
            <TogglePill
              key={topic.id}
              label={topic.name}
              detail={topic.id}
              selected={true}
              onClick={() => onRemove(topic.id)}
              onRemove={() => onRemove(topic.id)}
            />
          ))}
        </div>
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <TextField
            id="custom-topic-name"
            name="name"
            label="Add Custom Topic"
            placeholder="Topic Name"
            control={control}
            validation={{ required: false }}
          />
        </div>
        <div className="w-36">
          <NumberField
            id="custom-topic-id"
            name="id"
            label="Topic ID"
            placeholder={`>=${MIN_CUSTOM_CLAIM_TOPIC_ID}`}
            control={control}
            validation={{ required: false, min: MIN_CUSTOM_CLAIM_TOPIC_ID }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleAddCustom}
          disabled={!canAddCustom}
          className="mb-0.5"
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}
