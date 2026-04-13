import { useMemo } from 'react';

import type { RWAConfig } from '@openzeppelin/rwa-config';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  AddressDisplay,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from '@openzeppelin/ui-components';

import type { ComplianceModuleOption } from '../../types/wizard';
import { Badge } from './Badge';
import { Table, TableBody, TableCell, TableRow } from './Table';

// ---------------------------------------------------------------------------
// Section renderers
// ---------------------------------------------------------------------------

function AssetSection({ config }: { config: RWAConfig }) {
  const { token } = config;
  const enabledControls = Object.entries(token.administrativeControls).filter(([, val]) => val) as [
    string,
    boolean,
  ][];

  return (
    <div>
      <Label className="text-sm font-semibold">Asset Configuration</Label>
      <Table>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium">Token Name</TableCell>
            <TableCell>{token.name || '—'}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Token Symbol</TableCell>
            <TableCell>{token.symbol || '—'}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Decimals</TableCell>
            <TableCell>{token.decimals}</TableCell>
          </TableRow>
          {token.initialSupply && (
            <TableRow>
              <TableCell className="font-medium">Initial Supply</TableCell>
              <TableCell>{token.initialSupply}</TableCell>
            </TableRow>
          )}
          <TableRow>
            <TableCell className="font-medium">Administrative Controls</TableCell>
            <TableCell>
              {enabledControls.length > 0 ? (
                <div className="flex gap-2">
                  {enabledControls.map(([key]) => (
                    <Badge key={key} variant="secondary">
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Document Manager</TableCell>
            <TableCell>{token.documentManager.enabled ? 'Enabled' : 'Disabled'}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function IdentitySection({ config }: { config: RWAConfig }) {
  const { identityVerification: id } = config;
  const enabledControls = Object.entries(id.controls).filter(([, val]) => val) as [
    string,
    boolean,
  ][];

  return (
    <div>
      <Label className="text-sm font-semibold">Identity Configuration</Label>
      <Table>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium">Verification Strategy</TableCell>
            <TableCell className="capitalize">Claim-Based</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Claim Topics</TableCell>
            <TableCell>
              {id.claimTopics.length > 0 ? id.claimTopics.map((t) => t.name).join(', ') : 'None'}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Trusted Issuers</TableCell>
            <TableCell>{id.trustedIssuers.length}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="font-medium">Identity Controls</TableCell>
            <TableCell>
              {enabledControls.length > 0 ? (
                <div className="flex gap-2">
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
                <span className="text-muted-foreground">None</span>
              )}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
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
      <div>
        <Label className="text-sm font-semibold">Compliance Configuration</Label>
        <p className="mt-2 text-sm text-muted-foreground">No compliance modules selected.</p>
      </div>
    );
  }

  return (
    <div>
      <Label className="text-sm font-semibold">Compliance Configuration</Label>
      <Accordion type="multiple" variant="card" className="mt-2">
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
    </div>
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
    <div>
      <Label className="text-sm font-semibold">Roles & Access Control</Label>
      <Table>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium">Ownership Model</TableCell>
            <TableCell>{ownershipLabel}</TableCell>
          </TableRow>
          {ownerAddress && (
            <TableRow>
              <TableCell className="font-medium">Owner Address</TableCell>
              <TableCell>
                <AddressDisplay
                  address={ownerAddress}
                  variant="inline"
                  truncate={false}
                  showCopyButton
                  explorerUrl={getExplorerUrl?.(ownerAddress) ?? undefined}
                />
              </TableCell>
            </TableRow>
          )}
          <TableRow>
            <TableCell className="font-medium">Operator Roles</TableCell>
            <TableCell>{hasRoles ? `${accessControl.roles.length} configured` : 'None'}</TableCell>
          </TableRow>
        </TableBody>
      </Table>

      {hasRoles && (
        <Accordion type="multiple" variant="card" className="mt-2">
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
                          truncate={false}
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
    </div>
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
 * Read-only summary of an RWAConfig, rendered inside a Card with table-based
 * sections matching the prototype design.
 */
export function ConfigSummary({ config, availableModules, getExplorerUrl }: ConfigSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuration Summary</CardTitle>
        <CardDescription>
          Review all selected options and settings for your RWA token.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AssetSection config={config} />
        <hr className="border-border" />
        <IdentitySection config={config} />
        <hr className="border-border" />
        <ComplianceSection config={config} availableModules={availableModules} />
        <hr className="border-border" />
        <AccessControlSection config={config} getExplorerUrl={getExplorerUrl} />
      </CardContent>
    </Card>
  );
}
