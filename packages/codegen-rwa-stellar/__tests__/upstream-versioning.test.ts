import { describe, expect, it } from 'vitest';

import {
  GENERATED_STELLAR_SOURCE_COMMIT_HASH,
  GENERATED_STELLAR_SOURCE_REPO_URL,
} from '../src/upstream/generated-revision';
import { GENERATED_STELLAR_TEMPLATE_SNAPSHOT } from '../src/upstream/generated-snapshot';

describe('bundled upstream revision invariants', () => {
  it('keeps the generated revision aligned with bundled snapshot metadata', () => {
    expect(GENERATED_STELLAR_SOURCE_COMMIT_HASH).toBe(
      GENERATED_STELLAR_TEMPLATE_SNAPSHOT.metadata.sourceCommitHash
    );
    expect(GENERATED_STELLAR_SOURCE_REPO_URL).toBe(
      GENERATED_STELLAR_TEMPLATE_SNAPSHOT.metadata.sourceRepoUrl
    );
  });
});
