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
    infoWarnings: [],
    mediaCount: 0,
    isEdited: false,
    isExcluded: false,
    isManualReview: false,
    destinationTerms: [],
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

  it('shows the auto-exclusion reason in the sidebar instead of the generic text', async () => {
    const article = makeArticle({
      status: 'excluded_auto',
      isExcluded: true,
      statusReason: 'Duplicate slug: "test-article"',
    });
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false}>
          <ArticleDrawer article={article} onClose={vi.fn()} onPrev={vi.fn()} onNext={vi.fn()} hasPrev={false} hasNext={false} />
        </AppStateProvider>,
      );
    });
    expect(container.textContent).toContain('Duplicate slug: "test-article"');
    expect(container.textContent).not.toContain('Currently excluded from exported file');
  });

  it('keeps the generic excluded text when no reason is available', async () => {
    const article = makeArticle({ status: 'excluded_manual', isExcluded: true });
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false}>
          <ArticleDrawer article={article} onClose={vi.fn()} onPrev={vi.fn()} onNext={vi.fn()} hasPrev={false} hasNext={false} />
        </AppStateProvider>,
      );
    });
    expect(container.textContent).toContain('Currently excluded from exported file');
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

describe('ArticleDrawer before/after preview toggle', () => {
  // A bare top-level <img> (no wrapping <p>) is a good differentiator: the
  // "After" reader/writeBlocks pipeline promotes it into a real
  // wp:image/figure block, while "Before" shows the original tag exactly
  // as it appeared in the source — as literal escaped text, not rendered.
  const IMG_HTML = '<img src="https://old.example/photo.jpg" alt="A photo">';

  it('shows the converted ("After") content by default', async () => {
    const article = makeArticle({ contentHtml: IMG_HTML });
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false}>
          <ArticleDrawer article={article} onClose={vi.fn()} onPrev={vi.fn()} onNext={vi.fn()} hasPrev={false} hasNext={false} />
        </AppStateProvider>,
      );
    });
    const preview = container.querySelector('.wp-preview');
    expect(preview?.innerHTML).toContain('wp-block-image');
  });

  it('switches to the raw original HTML when "Before" is clicked, and back to converted on "After"', async () => {
    const article = makeArticle({ contentHtml: IMG_HTML });
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false}>
          <ArticleDrawer article={article} onClose={vi.fn()} onPrev={vi.fn()} onNext={vi.fn()} hasPrev={false} hasNext={false} />
        </AppStateProvider>,
      );
    });

    const beforeBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Before') as HTMLButtonElement;
    await act(async () => { beforeBtn.click(); });

    let preview = container.querySelector('.wp-preview');
    // "Before" shows the raw source as literal escaped text (not rendered
    // HTML), so the original tag reads back via textContent, not as an
    // actual <img> element in the DOM.
    expect(preview?.textContent).toContain(IMG_HTML);
    expect(preview?.querySelector('img')).toBeNull();
    expect(preview?.innerHTML).not.toContain('wp-block-image');

    const afterBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'After') as HTMLButtonElement;
    await act(async () => { afterBtn.click(); });

    preview = container.querySelector('.wp-preview');
    expect(preview?.innerHTML).toContain('wp-block-image');
  });

  it('shows the placeholder for "Before" when the original article has no content', async () => {
    const article = makeArticle({ contentHtml: '' });
    await act(async () => {
      root.render(
        <AppStateProvider enableAutosave={false}>
          <ArticleDrawer article={article} onClose={vi.fn()} onPrev={vi.fn()} onNext={vi.fn()} hasPrev={false} hasNext={false} />
        </AppStateProvider>,
      );
    });
    const beforeBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Before') as HTMLButtonElement;
    await act(async () => { beforeBtn.click(); });
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
    const editBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Edit') as HTMLButtonElement;
    await act(async () => { editBtn.click(); });

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
    const editBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Edit') as HTMLButtonElement;
    await act(async () => { editBtn.click(); });

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
