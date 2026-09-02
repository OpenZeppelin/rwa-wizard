import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';

import {
  getEcosystemMetadata as getStellarEcosystemMetadata,
  getAvailableModules as getStellarModules,
} from '@openzeppelin/codegen-rwa-stellar';
import type { OwnershipModel, RWAConfig } from '@openzeppelin/rwa-config';
import { TooltipProvider } from '@openzeppelin/ui-components';

import { CopyProvider } from '../../app/providers/CopyProvider';
import { DeployReadinessProvider } from '../../features/wizard/context/DeployReadinessProvider';
import { AccessControlStep } from '../../features/wizard/steps/access-control/AccessControlStep';
import { AssetStep } from '../../features/wizard/steps/asset/AssetStep';
import { ComplianceStep } from '../../features/wizard/steps/compliance/ComplianceStep';
import { DeploymentPlaceholder } from '../../features/wizard/steps/deployment/DeploymentPlaceholder';
import { IdentityStep } from '../../features/wizard/steps/identity/IdentityStep';
import { ReviewStep } from '../../features/wizard/steps/review/ReviewStep';
import {
  enrichAvailableModules,
  enrichEcosystemMetadata,
} from '../../registry/enrichEcosystemMetadata';
import type { DeployGuidanceDTO } from '../../services/codegen/types';
import type {
  ComplianceModuleOption,
  StructuralComplianceModuleOption,
  StructuralEcosystemMetadata,
  TargetEcosystemMetadata,
  WizardStepId,
} from '../../types/wizard';

/**
 * Shared harness for the SF-12 enumeration (INV-1..INV-4, INV-19, INV-25).
 *
 * Everything here is chosen so the enumeration measures the *real* control
 * surface rather than a convenient one: the metadata is the Stellar package's
 * own, run through the app's enrichment seam, and the fixture draft is built to
 * make every branch render (§ 8.5). A fixture that quietly stops rendering a
 * branch is exactly the drift INV-1's pinned totals exist to catch, so nothing
 * below is derived from the render.
 */

/** The wizard's step ids, in `useWizardSteps` order. `deployment` is included
 *  because it is a step the wizard can render; its flag is off by default and it
 *  therefore contributes no controls, which is a fact worth pinning rather than
 *  omitting. */
export const ENUMERATED_STEP_IDS = [
  'asset',
  'identity',
  'compliance',
  'access-control',
  'deployment',
  'review',
] as const satisfies readonly WizardStepId[];

export type EnumeratedStepId = (typeof ENUMERATED_STEP_IDS)[number];

/** The three `OwnershipModel` variants, each with a distinct address member. */
export const OWNERSHIP_VARIANTS: readonly OwnershipModel[] = [
  { type: 'single-owner', ownerAddress: 'GOWNER' },
  { type: 'multi-sig', address: 'GMULTISIG' },
  { type: 'dao', address: 'GDAO' },
] as const;

export type OwnershipVariantType = OwnershipModel['type'];

/**
 * The focusable-control selector from INV-1, verbatim, minus `[disabled]` and
 * `[aria-hidden="true"]`.
 *
 * happy-dom decides focusability from attributes rather than layout, so this
 * over-collects (a CSS-hidden control is counted). That is the safe direction —
 * it cannot *miss* a control — and it is why real tab-reachability is verified
 * once in a browser rather than here.
 */
export const FOCUSABLE_SELECTOR =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function collectFocusable(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (element) => !element.matches('[disabled]') && element.getAttribute('aria-hidden') !== 'true'
  );
}

/**
 * A control's accessible name, near enough for a descriptor: the explicit
 * `aria-label`, else the trimmed text content, else the placeholder.
 *
 * Deliberately *not* the sole key of a descriptor — see INV-2. Names come from
 * `@openzeppelin/rwa-wizard-copy`, so keying a partition on them alone would
 * make an unrelated copy edit fail the enumeration and would collapse two
 * same-named controls into one entry.
 */
export function accessibleNameOf(element: HTMLElement): string {
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel !== null && ariaLabel.length > 0) return ariaLabel;

  const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (text.length > 0) return text;

  const placeholder = element.getAttribute('placeholder');
  if (placeholder !== null && placeholder.length > 0) return `placeholder:${placeholder}`;

  if (element.id.length > 0) return `#${element.id}`;
  return `<${element.localName}>`;
}

/**
 * `${stepId}·${tagName}·${accessibleName}#${occurrenceIndex}` — INV-2.
 *
 * The occurrence index is what makes the multiset meaningful: two `Remove`
 * buttons in one step are two descriptors, so one of them losing its provenance
 * is a failure rather than an unchanged set.
 */
export function descriptorOf(
  stepId: string,
  element: HTMLElement,
  occurrenceIndex: number
): string {
  return `${stepId}·${element.localName}·${cap(accessibleNameOf(element))}#${occurrenceIndex}`;
}

/**
 * Accessible names are capped in the descriptor so a failure message stays
 * readable — `ImplementationApproach`'s card carries three sentences of copy.
 * The cap costs nothing: uniqueness is carried by `occurrenceIndex`, not by the
 * name.
 */
const DESCRIPTOR_NAME_CAP = 48;

function cap(name: string): string {
  return name.length <= DESCRIPTOR_NAME_CAP ? name : `${name.slice(0, DESCRIPTOR_NAME_CAP)}…`;
}

// ---------------------------------------------------------------------------
// Real metadata, through the app's own enrichment seam
// ---------------------------------------------------------------------------

export const STELLAR_TARGET_ID = 'stellar';

export function stellarStructuralMetadata(): StructuralEcosystemMetadata {
  return getStellarEcosystemMetadata();
}

export function stellarEcosystemMetadata(): TargetEcosystemMetadata {
  return enrichEcosystemMetadata(STELLAR_TARGET_ID, stellarStructuralMetadata());
}

export function stellarStructuralModules(): readonly StructuralComplianceModuleOption[] {
  return getStellarModules();
}

export function stellarModules(): ComplianceModuleOption[] {
  return enrichAvailableModules(STELLAR_TARGET_ID, stellarStructuralModules());
}

/** The one address-list config field in the Stellar catalog today (INV-20). */
export function addressListFieldRef(): { moduleId: string; fieldKey: string } {
  for (const module of stellarModules()) {
    for (const field of module.configFields) {
      if (field.valueKind === 'address-list') return { moduleId: module.id, fieldKey: field.key };
    }
  }
  throw new Error(
    'No address-list config field in the Stellar catalog. INV-20 and INV-26 are written ' +
      'against one; if the catalog genuinely lost it, those invariants need re-siting, not ' +
      'a fixture patch.'
  );
}

// ---------------------------------------------------------------------------
// The § 8.5 fixture draft
// ---------------------------------------------------------------------------

/** A predefined claim topic id and a custom one, so both pill branches render. */
export const FIXTURE_PREDEFINED_TOPIC = { id: 1, name: 'KYC' } as const;
export const FIXTURE_CUSTOM_TOPIC = {
  id: 9001,
  name: 'Custom Accreditation',
  isCustom: true,
} as const;

export const FIXTURE_ISSUER_A = 'GISSUERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export const FIXTURE_ISSUER_B = 'GISSUERBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

/**
 * The first two operator role *names* from the real metadata.
 *
 * Read from metadata rather than written out, because `OperatorRolesSection`
 * keys its anchor on `roleDef.name` and a hand-written name that matches no role
 * makes every row resolve to the same pending index — which looks like a passing
 * test of nothing. Reading them keeps at least two rows at real indices.
 */
export function fixtureRoleNames(): readonly [string, string] {
  const roles = stellarEcosystemMetadata().operatorRoles;
  const first = roles[0]?.name;
  const second = roles[1]?.name;
  if (first === undefined || second === undefined) {
    throw new Error('Fixture needs at least two operator roles in the Stellar metadata.');
  }
  return [first, second];
}

/**
 * Deploy guidance that makes `DeployReadinessPanel` render **both** review-step
 * checkboxes.
 *
 * `networkIsTestnet` must be true and `supportsIdentitySupport` must be passed,
 * or `include-identity-support` never renders — and INV-13, whose whole point is
 * that this one control moves the generated output and still resolves to
 * nothing, would be asserting over a control that is not on the page.
 */
export function fixtureDeployGuidance(): DeployGuidanceDTO {
  return {
    adminAddress: 'GADMIN',
    managerAddress: 'GMANAGER',
    adminEqualsManager: false,
    networkDisplayName: 'Testnet',
    networkIsTestnet: true,
    demoAutoMintEligible: true,
    demoMintComplianceIssues: [],
  };
}

/**
 * The fixture draft: two modules selected (one scalar without config — the
 * `handleToggleModule` append shape; one carrying the address-list field), at
 * least one left unselected, two trusted issuers, one predefined and one custom
 * claim topic, the document manager on so its role row renders, and every
 * administrative and identity control present.
 *
 * Deliberately omits `token.initialSupply` and leaves the scalar module without
 * a `config` object so INV-19 exercises the same sparse shapes as
 * `createDefaultRwaConfig` / a freshly toggled module — absent optional members
 * must remain admissible, not be mistaken for pending collection slots.
 */
export function fixtureDraft(ownership: OwnershipModel = OWNERSHIP_VARIANTS[0]!): RWAConfig {
  const modules = stellarModules();
  const addressList = addressListFieldRef();
  const scalarModule = modules.find(
    (module) =>
      module.id !== addressList.moduleId &&
      module.configFields.some((field) => field.valueKind !== 'address-list')
  );
  if (!scalarModule) {
    throw new Error('Fixture needs a second module with a scalar config field.');
  }

  const roleNames = fixtureRoleNames();

  return {
    token: {
      name: 'Fixture Token',
      symbol: 'FIX',
      decimals: 7,
      administrativeControls: { burnable: true, mintable: true, pausable: true },
      documentManager: { enabled: true },
    },
    identityVerification: {
      claimTopics: [{ ...FIXTURE_PREDEFINED_TOPIC }, { ...FIXTURE_CUSTOM_TOPIC }],
      trustedIssuers: [
        { address: FIXTURE_ISSUER_A, claimTopics: [FIXTURE_PREDEFINED_TOPIC.id] },
        { address: FIXTURE_ISSUER_B, claimTopics: [FIXTURE_CUSTOM_TOPIC.id] },
      ],
      controls: {
        addressFreezing: true,
        partialTokenFreezing: true,
        recovery: true,
        forcedTransfers: true,
      },
    },
    compliance: {
      modules: [
        { moduleId: scalarModule.id },
        { moduleId: addressList.moduleId, config: { [addressList.fieldKey]: ['GAAA', 'GBBB'] } },
      ],
    },
    accessControl: {
      ownership,
      roles: [
        { name: roleNames[0], addresses: ['GROLEA'] },
        { name: roleNames[1], addresses: ['GROLEB'] },
      ],
    },
    deployment: { target: { kind: 'preset', ecosystem: 'stellar', networkId: 'stellar-testnet' } },
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const noop = (): void => {};

/**
 * Render one wizard step with the real metadata and no adapter capabilities.
 *
 * No `AdapterCapabilitiesProvider` is mounted, so `useAddressing` returns
 * `undefined` and `useExplorer` returns `null` — which is the wizard's own
 * behaviour before an adapter resolves, and keeps the harness free of a stub
 * whose drift from the real adapter nothing would catch.
 */
export function renderStep(stepId: EnumeratedStepId, draft: RWAConfig): RenderResult {
  const metadata = stellarEcosystemMetadata();
  const modules = stellarModules();

  const element: ReactElement = (() => {
    switch (stepId) {
      case 'asset':
        return (
          <AssetStep
            token={draft.token}
            adminControlsMeta={metadata.administrativeControls}
            codegenInfoBlurb={null}
            onUpdate={noop}
          />
        );
      case 'identity':
        return (
          <IdentityStep
            identity={draft.identityVerification}
            maxTrustedIssuers={metadata.limits.maxTrustedIssuers}
            identityControlsMeta={metadata.identityControls}
            onUpdate={noop}
          />
        );
      case 'compliance':
        return (
          <ComplianceStep
            targetId={STELLAR_TARGET_ID}
            compliance={draft.compliance}
            initialSupply={draft.token.initialSupply}
            availableModules={modules}
            complianceHooks={metadata.complianceHooks}
            moduleCategories={metadata.complianceCatalog.moduleCategories}
            selectionWarningRules={metadata.complianceCatalog.selectionWarningRules}
            onUpdate={noop}
          />
        );
      case 'access-control':
        return (
          <AccessControlStep
            accessControl={draft.accessControl}
            documentManagerEnabled={draft.token.documentManager.enabled}
            operatorRoles={metadata.operatorRoles}
            onUpdate={noop}
          />
        );
      case 'deployment':
        return <DeploymentPlaceholder />;
      case 'review':
        return (
          <ReviewStep
            config={draft}
            targetId={STELLAR_TARGET_ID}
            availableModules={modules}
            deployGuidance={fixtureDeployGuidance()}
            supportsIdentitySupport
          />
        );
      default: {
        const exhaustive: never = stepId;
        return exhaustive;
      }
    }
  })();

  // The two providers the app itself mounts above every step: copy, and the
  // tooltip root the kit's info icons require. Nothing else is stubbed — every
  // control below is the one the wizard renders.
  // The providers the app itself mounts above every step: copy, the tooltip root
  // the kit's info icons require, and the deploy-readiness state the review
  // step's two checkboxes read. Nothing is stubbed — every control collected
  // below is the one the wizard renders.
  return render(
    <CopyProvider targetId={STELLAR_TARGET_ID}>
      <TooltipProvider delayDuration={200}>
        <DeployReadinessProvider>{element}</DeployReadinessProvider>
      </TooltipProvider>
    </CopyProvider>
  );
}
