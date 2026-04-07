import { useEffect, useRef, useState } from 'react';

import { cn } from '@openzeppelin/ui-utils';

import type { DraftListItem as DraftListItemType } from '../../../types/wizard';

interface DraftListItemProps {
  draft: DraftListItemType;
  isActive: boolean;
  isSaving: boolean;
  onLoad: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'text-gray-500',
  ready: 'text-blue-600',
  generating: 'text-amber-600',
  generated: 'text-green-600',
  error: 'text-red-600',
};

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Typewriter effect that erases then retypes whenever `text` changes. */
function useTypewriterTitle(text: string) {
  const [displayed, setDisplayed] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevRef = useRef(text);

  useEffect(() => {
    if (text === prevRef.current) return;
    const prev = prevRef.current;
    prevRef.current = text;
    setIsAnimating(true);

    let frame: ReturnType<typeof setTimeout>;
    let i = prev.length;

    function erase() {
      if (i <= 0) {
        type();
        return;
      }
      setDisplayed(prev.slice(0, --i));
      frame = setTimeout(erase, 25);
    }

    let j = 0;
    function type() {
      if (j >= text.length) {
        setIsAnimating(false);
        return;
      }
      setDisplayed(text.slice(0, ++j));
      frame = setTimeout(type, 40);
    }

    frame = setTimeout(erase, 150);
    return () => clearTimeout(frame);
  }, [text]);

  return { displayed, isAnimating };
}

/**
 * Artificially prolongs the saving animation for 1.5s after the save completes,
 * matching the UI Builder's ContractUIItem behaviour.
 */
function useLingeringAnimation(active: boolean, lingerMs = 1500): boolean {
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (active) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setShow(true);
    } else {
      timerRef.current = setTimeout(() => setShow(false), lingerMs);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, lingerMs]);

  return show;
}

export function DraftListItem({ draft, isActive, isSaving, onLoad }: DraftListItemProps) {
  const { displayed: animatedTitle, isAnimating: isTitleAnimating } = useTypewriterTitle(
    draft.title
  );
  const { displayed: animatedSymbol, isAnimating: isSymbolAnimating } = useTypewriterTitle(
    draft.symbol ?? ''
  );
  const showSavingAnimation = useLingeringAnimation(isSaving);

  return (
    <button
      type="button"
      onClick={onLoad}
      className={cn(
        'flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-all duration-300 ease-in-out',
        showSavingAnimation && 'animate-pulse bg-muted opacity-30 [animation-duration:1200ms]',
        !showSavingAnimation &&
          (isActive ? 'bg-neutral-100 text-[#111928]' : 'text-gray-600 hover:bg-muted/50')
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold">
          {animatedTitle}
          {isTitleAnimating && <span className="animate-pulse text-current">|</span>}
        </span>
        <span className={cn('shrink-0 text-[11px] font-medium', STATUS_STYLES[draft.status])}>
          {draft.status}
        </span>
      </div>
      <span className="text-[11px] uppercase text-gray-400">
        {draft.targetId}
        {animatedSymbol ? (
          <>
            {' · '}
            {animatedSymbol}
            {isSymbolAnimating && <span className="animate-pulse text-current">|</span>}
          </>
        ) : null}
      </span>
      <span className="text-[11px] text-gray-400">{formatDate(draft.updatedAt)}</span>
    </button>
  );
}
