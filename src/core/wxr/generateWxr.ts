import type { ExportArticle, GenerateWxrOptions } from '../../types/domain';
import { filenameOf } from '../media/attachmentIndex';
import { cdata, cdataSafe, escapeXml, slugFromLink, slugify } from './xml';

/** Synthetic attachment ids start well above any real wp:post_id a WXR
 * export would plausibly contain, so they can never collide with one. */
const SYNTHETIC_ATTACHMENT_ID_BASE = 900_000_000;

interface AttachmentRegistryEntry {
  id: number;
  filename: string;
}

/** Dedupes every media URL — featured images and inline content images/
 * galleries alike — by URL across the whole export: one synthetic
 * attachment per unique image, not one per article or per reference, so
 * sites where many posts share an image (a series, a default
 * social-share image, etc.) don't balloon the export with duplicates.
 * Inline media needs its own attachment item for the same reason a
 * featured image does — Relay never carries the source WXR's own
 * `<wp:attachment>` items over verbatim, so without one here an inline
 * image would just be a hotlink to the old site rather than a real
 * new-site media-library item. */
function buildAttachmentRegistry(articles: ExportArticle[]): Map<string, AttachmentRegistryEntry> {
  const registry = new Map<string, AttachmentRegistryEntry>();
  let nextId = SYNTHETIC_ATTACHMENT_ID_BASE;

  const register = (url: string | null | undefined) => {
    if (!url || registry.has(url)) return;
    registry.set(url, { id: nextId, filename: filenameOf(url) });
    nextId += 1;
  };

  for (const article of articles) {
    register(article.featuredAttachmentUrl);
    for (const url of article.mediaAttachmentUrls ?? []) register(url);
  }

  return registry;
}

function buildAttachmentItem(url: string, entry: AttachmentRegistryEntry, { authorLogin, postDate }: { authorLogin: string; postDate: string }): string {
  const pubDate = postDate ? new Date(postDate).toUTCString() : new Date().toUTCString();

  return `
	<item>
		${cdata('title', entry.filename)}
		<link>${escapeXml(url)}</link>
		<pubDate>${pubDate}</pubDate>
		${cdata('dc:creator', authorLogin)}
		<guid isPermaLink="false">${escapeXml(url)}</guid>
		<description></description>
		<content:encoded><![CDATA[]]></content:encoded>
		<excerpt:encoded><![CDATA[]]></excerpt:encoded>
		<wp:post_id>${entry.id}</wp:post_id>
		${cdata('wp:post_date', postDate)}
		${cdata('wp:post_date_gmt', postDate)}
		${cdata('wp:comment_status', 'closed')}
		${cdata('wp:ping_status', 'closed')}
		${cdata('wp:post_name', slugify(entry.filename))}
		${cdata('wp:status', 'inherit')}
		<wp:post_parent>0</wp:post_parent>
		<wp:menu_order>0</wp:menu_order>
		${cdata('wp:post_type', 'attachment')}
		${cdata('wp:post_password', '')}
		<wp:is_sticky>0</wp:is_sticky>
		${cdata('wp:attachment_url', url)}
	</item>`;
}

function buildAuthorItems(articles: ExportArticle[]): string {
  const logins = new Map<string, number>();
  for (const article of articles) {
    if (article.authorLogin && !logins.has(article.authorLogin)) {
      logins.set(article.authorLogin, logins.size + 1);
    }
  }
  return Array.from(logins.entries())
    .map(
      ([login, id]) => `
	<wp:author>
		<wp:author_id>${id}</wp:author_id>
		${cdata('wp:author_login', login)}
		${cdata('wp:author_email', '')}
		${cdata('wp:author_display_name', login)}
		${cdata('wp:author_first_name', '')}
		${cdata('wp:author_last_name', '')}
	</wp:author>`,
    )
    .join('');
}

function buildTermXml(article: ExportArticle): string {
  return article.terms
    .map(
      (term) =>
        `\n\t\t<category domain="${escapeXml(term.domain)}" nicename="${escapeXml(term.nicename)}"><![CDATA[${cdataSafe(term.name)}]]></category>`,
    )
    .join('');
}

function buildPostmetaXml(article: ExportArticle, registry: Map<string, AttachmentRegistryEntry>): string {
  const entry = article.featuredAttachmentUrl ? registry.get(article.featuredAttachmentUrl) : undefined;
  if (!entry) return '';

  return `
		<wp:postmeta>
			${cdata('wp:meta_key', '_thumbnail_id')}
			${cdata('wp:meta_value', String(entry.id))}
		</wp:postmeta>`;
}

function buildArticleItem(article: ExportArticle, registry: Map<string, AttachmentRegistryEntry>): string {
  const postName = article.postName || slugFromLink(article.link) || slugify(article.title);
  const pubDate = article.postDate ? new Date(article.postDate).toUTCString() : new Date().toUTCString();

  return `
	<item>
		${cdata('title', article.title)}
		<link>${escapeXml(article.link)}</link>
		<pubDate>${pubDate}</pubDate>
		${cdata('dc:creator', article.authorLogin)}
		<guid isPermaLink="false">${escapeXml(article.link)}</guid>
		<description></description>
		<content:encoded><![CDATA[${cdataSafe(article.contentHtml)}]]></content:encoded>
		<excerpt:encoded><![CDATA[]]></excerpt:encoded>
		<wp:post_id>${article.postId}</wp:post_id>
		${cdata('wp:post_date', article.postDate)}
		${cdata('wp:post_date_gmt', article.postDate)}
		${cdata('wp:comment_status', 'open')}
		${cdata('wp:ping_status', 'closed')}
		${cdata('wp:post_name', postName)}
		${cdata('wp:status', article.postStatus)}
		<wp:post_parent>0</wp:post_parent>
		<wp:menu_order>0</wp:menu_order>
		${cdata('wp:post_type', 'post')}
		${cdata('wp:post_password', '')}
		<wp:is_sticky>0</wp:is_sticky>${buildTermXml(article)}${buildPostmetaXml(article, registry)}
	</item>`;
}

/** Emits a WXR (WordPress eXtended RSS) export: channel header, taxonomy
 * terms as per-item <category domain> elements, one <item> per article
 * with CDATA-wrapped content, and one synthetic attachment <item> per
 * unique media URL — featured image or inline content image/gallery
 * item alike (deduped across the whole export, not one per article) —
 * so the WordPress importer actually downloads each one into the new
 * site's media library instead of leaving a hotlink to the old site, and
 * each owning article's `_thumbnail_id` postmeta resolves to a real post
 * on import. String-templated rather than built with a generic XML
 * serializer so CDATA payloads containing arbitrary article text stay
 * under direct control (see cdataSafe). */
export function generateWxr(articles: ExportArticle[], options: GenerateWxrOptions): string {
  const language = options.language ?? 'en-US';
  const authorItems = buildAuthorItems(articles);
  const registry = buildAttachmentRegistry(articles);
  const articleItems = articles.map((article) => buildArticleItem(article, registry));
  const attachmentItems = Array.from(registry.entries()).map(([url, entry]) => {
    const owner = articles.find((a) => a.featuredAttachmentUrl === url || (a.mediaAttachmentUrls ?? []).includes(url));
    return buildAttachmentItem(url, entry, { authorLogin: owner?.authorLogin ?? 'admin', postDate: owner?.postDate ?? '' });
  });

  return `<?xml version="1.0" encoding="UTF-8" ?>
<!-- Generated by Relay -->
<rss version="2.0"
	xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
	xmlns:content="http://purl.org/rss/1.0/modules/content/"
	xmlns:wfw="http://wellformedweb.org/CommentAPI/"
	xmlns:dc="http://purl.org/dc/elements/1.1/"
	xmlns:wp="http://wordpress.org/export/1.2/"
>
<channel>
	<title>${escapeXml(options.siteTitle)}</title>
	<link>${escapeXml(options.siteUrl)}</link>
	<description></description>
	<pubDate>${new Date().toUTCString()}</pubDate>
	<language>${language}</language>
	<wp:wxr_version>1.2</wp:wxr_version>
	<wp:base_site_url>${escapeXml(options.siteUrl)}</wp:base_site_url>
	<wp:base_blog_url>${escapeXml(options.siteUrl)}</wp:base_blog_url>
${authorItems}
${articleItems.join('\n')}
${attachmentItems.join('\n')}
</channel>
</rss>
`;
}
