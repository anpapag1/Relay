import { describe, expect, it } from 'vitest';
import { readDivi } from './read';

describe('readDivi', () => {
  it('collapses section/row/column into a columns node, delegating et_pb_text to plainHtml', () => {
    const { nodes } = readDivi({
      contentHtml: '[et_pb_section][et_pb_row][et_pb_column][et_pb_text]<p>Left</p>[/et_pb_text][/et_pb_column][et_pb_column][et_pb_text]<p>Right</p>[/et_pb_text][/et_pb_column][/et_pb_row][/et_pb_section]',
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

  it('reads et_pb_image with a real URL and percent-decodes attributes', () => {
    const { nodes } = readDivi({
      contentHtml: '[et_pb_image src="https://x/a.jpg" alt="A%20photo" url="https://x/full"]',
      postmeta: {},
    });
    expect(nodes).toEqual([{ kind: 'image', src: 'https://x/a.jpg', alt: 'A photo', href: 'https://x/full' }]);
  });

  it('reads et_pb_gallery ids into gallery IR', () => {
    const { nodes } = readDivi({ contentHtml: '[et_pb_gallery gallery_ids="5,6"]', postmeta: {} });
    expect(nodes).toEqual([
      {
        kind: 'gallery',
        images: [
          { src: 'attachment:5', alt: '' },
          { src: 'attachment:6', alt: '' },
        ],
      },
    ]);
  });

  it('reads et_pb_button', () => {
    const { nodes } = readDivi({ contentHtml: '[et_pb_button button_text="Go" button_url="https://x/go"]', postmeta: {} });
    expect(nodes).toEqual([{ kind: 'button', text: 'Go', href: 'https://x/go' }]);
  });

  it('reads et_pb_divider as a separator', () => {
    const { nodes } = readDivi({ contentHtml: '[et_pb_divider]', postmeta: {} });
    expect(nodes).toEqual([{ kind: 'separator' }]);
  });

  it('keeps an unrecognised widget as raw with a warning', () => {
    const { nodes, warnings } = readDivi({ contentHtml: '[et_pb_testimonial name="X"]', postmeta: {} });
    expect(nodes[0].kind).toBe('raw');
    expect(warnings.map((w) => w.message).some((m) => m.includes('et_pb_testimonial'))).toBe(true);
  });
});
