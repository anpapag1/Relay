import React, { useState } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { getDerivedArticles } from '../../state/selectors';
import type { DerivedArticle } from '../../state/types';
import { Badge } from '../../ui/Badge';
import { ArticleDrawer } from './ArticleDrawer';

type StatusFilter = 'all' | 'ready' | 'review' | 'edited' | 'excluded';
type SortField = 'title' | 'date' | 'status';
type SortOrder = 'asc' | 'desc';

export const ArticlesTab: React.FC = () => {
  const { state, dispatch } = useAppState();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedArticleId, setSelectedArticleId] = useState<number | null>(null);

  if (!state.source) {
    return (
      <div style={{ maxWidth: '960px', margin: '60px auto', textAlign: 'center', padding: '40px', background: 'white', borderRadius: '12px', border: '1px solid oklch(90% 0.005 250)' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>No import yet</div>
        <div style={{ fontSize: '14px', color: 'oklch(55% 0.01 250)', marginBottom: '20px' }}>
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '960px', width: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700 }}>Articles</div>
          <div style={{ fontSize: '14px', color: 'oklch(55% 0.01 250)', marginTop: '2px' }}>
            {countReady} ready, {countReview} need review, {countExcluded} excluded. Click any article to preview or edit its blocks.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Search titles…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '8px', fontSize: '13px', width: '200px' }}
          />
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
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'oklch(55% 0.01 250)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
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
                borderColor: isActive ? 'oklch(50% 0.16 265)' : 'oklch(88% 0.005 250)',
                background: isActive ? 'oklch(96% 0.04 265)' : 'white',
                color: isActive ? 'oklch(45% 0.18 265)' : 'oklch(35% 0.01 250)',
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

      <div style={{ background: 'white', border: '1px solid oklch(90% 0.005 250)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px oklch(0% 0 0 / 0.02)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 0.9fr 0.9fr 0.7fr 1fr 0.8fr', padding: '12px 20px', fontSize: '11px', fontWeight: 600, color: 'oklch(55% 0.01 250)', textTransform: 'uppercase', letterSpacing: '0.03em', background: 'oklch(97% 0.003 250)' }}>
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

        {sorted.map((art) => {
          const isExc = art.status.startsWith('excluded');
          return (
            <div
              key={art.id}
              onClick={() => setSelectedArticleId(art.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: '2.2fr 0.9fr 0.9fr 0.7fr 1fr 0.8fr',
                padding: '14px 20px',
                alignItems: 'center',
                borderTop: '1px solid oklch(95% 0.005 250)',
                cursor: 'pointer',
                background: selectedArticleId === art.id ? 'oklch(97% 0.02 265)' : 'white',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: 500, opacity: isExc ? 0.6 : 1 }}>
                {art.title || '(Untitled)'}
              </div>
              <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)' }}>{art.postDate || '—'}</div>
              <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)' }}>{art.destinationTerms.filter(t => t.domain === 'category').map(t => t.name).join(', ') || '—'}</div>
              <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {art.mediaCount}
                {art.warnings && art.warnings.length > 0 && (
                  <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'oklch(65% 0.15 60)', color: 'white', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    !
                  </div>
                )}
              </div>
              <div>
                <Badge status={art.status} />
              </div>
              <div onClick={(e) => e.stopPropagation()}>
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
                    color: isExc ? 'oklch(50% 0.16 265)' : 'oklch(50% 0.18 25)',
                    borderColor: isExc ? 'oklch(85% 0.05 265)' : 'oklch(85% 0.1 25)',
                  }}
                >
                  {isExc ? 'Include' : 'Exclude'}
                </button>
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', fontSize: '14px', color: 'oklch(55% 0.01 250)' }}>
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
