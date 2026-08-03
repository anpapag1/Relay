/** @jsxImportSource react */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// Mocked so no test in this file makes a real network call for the image
// health check; each test controls its own resolved value.
vi.mock('./core/media/verifyImages', () => ({
  verifyResolvedImages: vi.fn(),
}));
import { verifyResolvedImages } from './core/media/verifyImages';

beforeEach(() => {
  vi.mocked(verifyResolvedImages).mockReset();
  vi.mocked(verifyResolvedImages).mockResolvedValue({});
});

describe('App UI & Workflow', () => {
  it('renders app, imports sample WXR, navigates all tabs, starts build', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    expect(container.textContent).toContain('Relay');
    expect(container.textContent).toContain('Drop your WordPress export here');

    // Load sample WXR
    const sampleBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Use a sample export instead'),
    );
    expect(sampleBtn).toBeDefined();

    await act(async () => {
      sampleBtn?.click();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(container.textContent).toContain('Import detected');
    expect(container.textContent).toContain('sample-old-site.xml');

    // Old-site tables start empty until the reconciliation hint is accepted
    const addMissingBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Add',
    );
    expect(addMissingBtn).toBeDefined();
    await act(async () => { addMissingBtn?.click(); });

    // Mappings tab
    const mappingsTabBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Mappings',
    );
    expect(mappingsTabBtn).toBeDefined();
    await act(async () => { mappingsTabBtn?.click(); });
    expect(container.textContent).toContain('Map taxonomies');

    // Settings tab
    const settingsTabBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Settings',
    );
    expect(settingsTabBtn).toBeDefined();
    await act(async () => { settingsTabBtn?.click(); });
    expect(container.textContent).toContain('Conversion settings');
    expect(container.textContent).toContain('Live preview');

    // Articles tab
    const articlesTabBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Articles',
    );
    expect(articlesTabBtn).toBeDefined();
    await act(async () => { articlesTabBtn?.click(); });
    expect(container.textContent).toContain('Articles');
    expect(container.textContent).toContain('Needs review');

    // Build tab
    const buildTabBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Build & Export',
    );
    expect(buildTabBtn).toBeDefined();
    await act(async () => { buildTabBtn?.click(); });
    expect(container.textContent).toContain('Build & export');
    expect(container.textContent).toContain('Check for problems');

    // Run preflight check — sample WXR has unmapped terms so warnings appear
    const checkBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Run check',
    );
    expect(checkBtn).toBeDefined();
    await act(async () => { checkBtn?.click(); });
    expect(container.textContent).toContain('Unmapped taxonomy term');

    // Click Build now — verify the progress UI appears (build is async, we
    // don't wait for completion here; runBuild is unit-tested separately)
    const buildNowBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Build now',
    );
    expect(buildNowBtn).toBeDefined();
    await act(async () => { buildNowBtn?.click(); });
    // act() drains all microtasks so the build completes synchronously in tests
    expect(container.textContent).toContain('Download WXR file');
    expect(container.textContent).toContain('XML package ready');

    root.unmount();
    document.body.removeChild(container);
  });

  it('completes the image health check even after navigating away from the Import tab', async () => {
    // Regression test: useImageHealthCheck used to live inside ImportTab,
    // which React unmounts the instant the user switches tabs — cancelling
    // the in-flight check (or, on a page reload that restores straight into
    // a different tab, never running it at all). It must now live above the
    // tab switch so it survives navigation.
    // 'https://sample-old-site.com/wp-content/uploads/2026/07/hero-image.jpg'
    // is a real <img src> inside the sample WXR's first article ("Welcome to
    // WordPress Migration with Relay"), so this maps onto a real article's
    // real media ref rather than a synthetic one nothing renders.
    const heroImageUrl = 'https://sample-old-site.com/wp-content/uploads/2026/07/hero-image.jpg';
    vi.mocked(verifyResolvedImages).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                [heroImageUrl]: { outcome: 'matched-export', url: heroImageUrl, verified: 'broken', verifiedReason: '404' },
              }),
            20,
          );
        }),
    );

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    const sampleBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Use a sample export instead'),
    );
    await act(async () => {
      sampleBtn?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(verifyResolvedImages).toHaveBeenCalledTimes(1);

    // Navigate away from Import before the mocked check resolves (its
    // 20ms delay hasn't elapsed yet) — this is what used to cancel it.
    const articlesTabBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent === 'Articles',
    );
    await act(async () => {
      articlesTabBtn?.click();
    });

    // Let the mocked check's delayed resolution land.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Open the affected article's drawer — warnings render as text there.
    const articleRow = Array.from(container.querySelectorAll('*')).find(
      (el) => el.textContent === 'Welcome to WordPress Migration with Relay',
    );
    expect(articleRow).toBeDefined();
    await act(async () => {
      (articleRow as HTMLElement).click();
    });

    expect(container.textContent).toContain('Image link is broken');
    expect(container.textContent).toContain('hero-image.jpg');

    root.unmount();
    document.body.removeChild(container);
  });
});
