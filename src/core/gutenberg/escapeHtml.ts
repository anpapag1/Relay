/** Escapes text for use inside an HTML attribute value. IR `html` fields
 * are already-formed inline HTML (from a reader) and are never escaped
 * here — only plain strings a writer builds itself (alt text, captions
 * pulled from attributes, file names) go through this. */
export function escapeAttr(text: string | null | undefined): string {
  return (text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
