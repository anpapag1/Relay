import { describe, expect, it } from 'vitest';
import { findElements, textContent, tokenizeShortcodes } from './tokenize';

describe('tokenizeShortcodes', () => {
  it('parses nested elements with attributes and text', () => {
    const tree = tokenizeShortcodes('[vc_row][vc_column][vc_column_text]<p>Hi</p>[/vc_column_text][/vc_column][/vc_row]');
    expect(tree).toHaveLength(1);
    const row = tree[0];
    if (row.type !== 'element') throw new Error('expected element');
    expect(row.tag).toBe('vc_row');
    const [column] = row.children;
    if (column.type !== 'element') throw new Error('expected element');
    expect(column.tag).toBe('vc_column');
  });

  it('parses quoted and unquoted attribute values', () => {
    const tree = tokenizeShortcodes('[vc_btn title="Click me" link="url:https://x.com|title:X"]');
    const [el] = tree;
    if (el.type !== 'element') throw new Error('expected element');
    expect(el.attrs.title).toBe('Click me');
    expect(el.attrs.link).toBe('url:https://x.com|title:X');
  });

  it('parses WPBakery attributes quoted with HTML-entity quote marks, including values containing spaces', () => {
    const tree = tokenizeShortcodes(
      '[vc_video link=&#8221;https://www.youtube.com/watch?v=8Ood9C1qWZE&#8221; el_aspect=&#8221;43&#8243; title=&#8221;Ασπίδα Προστασίας στην Κλιματική Κρίση&#8221;]',
    );
    const [el] = tree;
    if (el.type !== 'element') throw new Error('expected element');
    expect(el.tag).toBe('vc_video');
    expect(el.attrs.link).toBe('https://www.youtube.com/watch?v=8Ood9C1qWZE');
    expect(el.attrs.el_aspect).toBe('43');
    expect(el.attrs.title).toBe('Ασπίδα Προστασίας στην Κλιματική Κρίση');
  });

  it('treats an unrecognised attribute-only self-closing tag as self-closing', () => {
    const tree = tokenizeShortcodes('[vc_empty_space height="20px"]');
    const [el] = tree;
    if (el.type !== 'element') throw new Error('expected element');
    expect(el.tag).toBe('vc_empty_space');
    expect(el.children).toHaveLength(0);
  });

  it('recovers from an unmatched closing tag instead of throwing', () => {
    expect(() => tokenizeShortcodes('[vc_row][vc_column]text[/vc_row]')).not.toThrow();
  });

  it('treats a named void tag as a leaf even with no trailing / or closing tag', () => {
    const tree = tokenizeShortcodes('[vc_separator][vc_empty_space height="40px"]', new Set(['vc_separator', 'vc_empty_space']));
    expect(tree).toHaveLength(2);
    expect(tree.map((n) => (n.type === 'element' ? n.tag : n.text))).toEqual(['vc_separator', 'vc_empty_space']);
  });

  it('findElements and textContent walk the whole tree', () => {
    const tree = tokenizeShortcodes('[vc_row][vc_column]a[vc_column]b[/vc_column]c[/vc_column][/vc_row]');
    expect(findElements(tree, 'vc_column')).toHaveLength(2);
    expect(textContent(tree)).toBe('abc');
  });
});
