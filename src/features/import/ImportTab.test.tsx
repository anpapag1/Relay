/** @jsxImportSource react */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AppStateProvider } from '../../state/AppStateContext';
import { ImportTab } from './ImportTab';
import { fetchSite } from '../../core/site/fetchSite';

vi.mock('../../core/site/fetchSite', () => ({ fetchSite: vi.fn() }));

const mockFetchSite = vi.mocked(fetchSite);

function renderTab() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root };
}

async function renderImportTab(root: ReturnType<typeof createRoot>) {
  await act(async () => {
    root.render(
      <AppStateProvider enableAutosave={false}>
        <ImportTab />
      </AppStateProvider>,
    );
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function findFetchButton(container: HTMLDivElement): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find((btn) => btn.textContent === 'Fetch posts');
}

beforeEach(() => mockFetchSite.mockReset());

describe('ImportTab fetch-from-site', () => {
  it('shows the fetch card and loads a fetched source into the review flow', async () => {
    mockFetchSite.mockResolvedValue({
      ok: true,
      source: 'rest',
      truncated: false,
      result: {
        ok: true,
        siteUrl: 'https://site.example',
        totalItems: 1,
        articles: [
          {
            postId: 1,
            postType: 'post',
            status: 'publish',
            title: 'Hello',
            link: 'https://site.example/hello/',
            postDate: '2026-08-17T09:00:00',
            postName: 'hello',
            creator: '',
            contentHtml: '<p>Hi</p>',
            excerptHtml: '',
            terms: [],
            postmeta: {},
            featuredImageUrl: 'https://cdn.example/1.jpg',
          },
        ],
        attachments: [],
        taxonomies: {},
        authors: [],
        statusCounts: { publish: 1 },
      },
    });

    const { container, root } = renderTab();
    await renderImportTab(root);

    const input = container.querySelector('input[placeholder*="https://old-site.example"]') as HTMLInputElement;
    expect(input).toBeDefined();
    const fetchBtn = findFetchButton(container);
    expect(fetchBtn).toBeDefined();

    await act(async () => {
      setInputValue(input, 'https://site.example');
    });
    await act(async () => {
      fetchBtn?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain('Import detected');
    expect(container.textContent).toContain('From site.example');

    root.unmount();
    document.body.removeChild(container);
  });

  it('surfaces a fetch failure message', async () => {
    mockFetchSite.mockResolvedValue({
      ok: false,
      reason: "Couldn't find a WordPress REST API or RSS feed at that address.",
    });

    const { container, root } = renderTab();
    await renderImportTab(root);

    const input = container.querySelector('input[placeholder*="https://old-site.example"]') as HTMLInputElement;
    const fetchBtn = findFetchButton(container);

    await act(async () => {
      setInputValue(input, 'https://nope.example');
    });
    await act(async () => {
      fetchBtn?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain("Couldn't find a WordPress REST API");

    root.unmount();
    document.body.removeChild(container);
  });
});