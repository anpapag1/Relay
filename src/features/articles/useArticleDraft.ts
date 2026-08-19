import { useState, useEffect } from 'react';
import type { DerivedArticle } from '../../state/types';
import type { Action } from '../../state/actions';
import { reportDraftDirty } from '../../state/unsavedChanges';

export interface UseArticleDraftResult {
  draftHtml: string;
  isDirty: boolean;
  handleTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSave: () => void;
  handleRevert: () => void;
  setDraft: (html: string) => void;
}

export function useArticleDraft(
  article: DerivedArticle | null,
  previewHtml: string,
  dispatch: React.Dispatch<Action>,
): UseArticleDraftResult {
  const [draftHtml, setDraftHtml] = useState<string>('');
  const [isDirty, setIsDirty] = useState<boolean>(false);

  useEffect(() => {
    if (article) {
      setDraftHtml(previewHtml);
      setIsDirty(false);
    }
  }, [article, previewHtml]);

  useEffect(() => {
    reportDraftDirty(isDirty);
    return () => reportDraftDirty(false);
  }, [isDirty]);

  const setDraft = (html: string) => {
    setDraftHtml(html);
    setIsDirty(html !== (article?.editedHtml || article?.contentHtml || ''));
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
  };

  const handleSave = () => {
    if (!article) return;
    dispatch({ type: 'SAVE_ARTICLE_EDIT', articleId: article.id, editedHtml: draftHtml });
    setIsDirty(false);
  };

  const handleRevert = () => {
    if (!article) return;
    dispatch({ type: 'REVERT_ARTICLE_EDIT', articleId: article.id });
    setIsDirty(false);
  };

  return { draftHtml, isDirty, handleTextChange, handleSave, handleRevert, setDraft };
}
