import type { TextFetchLike } from './types';

export type ProbeResult =
  | { ok: true; source: 'rest'; apiBase: string }
  | { ok: true; source: 'rss'; feedUrl: string }
  | { ok: false; reason: string };

export function normalizeBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

function isJsonArray(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('[') && trimmed.endsWith(']');
}

async function tryRest(fetchImpl: TextFetchLike, url: string): Promise<boolean> {
  try {
    const res = await fetchImpl(url);
    return res.ok && isJsonArray(await res.text());
  } catch {
    return false;
  }
}

export async function probeSite(baseUrl: string, fetchImpl: TextFetchLike): Promise<ProbeResult> {
  const base = normalizeBaseUrl(baseUrl);

  const pretty = `${base}/wp-json/wp/v2/posts?per_page=1&_fields=id`;
  if (await tryRest(fetchImpl, pretty)) {
    return { ok: true, source: 'rest', apiBase: `${base}/wp-json/wp/v2` };
  }

  const queryStyle = `${base}/index.php?rest_route=/wp/v2/posts&per_page=1&_fields=id`;
  if (await tryRest(fetchImpl, queryStyle)) {
    return { ok: true, source: 'rest', apiBase: `${base}/index.php?rest_route=/wp/v2` };
  }

  const feeds = [`${base}/feed/`, `${base}/feed`, `${base}/?feed=rss2`];
  for (const feedUrl of feeds) {
    try {
      const res = await fetchImpl(feedUrl);
      if (res.ok) {
        const text = await res.text();
        if (/<rss/i.test(text)) return { ok: true, source: 'rss', feedUrl };
      }
    } catch {
      // keep probing
    }
  }

  return { ok: false, reason: "Couldn't find a WordPress REST API or RSS feed at that address." };
}
