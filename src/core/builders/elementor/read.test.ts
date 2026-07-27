import { describe, expect, it } from 'vitest';
import { readElementor } from './read';

function elementorData(tree: unknown): Record<string, string> {
  return { _elementor_data: JSON.stringify(tree) };
}

describe('readElementor', () => {
  it('collapses section/column into a columns node, delegating text-editor to plainHtml', () => {
    const tree = [
      {
        elType: 'section',
        elements: [
          {
            elType: 'column',
            elements: [{ elType: 'widget', widgetType: 'text-editor', settings: { editor: '<p>Left</p>' } }],
          },
          {
            elType: 'column',
            elements: [{ elType: 'widget', widgetType: 'text-editor', settings: { editor: '<p>Right</p>' } }],
          },
        ],
      },
    ];
    const { nodes } = readElementor({ contentHtml: '', postmeta: elementorData(tree) });
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

  it('reads a heading widget using header_size', () => {
    const tree = [{ elType: 'widget', widgetType: 'heading', settings: { title: 'Hi', header_size: 'h3' } }];
    const { nodes } = readElementor({ contentHtml: '', postmeta: elementorData(tree) });
    expect(nodes).toEqual([{ kind: 'heading', level: 3, html: 'Hi' }]);
  });

  it('reads an image widget', () => {
    const tree = [{ elType: 'widget', widgetType: 'image', settings: { image: { url: 'https://x/a.jpg', alt: 'A' } } }];
    const { nodes } = readElementor({ contentHtml: '', postmeta: elementorData(tree) });
    expect(nodes).toEqual([{ kind: 'image', src: 'https://x/a.jpg', alt: 'A' }]);
  });

  it('reads a button widget', () => {
    const tree = [{ elType: 'widget', widgetType: 'button', settings: { text: 'Go', link: { url: 'https://x/go' } } }];
    const { nodes } = readElementor({ contentHtml: '', postmeta: elementorData(tree) });
    expect(nodes).toEqual([{ kind: 'button', text: 'Go', href: 'https://x/go' }]);
  });

  it('reads a youtube video widget', () => {
    const tree = [{ elType: 'widget', widgetType: 'video', settings: { video_type: 'youtube', youtube_url: 'https://youtube.com/x' } }];
    const { nodes } = readElementor({ contentHtml: '', postmeta: elementorData(tree) });
    expect(nodes).toEqual([{ kind: 'video', src: 'https://youtube.com/x', provider: 'youtube' }]);
  });

  it('falls back to plainHtml when _elementor_data is missing', () => {
    const { nodes, warnings } = readElementor({ contentHtml: '<p>Plain content</p>', postmeta: {} });
    expect(nodes).toEqual([{ kind: 'paragraph', html: 'Plain content' }]);
    expect(warnings.some((w) => w.includes('_elementor_data'))).toBe(true);
  });

  it('falls back to plainHtml when _elementor_data is invalid JSON', () => {
    const { nodes, warnings } = readElementor({ contentHtml: '<p>Plain content</p>', postmeta: { _elementor_data: '{not json' } });
    expect(nodes).toEqual([{ kind: 'paragraph', html: 'Plain content' }]);
    expect(warnings.some((w) => w.includes('not valid JSON'))).toBe(true);
  });

  it('keeps an unrecognised widget type as raw with a warning', () => {
    const tree = [{ elType: 'widget', widgetType: 'testimonial-carousel', settings: {} }];
    const { nodes, warnings } = readElementor({ contentHtml: '', postmeta: elementorData(tree) });
    expect(nodes[0].kind).toBe('raw');
    expect(warnings.some((w) => w.includes('testimonial-carousel'))).toBe(true);
  });
});
