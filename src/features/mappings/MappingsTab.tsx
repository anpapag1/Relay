import React, { useState } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { termMappingId } from '../../core/mappings/termId';
import { createSessionBackup } from '../../state/session';

export const MappingsTab: React.FC = () => {
  const { state, dispatch } = useAppState();
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({ category: true, post_tag: true });
  const [searchQuery, setSearchQuery] = useState('');

  if (!state.source) {
    return (
      <div style={{ maxWidth: '960px', margin: '60px auto', textAlign: 'center', padding: '40px', background: 'white', borderRadius: '12px', border: '1px solid oklch(90% 0.005 250)' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>No WordPress export loaded</div>
        <div style={{ fontSize: '14px', color: 'oklch(55% 0.01 250)', marginBottom: '20px' }}>
          Please go to the Import tab and load a WXR file first.
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

  const { source, mappings, target } = state;
  const taxonomies = source.taxonomies ?? {};
  const targetTables = Object.values(target.tables);
  const allTargetTerms = targetTables.flatMap((tbl) =>
    tbl.terms.map((t) => ({ ...t, tableId: tbl.id }))
  );

  const toggleDomain = (domain: string) => {
    setExpandedDomains((prev) => ({ ...prev, [domain]: !prev[domain] }));
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

  // Count how many terms are mapped vs total
  let totalTerms = 0;
  let mappedTerms = 0;
  Object.entries(taxonomies).forEach(([domainName, terms]) => {
    terms.forEach((term) => {
      totalTerms++;
      const key = termMappingId(domainName, term.nicename);
      if (mappings[key]?.targetTermId) {
        mappedTerms++;
      }
    });
  });

  const percentMapped = totalTerms > 0 ? Math.round((mappedTerms / totalTerms) * 100) : 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '960px', width: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700 }}>Map taxonomies</div>
          <div style={{ fontSize: '14px', color: 'oklch(55% 0.01 250)', marginTop: '2px', maxWidth: '560px' }}>
            Decide where every term from the old site lands: a category, a tag, or custom taxonomy term.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={() => dispatch({ type: 'RESET_MAPPINGS' })} className="btn btn-secondary">
            Reset to suggested
          </button>
          <button type="button" onClick={exportFullBackup} className="btn btn-secondary">
            Export session JSON
          </button>
        </div>
      </div>

      <div style={{ background: 'white', border: '1px solid oklch(90% 0.005 250)', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Mapping progress</div>
          <div style={{ width: '200px', height: '8px', background: 'oklch(92% 0.005 250)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${percentMapped}%`, height: '100%', background: 'oklch(50% 0.16 265)', transition: 'width 0.3s ease' }} />
          </div>
          <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)' }}>{mappedTerms} of {totalTerms} mapped ({percentMapped}%)</div>
        </div>
        <input
          type="text"
          placeholder="Filter terms…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ padding: '6px 12px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '6px', fontSize: '13px', width: '200px' }}
        />
      </div>

      {Object.entries(taxonomies).map(([domainName, terms]) => {
        const isExpanded = expandedDomains[domainName] ?? true;
        const filteredTerms = searchQuery
          ? terms.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.nicename.toLowerCase().includes(searchQuery.toLowerCase()))
          : terms;

        if (searchQuery && filteredTerms.length === 0) return null;

        return (
          <div
            key={domainName}
            style={{
              background: 'white',
              border: '1px solid oklch(90% 0.005 250)',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px oklch(0% 0 0 / 0.02)',
            }}
          >
            <div
              onClick={() => toggleDomain(domainName)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                cursor: 'pointer',
                background: 'oklch(98% 0.003 250)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: 'oklch(55% 0.01 250)' }}>{isExpanded ? '▼' : '►'}</span>
                <div style={{ fontSize: '15px', fontWeight: 700, textTransform: 'capitalize' }}>{domainName === 'post_tag' ? 'Tags' : domainName}</div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'oklch(50% 0.01 250)', background: 'oklch(95% 0.005 250)', padding: '2px 7px', borderRadius: '5px' }}>
                  legacy {domainName}
                </div>
              </div>
              <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)' }}>{terms.length} terms</div>
            </div>

            {isExpanded && (
              <div style={{ borderTop: '1px solid oklch(93% 0.005 250)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.6fr 1.5fr 1.5fr', gap: '12px', padding: '10px 20px', fontSize: '11px', fontWeight: 600, color: 'oklch(55% 0.01 250)', textTransform: 'uppercase', letterSpacing: '0.03em', background: 'oklch(99% 0.002 250)' }}>
                  <div>Old Site Term</div>
                  <div>Count</div>
                  <div>Mapping Status</div>
                  <div>Target Destination</div>
                </div>

                {filteredTerms.map((term) => {
                  const key = termMappingId(domainName, term.nicename);
                  const currentMapping = mappings[key];
                  const targetTermId = currentMapping?.targetTermId;
                  const targetTerm = allTargetTerms.find((t) => t.id === targetTermId);
                  const origin = currentMapping?.origin;

                  return (
                    <div
                      key={term.nicename}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 0.6fr 1.5fr 1.5fr',
                        gap: '12px',
                        padding: '12px 20px',
                        alignItems: 'center',
                        borderTop: '1px solid oklch(95% 0.005 250)',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500 }}>{term.name}</div>
                        <div style={{ fontSize: '11px', color: 'oklch(55% 0.01 250)', marginTop: '2px' }}>
                          slug: <code>{term.nicename}</code>
                        </div>
                        <div style={{ fontSize: '11px', color: 'oklch(50% 0.14 150)', marginTop: '2px' }}>
                          suggested: {term.name}
                        </div>
                      </div>

                      <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)' }}>
                        {term.count !== undefined ? `${term.count} posts` : '—'}
                      </div>

                      <div>
                        {targetTerm ? (
                          <span style={{ fontSize: '12px', color: origin === 'user' ? 'oklch(50% 0.16 265)' : 'oklch(55% 0.15 150)', fontWeight: 600 }}>
                            {origin === 'user' ? '● Manual override' : '✓ Auto-suggested'}
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'oklch(60% 0.16 60)', fontWeight: 600 }}>○ Unmapped</span>
                        )}
                      </div>

                      <div>
                        <select
                          value={targetTermId ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) {
                              // Unmap
                              dispatch({
                                type: 'SET_TERM_MAPPING',
                                oldDomain: domainName,
                                oldNicename: term.nicename,
                                targetTableId: '',
                                targetTermId: '',
                              });
                            } else {
                              const found = allTargetTerms.find((t) => t.id === val);
                              if (found) {
                                dispatch({
                                  type: 'SET_TERM_MAPPING',
                                  oldDomain: domainName,
                                  oldNicename: term.nicename,
                                  targetTableId: found.tableId,
                                  targetTermId: found.id,
                                });
                              }
                            }
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 10px',
                            border: '1px solid oklch(88% 0.005 250)',
                            borderRadius: '6px',
                            fontSize: '13px',
                            background: targetTerm ? 'white' : 'oklch(98% 0.005 60)',
                          }}
                        >
                          <option value="">-- Do not map (leave unmapped) --</option>
                          {targetTables.map((tbl) => (
                            <optgroup key={tbl.id} label={tbl.label}>
                              {tbl.terms.map((tt) => (
                                <option key={tt.id} value={tt.id}>
                                  {tt.name} ({tt.slug})
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', tab: 'settings' })}
          className="btn btn-primary"
          style={{ padding: '10px 20px', fontSize: '14px' }}
        >
          Continue to Settings →
        </button>
      </div>
    </div>
  );
};
