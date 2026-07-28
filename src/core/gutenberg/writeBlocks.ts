import type { ImageRef, IRNode } from '../ir/nodes';
import type { ConversionSettings } from '../../types/domain';
import { writeParagraph } from './blocks/paragraph';
import { writeHeading } from './blocks/heading';
import { writeList } from './blocks/list';
import { writeQuote } from './blocks/quote';
import { writeImage } from './blocks/image';
import { writeGallery } from './blocks/gallery';
import { writeButton } from './blocks/button';
import { writeFile } from './blocks/file';
import { writeVideo } from './blocks/video';
import { writeSeparator } from './blocks/separator';
import { writeSpacer } from './blocks/spacer';
import { writeColumns } from './blocks/columns';
import { writeTable } from './blocks/table';
import { writeRaw } from './blocks/raw';

function writeOne(node: IRNode, settings: ConversionSettings): string {
  switch (node.kind) {
    case 'paragraph':
      return writeParagraph(node);
    case 'heading':
      return writeHeading(node, settings);
    case 'list':
      return writeList(node);
    case 'quote':
      return writeQuote(node);
    case 'image':
      return writeImage(node, settings);
    case 'gallery':
      return writeGallery(node, settings);
    case 'button':
      return writeButton(node, settings);
    case 'file':
      return writeFile(node, settings);
    case 'video':
      return writeVideo(node);
    case 'separator':
      return writeSeparator();
    case 'spacer':
      return writeSpacer(node);
    case 'columns':
      return writeColumns(node, (inner) => writeBlocks(inner, settings));
    case 'table':
      return writeTable(node);
    case 'raw':
      return writeRaw(node);
  }
}

/** Groups runs of two or more consecutive standalone `image` nodes into a
 * single `gallery` node. A lone image between other content stays an
 * image — there's nothing to combine it with. */
function combineConsecutiveImages(nodes: IRNode[]): IRNode[] {
  const out: IRNode[] = [];
  let run: ImageRef[] = [];

  const flushRun = () => {
    if (run.length === 0) return;
    if (run.length === 1) {
      out.push({ kind: 'image', ...run[0] });
    } else {
      out.push({ kind: 'gallery', images: run });
    }
    run = [];
  };

  for (const node of nodes) {
    if (node.kind === 'image') {
      run.push({ src: node.src, alt: node.alt, caption: node.caption, href: node.href, width: node.width, height: node.height });
    } else {
      flushRun();
      out.push(node);
    }
  }
  flushRun();

  return out;
}

/** The only place Settings are read (per the design spec §5.5) — every
 * builder reader is settings-agnostic, and the preview calls this same
 * function on a fixture tree so it can never disagree with a real build. */
export function writeBlocks(nodes: IRNode[], settings: ConversionSettings): string {
  const effectiveNodes = settings.combineConsecutiveImages ? combineConsecutiveImages(nodes) : nodes;
  return effectiveNodes.map((node) => writeOne(node, settings)).join('\n\n');
}
