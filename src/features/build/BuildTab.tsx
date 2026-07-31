import React, { useState } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { getDerivedArticles } from '../../state/selectors';

export const BuildTab: React.FC = () => {
  const { state, dispatch, startBuild, cancelBuild } = useAppState();
  const [hasCheckResults, setHasCheckResults] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [includeFilter, setIncludeFilter] = useState<'all' | 'ready' | 'review' | 'edited'>('all');
  const [exportPendingForReview, setExportPendingForReview] = useState<boolean>(true);

  const isBuilding = state.build.running;
  const buildPercent = Math.round(
    (state.build.progress.completed / Math.max(state.build.progress.total, 1)) * 100,
  );
  const buildLog = state.build.log;
  const buildDone = state.build.done;
  const buildCancelled = state.build.cancelled;
  const buildError = state.build.error;
  const wxrResult = state.build.report?.wxr ?? '';

  if (!state.source) {
    return (
      <div style={{ maxWidth: '960px', margin: '60px auto', textAlign: 'center', padding: '40px', background: 'white', borderRadius: '12px', border: '1px solid oklch(90% 0.005 250)' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>No import yet</div>
        <div style={{ fontSize: '14px', color: 'oklch(55% 0.01 250)', marginBottom: '20px' }}>
          Upload a WordPress export first — then build the final migration file here.
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
  const includedArticles = derivedArticles.filter((a) => !a.status.startsWith('excluded'));
  const excludedArticles = derivedArticles.filter((a) => a.status.startsWith('excluded'));
  const reviewArticles = includedArticles.filter((a) => a.status === 'review' || (a.warnings && a.warnings.length > 0));
  const readyArticles = includedArticles.filter((a) => a.status === 'ready');
  const editedArticles = includedArticles.filter((a) => a.status === 'edited');
  const flaggedArticles = includedArticles.filter((a) => a.isManualReview);

  const countIncluded = includedArticles.length;
  const countReview = reviewArticles.length;
  const countExcluded = excludedArticles.length;
  const countEdited = editedArticles.length;
  const countFlagged = flaggedArticles.length;
  const totalMedia = includedArticles.reduce((sum, a) => sum + a.mediaCount, 0);
  // The real build live-fetches media the import-time estimate above
  // can't — an inline image that only turns out unreachable once actually
  // fetched gets flagged 'review' in the true build result even though
  // countReview never saw it coming. Once a build has actually finished,
  // show what it really found instead of repeating the pre-build guess.
  const countReviewInBuild = state.build.report?.articles.filter((a) => a.status === 'review').length ?? countReview;

  // Collect warnings for instant check
  const checkWarnings = includedArticles.flatMap((art) =>
    (art.warnings || []).map((w) => ({ title: art.title || '(Untitled)', text: w, id: art.id }))
  );

  const runCheck = () => {
    setHasCheckResults(true);
  };

  const copyCheckResults = async () => {
    const text = checkWarnings.length > 0
      ? checkWarnings.map((w) => `${w.title}: ${w.text}`).join('\n')
      : 'No problems found — ready to build.';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied by the browser sandbox — nothing else to do.
    }
  };

  const handleStartBuild = () => {
    void startBuild(exportPendingForReview);
  };

  const downloadWxr = () => {
    const blob = new Blob([wxrResult], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relay-migration-${new Date().toISOString().slice(0, 10)}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cardStyleBase: React.CSSProperties = {
    background: 'white',
    border: '1px solid oklch(90% 0.005 250)',
    borderRadius: '14px',
    padding: '22px',
    boxShadow: '0 1px 3px oklch(0% 0 0 / 0.02)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '960px', width: '100%', margin: '0 auto' }}>
      <div>
        <div style={{ fontSize: '22px', fontWeight: 700 }}>Build &amp; export</div>
        <div style={{ fontSize: '14px', color: 'oklch(55% 0.01 250)', marginTop: '2px' }}>
          Run a quick check, then build the final import file for the new site.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="stat-grid">
          <div className="stat-card stat-card--good">
            <div className="stat-card__value">{countIncluded}</div>
            <div className="stat-card__label">Will be included</div>
          </div>
          <div className={`stat-card ${countReview > 0 ? 'stat-card--warning' : 'stat-card--neutral'}`}>
            <div data-testid="pre-build-review-count" className="stat-card__value">{countReview}</div>
            <div className="stat-card__label">Still need review</div>
          </div>
          <div className="stat-card stat-card--neutral">
            <div className="stat-card__value">{countExcluded}</div>
            <div className="stat-card__label">Excluded</div>
          </div>
          <div className="stat-card stat-card--accent">
            <div className="stat-card__value">{countEdited}</div>
            <div className="stat-card__label">Edited</div>
          </div>
          <div className={`stat-card ${countFlagged > 0 ? 'stat-card--warning' : 'stat-card--neutral'}`}>
            <div className="stat-card__value">{countFlagged}</div>
            <div className="stat-card__label">Flagged for review</div>
          </div>
          <div className="stat-card stat-card--accent">
            <div className="stat-card__value">{totalMedia}</div>
            <div className="stat-card__label">Total media</div>
          </div>
          <div className={`stat-card ${checkWarnings.length > 0 ? 'stat-card--warning' : 'stat-card--neutral'}`}>
            <div className="stat-card__value">{checkWarnings.length}</div>
            <div className="stat-card__label">Total warnings</div>
          </div>
        </div>
        <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)' }}>
          {countReview > 0
            ? 'Articles flagged for review will still be converted using automatic settings.'
            : 'All included articles are ready for conversion.'}
        </div>
      </div>

      <div style={cardStyleBase}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700 }}>Check for problems</div>
          <button
            type="button"
            onClick={runCheck}
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            Run check
          </button>
        </div>
        <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)', marginBottom: '12px' }}>
          Instant — scans all articles without building anything.
        </div>
        {hasCheckResults && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2px' }}>
              <button
                type="button"
                onClick={copyCheckResults}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                {copied ? 'Copied!' : 'Copy to clipboard'}
              </button>
            </div>
            {checkWarnings.length > 0 ? (
              checkWarnings.map((w, idx) => (
                <div
                  key={idx}
                  onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tab: 'articles' })}
                  style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    fontSize: '13px',
                    padding: '10px 12px',
                    background: 'oklch(97% 0.04 60)',
                    border: '1px solid oklch(88% 0.1 60)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ color: 'oklch(50% 0.16 60)', fontWeight: 700 }}>⚠</div>
                  <div style={{ flex: 1 }}>
                    <b>{w.title}:</b> {w.text}
                  </div>
                  <div style={{ fontSize: '12px', color: 'oklch(50% 0.14 60)', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
                    Review →
                  </div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '13px', color: 'oklch(40% 0.14 150)', padding: '10px 12px', background: 'oklch(96% 0.03 150)', border: '1px solid oklch(88% 0.1 150)', borderRadius: '8px' }}>
                No problems found — ready to build.
              </div>
            )}
          </div>
        )}
      </div>

      <div style={cardStyleBase}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700 }}>Build migration file</div>
          {!isBuilding && (
            <button
              type="button"
              onClick={handleStartBuild}
              className="btn btn-primary"
              style={{ padding: '10px 20px', fontSize: '14px' }}
            >
              Build now
            </button>
          )}
          {isBuilding && (
            <button
              type="button"
              onClick={cancelBuild}
              className="btn btn-danger"
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              Cancel
            </button>
          )}
        </div>
        <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)', marginBottom: '14px' }}>
          Converts every included article and packages a downloadable import file.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'oklch(55% 0.01 250)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Include:
          </span>
          {[
            { id: 'all', label: 'All included', count: countIncluded },
            { id: 'ready', label: 'Ready only', count: readyArticles.length },
            { id: 'review', label: 'Review needed', count: countReview },
            { id: 'edited', label: 'Manual edits', count: editedArticles.length },
          ].map((bc) => (
            <button
              key={bc.id}
              type="button"
              onClick={() => setIncludeFilter(bc.id as any)}
              style={{
                border: '1px solid',
                borderColor: includeFilter === bc.id ? 'oklch(50% 0.16 265)' : 'oklch(88% 0.005 250)',
                background: includeFilter === bc.id ? 'oklch(96% 0.04 265)' : 'white',
                color: includeFilter === bc.id ? 'oklch(45% 0.18 265)' : 'oklch(35% 0.01 250)',
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: includeFilter === bc.id ? 600 : 500,
                cursor: 'pointer',
              }}
            >
              {bc.label} <span style={{ opacity: 0.7 }}>{bc.count}</span>
            </button>
          ))}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '13px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={exportPendingForReview}
            onChange={(e) => setExportPendingForReview(e.target.checked)}
          />
          <span>Export review-flagged articles as <b>Pending Review</b> instead of Published</span>
        </label>

        {isBuilding && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'oklch(50% 0.01 250)', marginBottom: '6px' }}>
              <span>Converting blocks and resolving media…</span>
              <span>{buildPercent}%</span>
            </div>
            <div style={{ height: '8px', background: 'oklch(94% 0.005 250)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${buildPercent}%`, height: '100%', background: 'oklch(50% 0.16 265)', transition: 'width 0.2s ease' }} />
            </div>
          </div>
        )}

        {(isBuilding || buildDone || buildCancelled || buildLog.length > 0) && (
          <div
            style={{
              background: 'oklch(15% 0.01 250)',
              color: 'oklch(85% 0.005 250)',
              borderRadius: '10px',
              padding: '14px',
              height: '160px',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              marginBottom: '16px',
            }}
          >
            {buildLog.map((line, idx) => (
              <div key={idx}>{line}</div>
            ))}
          </div>
        )}

        {buildCancelled && (
          <div style={{ fontSize: '13px', color: 'oklch(50% 0.01 250)', padding: '12px', background: 'oklch(96% 0.005 250)', borderRadius: '8px' }}>
            Build cancelled. No file was produced.
          </div>
        )}

        {buildError && (
          <div style={{ fontSize: '13px', color: 'oklch(45% 0.16 25)', padding: '12px', background: 'oklch(97% 0.04 25)', border: '1px solid oklch(88% 0.1 25)', borderRadius: '8px' }}>
            Build failed: {buildError}
          </div>
        )}

        {buildDone && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div style={{ background: 'oklch(96% 0.03 150)', borderRadius: '10px', padding: '16px', border: '1px solid oklch(88% 0.08 150)' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'oklch(40% 0.14 150)' }}>{countIncluded}</div>
                <div style={{ fontSize: '12px', color: 'oklch(45% 0.05 150)', marginTop: '2px' }}>included articles</div>
              </div>
              <div style={{ background: 'oklch(97% 0.04 60)', borderRadius: '10px', padding: '16px', border: '1px solid oklch(88% 0.1 60)' }}>
                <div data-testid="post-build-review-count" style={{ fontSize: '24px', fontWeight: 700, color: 'oklch(50% 0.16 60)' }}>{countReviewInBuild}</div>
                <div style={{ fontSize: '12px', color: 'oklch(50% 0.08 60)', marginTop: '2px' }}>flagged in log</div>
              </div>
              <div style={{ background: 'oklch(96% 0.005 250)', borderRadius: '10px', padding: '16px', border: '1px solid oklch(90% 0.005 250)' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'oklch(50% 0.01 250)' }}>{countExcluded}</div>
                <div style={{ fontSize: '12px', color: 'oklch(55% 0.01 250)', marginTop: '2px' }}>skipped</div>
              </div>
            </div>

            <div style={{ border: '1px solid oklch(92% 0.005 250)', borderRadius: '10px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', background: 'oklch(99% 0.002 250)' }}>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>What happened</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'oklch(55% 0.01 250)', marginBottom: '4px' }}>Target Tables Generated</div>
                  <div>{Object.values(state.target.tables).length} category/tag tables mapped</div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'oklch(55% 0.01 250)', marginBottom: '4px' }}>Output WXR Size</div>
                  <div>{Math.round(wxrResult.length / 1024)} KB XML package ready</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                type="button"
                onClick={downloadWxr}
                className="btn btn-primary"
                style={{ padding: '12px 24px', fontSize: '15px', fontWeight: 700 }}
              >
                ↓ Download WXR file
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
