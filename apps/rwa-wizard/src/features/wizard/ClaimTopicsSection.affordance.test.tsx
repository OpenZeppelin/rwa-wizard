/**
 * SF-17 — ClaimTopicsSection write shapes (INV-9, INV-10, INV-13, INV-14)
 * and TopicToggleGroup counter / wiring (INV-8, INV-11).
 *
 * Exercises the real section under InspectedAnchorProvider so AS-1–3 land on
 * production handlers, not extracted helper stubs.
 */
import { act, fireEvent, render, type RenderResult } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useState, type ReactElement } from 'react';

import type { ClaimTopic, IdentityVerificationConfig, RWAConfig } from '@openzeppelin/rwa-config';
import { isClaimTopicSelected, PREDEFINED_CLAIM_TOPICS } from '@openzeppelin/rwa-config';
import { TooltipProvider } from '@openzeppelin/ui-components';

import { ClaimTopicsSection } from './steps/identity/ClaimTopicsSection';

import { CopyProvider } from '../../app/providers/CopyProvider';
import {
  FIXTURE_CUSTOM_TOPIC,
  FIXTURE_ISSUER_A,
  FIXTURE_ISSUER_B,
  FIXTURE_PREDEFINED_TOPIC,
  fixtureDraft,
  STELLAR_TARGET_ID,
} from '../../test/helpers/focusedPathHarness';
import { findToken, findTokenAcross, readScannedSources } from '../../test/helpers/sourceScan';
import { claimTopicAnchor } from './focused-path';
import { InspectedAnchorProvider } from './inspected-anchor';

const PREDEFINED = claimTopicAnchor(FIXTURE_PREDEFINED_TOPIC.id);
const CUSTOM = claimTopicAnchor(FIXTURE_CUSTOM_TOPIC.id);
const KYC = PREDEFINED_CLAIM_TOPICS.find((topic) => topic.id === 1)!;
const AML = PREDEFINED_CLAIM_TOPICS.find((topic) => topic.id === 2)!;

interface Harness extends RenderResult {
  readonly identity: () => IdentityVerificationConfig;
}

function StatefulSection({
  initial,
  onIdentity,
}: {
  initial: RWAConfig;
  onIdentity: (identity: IdentityVerificationConfig) => void;
}): ReactElement {
  const [identity, setIdentity] = useState(initial.identityVerification);
  return (
    <InspectedAnchorProvider scopeToken="sf17" modules={initial.compliance.modules}>
      <ClaimTopicsSection
        identity={identity}
        onUpdate={(patch) => {
          setIdentity((current) => {
            const next = { ...current, ...patch };
            onIdentity(next);
            return next;
          });
        }}
      />
    </InspectedAnchorProvider>
  );
}

function mountSection(draft: RWAConfig = fixtureDraft()): Harness {
  let latest = draft.identityVerification;
  const result = render(
    <CopyProvider targetId={STELLAR_TARGET_ID}>
      <TooltipProvider delayDuration={200}>
        <StatefulSection
          initial={draft}
          onIdentity={(identity) => {
            latest = identity;
          }}
        />
      </TooltipProvider>
    </CopyProvider>
  );
  return { ...result, identity: () => latest };
}

function chip(harness: Harness, anchor: string): HTMLElement {
  const el = harness.container.querySelector<HTMLElement>(`[data-config-anchor="${anchor}"]`);
  if (el === null) throw new Error(`no chip for ${anchor}`);
  return el;
}

function selectionControl(harness: Harness, anchor: string): HTMLButtonElement {
  const control = chip(harness, anchor).querySelector<HTMLButtonElement>('button[aria-pressed]');
  if (control === null) throw new Error(`${anchor}: missing selection control (INV-3)`);
  return control;
}

function bodyControl(harness: Harness, anchor: string): HTMLButtonElement {
  const buttons = [...chip(harness, anchor).querySelectorAll<HTMLButtonElement>('button')];
  const body = buttons.find(
    (button) =>
      !button.hasAttribute('aria-pressed') &&
      !button.getAttribute('aria-label')?.startsWith('Remove ')
  );
  if (body === undefined) throw new Error(`${anchor}: missing body button`);
  return body;
}

function removeControl(harness: Harness, anchor: string): HTMLButtonElement {
  const control = chip(harness, anchor).querySelector<HTMLButtonElement>(
    'button[aria-label^="Remove "]'
  );
  if (control === null) throw new Error(`${anchor}: missing remove control`);
  return control;
}

describe('SF-17 ClaimTopicsSection — write shapes (INV-9, INV-10)', () => {
  it('INV-9 shape 1: absent predefined → append (sole append path)', () => {
    const draft = fixtureDraft();
    draft.identityVerification.claimTopics = [{ ...FIXTURE_CUSTOM_TOPIC }];
    const harness = mountSection(draft);
    expect(harness.identity().claimTopics.map((t) => t.id)).not.toContain(KYC.id);

    fireEvent.click(selectionControl(harness, claimTopicAnchor(KYC.id)));

    const topics = harness.identity().claimTopics;
    expect(topics.map((t) => t.id)).toContain(KYC.id);
    expect(isClaimTopicSelected(topics.find((t) => t.id === KYC.id)!)).toBe(true);
    // Appended at end — does not reorder existing custom.
    expect(topics[topics.length - 1]!.id).toBe(KYC.id);
  });

  it('INV-9 shape 2: present selected → selected: false; issuers untouched', () => {
    const harness = mountSection();
    const beforeIssuers = structuredClone(harness.identity().trustedIssuers);

    fireEvent.click(selectionControl(harness, PREDEFINED));

    const topic = harness.identity().claimTopics.find((t) => t.id === FIXTURE_PREDEFINED_TOPIC.id);
    expect(topic, 'INV-9: unselect must keep the topic in the array').toBeDefined();
    expect(topic!.selected).toBe(false);
    expect(isClaimTopicSelected(topic!)).toBe(false);
    expect(harness.identity().trustedIssuers).toEqual(beforeIssuers);
  });

  it('INV-9 shape 3: present unselected → omit-when-true reselect, same index', () => {
    const draft = fixtureDraft();
    draft.identityVerification.claimTopics = [
      { ...FIXTURE_PREDEFINED_TOPIC, selected: false },
      { ...FIXTURE_CUSTOM_TOPIC },
    ];
    const harness = mountSection(draft);
    const indexBefore = harness
      .identity()
      .claimTopics.findIndex((t) => t.id === FIXTURE_PREDEFINED_TOPIC.id);

    fireEvent.click(selectionControl(harness, PREDEFINED));

    const topics = harness.identity().claimTopics;
    const indexAfter = topics.findIndex((t) => t.id === FIXTURE_PREDEFINED_TOPIC.id);
    expect(indexAfter).toBe(indexBefore);
    expect(topics[indexAfter]!).not.toHaveProperty('selected');
    expect(isClaimTopicSelected(topics[indexAfter]!)).toBe(true);
  });

  it('INV-9 round-trip: unselect → reselect is deep-equal including issuer associations', () => {
    const harness = mountSection();
    const before = structuredClone(harness.identity());

    fireEvent.click(selectionControl(harness, PREDEFINED));
    fireEvent.click(selectionControl(harness, PREDEFINED));

    expect(harness.identity()).toEqual(before);
  });

  it('INV-10: pruneIssuerTopics has exactly one call site — handleRemove', () => {
    const [source] = readScannedSources([
      'src/features/wizard/steps/identity/ClaimTopicsSection.tsx',
    ]);
    const calls = findToken(source!, 'pruneIssuerTopics(').filter(
      (hit) => !hit.includes('const pruneIssuerTopics')
    );
    // Definition is `const pruneIssuerTopics = useCallback(` — call is inside handleRemove.
    const callOnly = calls.filter((hit) => /pruneIssuerTopics\(topicId\)/.test(hit));
    expect(callOnly, 'INV-10: pruneIssuerTopics must be invoked only from the × path').toHaveLength(
      1
    );
    expect(callOnly[0]).toMatch(/ClaimTopicsSection\.tsx:\d+:/);
  });

  it('INV-10: selection control never changes trustedIssuers', () => {
    const harness = mountSection();
    const before = structuredClone(harness.identity().trustedIssuers);
    fireEvent.click(selectionControl(harness, PREDEFINED));
    fireEvent.click(selectionControl(harness, CUSTOM));
    expect(harness.identity().trustedIssuers).toEqual(before);
  });
});

describe('SF-17 ClaimTopicsSection — interaction (INV-12–14)', () => {
  it('INV-12: body click on a selected predefined chip leaves selection unchanged', () => {
    const harness = mountSection();
    const before = structuredClone(harness.identity().claimTopics);

    fireEvent.click(bodyControl(harness, PREDEFINED));

    expect(harness.identity().claimTopics).toEqual(before);
    expect(
      isClaimTopicSelected(
        harness.identity().claimTopics.find((t) => t.id === FIXTURE_PREDEFINED_TOPIC.id)!
      )
    ).toBe(true);
  });

  it('INV-13: selection control toggles only deploy-selection; inspected-unselected stays marked', () => {
    const harness = mountSection();
    act(() => {
      bodyControl(harness, PREDEFINED).focus();
    });
    expect(chip(harness, PREDEFINED).getAttribute('aria-current')).toBe('true');

    fireEvent.click(selectionControl(harness, PREDEFINED));

    const topic = harness.identity().claimTopics.find((t) => t.id === FIXTURE_PREDEFINED_TOPIC.id)!;
    expect(topic.selected).toBe(false);
    expect(harness.identity().claimTopics.map((t) => t.id)).toContain(FIXTURE_PREDEFINED_TOPIC.id);
    expect(
      chip(harness, PREDEFINED).getAttribute('aria-current'),
      'INV-1/13: unselect must not clear inspection'
    ).toBe('true');
  });

  it('INV-14: × deletes the custom topic and prunes issuer associations', () => {
    const harness = mountSection();
    expect(
      harness
        .identity()
        .trustedIssuers.some((iss) => iss.claimTopics.includes(FIXTURE_CUSTOM_TOPIC.id))
    ).toBe(true);

    fireEvent.click(removeControl(harness, CUSTOM));

    expect(harness.identity().claimTopics.map((t) => t.id)).not.toContain(FIXTURE_CUSTOM_TOPIC.id);
    for (const issuer of harness.identity().trustedIssuers) {
      expect(issuer.claimTopics).not.toContain(FIXTURE_CUSTOM_TOPIC.id);
    }
  });

  it('INV-14 / INV-5: selection unselect on custom keeps the topic; × is the only delete', () => {
    const harness = mountSection();
    fireEvent.click(selectionControl(harness, CUSTOM));

    const topic = harness.identity().claimTopics.find((t) => t.id === FIXTURE_CUSTOM_TOPIC.id);
    expect(topic).toBeDefined();
    expect(topic!.selected).toBe(false);
    expect(
      harness.identity().trustedIssuers.find((iss) => iss.address === FIXTURE_ISSUER_B)?.claimTopics
    ).toContain(FIXTURE_CUSTOM_TOPIC.id);
  });

  it('INV-5: predefined chips never render ×', () => {
    const harness = mountSection();
    expect(chip(harness, PREDEFINED).querySelector('button[aria-label^="Remove "]')).toBeNull();
    expect(chip(harness, CUSTOM).querySelector('button[aria-label^="Remove "]')).not.toBeNull();
  });
});

describe('SF-17 TopicToggleGroup — INV-8 / INV-11', () => {
  it('INV-8: claim-topic selected props route through isClaimTopicSelected (source scan)', () => {
    const [source] = readScannedSources(['src/components/shared/TopicToggleGroup.tsx']);
    expect(findToken(source!, 'selected={true}')).toEqual([]);
    expect(findToken(source!, 'selected={true ')).toEqual([]);
    // Every selected= on TogglePill usages goes through the helper or false for absent.
    expect(source!.stripped).toMatch(/selected=\{isClaimTopicSelected/);
    expect(source!.stripped).toMatch(/selected=\{isSelected\}/);
    expect(source!.stripped).toMatch(/isSelected = fromDraft \? isClaimTopicSelected/);
  });

  it('INV-8: unselected custom (selected: false) renders unselected treatment', () => {
    const draft = fixtureDraft();
    draft.identityVerification.claimTopics = [
      { ...FIXTURE_PREDEFINED_TOPIC },
      { ...FIXTURE_CUSTOM_TOPIC, selected: false },
    ];
    const harness = mountSection(draft);
    const wrapper = chip(harness, CUSTOM);
    expect(wrapper.className).toContain('border-dashed');
    expect(selectionControl(harness, CUSTOM).getAttribute('aria-pressed')).toBe('false');
  });

  it('INV-11: counter counts selected; atLimit counts defined', () => {
    const draft = fixtureDraft();
    // Two defined, one unselected → counter 1/15; not at limit.
    draft.identityVerification.claimTopics = [
      { ...FIXTURE_PREDEFINED_TOPIC, selected: false },
      { ...FIXTURE_CUSTOM_TOPIC },
    ];
    const harness = mountSection(draft);
    expect(harness.container.textContent).toMatch(/1\/15 selected/);

    // Fill to max defined with unselected fillers — atLimit must still block add.
    const fillers: ClaimTopic[] = Array.from({ length: 13 }, (_, i) => ({
      id: 9200 + i,
      name: `Fill ${i}`,
      isCustom: true as const,
      selected: false,
    }));
    draft.identityVerification.claimTopics = [
      { ...FIXTURE_PREDEFINED_TOPIC, selected: false },
      { ...FIXTURE_CUSTOM_TOPIC, selected: false },
      ...fillers,
    ];
    // Remount at cap.
    harness.unmount();
    const capped = mountSection(draft);
    expect(capped.identity().claimTopics).toHaveLength(15);
    expect(capped.container.textContent).toMatch(/0\/15 selected/);
    // A catalogue topic absent from the draft is disabled when atLimit (B-5).
    expect(selectionControl(capped, claimTopicAnchor(AML.id)).disabled).toBe(true);
    // A defined-but-unselected topic in the draft stays toggleable at atLimit.
    expect(selectionControl(capped, PREDEFINED).disabled).toBe(false);
  });

  it('INV-11: a defined-but-unselected topic stays toggleable at max defined', () => {
    const draft = fixtureDraft();
    const fillers: ClaimTopic[] = Array.from({ length: 13 }, (_, i) => ({
      id: 9200 + i,
      name: `Fill ${i}`,
      isCustom: true as const,
      selected: false,
    }));
    draft.identityVerification.claimTopics = [
      { ...FIXTURE_PREDEFINED_TOPIC, selected: false },
      { ...FIXTURE_CUSTOM_TOPIC, selected: false },
      ...fillers,
    ];
    const harness = mountSection(draft);
    expect(harness.identity().claimTopics).toHaveLength(15);
    expect(selectionControl(harness, PREDEFINED).disabled).toBe(false);
    expect(selectionControl(harness, CUSTOM).disabled).toBe(false);
  });

  it('INV-11: unselecting at max defined does not free a slot (Add stays blocked)', () => {
    const draft = fixtureDraft();
    const fillers: ClaimTopic[] = Array.from({ length: 13 }, (_, i) => ({
      id: 9100 + i,
      name: `Cap ${i}`,
      isCustom: true as const,
    }));
    draft.identityVerification.claimTopics = [
      { ...FIXTURE_PREDEFINED_TOPIC },
      { ...FIXTURE_CUSTOM_TOPIC },
      ...fillers,
    ];
    const harness = mountSection(draft);
    expect(harness.identity().claimTopics).toHaveLength(15);

    fireEvent.click(selectionControl(harness, PREDEFINED));
    expect(harness.identity().claimTopics).toHaveLength(15);
    expect(harness.container.textContent).toMatch(/14\/15 selected/);

    fireEvent.change(harness.container.querySelector('#custom-topic-name')!, {
      target: { value: 'Overflow' },
    });
    fireEvent.change(harness.container.querySelector('#custom-topic-id')!, {
      target: { value: '9999' },
    });
    const add = harness.container.querySelector(
      'button[data-config-anchor="claimTopicDraft"]'
    ) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
  });
});

describe('SF-17 ClaimTopicsSection — first producer of selected: false (closes SF-16 INV-35)', () => {
  it('the sole app write of selected: false is ClaimTopicsSection unselectTopic', () => {
    const sources = readScannedSources(
      // Walk is expensive; pin the identity step + shared chip files that could write.
      [
        'src/features/wizard/steps/identity/ClaimTopicsSection.tsx',
        'src/features/wizard/steps/identity/TrustedIssuersSection.tsx',
        'src/components/shared/TogglePill.tsx',
        'src/components/shared/TopicToggleGroup.tsx',
      ]
    );
    const hits = findTokenAcross(sources, 'selected: false');
    expect(hits).toEqual([
      expect.stringMatching(
        /ClaimTopicsSection\.tsx:\d+: return topics\.map\(\(topic\) => \(topic\.id === topicId \? \{ \.\.\.topic, selected: false \} : topic\)\);/
      ),
    ]);
  });

  it('FIXTURE issuers still reference the predefined topic after unselect (no prune)', () => {
    const harness = mountSection();
    fireEvent.click(selectionControl(harness, PREDEFINED));
    expect(
      harness.identity().trustedIssuers.find((iss) => iss.address === FIXTURE_ISSUER_A)?.claimTopics
    ).toContain(FIXTURE_PREDEFINED_TOPIC.id);
  });
});
