/** @jsxImportSource react */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
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
