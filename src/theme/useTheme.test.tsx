/** @jsxImportSource react */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ThemeProvider, useTheme } from './useTheme';

let container: HTMLDivElement;
let root: Root;

function Probe() {
  const { preference, resolved } = useTheme();
  return (
    <div>
      <span data-testid="pref">{preference}</span>
      <span data-testid="resolved">{resolved}</span>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
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

describe('ThemeProvider', () => {
  it('defaults to the OS preference and applies data-theme to <html>', async () => {
    await act(async () => {
      root.render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>,
      );
    });

    const pref = container.querySelector('[data-testid="pref"]')?.textContent;
    expect(pref).toBe('system');
    const theme = document.documentElement.getAttribute('data-theme');
    expect(theme === 'light' || theme === 'dark').toBe(true);
  });

  it('persists an explicit choice to localStorage and honors it', async () => {
    localStorage.setItem('relay-theme', 'dark');
    await act(async () => {
      root.render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>,
      );
    });

    expect(container.querySelector('[data-testid="pref"]')?.textContent).toBe('dark');
    expect(container.querySelector('[data-testid="resolved"]')?.textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});