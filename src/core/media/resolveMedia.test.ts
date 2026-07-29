import { describe, expect, it } from 'vitest';
import { resolveMediaRefs } from './resolveMedia';
import type { FetchLike } from './mediaClient';
import type { ParsedAttachment } from '../../types/domain';

const ATTACHMENTS: ParsedAttachment[] = [
  { postId: 10, title: 'Photo', attachmentUrl: 'https://old.example/wp-content/uploads/photo.jpg', postParent: 1 },
];

function okFetch(body: unknown): FetchLike {
  return async () => ({ ok: true, status: 200, json: async () => body });
}

describe('resolveMediaRefs', () => {
  it('matched-export: resolves a ref already in the attachment index without any fetch', async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error('should not be called');
    };
    const result = await resolveMediaRefs(['https://old.example/wp-content/uploads/photo.jpg'], {
      attachments: ATTACHMENTS,
      articleUrl: 'https://old.example/post/',
      fetchImpl,
    });
    expect(result['https://old.example/wp-content/uploads/photo.jpg']).toEqual({
      outcome: 'matched-export',
      url: 'https://old.example/wp-content/uploads/photo.jpg',
    });
  });

  it('matched-live: falls through to a live fetch and matches by filename', async () => {
    const fetchImpl = okFetch({ ogImage: null, images: ['https://old.example/uploads/missing.jpg'], files: [] });
    const result = await resolveMediaRefs(['https://cdn.example/cache/missing.jpg'], {
      attachments: [],
      articleUrl: 'https://old.example/post/',
      fetchImpl,
    });
    expect(result['https://cdn.example/cache/missing.jpg']).toEqual({
      outcome: 'matched-live',
      url: 'https://old.example/uploads/missing.jpg',
    });
  });

  it('unresolved: live fetch succeeds but finds no match', async () => {
    const fetchImpl = okFetch({ ogImage: null, images: [], files: [] });
    const result = await resolveMediaRefs(['https://old.example/uploads/gone.jpg'], {
      attachments: [],
      articleUrl: 'https://old.example/post/',
      fetchImpl,
    });
    expect(result['https://old.example/uploads/gone.jpg'].outcome).toBe('unresolved');
  });

  it('unresolved: no article URL to scrape, never calls fetchImpl', async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error('should not be called');
    };
    const result = await resolveMediaRefs(['https://old.example/uploads/gone.jpg'], {
      attachments: [],
      articleUrl: null,
      fetchImpl,
    });
    expect(result['https://old.example/uploads/gone.jpg'].outcome).toBe('unresolved');
  });

  it('unreachable: the proxy fetch fails', async () => {
    const fetchImpl: FetchLike = async () => ({ ok: false, status: 502, json: async () => ({}) });
    const result = await resolveMediaRefs(['https://old.example/uploads/gone.jpg'], {
      attachments: [],
      articleUrl: 'https://old.example/post/',
      fetchImpl,
    });
    expect(result['https://old.example/uploads/gone.jpg'].outcome).toBe('unreachable');
  });

  it('handles a zero-attachment-items export by falling straight through to live fetch', async () => {
    const fetchImpl = okFetch({ ogImage: 'https://old.example/og.jpg', images: [], files: [] });
    const result = await resolveMediaRefs(['https://old.example/og.jpg'], {
      attachments: [],
      articleUrl: 'https://old.example/post/',
      fetchImpl,
    });
    expect(result['https://old.example/og.jpg']).toEqual({ outcome: 'matched-live', url: 'https://old.example/og.jpg' });
  });

  it('leaves an attachment:<id> placeholder unresolved when the id is not in the export, even when a live fetch would succeed', async () => {
    const fetchImpl = okFetch({ ogImage: null, images: ['https://old.example/anything.jpg'], files: [] });
    const result = await resolveMediaRefs(['attachment:999'], {
      attachments: ATTACHMENTS,
      articleUrl: 'https://old.example/post/',
      fetchImpl,
    });
    expect(result['attachment:999'].outcome).toBe('unresolved');
  });

  it('dedupes repeated refs into a single resolution', async () => {
    const result = await resolveMediaRefs(
      ['https://old.example/wp-content/uploads/photo.jpg', 'https://old.example/wp-content/uploads/photo.jpg'],
      {
        attachments: ATTACHMENTS,
        articleUrl: 'https://old.example/post/',
        fetchImpl: async () => {
          throw new Error('should not be called');
        },
      },
    );
    expect(Object.keys(result)).toHaveLength(1);
  });
});
