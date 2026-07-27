// Escaping and slug helpers shared by parseWxr and generateWxr. Kept in one
// file because the round-trip test (generate -> parse) only holds if both
// sides agree on exactly these rules.

/** The only sequence that can break out of a CDATA section is `]]>`; split
 * it so the literal text survives without corrupting the XML structure. */
export function cdataSafe(text: string | null | undefined): string {
  return (text ?? '').replace(/]]>/g, ']]]]><![CDATA[>');
}

export function cdata(tag: string, text: string | null | undefined): string {
  return `<${tag}><![CDATA[${cdataSafe(text)}]]></${tag}>`;
}

export function escapeXml(text: string | null | undefined): string {
  return (text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function slugify(text: string | null | undefined): string {
  const slug = (text || 'item')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || 'item';
}

/** dad.gr-proven pattern: pull the slug from the old permalink so it keeps
 * matching the source URL, instead of regenerating one from the title
 * (which collapses non-ASCII titles to almost nothing). Falls back to
 * slugify(title) when the link is missing or unparseable. */
export function slugFromLink(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    const segments = new URL(link).pathname.split('/').filter(Boolean);
    return segments.length ? decodeURIComponent(segments[segments.length - 1]) : null;
  } catch {
    return null;
  }
}

/** Reads the text of the first direct child element matching `name`,
 * matched by literal tag name since namespace-aware DOM lookup
 * (getElementsByTagNameNS) is unreliable across browsers for WXR's
 * wp:/dc:/content: prefixes. */
export function childText(el: Element, name: string): string | null {
  for (const child of Array.from(el.children)) {
    if (child.tagName === name) return child.textContent;
  }
  return null;
}

export function childrenByTag(el: Element, name: string): Element[] {
  return Array.from(el.children).filter((child) => child.tagName === name);
}
