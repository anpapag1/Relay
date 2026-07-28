/** @jsxImportSource react */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AppStateProvider } from '../../state/AppStateContext';
import { ArticleDrawer } from './ArticleDrawer';
import type { DerivedArticle } from '../../state/types';

function makeArticle(overrides: Partial<DerivedArticle> = {}): DerivedArticle {
  return {
    id: 1,
    postId: 1,
    postType: 'post',
    status: 'ready',
    title: 'Test Article',
    link: 'https://old.example/test/',
    postDate: '2026-01-01',
    postName: 'test-article',
    creator: 'alice',
    contentHtml: '<!-- wp:paragraph -->\n<p>Hello world</p>\n<!-- /wp:paragraph -->',
    excerptHtml: '',
    terms: [],
    postmeta: {},
    warnings: [],
    isEdited: false,
    isExcluded: false,
    ...overrides,
  };
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

describe('ArticleDrawer preview pane', () => {
  it('renders the article content inside the preview pane', async () => {
    const article = makeArticle();
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false}>
          <ArticleDrawer article={article} onClose={vi.fn()} onPrev={vi.fn()} onNext={vi.fn()} hasPrev={false} hasNext={false} />
        </AppStateProvider>,
      );
    });
    const preview = container.querySelector('.wp-preview');
    expect(preview).not.toBeNull();
    expect(preview?.textContent).toContain('Hello world');
  });

  it('shows a placeholder when there is no content to preview', async () => {
    const article = makeArticle({ contentHtml: '' });
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false}>
          <ArticleDrawer article={article} onClose={vi.fn()} onPrev={vi.fn()} onNext={vi.fn()} hasPrev={false} hasNext={false} />
        </AppStateProvider>,
      );
    });
    expect(container.textContent).toContain('Nothing to preview yet');
  });
});

describe('ArticleDrawer navigation buttons', () => {
  it('calls onPrev/onNext when clicked and not dirty', async () => {
    const article = makeArticle();
    const onPrev = vi.fn();
    const onNext = vi.fn();
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false}>
          <ArticleDrawer article={article} onClose={vi.fn()} onPrev={onPrev} onNext={onNext} hasPrev={true} hasNext={true} />
        </AppStateProvider>,
      );
    });
    const prevBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Previous'));
    const nextBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Next'));
    expect(prevBtn).toBeDefined();
    expect(nextBtn).toBeDefined();

    await act(async () => { prevBtn?.click(); });
    expect(onPrev).toHaveBeenCalledTimes(1);

    await act(async () => { nextBtn?.click(); });
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('disables Previous when hasPrev is false and Next when hasNext is false', async () => {
    const article = makeArticle();
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false}>
          <ArticleDrawer article={article} onClose={vi.fn()} onPrev={vi.fn()} onNext={vi.fn()} hasPrev={false} hasNext={false} />
        </AppStateProvider>,
      );
    });
    const prevBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Previous')) as HTMLButtonElement;
    const nextBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Next')) as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(true);
  });

  it('shows the discard-confirm dialog instead of navigating when there is an unsaved edit', async () => {
    const article = makeArticle();
    const onNext = vi.fn();
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false}>
          <ArticleDrawer article={article} onClose={vi.fn()} onPrev={vi.fn()} onNext={onNext} hasPrev={true} hasNext={true} />
        </AppStateProvider>,
      );
    });
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      )!.set!;
      nativeInputValueSetter.call(textarea, '<p>edited</p>');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const nextBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Next'));
    await act(async () => { nextBtn?.click(); });

    expect(onNext).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Discard unsaved edit?');

    const discardBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Discard'));
    await act(async () => { discardBtn?.click(); });
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

describe('ArticleDrawer keyboard navigation', () => {
  it('navigates with ArrowLeft/ArrowRight when focus is not in a text field', async () => {
    const article = makeArticle();
    const onPrev = vi.fn();
    const onNext = vi.fn();
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false}>
          <ArticleDrawer article={article} onClose={vi.fn()} onPrev={onPrev} onNext={onNext} hasPrev={true} hasNext={true} />
        </AppStateProvider>,
      );
    });

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(onNext).toHaveBeenCalledTimes(1);

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    });
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('ignores ArrowLeft/ArrowRight while focus is inside the HTML textarea', async () => {
    const article = makeArticle();
    const onNext = vi.fn();
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false}>
          <ArticleDrawer article={article} onClose={vi.fn()} onPrev={vi.fn()} onNext={onNext} hasPrev={true} hasNext={true} />
        </AppStateProvider>,
      );
    });
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    textarea.focus();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(onNext).not.toHaveBeenCalled();
  });

  it('removes the keydown listener when the drawer closes (article becomes null)', async () => {
    const article = makeArticle();
    const onNext = vi.fn();
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false}>
          <ArticleDrawer article={article} onClose={vi.fn()} onPrev={vi.fn()} onNext={onNext} hasPrev={true} hasNext={true} />
        </AppStateProvider>,
      );
    });
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false}>
          <ArticleDrawer article={null} onClose={vi.fn()} onPrev={vi.fn()} onNext={onNext} hasPrev={true} hasNext={true} />
        </AppStateProvider>,
      );
    });
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(onNext).not.toHaveBeenCalled();
  });
});
