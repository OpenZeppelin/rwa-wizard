import { getTemplateSourceKey } from '@openzeppelin/codegen-core';

import rawManifest from './template-manifest.json';
import type {
  UpstreamTemplateKey,
  UpstreamTemplateKind,
  UpstreamTemplateManifestEntry,
} from './types';

const templateManifest = rawManifest as UpstreamTemplateManifestEntry[];

const templateManifestByKey = new Map(
  templateManifest.map((entry) => [getUpstreamTemplateKey(entry.kind, entry.id), entry])
);

/**
 * Return the canonical list of upstream templates included in the snapshot.
 */
export function getUpstreamTemplateManifest(): readonly UpstreamTemplateManifestEntry[] {
  return templateManifest;
}

/**
 * Build the stable key used to index templates by kind and identifier.
 */
export function getUpstreamTemplateKey(
  kind: UpstreamTemplateKind,
  id: string
): UpstreamTemplateKey {
  return getTemplateSourceKey(kind, id);
}

/**
 * Look up a manifest entry by kind and identifier.
 */
export function getUpstreamTemplateManifestEntry(
  kind: UpstreamTemplateKind,
  id: string
): UpstreamTemplateManifestEntry {
  const entry = templateManifestByKey.get(getUpstreamTemplateKey(kind, id));
  if (!entry) {
    throw new Error(`Unknown upstream template manifest entry for ${kind}:${id}`);
  }
  return entry;
}
