import { builderReaders } from './index';
import type { BuilderId, DetectInput } from './types';

export interface DetectBuilderResult {
  builderId: BuilderId;
  score: number;
}

/** Runs every registered reader's detect() across all posts and returns
 * the highest-average-confidence builder — this average, not a
 * hard-coded number, is what the Import tab's "% match" header shows. */
export function detectBuilder(posts: DetectInput[]): DetectBuilderResult {
  if (posts.length === 0) {
    return { builderId: 'plainHtml', score: 0 };
  }

  let best: DetectBuilderResult = { builderId: 'plainHtml', score: -1 };

  for (const [id, reader] of Object.entries(builderReaders) as [BuilderId, (typeof builderReaders)[BuilderId]][]) {
    const total = posts.reduce((sum, post) => sum + reader.detect(post), 0);
    const average = total / posts.length;
    if (average > best.score) {
      best = { builderId: id, score: average };
    }
  }

  return best;
}
