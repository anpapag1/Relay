import type { TextFetchLike } from './types';

/** The browser's own fetch, shaped to the site-fetch seam. A native
 * Response satisfies TextResponse structurally, so no adapter work. */
export const browserTextFetch: TextFetchLike = (input) => window.fetch(input);
