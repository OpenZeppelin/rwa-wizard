import type { ComplianceModuleSelection, RWAConfig } from '@openzeppelin/rwa-config';

import type { ConfigPath } from '../config-path';
import { anchorToConfigPath } from './anchorToConfigPath';
import type { ConfigAnchorKey } from './configAnchor';
import {
  CLAIM_TOPIC_DRAFT_ANCHOR,
  CONFIG_ANCHOR_ATTR,
  FIELD_ID_ATTR,
  isConfigAnchorKey,
  ISSUER_DRAFT_ANCHOR,
  moduleConfigAnchor,
  OWNERSHIP_ADDRESS_ANCHOR,
  parseConfigAnchor,
  tokenAnchor,
} from './configAnchor';

/**
 * Element → `ConfigPath`, in two hops: the element yields an *anchor*, and the
 * anchor plus the draft yield a path.
 *
 * An anchor reaches a control through exactly two channels, and neither is new
 * markup for its own sake:
 *
 * 1. **The control's own `id`**, which every kit-rendered field already carries
 *    — `BaseFieldProps.id` is required and lands on the focusable element. The
 *    kit's field props are closed (no index signature, no rest spread), so for
 *    a kit field the identifier is the `id` or it is nothing. Nine of the
 *    wizard's fields therefore need no markup change at all. AS-5's fingerprint
 *    records every `id`'s source text verbatim, so an id cannot be renamed
 *    without failing that guard — which is what makes leaning on ids safe.
 * 2. **`data-config-anchor`**, or the kit's own `data-field-id`, on the nearest
 *    element enclosing a control's cluster.
 */

/**
 * Static leaf ids, each mapping to the anchor its control carries. Frozen at
 * the type level: a `ReadonlyMap` cannot be written to, which is what keeps
 * INV-21's "no module-level mutable state" true by construction.
 */
const STATIC_ANCHOR_IDS: ReadonlyMap<string, ConfigAnchorKey> = new Map<string, ConfigAnchorKey>([
  ['token-name', tokenAnchor('name')],
  ['token-symbol', tokenAnchor('symbol')],
  ['token-decimals', tokenAnchor('decimals')],
  ['token-initial-supply', tokenAnchor('initialSupply')],
  ['doc-manager-enabled', tokenAnchor('documentManagerEnabled')],
  ['owner-address', OWNERSHIP_ADDRESS_ANCHOR],
  ['trusted-issuer-address', ISSUER_DRAFT_ANCHOR],
  ['custom-topic-name', CLAIM_TOPIC_DRAFT_ANCHOR],
  ['custom-topic-id', CLAIM_TOPIC_DRAFT_ANCHOR],
]);

/** One selector, so the *nearest* identifying ancestor wins whichever attribute
 *  it carries. Two passes would jump over a nearer anchor if a field root ever
 *  sat inside one. */
const IDENTIFYING_SELECTOR = `[${FIELD_ID_ATTR}], [${CONFIG_ANCHOR_ATTR}]` as const;

const ELEMENT_NODE = 1;

/**
 * Whether an element can carry focus for this unit's purposes.
 *
 * Excludes a detached node deliberately. `element.id` reads fine on a detached
 * node and `Element.closest()` traverses a detached subtree happily, so without
 * this gate a control React has already unmounted — a deselected module's config
 * field, a removed issuer's row — would still resolve to a live-looking path.
 * That is retention of a previously resolved path presented as current, which
 * AS-2 prohibits. INV-16.
 *
 * Reads `isConnected` and `localName`, both node properties, so this module
 * never touches the global `document`. INV-14.
 */
export function isFocusTarget(element: Element | null): element is Element {
  if (element === null) return false;
  // `focusin.target` is typed `EventTarget`; a Document or Window can arrive here.
  if ((element as Partial<Node>).nodeType !== ELEMENT_NODE) return false;
  if (!element.isConnected) return false;
  // Focus resting on the body is focus resting on nothing.
  return element.localName !== 'body';
}

/**
 * The config path the focused element writes, or `null`.
 *
 * Pure and total: never throws for any element and any draft, never returns
 * `undefined`, never reads `document`, never mutates either argument, and never
 * retains a previous answer — retention, if a consumer wants it, is the
 * consumer's policy. INV-14, AS-2.
 *
 * The walk, in order (INV-15):
 *
 * 1. Not a live, connected, non-`body` element → `null`.
 * 2. **Leaf id** through the identifier registry. The leaf outranks any
 *    enclosing anchor, which is what lets a scalar module-config field inside an
 *    anchored module panel resolve to its own `config.<key>` path rather than
 *    coarsening to the module entry. An unregistered id falls through; it does
 *    not fail.
 * 3. **Nearest identifying ancestor**, outward. On each, `data-field-id` is
 *    tried before `data-config-anchor` — it is the more specific — and an
 *    identifier that decodes to nothing falls through to the next ancestor, so
 *    a malformed attribute value reads exactly like an absent one (INV-10).
 * 4. Nothing identifying → `null`.
 *
 * The walk needs no sentinel: nothing outside a wizard step carries the
 * attribute or a registered id, so a drawer button, a step-nav button or the
 * body falls out at step 4 with no special case. AS-2 is structural, not a
 * runtime check.
 */
export function resolveFocusedConfigPath(
  element: Element | null,
  config: RWAConfig
): ConfigPath | null {
  const key = resolveFocusedAnchorKey(element, config.compliance.modules);
  if (key === null) return null;

  // Total by construction rather than by assertion: every key this walk can
  // return has already been through `isConfigAnchorKey`, which *is*
  // `parseConfigAnchor`. The guard is here because a non-null assertion would
  // be a claim a later edit to the walk could quietly falsify.
  const anchor = parseConfigAnchor(key);
  return anchor === null ? null : anchorToConfigPath(anchor, config);
}

/**
 * The anchor key an element names, or `null`.
 *
 * The **extracted first hop** of `resolveFocusedConfigPath` above, which is now
 * `resolveFocusedAnchorKey` → `parseConfigAnchor` → `anchorToConfigPath` and
 * keeps its signature, its behaviour and every one of its tests. The extraction
 * is behaviour-preserving by construction: the walk already had keys in hand at
 * both channels — `STATIC_ANCHOR_IDS`' values and `moduleConfigKeyFromId`'s
 * return are both `ConfigAnchorKey` — and threw them away by parsing
 * immediately. Every channel still runs the same validation it ran before, so
 * the two functions agree for every element and every draft. INV-12.
 *
 * It exists because the inspected subject stores an **anchor**, not a path: a
 * path carries array indices the draft can shift underneath it, and a key does
 * not. Resolving the key here and the path at read time is what makes an index
 * shift a non-event.
 *
 * Same purity contract as the resolver above and for the same reasons: pure,
 * total, never reads `document`, never mutates its arguments, never retains an
 * answer. Gated by the same `isFocusTarget`, so a detached node — an unmounted
 * row, a deselected module's field — yields `null` here too. INV-14, INV-16.
 */
export function resolveFocusedAnchorKey(
  element: Element | null,
  modules: readonly ComplianceModuleSelection[]
): ConfigAnchorKey | null {
  if (!isFocusTarget(element)) return null;

  const leaf = anchorKeyFromIdentifier(element.id, modules);
  if (leaf !== null) return leaf;

  let current: Element | null = element.closest(IDENTIFYING_SELECTOR);
  while (current !== null) {
    const key = anchorKeyFromIdentifyingElement(current, modules);
    if (key !== null) return key;
    current = current.parentElement?.closest(IDENTIFYING_SELECTOR) ?? null;
  }

  return null;
}

function anchorKeyFromIdentifyingElement(
  element: Element,
  modules: readonly ComplianceModuleSelection[]
): ConfigAnchorKey | null {
  const fieldId = element.getAttribute(FIELD_ID_ATTR);
  if (fieldId !== null) {
    const fromField = anchorKeyFromIdentifier(fieldId, modules);
    if (fromField !== null) return fromField;
  }

  const raw = element.getAttribute(CONFIG_ANCHOR_ATTR);
  return raw === null ? null : validatedKey(raw);
}

/**
 * The identifier registry: the one place an `id` or a `data-field-id` becomes an
 * anchor. Both channels go through it, so the entry control of an address-list
 * cluster and the cluster's remove buttons agree by construction rather than by
 * coincidence. INV-20.
 */
function anchorKeyFromIdentifier(
  identifier: string,
  modules: readonly ComplianceModuleSelection[]
): ConfigAnchorKey | null {
  if (identifier.length === 0) return null;

  const staticKey = STATIC_ANCHOR_IDS.get(identifier);
  if (staticKey !== undefined) return validatedKey(staticKey);

  const dynamicKey = moduleConfigKeyFromId(identifier, modules);
  return dynamicKey === null ? null : validatedKey(dynamicKey);
}

/**
 * A candidate key from any channel, validated exactly as the walk validated it
 * before the extraction — by decoding it.
 *
 * Applied to the registry's own values too, not only to the untrusted DOM
 * string, and that uniformity is what makes the extraction *provably*
 * behaviour-preserving rather than preserving-except-in-a-case-another-test-
 * forbids: before the extraction every channel ended in `parseConfigAnchor`, so
 * every channel ends in it now. It costs nothing — the parse it replaces is the
 * parse it performs — and a value that decodes to nothing keeps falling through
 * to the next ancestor, reading exactly like an absent one (INV-10).
 */
function validatedKey(candidate: string): ConfigAnchorKey | null {
  return isConfigAnchorKey(candidate) ? candidate : null;
}

/**
 * Split a dynamic module-config id (`` `${module.id}-${field.key}` ``) without a
 * catalog, from the draft alone — which is what keeps this function's inputs at
 * exactly `(element, draft)`.
 *
 * A module's config panel only renders when the module is selected, so its id is
 * necessarily in `compliance.modules`. Take the **longest** matching module id,
 * the most specific split. Zero matches, or two distinct matches of equal
 * length, yield `null` rather than a guess: the tie is unreachable in practice
 * (two distinct ids of the same length cannot both prefix the same string
 * differently) and the ambiguity that *is* reachable — module `a-b` field `c`
 * against module `a` field `b-c` — is closed by the catalog uniqueness test
 * (INV-11). The longest-match rule keeps this total and deterministic either
 * way.
 */
function moduleConfigKeyFromId(
  identifier: string,
  modules: readonly ComplianceModuleSelection[]
): ConfigAnchorKey | null {
  let bestModuleId: string | null = null;
  let bestFieldKey = '';
  let ambiguous = false;

  for (const entry of modules) {
    const prefix = `${entry.moduleId}-`;
    if (!identifier.startsWith(prefix)) continue;

    const fieldKey = identifier.slice(prefix.length);
    if (fieldKey.length === 0) continue;

    if (bestModuleId === null || entry.moduleId.length > bestModuleId.length) {
      bestModuleId = entry.moduleId;
      bestFieldKey = fieldKey;
      ambiguous = false;
    } else if (entry.moduleId.length === bestModuleId.length && entry.moduleId !== bestModuleId) {
      ambiguous = true;
    }
  }

  if (bestModuleId === null || ambiguous) return null;
  return moduleConfigAnchor(bestModuleId, bestFieldKey);
}
