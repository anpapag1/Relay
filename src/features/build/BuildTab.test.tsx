/** @jsxImportSource react */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AppStateProvider } from '../../state/AppStateContext';
import { BuildTab } from './BuildTab';
import { appReducer, initialState } from '../../state/reducer';
import type { ParseResult } from '../../types/domain';

const MOCK_PARSE_RESULT: ParseResult = {
  ok: true,
  siteUrl: 'https://old.example',
  totalItems: 1,
  articles: [
    {
      postId: 1, postType: 'post', status: 'publish', title: 'Alpha',
      link: 'https://old.example/alpha/', postDate: '2026-01-01', postName: 'alpha',
      creator: 'a', contentHtml: '<p>Alpha content</p>', excerptHtml: '',
      terms: [{ domain: 'category', nicename: 'unmapped-cat', name: 'Unmapped Cat' }], postmeta: {},
    },
  ],
  attachments: [],
  taxonomies: { category: [{ nicename: 'unmapped-cat', name: 'Unmapped Cat', count: 1 }] },
  authors: ['a'],
  statusCounts: { publish: 1 },
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

describe('BuildTab check-for-problems copy button', () => {
  it('copies the formatted check results to the clipboard and shows confirmation', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });

    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false} initialStateOverride={stateWithImport()}>
          <BuildTab />
        </AppStateProvider>,
      );
    });

    const runCheckBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Run check');
    expect(runCheckBtn).toBeDefined();
    await act(async () => { runCheckBtn?.click(); });

    expect(container.textContent).toContain('Unmapped taxonomy term: "Unmapped Cat"');

    const copyBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Copy to clipboard');
    expect(copyBtn).toBeDefined();
    await act(async () => { copyBtn?.click(); });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('Alpha: Unmapped taxonomy term: "Unmapped Cat"');
    expect(container.textContent).toContain('Copied!');
  });

  it('copies a "no problems" message when the check is clean', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });

    const cleanResult: ParseResult = { ...MOCK_PARSE_RESULT, articles: [{ ...MOCK_PARSE_RESULT.articles[0], terms: [] }] };
    const seeded = appReducer(initialState, {
      type: 'LOAD_SOURCE',
      result: cleanResult,
      defaultBuilder: 'plainHtml',
      confidence: 100,
    });

    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false} initialStateOverride={seeded}>
          <BuildTab />
        </AppStateProvider>,
      );
    });

    const runCheckBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Run check');
    await act(async () => { runCheckBtn?.click(); });
    expect(container.textContent).toContain('No problems found');

    const copyBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Copy to clipboard');
    await act(async () => { copyBtn?.click(); });

    expect(writeText).toHaveBeenCalledWith('No problems found — ready to build.');
  });
});

describe('BuildTab build survives navigating away mid-build', () => {
  // Mirrors App.tsx: `{activeTab === 'build' && <BuildTab />}` — BuildTab is
  // only mounted while its tab is active, so switching tabs unmounts it
  // entirely. Build progress/completion must live in global state (driven
  // by AppStateProvider's startBuild, which never unmounts) rather than
  // BuildTab's own local state, or a build in flight silently vanishes the
  // instant you look away from the tab.
  function Harness() {
    const [show, setShow] = useState(true);
    return (
      <>
        <button type="button" data-testid="toggle-tab" onClick={() => setShow((s) => !s)}>
          toggle
        </button>
        {show && <BuildTab />}
      </>
    );
  }

  it('keeps a build running and eventually shows its result after unmounting and remounting BuildTab', async () => {
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false} initialStateOverride={stateWithImport()}>
          <Harness />
        </AppStateProvider>,
      );
    });

    const buildBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Build now');
    expect(buildBtn).toBeDefined();
    await act(async () => {
      buildBtn?.click();
    });

    // Simulate switching away from the Build tab while the build is still
    // running: unmount BuildTab (the toggle button itself lives outside it,
    // in the always-mounted Harness, standing in for App.tsx's tab bar).
    const toggleBtn = container.querySelector('[data-testid="toggle-tab"]') as HTMLButtonElement;
    await act(async () => {
      toggleBtn.click();
    });
    expect(container.textContent).not.toContain('Build migration file');

    // Let the build actually finish while BuildTab is unmounted.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Switch back — same pattern as returning to the Build tab.
    await act(async () => {
      toggleBtn.click();
    });

    expect(container.textContent).toContain('↓ Download WXR file');
    expect(container.textContent).not.toContain('Build cancelled');
  });
});

describe('BuildTab post-build review count reflects the real build result', () => {
  it('shows the true count of review-flagged articles from the finished build, not the pre-build import-time estimate', async () => {
    // This article's inline image isn't in the export's own attachments,
    // so the import-time estimate (state.media.resolved, stage-1 only)
    // has no entry for it at all and counts zero review articles before
    // the build ever runs. The real build additionally live-fetches
    // unresolved media — here mocked to fail — which is what actually
    // flags this article 'review', a fact only the finished build knows.
    const withImage: ParseResult = {
      ...MOCK_PARSE_RESULT,
      articles: [
        {
          ...MOCK_PARSE_RESULT.articles[0],
          terms: [],
          contentHtml: '<figure><img src="https://old.example/wp-content/uploads/unresolvable.jpg"/></figure>',
        },
      ],
    };
    const seeded = appReducer(initialState, {
      type: 'LOAD_SOURCE',
      result: withImage,
      defaultBuilder: 'plainHtml',
      confidence: 100,
    });

    const originalFetch = window.fetch;
    window.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'unreachable' }), { status: 502 })) as any;

    try {
      await act(async () => {
        root.render(
          <AppStateProvider enableAutosave={false} initialStateOverride={seeded}>
            <BuildTab />
          </AppStateProvider>,
        );
      });

      // Pre-build estimate: no visibility into the live-fetch outcome yet.
      const dashboardReviewCount = container.querySelector('[data-testid="pre-build-review-count"]');
      expect(dashboardReviewCount?.textContent).toBe('0');

      const buildBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Build now');
      await act(async () => {
        buildBtn?.click();
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      const postBuildReviewCount = container.querySelector('[data-testid="post-build-review-count"]');
      expect(postBuildReviewCount?.textContent).toBe('1');
    } finally {
      window.fetch = originalFetch;
    }
  });
});

describe('BuildTab pre-build stats: edited, flagged, total media, total warnings', () => {
  it('counts edited/flagged articles, sums media across all included articles, and sums every warning (not just how many articles have one)', async () => {
    const threeArticles: ParseResult = {
      ...MOCK_PARSE_RESULT,
      articles: [
        {
          // Edited articles short-circuit to warnings:[] regardless of
          // content, but mediaCount is still computed up front — this
          // exercises that mediaCount keeps counting past the edit.
          ...MOCK_PARSE_RESULT.articles[0],
          postId: 1,
          postName: 'article-one',
          link: 'https://old.example/article-one/',
          terms: [],
          contentHtml: '<figure><img src="https://old.example/a.jpg"/></figure><figure><img src="https://old.example/b.jpg"/></figure>',
        },
        {
          // Same for a manually flagged article.
          ...MOCK_PARSE_RESULT.articles[0],
          postId: 2,
          postName: 'article-two',
          link: 'https://old.example/article-two/',
          terms: [],
          contentHtml: '<figure><img src="https://old.example/c.jpg"/></figure>',
        },
        {
          // Untouched — its two unmapped terms actually surface as two
          // separate warnings, proving the stat sums every warning
          // message rather than just counting articles that have one.
          ...MOCK_PARSE_RESULT.articles[0],
          postId: 3,
          postName: 'article-three',
          link: 'https://old.example/article-three/',
          terms: [
            { domain: 'category', nicename: 'unmapped-a', name: 'Unmapped A' },
            { domain: 'category', nicename: 'unmapped-b', name: 'Unmapped B' },
          ],
          contentHtml: '<p>No media here.</p>',
        },
      ],
    };
    let seeded = appReducer(initialState, {
      type: 'LOAD_SOURCE',
      result: threeArticles,
      defaultBuilder: 'plainHtml',
      confidence: 100,
    });
    // Article 1: manually edited (its own converted-HTML override).
    seeded = appReducer(seeded, { type: 'SAVE_ARTICLE_EDIT', articleId: 1, editedHtml: '<p>edited</p>' });
    // Article 2: flagged for manual review — independent of any warnings.
    seeded = appReducer(seeded, { type: 'SET_ARTICLE_MANUAL_REVIEW', articleId: 2, manualReview: true });

    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false} initialStateOverride={seeded}>
          <BuildTab />
        </AppStateProvider>,
      );
    });

    const labelValue = (label: string) => {
      const labelEl = Array.from(container.querySelectorAll('div')).find((d) => d.textContent === label);
      return labelEl?.previousElementSibling?.textContent;
    };

    expect(labelValue('Edited')).toBe('1');
    expect(labelValue('Flagged for review')).toBe('1');
    expect(labelValue('Total media')).toBe('3');
    expect(labelValue('Total warnings')).toBe('2');
  });
});
