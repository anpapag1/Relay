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
});
