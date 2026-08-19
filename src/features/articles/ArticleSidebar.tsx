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
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '18px',
            color: 'oklch(55% 0.01 250)',
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
          background: 'oklch(98% 0.003 250)',
          padding: '14px',
          borderRadius: '10px',
          border: '1px solid oklch(92% 0.005 250)',
        }}
      >
        <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'oklch(55% 0.01 250)' }}>
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
                'repeating-linear-gradient(45deg, oklch(93% 0.005 250), oklch(93% 0.005 250) 6px, oklch(96% 0.003 250) 6px, oklch(96% 0.003 250) 12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: 'oklch(55% 0.01 250)',
              textAlign: 'center',
            }}
          >
            {featuredImageLoading ? 'Loading…' : 'No Featured Image'}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
          {editing && (
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={{ color: 'oklch(55% 0.01 250)' }}>Title</span>
              <br />
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                style={{ width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid oklch(85% 0.005 250)', fontSize: '13px' }}
              />
            </div>
          )}
          <div>
            <span style={{ color: 'oklch(55% 0.01 250)' }}>Published</span>
            <br />
            {editing ? (
              <input
                type="text"
                value={draftPostDate}
                onChange={(e) => setDraftPostDate(e.target.value)}
                placeholder="YYYY-MM-DD HH:MM:SS"
                style={{ width: '100%', marginTop: '4px', padding: '6px 8px', borderRadius: '6px', border: '1px solid oklch(85% 0.005 250)', fontSize: '12px', fontFamily: 'monospace' }}
              />
            ) : (
              <b>{article.postDate || '—'}</b>
            )}
          </div>
          <div>
            <span style={{ color: 'oklch(55% 0.01 250)' }}>New slug</span>
            <br />
            <b style={{ fontFamily: 'monospace' }}>{article.postName || '—'}</b>
          </div>
          <div>
            <span style={{ color: 'oklch(55% 0.01 250)' }}>Category</span>
            <br />
            <b>
              {article.destinationTerms
                .filter((t) => termSourceDomain(t) === 'category')
                .map((t) => t.name)
                .join(', ') || 'Unmapped'}
            </b>
          </div>
          <div>
            <span style={{ color: 'oklch(55% 0.01 250)' }}>Tags</span>
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
            background: 'oklch(97% 0.04 60)',
            border: '1px solid oklch(88% 0.1 60)',
            borderRadius: '8px',
            marginBottom: '16px',
          }}
        >
          <div style={{ color: 'oklch(50% 0.16 60)', fontWeight: 700, fontSize: '13px' }}>⚠ Warnings needing review:</div>
          {article.warnings.map((w, idx) => (
            <div key={idx} style={{ fontSize: '12px', color: 'oklch(40% 0.12 60)' }}>
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
            background: 'oklch(98% 0.003 250)',
            border: '1px solid oklch(92% 0.005 250)',
            borderRadius: '8px',
            marginBottom: '16px',
          }}
        >
          <div style={{ color: 'oklch(55% 0.01 250)', fontWeight: 700, fontSize: '13px' }}>ℹ Automatically handled:</div>
          {article.infoWarnings.map((w, idx) => (
            <div key={idx} style={{ fontSize: '12px', color: 'oklch(55% 0.01 250)' }}>
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
          background: 'oklch(98% 0.003 250)',
          borderRadius: '8px',
          border: '1px solid oklch(92% 0.005 250)',
        }}
      >
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Include in migration</div>
          <div style={{ fontSize: '11px', color: 'oklch(55% 0.01 250)' }}>
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
          background: article.isManualReview ? 'oklch(97% 0.04 60)' : 'oklch(98% 0.003 250)',
          borderRadius: '8px',
          border: article.isManualReview ? '1px solid oklch(88% 0.1 60)' : '1px solid oklch(92% 0.005 250)',
        }}
      >
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>Flag for review</div>
          <div style={{ fontSize: '11px', color: 'oklch(55% 0.01 250)' }}>
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
            color: article.isManualReview ? 'oklch(50% 0.16 60)' : 'oklch(35% 0.01 250)',
            borderColor: article.isManualReview ? 'oklch(85% 0.1 60)' : 'oklch(88% 0.005 250)',
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
              background: 'oklch(55% 0.15 150)',
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
