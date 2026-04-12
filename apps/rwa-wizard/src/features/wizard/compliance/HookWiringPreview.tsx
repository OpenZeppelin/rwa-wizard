import { Badge } from '../../../components/shared/Badge';
import type { ComplianceHookMeta, ComplianceModuleOption } from '../../../types/wizard';

interface HookWiringPreviewProps {
  complianceHooks: readonly ComplianceHookMeta[];
  hookRegistrations: Map<string, string[]>;
  availableModules: ComplianceModuleOption[];
}

function moduleName(moduleId: string, availableModules: ComplianceModuleOption[]): string {
  return availableModules.find((m) => m.id === moduleId)?.name ?? moduleId;
}

export function HookWiringPreview({
  complianceHooks,
  hookRegistrations,
  availableModules,
}: HookWiringPreviewProps) {
  const activeHooks = complianceHooks.filter((h) => hookRegistrations.has(h.hook));

  if (activeHooks.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-foreground">Hook Wiring Preview</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          This shows which compliance hooks will fire when token operations occur. Each module
          registers itself on the hooks it needs.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Hook</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                Registered Modules
              </th>
            </tr>
          </thead>
          <tbody>
            {activeHooks.map((hookMeta) => {
              const moduleIds = hookRegistrations.get(hookMeta.hook) ?? [];
              return (
                <tr key={hookMeta.hook} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 align-top">
                    <div className="font-medium text-foreground">{hookMeta.displayName}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {hookMeta.description}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {moduleIds.map((id) => (
                        <Badge key={id} variant="secondary">
                          {moduleName(id, availableModules)}
                        </Badge>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
