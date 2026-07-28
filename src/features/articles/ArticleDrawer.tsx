import React, { useState, useEffect, useMemo } from 'react';
import { useAppState } from '../../state/AppStateContext';
import type { DerivedArticle } from '../../state/types';
import { getArticlePreviewHtml, getFeaturedImageUrl } from '../../state/selectors';
import { Badge } from '../../ui/Badge';

export interface ArticleDrawerProps {
  article: DerivedArticle | null;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

type PendingAction = 'close' | 'prev' | 'next' | null;

export const ArticleDrawer: React.FC<ArticleDrawerProps> = ({
  article,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}) => {
  const { state, dispatch } = useAppState();
  const [draftHtml, setDraftHtml] = useState<string>('');
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const converted = useMemo(() => {
    if (!article) return { html: '', warnings: [] as string[] };
    return getArticlePreviewHtml(article, article.editedHtml, state);
  }, [article, state.settings, state.builderId]);

  const featuredImageUrl = useMemo(() => {
    if (!article) return null;
    return getFeaturedImageUrl(article, state);
  }, [article, state.source]);

  useEffect(() => {
    if (article) {
      setDraftHtml(converted.html);
      setIsDirty(false);
    }
  }, [article, converted.html]);

  const requestClose = () => {
    if (isDirty) {
      setPendingAction('close');
    } else {
      onClose();
    }
  };

  const requestPrev = () => {
    if (!hasPrev) return;
    if (isDirty) {
      setPendingAction('prev');
    } else {
      onPrev();
    }
  };

  const requestNext = () => {
    if (!hasNext) return;
    if (isDirty) {
      setPendingAction('next');
    } else {
      onNext();
    }
  };

  const confirmDiscard = () => {
    const action = pendingAction;
    setPendingAction(null);
    if (action === 'close') onClose();
    else if (action === 'prev') onPrev();
    else if (action === 'next') onNext();
  };

  useEffect(() => {
    if (!article) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const tag = active?.tagName;
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (active instanceof HTMLElement && active.isContentEditable);
      if (isEditable) return;
      if (e.key === 'ArrowLeft') requestPrev();
      else if (e.key === 'ArrowRight') requestNext();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [article, requestPrev, requestNext]);

  if (!article) return null;

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraftHtml(e.target.value);
    setIsDirty(e.target.value !== (article.editedHtml || article.contentHtml || ''));
  };

  const handleSave = () => {
    dispatch({
      type: 'SAVE_ARTICLE_EDIT',
      articleId: article.id,
      editedHtml: draftHtml,
    });
    setIsDirty(false);
  };

  const handleRevert = () => {
    dispatch({
      type: 'REVERT_ARTICLE_EDIT',
      articleId: article.id,
    });
    setIsDirty(false);
  };

  const handleToggleInclude = () => {
    const isExcluded = article.status.startsWith('excluded');
    dispatch({
      type: 'SET_ARTICLE_EXCLUDED',
      articleId: article.id,
      excluded: !isExcluded,
    });
  };

  const isExcluded = article.status.startsWith('excluded');
  const showBefore = state.ui.previewMode === 'before';
  const previewHtml = showBefore ? article.contentHtml : draftHtml;

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
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            overflowY: 'auto',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '900px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>Content before / after</div>
              <div style={{ display: 'flex', gap: '4px', background: 'oklch(30% 0.005 250 / 0.6)', borderRadius: '8px', padding: '3px' }}>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_PREVIEW_MODE', mode: 'before' })}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: showBefore ? 'white' : 'transparent',
                    color: showBefore ? 'oklch(30% 0.02 250)' : 'white',
                    boxShadow: showBefore ? '0 1px 3px oklch(0% 0 0 / 0.1)' : 'none',
                  }}
                >
                  Before
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET_PREVIEW_MODE', mode: 'after' })}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: !showBefore ? 'white' : 'transparent',
                    color: !showBefore ? 'oklch(30% 0.02 250)' : 'white',
                    boxShadow: !showBefore ? '0 1px 3px oklch(0% 0 0 / 0.1)' : 'none',
                  }}
                >
                  After
                </button>
              </div>
            </div>
            <div
              className="wp-preview"
              style={{
                background: 'white',
                borderRadius: '14px',
                boxShadow: '0 12px 40px oklch(0% 0 0 / 0.15)',
                padding: '32px',
                width: '100%',
                height: 'min(700px, calc(100vh - 220px))',
                overflowY: 'auto',
              }}
            >
              {previewHtml.trim() ? (
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : (
                <div className="wp-preview-empty">Nothing to preview yet</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={requestPrev}
                disabled={!hasPrev}
                className="btn btn-secondary"
                style={{ padding: '10px 24px' }}
              >
                ← Previous
              </button>
              <button
                type="button"
                onClick={requestNext}
                disabled={!hasNext}
                className="btn btn-secondary"
                style={{ padding: '10px 24px' }}
              >
                Next →
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            width: '640px',
            maxWidth: '100%',
            height: '100%',
            background: 'white',
            boxShadow: '-8px 0 30px oklch(0% 0 0 / 0.15)',
            overflowY: 'auto',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={(e) => e.stopPropagation()}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div>
              <div style={{ fontSize: '19px', fontWeight: 700 }}>{article.title || '(Untitled)'}</div>
              {article.link && (
                <a href={article.link} target="_blank" rel="noreferrer" style={{ fontSize: '12px' }}>
                  View original article ↗
                </a>
              )}
            </div>
            <button
              type="button"
              onClick={requestClose}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'oklch(55% 0.01 250)', padding: '4px' }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '14px', marginBottom: '18px', background: 'oklch(98% 0.003 250)', padding: '14px', borderRadius: '10px', border: '1px solid oklch(92% 0.005 250)' }}>
            {featuredImageUrl ? (
              <img
                src={featuredImageUrl}
                alt=""
                style={{ width: '100px', height: '70px', borderRadius: '8px', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '100px',
                  height: '70px',
                  borderRadius: '8px',
                  background: 'repeating-linear-gradient(45deg, oklch(93% 0.005 250), oklch(93% 0.005 250) 6px, oklch(96% 0.003 250) 6px, oklch(96% 0.003 250) 12px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  color: 'oklch(55% 0.01 250)',
                  textAlign: 'center',
                }}
              >
                No Featured Image
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
              <div>
                <span style={{ color: 'oklch(55% 0.01 250)' }}>Published</span>
                <br />
                <b>{article.postDate || '—'}</b>
              </div>
              <div>
                <span style={{ color: 'oklch(55% 0.01 250)' }}>New slug</span>
                <br />
                <b style={{ fontFamily: 'monospace' }}>{article.postName || '—'}</b>
              </div>
              <div>
                <span style={{ color: 'oklch(55% 0.01 250)' }}>Category</span>
                <br />
                <b>{article.destinationTerms.filter(t => t.domain === 'category').map(t => t.name).join(', ') || 'Unmapped'}</b>
              </div>
              <div>
                <span style={{ color: 'oklch(55% 0.01 250)' }}>Tags</span>
                <br />
                <b>{article.destinationTerms.filter(t => t.domain === 'post_tag').map(t => t.name).join(', ') || 'None'}</b>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Status:</span>
            <Badge status={article.status} />
          </div>

          {article.warnings && article.warnings.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px', background: 'oklch(97% 0.04 60)', border: '1px solid oklch(88% 0.1 60)', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ color: 'oklch(50% 0.16 60)', fontWeight: 700, fontSize: '13px' }}>⚠ Warnings needing review:</div>
              {article.warnings.map((w, idx) => (
                <div key={idx} style={{ fontSize: '12px', color: 'oklch(40% 0.12 60)' }}>
                  • {w}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', padding: '12px 14px', background: 'oklch(98% 0.003 250)', borderRadius: '8px', border: '1px solid oklch(92% 0.005 250)' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Include in migration</div>
              <div style={{ fontSize: '11px', color: 'oklch(55% 0.01 250)' }}>
                {isExcluded ? 'Currently excluded from exported file' : 'Will be exported into the new site WXR'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggleInclude}
              className={isExcluded ? 'btn btn-secondary' : 'btn btn-primary'}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              {isExcluded ? 'Exclude (Click to Include)' : 'Included (Click to Exclude)'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              Edit converted HTML
              {article.isEdited && (
                <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', padding: '2px 6px', borderRadius: '5px', background: 'oklch(93% 0.05 265)', color: 'oklch(40% 0.18 265)' }}>
                  Manual override
                </span>
              )}
            </div>
            {article.isEdited && (
              <button
                type="button"
                onClick={handleRevert}
                style={{ padding: '5px 10px', background: 'white', border: '1px solid oklch(88% 0.005 250)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                Revert to auto-generated
              </button>
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'oklch(55% 0.01 250)', marginBottom: '8px' }}>
            Saving replaces the automatic conversion for this article entirely.
          </div>
          <textarea
            value={draftHtml}
            onChange={handleTextChange}
            style={{ width: '100%', height: '160px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '8px', padding: '10px', fontSize: '12px', fontFamily: 'monospace', resize: 'vertical', marginBottom: '12px' }}
          />

          <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
            {isDirty && (
              <button
                type="button"
                onClick={handleSave}
                style={{ flex: 1, padding: '11px', background: 'oklch(55% 0.15 150)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
              >
                Save override
              </button>
            )}
            <button
              type="button"
              onClick={requestClose}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '11px', fontSize: '14px' }}
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {pendingAction !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(20% 0 0 / 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70 }}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '26px', width: '400px' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '8px' }}>Discard unsaved edit?</div>
            <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)', marginBottom: '20px', lineHeight: 1.5 }}>
              You made manual edits to the converted HTML. {pendingAction === 'close' ? 'Closing' : 'Navigating away'} now will discard them.
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="btn btn-secondary"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={confirmDiscard}
                className="btn btn-danger"
              >
                {pendingAction === 'close' ? 'Discard & close' : 'Discard & continue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
