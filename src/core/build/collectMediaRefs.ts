import type { IRNode } from '../ir/nodes';
import type { MediaResolution } from '../../types/domain';
import type { AttachmentRegistry } from '../media/attachmentRegistry';
import { filenameOf, stripSizeSuffix } from '../media/attachmentIndex';

/** True if two URLs point at the same underlying WordPress attachment —
 * either literally the same URL, or one is a generated thumbnail of the
 * other (`photo-1024x682.jpg` vs `photo.jpg`, the classic "linked to its
 * own full-size original" wrapper: `<a href="photo.jpg"><img
 * src="photo-1024x682.jpg">`). Reuses the same size-suffix stripping
 * resolveMedia already uses to match a thumbnail ref against its
 * attachment. */
function isSameAttachment(a: string, b: string): boolean {
  if (a === b) return true;
  return stripSizeSuffix(filenameOf(a)) === stripSizeSuffix(filenameOf(b));
}

/** Matches a downloadable-document extension in an href value — the same
 * set plainHtml's reader promotes to a standalone wp:file block, but here
 * applied to a link staying inline (see listFileHrefs). */
const LIST_FILE_EXTENSION_RE = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z)(?:[?#]|$)/i;
/** Finds every `<a href="...">` in a list item's raw HTML (list items are
 * never parsed into their own image/file IR nodes the way a paragraph's
 * children are — see readList — so a document link buried in a bullet
 * point, e.g. `<li><a href="report.pdf">Report</a></li>`, would otherwise
 * never enter the media pipeline at all: never resolved, never migrated,
 * left pointing at the old site forever with no warning either). */
const LIST_ANCHOR_HREF_RE = /<a\b[^>]*\bhref=(["'])(.*?)\1[^>]*>/gi;

function listFileHrefs(html: string): string[] {
  const hrefs: string[] = [];
  for (const match of html.matchAll(LIST_ANCHOR_HREF_RE)) {
    const href = match[2];
    if (LIST_FILE_EXTENSION_RE.test(href)) hrefs.push(href);
  }
  return hrefs;
}

/** Walks an IR tree (recursing into columns) and collects every media
 * reference a reader emitted: image src/href, gallery image src/href,
 * and file href. Buttons and embedded videos are left alone — they link
 * to arbitrary pages, not downloadable media the WordPress importer
 * needs to fetch.
 *
 * An image's `href` is only pushed when it's a genuinely different
 * attachment from its `src` — two hugely common real-world patterns both
 * link an image to itself, not to a second file: `<a href="photo.jpg">
 * <img src="photo.jpg">` (identical URL), and `<a href="photo.jpg"><img
 * src="photo-1024x682.jpg">` (a WordPress-generated thumbnail of the
 * same original). Counting either as two media items inflated the
 * Articles list's Media column (and every count/build step reading this
 * list) well past the article's real photo count. */
export function collectMediaRefs(nodes: IRNode[]): string[] {
  const refs: string[] = [];

  const visit = (list: IRNode[]): void => {
    for (const node of list) {
      switch (node.kind) {
        case 'image':
          refs.push(node.src);
          if (node.href && !isSameAttachment(node.href, node.src)) refs.push(node.href);
          break;
        case 'gallery':
          for (const image of node.images) {
            refs.push(image.src);
            if (image.href && !isSameAttachment(image.href, image.src)) refs.push(image.href);
          }
          break;
        case 'file':
          refs.push(node.href);
          break;
        case 'list':
          for (const item of node.items) refs.push(...listFileHrefs(item));
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
 * front, across every article — see runBuild), a resolved image or file
 * also gets its `attachmentId` stamped on, so writeImage/writeGallery/
 * writeFile can emit the `id`/`wp-image-<id>` a real WordPress-inserted
 * attachment carries, instead of floating unattached in the new post. */
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
        case 'file': {
          const href = resolveRef(node.href, resolved, warnings);
          return { ...node, href, attachmentId: attachmentIdFor(href) };
        }
        case 'list':
          return {
            ...node,
            items: node.items.map((item) =>
              item.replace(LIST_ANCHOR_HREF_RE, (full, _quote: string, href: string) =>
                LIST_FILE_EXTENSION_RE.test(href) ? full.replace(href, resolveRef(href, resolved, warnings)) : full,
              ),
            ),
          };
        case 'columns':
          return { ...node, columns: node.columns.map(visit) };
        default:
          return node;
      }
    });

  return { nodes: visit(nodes), warnings };
}
