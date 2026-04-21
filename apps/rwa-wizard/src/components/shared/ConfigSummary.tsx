import { Coins, KeyRound, Scale, ShieldCheck } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';

import type { RWAConfig } from '@openzeppelin/rwa-config';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  AddressDisplay,
} from '@openzeppelin/ui-components';
import { cn } from '@openzeppelin/ui-utils';

import type { ComplianceModuleOption } from '../../types/wizard';
import { Badge } from './Badge';
import { Table, TableBody, TableCell, TableRow } from './Table';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

interface SectionProps {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}

/**
 * Top-level section: icon + title header, then the section body. Sections are
 * peers on the page (no nested Card) so the visual hierarchy is
 * page → section → rows, not page → card → card → rows.
 */
function Section({ icon, title, children }: SectionProps) {
  return (
    <section>
      <header className="flex items-center gap-2 text-foreground">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-base font-semibold">{title}</h3>
      </header>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * Row key/value pair with consistent emphasis: the key reads as secondary
 * (muted) and the value as primary (foreground). Pass `muted` for
 * zero/disabled/empty values so noise visually recedes.
 */
function Field({
  label,
  children,
  muted,
}: {
  label: string;
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <TableRow>
      <TableCell className="w-2/5 text-muted-foreground">{label}</TableCell>
      <TableCell
        className={cn('font-medium text-foreground', muted && 'font-normal text-muted-foreground')}
      >
        {children}
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function AssetSection({ config }: { config: RWAConfig }) {
  const { token } = config;
  const enabledControls = Object.entries(token.administrativeControls).filter(([, val]) => val) as [
    string,
    boolean,
  ][];
  const docEnabled = token.documentManager.enabled;

  return (
    <Section icon={<Coins className="size-4" />} title="Asset Configuration">
      <Table>
        <TableBody>
          <Field label="Token Name" muted={!token.name}>
            {token.name || '—'}
          </Field>
          <Field label="Token Symbol" muted={!token.symbol}>
            {token.symbol || '—'}
          </Field>
          <Field label="Decimals">{token.decimals}</Field>
          {token.initialSupply && <Field label="Initial Supply">{token.initialSupply}</Field>}
          <Field label="Administrative Controls" muted={enabledControls.length === 0}>
            {enabledControls.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {enabledControls.map(([key]) => (
                  <Badge key={key} variant="secondary">
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </Badge>
                ))}
              </div>
            ) : (
              'None'
            )}
          </Field>
          <Field label="Document Manager" muted={!docEnabled}>
            {docEnabled ? 'Enabled' : 'Disabled'}
          </Field>
        </TableBody>
      </Table>
    </Section>
  );
}

function IdentitySection({ config }: { config: RWAConfig }) {
  const { identityVerification: id } = config;
  const enabledControls = Object.entries(id.controls).filter(([, val]) => val) as [
    string,
    boolean,
  ][];

  return (
    <Section icon={<ShieldCheck className="size-4" />} title="Identity Configuration">
      <Table>
        <TableBody>
          <Field label="Verification Strategy">Claim-Based</Field>
          <Field label="Claim Topics" muted={id.claimTopics.length === 0}>
            {id.claimTopics.length > 0 ? id.claimTopics.map((t) => t.name).join(', ') : 'None'}
          </Field>
          <Field label="Trusted Issuers" muted={id.trustedIssuers.length === 0}>
            {id.trustedIssuers.length}
          </Field>
          <Field label="Identity Controls" muted={enabledControls.length === 0}>
            {enabledControls.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {enabledControls.map(([key]) => (
                  <Badge key={key} variant="secondary">
                    {key
                      .replace(/([A-Z])/g, ' $1')
                      .replace(/^./, (s) => s.toUpperCase())
                      .trim()}
                  </Badge>
                ))}
              </div>
            ) : (
              'None'
            )}
          </Field>
        </TableBody>
      </Table>
    </Section>
  );
}

function ComplianceSection({
  config,
  availableModules,
}: {
  config: RWAConfig;
  availableModules: ComplianceModuleOption[];
}) {
  const selected = config.compliance.modules;
  const moduleMap = useMemo(
    () => new Map(availableModules.map((m) => [m.id, m])),
    [availableModules]
  );

  if (selected.length === 0) {
    return (
      <Section icon={<Scale className="size-4" />} title="Compliance Configuration">
        <p className="text-sm text-muted-foreground">No compliance modules selected.</p>
      </Section>
    );
  }

  return (
    <Section icon={<Scale className="size-4" />} title="Compliance Configuration">
      <Accordion type="multiple" variant="card">
        {selected.map((sel) => {
          const meta = moduleMap.get(sel.moduleId);
          const params = sel.config ? Object.entries(sel.config) : [];

          return (
            <AccordionItem key={sel.moduleId} value={sel.moduleId}>
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{meta?.name ?? sel.moduleId}</span>
                  {meta?.review.state === 'under-review' && (
                    <Badge variant="outline">Under Review</Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="mt-1">
                  {params.length > 0 ? (
                    <div className="space-y-2">
                      {params.map(([key, value]) => (
                        <div key={key} className="rounded bg-muted p-2 text-sm">
                          <div className="flex gap-2">
                            <span className="text-muted-foreground">{key}:</span>
                            <span className="font-mono">{JSON.stringify(value)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No parameters configured</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </Section>
  );
}

function AccessControlSection({
  config,
  getExplorerUrl,
}: {
  config: RWAConfig;
  getExplorerUrl?: (address: string) => string | null;
}) {
  const { accessControl } = config;
  const ownership = accessControl.ownership;

  const ownershipLabel =
    ownership.type === 'single-owner'
      ? 'Single Owner'
      : ownership.type === 'multi-sig'
        ? 'Multi-Sig'
        : 'DAO';

  const ownerAddress =
    ownership.type === 'single-owner' ? ownership.ownerAddress : ownership.address;

  const hasRoles = accessControl.roles.length > 0;

  return (
    <Section icon={<KeyRound className="size-4" />} title="Roles & Access Control">
      <Table>
        <TableBody>
          <Field label="Ownership Model">{ownershipLabel}</Field>
          {ownerAddress && (
            <Field label="Owner Address">
              <div className="min-w-0 break-all">
                <AddressDisplay
                  address={ownerAddress}
                  variant="inline"
                  truncateWhenLabeled
                  showCopyButton
                  explorerUrl={getExplorerUrl?.(ownerAddress) ?? undefined}
                />
              </div>
            </Field>
          )}
          <Field label="Operator Roles" muted={!hasRoles}>
            {hasRoles ? `${accessControl.roles.length} configured` : 'None'}
          </Field>
        </TableBody>
      </Table>

      {hasRoles && (
        <Accordion type="multiple" variant="card" className="mt-3">
          {accessControl.roles.map((role) => (
            <AccordionItem key={role.name} value={role.name}>
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{role.name}</span>
                  {role.symbol && (
                    <Badge variant="outline" className="font-mono text-xs">
                      {role.symbol}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="mt-1">
                  {role.addresses.length > 0 ? (
                    <div className="space-y-1">
                      {role.addresses.map((addr) => (
                        <AddressDisplay
                          key={addr}
                          address={addr}
                          variant="inline"
                          truncateWhenLabeled
                          showCopyButton
                          explorerUrl={getExplorerUrl?.(addr) ?? undefined}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No addresses assigned</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Composed summary
// ---------------------------------------------------------------------------

interface ConfigSummaryProps {
  config: RWAConfig;
  availableModules: ComplianceModuleOption[];
  getExplorerUrl?: (address: string) => string | null;
}

/**
 * Read-only summary of an RWAConfig. Sections are rendered as peers on the
 * page (the enclosing WizardFrame already owns the page heading), with
 * icon-anchored section headers, muted field labels, and emphasized values
 * so meaningful configuration reads above zero/disabled defaults.
 */
export function ConfigSummary({ config, availableModules, getExplorerUrl }: ConfigSummaryProps) {
  return (
    <div className="space-y-8">
      <AssetSection config={config} />
      <IdentitySection config={config} />
      <ComplianceSection config={config} availableModules={availableModules} />
      <AccessControlSection config={config} getExplorerUrl={getExplorerUrl} />
    </div>
  );
}
