import type { IRNode } from '../../ir/nodes';
import type { ConversionSettings } from '../../../types/domain';
import { escapeAttr } from '../escapeHtml';

/** Strips a known document extension for display — a real Gutenberg-
 * inserted wp:file block shows the attached media's title, not its raw
 * filename with extension. Matches only recognised document extensions
 * (not any trailing `.xxx`) because `fileName` isn't always a real
 * filename — a `[pdf-embedder title="..."]`-sourced file uses the
 * shortcode's own human title here, which could otherwise get a genuine
 * trailing ".something" (e.g. "Report v2.5") wrongly truncated. */
function displayName(fileName: string): string {
  return fileName.replace(/\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z)$/i, '');
}

/** A real wp:file block's link carries a DOM id of this shape
 * (`wp-block-file--media-<uuid>`), assigned per block instance for
 * accessibility linking — it has no persisted meaning across rebuilds,
 * so a fresh random one each time matches how the block editor itself
 * behaves (a new client id every time the block is inserted). */
function randomBlockId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Matches the exact markup a real WordPress editor produces for an
 * inserted media-library file: a single link (no separate "Download"
 * button — real WordPress only adds that second link when the user
 * explicitly turns on "Show download button", which this migration never
 * does) plus, for a PDF rendered inline, a preview `<object>` ahead of
 * it. `id` in the block's JSON attrs is the file's migrated attachment id
 * (see rewriteMediaRefs) — set only once the file has actually been
 * resolved and registered, exactly like an image's `id`. pdfRender only
 * affects PDFs (only they can be embedded); every other file type always
 * renders as a plain link. */
export function writeFile(
  node: Extract<IRNode, { kind: 'file' }>,
  settings: ConversionSettings,
): string {
  const href = escapeAttr(node.href);
  const name = displayName(node.fileName);
  const displayPreview = node.isPdf && settings.pdfRender === 'embed';

  const attrs: Record<string, unknown> = {};
  if (node.attachmentId) attrs.id = node.attachmentId;
  attrs.href = node.href;
  attrs.showDownloadButton = false;
  attrs.displayPreview = displayPreview;

  const blockId = `wp-block-file--media-${randomBlockId()}`;
  const link = `<a id="${blockId}" href="${href}" target="_blank" rel="noreferrer noopener">${name}</a>`;
  const embed = displayPreview
    ? `<object class="wp-block-file__embed" data="${href}" type="application/pdf" style="width:100%;height:600px" aria-label="${escapeAttr(name)}"></object>`
    : '';

  return `<!-- wp:file ${JSON.stringify(attrs)} -->\n<div class="wp-block-file">${embed}${link}</div>\n<!-- /wp:file -->`;
}
