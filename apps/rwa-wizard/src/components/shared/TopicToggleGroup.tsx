import { Plus } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';

import type { ClaimTopic } from '@openzeppelin/rwa-config';
import { isClaimTopicSelected, MIN_CUSTOM_CLAIM_TOPIC_ID } from '@openzeppelin/rwa-config';
import { formatCopy } from '@openzeppelin/rwa-wizard-copy';
import { Button, Label, NumberField, TextField } from '@openzeppelin/ui-components';

import { useCopy } from '../../app/providers/useCopy';
import { CLAIM_TOPIC_DRAFT_ANCHOR, claimTopicAnchor } from '../../features/wizard/focused-path';
import { useInspectAnchor } from '../../features/wizard/inspected-anchor';
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
  const copy = useCopy();
  const inspect = useInspectAnchor();

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
  // Cap is over *defined* topics (SF-16 D-11 / INV-11) — unselected still occupy a slot.
  const atLimit = selectedTopics.length >= maxTopics;
  // Counter is over *selected* topics (INV-11).
  const selectedCount = selectedTopics.filter(isClaimTopicSelected).length;

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
    // Written, not inferred from where focus went. The Add button disables
    // itself the moment the form resets, so on some browsers focus ends up on
    // nothing at all — which is exactly why the subject cannot be read off
    // focus. This handler is the code that knows what was created. INV-19.
    inspect(claimTopicAnchor(parsedId));
    reset({ name: '', id: '' });
    // Repeat entry: the next topic name goes in the same field. Independent of
    // the line above — the draft anchor this focus resolves to is refused by
    // `inspect`, so the `focusin` it fires cannot overwrite the subject.
    document.getElementById('custom-topic-name')?.focus();
  }, [watchedName, parsedId, selectedIds, predefinedIds, onAddCustom, inspect, reset]);

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs text-muted-foreground">
          {formatCopy(copy.notice('claim-topics.selected-count').description, {
            selectedCount,
            maxTopics,
          })}
        </Label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {predefinedTopics.map((topic) => {
            const fromDraft = selectedTopics.find((t) => t.id === topic.id);
            // Absent catalogue topics render unselected; present ones route
            // through isClaimTopicSelected — never a literal or inline
            // `selected !== false`. INV-8.
            const isSelected = fromDraft ? isClaimTopicSelected(fromDraft) : false;
            return (
              <TogglePill
                key={topic.id}
                configAnchor={claimTopicAnchor(topic.id)}
                label={topic.name}
                detail={topic.id}
                selected={isSelected}
                onToggleSelection={() => onToggle(topic)}
                disabled={fromDraft === undefined && atLimit}
              />
            );
          })}
          {customTopics.map((topic) => (
            // Three-affordance: body inspects only; selection control toggles
            // ClaimTopic.selected; × is the sole delete path. INV-5, INV-16.
            <TogglePill
              key={topic.id}
              configAnchor={claimTopicAnchor(topic.id)}
              label={topic.name}
              detail={topic.id}
              selected={isClaimTopicSelected(topic)}
              onToggleSelection={() => onToggle(topic)}
              onRemove={() => onRemove(topic.id)}
            />
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <TextField
            id="custom-topic-name"
            name="name"
            label="Add Custom Topic"
            placeholder="Topic Name"
            control={control}
            validation={{ required: false }}
          />
        </div>
        <div className="w-36 shrink-0">
          <NumberField
            id="custom-topic-id"
            name="id"
            label="Topic ID"
            placeholder={`>=${MIN_CUSTOM_CLAIM_TOPIC_ID}`}
            control={control}
            validation={{ required: false, min: MIN_CUSTOM_CLAIM_TOPIC_ID }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="invisible" aria-hidden="true">
            &nbsp;
          </Label>
          <div className="flex h-10 items-center">
            <Button
              type="button"
              data-config-anchor={CLAIM_TOPIC_DRAFT_ANCHOR}
              variant="outline"
              size="icon"
              onClick={handleAddCustom}
              disabled={!canAddCustom}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
