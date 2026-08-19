// src/features/articles/ArticlePreviewPane.tsx
import React from 'react';
import type { DerivedArticle } from '../../state/types';

export interface ArticlePreviewPaneProps {
  article: DerivedArticle;
  previewMode: 'before' | 'after' | 'edit';
  draftHtml: string;
  onDraftChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onRevert: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  scrollRef: React.RefObject<HTMLDivElement>;
  onSelectPreviewMode: (mode: 'before' | 'after' | 'edit') => void;
}

export const ArticlePreviewPane: React.FC<ArticlePreviewPaneProps> = ({
  article,
  previewMode,
  draftHtml,
  onDraftChange,
  onRevert,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  scrollRef,
  onSelectPreviewMode,
}) => {
  const showBefore = previewMode === 'before';
  const showEdit = previewMode === 'edit';
  const previewHtml = showBefore ? article.contentHtml : draftHtml;

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'start',
        justifyContent: 'center',
        padding: '30px 40px',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '900px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <div
          className="wp-preview"
          style={{
            background: 'var(--relay-surface)',
            borderRadius: '14px',
            boxShadow: '0 12px 40px oklch(0% 0 0 / 0.15)',
            padding: '30px 48px',
            width: '100%',
            // height: 'min(700px, calc(100vh - 220px))',
            overflowY: showEdit || showBefore ? 'hidden' : 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--relay-text-muted)' }}>
              Content before / after
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  display: 'flex',
                  gap: '4px',
                  background: 'oklch(30% 0.005 250 / 0.6)',
                  borderRadius: '8px',
                  padding: '3px',
                }}
              >
                <button
                  type="button"
                  onClick={onPrev}
                  disabled={!hasPrev}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    background: 'transparent',
                    color: 'white',
                    cursor: hasPrev ? 'pointer' : 'not-allowed',
                    opacity: hasPrev ? 1 : 0.4,
                  }}
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  onClick={onNext}
                  disabled={!hasNext}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    background: 'transparent',
                    color: 'white',
                    cursor: hasNext ? 'pointer' : 'not-allowed',
                    opacity: hasNext ? 1 : 0.4,
                  }}
                >
                  Next →
                </button>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '4px',
                  background: 'oklch(30% 0.005 250 / 0.6)',
                  borderRadius: '8px',
                  padding: '3px',
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelectPreviewMode('before')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: showBefore ? 'var(--relay-surface)' : 'transparent',
                    color: showBefore ? 'var(--relay-text)' : 'white',
                    boxShadow: showBefore ? '0 1px 3px oklch(0% 0 0 / 0.1)' : 'none',
                  }}
                >
                  Before
                </button>
                <button
                  type="button"
                  onClick={() => onSelectPreviewMode('after')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: !showBefore ? 'var(--relay-surface)' : 'transparent',
                    color: !showBefore ? 'var(--relay-text)' : 'white',
                    boxShadow: !showBefore ? '0 1px 3px oklch(0% 0 0 / 0.1)' : 'none',
                  }}
                >
                  After
                </button>
                <button
                  type="button"
                  onClick={() => onSelectPreviewMode('edit')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: showEdit ? 'var(--relay-surface)' : 'transparent',
                    color: showEdit ? 'var(--relay-text)' : 'white',
                    boxShadow: showEdit ? '0 1px 3px oklch(0% 0 0 / 0.1)' : 'none',
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: '2.2em',
              fontWeight: 600,
              lineHeight: 1.3,
              margin: '0 auto 20px',
              color: 'var(--relay-text)',
              flexShrink: 0,
              width: '100%',
              maxWidth: '68ch',
            }}
          >
            {article.title || '(Untitled)'}
          </div>
          {showEdit ? (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--relay-text)',
                  }}
                >
                  Edit converted HTML
                  {article.isEdited && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                        padding: '2px 6px',
                        borderRadius: '5px',
                        background: 'var(--relay-accent-soft)',
                        color: 'var(--relay-accent-hover)',
                      }}
                    >
                      Manual override
                    </span>
                  )}
                </div>
                {article.isEdited && (
                  <button
                    type="button"
                    onClick={onRevert}
                    style={{
                      padding: '5px 10px',
                      background: 'var(--relay-surface)',
                      border: '1px solid var(--relay-border)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Revert to auto-generated
                  </button>
                )}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--relay-text-muted)', marginBottom: '8px', flexShrink: 0 }}>
                Saving replaces the automatic conversion for this article entirely.
              </div>
              <textarea
                value={draftHtml}
                onChange={onDraftChange}
                style={{
                  width: '100%',
                  flex: 1,
                  minHeight: 0,
                  border: '1px solid var(--relay-border)',
                  borderRadius: '8px',
                  padding: '10px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  resize: 'none',
                  fieldSizing: 'content',
                }}
              />
            </>
          ) : showBefore ? (
            article.contentHtml.trim() ? (
              <pre
                style={{
                  flex: 1,
                  minHeight: 0,
                  margin: 0,
                  width: '100%',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: 'var(--relay-text)',
                }}
              >
                {article.contentHtml}
              </pre>
            ) : (
              <div className="wp-preview-empty">Nothing to preview yet</div>
            )
          ) : previewHtml.trim() ? (
            <div className="wp-preview-body" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          ) : (
            <div className="wp-preview-empty">Nothing to preview yet</div>
          )}
        </div>
      </div>
    </div>
  );
};
