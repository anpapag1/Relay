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

function stateWithArticles(count: number) {
  const articles: ParseResult['articles'] = Array.from({ length: count }, (_, i) => ({
    postId: i + 1, postType: 'post', status: 'publish', title: `Article ${i}`,
    link: `https://old.example/a${i}/`, postDate: '2026-01-01', postName: `a${i}`,
    creator: 'a', contentHtml: '<p>Body</p>', excerptHtml: '', terms: [], postmeta: {},
  }));
  return appReducer(initialState, {
    type: 'LOAD_SOURCE',
    result: { ...MOCK_PARSE_RESULT, totalItems: count, articles },
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

describe('ArticlesTab reset-overrides button', () => {
  it('shows a Reset button on an edited article row that clears its overrides, and none on untouched rows', async () => {
    let seeded = stateWithImport();
    seeded = appReducer(seeded, { type: 'SAVE_ARTICLE_EDIT', articleId: 1, editedHtml: '<p>Edited</p>' });
    seeded = appReducer(seeded, { type: 'UPDATE_ARTICLE_METADATA', articleId: 1, title: 'Renamed' });
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false} initialStateOverride={seeded}>
          <ArticlesTab />
        </AppStateProvider>,
      );
    });

    const resetButtons = () => Array.from(container.querySelectorAll('button')).filter((b) => b.textContent?.trim() === 'Reset');
    expect(resetButtons()).toHaveLength(1);
    expect(container.textContent).toContain('Renamed');

    await act(async () => { resetButtons()[0].click(); });

    expect(resetButtons()).toHaveLength(0);
    expect(container.textContent).toContain('Alpha');
    expect(container.textContent).not.toContain('Renamed');
  });
});

describe('ArticlesTab large-list rendering', () => {
  it('renders every row directly for a small list (no virtualization change in behavior)', async () => {
    const seeded = stateWithArticles(20);
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false} initialStateOverride={seeded}>
          <ArticlesTab />
        </AppStateProvider>,
      );
    });

    expect(container.textContent).toContain('Article 0');
    expect(container.textContent).toContain('Article 19');
  });

  it('only mounts a bounded window of rows for thousands of articles', async () => {
    const seeded = stateWithArticles(5000);
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false} initialStateOverride={seeded}>
          <ArticlesTab />
        </AppStateProvider>,
      );
    });

    expect(container.textContent).toContain('Article 0');
    // An article far down the list must not be mounted at all yet.
    expect(container.textContent).not.toContain('Article 4999');

    const domNodeCount = container.querySelectorAll('*').length;
    expect(domNodeCount).toBeLessThan(2000);
  });
});
