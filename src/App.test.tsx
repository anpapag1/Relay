/** @jsxImportSource react */
import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

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
});
