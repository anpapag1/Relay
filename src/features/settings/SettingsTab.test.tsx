/** @jsxImportSource react */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AppStateProvider } from '../../state/AppStateContext';
import { SettingsTab } from './SettingsTab';
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
      creator: 'a', contentHtml: '<p>Alpha content</p>', excerptHtml: '', terms: [], postmeta: {},
    },
  ],
  attachments: [],
  taxonomies: {},
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

describe('SettingsTab live preview', () => {
  it('renders real Gutenberg block markup, not a hand-mocked approximation', async () => {
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false} initialStateOverride={stateWithImport()}>
          <SettingsTab />
        </AppStateProvider>,
      );
    });

    const preview = container.querySelector('.wp-preview');
    expect(preview).not.toBeNull();
    // writeBlocks emits Gutenberg HTML comments around every block — a
    // hand-mocked preview never produced these.
    expect(preview!.innerHTML).toContain('<!-- wp:heading');
    expect(preview!.innerHTML).toContain('<!-- wp:paragraph');
    expect(preview!.innerHTML).toContain('<!-- wp:image');
  });

  it('reacts to the buttonRender setting, matching the real writeButton output', async () => {
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false} initialStateOverride={stateWithImport()}>
          <SettingsTab />
        </AppStateProvider>,
      );
    });

    const preview = () => container.querySelector('.wp-preview')!;
    expect(preview().innerHTML).toContain('wp-block-buttons');

    const buttonSection = Array.from(container.querySelectorAll('div')).find((el) => el.textContent === 'Buttons render as')?.parentElement;
    const linkOption = Array.from(buttonSection?.querySelectorAll('button') ?? []).find((b) => b.textContent === 'Text link');
    expect(linkOption).toBeDefined();
    await act(async () => { linkOption?.click(); });

    expect(preview().innerHTML).not.toContain('wp-block-buttons');
    expect(preview().innerHTML).toContain('Read full report');
  });

  it('combines the two consecutive sample photos into a wp:gallery when the toggle is on', async () => {
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false} initialStateOverride={stateWithImport()}>
          <SettingsTab />
        </AppStateProvider>,
      );
    });

    const preview = () => container.querySelector('.wp-preview')!;
    expect(preview().innerHTML).not.toContain('wp:gallery');

    const toggle = Array.from(container.querySelectorAll('input[type="checkbox"]')).find(
      (el) => el.closest('div')?.textContent?.includes('Combine consecutive photos'),
    ) as HTMLInputElement;
    expect(toggle).toBeDefined();
    await act(async () => { toggle.click(); });

    expect(preview().innerHTML).toContain('wp:gallery');
  });

  it('shows custom width/height inputs only when image size is set to Custom', async () => {
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false} initialStateOverride={stateWithImport()}>
          <SettingsTab />
        </AppStateProvider>,
      );
    });

    expect(container.textContent).not.toContain('Width (px)');

    const sizeSelect = Array.from(container.querySelectorAll('select')).find(
      (el) => el.querySelector('option[value="custom"]'),
    ) as HTMLSelectElement;
    expect(sizeSelect).toBeDefined();

    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!;
      nativeSetter.call(sizeSelect, 'custom');
      sizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.textContent).toContain('Width (px)');
    expect(container.textContent).toContain('Height (px)');
    expect(container.textContent).not.toContain('Gallery columns');
  });
});
