/** @jsxImportSource react */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ArticleSidebar } from './ArticleSidebar';
import * as debugPayload from './debugPayload';
import type { DerivedArticle } from '../../state/types';
import type { NewSiteTerm } from '../../types/domain';

vi.mock('./debugPayload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./debugPayload')>();
  return { ...actual, downloadJson: vi.fn() };
});

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
    contentHtml: '<p>Hello</p>',
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

const CATEGORY_OPTIONS: NewSiteTerm[] = [
  { id: 'c1', name: 'News', slug: 'news' },
  { id: 'c2', name: 'Press', slug: 'press' },
];
const TAG_OPTIONS: NewSiteTerm[] = [{ id: 't1', name: 'React', slug: 'react' }];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  vi.mocked(debugPayload.downloadJson).mockClear();
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  document.body.removeChild(container);
});

function renderSidebar(overrides: Partial<Parameters<typeof ArticleSidebar>[0]> = {}) {
  const onSaveMetadata = vi.fn();
  const base = {
    article: makeArticle(),
    featuredImageUrl: null,
    featuredImageLoading: false,
    isDirty: false,
    afterHtml: '',
    draftHtml: '',
    onSave: vi.fn(),
    onClose: vi.fn(),
    onSaveMetadata,
    onToggleInclude: vi.fn(),
    onToggleManualReview: vi.fn(),
    scrollRef: { current: null },
    categoryOptions: CATEGORY_OPTIONS,
    tagOptions: TAG_OPTIONS,
    builder: null,
    settings: {} as Parameters<typeof ArticleSidebar>[0]['settings'],
  };
  const props = { ...base, ...overrides };
  act(() => {
    root.render(
      <ArticleSidebar
        article={props.article}
        featuredImageUrl={props.featuredImageUrl}
        featuredImageLoading={props.featuredImageLoading}
        isDirty={props.isDirty}
        afterHtml={props.afterHtml}
        draftHtml={props.draftHtml}
        onSave={props.onSave}
        onClose={props.onClose}
        onSaveMetadata={props.onSaveMetadata}
        onToggleInclude={props.onToggleInclude}
        onToggleManualReview={props.onToggleManualReview}
        scrollRef={props.scrollRef}
        categoryOptions={props.categoryOptions}
        tagOptions={props.tagOptions}
        builder={props.builder}
        settings={props.settings}
      />,
    );
  });
  return { onSaveMetadata, props };
}

function findByText(text: string) {
  return Array.from(container.querySelectorAll('button, div, b, span')).find((el) => el.textContent?.trim() === text) as HTMLElement | undefined;
}

function findButtonByText(text: string) {
  return Array.from(container.querySelectorAll('button')).find((el) => el.textContent?.trim() === text) as HTMLButtonElement | undefined;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  act(() => {
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('ArticleSidebar metadata edit', () => {
  it('shows the current new slug, category and tags read-only', async () => {
    const article = makeArticle({
      postName: 'my-slug',
      destinationTerms: [
        { domain: 'category', nicename: 'news', name: 'News', sourceDomain: 'category' },
        { domain: 'post_tag', nicename: 'react', name: 'React', sourceDomain: 'post_tag' },
      ],
    });
    renderSidebar({ article });

    const gridText = container.textContent ?? '';
    expect(gridText).toContain('my-slug');
    expect(gridText).toContain('News');
    expect(gridText).toContain('React');
  });

  it('pre-checks the current categories and tags when editing starts', async () => {
    const article = makeArticle({
      destinationTerms: [
        { domain: 'category', nicename: 'news', name: 'News', sourceDomain: 'category' },
        { domain: 'post_tag', nicename: 'react', name: 'React', sourceDomain: 'post_tag' },
      ],
    });
    renderSidebar({ article });

    await act(async () => {
      findByText('Edit metadata')?.click();
    });

    const checked = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).filter((c) => c.checked);
    expect(checked.map((c) => c.value)).toEqual(['c1', 't1']);
  });

  it('saves the edited slug (slugified) and the picked category/tag ids', async () => {
    const { onSaveMetadata } = renderSidebar();

    await act(async () => {
      findByText('Edit metadata')?.click();
    });

    const slugInput = container.querySelector<HTMLInputElement>('input[placeholder="new-site-slug"]')!;
    setInputValue(slugInput, 'My Brand-New Slug!');

    const checkboxes = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    await act(async () => {
      checkboxes.find((c) => c.value === 'c2')?.click();
      checkboxes.find((c) => c.value === 't1')?.click();
    });

    await act(async () => {
      findByText('Save')?.click();
    });

    expect(onSaveMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Article',
        postDate: '2026-01-01',
        newSlug: 'my-brand-new-slug',
        categoryIds: ['c2'],
        tagIds: ['t1'],
      }),
    );
  });

  it('clears the override fields when the user unchecks everything and saves', async () => {
    const article = makeArticle({
      destinationTerms: [
        { domain: 'category', nicename: 'news', name: 'News', sourceDomain: 'category' },
        { domain: 'post_tag', nicename: 'react', name: 'React', sourceDomain: 'post_tag' },
      ],
    });
    const { onSaveMetadata } = renderSidebar({ article });

    await act(async () => {
      findByText('Edit metadata')?.click();
    });

    const checkboxes = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    await act(async () => {
      checkboxes.filter((c) => c.checked).forEach((c) => c.click());
    });

    await act(async () => {
      findByText('Save')?.click();
    });

    expect(onSaveMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ categoryIds: [], tagIds: [] }),
    );
  });

  it('cancelling does not save and restores the read-only view', async () => {
    const { onSaveMetadata } = renderSidebar();

    await act(async () => {
      findByText('Edit metadata')?.click();
    });
    await act(async () => {
      findByText('Cancel')?.click();
    });

    expect(onSaveMetadata).not.toHaveBeenCalled();
    expect(findByText('Edit metadata')).toBeDefined();
  });
});

describe('ArticleSidebar debug copy', () => {
  it('shows a "There is a problem with this article" button', async () => {
    renderSidebar();
    expect(findButtonByText('There is a problem with this article')).toBeDefined();
  });

  it('reveals a problem textarea with Submit and Cancel when clicked', async () => {
    renderSidebar();

    await act(async () => {
      findButtonByText('There is a problem with this article')?.click();
    });

    expect(container.querySelector('textarea[placeholder*="What looks wrong"]')).not.toBeNull();
    expect(findButtonByText('Submit for debugging')).toBeDefined();
    expect(findButtonByText('Cancel')).toBeDefined();
    expect(findButtonByText('There is a problem with this article')).toBeUndefined();
  });

  it('downloads a JSON debug payload with the problem description on submit', async () => {
    renderSidebar({ afterHtml: '<p>Converted after</p>', draftHtml: '<p>Edited in drawer</p>' });

    await act(async () => {
      findButtonByText('There is a problem with this article')?.click();
    });
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea[placeholder*="What looks wrong"]')!;
    setTextareaValue(textarea, 'the image does not load');

    await act(async () => {
      findButtonByText('Submit for debugging')?.click();
    });

    expect(debugPayload.downloadJson).toHaveBeenCalledTimes(1);
    expect(debugPayload.downloadJson).toHaveBeenCalledWith(
      'relay-debug-test-article-1.json',
      expect.objectContaining({
        problem: 'the image does not load',
        content: { before: '<p>Hello</p>', after: '<p>Converted after</p>', draft: '<p>Edited in drawer</p>' },
        article: expect.objectContaining({ title: 'Test Article' }),
      }),
    );
    expect(container.textContent).toContain('Send this file to the dev to patch the problem.');
  });

  it('Cancel collapses the form without downloading', async () => {
    renderSidebar();

    await act(async () => {
      findButtonByText('There is a problem with this article')?.click();
    });
    await act(async () => {
      findButtonByText('Cancel')?.click();
    });

    expect(debugPayload.downloadJson).not.toHaveBeenCalled();
    expect(findButtonByText('There is a problem with this article')).toBeDefined();
    expect(container.textContent).not.toContain('Send this file to the dev to patch the problem.');
  });
});