/** @jsxImportSource react */
import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { FetchProgressBar } from './FetchProgressBar';
import type { FetchSiteProgress } from '../../core/site/fetchSite';

function renderBar(progress: FetchSiteProgress | null) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<FetchProgressBar progress={progress} />);
  });
  return { container, root };
}

function fillWidth(container: HTMLDivElement): string | null {
  return Array.from(container.querySelectorAll('div')).find((el) => (el as HTMLElement).style.width)?.style.width ?? null;
}

describe('FetchProgressBar', () => {
  it('renders nothing when there is no progress', () => {
    const { container, root } = renderBar(null);
    expect(container.textContent).toBe('');
    root.unmount();
    document.body.removeChild(container);
  });

  it('shows a determinate bar with percentage during the posts stage', () => {
    const { container, root } = renderBar({ stage: 'posts', fetched: 2, total: 4 });
    expect(container.textContent).toContain('Fetching posts (2/4)…');
    expect(container.textContent).toContain('50%');
    expect(fillWidth(container)).toBe('50%');
    expect(container.querySelector('.progress-indeterminate')).toBeNull();
    root.unmount();
    document.body.removeChild(container);
  });

  it('shows an indeterminate bar while probing', () => {
    const { container, root } = renderBar({ stage: 'probe', fetched: 0, total: null });
    expect(container.textContent).toContain('Detecting REST API or feed…');
    expect(container.querySelector('.progress-indeterminate')).toBeDefined();
    expect(fillWidth(container)).toBeNull();
    root.unmount();
    document.body.removeChild(container);
  });

  it('shows a determinate bar during the media stage', () => {
    const { container, root } = renderBar({ stage: 'media', fetched: 3, total: 5 });
    expect(container.textContent).toContain('Resolving featured images (3/5)');
    expect(container.textContent).toContain('60%');
    expect(fillWidth(container)).toBe('60%');
    root.unmount();
    document.body.removeChild(container);
  });

  it('shows an indeterminate bar when the RSS post count is unknown', () => {
    const { container, root } = renderBar({ stage: 'posts', fetched: 3, total: null });
    expect(container.textContent).toContain('Fetched 3 posts…');
    expect(container.querySelector('.progress-indeterminate')).toBeDefined();
    root.unmount();
    document.body.removeChild(container);
  });

  it('caps the fill at 100% when fetched exceeds the total', () => {
    const { container, root } = renderBar({ stage: 'media', fetched: 7, total: 5 });
    expect(container.textContent).toContain('100%');
    expect(fillWidth(container)).toBe('100%');
    root.unmount();
    document.body.removeChild(container);
  });
});