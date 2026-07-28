import type { IRNode } from '../../ir/nodes';
import type { ReadInput, ReadResult } from '../types';
import { tokenizeShortcodes, textContent, type ShortcodeElement, type ShortcodeNode } from '../shortcode/tokenize';
import { readPlainHtml } from '../plainHtml/read';

const ROW_TAGS = new Set(['vc_row', 'vc_row_inner']);
const COLUMN_TAGS = new Set(['vc_column', 'vc_column_inner']);
// vc_icon is void: real WPBakery output never wraps it in a closing tag, so
// without this the tokenizer would swallow every following sibling shortcode
// as its "children" until an unrelated closing tag happened to pop it.
const VOID_TAGS = new Set(['vc_single_image', 'vc_gallery', 'vc_btn', 'vc_video', 'vc_separator', 'vc_empty_space', 'vc_icon']);

/** WPBakery encodes a button/link target as
 * `url:https%3A%2F%2Fx.com|title:Text|target:_blank` inside the `link`
 * attribute — this pulls the URL back out. */
function parseVcLinkUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const match = /url:([^|]+)/.exec(raw);
  if (!match) return raw;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function videoProvider(src: string): 'youtube' | 'vimeo' | 'file' {
  if (/youtube\.com|youtu\.be/i.test(src)) return 'youtube';
  if (/vimeo\.com/i.test(src)) return 'vimeo';
  return 'file';
}

function readColumn(el: ShortcodeElement, warnings: string[]): IRNode[] {
  return readChildren(el.children, warnings);
}

function readElement(el: ShortcodeElement, warnings: string[]): IRNode[] {
  if (ROW_TAGS.has(el.tag)) {
    const columnElements = el.children.filter(
      (child): child is ShortcodeElement => child.type === 'element' && COLUMN_TAGS.has(child.tag),
    );
    if (columnElements.length === 0) {
      // A row with no columns (rare, hand-edited markup) — treat its
      // children as one implicit column rather than losing the content.
      return readChildren(el.children, warnings);
    }
    return [{ kind: 'columns', columns: columnElements.map((col) => readColumn(col, warnings)) }];
  }

  if (COLUMN_TAGS.has(el.tag)) {
    return readColumn(el, warnings);
  }

  if (el.tag === 'vc_column_text') {
    return readChildren(el.children, warnings);
  }

  if (el.tag === 'vc_single_image') {
    const id = el.attrs.image;
    return [
      {
        kind: 'image',
        src: id ? `attachment:${id}` : '',
        alt: el.attrs.alt ?? '',
      },
    ];
  }

  if (el.tag === 'vc_gallery') {
    const ids = (el.attrs.images ?? '').split(',').map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) {
      warnings.push('vc_gallery with no image ids — kept as raw.');
      return [{ kind: 'raw', html: `[vc_gallery]`, note: 'vc_gallery with no images attribute' }];
    }
    return [{ kind: 'gallery', images: ids.map((id) => ({ src: `attachment:${id}`, alt: '' })) }];
  }

  if (el.tag === 'vc_btn') {
    const href = parseVcLinkUrl(el.attrs.link);
    const text = el.attrs.title || 'Learn more';
    if (!href) {
      warnings.push('vc_btn with no resolvable link — rendered as plain text.');
      return [{ kind: 'paragraph', html: text }];
    }
    return [{ kind: 'button', text, href }];
  }

  if (el.tag === 'vc_video') {
    const src = el.attrs.link ?? el.attrs.src ?? '';
    if (!src) {
      warnings.push('vc_video with no source — dropped.');
      return [];
    }
    return [{ kind: 'video', src, provider: videoProvider(src) }];
  }

  if (el.tag === 'vc_separator') {
    return [{ kind: 'separator' }];
  }

  if (el.tag === 'vc_empty_space') {
    const height = Number.parseInt(el.attrs.height ?? '', 10);
    return [{ kind: 'spacer', height: Number.isFinite(height) ? height : 20 }];
  }

  if (el.tag === 'vc_raw_html') {
    // WPBakery stores vc_raw_html's body as its real markup, URL-encoded
    // then base64-encoded, as the shortcode's text content (not an attr).
    const encoded = textContent(el.children).trim();
    if (!encoded) {
      warnings.push('vc_raw_html with no content — dropped.');
      return [];
    }
    try {
      const decoded = decodeURIComponent(atob(encoded));
      warnings.push('vc_raw_html decoded and kept as raw HTML.');
      return [{ kind: 'raw', html: decoded, note: 'vc_raw_html (decoded)' }];
    } catch {
      warnings.push('vc_raw_html payload could not be decoded — kept as raw shortcode text.');
      return [{ kind: 'raw', html: textFallback(el), note: 'vc_raw_html: undecodable payload' }];
    }
  }

  if (el.tag === 'caption') {
    // The classic WordPress [caption] shortcode is plain text, not real
    // shortcode syntax of WPBakery's own — but it uses the same
    // `[tag]...[/tag]` grammar, so the shared tokenizer parses it as just
    // another (unrecognised) element when it sits at the top level of
    // content:encoded rather than nested inside vc_column_text (where
    // readPlainHtml's own [caption] handling already covers it). Without
    // this case it fell to the generic fallback below, which only
    // serialises the shortcode's own tag/attrs — silently discarding the
    // image inside entirely.
    const inner = textContent(el.children);
    const imgMatch = /<img\b[^>]*>/i.exec(inner);
    if (!imgMatch) {
      warnings.push('caption shortcode with no <img> — kept as raw.');
      return [{ kind: 'raw', html: textFallback(el), note: 'caption shortcode without an image' }];
    }
    const captionText = inner
      .slice(imgMatch.index + imgMatch[0].length)
      .replace(/<[^>]+>/g, '')
      .trim();
    const result = readPlainHtml({ contentHtml: imgMatch[0], postmeta: {} });
    const imageNode = result.nodes.find((n): n is Extract<IRNode, { kind: 'image' }> => n.kind === 'image');
    if (!imageNode) {
      warnings.push('caption shortcode image could not be parsed — kept as raw.');
      return [{ kind: 'raw', html: textFallback(el), note: 'caption shortcode: image parse failed' }];
    }
    return [{ ...imageNode, caption: captionText || undefined }];
  }

  if (el.tag === 'vc_icon') {
    // A bare decorative icon glyph has no Gutenberg equivalent worth
    // fabricating; a linked one is functionally a button, just missing the
    // icon's own visual (icon fonts/SVGs aren't portable across builders).
    const href = parseVcLinkUrl(el.attrs.link);
    if (href) {
      warnings.push('vc_icon with a link converted to a button — the icon glyph itself is not preserved.');
      return [{ kind: 'button', text: el.attrs.title || 'Learn more', href }];
    }
    warnings.push('vc_icon dropped — decorative icon shortcode has no Gutenberg equivalent.');
    return [];
  }

  warnings.push(`Unrecognised WPBakery shortcode [${el.tag}] — kept as raw.`);
  return [{ kind: 'raw', html: textFallback(el), note: `unknown shortcode: ${el.tag}` }];
}

function textFallback(el: ShortcodeElement): string {
  const attrs = Object.entries(el.attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  return `[${el.tag}${attrs ? ` ${attrs}` : ''}]`;
}

function readChildren(nodes: ShortcodeNode[], warnings: string[]): IRNode[] {
  const out: IRNode[] = [];
  for (const node of nodes) {
    if (node.type === 'text') {
      if (!node.text.trim()) continue;
      const result = readPlainHtml({ contentHtml: node.text, postmeta: {} });
      warnings.push(...result.warnings);
      out.push(...result.nodes);
    } else {
      out.push(...readElement(node, warnings));
    }
  }
  return out;
}

/** Reads a WPBakery/Visual Composer shortcode tree into IR: vc_row/
 * vc_column become `columns`, vc_column_text delegates its inner HTML to
 * the plainHtml reader, and each recognised widget shortcode maps to one
 * IR node kind. Image/gallery shortcodes only carry an attachment ID, not
 * a URL, so their `src` is emitted as `attachment:<id>` — core/media's
 * resolveMedia (Task #5) is the layer that turns that into a real URL via
 * the WXR attachment index. */
export function readWpbakery(input: ReadInput): ReadResult {
  const tree = tokenizeShortcodes(input.contentHtml, VOID_TAGS);
  const warnings: string[] = [];
  const nodes = readChildren(tree, warnings);
  return { nodes, warnings };
}
