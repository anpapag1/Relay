import type { TextFetchLike } from './types';

export interface RestMediaItem {
  id: number;
  source_url: string;
}

const CHUNK_SIZE = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function fetchFeaturedImageUrls(
  apiBase: string,
  mediaIds: number[],
  fetchImpl: TextFetchLike,
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  const uniqueIds = Array.from(new Set(mediaIds));
  for (const ids of chunk(uniqueIds, CHUNK_SIZE)) {
    // per_page must be raised above WordPress's default 10, otherwise an
    // include= batch larger than 10 IDs is silently truncated by the server.
    const url = `${apiBase}/media?per_page=${CHUNK_SIZE}&include=${ids.join(',')}&_fields=id,source_url`;
    const res = await fetchImpl(url);
    if (!res.ok) continue;
    const items = JSON.parse(await res.text()) as RestMediaItem[];
    for (const item of items) result.set(item.id, item.source_url);
  }
  return result;
}