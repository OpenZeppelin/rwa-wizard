export interface TemplateManifestEntry<TKind extends string = string> {
  kind: TKind;
  id: string;
  sourcePath: string;
}

export type TemplateSourceKey<TKind extends string = string> = `${TKind}:${string}`;

export interface TemplatePayload {
  sourcePath: string;
  content: string;
}

export interface TemplateSnapshotMetadata {
  sourceRepoUrl: string;
  sourceCommitHash: string;
  syncedAt: string;
}

export interface TemplateSnapshot {
  metadata: TemplateSnapshotMetadata;
  templates: Record<string, TemplatePayload>;
}

export interface TemplateSourceMetadata extends TemplateSnapshotMetadata {
  strategy: string;
  checkoutRoot?: string;
}

export interface TemplateSource<
  TKind extends string = string,
  TMetadata extends TemplateSourceMetadata = TemplateSourceMetadata,
> {
  metadata: TMetadata;
  getTemplate(kind: TKind, id: string): string;
  getTemplatePayload(kind: TKind, id: string): TemplatePayload;
}

/**
 * Build a stable key for template lookup by kind and identifier.
 */
export function getTemplateSourceKey<TKind extends string>(
  kind: TKind,
  id: string
): TemplateSourceKey<TKind> {
  return `${kind}:${id}` as TemplateSourceKey<TKind>;
}

/**
 * Assert that a snapshot contains every manifest-declared template.
 */
export function assertTemplateSnapshotCompleteness<TKind extends string>(
  snapshot: TemplateSnapshot,
  manifest: readonly TemplateManifestEntry<TKind>[]
): void {
  for (const entry of manifest) {
    const key = getTemplateSourceKey(entry.kind, entry.id);
    if (!(key in snapshot.templates)) {
      throw new Error(`Template snapshot is missing ${key}`);
    }
  }
}

/**
 * Wrap a snapshot payload as a template source implementation.
 */
export function createSnapshotTemplateSource<
  TKind extends string,
  TMetadata extends TemplateSourceMetadata,
>(
  snapshot: TemplateSnapshot,
  metadata: TMetadata
): TemplateSource<TKind, TMetadata> {
  return {
    metadata,
    getTemplate(kind, id) {
      return this.getTemplatePayload(kind, id).content;
    },
    getTemplatePayload(kind, id) {
      const key = getTemplateSourceKey(kind, id);
      const payload = snapshot.templates[key];

      if (!payload) {
        throw new Error(`Unknown template payload for ${key}`);
      }

      return payload;
    },
  };
}
