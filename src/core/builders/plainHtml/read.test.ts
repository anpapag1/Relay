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

  it('keeps the classic [gallery] shortcode as raw with a warning, never fabricating a URL', () => {
    const { nodes, warnings } = readPlainHtml({
      contentHtml: '[gallery ids="1,2,3"]',
      postmeta: {},
    });
    expect(nodes[0].kind).toBe('raw');
    expect(warnings.some((w) => w.includes('gallery'))).toBe(true);
  });

  it('keeps an unrecognised element as raw with a warning instead of dropping it', () => {
    const { nodes, warnings } = readPlainHtml({
      contentHtml: '<table><tr><td>cell</td></tr></table>',
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
});
