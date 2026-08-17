import React, { useMemo, useState } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { parseWxr } from '../../core/wxr/parseWxr';
import { rankBuilders, type BuilderScore } from '../../core/builders/detectBuilder';
import { fetchSite } from '../../core/site/fetchSite';
import { browserTextFetch } from '../../core/site/fetchLike';
import { normalizeBaseUrl } from '../../core/site/probeSite';
import { SAMPLE_WXR } from './sampleWxr';
import { createSiteDataBackup, restoreSiteDataBackup } from '../../state/session';
import { findMissingOldTerms, mergeMissingIntoOldTables } from '../../core/mappings/reconcileOldTables';
import { BUILDER_VALIDATION_STATUS, type BuilderId } from '../../core/builders/types';
import type { TermTable } from '../../types/domain';
import type { SiteFetchStatus } from '../../core/site/types';
import { BuilderStatusPill } from '../../ui/Badge';

const BUILDER_OPTIONS: BuilderId[] = ['plainHtml', 'elementor', 'divi', 'wpbakery'];

const BUILDER_LABELS: Record<BuilderId, string> = {
  plainHtml: 'Plain HTML',
  wpbakery: 'WPBakery',
  elementor: 'Elementor',
  divi: 'Divi',
};

function builderOptionLabel(id: BuilderId, entry: BuilderScore | undefined): string {
  const label = BUILDER_LABELS[id];
  const withScore = entry ? `${label} — ${entry.confidentCount}/${entry.totalPosts} posts` : label;
  return BUILDER_VALIDATION_STATUS[id] === 'beta' ? `${withScore} (beta)` : withScore;
}

/** Colors the match pill by whether this builder was actually found on any
 * post with real confidence — NOT by the raw average score. The average is
 * diluted by however much of the site is plain content, so a builder used
 * on a small fraction of posts can average lower than plainHtml's flat
 * per-post score while still being the unambiguous, correct answer (see
 * confidentCount in rankBuilders). Coloring by average would flag a
 * correct-but-partial match as "bad" and a meaningless flat fallback as
 * "good", so this keys off confidentCount instead:
 *   - any confident post match at all -> green, it's real
 *   - the top pick with zero confident matches anywhere -> amber, this is
 *     the no-signal-found fallback, not a genuine detection
 *   - anything else -> neutral gray */
function confidenceTierStyle(confidentCount: number, isTopPick: boolean): React.CSSProperties {
  if (confidentCount > 0) {
    return { color: 'oklch(50% 0.14 150)', background: 'oklch(95% 0.03 150)' };
  }
  if (isTopPick) {
    return { color: 'oklch(55% 0.16 60)', background: 'oklch(96% 0.06 60)' };
  }
  return { color: 'oklch(55% 0.01 250)', background: 'oklch(95% 0.01 250)' };
}

export const ImportTab: React.FC = () => {
  const { state, dispatch } = useAppState();
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string>('sample-export.xml');
  const [activeDataTab, setActiveDataTab] = useState<'old' | 'new'>('old');
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [expandedOldTables, setExpandedOldTables] = useState<Record<string, boolean>>({});
  const [expandedNewTables, setExpandedNewTables] = useState<Record<string, boolean>>({});
  const [builderRanking, setBuilderRanking] = useState<BuilderScore[]>([]);
  const [fetchUrl, setFetchUrl] = useState('');
  const [fetchingSite, setFetchingSite] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchStartDate, setFetchStartDate] = useState('');
  const [fetchEndDate, setFetchEndDate] = useState('');
  const [fetchStatus, setFetchStatus] = useState<SiteFetchStatus>('all');

  const fetchDatesValid = Boolean(fetchStartDate && fetchEndDate && fetchStartDate <= fetchEndDate);

  const toggleOldTable = (tableId: string) => {
    setExpandedOldTables((prev) => ({ ...prev, [tableId]: !(prev[tableId] ?? true) }));
  };

  const toggleNewTable = (tableId: string) => {
    setExpandedNewTables((prev) => ({ ...prev, [tableId]: !(prev[tableId] ?? true) }));
  };

  const handleFileContent = (content: string, name: string) => {
    setImporting(true);
    setFileName(name);
    setTimeout(() => {
      try {
        const result = parseWxr(content);
        if (!result.ok) {
          alert(`Failed to parse WXR: ${result.message}`);
          setImporting(false);
          return;
        }
        const ranking = rankBuilders(result.articles);
        setBuilderRanking(ranking);
        const [best] = ranking;
        dispatch({
          type: 'LOAD_SOURCE',
          result,
          defaultBuilder: best.builderId,
          confidence: best.score,
        });
      } catch (err) {
        alert('Failed to parse WXR file. Please check the XML console logs or format.');
        console.error(err);
      } finally {
        setImporting(false);
      }
    }, 100);
  };

  const handleFetchSite = async () => {
    if (!fetchUrl.trim() || fetchingSite) return;
    setFetchingSite(true);
    setFetchError(null);
    setFetchProgress(null);
    try {
      const res = await fetchSite(
        fetchUrl.trim(),
        browserTextFetch,
        ({ stage, fetched, total }) => {
          if (stage === 'probe') setFetchProgress('Detecting REST API or feed…');
          else if (stage === 'media') setFetchProgress(`Resolving featured images (${fetched}/${total ?? '…'})`);
          else setFetchProgress(total != null ? `Fetching posts (${fetched}/${total})…` : `Fetched ${fetched} posts…`);
        },
        { startDate: fetchStartDate, endDate: fetchEndDate, status: fetchStatus },
      );
      if (!res.ok) {
        setFetchError(res.reason);
        return;
      }
      const rawUrl = fetchUrl.trim();
      let fetchedFrom = rawUrl;
      try {
        fetchedFrom = new URL(normalizeBaseUrl(rawUrl)).host;
      } catch {
        // unparseable input — fall back to showing the raw string
      }
      setFileName(fetchedFrom);
      setFetchProgress(res.truncated ? `Fetched ${res.result.totalItems} posts (may be truncated at 10,000) — ${res.source === 'rest' ? 'REST API' : 'RSS feed'}` : `Fetched ${res.result.totalItems} posts from ${res.source === 'rest' ? 'REST API' : 'RSS feed'}`);
      const ranking = rankBuilders(res.result.articles);
      setBuilderRanking(ranking);
      const [best] = ranking;
      dispatch({ type: 'LOAD_SOURCE', result: res.result, defaultBuilder: best.builderId, confidence: best.score });
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      setFetchingSite(false);
    }
  };

  const handleStartOver = () => {
    setFetchUrl('');
    setFetchStartDate('');
    setFetchEndDate('');
    setFetchStatus('all');
    setFetchProgress(null);
    setFetchError(null);
    dispatch({ type: 'CLEAR_SOURCE' });
  };

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) handleFileContent(text, file.name);
    };
    reader.readAsText(file);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) handleFileContent(text, file.name);
    };
    reader.readAsText(file);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const loadSample = () => {
    handleFileContent(SAMPLE_WXR, 'sample-old-site.xml');
  };

  const exportFullBackup = () => {
    const backup = createSiteDataBackup(state);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relay-site-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const res = restoreSiteDataBackup(text, state);
        if (res.ok) {
          dispatch({ type: 'RESTORE_SESSION', state: res.state });
          setRestoreStatus('Site data successfully restored!');
        } else {
          setRestoreStatus(res.message);
        }
      }
    };
    reader.readAsText(file);
  };

  const addNewTable = () => {
    const n = Object.keys(state.target.tables).length + 1;
    const label = `New Category Table ${n}`;
    const id = `custom-table-${n}-${Date.now()}`;
    const newTable: TermTable = {
      id,
      label,
      terms: [],
    };
    const updated = [...Object.values(state.target.tables), newTable];
    dispatch({ type: 'SET_TARGET_TABLES', tables: updated });
  };

  const removeTable = (tableId: string) => {
    const updated = Object.values(state.target.tables).filter((t) => t.id !== tableId);
    dispatch({ type: 'SET_TARGET_TABLES', tables: updated });
  };

  const addTermToTable = (tableId: string) => {
    const tables = Object.values(state.target.tables);
    const updated = tables.map((t) => {
      if (t.id !== tableId) return t;
      const termName = `New Term ${t.terms.length + 1}`;
      const slug = `new-term-${t.terms.length + 1}`;
      const tId = `${t.id}--${slug}`;
      return {
        ...t,
        terms: [...t.terms, { id: tId, name: termName, slug }],
      };
    });
    dispatch({ type: 'SET_TARGET_TABLES', tables: updated });
  };

  const removeTermFromTable = (tableId: string, termIdToRemove: string) => {
    const tables = Object.values(state.target.tables);
    const updated = tables.map((t) => {
      if (t.id !== tableId) return t;
      return {
        ...t,
        terms: t.terms.filter((tr) => tr.id !== termIdToRemove),
      };
    });
    dispatch({ type: 'SET_TARGET_TABLES', tables: updated });
  };

  const updateTableLabel = (tableId: string, newLabel: string) => {
    const tables = Object.values(state.target.tables);
    const updated = tables.map((t) => {
      if (t.id !== tableId) return t;
      return { ...t, label: newLabel };
    });
    dispatch({ type: 'SET_TARGET_TABLES', tables: updated });
  };

  const updateTermName = (tableId: string, termId: string, newName: string) => {
    const tables = Object.values(state.target.tables);
    const updated = tables.map((t) => {
      if (t.id !== tableId) return t;
      return {
        ...t,
        terms: t.terms.map((term) => {
          if (term.id !== termId) return term;
          return { ...term, name: newName };
        }),
      };
    });
    dispatch({ type: 'SET_TARGET_TABLES', tables: updated });
  };

  const updateTermSlug = (tableId: string, termId: string, newSlug: string) => {
    const tables = Object.values(state.target.tables);
    const updated = tables.map((t) => {
      if (t.id !== tableId) return t;
      return {
        ...t,
        terms: t.terms.map((term) => {
          if (term.id !== termId) return term;
          return { ...term, slug: newSlug };
        }),
      };
    });
    dispatch({ type: 'SET_TARGET_TABLES', tables: updated });
  };

  const addNewOldTable = () => {
    const n = Object.keys(state.oldTables).length + 1;
    const label = `Old Custom Table ${n}`;
    const id = `old-custom-table-${n}-${Date.now()}`;
    const newTable: TermTable = {
      id,
      label,
      terms: [],
    };
    const updated = [...Object.values(state.oldTables), newTable];
    dispatch({ type: 'SET_OLD_TABLES', tables: updated });
  };

  const removeOldTable = (tableId: string) => {
    const updated = Object.values(state.oldTables).filter((t) => t.id !== tableId);
    dispatch({ type: 'SET_OLD_TABLES', tables: updated });
  };

  const addTermToOldTable = (tableId: string) => {
    const tables = Object.values(state.oldTables);
    const updated = tables.map((t) => {
      if (t.id !== tableId) return t;
      const termName = `New Old Term ${t.terms.length + 1}`;
      const slug = `new-old-term-${t.terms.length + 1}`;
      const tId = `${t.id}--${slug}`;
      return {
        ...t,
        terms: [...t.terms, { id: tId, name: termName, slug }],
      };
    });
    dispatch({ type: 'SET_OLD_TABLES', tables: updated });
  };

  const removeTermFromOldTable = (tableId: string, termIdToRemove: string) => {
    const tables = Object.values(state.oldTables);
    const updated = tables.map((t) => {
      if (t.id !== tableId) return t;
      return {
        ...t,
        terms: t.terms.filter((tr) => tr.id !== termIdToRemove),
      };
    });
    dispatch({ type: 'SET_OLD_TABLES', tables: updated });
  };

  const updateOldTableLabel = (tableId: string, newLabel: string) => {
    const tables = Object.values(state.oldTables);
    const updated = tables.map((t) => {
      if (t.id !== tableId) return t;
      return { ...t, label: newLabel };
    });
    dispatch({ type: 'SET_OLD_TABLES', tables: updated });
  };

  const updateOldTermName = (tableId: string, termId: string, newName: string) => {
    const tables = Object.values(state.oldTables);
    const updated = tables.map((t) => {
      if (t.id !== tableId) return t;
      return {
        ...t,
        terms: t.terms.map((term) => {
          if (term.id !== termId) return term;
          return { ...term, name: newName };
        }),
      };
    });
    dispatch({ type: 'SET_OLD_TABLES', tables: updated });
  };

  const updateOldTermSlug = (tableId: string, termId: string, newSlug: string) => {
    const tables = Object.values(state.oldTables);
    const updated = tables.map((t) => {
      if (t.id !== tableId) return t;
      return {
        ...t,
        terms: t.terms.map((term) => {
          if (term.id !== termId) return term;
          return { ...term, slug: newSlug };
        }),
      };
    });
    dispatch({ type: 'SET_OLD_TABLES', tables: updated });
  };

  const missingOldTerms = useMemo(
    () => findMissingOldTerms(state.source?.taxonomies ?? {}, state.oldTables),
    [state.source, state.oldTables],
  );

  const addMissingOldTerms = () => {
    const updated = mergeMissingIntoOldTables(state.oldTables, missingOldTerms);
    dispatch({ type: 'SET_OLD_TABLES', tables: updated });
  };

  if (!state.source) {
    return (
      <div style={{ maxWidth: '960px', margin: '60px auto' }}>
        <div
          onDragOver={onDragOver}
          onDrop={onDrop}
          style={{
            border: '2px dashed oklch(80% 0.01 250)',
            borderRadius: '16px',
            background: 'white',
            padding: '56px 32px',
            textAlign: 'center',
            transition: 'border-color 0.15s',
            boxShadow: '0 4px 6px -1px oklch(0% 0 0 / 0.02)',
          }}
        >
          {importing ? (
            <div>
              <div className="spinner" />
              <div style={{ fontSize: '15px', fontWeight: 600 }}>Reading {fileName}…</div>
              <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)', marginTop: '4px' }}>
                Detecting page builder, taxonomies and media
              </div>
            </div>
          ) : (
            <div>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  margin: '0 auto 16px',
                  borderRadius: '12px',
                  background: 'oklch(95% 0.01 265)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'oklch(50% 0.16 265)',
                  fontSize: '24px',
                }}
              >
                ↑
              </div>
              <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>Drop your WordPress export here</div>
              <div
                style={{
                  fontSize: '14px',
                  color: 'oklch(55% 0.01 250)',
                  marginBottom: '20px',
                  lineHeight: 1.5,
                  maxWidth: '480px',
                  margin: '0 auto 20px',
                }}
              >
                A WXR file is the .xml export WordPress generates under Tools → Export. Drag it in, or choose a file below.
              </div>
              <label className="btn btn-primary">
                Choose file
                <input type="file" accept=".xml" onChange={onFilePick} style={{ display: 'none' }} />
              </label>
              <div style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={loadSample}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '13px',
                    color: 'oklch(50% 0.16 265)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Use a sample export instead
                </button>
              </div>
            </div>
          )}
        </div>
        <div style={{ marginTop: '24px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>Or fetch the site directly (no WXR file needed)</div>
          <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)', marginBottom: '12px', lineHeight: 1.5 }}>
            For sites where you can&apos;t get a Tools → Export file: Relay reads the public WordPress REST API
            (or falls back to the RSS feed) to pull posts and featured images.
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={fetchUrl}
              onChange={(e) => setFetchUrl(e.target.value)}
              placeholder="https://old-site.example"
              disabled={fetchingSite}
              style={{ flex: 1, minWidth: '240px', padding: '10px 12px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '8px', fontSize: '14px' }}
            />
            <button type="button" onClick={handleFetchSite} disabled={fetchingSite || !fetchDatesValid} className="btn btn-primary">
              {fetchingSite ? 'Fetching…' : 'Fetch posts'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginTop: '10px' }}>
            <label style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)' }}>
              Start date{' '}
              <input
                type="date"
                aria-label="Start date"
                value={fetchStartDate}
                onChange={(e) => setFetchStartDate(e.target.value)}
                disabled={fetchingSite}
                style={{ padding: '8px 10px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '8px', fontSize: '14px' }}
              />
            </label>
            <label style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)' }}>
              End date{' '}
              <input
                type="date"
                aria-label="End date"
                value={fetchEndDate}
                onChange={(e) => setFetchEndDate(e.target.value)}
                disabled={fetchingSite}
                style={{ padding: '8px 10px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '8px', fontSize: '14px' }}
              />
            </label>
            <label style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)' }}>
              Status{' '}
              <select
                aria-label="Status"
                value={fetchStatus}
                onChange={(e) => setFetchStatus(e.target.value as SiteFetchStatus)}
                disabled={fetchingSite}
                style={{ padding: '8px 10px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '8px', fontSize: '14px' }}
              >
                <option value="all">All</option>
                <option value="publish">Published</option>
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                <option value="future">Future</option>
                <option value="private">Private</option>
              </select>
            </label>
          </div>
          {fetchProgress && <div style={{ marginTop: '10px', fontSize: '13px', color: 'oklch(50% 0.01 250)' }}>{fetchProgress}</div>}
          {fetchError && <div style={{ marginTop: '10px', fontSize: '13px', color: 'oklch(50% 0.15 20)' }}>{fetchError}</div>}
        </div>
      </div>
    );
  }

  const { source, builderId, builderConfidence } = state;
  const builderScoreById: Partial<Record<BuilderId, BuilderScore>> = Object.fromEntries(
    builderRanking.map((r) => [r.builderId, r]),
  );
  const topBuilderId = builderRanking[0]?.builderId;
  const selectedScore = builderId ? builderScoreById[builderId] : undefined;
  const selectedIsTopPick = builderId !== undefined && builderId === topBuilderId;
  let domain = 'old-site.com';
  if (source.siteUrl) {
    try {
      domain = new URL(source.siteUrl).hostname;
    } catch {
      domain = source.siteUrl;
    }
  }

  const totalArticles = source.articles.length;
  const totalAttachments = source.attachments?.length ?? 0;
  const totalTaxonomies = Object.values(source.taxonomies ?? {}).reduce((sum, list) => sum + list.length, 0);
  const totalAuthors = source.authors?.length ?? 0;

  const cardStyleBase: React.CSSProperties = {
    background: 'white',
    border: '1px solid oklch(90% 0.005 250)',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px oklch(0% 0 0 / 0.02)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '960px', width: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700 }}>Import detected</div>
          {fetchProgress && (
            <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)', marginTop: '2px' }}>{fetchProgress}</div>
          )}
          <div style={{ fontSize: '14px', color: 'oklch(55% 0.01 250)', marginTop: '2px' }}>
            From {fileName} — review before mapping content
          </div>
        </div>
        <button
          type="button"
          onClick={handleStartOver}
          className="btn btn-secondary"
        >
          Start over
        </button>
      </div>

      <div style={{ ...cardStyleBase, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'oklch(50% 0.01 250)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '6px',
            }}
          >
            Source domain
          </div>
          <input
            type="text"
            readOnly
            value={domain}
            style={{ width: '100%', padding: '10px 12px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '8px', fontSize: '14px', background: 'oklch(97% 0.004 250)' }}
          />
        </div>

        <div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'oklch(50% 0.01 250)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '6px',
            }}
          >
            Detected page builder
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={builderId ?? 'plainHtml'}
              onChange={(e) => dispatch({ type: 'SET_BUILDER', builderId: e.target.value as BuilderId })}
              style={{ flex: 1, padding: '10px 12px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '8px', fontSize: '14px' }}
            >
              {BUILDER_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {builderOptionLabel(opt, builderScoreById[opt])}
                </option>
              ))}
            </select>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '5px 9px',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
                ...confidenceTierStyle(selectedScore?.confidentCount ?? 0, selectedIsTopPick),
              }}
            >
              {selectedScore
                ? `${selectedScore.confidentCount}/${selectedScore.totalPosts} posts matched`
                : `${Math.round(builderConfidence * 100)}% match`}
            </div>
            {builderId && <BuilderStatusPill status={BUILDER_VALIDATION_STATUS[builderId]} />}
          </div>
        </div>
      </div>

      {builderRanking.length > 0 && (
        <div style={cardStyleBase}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'oklch(50% 0.01 250)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '10px',
            }}
          >
            Builder match breakdown
          </div>
          <div style={{ fontSize: '12px', color: 'oklch(55% 0.01 250)', marginBottom: '12px' }}>
            Share of posts where each builder&apos;s markup was unambiguously found — not a raw score, so a builder
            used on only part of the site can still be the correct pick.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {builderRanking.map((entry, i) => {
              const confidenceSharePct = entry.totalPosts > 0 ? Math.round((entry.confidentCount / entry.totalPosts) * 100) : 0;
              return (
                <div
                  key={entry.builderId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: i === 0 ? 'oklch(97% 0.02 150)' : 'transparent',
                    border: i === 0 ? '1px solid oklch(88% 0.05 150)' : '1px solid transparent',
                  }}
                >
                  <div style={{ width: '110px', fontSize: '13px', fontWeight: i === 0 ? 700 : 500 }}>
                    {BUILDER_LABELS[entry.builderId]}
                  </div>
                  <div style={{ flex: 1, height: '6px', background: 'oklch(93% 0.005 250)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${confidenceSharePct}%`,
                        height: '100%',
                        background: i === 0 ? 'oklch(60% 0.14 150)' : 'oklch(75% 0.01 250)',
                      }}
                    />
                  </div>
                  <div style={{ width: '78px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'oklch(45% 0.01 250)' }}>
                    {entry.confidentCount}/{entry.totalPosts} posts
                  </div>
                  <div style={{ width: '56px', textAlign: 'right', fontSize: '11px', color: 'oklch(60% 0.01 250)' }}>
                    avg {Math.round(entry.score * 100)}%
                  </div>
                  <BuilderStatusPill status={BUILDER_VALIDATION_STATUS[entry.builderId]} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px' }}>
        <div style={cardStyleBase}>
          <div style={{ fontSize: '26px', fontWeight: 700 }}>{totalArticles}</div>
          <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)', marginTop: '2px' }}>Posts &amp; pages</div>
          <div style={{ fontSize: '12px', color: 'oklch(60% 0.01 250)', marginTop: '8px' }}>Ready for block conversion</div>
        </div>
        <div style={cardStyleBase}>
          <div style={{ fontSize: '26px', fontWeight: 700 }}>{totalAttachments}</div>
          <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)', marginTop: '2px' }}>Media attachments</div>
          <div style={{ fontSize: '12px', color: 'oklch(60% 0.01 250)', marginTop: '8px' }}>Indexed for URL resolution</div>
        </div>
        <div style={cardStyleBase}>
          <div style={{ fontSize: '26px', fontWeight: 700 }}>{totalTaxonomies}</div>
          <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)', marginTop: '2px' }}>Taxonomy terms</div>
          <div style={{ fontSize: '12px', color: 'oklch(60% 0.01 250)', marginTop: '8px' }}>Categories and tags found</div>
        </div>
        <div style={cardStyleBase}>
          <div style={{ fontSize: '26px', fontWeight: 700 }}>{totalAuthors}</div>
          <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)', marginTop: '2px' }}>Authors</div>
          <div style={{ fontSize: '12px', color: 'oklch(60% 0.01 250)', marginTop: '8px' }}>Found in metadata</div>
        </div>
      </div>

      <div style={{ ...cardStyleBase, padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid oklch(92% 0.005 250)' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700 }}>Old &amp; new site data</div>
            <div style={{ fontSize: '12px', color: 'oklch(55% 0.01 250)', marginTop: '2px' }}>
              Export/Import JSON covers taxonomy tables, term mappings, and conversion settings — reusable across a different WXR import.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={exportFullBackup} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>
              Export JSON
            </button>
            <label className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}>
              Import JSON
              <input type="file" accept="application/json" onChange={onImportBackupFile} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid oklch(92% 0.005 250)', background: 'oklch(98% 0.003 250)' }}>
          <button
            type="button"
            onClick={() => setActiveDataTab('old')}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: activeDataTab === 'old' ? 'white' : 'transparent',
              borderBottom: activeDataTab === 'old' ? '2px solid oklch(50% 0.16 265)' : '2px solid transparent',
              fontWeight: activeDataTab === 'old' ? 600 : 500,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Old site taxonomies ({Object.values(state.oldTables).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveDataTab('new')}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: activeDataTab === 'new' ? 'white' : 'transparent',
              borderBottom: activeDataTab === 'new' ? '2px solid oklch(50% 0.16 265)' : '2px solid transparent',
              fontWeight: activeDataTab === 'new' ? 600 : 500,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            New site taxonomies ({Object.values(state.target.tables).length})
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {activeDataTab === 'old' ? (
            <div>
              <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)', marginBottom: '14px' }}>
                Add legacy categories/tags/taxonomies on the old site:
              </div>
              {missingOldTerms.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    background: 'oklch(97% 0.02 80)',
                    border: '1px solid oklch(88% 0.05 80)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '14px',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    The tool also found <strong>{missingOldTerms.length}</strong> taxonomy term
                    {missingOldTerms.length === 1 ? '' : 's'} in the imported XML — add them to the current tables?
                  </div>
                  <button
                    type="button"
                    onClick={addMissingOldTerms}
                    className="btn btn-primary"
                    style={{ padding: '7px 14px', fontSize: '12px', whiteSpace: 'nowrap' }}
                  >
                    Add
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.values(state.oldTables).map((tbl) => {
                  const isOldExpanded = expandedOldTables[tbl.id] ?? true;
                  return (
                  <div key={tbl.id} style={{ border: '1px solid oklch(93% 0.005 250)', borderRadius: '10px', padding: '14px', background: 'white' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
                      <span
                        onClick={() => toggleOldTable(tbl.id)}
                        style={{ fontSize: '12px', color: 'oklch(55% 0.01 250)', cursor: 'pointer', padding: '0 4px', userSelect: 'none' }}
                      >
                        {isOldExpanded ? '▼' : '►'}
                      </span>
                      <input
                        type="text"
                        value={tbl.label}
                        onChange={(e) => updateOldTableLabel(tbl.id, e.target.value)}
                        placeholder="Table name"
                        style={{ flex: 1, padding: '8px 10px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '7px', fontSize: '13px', fontWeight: 600 }}
                      />
                      <div style={{ fontSize: '12px', color: 'oklch(55% 0.01 250)', whiteSpace: 'nowrap' }}>
                        {tbl.terms.length} term{tbl.terms.length === 1 ? '' : 's'}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOldTable(tbl.id)}
                        className="btn btn-danger"
                        style={{ padding: '8px 12px', fontSize: '12px' }}
                      >
                        Remove Table
                      </button>
                    </div>
                    {isOldExpanded && (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                          {tbl.terms.map((trm) => (
                            <div key={trm.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input
                                type="text"
                                value={trm.name}
                                onChange={(e) => updateOldTermName(tbl.id, trm.id, e.target.value)}
                                placeholder="Term name"
                                style={{ flex: 1, padding: '7px 9px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '6px', fontSize: '13px' }}
                              />
                              <input
                                type="text"
                                value={trm.slug || ''}
                                onChange={(e) => updateOldTermSlug(tbl.id, trm.id, e.target.value)}
                                placeholder="slug"
                                style={{ width: '120px', padding: '7px 9px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '6px', fontSize: '13px', fontFamily: "'IBM Plex Mono', monospace" }}
                              />
                              <button
                                type="button"
                                onClick={() => removeTermFromOldTable(tbl.id, trm.id)}
                                style={{ width: '30px', height: '32px', background: 'white', border: '1px solid oklch(88% 0.005 250)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', color: 'oklch(55% 0.01 250)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => addTermToOldTable(tbl.id)}
                          className="btn btn-secondary"
                          style={{ padding: '8px 12px', fontSize: '12px' }}
                        >
                          + Add Term
                        </button>
                      </>
                    )}
                  </div>
                  );
                })}
                {Object.values(state.oldTables).length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'oklch(55% 0.01 250)', fontSize: '13px' }}>
                    No tables defined yet. Click &quot;+ Add Table&quot; below to create one.
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={addNewOldTable}
                className="btn btn-secondary"
                style={{ marginTop: '14px' }}
              >
                + Add Table
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)', marginBottom: '14px' }}>
                Add target categories/tags where legacy items should be mapped:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.values(state.target.tables).map((tbl) => {
                  const isNewExpanded = expandedNewTables[tbl.id] ?? true;
                  return (
                  <div key={tbl.id} style={{ border: '1px solid oklch(93% 0.005 250)', borderRadius: '10px', padding: '14px', background: 'white' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
                      <span
                        onClick={() => toggleNewTable(tbl.id)}
                        style={{ fontSize: '12px', color: 'oklch(55% 0.01 250)', cursor: 'pointer', padding: '0 4px', userSelect: 'none' }}
                      >
                        {isNewExpanded ? '▼' : '►'}
                      </span>
                      <input
                        type="text"
                        value={tbl.label}
                        onChange={(e) => updateTableLabel(tbl.id, e.target.value)}
                        placeholder="Table name"
                        style={{ flex: 1, padding: '8px 10px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '7px', fontSize: '13px', fontWeight: 600 }}
                      />
                      <div style={{ fontSize: '12px', color: 'oklch(55% 0.01 250)', whiteSpace: 'nowrap' }}>
                        {tbl.terms.length} term{tbl.terms.length === 1 ? '' : 's'}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTable(tbl.id)}
                        className="btn btn-danger"
                        style={{ padding: '8px 12px', fontSize: '12px' }}
                      >
                        Remove Table
                      </button>
                    </div>
                    {isNewExpanded && (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                          {tbl.terms.map((trm) => (
                            <div key={trm.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input
                                type="text"
                                value={trm.name}
                                onChange={(e) => updateTermName(tbl.id, trm.id, e.target.value)}
                                placeholder="Term name"
                                style={{ flex: 1, padding: '7px 9px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '6px', fontSize: '13px' }}
                              />
                              <input
                                type="text"
                                value={trm.slug || ''}
                                onChange={(e) => updateTermSlug(tbl.id, trm.id, e.target.value)}
                                placeholder="slug"
                                style={{ width: '120px', padding: '7px 9px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '6px', fontSize: '13px', fontFamily: "'IBM Plex Mono', monospace" }}
                              />
                              <button
                                type="button"
                                onClick={() => removeTermFromTable(tbl.id, trm.id)}
                                style={{ width: '30px', height: '32px', background: 'white', border: '1px solid oklch(88% 0.005 250)', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', color: 'oklch(55% 0.01 250)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => addTermToTable(tbl.id)}
                          className="btn btn-secondary"
                          style={{ padding: '8px 12px', fontSize: '12px' }}
                        >
                          + Add Term
                        </button>
                      </>
                    )}
                  </div>
                  );
                })}
                {Object.values(state.target.tables).length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'oklch(55% 0.01 250)', fontSize: '13px' }}>
                    No tables defined yet. Click &quot;+ Add Table&quot; below to create one.
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={addNewTable}
                className="btn btn-secondary"
                style={{ marginTop: '14px' }}
              >
                + Add Table
              </button>
            </div>
          )}
        </div>

        {restoreStatus && (
          <div style={{ padding: '12px 20px', background: 'oklch(96% 0.05 150)', color: 'oklch(40% 0.15 150)', fontSize: '13px' }}>
            {restoreStatus}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tab: 'mappings' })}
          className="btn btn-primary"
          style={{ padding: '10px 20px', fontSize: '14px' }}
        >
          Continue to mappings →
        </button>
      </div>
    </div>
  );
};
