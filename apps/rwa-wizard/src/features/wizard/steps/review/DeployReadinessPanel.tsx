import { formatCopy } from '@openzeppelin/rwa-wizard-copy';
import { AddressDisplay, Banner, Checkbox, Label } from '@openzeppelin/ui-components';

import { useCopy } from '../../../../app/providers/useCopy';
import { InfoNoticeBanner } from '../../../../components/shared/InfoNoticeBanner';
import { InfoTooltip } from '../../../../components/shared/InfoTooltip';
import { renderInlineCopy } from '../../../../components/shared/renderInlineCopy';
import { enrichComplianceSelectionWarning } from '../../../../registry/enrichEcosystemMetadata';
import type { DeployGuidanceDTO } from '../../../../services/codegen/types';
import { useExplorer } from '../../../../services/runtime';
import type { TargetId } from '../../../../types/wizard';
import { useDeployReadiness } from '../../context/useDeployReadiness';

interface DeployReadinessPanelProps {
  targetId: TargetId;
  guidance: DeployGuidanceDTO;
  supportsIdentitySupport: boolean;
  hasInitialSupply: boolean;
}

export function DeployReadinessPanel({
  targetId,
  guidance,
  supportsIdentitySupport,
  hasInitialSupply,
}: DeployReadinessPanelProps) {
  const explorer = useExplorer();
  const copy = useCopy();
  const beforeDeployNotice = copy.notice('review.before-deploy');
  const configuredAdminNotice = copy.notice('review.configured-admin');
  const signerAckNotice = copy.notice('review.deploy-signer-ack');
  const identitySupportNotice = copy.notice('review.identity-support-scaffolding');
  const demoAutoMintNotice = copy.notice('review.demo-auto-mint-ready');
  const demoMintComplianceNotice = copy.notice('review.demo-mint-compliance-blocked');
  const {
    signerAcknowledged,
    setSignerAcknowledged,
    includeIdentitySupport,
    setIncludeIdentitySupport,
  } = useDeployReadiness();

  const showDemoAutoMintReady =
    supportsIdentitySupport &&
    guidance.demoAutoMintEligible &&
    hasInitialSupply &&
    includeIdentitySupport;

  const deployIntro = beforeDeployNotice.description
    ? formatCopy(beforeDeployNotice.description, {
        networkDisplayName: guidance.networkDisplayName,
      })
    : '';

  return (
    <InfoNoticeBanner title={beforeDeployNotice.title ?? undefined} className="min-w-0">
      <div className="space-y-2">
        {deployIntro && <div>{renderInlineCopy(deployIntro)}</div>}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{configuredAdminNotice.title ?? ''}</span>
          <AddressDisplay
            address={guidance.adminAddress}
            variant="inline"
            disableLabel
            truncate={false}
            showCopyButton
            explorerUrl={explorer?.getExplorerUrl(guidance.adminAddress) ?? undefined}
            className="min-w-0 max-w-full break-all font-mono text-xs"
          />
        </div>
      </div>

      <div className="mt-3 space-y-3 border-t border-current/15 pt-3">
        <div className="flex items-start gap-2">
          <Checkbox
            id="deploy-signer-ack"
            checked={signerAcknowledged}
            onCheckedChange={(checked) => setSignerAcknowledged(checked === true)}
          />
          <Label htmlFor="deploy-signer-ack" className="text-sm font-normal leading-snug">
            {signerAckNotice.description ?? ''}
          </Label>
        </div>

        {supportsIdentitySupport && guidance.networkIsTestnet && (
          <div className="flex items-start gap-2">
            <Checkbox
              id="include-identity-support"
              checked={includeIdentitySupport}
              onCheckedChange={(checked) => setIncludeIdentitySupport(checked === true)}
            />
            <div className="flex min-w-0 flex-1 items-start gap-1.5">
              <Label
                htmlFor="include-identity-support"
                className="text-sm font-normal leading-snug"
              >
                {identitySupportNotice.description ?? ''}
              </Label>
              {identitySupportNotice.infoCopy && (
                <InfoTooltip
                  label={identitySupportNotice.title ?? ''}
                  side="top"
                  maxWidthClassName="max-w-sm"
                  className="mt-0.5 shrink-0"
                >
                  <div className="space-y-2">
                    {identitySupportNotice.infoCopy.split('\n\n').map((paragraph) => (
                      <p key={paragraph}>{renderInlineCopy(paragraph)}</p>
                    ))}
                  </div>
                </InfoTooltip>
              )}
            </div>
          </div>
        )}

        {showDemoAutoMintReady && guidance.demoMintComplianceIssues.length === 0 && (
          <Banner
            variant="success"
            size="compact"
            dismissible={false}
            title={demoAutoMintNotice.title ?? undefined}
          >
            {demoAutoMintNotice.description && renderInlineCopy(demoAutoMintNotice.description)}
          </Banner>
        )}

        {showDemoAutoMintReady && guidance.demoMintComplianceIssues.length > 0 && (
          <Banner
            variant="error"
            size="compact"
            dismissible={false}
            title={demoMintComplianceNotice.title ?? undefined}
          >
            <div className="space-y-2">
              {demoMintComplianceNotice.description && (
                <p>{renderInlineCopy(demoMintComplianceNotice.description)}</p>
              )}
              <ul className="list-disc space-y-1 pl-4">
                {guidance.demoMintComplianceIssues.map((issue) => {
                  const warningCopy = enrichComplianceSelectionWarning(targetId, {
                    id: issue.warningId,
                    relatedModuleIds: [],
                  });
                  const description = warningCopy?.description ?? issue.moduleName;

                  return (
                    <li key={issue.warningId}>
                      <span className="font-medium">{issue.moduleName}:</span>{' '}
                      {renderInlineCopy(description)}
                    </li>
                  );
                })}
              </ul>
            </div>
          </Banner>
        )}
      </div>
    </InfoNoticeBanner>
  );
}
