import React, { useState } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { getDerivedArticles } from '../../state/selectors';
import type { DerivedArticle } from '../../state/types';
import { Badge } from '../../ui/Badge';
import { ArticleDrawer } from './ArticleDrawer';
import { termSourceDomain } from '../../core/build/resolveTerms';

type StatusFilter = 'all' | 'ready' | 'review' | 'edited' | 'excluded';
type SortField = 'title' | 'date' | 'status';
type SortOrder = 'asc' | 'desc';

// Above VIRTUALIZE_THRESHOLD rows, only the rows near the current scroll
// position (plus OVERSCAN rows of buffer) are mounted, matching the
// MappingsTab pattern — thousands of articles each carrying several DOM
// cells would otherwise freeze the browser tab on interaction. Below the
// threshold the list renders exactly as before (no scroll container).
const VIRTUALIZE_THRESHOLD = 150;
const ROW_HEIGHT = 52;
const OVERSCAN = 10;
const VIRTUAL_LIST_HEIGHT = 600;

export const ArticlesTab: React.FC = () => {
  const { state, dispatch } = useAppState();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  if (!state.source) {
    return (
      <div style={{ maxWidth: '960px', margin: '60px auto', textAlign: 'center', padding: '40px', background: 'var(--relay-surface)', borderRadius: '12px', border: '1px solid var(--relay-border-soft)' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>No import yet</div>
        <div style={{ fontSize: '14px', color: 'var(--relay-text-muted)', marginBottom: '20px' }}>
          Upload a WordPress export first — this table lists its articles.
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tab: 'import' })}
          className="btn btn-primary"
        >
          Go to Import tab →
        </button>
      </div>
    );
  }

  const derivedArticles = getDerivedArticles(state);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortArrow = (field: SortField) => {
    if (sortField !== field) return '';
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  // Filter
  const filtered = derivedArticles.filter((art) => {
    if (searchQuery && !art.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (statusFilter === 'ready' && art.status !== 'ready') return false;
    if (statusFilter === 'review' && art.status !== 'review') return false;
    if (statusFilter === 'edited' && art.status !== 'edited') return false;
    if (statusFilter === 'excluded' && !art.status.startsWith('excluded')) return false;
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'title') {
      cmp = a.title.localeCompare(b.title);
    } else if (sortField === 'date') {
      cmp = (a.postDate || '').localeCompare(b.postDate || '');
    } else if (sortField === 'status') {
      cmp = a.status.localeCompare(b.status);
    }
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  // Status counts
  const countAll = derivedArticles.length;
  const countReady = derivedArticles.filter((a) => a.status === 'ready').length;
  const countReview = derivedArticles.filter((a) => a.status === 'review').length;
  const countEdited = derivedArticles.filter((a) => a.status === 'edited').length;
  const countExcluded = derivedArticles.filter((a) => a.status.startsWith('excluded')).length;

  const filterChips: Array<{ id: StatusFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: countAll },
    { id: 'ready', label: 'Ready', count: countReady },
    { id: 'review', label: 'Needs review', count: countReview },
    { id: 'edited', label: 'Edited', count: countEdited },
    { id: 'excluded', label: 'Excluded', count: countExcluded },
  ];

  const handleExcludeAll = () => {
    const allExcluded = derivedArticles.every((a) => a.status.startsWith('excluded'));
    derivedArticles.forEach((art) => {
      dispatch({
        type: 'SET_ARTICLE_EXCLUDED',
        articleId: art.id,
        excluded: !allExcluded,
      });
    });
  };

  const selectedIndex = selectedArticleId !== null
    ? sorted.findIndex((a) => a.id === selectedArticleId)
    : -1;
  const selectedArticle: DerivedArticle | null = selectedIndex >= 0 ? sorted[selectedIndex] : null;
  const hasPrev = selectedIndex > 0;
  const hasNext = selectedIndex >= 0 && selectedIndex < sorted.length - 1;
  const goPrev = () => {
    if (hasPrev) setSelectedArticleId(sorted[selectedIndex - 1].id);
  };
  const goNext = () => {
    if (hasNext) setSelectedArticleId(sorted[selectedIndex + 1].id);
  };

  const allAreExcluded = derivedArticles.length > 0 && derivedArticles.every((a) => a.status.startsWith('excluded'));

  const renderRow = (art: DerivedArticle) => {
    const isExc = art.status.startsWith('excluded');
    return (
      <div
        key={art.id}
        onClick={() => setSelectedArticleId(art.id)}
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 0.85fr 0.85fr 0.6fr 0.9fr 1.3fr',
          height: ROW_HEIGHT,
          padding: '0 20px',
          boxSizing: 'border-box',
          alignItems: 'center',
          borderTop: '1px solid var(--relay-border-soft)',
          cursor: 'pointer',
          background: selectedArticleId === art.id ? 'var(--relay-accent-soft)' : 'var(--relay-surface)',
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: 500, opacity: isExc ? 0.6 : 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '12px' }}>
          {art.title || '(Untitled)'}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--relay-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '12px' }}>{art.postDate || '—'}</div>
        <div style={{ fontSize: '13px', color: 'var(--relay-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '12px' }}>{art.destinationTerms.filter(t => termSourceDomain(t) === 'category').map(t => t.name).join(', ') || '—'}</div>
        <div style={{ fontSize: '13px', color: 'var(--relay-text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          {art.mediaCount}
          {art.warnings && art.warnings.length > 0 && (
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--relay-warning)', color: 'white', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              !
            </div>
          )}
        </div>
        <div className="article-status-cell">
          <Badge status={art.status} />
          {art.isEdited && (
            <button
              type="button"
              className="btn btn-secondary article-reset-btn"
              title="Reset edits, metadata, exclusion and review flag to the original values"
              onClick={(e) => {
                e.stopPropagation();
                dispatch({ type: 'RESET_ARTICLE', articleId: art.id });
              }}
            >
              Reset
            </button>
          )}
        </div>
        <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => {
              dispatch({
                type: 'SET_ARTICLE_EXCLUDED',
                articleId: art.id,
                excluded: !isExc,
              });
            }}
            className={isExc ? 'btn btn-secondary' : 'btn btn-secondary'}
            style={{
              padding: '5px 10px',
              fontSize: '12px',
              color: isExc ? 'var(--relay-accent)' : 'var(--relay-danger)',
              borderColor: isExc ? 'var(--relay-accent-border)' : 'var(--relay-danger-border)',
            }}
          >
            {isExc ? 'Include' : 'Exclude'}
          </button>
          <button
            type="button"
            onClick={() => {
              dispatch({
                type: 'SET_ARTICLE_MANUAL_REVIEW',
                articleId: art.id,
                manualReview: !art.isManualReview,
              });
            }}
            className="btn btn-secondary"
            title={art.isManualReview ? 'Unflag for review' : 'Flag for review'}
            style={{
              padding: '5px 10px',
              fontSize: '12px',
              color: art.isManualReview ? 'var(--relay-warning)' : 'var(--relay-text-2)',
              borderColor: art.isManualReview ? 'var(--relay-warning-border)' : 'var(--relay-border)',
            }}
          >
            {art.isManualReview ? 'Unflag' : 'Flag'}
          </button>
        </div>
      </div>
    );
  };

  const virtualizeRows = sorted.length > VIRTUALIZE_THRESHOLD;
  const startIndex = virtualizeRows ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN) : 0;
  const visibleCount = virtualizeRows ? Math.ceil(VIRTUAL_LIST_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2 : sorted.length;
  const endIndex = Math.min(sorted.length, startIndex + visibleCount);
  const visibleRows = sorted.slice(startIndex, endIndex);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '960px', width: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700 }}>Articles</div>
          <div style={{ fontSize: '14px', color: 'var(--relay-text-muted)', marginTop: '2px' }}>
            {countReady} ready, {countReview} need review, {countExcluded} excluded. Click any article to preview or edit its blocks.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search titles…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid var(--relay-border)', borderRadius: '8px', fontSize: '13px', width: '200px', paddingRight: searchQuery ? '28px' : '12px' }}
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '18px',
                  height: '18px',
                  border: 'none',
                  borderRadius: '50%',
                  background: 'var(--relay-border-strong)',
                  color: 'var(--relay-text-2)',
                  fontSize: '12px',
                  lineHeight: '18px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  padding: '0',
                }}
              >
                ×
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleExcludeAll}
            className="btn btn-secondary"
            style={{ padding: '8px 14px', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}
          >
            {allAreExcluded ? 'Include all' : 'Exclude all'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--relay-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          Showing:
        </span>
        {filterChips.map((chip) => {
          const isActive = statusFilter === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setStatusFilter(chip.id)}
              style={{
                border: '1px solid',
                borderColor: isActive ? 'var(--relay-accent)' : 'var(--relay-border)',
                background: isActive ? 'var(--relay-accent-soft)' : 'var(--relay-surface)',
                color: isActive ? 'var(--relay-accent-hover)' : 'var(--relay-text-2)',
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {chip.label} <span style={{ opacity: 0.7 }}>{chip.count}</span>
            </button>
          );
        })}
      </div>

      <div style={{ background: 'var(--relay-surface)', border: '1px solid var(--relay-border-soft)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px oklch(0% 0 0 / 0.02)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.85fr 0.85fr 0.6fr 0.9fr 1.3fr', padding: '12px 20px', fontSize: '11px', fontWeight: 600, color: 'var(--relay-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', background: 'var(--relay-surface-subtle)' }}>
          <div onClick={() => toggleSort('title')} style={{ cursor: 'pointer' }}>
            Title{getSortArrow('title')}
          </div>
          <div onClick={() => toggleSort('date')} style={{ cursor: 'pointer' }}>
            Date{getSortArrow('date')}
          </div>
          <div>Category</div>
          <div>Media</div>
          <div onClick={() => toggleSort('status')} style={{ cursor: 'pointer' }}>
            Status{getSortArrow('status')}
          </div>
          <div></div>
        </div>

        {virtualizeRows ? (
          <div
            onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
            style={{ maxHeight: VIRTUAL_LIST_HEIGHT, overflowY: 'auto' }}
          >
            <div style={{ height: sorted.length * ROW_HEIGHT, position: 'relative' }}>
              <div style={{ position: 'absolute', top: startIndex * ROW_HEIGHT, left: 0, right: 0 }}>
                {visibleRows.map(renderRow)}
              </div>
            </div>
          </div>
        ) : (
          sorted.map(renderRow)
        )}

        {sorted.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', fontSize: '14px', color: 'var(--relay-text-muted)' }}>
            No articles match this filter.
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tab: 'build' })}
          className="btn btn-primary"
          style={{ padding: '10px 20px', fontSize: '14px' }}
        >
          Continue to Build & Export →
        </button>
      </div>

      <ArticleDrawer
        article={selectedArticle}
        onClose={() => setSelectedArticleId(null)}
        onPrev={goPrev}
        onNext={goNext}
        hasPrev={hasPrev}
        hasNext={hasNext}
      />
    </div>
  );
};
