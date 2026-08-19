/* global MouseEvent, FocusEvent, Node */
/** @jsxImportSource react */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useBlockInlineEditor } from './useBlockInlineEditor';

const BASE_HTML = '<p>Hello</p><h2 class="wp-block-heading">Title</h2><p>Again</p>';
const FULL_HTML =
  '<p>Hello</p><h2 class="wp-block-heading">Title</h2><p>Again</p><figure class="wp-block-image"><img src="x.jpg" /></figure>';

let host: HTMLDivElement;
let root: Root;
let committed: string | null;
let commitSpy: ReturnType<typeof vi.fn>;

function Harness({ enabled = true, initialHtml = FULL_HTML }: { enabled?: boolean; initialHtml?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(initialHtml);
  useBlockInlineEditor({
    containerRef: ref,
    enabled,
    draftHtml: html,
    onCommit: (next) => {
      committed = next;
      commitSpy(next);
      setHtml(next);
    },
  });
  return <div ref={ref} className="wp-preview-body" dangerouslySetInnerHTML={{ __html: html }} />;
}

function getBody(): HTMLElement {
  return host.querySelector<HTMLElement>('.wp-preview-body')!;
}

async function mount(initialHtml = FULL_HTML) {
  await act(async () => {
    root.render(<Harness initialHtml={initialHtml} />);
  });
}

async function beginEditing(p: HTMLElement) {
  await act(async () => {
    p.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  });
}

async function type(p: HTMLElement, text: string) {
  p.textContent = text;
  await act(async () => {
    p.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function exitEditing(body: HTMLElement) {
  await act(async () => {
    body.dispatchEvent(new FocusEvent('blur', { bubbles: true, relatedTarget: null }));
  });
}

function placeCaret(node: Node, offset: number) {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  committed = null;
  commitSpy = vi.fn();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  window.getSelection()?.removeAllRanges();
  document.body.removeChild(host);
});

describe('useBlockInlineEditor', () => {
  it('marks editable blocks with data-editable, including headings, not read-only blocks', async () => {
    await mount();
    const body = getBody();
    expect(body.querySelectorAll('p')[0]!.dataset.editable).toBe('true');
    expect(body.querySelector<HTMLElement>('h2.wp-block-heading')!.dataset.editable).toBe('true');
    expect(body.querySelectorAll('p')[1]!.dataset.editable).toBe('true');
    expect(body.querySelector<HTMLElement>('figure.wp-block-image')!.dataset.editable).toBeUndefined();
  });

  it('makes a clicked paragraph contentEditable and focused', async () => {
    await mount();
    const body = getBody();
    const p = body.querySelectorAll('p')[0]!;

    await beginEditing(p);

    expect(p.contentEditable).toBe('true');
    expect(document.activeElement).toBe(p);
    expect(p.classList.contains('is-editing')).toBe(true);
    expect(body.dataset.editing).toBe('true');
  });

  it('does not make a read-only block editable', async () => {
    await mount();
    const body = getBody();
    const figure = body.querySelector<HTMLElement>('figure.wp-block-image')!;

    await act(async () => {
      figure.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      figure.focus();
    });

    expect(figure.getAttribute('contenteditable')).toBeNull();
    expect(figure.classList.contains('is-editing')).toBe(false);
    expect(body.dataset.editing).toBeUndefined();
    expect(commitSpy).not.toHaveBeenCalled();
  });

  it('commits the updated HTML through onCommit only when exiting', async () => {
    await mount(BASE_HTML);
    const body = getBody();
    const p = body.querySelectorAll('p')[0]!;

    await beginEditing(p);
    await type(p, 'Hello world');
    expect(commitSpy).not.toHaveBeenCalled();

    await exitEditing(body);

    expect(commitSpy).toHaveBeenCalledTimes(1);
    expect(committed).toBe('<p>Hello world</p><h2 class="wp-block-heading">Title</h2><p>Again</p>');
    expect(p.contentEditable).toBe('false');
    expect(p.classList.contains('is-editing')).toBe(false);
    expect(body.dataset.editing).toBeUndefined();
  });

  it('commits at most once when exiting repeatedly', async () => {
    await mount(BASE_HTML);
    const body = getBody();
    const p = body.querySelectorAll('p')[0]!;

    await beginEditing(p);
    await type(p, 'Changed');

    await exitEditing(body);
    await exitEditing(body);

    expect(commitSpy).toHaveBeenCalledTimes(1);
    expect(committed).toBe('<p>Changed</p><h2 class="wp-block-heading">Title</h2><p>Again</p>');
  });

  it('commits without leaking editing artifacts into the draft', async () => {
    await mount(BASE_HTML);
    const body = getBody();
    const h2 = body.querySelector<HTMLElement>('h2.wp-block-heading')!;

    await beginEditing(h2);
    await type(h2, 'Updated title');

    await act(async () => {
      body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
    });

    expect(commitSpy).toHaveBeenCalledTimes(1);
    expect(committed).toBe('<p>Hello</p><h2 class="wp-block-heading">Updated title</h2><p>Again</p>');
  });

  it('commits on Escape', async () => {
    await mount(BASE_HTML);
    const body = getBody();
    const p = body.querySelectorAll('p')[0]!;

    await beginEditing(p);
    await type(p, 'Bye');

    await act(async () => {
      body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(commitSpy).toHaveBeenCalledTimes(1);
    expect(committed).toBe('<p>Bye</p><h2 class="wp-block-heading">Title</h2><p>Again</p>');
  });

  it('does not re-enter editing from a stale pending index after an unchanged commit', async () => {
    await mount(BASE_HTML);
    const body = getBody();
    const a = body.querySelectorAll('p')[0]!;
    const b = body.querySelectorAll('p')[1]!;

    await beginEditing(a);
    await act(async () => {
      b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(commitSpy).toHaveBeenCalledTimes(1);
    expect(committed).toBe(BASE_HTML);

    await beginEditing(b);
    await type(b, 'Again2');
    await exitEditing(body);

    expect(commitSpy).toHaveBeenCalledTimes(2);
    expect(committed).toBe('<p>Hello</p><h2 class="wp-block-heading">Title</h2><p>Again2</p>');

    const freshBody = getBody();
    const freshB = freshBody.querySelectorAll('p')[1]!;
    expect(freshB.getAttribute('contenteditable')).toBeNull();
    expect(freshB.classList.contains('is-editing')).toBe(false);
    expect(freshBody.dataset.editing).toBeUndefined();
  });

  it('splits a paragraph into two at the caret on Enter', async () => {
    await mount('<p>Hello world</p><h2 class="wp-block-heading">Title</h2><p>Again</p>');
    const body = getBody();
    const p = body.querySelectorAll('p')[0]!;

    await beginEditing(p);
    placeCaret(p.firstChild!, 5);

    await act(async () => {
      p.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    const ps = body.querySelectorAll('p');
    expect(ps).toHaveLength(3);
    expect(ps[0]!.textContent).toBe('Hello');
    expect(ps[1]!.textContent).toBe(' world');
    expect(ps[0]!.classList.contains('is-editing')).toBe(false);
    expect(ps[1]!.classList.contains('is-editing')).toBe(true);
    expect(ps[1]!.contentEditable).toBe('true');

    await exitEditing(body);

    expect(committed).toBe('<p>Hello</p><p> world</p><h2 class="wp-block-heading">Title</h2><p>Again</p>');
  });

  it('splits a heading into a heading and a new paragraph on Enter', async () => {
    await mount(BASE_HTML);
    const body = getBody();
    const h2 = body.querySelector<HTMLElement>('h2.wp-block-heading')!;

    await beginEditing(h2);
    placeCaret(h2.firstChild!, 2);

    await act(async () => {
      h2.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(h2.textContent).toBe('Ti');
    expect(h2.classList.contains('is-editing')).toBe(false);
    const next = h2.nextElementSibling!;
    expect(next.tagName.toLowerCase()).toBe('p');
    expect(next.textContent).toBe('tle');
    expect(next.classList.contains('is-editing')).toBe(true);

    await exitEditing(body);

    expect(committed).toBe('<p>Hello</p><h2 class="wp-block-heading">Ti</h2><p>tle</p><p>Again</p>');
  });

  it('splits a list item into a new item in the same list on Enter', async () => {
    await mount('<ul class="wp-block-list"><li>item one</li><li>item two</li></ul>');
    const body = getBody();
    const li = body.querySelector('li')!;

    await beginEditing(li);
    placeCaret(li.firstChild!, 4);

    await act(async () => {
      li.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    const lis = body.querySelectorAll('li');
    expect(lis).toHaveLength(3);
    expect(lis[0]!.textContent).toBe('item');
    expect(lis[1]!.textContent).toBe(' one');
    expect(lis[1]!.parentElement).toBe(lis[0]!.parentElement);
    expect(lis[1]!.classList.contains('is-editing')).toBe(true);

    await exitEditing(body);

    expect(committed).toBe('<ul class="wp-block-list"><li>item</li><li> one</li><li>item two</li></ul>');
  });

  it('joins the second of two identical paragraphs into the first on Backspace', async () => {
    await mount('<p>x</p><p>x</p>');
    const body = getBody();
    const first = body.querySelectorAll('p')[0]!;
    const second = body.querySelectorAll('p')[1]!;

    await beginEditing(second);
    placeCaret(second.firstChild!, 0);

    await act(async () => {
      second.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    });

    const ps = body.querySelectorAll('p');
    expect(ps).toHaveLength(1);
    expect(ps[0]).toBe(first);
    expect(ps[0]!.textContent).toBe('xx');

    await exitEditing(body);

    expect(committed).toBe('<p>xx</p>');
  });

  it('deletes an empty paragraph between two others on Backspace', async () => {
    await mount('<p>a</p><p></p><p>b</p>');
    const body = getBody();
    const middle = body.querySelectorAll('p')[1]!;

    await beginEditing(middle);
    placeCaret(middle, 0);

    await act(async () => {
      middle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    });

    const ps = body.querySelectorAll('p');
    expect(ps).toHaveLength(2);
    expect(ps[0]!.textContent).toBe('a');
    expect(ps[1]!.textContent).toBe('b');
    expect(middle.isConnected).toBe(false);

    await exitEditing(body);

    expect(committed).toBe('<p>a</p><p>b</p>');
  });

  it('does nothing on Backspace at the start of the first block', async () => {
    await mount('<p>first</p><p>second</p>');
    const body = getBody();
    const first = body.querySelectorAll('p')[0]!;

    await beginEditing(first);
    placeCaret(first.firstChild!, 0);

    await act(async () => {
      first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    });

    const ps = body.querySelectorAll('p');
    expect(ps).toHaveLength(2);
    expect(ps[0]!.textContent).toBe('first');
    expect(ps[1]!.textContent).toBe('second');

    await exitEditing(body);

    expect(committed).toBe('<p>first</p><p>second</p>');
  });

  it('removes the whole list when Backspace deletes its only item', async () => {
    await mount('<p>keep</p><ul class="wp-block-list"><li></li></ul>');
    const body = getBody();
    const li = body.querySelector('li')!;

    await beginEditing(li);
    placeCaret(li, 0);

    await act(async () => {
      li.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    });

    expect(body.querySelector('ul')).toBeNull();
    expect(body.querySelector('li')).toBeNull();
    expect(body.querySelectorAll('p')).toHaveLength(1);
    expect(body.querySelectorAll('p')[0]!.textContent).toBe('keep');

    await exitEditing(body);

    expect(committed).toBe('<p>keep</p>');
  });

  it('splits on Enter after typing, keeping the typed character in the commit', async () => {
    await mount('<p>x</p><p>x</p>');
    const body = getBody();
    const second = body.querySelectorAll('p')[1]!;

    await beginEditing(second);
    await type(second, 'xa');
    placeCaret(second.firstChild!, 1);

    await act(async () => {
      second.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    const ps = body.querySelectorAll('p');
    expect(ps).toHaveLength(3);
    expect(ps[0]!.textContent).toBe('x');
    expect(ps[1]!.textContent).toBe('x');
    expect(ps[2]!.textContent).toBe('a');
    expect(ps[1]!.classList.contains('is-editing')).toBe(false);
    expect(ps[2]!.classList.contains('is-editing')).toBe(true);

    await exitEditing(body);

    expect(committed).toBe('<p>x</p><p>x</p><p>a</p>');
  });

  it('joins on Backspace after typing, keeping the typed character in the commit', async () => {
    await mount('<p>x</p><p>x</p>');
    const body = getBody();
    const first = body.querySelectorAll('p')[0]!;
    const second = body.querySelectorAll('p')[1]!;

    await beginEditing(second);
    await type(second, 'xa');
    placeCaret(second.firstChild!, 0);

    await act(async () => {
      second.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    });

    const ps = body.querySelectorAll('p');
    expect(ps).toHaveLength(1);
    expect(ps[0]).toBe(first);
    expect(ps[0]!.textContent).toBe('xxa');

    await exitEditing(body);

    expect(committed).toBe('<p>xxa</p>');
  });
});