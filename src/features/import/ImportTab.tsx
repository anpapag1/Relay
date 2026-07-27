import React, { useState } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { parseWxr } from '../../core/wxr/parseWxr';
import { detectBuilder } from '../../core/builders/detectBuilder';
import { SAMPLE_WXR } from './sampleWxr';
import { createSessionBackup, restoreSessionBackup } from '../../state/session';
import type { BuilderId } from '../../core/builders/types';
import type { TermTable } from '../../types/domain';

const BUILDER_OPTIONS: BuilderId[] = ['plainHtml', 'elementor', 'divi', 'wpbakery'];

export const ImportTab: React.FC = () => {
  const { state, dispatch } = useAppState();
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string>('sample-export.xml');
  const [activeDataTab, setActiveDataTab] = useState<'old' | 'new'>('old');
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

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
        const detection = detectBuilder(result.articles);
        dispatch({
          type: 'LOAD_SOURCE',
          result,
          defaultBuilder: detection.builderId,
          confidence: detection.score,
        });
      } catch (err) {
        alert('Failed to parse WXR file. Please check the XML console logs or format.');
        console.error(err);
      } finally {
        setImporting(false);
      }
    }, 100);
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
    const backup = createSessionBackup(state);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relay-session-${new Date().toISOString().slice(0, 10)}.json`;
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
        const res = restoreSessionBackup(text, state);
        if (res.ok) {
          dispatch({ type: 'RESTORE_SESSION', state: res.state });
          setRestoreStatus('Session successfully restored!');
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
      </div>
    );
  }

  const { source, builderId, builderConfidence } = state;
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
          <div style={{ fontSize: '14px', color: 'oklch(55% 0.01 250)', marginTop: '2px' }}>
            From {fileName} — review before mapping content
          </div>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: 'CLEAR_SOURCE' })}
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={builderId ?? 'plainHtml'}
              onChange={(e) => dispatch({ type: 'SET_BUILDER', builderId: e.target.value as BuilderId })}
              style={{ flex: 1, padding: '10px 12px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '8px', fontSize: '14px' }}
            >
              {BUILDER_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'oklch(50% 0.14 150)',
                background: 'oklch(95% 0.03 150)',
                padding: '5px 9px',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              {builderConfidence}% match
            </div>
          </div>
        </div>
      </div>

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
              Export/Import JSON covers this whole session — site data, mappings, and conversion settings.
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
            Old site taxonomies ({totalTaxonomies})
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
                Taxonomy terms discovered in {fileName}:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                {Object.entries(source.taxonomies ?? {}).map(([domainName, terms]) => (
                  <div key={domainName} style={{ border: '1px solid oklch(93% 0.005 250)', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px', textTransform: 'capitalize' }}>
                      {domainName} ({terms.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {terms.map((term) => (
                        <span
                          key={term.nicename}
                          style={{
                            background: 'oklch(96% 0.004 250)',
                            border: '1px solid oklch(90% 0.005 250)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '12px',
                          }}
                        >
                          {term.name} <code style={{ color: 'oklch(60% 0.01 250)' }}>({term.nicename})</code>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)', marginBottom: '14px' }}>
                Add target categories/tags where legacy items should be mapped:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.values(state.target.tables).map((tbl) => (
                  <div key={tbl.id} style={{ border: '1px solid oklch(93% 0.005 250)', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
                      <div style={{ flex: 1, fontWeight: 600, fontSize: '14px' }}>{tbl.label}</div>
                      <button
                        type="button"
                        onClick={() => addTermToTable(tbl.id)}
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        + Add Term
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTable(tbl.id)}
                        className="btn btn-danger"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        Remove Table
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {tbl.terms.map((trm) => (
                        <span
                          key={trm.id}
                          style={{
                            background: 'oklch(96% 0.004 250)',
                            border: '1px solid oklch(90% 0.005 250)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          {trm.name} <code style={{ color: 'oklch(60% 0.01 250)' }}>({trm.slug})</code>
                          <button
                            type="button"
                            onClick={() => removeTermFromTable(tbl.id, trm.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(60% 0.01 250)', padding: 0 }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
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
