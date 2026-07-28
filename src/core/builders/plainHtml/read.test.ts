import { describe, expect, it } from 'vitest';
import { readPlainHtml } from './read';

describe('readPlainHtml', () => {
  it('reads paragraphs, headings, lists, blockquotes, and hr', () => {
    const { nodes } = readPlainHtml({
      contentHtml: '<h2>Title</h2><p>Body <em>text</em></p><ul><li>one</li><li>two</li></ul><blockquote>Wise<cite>Someone</cite></blockquote><hr>',
      postmeta: {},
    });
    expect(nodes).toEqual([
      { kind: 'heading', level: 2, html: 'Title' },
      { kind: 'paragraph', html: 'Body <em>text</em>' },
      { kind: 'list', ordered: false, items: ['one', 'two'] },
      { kind: 'quote', html: 'Wise', cite: 'Someone' },
      { kind: 'separator' },
    ]);
  });

  it('promotes a paragraph containing only an image to a standalone image block', () => {
    const { nodes } = readPlainHtml({
      contentHtml: '<p><img src="https://x/a.jpg" alt="A" width="100" height="50"/></p>',
      postmeta: {},
    });
    expect(nodes).toEqual([{ kind: 'image', src: 'https://x/a.jpg', alt: 'A', caption: undefined, href: undefined, width: 100, height: 50 }]);
  });

  it('reads a figure with a figcaption as an image with a caption', () => {
    const { nodes } = readPlainHtml({
      contentHtml: '<figure><img src="https://x/a.jpg" alt="A"/><figcaption>Caption text</figcaption></figure>',
      postmeta: {},
    });
    expect(nodes[0]).toMatchObject({ kind: 'image', src: 'https://x/a.jpg', caption: 'Caption text' });
  });

  it('resolves the [caption] classic shortcode to an image with a caption', () => {
    const { nodes } = readPlainHtml({
      contentHtml: '[caption id="attachment_1"]<img src="https://x/a.jpg" alt="A"/> My caption[/caption]',
      postmeta: {},
    });
    expect(nodes[0]).toMatchObject({ kind: 'image', src: 'https://x/a.jpg', caption: 'My caption' });
  });

  it('resolves the classic [gallery] shortcode\'s ids into a real gallery, the same way vc_gallery already does', () => {
    const { nodes, warnings } = readPlainHtml({
      contentHtml: '[gallery ids="1,2,3"]',
      postmeta: {},
    });
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
    expect(warnings).toHaveLength(0);
  });

  it('keeps a classic [gallery] shortcode with no ids as raw with a warning, never fabricating a URL', () => {
    const { nodes, warnings } = readPlainHtml({ contentHtml: '[gallery]', postmeta: {} });
    expect(nodes[0].kind).toBe('raw');
    expect(warnings.some((w) => w.includes('gallery'))).toBe(true);
  });

  it('reads a <table> as a wp:table block instead of raw HTML', () => {
    const { nodes, warnings } = readPlainHtml({
      contentHtml: '<table><tr><td>cell</td></tr></table>',
      postmeta: {},
    });
    expect(nodes).toEqual([{ kind: 'table', html: '<table><tbody><tr><td>cell</td></tr></tbody></table>' }]);
    expect(warnings).toHaveLength(0);
  });

  it('resolves the classic [video] shortcode\'s src into a real video block', () => {
    const { nodes, warnings } = readPlainHtml({
      contentHtml: '[video src="https://old.example/movie.mp4"]',
      postmeta: {},
    });
    expect(nodes).toEqual([{ kind: 'video', src: 'https://old.example/movie.mp4', provider: 'file' }]);
    expect(warnings).toHaveLength(0);
  });

  it('keeps a classic [video] shortcode with no resolvable source as raw with a warning', () => {
    const { nodes, warnings } = readPlainHtml({ contentHtml: '[video]', postmeta: {} });
    expect(nodes[0].kind).toBe('raw');
    expect(warnings.some((w) => w.includes('video'))).toBe(true);
  });

  it('keeps a genuinely unrecognised element as raw with a warning instead of dropping it', () => {
    const { nodes, warnings } = readPlainHtml({
      contentHtml: '<canvas width="10" height="10"></canvas>',
      postmeta: {},
    });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe('raw');
    expect(warnings).toHaveLength(1);
  });

  it('groups bare text and inline tags with no wrapping <p> into one paragraph instead of fragmenting or dropping them', () => {
    const { nodes, warnings } = readPlainHtml({
      contentHtml: '<strong>Bold intro</strong> then a <a href="https://example.com">link</a> and plain trailing text',
      postmeta: {},
    });
    expect(nodes).toEqual([
      {
        kind: 'paragraph',
        html: '<strong>Bold intro</strong> then a <a href="https://example.com">link</a> and plain trailing text',
      },
    ]);
    expect(warnings).toHaveLength(0);
  });

  it('flushes buffered inline content as its own paragraph before a real block element', () => {
    const { nodes } = readPlainHtml({
      contentHtml: 'Intro <em>text</em><h2>Heading</h2>after heading',
      postmeta: {},
    });
    expect(nodes).toEqual([
      { kind: 'paragraph', html: 'Intro <em>text</em>' },
      { kind: 'heading', level: 2, html: 'Heading' },
      { kind: 'paragraph', html: 'after heading' },
    ]);
  });

  it('splits blank-line-separated bare paragraphs instead of gluing them into one block', () => {
    // Real classic-editor content: no <p> tags at all, WordPress's own
    // wpautop splits on blank lines at render time. Gluing these into one
    // paragraph (the pre-fix behavior) ran unrelated paragraphs together
    // with no visual break.
    const { nodes } = readPlainHtml({
      contentHtml: 'First paragraph text.\n\nSecond paragraph <strong>with bold</strong>.\n\nThird paragraph.',
      postmeta: {},
    });
    expect(nodes).toEqual([
      { kind: 'paragraph', html: 'First paragraph text.' },
      { kind: 'paragraph', html: 'Second paragraph <strong>with bold</strong>.' },
      { kind: 'paragraph', html: 'Third paragraph.' },
    ]);
  });

  it('promotes a bare (unwrapped) image-only chunk to a standalone image block, even wrapped in <strong><a>', () => {
    // The exact real-world shape: <strong><a><img></a></strong> sitting
    // directly in the body with no <p>, followed by a blank line and then
    // caption/body text. Before this fix, the image stayed inline inside
    // one giant paragraph and lost the wp-block-image wrapper that
    // constrains its width in the preview.
    const { nodes } = readPlainHtml({
      contentHtml:
        '<strong><a href="https://x/full.jpg"><img src="https://x/a.jpg" alt="" width="640" height="426"></a></strong>\n\n<strong>A bold caption line</strong>\n\nBody paragraph text.',
      postmeta: {},
    });
    expect(nodes).toEqual([
      { kind: 'image', src: 'https://x/a.jpg', alt: '', caption: undefined, href: 'https://x/full.jpg', width: 640, height: 426 },
      { kind: 'paragraph', html: '<strong>A bold caption line</strong>' },
      { kind: 'paragraph', html: 'Body paragraph text.' },
    ]);
  });

  it('promotes multiple bare images in the same blank-line-separated chunk to separate image blocks', () => {
    const { nodes } = readPlainHtml({
      contentHtml: '<img src="https://x/a.jpg" alt="A"><img src="https://x/b.jpg" alt="B">\n\nSome text.',
      postmeta: {},
    });
    expect(nodes[0]).toMatchObject({ kind: 'image', src: 'https://x/a.jpg' });
    expect(nodes[1]).toMatchObject({ kind: 'image', src: 'https://x/b.jpg' });
    expect(nodes[2]).toEqual({ kind: 'paragraph', html: 'Some text.' });
  });

  it('unwraps a generic <div> wrapper and reads its children instead of dumping it as raw HTML', () => {
    // Old-site page builders (WPBakery, Divi, plain theme markup) wrap
    // nearly everything in a <div> - this used to make every such post
    // trigger an "Unrecognised element <div>" review warning and lose the
    // paragraph/image conversion inside it entirely.
    const { nodes, warnings } = readPlainHtml({
      contentHtml: '<div><p>Inside a div</p><img src="https://x/a.jpg" alt="A"></div>',
      postmeta: {},
    });
    expect(nodes).toEqual([
      { kind: 'paragraph', html: 'Inside a div' },
      { kind: 'image', src: 'https://x/a.jpg', alt: 'A', caption: undefined, href: undefined, width: undefined, height: undefined },
    ]);
    expect(warnings).toHaveLength(0);
  });

  it('unwraps nested containers (div inside header) and still splits bare text on blank lines', () => {
    const { nodes } = readPlainHtml({
      contentHtml: '<header><div>First paragraph.\n\nSecond paragraph.</div></header>',
      postmeta: {},
    });
    expect(nodes).toEqual([
      { kind: 'paragraph', html: 'First paragraph.' },
      { kind: 'paragraph', html: 'Second paragraph.' },
    ]);
  });

  it('still keeps a genuinely unrecognised leaf element (not a generic container) as raw with a warning', () => {
    const { nodes, warnings } = readPlainHtml({
      contentHtml: '<div><canvas width="10" height="10"></canvas></div>',
      postmeta: {},
    });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe('raw');
    expect(warnings).toHaveLength(1);
  });
});
