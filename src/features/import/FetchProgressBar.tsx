import React from 'react';
import type { FetchSiteProgress } from '../../core/site/fetchSite';

/** Human label for the current scrape phase; the same wording the previous
 * text-only status line used. */
export function scrapeProgressLabel(p: FetchSiteProgress): string {
  if (p.stage === 'probe') return 'Detecting REST API or feed…';
  if (p.stage === 'media') return `Resolving featured images (${p.fetched}/${p.total ?? '…'})`;
  return p.total != null ? `Fetching posts (${p.fetched}/${p.total})…` : `Fetched ${p.fetched} posts…`;
}

function progressPercent(p: FetchSiteProgress): number {
  return Math.min(100, Math.round((p.fetched / Math.max(p.total ?? 1, 1)) * 100));
}

export const FetchProgressBar: React.FC<{ progress: FetchSiteProgress | null }> = ({ progress }) => {
  if (!progress) return null;
  return (
    <div style={{ marginTop: '10px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '4px',
          fontSize: '13px',
          color: 'var(--relay-text-muted)',
        }}
      >
        <span>{scrapeProgressLabel(progress)}</span>
        {progress.total != null && (
          <span style={{ fontSize: '12px', fontWeight: 600 }}>{progressPercent(progress)}%</span>
        )}
      </div>
      <div style={{ height: '8px', background: 'var(--relay-surface-hover)', borderRadius: '4px', overflow: 'hidden' }}>
        {progress.total != null ? (
          <div
            style={{
              width: `${progressPercent(progress)}%`,
              height: '100%',
              background: 'var(--relay-accent)',
              transition: 'width 0.2s ease',
            }}
          />
        ) : (
          <div className="progress-indeterminate" />
        )}
      </div>
    </div>
  );
};