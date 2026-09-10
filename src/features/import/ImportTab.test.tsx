/** @jsxImportSource react */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { AppStateProvider } from '../../state/AppStateContext';
import { ImportTab } from './ImportTab';
import { fetchSite } from '../../core/site/fetchSite';
import type { ParseResult } from '../../types/domain';
import { saveSiteProfile } from '../../state/siteProfiles';

vi.mock('../../core/site/fetchSite', () => ({ fetchSite: vi.fn() }));

const mockFetchSite = vi.mocked(fetchSite);

const SUCCESS_RESULT: ParseResult = {
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
};

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

async function fetchSource(container: HTMLDivElement, url: string) {
  const input = container.querySelector('input[placeholder*="https://old-site.example"]') as HTMLInputElement;
  expect(input).toBeDefined();
  const fetchBtn = findFetchButton(container);
  expect(fetchBtn).toBeDefined();

  const startInput = container.querySelector('input[aria-label="Start date"]') as HTMLInputElement;
  const endInput = container.querySelector('input[aria-label="End date"]') as HTMLInputElement;
  expect(startInput).toBeDefined();
  expect(endInput).toBeDefined();

  await act(async () => {
    setInputValue(input, url);
    setInputValue(startInput, '2000-01-01');
    setInputValue(endInput, '2030-12-31');
  });
  await act(async () => {
    fetchBtn?.click();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => mockFetchSite.mockReset());

describe('ImportTab fetch-from-site', () => {
  it('shows the fetch card and loads a fetched source into the review flow', async () => {
    mockFetchSite.mockResolvedValue({
      ok: true,
      source: 'rest',
      truncated: false,
      result: SUCCESS_RESULT,
    });

    const { container, root } = renderTab();
    await renderImportTab(root);
    await fetchSource(container, 'https://news.example.com');

    expect(container.textContent).toContain('Import detected');
    expect(container.textContent).toContain('From news.example.com');

    root.unmount();
    document.body.removeChild(container);
  });

  it('rejects an invalid URL before fetching, with a helpful message', async () => {
    const { container, root } = renderTab();
    await renderImportTab(root);

    const input = container.querySelector('input[placeholder*="https://old-site.example"]') as HTMLInputElement;
    const startInput = container.querySelector('input[aria-label="Start date"]') as HTMLInputElement;
    const endInput = container.querySelector('input[aria-label="End date"]') as HTMLInputElement;
    await act(async () => {
      setInputValue(input, 'not a url');
      setInputValue(startInput, '2000-01-01');
      setInputValue(endInput, '2030-12-31');
    });
    await act(async () => {
      findFetchButton(container)?.click();
    });

    expect(container.textContent).toContain('Enter a valid URL, e.g. https://old-site.example');
    expect(mockFetchSite).not.toHaveBeenCalled();

    root.unmount();
    document.body.removeChild(container);
  });

  it('rejects a non-http(s) URL before fetching', async () => {
    const { container, root } = renderTab();
    await renderImportTab(root);

    const input = container.querySelector('input[placeholder*="https://old-site.example"]') as HTMLInputElement;
    const startInput = container.querySelector('input[aria-label="Start date"]') as HTMLInputElement;
    const endInput = container.querySelector('input[aria-label="End date"]') as HTMLInputElement;
    await act(async () => {
      setInputValue(input, 'ftp://files.example');
      setInputValue(startInput, '2000-01-01');
      setInputValue(endInput, '2030-12-31');
    });
    await act(async () => {
      findFetchButton(container)?.click();
    });

    expect(container.textContent).toContain('Enter a valid URL, e.g. https://old-site.example');
    expect(mockFetchSite).not.toHaveBeenCalled();

    root.unmount();
    document.body.removeChild(container);
  });

  it('shows the may-be-truncated note in the review flow when the fetch was truncated', async () => {
    mockFetchSite.mockResolvedValue({
      ok: true,
      source: 'rest',
      truncated: true,
      result: SUCCESS_RESULT,
    });

    const { container, root } = renderTab();
    await renderImportTab(root);
    await fetchSource(container, 'https://site.example');

    expect(container.textContent).toContain('Import detected');
    expect(container.textContent).toContain('may be truncated at 10,000');

    root.unmount();
    document.body.removeChild(container);
  });

  it('clears fetch progress when starting over so stale state does not resurface', async () => {
    mockFetchSite.mockResolvedValue({
      ok: true,
      source: 'rest',
      truncated: false,
      result: SUCCESS_RESULT,
    });

    const { container, root } = renderTab();
    await renderImportTab(root);
    await fetchSource(container, 'https://site.example');
    expect(container.textContent).toContain('Import detected');

    const startOverBtn = Array.from(container.querySelectorAll('button')).find((btn) => btn.textContent === 'Start over');
    expect(startOverBtn).toBeDefined();
    await act(async () => {
      startOverBtn?.click();
    });

    expect(container.querySelector('input[placeholder*="https://old-site.example"]')).toBeDefined();
    expect(container.textContent).not.toContain('Fetched 1 posts');
    expect(container.textContent).not.toContain('may be truncated');

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
    await fetchSource(container, 'https://nope.example');

    expect(container.textContent).toContain("Couldn't find a WordPress REST API");

    root.unmount();
    document.body.removeChild(container);
  });

  it('shows the REST fetch summary after import', async () => {
    mockFetchSite.mockResolvedValue({ ok: true, source: 'rest', truncated: false, result: SUCCESS_RESULT });

    const { container, root } = renderTab();
    await renderImportTab(root);
    await fetchSource(container, 'https://news.example.com');

    expect(container.textContent).toContain('Import detected');
    expect(container.textContent).toContain('Fetched 1 posts from REST API');

    root.unmount();
    document.body.removeChild(container);
  });

  it('shows the RSS fetch summary after import', async () => {
    mockFetchSite.mockResolvedValue({ ok: true, source: 'rss', truncated: false, result: SUCCESS_RESULT });

    const { container, root } = renderTab();
    await renderImportTab(root);
    await fetchSource(container, 'https://news.example.com');

    expect(container.textContent).toContain('Import detected');
    expect(container.textContent).toContain('Fetched 1 posts from RSS feed');

    root.unmount();
    document.body.removeChild(container);
  });
});

describe('ImportTab source domain', () => {
  it('lets the user type a domain when the WXR has no URL and persists it via SET_SOURCE_DOMAIN', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false} initialStateOverride={{ source: { ...SUCCESS_RESULT, siteUrl: null } }}>
          <ImportTab />
        </AppStateProvider>,
      );
    });

    const input = Array.from(container.querySelectorAll('input')).find((el) => el.getAttribute('aria-label') === 'Source domain' || (el as HTMLInputElement).readOnly === false && (el as HTMLInputElement).placeholder === 'e.g. oldsite.com');
    expect(input).toBeDefined();
    if (!input) return;

    setInputValue(input as HTMLInputElement, 'my-import.example');
    await act(async () => {
      (input as HTMLInputElement).dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect((input as HTMLInputElement).value).toBe('my-import.example');
    root.unmount();
    document.body.removeChild(container);
  });
});

describe('ImportTab fetch filters', () => {
  it('disables the fetch button until a date range is set', async () => {
    const { container, root } = renderTab();
    await renderImportTab(root);

    const fetchBtn = findFetchButton(container);
    expect(fetchBtn?.disabled).toBe(true);

    const startInput = container.querySelector('input[aria-label="Start date"]') as HTMLInputElement;
    const endInput = container.querySelector('input[aria-label="End date"]') as HTMLInputElement;
    await act(async () => {
      setInputValue(startInput, '2020-01-01');
      setInputValue(endInput, '2020-01-31');
    });
    expect(fetchBtn?.disabled).toBe(false);

    root.unmount();
    document.body.removeChild(container);
  });

  it('disables the fetch button when the range is inverted', async () => {
    const { container, root } = renderTab();
    await renderImportTab(root);

    const startInput = container.querySelector('input[aria-label="Start date"]') as HTMLInputElement;
    const endInput = container.querySelector('input[aria-label="End date"]') as HTMLInputElement;
    await act(async () => {
      setInputValue(startInput, '2020-12-31');
      setInputValue(endInput, '2020-01-01');
    });
    const fetchBtn = findFetchButton(container);
    expect(fetchBtn?.disabled).toBe(true);

    root.unmount();
    document.body.removeChild(container);
  });

  it('passes the chosen date range to fetchSite', async () => {
    mockFetchSite.mockResolvedValue({ ok: true, source: 'rest', truncated: false, result: SUCCESS_RESULT });

    const { container, root } = renderTab();
    await renderImportTab(root);

    const input = container.querySelector('input[placeholder*="https://old-site.example"]') as HTMLInputElement;
    const startInput = container.querySelector('input[aria-label="Start date"]') as HTMLInputElement;
    const endInput = container.querySelector('input[aria-label="End date"]') as HTMLInputElement;
    await act(async () => {
      setInputValue(input, 'https://site.example');
      setInputValue(startInput, '2020-01-01');
      setInputValue(endInput, '2020-01-31');
    });
    await act(async () => {
      findFetchButton(container)?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockFetchSite).toHaveBeenCalledWith(
      'https://site.example',
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ startDate: '2020-01-01', endDate: '2020-01-31' }),
    );

    root.unmount();
    document.body.removeChild(container);
  });
});

describe('ImportTab saved-site dropdown', () => {
  beforeEach(() => window.localStorage.clear());

  async function seedProfile(domain: string) {
    saveSiteProfile(domain, { version: 1 } as any);
  }

  it('lists saved-site profiles on focus, with a Saved hint', async () => {
    await seedProfile('saved.example');

    const { container, root } = renderTab();
    await renderImportTab(root);

    const input = container.querySelector('input[aria-label="Site URL"]') as HTMLInputElement;
    expect(input).toBeDefined();
    await act(async () => {
      input.focus();
    });

    const options = Array.from(container.querySelectorAll('[role="option"]'));
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain('saved.example');
    expect(options[0].textContent).toContain('Saved');

    root.unmount();
    document.body.removeChild(container);
  });

  it('filters the dropdown as the user types', async () => {
    await seedProfile('alpha.example');
    await seedProfile('beta.example');

    const { container, root } = renderTab();
    await renderImportTab(root);

    const input = container.querySelector('input[aria-label="Site URL"]') as HTMLInputElement;
    await act(async () => {
      input.focus();
    });
    await act(async () => {
      setInputValue(input, 'alpha');
    });

    const options = Array.from(container.querySelectorAll('[role="option"]'));
    expect(options.map((o) => o.textContent)).toEqual([expect.stringContaining('alpha.example')]);

    root.unmount();
    document.body.removeChild(container);
  });

  it('picks a profile with the arrow keys and Enter, filling the URL', async () => {
    window.localStorage.setItem(
      'relay_site_v1_alpha.example',
      JSON.stringify({ version: 1, domain: 'alpha.example', savedAt: '2026-01-01T00:00:00Z', data: { version: 1 } }),
    );
    window.localStorage.setItem(
      'relay_site_v1_beta.example',
      JSON.stringify({ version: 1, domain: 'beta.example', savedAt: '2026-01-02T00:00:00Z', data: { version: 1 } }),
    );

    const { container, root } = renderTab();
    await renderImportTab(root);

    const input = container.querySelector('input[aria-label="Site URL"]') as HTMLInputElement;
    await act(async () => {
      input.focus();
    });
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(input.value).toBe('https://beta.example');
    expect(container.querySelectorAll('[role="option"]').length).toBe(0);

    root.unmount();
    document.body.removeChild(container);
  });

  it('picks a profile by clicking it', async () => {
    await seedProfile('clicked.example');

    const { container, root } = renderTab();
    await renderImportTab(root);

    const input = container.querySelector('input[aria-label="Site URL"]') as HTMLInputElement;
    await act(async () => {
      input.focus();
    });
    await act(async () => {
      (container.querySelector('[role="option"]') as HTMLElement).click();
    });

    expect(input.value).toBe('https://clicked.example');

    root.unmount();
    document.body.removeChild(container);
  });

  it('closes the dropdown with Escape', async () => {
    await seedProfile('saved.example');

    const { container, root } = renderTab();
    await renderImportTab(root);

    const input = container.querySelector('input[aria-label="Site URL"]') as HTMLInputElement;
    await act(async () => {
      input.focus();
    });
    expect(container.querySelectorAll('[role="option"]').length).toBeGreaterThan(0);

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(container.querySelectorAll('[role="option"]').length).toBe(0);

    root.unmount();
    document.body.removeChild(container);
  });
});

describe('ImportTab new site taxonomies — WordPress taxonomy domain', () => {
  it('lets the user set the WordPress taxonomy domain for a manually-created target table', async () => {
    mockFetchSite.mockResolvedValue({ ok: true, source: 'rest', truncated: false, result: SUCCESS_RESULT });

    const { container, root } = renderTab();
    await renderImportTab(root);
    await fetchSource(container, 'https://news.example.com');

    const newTaxonomiesTabBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.startsWith('New site taxonomies')) as HTMLButtonElement;
    await act(async () => { newTaxonomiesTabBtn.click(); });

    const addTableBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === '+ Add Table') as HTMLButtonElement;
    await act(async () => { addTableBtn.click(); });

    expect(container.textContent).toContain('Set this to the real WordPress taxonomy');

    const domainInput = container.querySelector('input[placeholder="category"]') as HTMLInputElement;
    expect(domainInput).toBeDefined();

    await act(async () => {
      setInputValue(domainInput, 'category');
    });

    expect((container.querySelector('input[placeholder="category"]') as HTMLInputElement).value).toBe('category');
    expect(container.textContent).not.toContain('Set this to the real WordPress taxonomy');

    root.unmount();
    document.body.removeChild(container);
  });
});
