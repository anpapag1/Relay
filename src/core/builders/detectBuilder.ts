import { builderReaders } from './index';
import type { BuilderId, DetectInput } from './types';

export interface DetectBuilderResult {
  builderId: BuilderId;
  score: number;
}

export interface BuilderScore {
  builderId: BuilderId;
  /** Average detect() score across all posts (0..1). Diluted on any site
   * where the builder is only used on a fraction of posts — prefer
   * confidentCount/totalPosts for a user-facing "how sure are we" figure. */
  score: number;
  /** Count of posts scoring at or above CONFIDENT_MATCH_THRESHOLD. */
  confidentCount: number;
  totalPosts: number;
}

/** A post-level score at or above this is treated as an unambiguous match
 * for that builder — e.g. wpbakery's detect() only returns this high when
 * it finds actual [vc_row]/[vc_column] shortcodes, not a maybe. */
const CONFIDENT_MATCH_THRESHOLD = 0.5;

/** Runs every registered reader's detect() across all posts and ranks them
 * by the builder confidently matched on the most posts — not simply the
 * highest *average* score. plainHtml is a pure fallback: its detect()
 * scores every non-empty post 0.2 flat, specifically so it never wins
 * against a real builder-specific signal on any single post. But a
 * flat/uniform per-post score dominates a plain average once the real
 * builder's shortcodes only appear in a minority of posts (a site with
 * some WPBakery articles and some already-Gutenberg-native ones, say) —
 * counting confident per-post matches instead means the dominant builder
 * still wins even if it's only used by a fraction of the export, as long
 * as nothing else has a stronger claim on more posts. The average score
 * is still what the Import tab's "% match" figures show. */
export function rankBuilders(posts: DetectInput[]): BuilderScore[] {
  const entries = Object.entries(builderReaders) as [BuilderId, (typeof builderReaders)[BuilderId]][];

  if (posts.length === 0) {
    return entries.map(([id]) => ({ builderId: id, score: 0, confidentCount: 0, totalPosts: 0 }));
  }

  const scored = entries.map(([id, reader]) => {
    const scores = posts.map((post) => reader.detect(post));
    const confidentCount = scores.filter((score) => score >= CONFIDENT_MATCH_THRESHOLD).length;
    const average = scores.reduce((sum, score) => sum + score, 0) / posts.length;
    return { builderId: id, score: average, confidentCount, totalPosts: posts.length };
  });

  return scored.sort((a, b) => b.confidentCount - a.confidentCount || b.score - a.score);
}

export function detectBuilder(posts: DetectInput[]): DetectBuilderResult {
  const [best] = rankBuilders(posts);
  return { builderId: best.builderId, score: best.score };
}
