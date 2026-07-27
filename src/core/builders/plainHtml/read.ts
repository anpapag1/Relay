import type { IRNode } from '../../ir/nodes';
import type { ReadInput, ReadResult } from '../types';

const HEADING_RE = /^H([1-6])$/;
const CAPTION_SHORTCODE_RE = /\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/g;
const GALLERY_SHORTCODE_RE = /\[gallery([^\]]*)\]/g;

function escapeAttr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** WordPress classic shortcodes ([caption], [gallery]) are plain text
 * inside content:encoded, not HTML — rewritten to inert markers before
 * DOMParser sees them so the walk below can treat them uniformly with
 * real elements. */
function preprocessShortcodes(html: string): string {
  let out = html.replace(CAPTION_SHORTCODE_RE, (full, inner: string) => {
    const imgMatch = /<img\b[^>]*>/i.exec(inner);
    if (!imgMatch) return full;
    const captionText = inner
      .slice(imgMatch.index + imgMatch[0].length)
      .replace(/<[^>]+>/g, '')
      .trim();
    return `<figure data-rl-caption="${escapeAttr(captionText)}">${imgMatch[0]}</figure>`;
  });
  out = out.replace(GALLERY_SHORTCODE_RE, (full) => `<div data-rl-gallery-shortcode="${escapeAttr(full)}"></div>`);
  return out;
}

function attrNumber(el: Element, name: string): number | undefined {
  const value = el.getAttribute(name);
  if (!value) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function readImageElement(img: Element, caption?: string): IRNode {
  const parentAnchor = img.parentElement?.tagName === 'A' ? img.parentElement : null;
  return {
    kind: 'image',
    src: img.getAttribute('src') ?? '',
    alt: img.getAttribute('alt') ?? '',
    caption,
    href: parentAnchor?.getAttribute('href') ?? undefined,
    width: attrNumber(img, 'width'),
    height: attrNumber(img, 'height'),
  };
}

function readFigure(el: Element, warnings: string[]): IRNode | null {
  const img = el.querySelector('img');
  if (!img) {
    warnings.push('Unrecognised <figure> with no <img> — kept as raw HTML.');
    return { kind: 'raw', html: el.outerHTML, note: 'figure without an image' };
  }
  const caption = el.getAttribute('data-rl-caption') ?? el.querySelector('figcaption')?.textContent?.trim() ?? undefined;
  return readImageElement(img, caption || undefined);
}

function readList(el: Element): IRNode {
  const ordered = el.tagName === 'OL';
  const items = Array.from(el.children)
    .filter((child) => child.tagName === 'LI')
    .map((li) => li.innerHTML.trim());
  return { kind: 'list', ordered, items };
}

function readBlockquote(el: Element): IRNode {
  const cite = el.querySelector('cite')?.textContent?.trim();
  const clone = el.cloneNode(true) as Element;
  clone.querySelector('cite')?.remove();
  return { kind: 'quote', html: clone.innerHTML.trim(), cite: cite || undefined };
}

function readGalleryMarker(el: Element, warnings: string[]): IRNode {
  const shortcode = el.getAttribute('data-rl-gallery-shortcode') ?? '[gallery]';
  warnings.push(`Classic gallery shortcode kept as raw HTML — no attachment ID resolution available: ${shortcode}`);
  return { kind: 'raw', html: shortcode, note: 'classic [gallery] shortcode: attachment IDs cannot be resolved to URLs by the reader' };
}

function readElement(el: Element, warnings: string[]): IRNode[] {
  if (el.hasAttribute('data-rl-gallery-shortcode')) return [readGalleryMarker(el, warnings)];

  const tag = el.tagName;
  const headingMatch = HEADING_RE.exec(tag);
  if (headingMatch) {
    return [{ kind: 'heading', level: Number(headingMatch[1]) as 1 | 2 | 3 | 4 | 5 | 6, html: el.innerHTML.trim() }];
  }

  switch (tag) {
    case 'P': {
      // A <p> whose entire content is one or more images becomes standalone
      // image blocks instead of an image nested (illegally, in Gutenberg
      // terms) inside a paragraph block.
      const imgs = Array.from(el.querySelectorAll('img'));
      const textOnly = el.textContent?.trim() ?? '';
      if (imgs.length > 0 && !textOnly) {
        return imgs.map((img) => readImageElement(img));
      }
      return [{ kind: 'paragraph', html: el.innerHTML.trim() }];
    }
    case 'FIGURE': {
      const node = readFigure(el, warnings);
      return node ? [node] : [];
    }
    case 'IMG':
      return [readImageElement(el)];
    case 'UL':
    case 'OL':
      return [readList(el)];
    case 'BLOCKQUOTE':
      return [readBlockquote(el)];
    case 'HR':
      return [{ kind: 'separator' }];
    default: {
      const html = el.outerHTML.trim();
      if (!html) return [];
      warnings.push(`Unrecognised element <${tag.toLowerCase()}> — kept as raw HTML.`);
      return [{ kind: 'raw', html, note: `unknown element: ${tag.toLowerCase()}` }];
    }
  }
}

/** The baseline reader: standard HTML elements plus the classic
 * [caption]/[gallery] shortcodes. Every other builder's `vc_column_text`
 * / `et_pb_text` / rich-text widget delegates its inner HTML here. */
export function readPlainHtml(input: ReadInput): ReadResult {
  const doc = new DOMParser().parseFromString(`<body>${preprocessShortcodes(input.contentHtml)}</body>`, 'text/html');
  const warnings: string[] = [];
  const nodes: IRNode[] = [];

  for (const child of Array.from(doc.body.children)) {
    nodes.push(...readElement(child, warnings));
  }

  return { nodes, warnings };
}
