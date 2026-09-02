import { isClaimTopicSelected, type RWAConfig } from '@openzeppelin/rwa-config';

/**
 * Ascending positions in `config.identityVerification.claimTopics` that are
 * selected.
 *
 * Returns INDICES, not topics, deliberately. Emission sites must keep reading
 * `config…claimTopics[index]` on the lines each topic shapes so per-line
 * provenance attribution survives; handing them detached topic objects would
 * attribute every claim-topic line to one read at the top of the file, and every
 * golden would still pass.
 *
 * A COUNT is not a substitute either, and that is the sharper trap: today a
 * count and the index space coincide because every defined topic is selected, so
 * a loop bounded by the selected count reads the first *n* array positions
 * instead of the *n* selected ones. On `[1 (unselected), 2, 7]` that registers
 * topic 1 on-chain and never registers topic 7.
 *
 * MUST be called inside a `builder.observe(…)` scope so the per-topic `selected`
 * reads are captured by that scope. Called bare, its reads drain onto whichever
 * emission follows — they are not lost, they are misattributed, which is worse.
 *
 * Pure, O(n) with n bounded by `MAX_CLAIM_TOPICS`, one allocation, and
 * deliberately NOT memoised: under provenance the config is a recording proxy
 * whose views are already cached one per target, so a cache keyed on it would
 * survive across `observe` scopes and make the second call record no reads at
 * all — emptying the heading's path set with nothing to say a cache did it.
 */
export function selectedClaimTopicIndices(config: RWAConfig): readonly number[] {
  const { claimTopics } = config.identityVerification;
  const indices: number[] = [];

  for (let index = 0; index < claimTopics.length; index += 1) {
    const topic = claimTopics[index];
    if (topic !== undefined && isClaimTopicSelected(topic)) indices.push(index);
  }

  return indices;
}

/**
 * The `id` of every selected claim topic, ascending by array position.
 *
 * The aggregate form, for the surfaces that emit the whole set on one line — a
 * `--claim_topics '[…]'` argument, a `for TOPIC in …` word list, a confirmation
 * echo that prints the set. Those lines are legitimately shaped by every topic
 * at once, so one observed read attributed to the one line it shapes is correct
 * there.
 *
 * Derived from `selectedClaimTopicIndices` rather than walking the array again,
 * so the two cannot disagree for any of the three input states. They must not:
 * `deploy.sh` registers topics through the indices path while
 * `bootstrap-demo-mint.sh` allows the demo signing key through the ids path, and
 * a one-state drift between them means the demo mint signs claims for a topic
 * the issuer was never allowed to sign.
 *
 * NOTE the shapes this records, because they differ from the indices walk: an
 * indices walk reads `.selected` on EVERY topic; this additionally reads `.id`
 * on the SELECTED ones. A caller that needs both walks records both, and its
 * attribution carries a `claimTopics[i].id` segment as a result.
 */
export function selectedClaimTopicIds(config: RWAConfig): readonly number[] {
  const { claimTopics } = config.identityVerification;
  const ids: number[] = [];

  for (const index of selectedClaimTopicIndices(config)) {
    const topic = claimTopics[index];
    if (topic !== undefined) ids.push(topic.id);
  }

  return ids;
}
