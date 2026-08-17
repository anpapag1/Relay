import { describe, it, expect, vi, beforeEach } from 'vitest';
import { browserTextFetch } from './fetchLike';

describe('browserTextFetch', () => {
  const fetchStub = vi.fn<typeof window.fetch>();

  beforeEach(() => {
    fetchStub.mockReset();
    window.fetch = fetchStub;
  });

  it('routes the URL through the /api/fetch proxy, URL-encoded', async () => {
    fetchStub.mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => '[]',
    } as unknown as Response);

    await browserTextFetch('https://old-site.example/feed/?x=1&y=2');

    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(fetchStub).toHaveBeenCalledWith(
      '/api/fetch?url=' + encodeURIComponent('https://old-site.example/feed/?x=1&y=2'),
    );
  });
});