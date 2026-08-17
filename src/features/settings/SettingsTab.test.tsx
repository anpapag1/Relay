/** @jsxImportSource react */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  vi.unstubAllGlobals();
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

  it('embeds a real self-contained PDF instead of pointing at a URL that can never resolve', async () => {
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false} initialStateOverride={stateWithImport()}>
          <SettingsTab />
        </AppStateProvider>,
      );
    });

    const embed = container.querySelector('.wp-block-file__embed') as HTMLObjectElement | null;
    expect(embed).not.toBeNull();
    expect(embed!.getAttribute('data')).toMatch(/^data:application\/pdf;base64,/);
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
  });

  it('renders the fallback featured image section with URL input and upload label when nothing is set', async () => {
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false} initialStateOverride={stateWithImport()}>
          <SettingsTab />
        </AppStateProvider>,
      );
    });

    expect(container.textContent).toContain('Fallback article featured image');
    expect(container.textContent).toContain('Articles with no featured image of their own get this one.');

    const urlInput = container.querySelector('input[type="text"]') as HTMLInputElement | null;
    expect(urlInput).not.toBeNull();
    expect(urlInput!.placeholder).toBe('https://example.com/fallback.jpg');
    expect(urlInput!.value).toBe('');

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    expect(fileInput!.accept).toBe('image/*');
    expect(fileInput!.closest('label')?.textContent).toContain('Upload image');

    expect(container.textContent).not.toContain("won't be exported");
    expect(container.querySelector('img[alt="Fallback image preview"]')).toBeNull();
  });

  it('shows the preview and export warning after choosing an uploaded fallback image', async () => {
    const FakeFileReader = vi.fn().mockImplementation(function (this: any) {
      this.onload = null;
      this.readAsDataURL = () => {
        this.result = 'data:image/png;base64,AAA';
        if (this.onload) this.onload();
      };
    });
    vi.stubGlobal('FileReader', FakeFileReader);

    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false} initialStateOverride={stateWithImport()}>
          <SettingsTab />
        </AppStateProvider>,
      );
    });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();
    Object.defineProperty(fileInput!, 'files', { value: [new File(['x'], 'test.png', { type: 'image/png' })] });
    await act(async () => {
      fileInput!.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(FakeFileReader).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("won't be exported");
    expect(container.textContent).toContain("images can't be saved in a JSON file");

    const preview = container.querySelector('img[alt="Fallback image preview"]') as HTMLImageElement | null;
    expect(preview).not.toBeNull();
    expect(preview!.getAttribute('src')).toBe('data:image/png;base64,AAA');

    const fileInputAfter = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInputAfter!.closest('label')?.textContent).toContain('Replace image');
  });

  it('does not show the export warning when only the URL is set', async () => {
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false} initialStateOverride={stateWithImport()}>
          <SettingsTab />
        </AppStateProvider>,
      );
    });

    const urlInput = container.querySelector('input[type="text"]') as HTMLInputElement | null;
    expect(urlInput).not.toBeNull();
    await act(async () => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      nativeSetter.call(urlInput, 'https://example.com/fallback.jpg');
      urlInput!.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(urlInput!.value).toBe('https://example.com/fallback.jpg');
    expect(container.textContent).not.toContain("won't be exported");
    expect(container.querySelector('img[alt="Fallback image preview"]')).toBeNull();
  });
});
