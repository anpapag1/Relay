import type { IRNode } from '../ir/nodes';
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
    case 'raw':
      return writeRaw(node);
  }
}

/** The only place Settings are read (per the design spec §5.5) — every
 * builder reader is settings-agnostic, and the preview calls this same
 * function on a fixture tree so it can never disagree with a real build. */
export function writeBlocks(nodes: IRNode[], settings: ConversionSettings): string {
  return nodes.map((node) => writeOne(node, settings)).join('\n\n');
}
