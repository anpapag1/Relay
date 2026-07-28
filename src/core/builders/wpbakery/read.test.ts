import { describe, expect, it } from 'vitest';
import { readWpbakery } from './read';

describe('readWpbakery', () => {
  it('converts vc_row/vc_column into a columns node, delegating vc_column_text to plainHtml', () => {
    const { nodes } = readWpbakery({
      contentHtml: '[vc_row][vc_column][vc_column_text]<p>Left</p>[/vc_column_text][/vc_column][vc_column][vc_column_text]<p>Right</p>[/vc_column_text][/vc_column][/vc_row]',
      postmeta: {},
    });
    expect(nodes).toEqual([
      {
        kind: 'columns',
        columns: [
          [{ kind: 'paragraph', html: 'Left' }],
          [{ kind: 'paragraph', html: 'Right' }],
        ],
      },
    ]);
  });

  it('reads vc_single_image as an attachment-id-referencing image', () => {
    const { nodes } = readWpbakery({ contentHtml: '[vc_single_image image="42" alt="A photo"]', postmeta: {} });
    expect(nodes).toEqual([{ kind: 'image', src: 'attachment:42', alt: 'A photo' }]);
  });

  it('reads vc_gallery images ids into gallery IR', () => {
    const { nodes } = readWpbakery({ contentHtml: '[vc_gallery images="1,2,3"]', postmeta: {} });
    expect(nodes).toEqual([
      {
        kind: 'gallery',
        images: [
          { src: 'attachment:1', alt: '' },
          { src: 'attachment:2', alt: '' },
          { src: 'attachment:3', alt: '' },
        ],
      },
    ]);
  });

  it('decodes the WPBakery link param format for vc_btn', () => {
    const { nodes } = readWpbakery({
      contentHtml: '[vc_btn title="Go" link="url:https%3A%2F%2Fexample.com|title:Go|target:_blank"]',
      postmeta: {},
    });
    expect(nodes).toEqual([{ kind: 'button', text: 'Go', href: 'https://example.com' }]);
  });

  it('reads vc_video with a youtube link as an IR video node', () => {
    const { nodes } = readWpbakery({ contentHtml: '[vc_video link="https://youtube.com/watch?v=1"]', postmeta: {} });
    expect(nodes).toEqual([{ kind: 'video', src: 'https://youtube.com/watch?v=1', provider: 'youtube' }]);
  });

  it('reads vc_separator and vc_empty_space', () => {
    const { nodes } = readWpbakery({ contentHtml: '[vc_separator][vc_empty_space height="40px"]', postmeta: {} });
    expect(nodes[0]).toEqual({ kind: 'separator' });
    expect(nodes[1]).toEqual({ kind: 'spacer', height: 40 });
  });

  it('keeps an unrecognised shortcode as raw with a warning', () => {
    const { nodes, warnings } = readWpbakery({ contentHtml: '[vc_testimonial name="X"]', postmeta: {} });
    expect(nodes[0].kind).toBe('raw');
    expect(warnings.some((w) => w.includes('vc_testimonial'))).toBe(true);
  });

  it('decodes vc_raw_html\'s base64+urlencoded payload into real HTML instead of a literal placeholder', () => {
    // Payload is base64("<div id=\"sidebar-at-visual\"></div>" urlencoded) — the exact
    // encoding WPBakery itself produces for this shortcode's body.
    const { nodes, warnings } = readWpbakery({
      contentHtml: '[vc_raw_html]JTNDZGl2JTIwaWQlM0QlMjJzaWRlYmFyLWF0LXZpc3VhbCUyMiUzRSUzQyUyRmRpdiUzRQ==[/vc_raw_html]',
      postmeta: {},
    });
    expect(nodes).toEqual([{ kind: 'raw', html: '<div id="sidebar-at-visual"></div>', note: 'vc_raw_html (decoded)' }]);
    expect(warnings).toEqual(['vc_raw_html decoded and kept as raw HTML.']);
  });

  it('drops an empty vc_raw_html and reports an undecodable payload rather than crashing', () => {
    const empty = readWpbakery({ contentHtml: '[vc_raw_html][/vc_raw_html]', postmeta: {} });
    expect(empty.nodes).toEqual([]);
    expect(empty.warnings).toEqual(['vc_raw_html with no content — dropped.']);

    const garbage = readWpbakery({ contentHtml: '[vc_raw_html]not-valid-base64!!![/vc_raw_html]', postmeta: {} });
    expect(garbage.nodes[0].kind).toBe('raw');
    expect(garbage.warnings.some((w) => w.includes('could not be decoded'))).toBe(true);
  });

  it('drops a bare vc_icon with a warning, and converts a linked one to a button', () => {
    const bare = readWpbakery({ contentHtml: '[vc_row][vc_column][vc_icon][/vc_column][/vc_row]', postmeta: {} });
    expect(bare.nodes).toEqual([{ kind: 'columns', columns: [[]] }]);
    expect(bare.warnings.some((w) => w.includes('vc_icon dropped'))).toBe(true);

    const linked = readWpbakery({
      contentHtml: '[vc_icon title="Go" link="url:https%3A%2F%2Fexample.com|title:Go|target:_blank"]',
      postmeta: {},
    });
    expect(linked.nodes).toEqual([{ kind: 'button', text: 'Go', href: 'https://example.com' }]);
  });

  it('reads a classic [caption] shortcode sitting at the top level (outside vc_column_text) as an image with a caption, instead of losing the image entirely', () => {
    // [caption] uses the same [tag]...[/tag] grammar the WPBakery tokenizer
    // parses everything with, so at the top level it arrives as just
    // another unrecognised shortcode - the generic fallback only
    // serialises the tag/attrs, silently dropping the <img> inside.
    const { nodes, warnings } = readWpbakery({
      contentHtml: '[caption id="attachment_1"]<img src="https://x/a.jpg" alt="A"/> My caption[/caption]',
      postmeta: {},
    });
    expect(nodes).toEqual([
      { kind: 'image', src: 'https://x/a.jpg', alt: 'A', caption: 'My caption', href: undefined, width: undefined, height: undefined },
    ]);
    expect(warnings).toHaveLength(0);
  });

  it('keeps a top-level [caption] with no image as raw with a warning, never fabricating one', () => {
    const { nodes, warnings } = readWpbakery({ contentHtml: '[caption]just text, no image[/caption]', postmeta: {} });
    expect(nodes[0].kind).toBe('raw');
    expect(warnings.some((w) => w.includes('no <img>'))).toBe(true);
  });
});
