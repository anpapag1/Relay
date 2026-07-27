import type { ParsedAttachment } from '../../types/domain';

export interface AttachmentIndex {
  byUrl: Map<string, string>;
  byFilename: Map<string, string>;
  byPostId: Map<number, string>;
}

export function filenameOf(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/');
    return decodeURIComponent(segments[segments.length - 1] || '');
  } catch {
    const segments = url.split('/');
    return segments[segments.length - 1] || '';
  }
}

/** WordPress appends a size suffix to generated thumbnails
 * (`photo-150x150.jpg`); stripping it lets a reference to a specific
 * thumbnail match the original attachment. */
export function stripSizeSuffix(filename: string): string {
  return filename.replace(/-\d+x\d+(?=\.[a-zA-Z0-9]+$)/, '');
}

export function buildAttachmentIndex(attachments: ParsedAttachment[]): AttachmentIndex {
  const byUrl = new Map<string, string>();
  const byFilename = new Map<string, string>();
  const byPostId = new Map<number, string>();

  for (const attachment of attachments) {
    if (!attachment.attachmentUrl) continue;
    const url = attachment.attachmentUrl;

    byUrl.set(url, url);
    if (attachment.postId != null) byPostId.set(attachment.postId, url);

    const filename = filenameOf(url);
    if (filename && !byFilename.has(filename)) byFilename.set(filename, url);

    const stripped = stripSizeSuffix(filename);
    if (stripped && stripped !== filename && !byFilename.has(stripped)) byFilename.set(stripped, url);
  }

  return { byUrl, byFilename, byPostId };
}

/** Stage 1 of resolveMedia: match a reference against the export's own
 * attachment index only — exact URL, then filename, then filename with
 * the WordPress size suffix stripped. `ref` may also be an
 * `attachment:<id>` placeholder (emitted by readers, e.g. wpbakery's
 * vc_single_image, that only carry a numeric attachment ID), matched
 * directly against the attachment's wp:post_id. */
export function matchAttachment(index: AttachmentIndex, ref: string): string | null {
  const idMatch = /^attachment:(\d+)$/.exec(ref);
  if (idMatch) {
    return index.byPostId.get(Number(idMatch[1])) ?? null;
  }

  if (index.byUrl.has(ref)) return index.byUrl.get(ref) ?? null;

  const filename = filenameOf(ref);
  if (!filename) return null;
  if (index.byFilename.has(filename)) return index.byFilename.get(filename) ?? null;

  const stripped = stripSizeSuffix(filename);
  if (index.byFilename.has(stripped)) return index.byFilename.get(stripped) ?? null;

  return null;
}
