import { useEffect, useRef, useState } from 'react';

export interface UseTypewriterEffectOptions {
  /** Speed of typing in milliseconds per character */
  typingSpeed?: number;
  /** Speed of erasing in milliseconds per character */
  erasingSpeed?: number;
  /** Delay before starting to erase old text */
  eraseDelay?: number;
  /** Delay before starting to type new text */
  typeDelay?: number;
  /** Minimum character difference to trigger animation */
  minDifferenceThreshold?: number;
}

/**
 * Typewriter animation when text changes (erase then type), matching UI Builder's
 * Contract UI sidebar items.
 */
export function useTypewriterEffect(text: string, options: UseTypewriterEffectOptions = {}) {
  const {
    typingSpeed = 50,
    erasingSpeed = 30,
    eraseDelay = 100,
    typeDelay = 200,
    minDifferenceThreshold = 2,
  } = options;

  const [displayText, setDisplayText] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousTextRef = useRef(text);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (text === previousTextRef.current) {
      return;
    }

    const oldText = previousTextRef.current;
    const newText = text;

    const difference = Math.abs(newText.length - oldText.length);
    if (
      difference < minDifferenceThreshold &&
      newText.includes(oldText.substring(0, oldText.length - difference))
    ) {
      setDisplayText(newText);
      previousTextRef.current = text;
      return;
    }

    previousTextRef.current = text;

    setIsAnimating(true);

    let currentStep = 0;

    const animate = () => {
      if (currentStep < oldText.length) {
        const charsToShow = oldText.length - currentStep - 1;
        setDisplayText(oldText.substring(0, charsToShow));
        currentStep++;
        timeoutRef.current = setTimeout(animate, erasingSpeed);
      } else if (currentStep === oldText.length) {
        currentStep++;
        timeoutRef.current = setTimeout(animate, typeDelay);
      } else {
        const charsToShow = currentStep - oldText.length - 1;
        setDisplayText(newText.substring(0, charsToShow + 1));
        currentStep++;

        if (charsToShow + 1 >= newText.length) {
          setIsAnimating(false);
        } else {
          timeoutRef.current = setTimeout(animate, typingSpeed);
        }
      }
    };

    timeoutRef.current = setTimeout(animate, eraseDelay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [text, typingSpeed, erasingSpeed, eraseDelay, typeDelay, minDifferenceThreshold]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    displayText,
    isAnimating,
  };
}
