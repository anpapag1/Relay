/** @jsxImportSource react */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AppStateProvider } from '../../state/AppStateContext';
import { MappingsTab } from './MappingsTab';
import { appReducer, initialState } from '../../state/reducer';
import type { ParseResult, TermTable } from '../../types/domain';

const MOCK_PARSE_RESULT: ParseResult = {
  ok: true,
  siteUrl: 'https://old.example',
  totalItems: 1,
  articles: [
    {
      postId: 1, postType: 'post', status: 'publish', title: 'Alpha',
      link: 'https://old.example/alpha/', postDate: '2026-01-01', postName: 'alpha',
      creator: 'a', contentHtml: '<p>Alpha</p>', excerptHtml: '', terms: [], postmeta: {},
    },
  ],
  attachments: [],
  taxonomies: {},
  authors: ['a'],
  statusCounts: { publish: 1 },
};

function bigOldTable(count: number): TermTable {
  return {
    id: 'category',
    label: 'Category',
    terms: Array.from({ length: count }, (_, i) => ({ id: `term-${i}`, name: `Term ${i}`, slug: `term-${i}` })),
  };
}

function stateWithTerms(count: number) {
  let s = appReducer(initialState, {
    type: 'LOAD_SOURCE',
    result: MOCK_PARSE_RESULT,
    defaultBuilder: 'plainHtml',
    confidence: 100,
  });
  s = appReducer(s, { type: 'SET_TARGET_TABLES', tables: [{ id: 'cats', label: 'Categories', terms: [] }] });
  s = appReducer(s, { type: 'SET_OLD_TABLES', tables: [bigOldTable(count)] });
  return s;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  document.body.removeChild(container);
});

describe('MappingsTab large-taxonomy rendering', () => {
  it('renders every row directly for a small taxonomy (no virtualization change in behavior)', async () => {
    const seeded = stateWithTerms(20);
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false} initialStateOverride={seeded}>
          <MappingsTab />
        </AppStateProvider>,
      );
    });

    expect(container.textContent).toContain('Term 0');
    expect(container.textContent).toContain('Term 19');
  });

  it('only mounts a bounded window of rows for a taxonomy with thousands of terms', async () => {
    // Reproduces the real freeze: rendering every row's full DOM subtree for
    // a large taxonomy (e.g. a long-lived site's per-event category) grows
    // the tab's DOM into the tens of thousands of nodes, which is what
    // actually froze the browser on exclude/any interaction - not React
    // re-render cost, which was already memoized correctly.
    const seeded = stateWithTerms(5000);
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false} initialStateOverride={seeded}>
          <MappingsTab />
        </AppStateProvider>,
      );
    });

    expect(container.textContent).toContain('Term 0');
    // A term far down the list must not be mounted at all yet.
    expect(container.textContent).not.toContain('Term 4999');

    const domNodeCount = container.querySelectorAll('*').length;
    expect(domNodeCount).toBeLessThan(2000);
  });
});

describe('MappingsTab auto-match', () => {
  it('opens a confirm modal, and confirming replaces mappings and closes the modal', async () => {
    const seeded = stateWithTerms(20);
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false} initialStateOverride={seeded}>
          <MappingsTab />
        </AppStateProvider>,
      );
    });

    const autoMatchButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Auto-match all') as HTMLButtonElement;
    await act(async () => { autoMatchButton.click(); });

    expect(container.textContent).toContain('Auto-match all taxonomies?');

    const confirmButtons = Array.from(container.querySelectorAll('button')).filter((b) => b.textContent === 'Auto-match all');
    // Two buttons now share the label: the toolbar trigger and the modal's confirm button.
    expect(confirmButtons).toHaveLength(2);
    await act(async () => { confirmButtons[1].click(); });

    expect(container.textContent).not.toContain('Auto-match all taxonomies?');
  });
});
