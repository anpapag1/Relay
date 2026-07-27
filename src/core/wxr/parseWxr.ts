import type {
  ParseError,
  ParseResult,
  ParsedArticle,
  ParsedAttachment,
  PostMeta,
  TaxonomyTermSummary,
  TermRef,
} from '../../types/domain';
import { childText, childrenByTag } from './xml';

function parsePostmeta(item: Element): PostMeta {
  const meta: PostMeta = {};
  for (const node of childrenByTag(item, 'wp:postmeta')) {
    const key = childText(node, 'wp:meta_key');
    const value = childText(node, 'wp:meta_value');
    if (key) meta[key] = value ?? '';
  }
  return meta;
}

function parseTerms(item: Element): TermRef[] {
  return childrenByTag(item, 'category').map((node) => ({
    domain: node.getAttribute('domain') ?? '',
    nicename: node.getAttribute('nicename') ?? '',
    name: node.textContent ?? '',
  }));
}

function parseArticleItem(item: Element, postType: 'post' | 'page'): ParsedArticle {
  const postId = childText(item, 'wp:post_id');
  const postDate = childText(item, 'wp:post_date');
  return {
    postId: postId ? Number(postId) : null,
    postType,
    status: childText(item, 'wp:status') ?? 'draft',
    title: childText(item, 'title') ?? '',
    link: childText(item, 'link') ?? '',
    postDate: postDate ?? '',
    postName: childText(item, 'wp:post_name') ?? '',
    creator: childText(item, 'dc:creator') ?? '',
    contentHtml: childText(item, 'content:encoded') ?? '',
    excerptHtml: childText(item, 'excerpt:encoded') ?? '',
    terms: parseTerms(item),
    postmeta: parsePostmeta(item),
  };
}

function parseAttachmentItem(item: Element): ParsedAttachment {
  const postId = childText(item, 'wp:post_id');
  const postParent = childText(item, 'wp:post_parent');
  return {
    postId: postId ? Number(postId) : null,
    title: childText(item, 'title') ?? '',
    attachmentUrl: childText(item, 'wp:attachment_url') ?? '',
    postParent: postParent ? Number(postParent) : null,
  };
}

/** Parses a WXR export into a structured result. Never throws: malformed
 * XML or a document missing the WXR shape comes back as a typed
 * ParseError instead, so the dropzone can render it directly. */
export function parseWxr(xmlText: string): ParseResult | ParseError {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Failed to parse XML.' };
  }

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    return { ok: false, message: parserError.textContent?.trim() || 'Invalid XML.' };
  }

  const channel = doc.querySelector('channel');
  if (!channel) {
    return { ok: false, message: 'This file does not look like a WordPress export (no <channel> found).' };
  }

  const items = childrenByTag(channel, 'item');
  const articles: ParsedArticle[] = [];
  const attachments: ParsedAttachment[] = [];

  for (const item of items) {
    const postType = childText(item, 'wp:post_type');
    if (postType === 'post' || postType === 'page') {
      articles.push(parseArticleItem(item, postType));
    } else if (postType === 'attachment') {
      attachments.push(parseAttachmentItem(item));
    }
  }

  const taxonomyMaps = new Map<string, Map<string, TaxonomyTermSummary>>();
  for (const article of articles) {
    for (const term of article.terms) {
      if (!term.domain) continue;
      let byNicename = taxonomyMaps.get(term.domain);
      if (!byNicename) {
        byNicename = new Map();
        taxonomyMaps.set(term.domain, byNicename);
      }
      const existing = byNicename.get(term.nicename);
      if (existing) {
        existing.count += 1;
      } else {
        byNicename.set(term.nicename, { nicename: term.nicename, name: term.name, count: 1 });
      }
    }
  }
  const taxonomies: Record<string, TaxonomyTermSummary[]> = {};
  for (const [domain, byNicename] of taxonomyMaps) {
    taxonomies[domain] = Array.from(byNicename.values());
  }

  const authorSet = new Set<string>();
  const statusCounts: Record<string, number> = {};
  for (const article of articles) {
    if (article.creator) authorSet.add(article.creator);
    statusCounts[article.status] = (statusCounts[article.status] ?? 0) + 1;
  }

  return {
    ok: true,
    siteUrl: childText(channel, 'wp:base_site_url'),
    totalItems: items.length,
    articles,
    attachments,
    taxonomies,
    authors: Array.from(authorSet),
    statusCounts,
  };
}
