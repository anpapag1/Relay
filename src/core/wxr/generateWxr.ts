import type { ExportArticle, GenerateWxrOptions } from '../../types/domain';
import { cdata, cdataSafe, escapeXml, slugFromLink, slugify } from './xml';

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

function buildPostmetaXml(thumbnailId: number | null): string {
  if (thumbnailId == null) return '';
  return `
		<wp:postmeta>
			${cdata('wp:meta_key', '_thumbnail_id')}
			${cdata('wp:meta_value', String(thumbnailId))}
		</wp:postmeta>`;
}

function buildArticleItem(article: ExportArticle, thumbnailId: number | null): string {
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
		${cdata('wp:comment_status', 'closed')}
		${cdata('wp:ping_status', 'closed')}
		${cdata('wp:post_name', postName)}
		${cdata('wp:status', 'publish')}
		<wp:post_parent>0</wp:post_parent>
		<wp:menu_order>0</wp:menu_order>
		${cdata('wp:post_type', 'post')}
		${cdata('wp:post_password', '')}
		<wp:is_sticky>0</wp:is_sticky>${buildTermXml(article)}${buildPostmetaXml(thumbnailId)}
	</item>`;
}

/** A featured image resolved from the live old site (or from an export
 * that never carried its own attachment items) has no real WordPress
 * attachment post behind it — so one is synthesized here, at an ID range
 * (SYNTHETIC_ATTACHMENT_ID_BASE and up) that never collides with a real
 * article's wp:post_id, since those come from the source site's own
 * (much smaller) ID sequence. */
const SYNTHETIC_ATTACHMENT_ID_BASE = 900_000_000;

function buildAttachmentItem(id: number, url: string, parentPostId: number, pubDate: string): string {
  const title = slugFromLink(url) || 'image';
  return `
	<item>
		${cdata('title', title)}
		<link>${escapeXml(url)}</link>
		<pubDate>${pubDate}</pubDate>
		${cdata('dc:creator', 'admin')}
		<guid isPermaLink="false">${escapeXml(url)}</guid>
		<description></description>
		<content:encoded><![CDATA[]]></content:encoded>
		<excerpt:encoded><![CDATA[]]></excerpt:encoded>
		<wp:post_id>${id}</wp:post_id>
		${cdata('wp:post_date', pubDate)}
		${cdata('wp:post_date_gmt', pubDate)}
		${cdata('wp:comment_status', 'closed')}
		${cdata('wp:ping_status', 'closed')}
		${cdata('wp:post_name', title)}
		${cdata('wp:status', 'inherit')}
		<wp:post_parent>${parentPostId}</wp:post_parent>
		<wp:menu_order>0</wp:menu_order>
		${cdata('wp:post_type', 'attachment')}
		${cdata('wp:post_password', '')}
		<wp:is_sticky>0</wp:is_sticky>
		${cdata('wp:attachment_url', url)}
	</item>`;
}

/** Emits a WXR (WordPress eXtended RSS) export: channel header, taxonomy
 * terms as per-item <category domain> elements, and one <item> per
 * article with CDATA-wrapped content. String-templated rather than built
 * with a generic XML serializer so CDATA payloads containing arbitrary
 * article text stay under direct control (see cdataSafe). */
export function generateWxr(articles: ExportArticle[], options: GenerateWxrOptions): string {
  const language = options.language ?? 'en-US';
  const authorItems = buildAuthorItems(articles);

  const attachmentItems: string[] = [];
  let nextAttachmentId = SYNTHETIC_ATTACHMENT_ID_BASE;
  const articleItems = articles.map((article) => {
    let thumbnailId: number | null = null;
    if (article.featuredAttachmentUrl) {
      thumbnailId = nextAttachmentId;
      nextAttachmentId += 1;
      const pubDate = article.postDate ? new Date(article.postDate).toUTCString() : new Date().toUTCString();
      attachmentItems.push(buildAttachmentItem(thumbnailId, article.featuredAttachmentUrl, article.postId, pubDate));
    }
    return buildArticleItem(article, thumbnailId);
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
