import type { TextFetchLike } from './types';

export interface RestMediaItem {
  id: number;
  source_url: string;
}

const CHUNK_SIZE = 10;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function fetchFeaturedImageUrls(
  apiBase: string,
  mediaIds: number[],
  fetchImpl: TextFetchLike,
  onProgress?: (resolved: number) => void,
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  const uniqueIds = Array.from(new Set(mediaIds));
  for (const ids of chunk(uniqueIds, CHUNK_SIZE)) {
    // per_page stays at WordPress's default 10 so a batch include of at most
    // 10 ids is never silently truncated by the server.
    const url = `${apiBase}/media?per_page=${CHUNK_SIZE}&include=${ids.join(',')}&_fields=id,source_url`;
    const res = await fetchImpl(url);
    if (res.ok) {
      const items = JSON.parse(await res.text()) as RestMediaItem[];
      for (const item of items) result.set(item.id, item.source_url);
    }
    onProgress?.(result.size);
  }
  return result;
}