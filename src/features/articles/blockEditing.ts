export type EditableBlockKind = 'p' | 'heading' | 'li' | 'quote-p';

export const EDITABLE_SELECTOR = 'p, h2, h3, h4, h5, h6, li, blockquote > p';

export function classifyBlock(el: Element): EditableBlockKind | null {
  const tag = el.tagName.toLowerCase();
  if (tag === 'p') {
    const parent = el.parentElement;
    if (parent && parent.classList.contains('wp-block-quote')) return 'quote-p';
    return 'p';
  }
  if (/^h[2-6]$/.test(tag)) return 'heading';
  if (tag === 'li') return 'li';
  return null;
}

export function isEditableBlock(el: Element): boolean {
  return classifyBlock(el) !== null;
}

export function caretOffsetIn(el: Element): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.anchorNode) {
    return (el.textContent ?? '').length;
  }
  const range = sel.getRangeAt(0);
  const pre = range.cloneRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  return pre.toString().length;
}

export function collapsedAtStart(el: Element): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.anchorNode) return false;
  const range = sel.getRangeAt(0);
  if (!range.collapsed) return false;
  if (!el.contains(sel.anchorNode)) return false;
  return caretOffsetIn(el) === 0;
}

export function singleOccurrenceIndex(root: Element, blockEl: Element, needle?: string): number {
  const target = needle ?? blockEl.outerHTML;
  let n = 0;
  for (const el of root.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR)) {
    if (el === blockEl) return n;
    if (el.outerHTML === target) n += 1;
  }
  return n;
}

export function elementOccurrenceIndex(root: Element, el: Element): number {
  const needle = el.outerHTML;
  let n = 0;
  for (const child of root.querySelectorAll<HTMLElement>('*')) {
    if (child === el) return n;
    if (child.outerHTML === needle) n += 1;
  }
  return n;
}

export function replaceNth(html: string, needle: string, n: number, replacement: string): string {
  let idx = -1;
  for (let i = 0; i <= n; i += 1) {
    idx = html.indexOf(needle, idx + 1);
    if (idx === -1) return html;
  }
  return html.slice(0, idx) + replacement + html.slice(idx + needle.length);
}
