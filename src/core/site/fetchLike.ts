import type { TextFetchLike } from './types';

/** The browser's own fetch, shaped to the site-fetch seam. A native
 * Response satisfies TextResponse structurally, so no adapter work. Old
 * sites can't be fetched cross-origin from the browser (CORS), so every
 * request goes through the same-origin SSRF-guarded /api/fetch proxy —
 * the same pattern mediaClient.ts uses with /api/page-media. */
export const browserTextFetch: TextFetchLike = (input) =>
  window.fetch(`/api/fetch?url=${encodeURIComponent(input)}`);
