import { builderReaders } from './index';
import type { BuilderId, DetectInput } from './types';

export interface DetectBuilderResult {
  builderId: BuilderId;
  score: number;
}

/** A post-level score at or above this is treated as an unambiguous match
 * for that builder — e.g. wpbakery's detect() only returns this high when
 * it finds actual [vc_row]/[vc_column] shortcodes, not a maybe. */
const CONFIDENT_MATCH_THRESHOLD = 0.5;

/** Runs every registered reader's detect() across all posts and returns
 * the builder confidently matched on the most posts — not simply the
 * highest *average* score. plainHtml is a pure fallback: its detect()
 * scores every non-empty post 0.2 flat, specifically so it never wins
 * against a real builder-specific signal on any single post. But a
 * flat/uniform per-post score dominates a plain average once the real
 * builder's shortcodes only appear in a minority of posts (a site with
 * some WPBakery articles and some already-Gutenberg-native ones, say) —
 * counting confident per-post matches instead means the dominant builder
 * still wins even if it's only used by a fraction of the export, as long
 * as nothing else has a stronger claim on more posts. The average score
 * is still what the Import tab's "% match" header shows. */
export function detectBuilder(posts: DetectInput[]): DetectBuilderResult {
  if (posts.length === 0) {
    return { builderId: 'plainHtml', score: 0 };
  }

  let best: DetectBuilderResult = { builderId: 'plainHtml', score: -1 };
  let bestConfidentCount = -1;

  for (const [id, reader] of Object.entries(builderReaders) as [BuilderId, (typeof builderReaders)[BuilderId]][]) {
    const scores = posts.map((post) => reader.detect(post));
    const confidentCount = scores.filter((score) => score >= CONFIDENT_MATCH_THRESHOLD).length;
    const average = scores.reduce((sum, score) => sum + score, 0) / posts.length;

    if (confidentCount > bestConfidentCount || (confidentCount === bestConfidentCount && average > best.score)) {
      bestConfidentCount = confidentCount;
      best = { builderId: id, score: average };
    }
  }

  return best;
}
