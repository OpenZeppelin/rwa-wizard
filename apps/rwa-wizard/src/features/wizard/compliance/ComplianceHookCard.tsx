import { Plus, X } from 'lucide-react';
import { useCallback, useState } from 'react';

import type { ComplianceModuleSelection } from '@openzeppelin/rwa-config';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@openzeppelin/ui-components';

import { Badge } from '../../../components/shared/Badge';
import type { ComplianceModuleOption } from '../../../types/wizard';

interface ComplianceHookCardProps {
  hook: string;
  displayName: string;
  description: string;
  modules: ComplianceModuleSelection[];
  availableModules: ComplianceModuleOption[];
  maxModulesPerHook: number;
  onAddModule: (hook: string, moduleId: string) => void;
  onRemoveModule: (hook: string, moduleIndex: number) => void;
  fundTag?: boolean;
}

export function ComplianceHookCard({
  hook,
  displayName,
  description,
  modules,
  availableModules,
  maxModulesPerHook,
  onAddModule,
  onRemoveModule,
  fundTag,
}: ComplianceHookCardProps) {
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const hookModules = modules.filter((m) => m.hook === hook);
  const atLimit = hookModules.length >= maxModulesPerHook;

  const eligibleModules = availableModules.filter((m) =>
    (m.supportedHooks as readonly string[]).includes(hook)
  );

  const handleAdd = useCallback(() => {
    if (!selectedModuleId) return;
    onAddModule(hook, selectedModuleId);
    setSelectedModuleId('');
  }, [hook, selectedModuleId, onAddModule]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{displayName}</CardTitle>
          {fundTag && <Badge variant="secondary">tokenized fund</Badge>}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Select value={selectedModuleId} onValueChange={setSelectedModuleId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select a module" />
            </SelectTrigger>
            <SelectContent>
              {eligibleModules.map((mod) => (
                <SelectItem key={mod.id} value={mod.id}>
                  {mod.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={!selectedModuleId || atLimit}
            size="sm"
            className="gap-1.5"
          >
            <Plus className="size-4" />
            Add Module
          </Button>
        </div>

        {hookModules.length > 0 && (
          <div className="space-y-2">
            {hookModules.map((selection, idx) => {
              const meta = availableModules.find((m) => m.id === selection.moduleId);
              return (
                <div
                  key={`${selection.moduleId}-${idx}`}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <Badge variant="outline">{idx + 1}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {meta?.name ?? selection.moduleId}
                    </p>
                    {meta?.description && (
                      <p className="text-xs text-muted-foreground">{meta.description}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onRemoveModule(hook, modules.indexOf(selection))}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {hookModules.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {hookModules.length} module{hookModules.length !== 1 ? 's' : ''} / {maxModulesPerHook}{' '}
            max
          </p>
        )}
      </CardContent>
    </Card>
  );
}
