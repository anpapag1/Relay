import type { IRNode } from '../ir/nodes';
import type { MediaResolution } from '../../types/domain';
import type { AttachmentRegistry } from '../media/attachmentRegistry';

/** Walks an IR tree (recursing into columns) and collects every media
 * reference a reader emitted: image src/href, gallery image src/href,
 * and file href. Buttons and embedded videos are left alone — they link
 * to arbitrary pages, not downloadable media the WordPress importer
 * needs to fetch. */
export function collectMediaRefs(nodes: IRNode[]): string[] {
  const refs: string[] = [];

  const visit = (list: IRNode[]): void => {
    for (const node of list) {
      switch (node.kind) {
        case 'image':
          refs.push(node.src);
          if (node.href) refs.push(node.href);
          break;
        case 'gallery':
          for (const image of node.images) {
            refs.push(image.src);
            if (image.href) refs.push(image.href);
          }
          break;
        case 'file':
          refs.push(node.href);
          break;
        case 'columns':
          for (const column of node.columns) visit(column);
          break;
        default:
          break;
      }
    }
  };

  visit(nodes);
  return refs;
}

function resolveRef(ref: string, resolved: Record<string, MediaResolution>, warnings: string[]): string {
  const resolution = resolved[ref];
  if (!resolution) return ref;
  if (resolution.outcome === 'matched-export' || resolution.outcome === 'matched-live') {
    return resolution.url ?? ref;
  }
  const label = resolution.outcome === 'unreachable' ? 'the old site could not be reached' : 'no match found';
  warnings.push(`Unresolved media reference (${label}): ${ref}${resolution.reason ? ` — ${resolution.reason}` : ''}`);
  return ref;
}

/** Replaces every media reference in the tree with its resolved URL
 * (matched-export/matched-live); anything unresolved or unreachable is
 * left as the original reference (never fabricated) and reported as a
 * warning instead. When an `attachmentRegistry` is given (built once, up
 * front, across every article — see runBuild), a resolved image also
 * gets its `attachmentId` stamped on, so writeImage/writeGallery can emit
 * the `id`/`wp-image-<id>` a real WordPress-inserted image carries,
 * instead of the image floating unattached in the new post. */
export function rewriteMediaRefs(
  nodes: IRNode[],
  resolved: Record<string, MediaResolution>,
  attachmentRegistry?: AttachmentRegistry,
): { nodes: IRNode[]; warnings: string[] } {
  const warnings: string[] = [];
  const attachmentIdFor = (url: string): number | undefined => attachmentRegistry?.get(url)?.id;

  const visit = (list: IRNode[]): IRNode[] =>
    list.map((node): IRNode => {
      switch (node.kind) {
        case 'image': {
          const src = resolveRef(node.src, resolved, warnings);
          return {
            ...node,
            src,
            href: node.href ? resolveRef(node.href, resolved, warnings) : node.href,
            attachmentId: attachmentIdFor(src),
          };
        }
        case 'gallery':
          return {
            ...node,
            images: node.images.map((image) => {
              const src = resolveRef(image.src, resolved, warnings);
              return {
                ...image,
                src,
                href: image.href ? resolveRef(image.href, resolved, warnings) : image.href,
                attachmentId: attachmentIdFor(src),
              };
            }),
          };
        case 'file':
          return { ...node, href: resolveRef(node.href, resolved, warnings) };
        case 'columns':
          return { ...node, columns: node.columns.map(visit) };
        default:
          return node;
      }
    });

  return { nodes: visit(nodes), warnings };
}
