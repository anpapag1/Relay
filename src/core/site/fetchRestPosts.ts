import type { TextFetchLike } from './types';

export interface RestPost {
  id: number;
  date: string;
  slug: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  featured_media: number;
  status: string;
}

export interface FetchPostsProgress {
  fetched: number;
  totalPages: number | null;
  currentPage: number;
}

export interface FetchPostsResult {
  posts: RestPost[];
  truncated: boolean;
}

const PER_PAGE = 100;
const ANONYMOUS_PAGE_CAP = 100;

export async function fetchRestPosts(
  apiBase: string,
  fetchImpl: TextFetchLike,
  onProgress?: (p: FetchPostsProgress) => void,
): Promise<FetchPostsResult> {
  const posts: RestPost[] = [];
  let truncated = false;

  for (let page = 1; page <= ANONYMOUS_PAGE_CAP + 1; page += 1) {
    const url = `${apiBase}/posts?per_page=${PER_PAGE}&page=${page}&_fields=id,date,slug,link,title,content,featured_media,status`;
    const res = await fetchImpl(url);
    if (!res.ok) return { posts, truncated: true };
    const batch = JSON.parse(await res.text()) as RestPost[];
    if (batch.length === 0) break;
    posts.push(...batch);

    const totalPagesHeader = res.headers.get('X-WP-TotalPages');
    const knownTotalPages = totalPagesHeader ? Number(totalPagesHeader) : null;

    onProgress?.({
      fetched: posts.length,
      totalPages: knownTotalPages,
      currentPage: page,
    });

    if (page === ANONYMOUS_PAGE_CAP) {
      // Headerless responses can't prove truncation; a known total beyond the cap can.
      truncated = knownTotalPages === null ? batch.length > 0 : knownTotalPages > ANONYMOUS_PAGE_CAP;
      break;
    }
    if (knownTotalPages !== null && knownTotalPages <= page) break;
  }

  return { posts, truncated };
}