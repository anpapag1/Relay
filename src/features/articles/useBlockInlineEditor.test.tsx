/* global MouseEvent, FocusEvent */
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
});