import { describe, expect, it, vi } from 'vitest';
import { resolveFeaturedImage } from './resolveFeaturedImage';
import type { ParsedAttachment } from '../../types/domain';
import type { FetchLike } from './mediaClient';

const attachments: ParsedAttachment[] = [
  { postId: 77, title: 'Hero', attachmentUrl: 'https://old.example/wp-content/uploads/hero.jpg', postParent: 301 },
];

function fetchImplReturning(ogImage: string | null): FetchLike {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ogImage, images: [], files: [] }),
  }));
}

describe('resolveFeaturedImage', () => {
  it('resolves from the export attachment index when a matching attachment exists', async () => {
    const url = await resolveFeaturedImage(
      { postmeta: { _thumbnail_id: '77' }, link: 'https://old.example/featured/' },
      attachments,
      { liveFetchEnabled: false, fetchImpl: fetchImplReturning(null) },
    );
    expect(url).toBe('https://old.example/wp-content/uploads/hero.jpg');
  });

  it('returns null, never a fabricated URL, when there is no thumbnail set', async () => {
    const url = await resolveFeaturedImage(
      { postmeta: {}, link: 'https://old.example/featured/' },
      attachments,
      { liveFetchEnabled: true, fetchImpl: fetchImplReturning('https://old.example/og.jpg') },
    );
    expect(url).toBeNull();
  });

  it('falls back to a live og:image scrape when the export has no matching attachment', async () => {
    const url = await resolveFeaturedImage(
      { postmeta: { _thumbnail_id: '999' }, link: 'https://old.example/featured/' },
      attachments,
      { liveFetchEnabled: true, fetchImpl: fetchImplReturning('https://old.example/og.jpg') },
    );
    expect(url).toBe('https://old.example/og.jpg');
  });

  it('does not live-fetch when liveFetchEnabled is false', async () => {
    const fetchImpl = fetchImplReturning('https://old.example/og.jpg');
    const url = await resolveFeaturedImage(
      { postmeta: { _thumbnail_id: '999' }, link: 'https://old.example/featured/' },
      attachments,
      { liveFetchEnabled: false, fetchImpl },
    );
    expect(url).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns null when the live fetch has no og:image, rather than fabricating one', async () => {
    const url = await resolveFeaturedImage(
      { postmeta: { _thumbnail_id: '999' }, link: 'https://old.example/featured/' },
      attachments,
      { liveFetchEnabled: true, fetchImpl: fetchImplReturning(null) },
    );
    expect(url).toBeNull();
  });
});
