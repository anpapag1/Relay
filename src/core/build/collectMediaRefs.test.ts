import { describe, expect, it } from 'vitest';
import { collectMediaRefs, rewriteMediaRefs } from './collectMediaRefs';
import { buildAttachmentRegistry } from '../media/attachmentRegistry';
import type { IRNode } from '../ir/nodes';
import type { MediaResolution } from '../../types/domain';

describe('collectMediaRefs', () => {
  it('collects image src/href, gallery image src, and file href, recursing into columns', () => {
    const nodes: IRNode[] = [
      { kind: 'image', src: 'a.jpg', alt: '', href: 'a-full.jpg' },
      { kind: 'gallery', images: [{ src: 'b.jpg', alt: '' }, { src: 'c.jpg', alt: '', href: 'c-full.jpg' }] },
      { kind: 'file', href: 'doc.pdf', fileName: 'doc.pdf', isPdf: true },
      { kind: 'columns', columns: [[{ kind: 'image', src: 'd.jpg', alt: '' }]] },
      { kind: 'button', text: 'Go', href: 'https://example.com' },
    ];
    expect(collectMediaRefs(nodes)).toEqual(['a.jpg', 'a-full.jpg', 'b.jpg', 'c.jpg', 'c-full.jpg', 'doc.pdf', 'd.jpg']);
  });

  it('does not double-count an image/gallery-image whose href just links to its own src (the classic "link to full size" wrapper, <a href="photo.jpg"><img src="photo.jpg">) — same physical file, not two', () => {
    const nodes: IRNode[] = [
      { kind: 'image', src: 'self.jpg', alt: '', href: 'self.jpg' },
      { kind: 'gallery', images: [{ src: 'g1.jpg', alt: '', href: 'g1.jpg' }, { src: 'g2.jpg', alt: '', href: 'g2-full.jpg' }] },
    ];
    expect(collectMediaRefs(nodes)).toEqual(['self.jpg', 'g1.jpg', 'g2.jpg', 'g2-full.jpg']);
  });

  it('does not double-count an image whose href is the original full-size file and src is a WordPress-generated thumbnail of it (<a href="photo.jpg"><img src="photo-1024x682.jpg">) — one attachment, not two', () => {
    const nodes: IRNode[] = [
      {
        kind: 'image',
        alt: '',
        src: 'https://old.example/wp-content/uploads/2025/01/photo-1024x682.jpg',
        href: 'https://old.example/wp-content/uploads/2025/01/photo.jpg',
      },
      {
        kind: 'gallery',
        images: [
          { src: 'https://old.example/uploads/pic-150x150.jpg', alt: '', href: 'https://old.example/uploads/pic.jpg' },
          // A genuinely different attachment (different basename entirely) still counts as two.
          { src: 'https://old.example/uploads/other.jpg', alt: '', href: 'https://old.example/uploads/other-original.jpg' },
        ],
      },
    ];
    expect(collectMediaRefs(nodes)).toEqual([
      'https://old.example/wp-content/uploads/2025/01/photo-1024x682.jpg',
      'https://old.example/uploads/pic-150x150.jpg',
      'https://old.example/uploads/other.jpg',
      'https://old.example/uploads/other-original.jpg',
    ]);
  });

  it('collects file links buried inside list items, since readList never splits them into their own file node', () => {
    const nodes: IRNode[] = [
      {
        kind: 'list',
        ordered: false,
        items: [
          '<strong><a href="https://old.example/wp-content/uploads/2026/08/report.pdf">The report</a></strong>',
          'Plain text item with no link',
          '<a href="https://old.example/page/">A normal page link, not a file</a>',
        ],
      },
    ];
    expect(collectMediaRefs(nodes)).toEqual(['https://old.example/wp-content/uploads/2026/08/report.pdf']);
  });
});

describe('rewriteMediaRefs', () => {
  it('replaces a matched ref with its resolved URL', () => {
    const nodes: IRNode[] = [{ kind: 'image', src: 'attachment:1', alt: '' }];
    const resolved: Record<string, MediaResolution> = { 'attachment:1': { outcome: 'matched-export', url: 'https://x/real.jpg' } };
    const { nodes: out, warnings } = rewriteMediaRefs(nodes, resolved);
    expect(out).toEqual([{ kind: 'image', src: 'https://x/real.jpg', alt: '' }]);
    expect(warnings).toEqual([]);
  });

  it('leaves an unresolved ref untouched and reports a warning', () => {
    const nodes: IRNode[] = [{ kind: 'image', src: 'attachment:99', alt: '' }];
    const resolved: Record<string, MediaResolution> = { 'attachment:99': { outcome: 'unresolved', reason: 'not found' } };
    const { nodes: out, warnings } = rewriteMediaRefs(nodes, resolved);
    expect(out).toEqual([{ kind: 'image', src: 'attachment:99', alt: '' }]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('attachment:99');
  });

  it('rewrites nested columns', () => {
    const nodes: IRNode[] = [{ kind: 'columns', columns: [[{ kind: 'image', src: 'a.jpg', alt: '' }]] }];
    const resolved: Record<string, MediaResolution> = { 'a.jpg': { outcome: 'matched-live', url: 'https://x/a.jpg' } };
    const { nodes: out } = rewriteMediaRefs(nodes, resolved);
    expect(out).toEqual([{ kind: 'columns', columns: [[{ kind: 'image', src: 'https://x/a.jpg', alt: '' }]] }]);
  });

  it('passes through a ref with no resolution entry unchanged', () => {
    const nodes: IRNode[] = [{ kind: 'image', src: 'untouched.jpg', alt: '' }];
    const { nodes: out, warnings } = rewriteMediaRefs(nodes, {});
    expect(out).toEqual(nodes);
    expect(warnings).toEqual([]);
  });

  it('stamps a resolved file with its migrated attachmentId, the same way an image gets one, so writeFile can emit a real wp:file id instead of the file just linking back to the old site', () => {
    const nodes: IRNode[] = [{ kind: 'file', href: 'report.pdf', fileName: 'report.pdf', isPdf: true }];
    const resolved: Record<string, MediaResolution> = { 'report.pdf': { outcome: 'matched-export', url: 'https://new-site.example/uploads/report.pdf' } };
    const attachmentRegistry = buildAttachmentRegistry(['https://new-site.example/uploads/report.pdf']);

    const { nodes: out } = rewriteMediaRefs(nodes, resolved, attachmentRegistry);
    expect(out).toEqual([
      {
        kind: 'file',
        href: 'https://new-site.example/uploads/report.pdf',
        fileName: 'report.pdf',
        isPdf: true,
        attachmentId: attachmentRegistry.get('https://new-site.example/uploads/report.pdf')!.id,
      },
    ]);
  });

  it('leaves a file with no attachmentRegistry entry (or no registry given at all) without an attachmentId, rather than fabricating one', () => {
    const nodes: IRNode[] = [{ kind: 'file', href: 'report.pdf', fileName: 'report.pdf', isPdf: true }];
    const resolved: Record<string, MediaResolution> = { 'report.pdf': { outcome: 'matched-export', url: 'https://x/report.pdf' } };

    const { nodes: withoutRegistry } = rewriteMediaRefs(nodes, resolved);
    expect((withoutRegistry[0] as { attachmentId?: number }).attachmentId).toBeUndefined();

    const emptyRegistry = buildAttachmentRegistry([]);
    const { nodes: withEmptyRegistry } = rewriteMediaRefs(nodes, resolved, emptyRegistry);
    expect((withEmptyRegistry[0] as { attachmentId?: number }).attachmentId).toBeUndefined();
  });

  it('rewrites a file link inside a list item to its resolved URL, keeping the rest of the item HTML intact', () => {
    const nodes: IRNode[] = [
      {
        kind: 'list',
        ordered: false,
        items: [
          '<strong><a href="https://old.example/wp-content/uploads/2026/08/report.pdf">The report</a></strong>',
          '<a href="https://old.example/page/">A normal page link, not a file</a>',
        ],
      },
    ];
    const resolved: Record<string, MediaResolution> = {
      'https://old.example/wp-content/uploads/2026/08/report.pdf': { outcome: 'matched-export', url: 'https://new-site.example/uploads/report.pdf' },
    };
    const { nodes: out, warnings } = rewriteMediaRefs(nodes, resolved);
    expect(out).toEqual([
      {
        kind: 'list',
        ordered: false,
        items: [
          '<strong><a href="https://new-site.example/uploads/report.pdf">The report</a></strong>',
          '<a href="https://old.example/page/">A normal page link, not a file</a>',
        ],
      },
    ]);
    expect(warnings).toEqual([]);
  });

  it('leaves an unresolved file link inside a list item untouched and reports a warning', () => {
    const nodes: IRNode[] = [
      { kind: 'list', ordered: false, items: ['<a href="https://old.example/wp-content/uploads/2026/08/missing.pdf">Missing</a>'] },
    ];
    const resolved: Record<string, MediaResolution> = {
      'https://old.example/wp-content/uploads/2026/08/missing.pdf': { outcome: 'unresolved', reason: 'not found' },
    };
    const { nodes: out, warnings } = rewriteMediaRefs(nodes, resolved);
    expect(out).toEqual(nodes);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('missing.pdf');
  });
});
