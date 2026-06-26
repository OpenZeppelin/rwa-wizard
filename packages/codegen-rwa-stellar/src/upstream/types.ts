import type {
  TemplateSourceMetadata as CoreTemplateSourceMetadata,
  TemplateManifestEntry,
  TemplatePayload,
  TemplateSnapshot,
  TemplateSnapshotMetadata,
  TemplateSource,
  TemplateSourceKey,
} from '@openzeppelin/codegen-core';

export type UpstreamTemplateKind =
  | 'core-contract'
  | 'core-cargo'
  | 'identity-support-contract'
  | 'identity-support-cargo'
  | 'identity-support-tool'
  | 'identity-support-tool-cargo'
  | 'module-contract'
  | 'module-cargo';

export type UpstreamTemplateManifestEntry = TemplateManifestEntry<UpstreamTemplateKind>;

export type UpstreamTemplateKey = TemplateSourceKey<UpstreamTemplateKind>;

export type UpstreamTemplatePayload = TemplatePayload;

export type UpstreamTemplateSnapshotMetadata = TemplateSnapshotMetadata;

export interface UpstreamTemplateSnapshot extends Omit<TemplateSnapshot, 'templates'> {
  metadata: UpstreamTemplateSnapshotMetadata;
  templates: Record<UpstreamTemplateKey, UpstreamTemplatePayload>;
}

export interface UpstreamTemplateSourceMetadata extends CoreTemplateSourceMetadata {
  strategy: 'bundled-snapshot' | 'local-checkout';
  checkoutRoot?: string;
}

export interface UpstreamTemplateSource extends TemplateSource<
  UpstreamTemplateKind,
  UpstreamTemplateSourceMetadata
> {
  metadata: UpstreamTemplateSourceMetadata;
  getTemplate(kind: UpstreamTemplateKind, id: string): string;
  getTemplatePayload(kind: UpstreamTemplateKind, id: string): UpstreamTemplatePayload;
}
