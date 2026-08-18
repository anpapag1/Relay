/** Decodes the common HTML character references. Used on title text read from
 * XML/CDATA: WordPress exports wrap titles in CDATA where character references
 * are NOT decoded by the XML parser, so a title that was entity-encoded before
 * export (e.g. `×` written as `&#215;`) would otherwise surface literally. */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, '\u00a0');
}