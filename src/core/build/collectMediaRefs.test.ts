import { describe, expect, it } from 'vitest';
import { collectMediaRefs, rewriteMediaRefs } from './collectMediaRefs';
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
});
