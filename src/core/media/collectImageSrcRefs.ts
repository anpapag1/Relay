import type { IRNode } from '../ir/nodes';

/** Walks an IR tree (recursing into columns) and collects only actual image
 * `src` values — the `image`/`gallery` node's `src`, never a `file` node's
 * `href` (a PDF/doc, not an image) and never an `image`/`gallery` node's
 * `href` (a link destination the image points to when clicked, which can be
 * any URL — an article, a different file, anything — not necessarily an
 * image itself). Existing `collectMediaRefs` intentionally mixes all of
 * these together for build-time rewriting; this collector exists
 * specifically for the image health check, which must only ever probe URLs
 * it's safe to expect an `image/*` response from. */
export function collectImageSrcRefs(nodes: IRNode[]): string[] {
  const refs: string[] = [];

  const visit = (list: IRNode[]): void => {
    for (const node of list) {
      switch (node.kind) {
        case 'image':
          refs.push(node.src);
          break;
        case 'gallery':
          for (const image of node.images) refs.push(image.src);
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
