import { useCopy } from '../../../../app/providers/useCopy';
import { Badge } from '../../../../components/shared/Badge';
import { InfoTooltip } from '../../../../components/shared/InfoTooltip';
import { renderInlineCopy } from '../../../../components/shared/renderInlineCopy';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../components/shared/Table';
import type { ComplianceHookMeta, ComplianceModuleOption } from '../../../../types/wizard';

interface HookWiringPreviewProps {
  complianceHooks: readonly ComplianceHookMeta[];
  hookRegistrations: Map<string, string[]>;
  availableModules: ComplianceModuleOption[];
}

function moduleName(moduleId: string, availableModules: ComplianceModuleOption[]): string {
  return availableModules.find((entry) => entry.id === moduleId)?.name ?? moduleId;
}

export function HookWiringPreview({
  complianceHooks,
  hookRegistrations,
  availableModules,
}: HookWiringPreviewProps) {
  const notice = useCopy().notice('compliance.hook-wiring-preview');
  const emptyHookNotice = useCopy().notice('compliance.hook-wiring-preview.empty-hook');

  if (complianceHooks.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-foreground">{notice.title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {renderInlineCopy(notice.description)}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hook</TableHead>
              <TableHead>Registered Modules</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {complianceHooks.map((hookMeta) => {
              const moduleIds = hookRegistrations.get(hookMeta.hook) ?? [];
              return (
                <TableRow key={hookMeta.hook}>
                  <TableCell className="px-4 py-2.5 align-top">
                    <div className="flex items-center gap-1.5">
                      <div className="font-medium text-foreground">{hookMeta.displayName}</div>
                      {hookMeta.infoCopy && (
                        <InfoTooltip label={`About the ${hookMeta.displayName} hook`}>
                          {hookMeta.infoCopy}
                        </InfoTooltip>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {hookMeta.description}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {moduleIds.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {moduleIds.map((id) => (
                          <Badge key={id} variant="secondary">
                            {moduleName(id, availableModules)}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {emptyHookNotice.description}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
