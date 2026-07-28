import type { IRNode } from '../../ir/nodes';
import type { ReadInput, ReadResult } from '../types';

const HEADING_RE = /^H([1-6])$/;
const CAPTION_SHORTCODE_RE = /\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/g;
const GALLERY_SHORTCODE_RE = /\[gallery([^\]]*)\]/g;

/** Phrasing content — text and these tags — is legal directly inside a
 * block-level container in real WordPress/WPBakery exports even without a
 * wrapping <p> (a classic-editor line break, a bare link, bold text before
 * the next real block). Treating each one as its own unrecognised top-level
 * block, or silently dropping bare text between elements, is what fragments
 * a normal paragraph into disconnected pieces — instead these are buffered
 * and flushed as one implicit paragraph. */
const INLINE_TAGS = new Set([
  'A', 'STRONG', 'EM', 'B', 'I', 'U', 'S', 'SPAN', 'BR', 'CODE', 'SUB', 'SUP', 'SMALL', 'MARK', 'ABBR', 'Q', 'CITE', 'TIME',
]);

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
    // Generic layout containers carry no Gutenberg-relevant meaning of
    // their own, but old-site page builders (WPBakery, Divi, plain theme
    // markup) wrap nearly everything in one — a <div> around a paragraph,
    // a <header> around an event's title block. Dumping the whole subtree
    // as one opaque raw-HTML blob (the old default-case behavior) loses
    // no content, but it both needlessly flags real, convertible content
    // for review and stops paragraphs/images inside from becoming real
    // blocks. Unwrapping and reading the children through the normal
    // pipeline instead handles the overwhelmingly common case; a
    // genuinely unrecognised leaf tag still falls through to the raw
    // default below.
    case 'DIV':
    case 'HEADER':
    case 'FOOTER':
    case 'SECTION':
    case 'ARTICLE':
    case 'ASIDE':
    case 'MAIN':
      return readChildNodes(el.childNodes, warnings);
    default: {
      const html = el.outerHTML.trim();
      if (!html) return [];
      warnings.push(`Unrecognised element <${tag.toLowerCase()}> — kept as raw HTML.`);
      return [{ kind: 'raw', html, note: `unknown element: ${tag.toLowerCase()}` }];
    }
  }
}

/** A blank line (2+ newlines, optionally with whitespace) is the only
 * paragraph break real classic-editor content gives us when it has no
 * wrapping <p> tags at all — the same signal WordPress's own `wpautop`
 * splits on at render time. Without this, an old post's several loose
 * paragraphs (and any images sitting between them) collapse into one
 * giant blob: every image loses its standalone `wp-block-image` wrapper
 * (and with it the CSS that constrains its width) and every caption/body
 * paragraph runs together with no break. */
const BLANK_LINE_RE = /\n\s*\n+/;

/** Splits a buffered run of bare text/inline-tag HTML on blank lines and
 * emits one node per chunk: a chunk that's only an image (optionally
 * wrapped in inline formatting/an anchor, exactly like the `<p>` image
 * -promotion case above) becomes a standalone image node; everything else
 * becomes a paragraph. */
function flushInlineChunks(html: string, nodes: IRNode[]): void {
  for (const chunk of html.split(BLANK_LINE_RE)) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    const doc = new DOMParser().parseFromString(`<body>${trimmed}</body>`, 'text/html');
    const imgs = Array.from(doc.body.querySelectorAll('img'));
    const textOnly = doc.body.textContent?.trim() ?? '';
    if (imgs.length > 0 && !textOnly) {
      for (const img of imgs) nodes.push(readImageElement(img));
    } else {
      nodes.push({ kind: 'paragraph', html: trimmed });
    }
  }
}

/** Walks a list of sibling DOM nodes (a document body, or the children of
 * an unwrapped generic container like <div>) into IR nodes: bare text and
 * inline-formatting tags are buffered and flushed as paragraphs (split on
 * blank lines, images promoted — see flushInlineChunks), and everything
 * else goes through readElement. Shared by the top-level document walk and
 * by container-unwrapping so nesting (a <div> inside a <div>) just recurses. */
function readChildNodes(childNodes: ArrayLike<ChildNode>, warnings: string[]): IRNode[] {
  const nodes: IRNode[] = [];

  let inlineBuffer = '';
  const flushInline = () => {
    const html = inlineBuffer;
    inlineBuffer = '';
    if (html.trim()) flushInlineChunks(html, nodes);
  };

  for (const child of Array.from(childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      inlineBuffer += child.textContent ?? '';
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as Element;
    if (INLINE_TAGS.has(el.tagName)) {
      inlineBuffer += el.outerHTML;
      continue;
    }
    flushInline();
    nodes.push(...readElement(el, warnings));
  }
  flushInline();

  return nodes;
}

/** The baseline reader: standard HTML elements plus the classic
 * [caption]/[gallery] shortcodes. Every other builder's `vc_column_text`
 * / `et_pb_text` / rich-text widget delegates its inner HTML here. */
export function readPlainHtml(input: ReadInput): ReadResult {
  const doc = new DOMParser().parseFromString(`<body>${preprocessShortcodes(input.contentHtml)}</body>`, 'text/html');
  const warnings: string[] = [];
  const nodes = readChildNodes(doc.body.childNodes, warnings);
  return { nodes, warnings };
}
