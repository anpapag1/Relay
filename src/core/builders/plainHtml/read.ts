import type { ImageRef, IRNode } from '../../ir/nodes';
import type { ReadInput, ReadResult, ReaderWarning } from '../types';

function warn(warnings: ReaderWarning[], message: string): void {
  warnings.push({ message, severity: 'review' });
}

const HEADING_RE = /^H([1-6])$/;
const CAPTION_SHORTCODE_RE = /\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/g;
const GALLERY_SHORTCODE_RE = /\[gallery([^\]]*)\]/g;
const VIDEO_SHORTCODE_RE = /\[video([^\]]*)\](?:[\s\S]*?\[\/video\])?/g;

function attrValue(attrsString: string, name: string): string | null {
  const match = new RegExp(`${name}=["']([^"']*)["']`).exec(attrsString);
  return match ? match[1] : null;
}

function videoProvider(src: string): 'youtube' | 'vimeo' | 'file' {
  if (/youtube\.com|youtu\.be/i.test(src)) return 'youtube';
  if (/vimeo\.com/i.test(src)) return 'vimeo';
  return 'file';
}

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
  out = out.replace(GALLERY_SHORTCODE_RE, (_full, attrs: string) => {
    const ids = attrValue(attrs, 'ids') ?? '';
    return `<div data-rl-gallery-ids="${escapeAttr(ids)}"></div>`;
  });
  out = out.replace(VIDEO_SHORTCODE_RE, (_full, attrs: string) => {
    const src = attrValue(attrs, 'src') ?? attrValue(attrs, 'mp4') ?? attrValue(attrs, 'm4v') ?? attrValue(attrs, 'webm') ?? attrValue(attrs, 'ogv') ?? attrValue(attrs, 'wmv') ?? attrValue(attrs, 'flv') ?? '';
    return `<div data-rl-video-src="${escapeAttr(src)}"></div>`;
  });
  return out;
}

function attrNumber(el: Element, name: string): number | undefined {
  const value = el.getAttribute(name);
  if (!value) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function imageRefFrom(img: Element): ImageRef {
  const parentAnchor = img.parentElement?.tagName === 'A' ? img.parentElement : null;
  return {
    src: img.getAttribute('src') ?? '',
    alt: img.getAttribute('alt') ?? '',
    href: parentAnchor?.getAttribute('href') ?? undefined,
    width: attrNumber(img, 'width'),
    height: attrNumber(img, 'height'),
  };
}

function readImageElement(img: Element, caption?: string): IRNode {
  return { kind: 'image', ...imageRefFrom(img), caption };
}

/** Recursively looks for an <img> that leads an element made only of
 * inline-formatting wrappers (A, STRONG, EM, ...) — e.g. a bare <img>, an
 * <a> wrapping just an <img>, or real-world WordPress markup like
 * `<strong><a><img></a>caption text</strong>` where a caption sentence
 * sits inside the same <strong> as the image, not as its own sibling.
 * Only the *first* element child of each wrapper is followed, since that
 * is the shape a leading image + trailing caption actually takes. Returns
 * the found <img> plus `restHtml` — the wrapper reconstructed with that
 * image (and its solo anchor, if any) removed, so trailing text keeps its
 * formatting instead of being dropped. */
function extractWrappedImage(el: Element): { img: Element; restHtml: string } | null {
  if (el.tagName === 'IMG') return { img: el, restHtml: '' };
  if (!INLINE_TAGS.has(el.tagName) || el.children.length === 0) return null;

  const nested = extractWrappedImage(el.children[0]);
  if (!nested) return null;

  const clone = el.cloneNode(true) as Element;
  clone.children[0].remove();
  const innerRest = nested.restHtml + clone.innerHTML;
  const restHtml = innerRest.trim() ? `<${el.tagName.toLowerCase()}>${innerRest}</${el.tagName.toLowerCase()}>` : '';
  return { img: nested.img, restHtml };
}

/** Splits a <p>'s children into standalone image node(s) plus the
 * surrounding text as separate paragraph(s), instead of keeping an <img>
 * (bare, or wrapped in inline formatting/a link-to-full-size <a>, however
 * deeply nested) embedded inside a single wp:paragraph block's HTML —
 * real WordPress content commonly has this shape (an image immediately
 * followed by a caption-like sentence, no blank line between them), and a
 * block-level image sitting inside a paragraph block is invalid Gutenberg
 * structure a real editor would never produce. Runs of non-image content
 * are buffered and flushed as one paragraph each, so a sentence split
 * across inline tags doesn't fragment into several. */
function splitInlineContent(childNodes: ArrayLike<ChildNode>): IRNode[] {
  const out: IRNode[] = [];
  let buffer = '';
  const flush = () => {
    const trimmed = buffer.trim();
    buffer = '';
    if (trimmed) out.push({ kind: 'paragraph', html: trimmed });
  };

  for (const child of Array.from(childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const wrapped = extractWrappedImage(el);
      if (wrapped) {
        flush();
        out.push(readImageElement(wrapped.img));
        if (wrapped.restHtml) buffer += wrapped.restHtml;
        continue;
      }
      buffer += el.outerHTML;
      continue;
    }
    buffer += child.textContent ?? '';
  }
  flush();

  return out;
}

/** A real WordPress gallery block is a `<figure class="wp-block-gallery">`
 * wrapping several nested `<figure class="wp-block-image"><img></figure>`
 * items, one per photo — structurally just an outer figure containing
 * more figures, which used to be indistinguishable from a single
 * captioned image here: `el.querySelector('img')` only ever finds the
 * *first* descendant image, silently dropping every other photo in the
 * gallery. Treating 2+ nested image-figures as a `gallery` node (each
 * paired with its own figcaption, if any) instead of a lone `image` node
 * is what actually preserves them all. */
function readFigure(el: Element, warnings: ReaderWarning[]): IRNode[] {
  const innerImageFigures = Array.from(el.querySelectorAll('figure')).filter((fig) => fig.querySelector('img'));
  if (innerImageFigures.length > 1) {
    const images: ImageRef[] = innerImageFigures.map((fig) => {
      const img = fig.querySelector('img') as Element;
      const caption = fig.querySelector('figcaption')?.textContent?.trim();
      return { ...imageRefFrom(img), caption: caption || undefined };
    });
    return [{ kind: 'gallery', images }];
  }

  const img = el.querySelector('img');
  if (!img) {
    warn(warnings, 'Unrecognised <figure> with no <img> — kept as raw HTML.');
    return [{ kind: 'raw', html: el.outerHTML, note: 'figure without an image' }];
  }
  const caption = el.getAttribute('data-rl-caption') ?? el.querySelector('figcaption')?.textContent?.trim() ?? undefined;
  return [readImageElement(img, caption || undefined)];
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

/** Mirrors splitInlineContent's leading-image extraction, but for
 * headings: old exported content sometimes wraps a photo in an <h2>/<h3>
 * (a leftover from a WYSIWYG editor using a heading tag for its styling,
 * not real heading text) — Gutenberg's text-only heading block can't
 * represent that, so the image needs to become its own standalone image
 * block. Any real heading text left after the image is removed stays a
 * heading of the same level; a heading left with no text at all is
 * dropped rather than emitted empty. */
function splitHeadingContent(childNodes: ArrayLike<ChildNode>, level: 1 | 2 | 3 | 4 | 5 | 6): IRNode[] {
  const out: IRNode[] = [];
  let buffer = '';
  const flush = () => {
    const trimmed = buffer.trim();
    buffer = '';
    if (trimmed) out.push({ kind: 'heading', level, html: trimmed });
  };

  for (const child of Array.from(childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const wrapped = extractWrappedImage(el);
      if (wrapped) {
        flush();
        out.push(readImageElement(wrapped.img));
        if (wrapped.restHtml) buffer += wrapped.restHtml;
        continue;
      }
      buffer += el.outerHTML;
      continue;
    }
    buffer += child.textContent ?? '';
  }
  flush();

  return out;
}

function readGalleryMarker(el: Element, warnings: ReaderWarning[]): IRNode {
  const idsAttr = el.getAttribute('data-rl-gallery-ids') ?? '';
  const ids = idsAttr.split(',').map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) {
    warn(warnings, 'Classic [gallery] shortcode with no ids attribute — kept as raw, never fabricating a URL.');
    return { kind: 'raw', html: '[gallery]', note: 'classic [gallery] shortcode with no ids attribute' };
  }
  return { kind: 'gallery', images: ids.map((id) => ({ src: `attachment:${id}`, alt: '' })) };
}

function readVideoMarker(el: Element, warnings: ReaderWarning[]): IRNode {
  const src = el.getAttribute('data-rl-video-src') ?? '';
  if (!src) {
    warn(warnings, 'Classic [video] shortcode with no resolvable source — kept as raw.');
    return { kind: 'raw', html: '[video]', note: 'classic [video] shortcode with no src/mp4/etc. attribute' };
  }
  return { kind: 'video', src, provider: videoProvider(src) };
}

function readElement(el: Element, warnings: ReaderWarning[]): IRNode[] {
  if (el.hasAttribute('data-rl-gallery-ids')) return [readGalleryMarker(el, warnings)];
  if (el.hasAttribute('data-rl-video-src')) return [readVideoMarker(el, warnings)];

  const tag = el.tagName;
  const headingMatch = HEADING_RE.exec(tag);
  if (headingMatch) {
    const level = Number(headingMatch[1]) as 1 | 2 | 3 | 4 | 5 | 6;
    if (el.querySelector('img')) {
      return splitHeadingContent(el.childNodes, level);
    }
    return [{ kind: 'heading', level, html: el.innerHTML.trim() }];
  }

  switch (tag) {
    case 'P': {
      // A <p> containing any image — whether it's the paragraph's entire
      // content or mixed in with real text — gets that image split out
      // into its own standalone block instead of nested (illegally, in
      // Gutenberg terms) inside a wp:paragraph block.
      const imgs = el.querySelectorAll('img');
      if (imgs.length > 0) {
        return splitInlineContent(el.childNodes);
      }
      return [{ kind: 'paragraph', html: el.innerHTML.trim() }];
    }
    case 'FIGURE':
      return readFigure(el, warnings);
    case 'IMG':
      return [readImageElement(el)];
    case 'UL':
    case 'OL':
      return [readList(el)];
    case 'BLOCKQUOTE':
      return [readBlockquote(el)];
    case 'HR':
      return [{ kind: 'separator' }];
    case 'TABLE':
      // Gutenberg's table block is just the original <table> wrapped in a
      // figure (see writeTable) — no restructuring, so this is safe even
      // for exotic colspan/rowspan layouts.
      return [{ kind: 'table', html: el.outerHTML.trim() }];
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
      warn(warnings, `Unrecognised element <${tag.toLowerCase()}> — kept as raw HTML.`);
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
function readChildNodes(childNodes: ArrayLike<ChildNode>, warnings: ReaderWarning[]): IRNode[] {
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
  const warnings: ReaderWarning[] = [];
  const nodes = readChildNodes(doc.body.childNodes, warnings);
  return { nodes, warnings };
}
