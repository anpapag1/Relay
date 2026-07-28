/** @jsxImportSource react */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AppStateProvider } from '../../state/AppStateContext';
import { ArticlesTab } from './ArticlesTab';
import { appReducer, initialState } from '../../state/reducer';
import type { ParseResult } from '../../types/domain';

const MOCK_PARSE_RESULT: ParseResult = {
  ok: true,
  siteUrl: 'https://old.example',
  totalItems: 3,
  articles: [
    {
      postId: 1, postType: 'post', status: 'publish', title: 'Alpha',
      link: 'https://old.example/alpha/', postDate: '2026-01-01', postName: 'alpha',
      creator: 'a', contentHtml: '<p>Alpha content</p>', excerptHtml: '', terms: [], postmeta: {},
    },
    {
      postId: 2, postType: 'post', status: 'publish', title: 'Bravo',
      link: 'https://old.example/bravo/', postDate: '2026-01-02', postName: 'bravo',
      creator: 'a', contentHtml: '<p>Bravo content</p>', excerptHtml: '', terms: [], postmeta: {},
    },
    {
      postId: 3, postType: 'post', status: 'publish', title: 'Charlie',
      link: 'https://old.example/charlie/', postDate: '2026-01-03', postName: 'charlie',
      creator: 'a', contentHtml: '<p>Charlie content</p>', excerptHtml: '', terms: [], postmeta: {},
    },
  ],
  attachments: [],
  taxonomies: {},
  authors: ['a'],
  statusCounts: { publish: 3 },
};

function stateWithImport() {
  return appReducer(initialState, {
    type: 'LOAD_SOURCE',
    result: MOCK_PARSE_RESULT,
    defaultBuilder: 'plainHtml',
    confidence: 100,
  });
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

describe('ArticlesTab prev/next navigation', () => {
  it('steps through the title-sorted list and disables at the ends', async () => {
    const seeded = stateWithImport();
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false} initialStateOverride={seeded}>
          <ArticlesTab />
        </AppStateProvider>,
      );
    });

    // Default sort is by title ascending: Alpha, Bravo, Charlie.
    const alphaRow = Array.from(container.querySelectorAll('div')).find((el) => el.textContent === 'Alpha');
    await act(async () => { alphaRow?.click(); });

    let prevBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Previous')) as HTMLButtonElement;
    let nextBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Next')) as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);

    await act(async () => { nextBtn.click(); });
    expect(container.textContent).toContain('Bravo');

    nextBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Next')) as HTMLButtonElement;
    await act(async () => { nextBtn.click(); });
    expect(container.textContent).toContain('Charlie');

    prevBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Previous')) as HTMLButtonElement;
    nextBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Next')) as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
    expect(prevBtn.disabled).toBe(false);
  });
});
