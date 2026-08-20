export interface ShortcodeElement {
  type: 'element';
  tag: string;
  attrs: Record<string, string>;
  children: ShortcodeNode[];
  selfClosing: boolean;
}

export interface ShortcodeText {
  type: 'text';
  text: string;
}

export type ShortcodeNode = ShortcodeElement | ShortcodeText;

const TAG_RE = /\[(\/?)([a-zA-Z_][a-zA-Z0-9_]*)((?:\s+[a-zA-Z_][a-zA-Z0-9_-]*(?:="[^"]*"|='[^']*'|=[^\s\]]+)?)*)\s*(\/?)\]/g;
const ATTR_RE = /([a-zA-Z_][a-zA-Z0-9_-]*)(?:=(?:"([^"]*)"|'([^']*)'|([^\s\]]+)))?/g;

function parseAttrs(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(attrString)) !== null) {
    attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

// WPBakery (and some Divi exports) write shortcode attributes with
// HTML-entity quote marks — `link=&#8221;url&#8221;` instead of
// `link="url"`. When such a value contains spaces (e.g. a title) the
// unquoted-value grammar below can't span them, so the whole shortcode
// fails to match and its content degrades to a raw fallback. Decoding the
// common quote characters up front turns those into normal quoted
// attributes the quoted-value branch handles. Only quote characters are
// decoded — real HTML entities in body text are left for the plainHtml
// reader's DOMParser.
const DOUBLE_QUOTE_ENTITY_RE = /&#(?:8220|8221|8243|34);|&quot;/g;
const SINGLE_QUOTE_ENTITY_RE = /&#(?:8216|8217|8242|39);|&apos;/g;

function decodeQuoteEntities(input: string): string {
  return input.replace(DOUBLE_QUOTE_ENTITY_RE, '"').replace(SINGLE_QUOTE_ENTITY_RE, "'");
}

/** A small, non-strict shortcode parser shared by wpbakery and divi (both
 * use the same `[tag attr="v"]...[/tag]` / `[tag attr="v" /]` grammar,
 * just with different tag vocabularies). Text between tags is kept
 * verbatim as-is — it is usually real HTML from the visual editor, and
 * readers delegate it to the plainHtml reader rather than this tokenizer
 * trying to understand it. An unmatched closing tag pops the stack back
 * to its nearest open ancestor of the same name rather than throwing,
 * since real-world exports are not always perfectly balanced.
 *
 * `voidTags` names shortcodes that are always leaves even though they
 * carry no trailing `/` and have no matching `[/tag]` — real WPBakery/Divi
 * output for widgets like `[vc_separator]` or `[vc_single_image image="1"]`
 * looks exactly like an opening tag, so without this the tokenizer would
 * otherwise swallow every following shortcode as its "child". */
export function tokenizeShortcodes(input: string, voidTags: ReadonlySet<string> = new Set()): ShortcodeNode[] {
  const decoded = decodeQuoteEntities(input);
  const root: ShortcodeElement = { type: 'element', tag: '__root__', attrs: {}, children: [], selfClosing: false };
  const stack: ShortcodeElement[] = [root];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;

  while ((match = TAG_RE.exec(decoded)) !== null) {
    const [full, closingSlash, tag, attrString, selfClosingSlash] = match;
    const textBefore = decoded.slice(lastIndex, match.index);
    if (textBefore) stack[stack.length - 1].children.push({ type: 'text', text: textBefore });
    lastIndex = match.index + full.length;

    if (closingSlash) {
      for (let i = stack.length - 1; i >= 1; i -= 1) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const isVoid = Boolean(selfClosingSlash) || voidTags.has(tag);
    const element: ShortcodeElement = {
      type: 'element',
      tag,
      attrs: parseAttrs(attrString),
      children: [],
      selfClosing: isVoid,
    };
    stack[stack.length - 1].children.push(element);
    if (!isVoid) stack.push(element);
  }

  const tail = decoded.slice(lastIndex);
  if (tail) stack[stack.length - 1].children.push({ type: 'text', text: tail });

  return root.children;
}

export function textContent(nodes: ShortcodeNode[]): string {
  return nodes.map((node) => (node.type === 'text' ? node.text : textContent(node.children))).join('');
}

export function findElements(nodes: ShortcodeNode[], tag: string): ShortcodeElement[] {
  const found: ShortcodeElement[] = [];
  for (const node of nodes) {
    if (node.type === 'element') {
      if (node.tag === tag) found.push(node);
      found.push(...findElements(node.children, tag));
    }
  }
  return found;
}
