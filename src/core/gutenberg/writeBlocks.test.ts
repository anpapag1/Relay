import { describe, expect, it } from 'vitest';
import { writeBlocks } from './writeBlocks';
import type { IRNode } from '../ir/nodes';
import type { ConversionSettings } from '../../types/domain';

const DEFAULT_SETTINGS: ConversionSettings = {
  imageSize: 'large',
  imageAlign: 'center',
  autoSpacing: true,
  spacerSize: 30,
  combineConsecutiveImages: false,
  galleryColumns: 3,
  galleryAspectRatio: 'none',
  pdfRender: 'button',
  buttonRender: 'button',
  headingShift: 0,
  linksNewTab: true,
};

describe('writeBlocks', () => {
  it('writes a paragraph', () => {
    const nodes: IRNode[] = [{ kind: 'paragraph', html: 'Hello <em>world</em>' }];
    expect(writeBlocks(nodes, DEFAULT_SETTINGS)).toBe(
      '<!-- wp:paragraph -->\n<p>Hello <em>world</em></p>\n<!-- /wp:paragraph -->',
    );
  });

  it('shifts heading level by headingShift and clamps at 6', () => {
    const nodes: IRNode[] = [{ kind: 'heading', level: 2, html: 'Title' }];
    const out = writeBlocks(nodes, { ...DEFAULT_SETTINGS, headingShift: 10 });
    expect(out).toContain('<h6');
    expect(out).toContain('"level":6');
  });

  it('writes an ordered and unordered list', () => {
    const ordered = writeBlocks([{ kind: 'list', ordered: true, items: ['a', 'b'] }], DEFAULT_SETTINGS);
    expect(ordered).toContain('<ol');
    expect(ordered).toContain('{"ordered":true}');

    const unordered = writeBlocks([{ kind: 'list', ordered: false, items: ['a'] }], DEFAULT_SETTINGS);
    expect(unordered).toContain('<ul');
    expect(unordered).not.toContain('ordered');
  });

  it('writes a quote with an optional cite', () => {
    const out = writeBlocks([{ kind: 'quote', html: 'Wise words', cite: 'Someone' }], DEFAULT_SETTINGS);
    expect(out).toContain('<blockquote');
    expect(out).toContain('<cite>Someone</cite>');
  });

  it('applies imageAlign and sizeSlug to images', () => {
    const out = writeBlocks(
      [{ kind: 'image', src: 'https://x/a.jpg', alt: 'Alt text' }],
      DEFAULT_SETTINGS,
    );
    expect(out).toContain('"align":"center"');
    expect(out).toContain('"sizeSlug":"large"');
    // WordPress's own alignment classes are always lowercase (aligncenter,
    // alignleft, ...) — capitalizing broke real-editor round-tripping.
    expect(out).toContain('aligncenter');
    expect(out).not.toContain('alignCenter');
    expect(out).toContain('size-large');
  });

  it('adds a margin on the wrap side when autoSpacing is on for a left/right-aligned image', () => {
    const node: IRNode = { kind: 'image', src: 'https://x/a.jpg', alt: '' };
    const left = writeBlocks([node], { ...DEFAULT_SETTINGS, imageAlign: 'left', autoSpacing: true, spacerSize: 24 });
    expect(left).toContain('style="margin-right:24px"');

    const right = writeBlocks([node], { ...DEFAULT_SETTINGS, imageAlign: 'right', autoSpacing: true, spacerSize: 24 });
    expect(right).toContain('style="margin-left:24px"');

    const centered = writeBlocks([node], { ...DEFAULT_SETTINGS, imageAlign: 'center', autoSpacing: true, spacerSize: 24 });
    expect(centered).not.toContain('style=');

    const off = writeBlocks([node], { ...DEFAULT_SETTINGS, imageAlign: 'left', autoSpacing: false });
    expect(off).not.toContain('style=');
  });

  it('renders a custom-sized single image WordPress\'s own way: auto + inline style + is-resized, not a computed pixel value', () => {
    const out = writeBlocks(
      [{ kind: 'image', src: 'https://x/a.jpg', alt: '', width: 200, height: 100 }],
      { ...DEFAULT_SETTINGS, imageSize: 'custom', customWidth: 400 },
    );
    expect(out).toContain('"width":"400px"');
    expect(out).toContain('"height":"auto"');
    expect(out).toContain('style="width:400px;height:auto"');
    expect(out).toContain('is-resized');
    expect(out).not.toContain('width="400"');
  });

  it('never emits width/height on a gallery image, even under a custom image size — a gallery photo opens via the lightbox at full size, not pinned to an export-time size', () => {
    const out = writeBlocks(
      [{ kind: 'gallery', images: [{ src: 'https://x/a.jpg', alt: '', width: 200, height: 100 }] }],
      { ...DEFAULT_SETTINGS, imageSize: 'custom', customWidth: 400 },
    );
    expect(out).not.toContain('width=');
    expect(out).not.toContain('height=');
  });

  it('never links an image to its full-size original, even when the source had one, matching a real WordPress-inserted image\'s default (linkDestination: none)', () => {
    const out = writeBlocks(
      [{ kind: 'image', src: 'https://x/a.jpg', alt: '', href: 'https://x/full.jpg' }],
      DEFAULT_SETTINGS,
    );
    expect(out).not.toContain('<a href');
    expect(out).toContain('"linkDestination":"none"');
  });

  it('writes a gallery at the configured column count, linking to the lightbox, with no id/sizeSlug/dimensions on its images', () => {
    const out = writeBlocks(
      [{ kind: 'gallery', images: [{ src: 'a.jpg', alt: '', attachmentId: 42, width: 600, height: 400 }, { src: 'b.jpg', alt: '' }] }],
      { ...DEFAULT_SETTINGS, galleryColumns: 4 },
    );
    expect(out).toContain('columns-4');
    expect(out).toContain('"columns":4');
    expect(out).toContain('is-cropped');
    expect(out).toContain('"linkTo":"lightbox"');
    expect(out.match(/<!-- wp:image \{"lightbox":\{"enabled":true\},"linkDestination":"none"\} -->/g)).toHaveLength(2);
    expect(out).not.toContain('sizeSlug');
    expect(out).not.toContain('"id":42');
    expect(out).not.toContain('width="600"');
  });

  it('applies galleryAspectRatio to the gallery block and every image, matching the real Gutenberg markup exactly — including its quirk of only stamping is-style-default on the first image', () => {
    const out = writeBlocks(
      [{ kind: 'gallery', images: [{ src: 'a.jpg', alt: '' }, { src: 'b.jpg', alt: '' }] }],
      { ...DEFAULT_SETTINGS, galleryColumns: 3, galleryAspectRatio: '1' },
    );
    expect(out).toContain('<!-- wp:gallery {"columns":3,"linkTo":"lightbox","aspectRatio":"1"} -->');
    expect(out).toContain(
      '<!-- wp:image {"lightbox":{"enabled":true},"aspectRatio":"1","linkDestination":"none","className":"is-style-default"} -->\n' +
      '<figure class="wp-block-image is-style-default"><img src="a.jpg" alt="" style="aspect-ratio:1"/></figure>',
    );
    expect(out).toContain(
      '<!-- wp:image {"lightbox":{"enabled":true},"aspectRatio":"1","linkDestination":"none"} -->\n' +
      '<figure class="wp-block-image"><img src="b.jpg" alt="" style="aspect-ratio:1"/></figure>',
    );
  });

  it('supports every real Gutenberg aspect ratio value (4/3, 3/4, 3/2, 2/3, 16/9, 9/16), and omits aspectRatio/style entirely for "none" (Original)', () => {
    const ratios: Array<'4/3' | '3/4' | '3/2' | '2/3' | '16/9' | '9/16'> = ['4/3', '3/4', '3/2', '2/3', '16/9', '9/16'];
    for (const ratio of ratios) {
      const out = writeBlocks(
        [{ kind: 'gallery', images: [{ src: 'a.jpg', alt: '' }] }],
        { ...DEFAULT_SETTINGS, galleryAspectRatio: ratio },
      );
      expect(out).toContain(`"aspectRatio":"${ratio}"`);
      expect(out).toContain(`style="aspect-ratio:${ratio}"`);
    }

    const original = writeBlocks(
      [{ kind: 'gallery', images: [{ src: 'a.jpg', alt: '' }] }],
      { ...DEFAULT_SETTINGS, galleryAspectRatio: 'none' },
    );
    expect(original).not.toContain('aspectRatio');
    expect(original).not.toContain('aspect-ratio');
    expect(original).not.toContain('is-style-default');
  });

  it('combines consecutive standalone images into a gallery when combineConsecutiveImages is on', () => {
    const nodes: IRNode[] = [
      { kind: 'paragraph', html: 'Intro' },
      { kind: 'image', src: 'a.jpg', alt: '' },
      { kind: 'image', src: 'b.jpg', alt: '' },
      { kind: 'image', src: 'c.jpg', alt: '' },
      { kind: 'paragraph', html: 'Outro' },
    ];
    const out = writeBlocks(nodes, { ...DEFAULT_SETTINGS, combineConsecutiveImages: true });
    expect(out).toContain('wp:gallery');
    expect(out.match(/<!-- wp:image /g)).toHaveLength(3);
    expect(out.indexOf('Intro')).toBeLessThan(out.indexOf('wp:gallery'));
    expect(out.indexOf('wp:gallery')).toBeLessThan(out.indexOf('Outro'));
  });

  it('leaves a lone image alone even with combineConsecutiveImages on', () => {
    const nodes: IRNode[] = [{ kind: 'image', src: 'a.jpg', alt: '' }];
    const out = writeBlocks(nodes, { ...DEFAULT_SETTINGS, combineConsecutiveImages: true });
    expect(out).not.toContain('wp:gallery');
    expect(out).toContain('wp:image');
  });

  it('does not combine images when combineConsecutiveImages is off', () => {
    const nodes: IRNode[] = [
      { kind: 'image', src: 'a.jpg', alt: '' },
      { kind: 'image', src: 'b.jpg', alt: '' },
    ];
    const out = writeBlocks(nodes, DEFAULT_SETTINGS);
    expect(out).not.toContain('wp:gallery');
    expect(out.match(/<!-- wp:image /g)).toHaveLength(2);
  });

  it('renders a button as wp:buttons by default and as a link when configured', () => {
    const node: IRNode = { kind: 'button', text: 'Click me', href: 'https://x/go' };
    const asButton = writeBlocks([node], DEFAULT_SETTINGS);
    expect(asButton).toContain('wp:buttons');
    expect(asButton).toContain('target="_blank"');

    const asLink = writeBlocks([node], { ...DEFAULT_SETTINGS, buttonRender: 'link', linksNewTab: false });
    expect(asLink).not.toContain('wp:buttons');
    expect(asLink).not.toContain('target="_blank"');
  });

  it('renders a non-pdf file as a plain wp:file link regardless of pdfRender, with no separate download button', () => {
    const node: IRNode = { kind: 'file', href: 'https://x/doc.docx', fileName: 'doc.docx', isPdf: false };
    const out = writeBlocks([node], { ...DEFAULT_SETTINGS, pdfRender: 'embed' });
    expect(out).toContain('wp:file');
    expect(out).toContain('"displayPreview":false');
    expect(out).not.toContain('wp-block-file__embed');
    expect(out).not.toContain('wp-block-file__button');
    expect(out).not.toContain('>Download<');
  });

  it('renders a pdf as a real wp:file block per pdfRender (link vs embed), never degrading to a plain wp:paragraph', () => {
    const node: IRNode = { kind: 'file', href: 'https://x/doc.pdf', fileName: 'doc.pdf', isPdf: true };

    const link = writeBlocks([node], { ...DEFAULT_SETTINGS, pdfRender: 'link' });
    expect(link).toContain('wp:file');
    expect(link).not.toContain('wp:paragraph');
    expect(link).toContain('"displayPreview":false');
    expect(link).not.toContain('wp-block-file__embed');

    const embed = writeBlocks([node], { ...DEFAULT_SETTINGS, pdfRender: 'embed' });
    expect(embed).toContain('"displayPreview":true');
    expect(embed).toContain('wp-block-file__embed');
    expect(embed).toContain('data="https://x/doc.pdf"');
  });

  it('matches the exact real-WordPress wp:file markup shape: link text has no extension, id attr from a migrated attachment, no download button, target=_blank', () => {
    const node: IRNode = { kind: 'file', href: 'https://new-site.example/uploads/report.pdf', fileName: 'report.pdf', isPdf: true, attachmentId: 900000443 };
    const out = writeBlocks([node], { ...DEFAULT_SETTINGS, pdfRender: 'embed' });

    expect(out).toContain('<!-- wp:file {"id":900000443,"href":"https://new-site.example/uploads/report.pdf","showDownloadButton":false,"displayPreview":true} -->');
    expect(out).toMatch(/<a id="wp-block-file--media-[0-9a-f-]+" href="https:\/\/new-site\.example\/uploads\/report\.pdf" target="_blank" rel="noreferrer noopener">report<\/a>/);
    expect(out).not.toContain('report.pdf<');
    expect(out).not.toContain('download');
  });

  it('omits the id attr entirely when the file has no migrated attachment yet', () => {
    const node: IRNode = { kind: 'file', href: 'https://x/doc.pdf', fileName: 'doc.pdf', isPdf: true };
    const out = writeBlocks([node], DEFAULT_SETTINGS);
    expect(out).toContain('<!-- wp:file {"href":"https://x/doc.pdf","showDownloadButton":false,"displayPreview":false} -->');
  });

  it('writes a file-provider video as wp:video and youtube/vimeo as wp:embed', () => {
    const file = writeBlocks([{ kind: 'video', src: 'https://x/v.mp4', provider: 'file' }], DEFAULT_SETTINGS);
    expect(file).toContain('wp:video');

    const yt = writeBlocks(
      [{ kind: 'video', src: 'https://youtube.com/watch?v=1', provider: 'youtube' }],
      DEFAULT_SETTINGS,
    );
    expect(yt).toContain('wp:embed');
    expect(yt).toContain('is-provider-youtube');
  });

  it('writes a separator and a spacer with settings.spacerSize', () => {
    expect(writeBlocks([{ kind: 'separator' }], DEFAULT_SETTINGS)).toContain('wp:separator');
    const spacer = writeBlocks([{ kind: 'spacer', height: 42 }], DEFAULT_SETTINGS);
    expect(spacer).toContain('height:42px');
  });

  it('recurses into columns, applying the same settings to nested nodes', () => {
    const nodes: IRNode[] = [
      {
        kind: 'columns',
        columns: [
          [{ kind: 'paragraph', html: 'Left' }],
          [{ kind: 'heading', level: 2, html: 'Right' }],
        ],
      },
    ];
    const out = writeBlocks(nodes, { ...DEFAULT_SETTINGS, headingShift: 1 });
    expect(out).toContain('wp:columns');
    expect(out).toContain('Left');
    expect(out).toContain('<h3');
  });

  it('writes raw html without leaking the warning note into markup', () => {
    const out = writeBlocks([{ kind: 'raw', html: '<div>weird</div>', note: 'unknown widget: x' }], DEFAULT_SETTINGS);
    expect(out).toContain('<div>weird</div>');
    expect(out).not.toContain('unknown widget');
  });

  it('joins multiple top-level blocks with a blank line', () => {
    const nodes: IRNode[] = [
      { kind: 'paragraph', html: 'One' },
      { kind: 'paragraph', html: 'Two' },
    ];
    expect(writeBlocks(nodes, DEFAULT_SETTINGS)).toBe(
      '<!-- wp:paragraph -->\n<p>One</p>\n<!-- /wp:paragraph -->\n\n<!-- wp:paragraph -->\n<p>Two</p>\n<!-- /wp:paragraph -->',
    );
  });
});
