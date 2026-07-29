import type { IRNode } from '../../ir/nodes';
import type { ReadInput, ReadResult, ReaderWarning } from '../types';
import { tokenizeShortcodes, type ShortcodeElement, type ShortcodeNode } from '../shortcode/tokenize';
import { readPlainHtml } from '../plainHtml/read';

function warn(warnings: ReaderWarning[], message: string): void {
  warnings.push({ message, severity: 'review' });
}

const VOID_TAGS = new Set(['et_pb_image', 'et_pb_gallery', 'et_pb_button', 'et_pb_video', 'et_pb_divider']);

function decodeDiviAttr(value: string | undefined): string {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function videoProvider(src: string): 'youtube' | 'vimeo' | 'file' {
  if (/youtube\.com|youtu\.be/i.test(src)) return 'youtube';
  if (/vimeo\.com/i.test(src)) return 'vimeo';
  return 'file';
}

function readColumn(el: ShortcodeElement, warnings: ReaderWarning[]): IRNode[] {
  return readChildren(el.children, warnings);
}

function readElement(el: ShortcodeElement, warnings: ReaderWarning[]): IRNode[] {
  if (el.tag === 'et_pb_section') {
    return readChildren(el.children, warnings);
  }

  if (el.tag === 'et_pb_row') {
    const columnElements = el.children.filter(
      (child): child is ShortcodeElement => child.type === 'element' && child.tag === 'et_pb_column',
    );
    if (columnElements.length === 0) return readChildren(el.children, warnings);

    // See wpbakery/read.ts's identical handling: a genuinely empty column
    // carries no meaning of its own, and a row left with only one
    // populated column after dropping empty ones isn't a real
    // multi-column layout — flatten it to that column's content directly.
    const nonEmptyColumns = columnElements.map((col) => readColumn(col, warnings)).filter((column) => column.length > 0);
    if (nonEmptyColumns.length === 0) return [];
    if (nonEmptyColumns.length === 1) return nonEmptyColumns[0];
    return [{ kind: 'columns', columns: nonEmptyColumns }];
  }

  if (el.tag === 'et_pb_column') {
    return readColumn(el, warnings);
  }

  if (el.tag === 'et_pb_text') {
    return readChildren(el.children, warnings);
  }

  if (el.tag === 'et_pb_image') {
    const src = decodeDiviAttr(el.attrs.src);
    if (!src) {
      warn(warnings, 'et_pb_image with no src — dropped.');
      return [];
    }
    return [
      {
        kind: 'image',
        src,
        alt: decodeDiviAttr(el.attrs.alt),
        href: el.attrs.url ? decodeDiviAttr(el.attrs.url) : undefined,
      },
    ];
  }

  if (el.tag === 'et_pb_gallery') {
    const ids = decodeDiviAttr(el.attrs.gallery_ids)
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      warn(warnings, 'et_pb_gallery with no gallery_ids — kept as raw.');
      return [{ kind: 'raw', html: '[et_pb_gallery]', note: 'et_pb_gallery with no gallery_ids attribute' }];
    }
    return [{ kind: 'gallery', images: ids.map((id) => ({ src: `attachment:${id}`, alt: '' })) }];
  }

  if (el.tag === 'et_pb_button') {
    const href = decodeDiviAttr(el.attrs.button_url);
    const text = decodeDiviAttr(el.attrs.button_text) || 'Learn more';
    if (!href) {
      warn(warnings, 'et_pb_button with no button_url — rendered as plain text.');
      return [{ kind: 'paragraph', html: text }];
    }
    return [{ kind: 'button', text, href }];
  }

  if (el.tag === 'et_pb_video') {
    const src = decodeDiviAttr(el.attrs.src);
    if (!src) {
      warn(warnings, 'et_pb_video with no src — dropped.');
      return [];
    }
    return [{ kind: 'video', src, provider: videoProvider(src) }];
  }

  if (el.tag === 'et_pb_divider') {
    return [{ kind: 'separator' }];
  }

  warn(warnings, `Unrecognised Divi shortcode [${el.tag}] — kept as raw.`);
  return [{ kind: 'raw', html: `[${el.tag}]`, note: `unknown shortcode: ${el.tag}` }];
}

function readChildren(nodes: ShortcodeNode[], warnings: ReaderWarning[]): IRNode[] {
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

/** Reads a Divi Builder shortcode tree into IR, using the same tokenizer
 * as wpbakery (both share the `[tag attr="v"]...[/tag]` grammar).
 * et_pb_section/et_pb_row/et_pb_column all collapse into `columns`;
 * et_pb_text delegates to the plainHtml reader; attribute values are
 * percent-decoded since Divi commonly encodes them. */
export function readDivi(input: ReadInput): ReadResult {
  const tree = tokenizeShortcodes(input.contentHtml, VOID_TAGS);
  const warnings: ReaderWarning[] = [];
  const nodes = readChildren(tree, warnings);
  return { nodes, warnings };
}
