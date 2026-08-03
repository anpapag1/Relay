// src/features/articles/ArticleDrawer.tsx
import React, { useMemo } from 'react';
import { useAppState } from '../../state/AppStateContext';
import type { DerivedArticle } from '../../state/types';
import { getArticlePreviewHtml } from '../../state/selectors';
import { buildAttachmentIndex } from '../../core/media/attachmentIndex';
import { useArticleDraft } from './useArticleDraft';
import { useFeaturedImage } from './useFeaturedImage';
import { useDrawerNavigationGuard } from './useDrawerNavigationGuard';
import { useScrollManagement } from './useScrollManagement';
import { ArticlePreviewPane } from './ArticlePreviewPane';
import { ArticleSidebar } from './ArticleSidebar';
import { DiscardConfirmDialog } from './DiscardConfirmDialog';

export interface ArticleDrawerProps {
  article: DerivedArticle | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export const ArticleDrawer: React.FC<ArticleDrawerProps> = ({
  article,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}) => {
  const { state, dispatch } = useAppState();

  const converted = useMemo(() => {
    if (!article) return { html: '', warnings: [] as string[] };
    return getArticlePreviewHtml(article, article.editedHtml, state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article, state.settings, state.builderId]);

  const { draftHtml, isDirty, handleTextChange, handleSave, handleRevert } = useArticleDraft(
    article,
    converted.html,
    dispatch,
  );

  const attachmentIndex = useMemo(
    () => buildAttachmentIndex(state.source?.attachments ?? []),
    [state.source],
  );
  const { featuredImageUrl, featuredImageLoading } = useFeaturedImage(article, attachmentIndex);

  const { pendingAction, requestClose, requestPrev, requestNext, confirmDiscard, cancelDiscard } =
    useDrawerNavigationGuard({ article, isDirty, hasPrev, hasNext, onClose, onPrev, onNext });

  const { mainScrollRef, sidebarScrollRef, scrollToTop } = useScrollManagement(article);

  if (!article) return null;

  const handleToggleInclude = () => {
    const isExcluded = article.status.startsWith('excluded');
    dispatch({ type: 'SET_ARTICLE_EXCLUDED', articleId: article.id, excluded: !isExcluded });
  };

  const handleToggleManualReview = () => {
    dispatch({ type: 'SET_ARTICLE_MANUAL_REVIEW', articleId: article.id, manualReview: !article.isManualReview });
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'oklch(0% 0 0 / 0.3)',
          zIndex: 50,
          display: 'flex',
        }}
        onClick={requestClose}
      >
        <ArticlePreviewPane
          article={article}
          previewMode={state.ui.previewMode}
          draftHtml={draftHtml}
          onDraftChange={handleTextChange}
          onRevert={handleRevert}
          hasPrev={hasPrev}
          hasNext={hasNext}
          onPrev={requestPrev}
          onNext={requestNext}
          onScrollToTop={() => scrollToTop()}
          scrollRef={mainScrollRef}
          dispatch={dispatch}
        />

        <ArticleSidebar
          article={article}
          featuredImageUrl={featuredImageUrl}
          featuredImageLoading={featuredImageLoading}
          isDirty={isDirty}
          onSave={handleSave}
          onClose={requestClose}
          onToggleInclude={handleToggleInclude}
          onToggleManualReview={handleToggleManualReview}
          scrollRef={sidebarScrollRef}
        />
      </div>

      <DiscardConfirmDialog pendingAction={pendingAction} onCancel={cancelDiscard} onConfirm={confirmDiscard} />
    </>
  );
};
