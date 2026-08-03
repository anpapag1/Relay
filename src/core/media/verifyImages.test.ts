import { describe, it, expect, vi } from 'vitest';
import { verifyResolvedImages } from './verifyImages';
import type { FetchLike } from './mediaClient';
import type { MediaResolution } from '../../types/domain';

function stubFetch(handler: FetchLike): FetchLike {
  return handler;
}

describe('verifyResolvedImages', () => {
  it('sets verified:"ok" for a matched-export entry that checks out', async () => {
    const resolved: Record<string, MediaResolution> = {
      'attachment:1': { outcome: 'matched-export', url: 'https://old.example/photo.jpg' },
    };
    const fetchImpl = stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, status: 200 }) }));

    const updates = await verifyResolvedImages(resolved, [], fetchImpl);

    expect(updates).toEqual({
      'attachment:1': { outcome: 'matched-export', url: 'https://old.example/photo.jpg', verified: 'ok', verifiedReason: undefined },
    });
  });

  it('sets verified:"broken" with the reason for a matched-live entry that 404s', async () => {
    const resolved: Record<string, MediaResolution> = {
      'https://old.example/photo.jpg': { outcome: 'matched-live', url: 'https://old.example/photo.jpg' },
    };
    const fetchImpl = stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, status: 404, reason: 'the old site responded with status 404' }),
    }));

    const updates = await verifyResolvedImages(resolved, [], fetchImpl);

    expect(updates).toEqual({
      'https://old.example/photo.jpg': {
        outcome: 'matched-live',
        url: 'https://old.example/photo.jpg',
        verified: 'broken',
        verifiedReason: 'the old site responded with status 404',
      },
    });
  });

  it('omits the ref from updates when the check fails with no status (unconfirmed/transient failure)', async () => {
    const resolved: Record<string, MediaResolution> = {
      'attachment:1': { outcome: 'matched-export', url: 'https://old.example/photo.jpg' },
    };
    const fetchImpl = stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, reason: 'the old site did not respond in time' }),
    }));

    const updates = await verifyResolvedImages(resolved, [], fetchImpl);

    expect(updates).toEqual({});
  });

  it('dedupes two refs that share the same URL into a single check call', async () => {
    const resolved: Record<string, MediaResolution> = {
      'attachment:1': { outcome: 'matched-export', url: 'https://old.example/shared.jpg' },
      'https://old.example/shared.jpg': { outcome: 'matched-export', url: 'https://old.example/shared.jpg' },
    };
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, status: 200 }) }));

    const updates = await verifyResolvedImages(resolved, [], fetchImpl as unknown as FetchLike);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(Object.keys(updates)).toHaveLength(2);
    expect(updates['attachment:1'].verified).toBe('ok');
    expect(updates['https://old.example/shared.jpg'].verified).toBe('ok');
  });

  it('skips entries that are already verified', async () => {
    const resolved: Record<string, MediaResolution> = {
      'attachment:1': { outcome: 'matched-export', url: 'https://old.example/photo.jpg', verified: 'ok' },
    };
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, status: 200 }) }));

    const updates = await verifyResolvedImages(resolved, [], fetchImpl as unknown as FetchLike);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(updates).toEqual({});
  });

  it('skips unresolved/unreachable outcomes', async () => {
    const resolved: Record<string, MediaResolution> = {
      'attachment:1': { outcome: 'unresolved', reason: 'Not found' },
      'attachment:2': { outcome: 'unreachable', reason: 'The old site could not be reached.' },
    };
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, status: 200 }) }));

    const updates = await verifyResolvedImages(resolved, [], fetchImpl as unknown as FetchLike);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(updates).toEqual({});
  });

  it('returns an empty object when there is nothing to check', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, status: 200 }) }));
    const updates = await verifyResolvedImages({}, [], fetchImpl as unknown as FetchLike);
    expect(updates).toEqual({});
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('checks a bare absolute-URL ref that has no resolution entry at all, treating it as self-resolved', async () => {
    // The real-world case that motivated this: a raw <img src="https://..."> in
    // Gutenberg-native content whose URL never matched any <wp:attachment> item
    // in the WXR — Stage 1 never creates a `resolved` entry for it at all, so
    // it's neither "matched" nor "unresolved". `allRefs` (every ref the article
    // actually references, gathered independently of `resolved`) is how such
    // refs get onto the health-check's radar.
    const fetchImpl = stubFetch(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, status: 404, reason: 'the old site responded with status 404' }),
    }));

    const updates = await verifyResolvedImages({}, ['https://dad.gr/wp-content/uploads/photo.jpg'], fetchImpl);

    expect(updates).toEqual({
      'https://dad.gr/wp-content/uploads/photo.jpg': {
        outcome: 'matched-export',
        url: 'https://dad.gr/wp-content/uploads/photo.jpg',
        verified: 'broken',
        verifiedReason: 'the old site responded with status 404',
      },
    });
  });

  it('does not re-check a self-resolved ref that already has an (unrelated) resolution entry', async () => {
    const resolved: Record<string, MediaResolution> = {
      'https://old.example/already-unresolved.jpg': { outcome: 'unresolved', reason: 'Not found' },
    };
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, status: 200 }) }));

    const updates = await verifyResolvedImages(
      resolved,
      ['https://old.example/already-unresolved.jpg'],
      fetchImpl as unknown as FetchLike,
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(updates).toEqual({});
  });

  it('ignores non-absolute-URL refs (attachment: placeholders, relative paths) with no resolution entry', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, status: 200 }) }));

    const updates = await verifyResolvedImages({}, ['attachment:5', '/relative/path.jpg'], fetchImpl as unknown as FetchLike);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(updates).toEqual({});
  });

  it('dedupes a self-resolved ref that also appears twice in allRefs', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, status: 200 }) }));

    const updates = await verifyResolvedImages(
      {},
      ['https://old.example/dup.jpg', 'https://old.example/dup.jpg'],
      fetchImpl as unknown as FetchLike,
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(Object.keys(updates)).toEqual(['https://old.example/dup.jpg']);
  });
});
