/** @jsxImportSource react */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useArticleDraft, type UseArticleDraftResult } from './useArticleDraft';
import type { DerivedArticle } from '../../state/types';
import type { Action } from '../../state/actions';

function makeArticle(overrides: Partial<DerivedArticle> = {}): DerivedArticle {
  return {
    id: 1,
    postId: 1,
    postType: 'post',
    status: 'ready',
    title: 'Test',
    link: null,
    postDate: '',
    postName: '',
    creator: '',
    contentHtml: '<p>orig</p>',
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
  } as DerivedArticle;
}

let container: HTMLDivElement;
let root: Root;
let lastResult: UseArticleDraftResult | null = null;
let dispatched: Action[] = [];

function Harness({ article, previewHtml }: { article: DerivedArticle | null; previewHtml: string }) {
  lastResult = useArticleDraft(article, previewHtml, (a: Action) => {
    dispatched.push(a);
  });
  return null;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  lastResult = null;
  dispatched = [];
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  document.body.removeChild(container);
});

describe('useArticleDraft', () => {
  it('seeds draftHtml from the converted preview and starts clean', async () => {
    await act(async () => {
      root.render(<Harness article={makeArticle()} previewHtml="<p>converted</p>" />);
    });
    expect(lastResult?.draftHtml).toBe('<p>converted</p>');
    expect(lastResult?.isDirty).toBe(false);
  });

  it('marks dirty when the draft diverges from the original content, and dispatches SAVE_ARTICLE_EDIT on save', async () => {
    await act(async () => {
      root.render(<Harness article={makeArticle()} previewHtml="<p>converted</p>" />);
    });
    await act(async () => {
      lastResult!.handleTextChange({ target: { value: '<p>edited</p>' } } as React.ChangeEvent<HTMLTextAreaElement>);
    });
    expect(lastResult?.isDirty).toBe(true);

    await act(async () => {
      lastResult!.handleSave();
    });
    expect(dispatched).toEqual([{ type: 'SAVE_ARTICLE_EDIT', articleId: 1, editedHtml: '<p>edited</p>' }]);
    expect(lastResult?.isDirty).toBe(false);
  });

  it('dispatches REVERT_ARTICLE_EDIT on revert', async () => {
    await act(async () => {
      root.render(<Harness article={makeArticle()} previewHtml="<p>converted</p>" />);
    });
    await act(async () => {
      lastResult!.handleRevert();
    });
    expect(dispatched).toEqual([{ type: 'REVERT_ARTICLE_EDIT', articleId: 1 }]);
  });
});
