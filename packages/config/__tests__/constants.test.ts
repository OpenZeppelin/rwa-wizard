import { describe, expect, it } from 'vitest';

import {
  MAX_CLAIM_TOPICS,
  MIN_CUSTOM_CLAIM_TOPIC_ID,
  PREDEFINED_CLAIM_TOPICS,
} from '../src/constants';

describe('PREDEFINED_CLAIM_TOPICS', () => {
  it('contains 4 predefined topics', () => {
    expect(PREDEFINED_CLAIM_TOPICS).toHaveLength(4);
  });

  it('has unique ids', () => {
    const ids = PREDEFINED_CLAIM_TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has all ids below the custom threshold', () => {
    for (const topic of PREDEFINED_CLAIM_TOPICS) {
      expect(topic.id).toBeLessThan(MIN_CUSTOM_CLAIM_TOPIC_ID);
    }
  });

  it('marks all as non-custom', () => {
    for (const topic of PREDEFINED_CLAIM_TOPICS) {
      expect(topic.isCustom).toBe(false);
    }
  });

  it('has non-empty names', () => {
    for (const topic of PREDEFINED_CLAIM_TOPICS) {
      expect(topic.name.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('limit constants', () => {
  it('MIN_CUSTOM_CLAIM_TOPIC_ID is 5', () => {
    expect(MIN_CUSTOM_CLAIM_TOPIC_ID).toBe(5);
  });

  it('MAX_CLAIM_TOPICS is reasonable', () => {
    expect(MAX_CLAIM_TOPICS).toBeGreaterThanOrEqual(1);
    expect(MAX_CLAIM_TOPICS).toBeLessThanOrEqual(100);
  });
});
