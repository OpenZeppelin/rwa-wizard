import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TooltipProvider } from '@openzeppelin/ui-components';

import { CopyProvider } from '../../../app/providers/CopyProvider';
import { SelectableCard } from '../../../components/shared/SelectableCard';
import { TogglePill } from '../../../components/shared/TogglePill';
import { collectFocusable } from '../../../test/helpers/focusedPathHarness';
import type { FeatureControlMeta } from '../../../types/wizard';
import { createDefaultRwaConfig } from '../../../utils/defaultRwaConfig';
import { AdministrativeControls } from '../steps/asset/AdministrativeControls';
import { IdentityControlsSection } from '../steps/identity/IdentityControlsSection';
import { adminAnchor, claimTopicAnchor, identityControlAnchor } from './configAnchor';
import { resolveFocusedConfigPath } from './resolveFocusedConfigPath';

/**
 * INV-8 (the two shared components add an attribute and nothing else) and INV-3
 * (locked controls are structurally unanchored).
 *
 * Both are "the affordance changes nothing observable" properties, and both are
 * asserted by *difference* rather than by inspection: render with and without
 * the anchor, strip the attribute, and require the rest of the DOM to be equal.
 */

const DRAFT = createDefaultRwaConfig();

function strip(html: string): string {
  return (
    html
      .replace(/\s*data-config-anchor="[^"]*"/g, '')
      // React `useId` values differ per mount (`_r_3_` vs `_r_4_`); they are
      // render-instance identity, not markup, so equalise them before comparing.
      .replace(/_r_[0-9a-z]+_/g, '_r_id_')
  );
}

// ---------------------------------------------------------------------------
// INV-8 — SelectableCard
// ---------------------------------------------------------------------------

describe('INV-8 — SelectableCard', () => {
  const props = {
    title: 'Burnable',
    description: 'Tokens can be burned.',
    isSelected: true,
    onClick: () => {},
  };

  it('renders the anchor on the root button when the prop is given', () => {
    const { container } = render(
      <SelectableCard {...props} configAnchor={adminAnchor('burnable')} />
    );
    const button = container.querySelector('button')!;
    expect(button.getAttribute('data-config-anchor')).toBe('admin|burnable');
    expect(resolveFocusedConfigPath(button, DRAFT)).toBe('token.administrativeControls.burnable');
  });

  /**
   * The omit-when-absent clause, and the reason for it: an empty
   * `data-config-anchor=""` would still match `closest('[data-config-anchor]')`
   * and would claim everything beneath it as its own — turning a would-be
   * resolution into a `null` for reasons nobody would find.
   */
  it('omits the attribute entirely when the prop is absent', () => {
    const { container } = render(<SelectableCard {...props} />);
    const button = container.querySelector('button')!;
    expect(button.hasAttribute('data-config-anchor')).toBe(false);
  });

  it('an unanchored card does not claim a control beneath it', () => {
    const { container } = render(
      <div data-config-anchor="ownershipType">
        <SelectableCard {...props} />
      </div>
    );
    // Falls through to the enclosing anchor rather than being swallowed.
    expect(resolveFocusedConfigPath(container.querySelector('button')!, DRAFT)).toBe(
      'accessControl.ownership.type'
    );
  });

  it('the DOM differs by that one attribute and nothing else', () => {
    const withAnchor = render(<SelectableCard {...props} configAnchor={adminAnchor('burnable')} />);
    const anchored = withAnchor.container.innerHTML;
    withAnchor.unmount();

    const without = render(<SelectableCard {...props} />);
    expect(strip(anchored)).toBe(strip(without.container.innerHTML));
    expect(anchored).not.toBe(without.container.innerHTML);
  });
});

// ---------------------------------------------------------------------------
// INV-8 — TogglePill
// ---------------------------------------------------------------------------

describe('INV-8 — TogglePill', () => {
  const props = {
    label: 'KYC',
    detail: 1,
    selected: true,
    onClick: () => {},
  };

  it('renders the anchor on the wrapper span', () => {
    const { container } = render(<TogglePill {...props} configAnchor={claimTopicAnchor(1)} />);
    const span = container.querySelector('span[data-config-anchor]')!;
    expect(span.localName).toBe('span');
    expect(span.getAttribute('data-config-anchor')).toBe('claimTopic|1');
  });

  it('omits the attribute entirely when the prop is absent', () => {
    const { container } = render(<TogglePill {...props} />);
    expect(container.querySelector('[data-config-anchor]')).toBeNull();
  });

  /**
   * The anchor sits on the wrapper, not on the two inner buttons — both call the
   * same handler for one config location, so one anchor is correct for both.
   * That is only true if `closest()` actually reaches it, which is what this
   * asserts rather than assumes.
   */
  it('both inner buttons reach the wrapper anchor through `closest()`', () => {
    const { container } = render(
      <TogglePill {...props} configAnchor={claimTopicAnchor(1)} onRemove={() => {}} />
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(2);

    for (const button of buttons) {
      expect(resolveFocusedConfigPath(button, DRAFT)).toBe('identityVerification.claimTopics[0]');
    }
  });

  it('the DOM differs by that one attribute and nothing else', () => {
    const withAnchor = render(
      <TogglePill {...props} onRemove={() => {}} configAnchor={claimTopicAnchor(1)} />
    );
    const anchored = withAnchor.container.innerHTML;
    withAnchor.unmount();

    const without = render(<TogglePill {...props} onRemove={() => {}} />);
    expect(strip(anchored)).toBe(strip(without.container.innerHTML));
    expect(anchored).not.toBe(without.container.innerHTML);
  });
});

// ---------------------------------------------------------------------------
// INV-3 — locked controls are structurally unanchored
// ---------------------------------------------------------------------------

/**
 * Test metas rather than the live registry, deliberately: all seven live
 * administrative and identity controls are `locked: true` today, so without a
 * synthetic unlocked entry the *unlocked* branch is never exercised — and a
 * refactor that folded the two branches into one anchored card with a `disabled`
 * flag would pass every test in the suite.
 */
const LOCKED: FeatureControlMeta = {
  id: 'burnable',
  name: 'Burnable',
  locked: true,
  defaultValue: true,
  description: 'Locked control.',
};

const UNLOCKED: FeatureControlMeta = {
  id: 'mintable',
  name: 'Mintable',
  locked: false,
  defaultValue: true,
  description: 'Unlocked control.',
};

function renderWithProviders(node: React.ReactElement) {
  return render(
    <CopyProvider targetId="stellar">
      <TooltipProvider delayDuration={200}>{node}</TooltipProvider>
    </CopyProvider>
  );
}

describe('INV-3 — locked controls carry no anchor', () => {
  it('AdministrativeControls anchors the unlocked control only', () => {
    const { container } = renderWithProviders(
      <AdministrativeControls
        controls={DRAFT.token.administrativeControls}
        adminControlsMeta={[LOCKED, UNLOCKED]}
      />
    );

    const anchored = [...container.querySelectorAll('[data-config-anchor]')];
    expect(anchored).toHaveLength(1);
    expect(anchored[0]!.getAttribute('data-config-anchor')).toBe('admin|mintable');
  });

  it('IdentityControlsSection anchors the unlocked control only', () => {
    const { container } = renderWithProviders(
      <IdentityControlsSection
        controls={DRAFT.identityVerification.controls}
        identityControlsMeta={[
          { ...LOCKED, id: 'addressFreezing', name: 'Address Freezing' },
          { ...UNLOCKED, id: 'recovery', name: 'Recovery' },
        ]}
      />
    );

    const anchored = [...container.querySelectorAll('[data-config-anchor]')];
    expect(anchored).toHaveLength(1);
    expect(anchored[0]!.getAttribute('data-config-anchor')).toBe('identityControl|recovery');
  });

  it('every focusable inside a locked card resolves to null', () => {
    const { container } = renderWithProviders(
      <AdministrativeControls
        controls={DRAFT.token.administrativeControls}
        adminControlsMeta={[{ ...LOCKED, infoCopy: 'Why this is locked.' }]}
      />
    );

    const controls = collectFocusable(container);
    // The locked card renders at least its info icon, so this is not vacuous.
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      expect(resolveFocusedConfigPath(control, DRAFT)).toBeNull();
    }
  });

  it('the unlocked control resolves to its own path', () => {
    const { container } = renderWithProviders(
      <AdministrativeControls
        controls={DRAFT.token.administrativeControls}
        adminControlsMeta={[UNLOCKED]}
      />
    );
    const card = container.querySelector('[data-config-anchor]')!;
    expect(resolveFocusedConfigPath(card, DRAFT)).toBe('token.administrativeControls.mintable');
  });

  /**
   * "No path" is the *absence of an anchor*, not a runtime rejection. There is no
   * `if (locked)` anywhere in `focused-path/` — the resolver has never heard of
   * locking — and that is what makes INV-3 structural rather than a rule the
   * resolver could forget to apply.
   */
  it('the resolver has no notion of locking — an anchored locked control would resolve', () => {
    const { container } = render(
      <SelectableCard
        title="Hypothetically anchored"
        isSelected
        onClick={() => {}}
        disabled
        configAnchor={identityControlAnchor('recovery')}
      />
    );
    expect(resolveFocusedConfigPath(container.querySelector('button')!, DRAFT)).toBe(
      'identityVerification.controls.recovery'
    );
  });
});
