import type { IRNode } from '../../ir/nodes';
import type { ConversionSettings } from '../../../types/domain';
import { escapeAttr } from '../escapeHtml';

function writeFileButton(href: string, fileName: string): string {
  return `<!-- wp:file {"href":"${href}","fileName":"${escapeAttr(fileName)}"} -->\n<div class="wp-block-file"><a href="${href}">${fileName}</a><a href="${href}" class="wp-block-file__button" download>Download</a></div>\n<!-- /wp:file -->`;
}

function writeFileEmbed(href: string, fileName: string): string {
  return `<!-- wp:file {"href":"${href}","fileName":"${escapeAttr(fileName)}","displayPreview":true,"previewHeight":600} -->\n<div class="wp-block-file"><object class="wp-block-file__embed" data="${href}" type="application/pdf" style="width:100%;height:600px" aria-label="${escapeAttr(fileName)}"></object><a href="${href}">${fileName}</a><a href="${href}" class="wp-block-file__button" download>Download</a></div>\n<!-- /wp:file -->`;
}

/** pdfRender only distinguishes behaviour for PDFs (only they can be
 * embedded); every other file type always renders as a plain wp:file
 * button regardless of the setting. */
export function writeFile(
  node: Extract<IRNode, { kind: 'file' }>,
  settings: ConversionSettings,
): string {
  const href = escapeAttr(node.href);

  if (!node.isPdf) {
    return writeFileButton(href, node.fileName);
  }

  if (settings.pdfRender === 'link') {
    return `<!-- wp:paragraph -->\n<p><a href="${href}">${node.fileName}</a></p>\n<!-- /wp:paragraph -->`;
  }
  if (settings.pdfRender === 'embed') {
    return writeFileEmbed(href, node.fileName);
  }
  return writeFileButton(href, node.fileName);
}
