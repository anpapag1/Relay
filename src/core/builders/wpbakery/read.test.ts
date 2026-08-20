import { describe, expect, it } from 'vitest';
import { readWpbakery } from './read';
import type { ReaderWarning } from '../types';

const msgs = (warnings: ReaderWarning[]) => warnings.map((w) => w.message);

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

  it('flattens a row with one populated column and one genuinely empty column, dropping the wp:columns wrapper entirely', () => {
    const { nodes } = readWpbakery({
      contentHtml: '[vc_row][vc_column][vc_column_text]<p>Only content</p>[/vc_column_text][/vc_column][vc_column][/vc_column][/vc_row]',
      postmeta: {},
    });
    expect(nodes).toEqual([{ kind: 'paragraph', html: 'Only content' }]);
  });

  it('drops a row whose columns are all genuinely empty entirely, no pointless empty wp:columns block', () => {
    const { nodes } = readWpbakery({
      contentHtml: '[vc_row][vc_column][/vc_column][/vc_row]',
      postmeta: {},
    });
    expect(nodes).toEqual([]);
  });

  it('flattens a main-content column plus a media-only sidebar column into one flow instead of a 2-column split', () => {
    const { nodes } = readWpbakery({
      contentHtml:
        '[vc_row][vc_column width="3/4"][vc_column_text]<p>Main text</p>[/vc_column_text][/vc_column][vc_column width="1/4"][vc_video link="https://www.youtube.com/watch?v=abc123" title="Video"][vc_raw_html]JTNDZGl2JTIwaWQlM0QlMjJzaWRlYmFyLWF0LXZpc3VhbCUyMiUzRSUzQyUyRmRpdg==[/vc_raw_html][/vc_column][/vc_row]',
      postmeta: {},
    });
    expect(nodes).toEqual([
      { kind: 'paragraph', html: 'Main text' },
      { kind: 'video', src: 'https://www.youtube.com/watch?v=abc123', provider: 'youtube' },
    ]);
  });

  it('converts a vc_video quoted with HTML-entity quote marks to a video node instead of a raw [video] fallback', () => {
    const { nodes, warnings } = readWpbakery({
      contentHtml:
        '[vc_row][vc_column][vc_video link=&#8221;https://www.youtube.com/watch?v=8Ood9C1qWZE&#8221; el_aspect=&#8221;43&#8243; title=&#8221;Ασπίδα Προστασίας στην Κλιματική Κρίση&#8221;][/vc_column][/vc_row]',
      postmeta: {},
    });
    expect(nodes).toEqual([{ kind: 'video', src: 'https://www.youtube.com/watch?v=8Ood9C1qWZE', provider: 'youtube' }]);
    expect(msgs(warnings)).not.toContain('Classic [video] shortcode with no resolvable source — kept as raw.');
  });

  it('keeps a 2-column split when both columns hold real content', () => {
    const { nodes } = readWpbakery({
      contentHtml:
        '[vc_row][vc_column][vc_column_text]<p>Left</p>[/vc_column_text][/vc_column][vc_column][vc_column_text]<p>Right</p>[/vc_column_text][/vc_column][/vc_row]',
      postmeta: {},
    });
    expect(nodes[0]?.kind).toBe('columns');
  });

  it('converts a vc_video shortcode embedded inside vc_column_text text to a video node instead of leaving the literal shortcode in the paragraph', () => {
    const { nodes } = readWpbakery({
      contentHtml:
        '[vc_row][vc_column][vc_column_text]<p><strong>ΔΕΙΤΕ ΤΟ ΒΙΝΤΕΟ</strong>[vc_video link="https://www.youtube.com/watch?v=UbUgpFAiinc" title="9ο Open Air Film Festival "]</p>[/vc_column_text][/vc_column][/vc_row]',
      postmeta: {},
    });
    expect(nodes).toEqual([
      { kind: 'paragraph', html: '<strong>ΔΕΙΤΕ ΤΟ ΒΙΝΤΕΟ</strong>' },
      { kind: 'video', src: 'https://www.youtube.com/watch?v=UbUgpFAiinc', provider: 'youtube' },
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
    expect(msgs(warnings).some((m) => m.includes('vc_testimonial'))).toBe(true);
  });

  it('decodes vc_raw_html\'s base64+urlencoded payload into real HTML instead of a literal placeholder', () => {
    // Payload is base64(encodeURIComponent('<div class="ad-banner">Sponsored content</div>'))
    // — real content, distinct from the known-empty sidebar anchor tested below.
    const { nodes, warnings } = readWpbakery({
      contentHtml: '[vc_raw_html]JTNDZGl2JTIwY2xhc3MlM0QlMjJhZC1iYW5uZXIlMjIlM0VTcG9uc29yZWQlMjBjb250ZW50JTNDJTJGZGl2JTNF[/vc_raw_html]',
      postmeta: {},
    });
    expect(nodes).toEqual([{ kind: 'raw', html: '<div class="ad-banner">Sponsored content</div>', note: 'vc_raw_html (decoded)' }]);
    expect(warnings).toEqual([{ message: 'vc_raw_html decoded and kept as raw HTML.', severity: 'review' }]);
  });

  it('drops a decoded vc_raw_html payload that is the known-empty sidebar widget anchor, well-formed or not', () => {
    // The well-formed version (closing </div> with its >).
    const wellFormed = readWpbakery({
      contentHtml: '[vc_raw_html]JTNDZGl2JTIwaWQlM0QlMjJzaWRlYmFyLWF0LXZpc3VhbCUyMiUzRSUzQyUyRmRpdiUzRQ==[/vc_raw_html]',
      postmeta: {},
    });
    expect(wellFormed.nodes).toEqual([]);
    expect(wellFormed.warnings).toEqual([
      {
        message: 'vc_raw_html was a known-empty sidebar widget anchor (depends on the old theme\'s JavaScript, which won\'t exist on the new site) — dropped rather than kept as dead markup.',
        severity: 'info',
      },
    ]);

    // The exact malformed encoding (missing the closing >) observed across
    // 250/250 real vc_raw_html occurrences in production exports.
    const malformed = readWpbakery({
      contentHtml: '[vc_raw_html]JTNDZGl2JTIwaWQlM0QlMjJzaWRlYmFyLWF0LXZpc3VhbCUyMiUzRSUzQyUyRmRpdg==[/vc_raw_html]',
      postmeta: {},
    });
    expect(malformed.nodes).toEqual([]);
    expect(msgs(malformed.warnings).some((m) => m.includes('known-empty sidebar widget anchor'))).toBe(true);
    expect(malformed.warnings.every((w) => w.severity === 'info')).toBe(true);
  });

  it('drops an empty vc_raw_html and reports an undecodable payload rather than crashing', () => {
    const empty = readWpbakery({ contentHtml: '[vc_raw_html][/vc_raw_html]', postmeta: {} });
    expect(empty.nodes).toEqual([]);
    expect(empty.warnings).toEqual([{ message: 'vc_raw_html with no content — dropped.', severity: 'review' }]);

    const garbage = readWpbakery({ contentHtml: '[vc_raw_html]not-valid-base64!!![/vc_raw_html]', postmeta: {} });
    expect(garbage.nodes[0].kind).toBe('raw');
    expect(msgs(garbage.warnings).some((m) => m.includes('could not be decoded'))).toBe(true);
  });

  it('drops a bare vc_icon with a warning, and converts a linked one to a button', () => {
    const bare = readWpbakery({ contentHtml: '[vc_row][vc_column][vc_icon][/vc_column][/vc_row]', postmeta: {} });
    // The single column ends up with no real content (the dropped icon
    // leaves it empty) — a row left with no populated columns is dropped
    // entirely rather than emitting a pointless empty wp:columns block.
    expect(bare.nodes).toEqual([]);
    expect(msgs(bare.warnings).some((m) => m.includes('vc_icon dropped'))).toBe(true);

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
    expect(msgs(warnings).some((m) => m.includes('no <img>'))).toBe(true);
  });

  it('converts vc_images_carousel image ids into a static gallery, with a warning that the slider behavior is lost', () => {
    const { nodes, warnings } = readWpbakery({ contentHtml: '[vc_images_carousel images="10,11,12"]', postmeta: {} });
    expect(nodes).toEqual([
      {
        kind: 'gallery',
        images: [
          { src: 'attachment:10', alt: '' },
          { src: 'attachment:11', alt: '' },
          { src: 'attachment:12', alt: '' },
        ],
      },
    ]);
    expect(msgs(warnings).some((m) => m.includes('carousel behavior is not preserved'))).toBe(true);
  });

  it('keeps a vc_images_carousel with no image ids as raw with a warning', () => {
    const { nodes, warnings } = readWpbakery({ contentHtml: '[vc_images_carousel]', postmeta: {} });
    expect(nodes[0].kind).toBe('raw');
    expect(msgs(warnings).some((m) => m.includes('vc_images_carousel'))).toBe(true);
  });

  it('reads a top-level classic [video] shortcode (distinct from vc_video) as a video node', () => {
    const { nodes, warnings } = readWpbakery({
      contentHtml: '[video src="https://old.example/movie.mp4"]',
      postmeta: {},
    });
    expect(nodes).toEqual([{ kind: 'video', src: 'https://old.example/movie.mp4', provider: 'file' }]);
    expect(warnings).toHaveLength(0);
  });

  it('keeps a [video] shortcode with no resolvable source as raw with a warning, and does not swallow following siblings', () => {
    const { nodes, warnings } = readWpbakery({ contentHtml: '[video][vc_separator]', postmeta: {} });
    expect(nodes[0].kind).toBe('raw');
    expect(msgs(warnings).some((m) => m.includes('video shortcode'))).toBe(true);
    // [video] is void (VOID_TAGS) - it must not have swallowed vc_separator
    // as its "child" the way a non-void unclosed tag would.
    expect(nodes[1]).toEqual({ kind: 'separator' });
  });
});
