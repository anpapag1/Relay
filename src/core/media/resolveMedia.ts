import type { MediaResolution } from '../../types/domain';
import { buildAttachmentIndex, filenameOf, matchAttachment, stripSizeSuffix, type AttachmentIndex } from './attachmentIndex';
import { fetchPageMedia, type FetchLike, type PageMediaResult } from './mediaClient';
import type { ParsedAttachment } from '../../types/domain';

export interface ResolveMediaOptions {
  attachments: ParsedAttachment[];
  articleUrl: string | null;
  liveFetchEnabled: boolean;
  fetchImpl: FetchLike;
}

function matchLive(media: PageMediaResult, ref: string): string | null {
  const candidates = [media.ogImage, ...media.images, ...media.files].filter((v): v is string => Boolean(v));
  const refFilename = filenameOf(ref.startsWith('attachment:') ? '' : ref);

  for (const candidate of candidates) {
    if (candidate === ref) return candidate;
  }
  if (!refFilename) return null;
  const strippedRefFilename = stripSizeSuffix(refFilename);
  for (const candidate of candidates) {
    const candidateFilename = filenameOf(candidate);
    if (candidateFilename === refFilename || stripSizeSuffix(candidateFilename) === strippedRefFilename) {
      return candidate;
    }
  }
  return null;
}

function resolveStage1(index: AttachmentIndex, refs: string[]): Map<string, MediaResolution> {
  const resolved = new Map<string, MediaResolution>();
  for (const ref of refs) {
    const url = matchAttachment(index, ref);
    if (url) resolved.set(ref, { outcome: 'matched-export', url });
  }
  return resolved;
}

/** Resolves every media reference (`<img src>` URL, file `href`, or an
 * `attachment:<id>` placeholder a reader emitted) for one article. Stage 1
 * matches against the WXR's own attachment index; anything left over
 * falls through to a single live fetch of the article's old-site page
 * (stage 2), opted into per session via `liveFetchEnabled`. See design
 * spec §5.6 for the four possible outcomes. */
export async function resolveMediaRefs(refs: string[], options: ResolveMediaOptions): Promise<Record<string, MediaResolution>> {
  const uniqueRefs = Array.from(new Set(refs));
  const index = buildAttachmentIndex(options.attachments);
  const resolved = resolveStage1(index, uniqueRefs);

  const remaining = uniqueRefs.filter((ref) => !resolved.has(ref));
  if (remaining.length === 0) {
    return Object.fromEntries(resolved);
  }

  if (!options.liveFetchEnabled || !options.articleUrl) {
    for (const ref of remaining) {
      resolved.set(ref, { outcome: 'unresolved', reason: 'Not in the export; live media lookup is disabled or the article has no known URL.' });
    }
    return Object.fromEntries(resolved);
  }

  const pageMedia = await fetchPageMedia(options.articleUrl, options.fetchImpl);
  if (!pageMedia.ok) {
    const reason =
      pageMedia.reason === 'refused'
        ? 'The media proxy refused to fetch this URL.'
        : 'The old site could not be reached.';
    for (const ref of remaining) {
      resolved.set(ref, { outcome: 'unreachable', reason });
    }
    return Object.fromEntries(resolved);
  }

  for (const ref of remaining) {
    const url = matchLive(pageMedia.media, ref);
    if (url) {
      resolved.set(ref, { outcome: 'matched-live', url });
    } else {
      resolved.set(ref, { outcome: 'unresolved', reason: 'Not found in the export or on the live page.' });
    }
  }

  return Object.fromEntries(resolved);
}
