import { describe, expect, it } from 'vitest';
import { parseWxr } from './parseWxr';

const SAMPLE_WXR = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0"
	xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
	xmlns:content="http://purl.org/rss/1.0/modules/content/"
	xmlns:dc="http://purl.org/dc/elements/1.1/"
	xmlns:wp="http://wordpress.org/export/1.2/"
>
<channel>
	<title>Sample Site</title>
	<link>https://old-site.example</link>
	<wp:wxr_version>1.2</wp:wxr_version>
	<wp:base_site_url>https://old-site.example</wp:base_site_url>
	<item>
		<title><![CDATA[Hello World]]></title>
		<link>https://old-site.example/hello-world/</link>
		<dc:creator><![CDATA[admin]]></dc:creator>
		<content:encoded><![CDATA[<p>Hi there</p>]]></content:encoded>
		<excerpt:encoded><![CDATA[]]></excerpt:encoded>
		<wp:post_id>1</wp:post_id>
		<wp:post_date><![CDATA[2026-01-01 00:00:00]]></wp:post_date>
		<wp:post_date_gmt><![CDATA[2025-12-31 22:00:00]]></wp:post_date_gmt>
		<wp:post_name><![CDATA[hello-world]]></wp:post_name>
		<wp:status><![CDATA[publish]]></wp:status>
		<wp:post_type><![CDATA[post]]></wp:post_type>
		<category domain="category" nicename="news"><![CDATA[News]]></category>
		<category domain="post_tag" nicename="greeting"><![CDATA[Greeting]]></category>
		<wp:postmeta>
			<wp:meta_key><![CDATA[_thumbnail_id]]></wp:meta_key>
			<wp:meta_value><![CDATA[42]]></wp:meta_value>
		</wp:postmeta>
	</item>
	<item>
		<title><![CDATA[A Photo]]></title>
		<link>https://old-site.example/a-photo/</link>
		<wp:post_id>2</wp:post_id>
		<wp:post_type><![CDATA[attachment]]></wp:post_type>
		<wp:post_parent>1</wp:post_parent>
		<wp:attachment_url><![CDATA[https://old-site.example/wp-content/uploads/photo.jpg]]></wp:attachment_url>
	</item>
</channel>
</rss>
`;

describe('parseWxr', () => {
  it('parses articles, attachments, taxonomies, and stats', () => {
    const result = parseWxr(SAMPLE_WXR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.siteUrl).toBe('https://old-site.example');
    expect(result.totalItems).toBe(2);
    expect(result.articles).toHaveLength(1);
    expect(result.attachments).toHaveLength(1);

    const [article] = result.articles;
    expect(article.title).toBe('Hello World');
    expect(article.postType).toBe('post');
    expect(article.contentHtml).toBe('<p>Hi there</p>');
    expect(article.postDate).toBe('2026-01-01 00:00:00');
    expect(article.postDateGmt).toBe('2025-12-31 22:00:00');
    expect(article.postmeta._thumbnail_id).toBe('42');
    expect(article.terms).toEqual([
      { domain: 'category', nicename: 'news', name: 'News' },
      { domain: 'post_tag', nicename: 'greeting', name: 'Greeting' },
    ]);

    expect(result.taxonomies.category).toEqual([{ nicename: 'news', name: 'News', count: 1 }]);
    expect(result.taxonomies.post_tag).toEqual([{ nicename: 'greeting', name: 'Greeting', count: 1 }]);
    expect(result.authors).toEqual(['admin']);
    expect(result.statusCounts).toEqual({ publish: 1 });

    const [attachment] = result.attachments;
    expect(attachment.attachmentUrl).toBe('https://old-site.example/wp-content/uploads/photo.jpg');
    expect(attachment.postParent).toBe(1);
  });

  it('returns a typed ParseError for invalid XML', () => {
    const result = parseWxr('<rss><channel><item><title>unclosed</channel></rss>');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toBeTruthy();
  });

  it('returns a typed ParseError when there is no <channel>', () => {
    const result = parseWxr('<rss version="2.0"></rss>');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/channel/i);
  });

  it('counts a CDATA payload containing ]]> without breaking parsing', () => {
    const xml = SAMPLE_WXR.replace('<p>Hi there</p>', '<p>edge ]]&gt; case</p>');
    const result = parseWxr(xml);
    expect(result.ok).toBe(true);
  });

  it('decodes double-encoded HTML entities in CDATA titles', () => {
    const xml = SAMPLE_WXR.replace(
      '<title><![CDATA[Hello World]]></title>',
      '<title><![CDATA[Τουρνουά μπάσκετ 3&#215;3 από τον Δήμο Μυτιλήνης]]></title>',
    );
    const result = parseWxr(xml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.articles[0].title).toBe('Τουρνουά μπάσκετ 3×3 από τον Δήμο Μυτιλήνης');
  });
});
