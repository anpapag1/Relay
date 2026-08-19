// src/features/articles/ArticleSidebar.tsx
import React, { useState } from 'react';
import type { DerivedArticle } from '../../state/types';
import { Badge } from '../../ui/Badge';
import { termSourceDomain } from '../../core/build/resolveTerms';

export interface ArticleSidebarProps {
  article: DerivedArticle;
  featuredImageUrl: string | null;
  featuredImageLoading: boolean;
  isDirty: boolean;
  onSave: () => void;
  onClose: () => void;
  onSaveMetadata: (metadata: { title: string; postDate: string }) => void;
  onToggleInclude: () => void;
  onToggleManualReview: () => void;
  scrollRef: React.RefObject<HTMLDivElement>;
}

export const ArticleSidebar: React.FC<ArticleSidebarProps> = ({
  article,
  featuredImageUrl,
  featuredImageLoading,
  isDirty,
  onSave,
  onClose,
  onSaveMetadata,
  onToggleInclude,
  onToggleManualReview,
  scrollRef,
}) => {
  const isExcluded = article.status.startsWith('excluded');
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftPostDate, setDraftPostDate] = useState('');

  const startEditing = () => {
    setDraftTitle(article.title || '');
    setDraftPostDate(article.postDate || '');
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setDraftTitle('');
    setDraftPostDate('');
  };

  const saveMetadata = () => {
    onSaveMetadata({ title: draftTitle.trim(), postDate: draftPostDate.trim() });
    setEditing(false);
  };

  return (
    <div
      ref={scrollRef}
      style={{
        width: '60vh',
        maxWidth: '100%',
        height: '100%',
        background: 'var(--relay-surface)',
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
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '18px',
            color: 'var(--relay-text-muted)',
            padding: '4px',
          }}
        >
          ✕
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '100px 1fr',
          gap: '14px',
          marginBottom: '18px',
          background: 'var(--relay-bg)',
          padding: '14px',
          borderRadius: '10px',
          border: '1px solid var(--relay-border-soft)',
        }}
      >
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--relay-text-muted)' }}>
            Article metadata
          </div>
          {editing ? (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={saveMetadata}
                className="btn btn-primary"
                style={{ padding: '4px 10px', fontSize: '12px', fontWeight: 600 }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '12px', fontWeight: 600 }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEditing}
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '12px', fontWeight: 600 }}
            >
              Edit metadata
            </button>
          )}
        </div>
        {featuredImageUrl ? (
          <img
            src={featuredImageUrl}
            alt=""
            style={{ width: '100px', height: '70px', objectFit: 'cover', borderRadius: '8px' }}
          />
        ) : (
          <div
            style={{
              width: '100px',
              height: '70px',
              borderRadius: '8px',
              background:
                'repeating-linear-gradient(45deg, var(--relay-surface-hover), var(--relay-surface-hover) 6px, var(--relay-surface-subtle) 6px, var(--relay-surface-subtle) 12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: 'var(--relay-text-muted)',
              textAlign: 'center',
            }}
          >
            {featuredImageLoading ? 'Loading…' : 'No Featured Image'}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
          {editing && (
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={{ color: 'var(--relay-text-muted)' }}>Title</span>
              <br />
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                style={{ width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--relay-border)', fontSize: '13px' }}
              />
            </div>
          )}
          <div>
            <span style={{ color: 'var(--relay-text-muted)' }}>Published</span>
            <br />
            {editing ? (
              <input
                type="text"
                value={draftPostDate}
                onChange={(e) => setDraftPostDate(e.target.value)}
                placeholder="YYYY-MM-DD HH:MM:SS"
                style={{ width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--relay-border)', fontSize: '12px', fontFamily: 'monospace' }}
              />
            ) : (
              <b>{article.postDate || '—'}</b>
            )}
          </div>
          <div>
            <span style={{ color: 'var(--relay-text-muted)' }}>New slug</span>
            <br />
            <b style={{ fontFamily: 'monospace' }}>{article.postName || '—'}</b>
          </div>
          <div>
            <span style={{ color: 'var(--relay-text-muted)' }}>Category</span>
            <br />
            <b>
              {article.destinationTerms
                .filter((t) => termSourceDomain(t) === 'category')
                .map((t) => t.name)
                .join(', ') || 'Unmapped'}
            </b>
          </div>
          <div>
            <span style={{ color: 'var(--relay-text-muted)' }}>Tags</span>
            <br />
            <b>
              {article.destinationTerms
                .filter((t) => termSourceDomain(t) === 'post_tag')
                .map((t) => t.name)
                .join(', ') || 'None'}
            </b>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600 }}>Status:</span>
        <Badge status={article.status} />
      </div>

      {article.warnings && article.warnings.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '12px',
            background: 'var(--relay-warning-bg)',
            border: '1px solid var(--relay-warning-border)',
            borderRadius: '8px',
            marginBottom: '16px',
          }}
        >
          <div style={{ color: 'var(--relay-warning)', fontWeight: 700, fontSize: '13px' }}>⚠ Warnings needing review:</div>
          {article.warnings.map((w, idx) => (
            <div key={idx} style={{ fontSize: '12px', color: 'var(--relay-warning)' }}>
              • {w}
            </div>
          ))}
        </div>
      )}

      {article.infoWarnings && article.infoWarnings.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '12px',
            background: 'var(--relay-bg)',
            border: '1px solid var(--relay-border-soft)',
            borderRadius: '8px',
            marginBottom: '16px',
          }}
        >
          <div style={{ color: 'var(--relay-text-muted)', fontWeight: 700, fontSize: '13px' }}>ℹ Automatically handled:</div>
          {article.infoWarnings.map((w, idx) => (
            <div key={idx} style={{ fontSize: '12px', color: 'var(--relay-text-muted)' }}>
              • {w}
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          padding: '12px 14px',
          background: 'var(--relay-bg)',
          borderRadius: '8px',
          border: '1px solid var(--relay-border-soft)',
        }}
      >
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Include in migration</div>
          <div style={{ fontSize: '11px', color: 'var(--relay-text-muted)' }}>
            {isExcluded
              ? (article.statusReason ? `Excluded: ${article.statusReason}` : 'Currently excluded from exported file')
              : 'Will be exported into the new site WXR'}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleInclude}
          className={isExcluded ? 'btn btn-secondary' : 'btn btn-primary'}
          style={{ padding: '6px 12px', fontSize: '12px' }}
        >
          {isExcluded ? 'Exclude (Click to Include)' : 'Included (Click to Exclude)'}
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          padding: '12px 14px',
          background: article.isManualReview ? 'var(--relay-warning-bg)' : 'var(--relay-bg)',
          borderRadius: '8px',
          border: article.isManualReview ? '1px solid var(--relay-warning-border)' : '1px solid var(--relay-border-soft)',
        }}
      >
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Flag for review</div>
          <div style={{ fontSize: '11px', color: 'var(--relay-text-muted)' }}>
            {article.isManualReview ? 'Manually flagged — needs a human look before export' : 'Mark this article for a manual check'}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleManualReview}
          className="btn btn-secondary"
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            color: article.isManualReview ? 'var(--relay-warning)' : 'var(--relay-text-2)',
            borderColor: article.isManualReview ? 'var(--relay-warning-border)' : 'var(--relay-border)',
          }}
        >
          {article.isManualReview ? 'Flagged (Click to Unflag)' : 'Flag for Review'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
        {isDirty && (
          <button
            type="button"
            onClick={onSave}
            style={{
              flex: 1,
              padding: '11px',
              background: 'var(--relay-success)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Save override
          </button>
        )}
        <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1, padding: '11px', fontSize: '14px' }}>
          Done
        </button>
      </div>
    </div>
  );
};
