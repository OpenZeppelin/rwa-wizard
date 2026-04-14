import {
  assertTemplateSnapshotCompleteness,
  createSnapshotTemplateSource,
} from '@openzeppelin/codegen-core';

import { GENERATED_STELLAR_TEMPLATE_SNAPSHOT } from '../generated-snapshot';
import { getUpstreamTemplateManifest } from '../manifest';
import type {
  UpstreamTemplateKind,
  UpstreamTemplateSource,
  UpstreamTemplateSourceMetadata,
} from '../types';

/**
 * Create a template source backed by the bundled upstream snapshot.
 */
export function createBundledTemplateSource(): UpstreamTemplateSource {
  assertTemplateSnapshotCompleteness(
    GENERATED_STELLAR_TEMPLATE_SNAPSHOT,
    getUpstreamTemplateManifest()
  );

  const metadata: UpstreamTemplateSourceMetadata = {
    ...GENERATED_STELLAR_TEMPLATE_SNAPSHOT.metadata,
    strategy: 'bundled-snapshot',
  };

  return createSnapshotTemplateSource<UpstreamTemplateKind, UpstreamTemplateSourceMetadata>(
    GENERATED_STELLAR_TEMPLATE_SNAPSHOT,
    metadata
  );
}
