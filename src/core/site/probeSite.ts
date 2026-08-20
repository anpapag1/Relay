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

interface ProbeFlags {
  transportError: boolean;
  serverError: number | null;
}

async function tryRest(fetchImpl: TextFetchLike, url: string, flags: ProbeFlags): Promise<boolean> {
  try {
    const res = await fetchImpl(url);
    if (res.status >= 500) {
      flags.serverError = flags.serverError ?? res.status;
      return false;
    }
    return res.ok && isJsonArray(await res.text());
  } catch {
    flags.transportError = true;
    return false;
  }
}

export async function probeSite(baseUrl: string, fetchImpl: TextFetchLike): Promise<ProbeResult> {
  const base = normalizeBaseUrl(baseUrl);
  const flags: ProbeFlags = { transportError: false, serverError: null };

  const pretty = `${base}/wp-json/wp/v2/posts?per_page=1&_fields=id`;
  if (await tryRest(fetchImpl, pretty, flags)) {
    return { ok: true, source: 'rest', apiBase: `${base}/wp-json/wp/v2` };
  }

  const queryStyle = `${base}/index.php?rest_route=/wp/v2/posts&per_page=1&_fields=id`;
  if (await tryRest(fetchImpl, queryStyle, flags)) {
    return { ok: true, source: 'rest', apiBase: `${base}/index.php?rest_route=/wp/v2` };
  }

  const feeds = [`${base}/feed/`, `${base}/feed`, `${base}/?feed=rss2`];
  for (const feedUrl of feeds) {
    try {
      const res = await fetchImpl(feedUrl);
      if (res.status >= 500) {
        flags.serverError = flags.serverError ?? res.status;
        continue;
      }
      if (res.ok) {
        const text = await res.text();
        if (/<rss/i.test(text)) return { ok: true, source: 'rss', feedUrl };
      }
    } catch {
      flags.transportError = true;
    }
  }

  if (flags.transportError) {
    return { ok: false, reason: "Couldn't reach the server. Check your internet connection and that Relay is running." };
  }
  if (flags.serverError != null) {
    return { ok: false, reason: `The old site returned a server error (HTTP ${flags.serverError}). Check that it's online and the URL is correct.` };
  }
  return { ok: false, reason: "Couldn't find a WordPress REST API or RSS feed at that address." };
}
