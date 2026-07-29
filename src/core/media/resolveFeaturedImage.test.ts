import { describe, expect, it } from 'vitest';
import { resolveFeaturedImage } from './resolveFeaturedImage';
import { buildAttachmentIndex } from './attachmentIndex';
import type { FetchLike } from './mediaClient';
import type { ParsedAttachment, PostMeta } from '../../types/domain';

const ATTACHMENTS: ParsedAttachment[] = [
  { postId: 42, title: 'Featured', attachmentUrl: 'https://old.example/wp-content/uploads/featured.jpg', postParent: 1 },
];

function okFetch(body: unknown): FetchLike {
  return async () => ({ ok: true, status: 200, json: async () => body });
}

const NEVER_FETCH: FetchLike = async () => {
  throw new Error('should not be called');
};

describe('resolveFeaturedImage', () => {
  it('returns null when the old post has no _thumbnail_id at all', async () => {
    const index = buildAttachmentIndex([]);
    const result = await resolveFeaturedImage({}, index, 'https://old.example/post/', NEVER_FETCH);
    expect(result).toBeNull();
  });

  it('matched-export: resolves the thumbnail id against the export attachment index without any fetch', async () => {
    const index = buildAttachmentIndex(ATTACHMENTS);
    const postmeta: PostMeta = { _thumbnail_id: '42' };
    const result = await resolveFeaturedImage(postmeta, index, 'https://old.example/post/', NEVER_FETCH);
    expect(result).toEqual({ outcome: 'matched-export', url: 'https://old.example/wp-content/uploads/featured.jpg' });
  });

  it('matched-live: falls through to a live fetch and uses og:image when the attachment is not in the export', async () => {
    const index = buildAttachmentIndex([]);
    const postmeta: PostMeta = { _thumbnail_id: '99' };
    const fetchImpl = okFetch({ ogImage: 'https://old.example/og.jpg', images: ['https://old.example/inline.jpg'], files: [] });
    const result = await resolveFeaturedImage(postmeta, index, 'https://old.example/post/', fetchImpl);
    expect(result).toEqual({ outcome: 'matched-live', url: 'https://old.example/og.jpg' });
  });

  it('unresolved: live fetch succeeds but the page has no og:image', async () => {
    const index = buildAttachmentIndex([]);
    const postmeta: PostMeta = { _thumbnail_id: '99' };
    const fetchImpl = okFetch({ ogImage: null, images: ['https://old.example/inline.jpg'], files: [] });
    const result = await resolveFeaturedImage(postmeta, index, 'https://old.example/post/', fetchImpl);
    expect(result?.outcome).toBe('unresolved');
  });

  it('unresolved: no export match and no article URL to scrape', async () => {
    const index = buildAttachmentIndex([]);
    const postmeta: PostMeta = { _thumbnail_id: '99' };
    const result = await resolveFeaturedImage(postmeta, index, null, NEVER_FETCH);
    expect(result?.outcome).toBe('unresolved');
  });

  it('unreachable: the proxy fetch fails', async () => {
    const index = buildAttachmentIndex([]);
    const postmeta: PostMeta = { _thumbnail_id: '99' };
    const fetchImpl: FetchLike = async () => ({ ok: false, status: 502, json: async () => ({}) });
    const result = await resolveFeaturedImage(postmeta, index, 'https://old.example/post/', fetchImpl);
    expect(result?.outcome).toBe('unreachable');
  });

  it('does not fall back to an inline page image match — only og:image counts', async () => {
    // The one inline image on the page happens to have the same filename
    // the export attachment would have used, but since the export never
    // included it, stage 2 must only ever consider og:image.
    const index = buildAttachmentIndex([]);
    const postmeta: PostMeta = { _thumbnail_id: '99' };
    const fetchImpl = okFetch({ ogImage: null, images: ['https://old.example/wp-content/uploads/featured.jpg'], files: [] });
    const result = await resolveFeaturedImage(postmeta, index, 'https://old.example/post/', fetchImpl);
    expect(result?.outcome).toBe('unresolved');
  });
});
