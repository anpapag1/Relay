import { describe, it, expect } from 'vitest';
import { collectImageSrcRefs } from './collectImageSrcRefs';
import type { IRNode } from '../ir/nodes';

describe('collectImageSrcRefs', () => {
  it('collects an image node\'s src but not its href', () => {
    const nodes: IRNode[] = [{ kind: 'image', src: 'https://old.example/a.jpg', alt: '', href: 'https://old.example/some-page' }];
    expect(collectImageSrcRefs(nodes)).toEqual(['https://old.example/a.jpg']);
  });

  it('collects every gallery image src but not any href', () => {
    const nodes: IRNode[] = [
      {
        kind: 'gallery',
        images: [
          { src: 'https://old.example/a.jpg', alt: '', href: 'https://old.example/a-full.jpg' },
          { src: 'https://old.example/b.jpg', alt: '' },
        ],
      },
    ];
    expect(collectImageSrcRefs(nodes)).toEqual(['https://old.example/a.jpg', 'https://old.example/b.jpg']);
  });

  it('does not collect a file node\'s href — a PDF/doc is never an image', () => {
    const nodes: IRNode[] = [{ kind: 'file', href: 'https://old.example/brochure.pdf', fileName: 'brochure.pdf', isPdf: true }];
    expect(collectImageSrcRefs(nodes)).toEqual([]);
  });

  it('recurses into columns', () => {
    const nodes: IRNode[] = [
      {
        kind: 'columns',
        columns: [
          [{ kind: 'image', src: 'https://old.example/left.jpg', alt: '' }],
          [{ kind: 'file', href: 'https://old.example/doc.pdf', fileName: 'doc.pdf', isPdf: false }],
        ],
      },
    ];
    expect(collectImageSrcRefs(nodes)).toEqual(['https://old.example/left.jpg']);
  });

  it('ignores non-media node kinds', () => {
    const nodes: IRNode[] = [
      { kind: 'paragraph', html: '<p>hi</p>' },
      { kind: 'button', text: 'Click', href: 'https://old.example/landing' },
      { kind: 'video', src: 'https://old.example/video.mp4', provider: 'file' },
    ];
    expect(collectImageSrcRefs(nodes)).toEqual([]);
  });
});
