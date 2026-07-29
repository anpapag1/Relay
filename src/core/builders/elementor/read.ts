import type { IRNode } from '../../ir/nodes';
import type { ReadInput, ReadResult, ReaderWarning } from '../types';
import { readPlainHtml } from '../plainHtml/read';

function warn(warnings: ReaderWarning[], message: string): void {
  warnings.push({ message, severity: 'review' });
}

interface ElementorNode {
  id?: string;
  elType?: string;
  widgetType?: string;
  settings?: Record<string, unknown>;
  elements?: ElementorNode[];
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function num(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function headingLevel(headerSize: unknown): 1 | 2 | 3 | 4 | 5 | 6 {
  const match = /^h([1-6])$/.exec(str(headerSize));
  return (match ? Number(match[1]) : 2) as 1 | 2 | 3 | 4 | 5 | 6;
}

function videoProvider(type: string): 'youtube' | 'vimeo' | 'file' {
  if (type === 'youtube') return 'youtube';
  if (type === 'vimeo') return 'vimeo';
  return 'file';
}

function readWidget(node: ElementorNode, warnings: ReaderWarning[]): IRNode[] {
  const settings = node.settings ?? {};

  switch (node.widgetType) {
    case 'text-editor': {
      const html = str(settings.editor);
      if (!html.trim()) return [];
      const result = readPlainHtml({ contentHtml: html, postmeta: {} });
      warnings.push(...result.warnings);
      return result.nodes;
    }
    case 'heading': {
      const title = str(settings.title);
      if (!title) return [];
      return [{ kind: 'heading', level: headingLevel(settings.header_size), html: title }];
    }
    case 'image': {
      const image = (settings.image ?? {}) as { url?: unknown; alt?: unknown };
      const src = str(image.url);
      if (!src) {
        warn(warnings, 'Elementor image widget with no url — dropped.');
        return [];
      }
      return [{ kind: 'image', src, alt: str(image.alt) }];
    }
    case 'image-gallery': {
      const gallery = (settings.gallery ?? []) as Array<{ url?: unknown; alt?: unknown }>;
      const images = gallery.filter((item) => str(item.url)).map((item) => ({ src: str(item.url), alt: str(item.alt) }));
      if (images.length === 0) {
        warn(warnings, 'Elementor image-gallery widget with no images — dropped.');
        return [];
      }
      return [{ kind: 'gallery', images }];
    }
    case 'button': {
      const link = (settings.link ?? {}) as { url?: unknown };
      const href = str(link.url);
      const text = str(settings.text) || 'Learn more';
      if (!href) {
        warn(warnings, 'Elementor button widget with no link url — rendered as plain text.');
        return [{ kind: 'paragraph', html: text }];
      }
      return [{ kind: 'button', text, href }];
    }
    case 'video': {
      const type = str(settings.video_type) || 'youtube';
      const src =
        type === 'youtube'
          ? str(settings.youtube_url)
          : type === 'vimeo'
            ? str(settings.vimeo_url)
            : str((settings.hosted_url as { url?: unknown } | undefined)?.url);
      if (!src) {
        warn(warnings, 'Elementor video widget with no resolvable source — dropped.');
        return [];
      }
      return [{ kind: 'video', src, provider: videoProvider(type) }];
    }
    case 'divider':
      return [{ kind: 'separator' }];
    case 'spacer': {
      const size = num((settings.space as { size?: unknown } | undefined)?.size);
      return [{ kind: 'spacer', height: size ?? 20 }];
    }
    default:
      warn(warnings, `Unrecognised Elementor widget "${node.widgetType ?? 'unknown'}" — kept as raw.`);
      return [{ kind: 'raw', html: '', note: `unknown elementor widget: ${node.widgetType ?? 'unknown'}` }];
  }
}

function readNode(node: ElementorNode, warnings: ReaderWarning[]): IRNode[] {
  if (node.elType === 'section') {
    const columns = (node.elements ?? []).filter((child) => child.elType === 'column');
    if (columns.length === 0) return readChildren(node.elements ?? [], warnings);

    // See wpbakery/read.ts's identical handling: a genuinely empty column
    // carries no meaning of its own, and a section left with only one
    // populated column after dropping empty ones isn't a real
    // multi-column layout — flatten it to that column's content directly.
    const nonEmptyColumns = columns.map((col) => readChildren(col.elements ?? [], warnings)).filter((column) => column.length > 0);
    if (nonEmptyColumns.length === 0) return [];
    if (nonEmptyColumns.length === 1) return nonEmptyColumns[0];
    return [{ kind: 'columns', columns: nonEmptyColumns }];
  }
  if (node.elType === 'column') {
    return readChildren(node.elements ?? [], warnings);
  }
  if (node.elType === 'widget') {
    return readWidget(node, warnings);
  }
  return readChildren(node.elements ?? [], warnings);
}

function readChildren(nodes: ElementorNode[], warnings: ReaderWarning[]): IRNode[] {
  return nodes.flatMap((node) => readNode(node, warnings));
}

/** Reads the `_elementor_data` postmeta JSON tree into IR: section/column
 * collapse into `columns`, and each widget maps by `widgetType`. When the
 * postmeta is missing or unparseable (e.g. the export stripped it), falls
 * back to running the plainHtml reader against the rendered
 * content:encoded instead of failing the article. */
export function readElementor(input: ReadInput): ReadResult {
  const raw = input.postmeta['_elementor_data'];
  if (!raw) {
    const result = readPlainHtml(input);
    return { nodes: result.nodes, warnings: [...result.warnings, { message: 'No _elementor_data postmeta — fell back to plain HTML content.', severity: 'review' }] };
  }

  let tree: ElementorNode[];
  try {
    tree = JSON.parse(raw) as ElementorNode[];
  } catch {
    const result = readPlainHtml(input);
    return { nodes: result.nodes, warnings: [...result.warnings, { message: '_elementor_data was not valid JSON — fell back to plain HTML content.', severity: 'review' }] };
  }

  const warnings: ReaderWarning[] = [];
  const nodes = readChildren(tree, warnings);
  return { nodes, warnings };
}
