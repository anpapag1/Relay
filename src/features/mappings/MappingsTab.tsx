import React, { useState } from 'react';
import { useAppState } from '../../state/AppStateContext';
import { termMappingId } from '../../core/mappings/termId';
import { createSessionBackup } from '../../state/session';

const CORE_DOMAINS = new Set(['category', 'post_tag']);

export const MappingsTab: React.FC = () => {
  const { state, dispatch } = useAppState();
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({ category: true, post_tag: true });
  const [pickerSearch, setPickerSearch] = useState('');

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

  const { source, mappings, target, oldTables } = state;
  const oldTableList = Object.values(oldTables);
  const targetTables = Object.values(target.tables);
  const openPickerTermId = state.ui.pickers.destinationTermId;
  const targetTermsById = new Map(
    targetTables.map((tbl) => [tbl.id, new Map(tbl.terms.map((t) => [t.id, t]))]),
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

  const openPicker = (termId: string) => {
    setPickerSearch('');
    dispatch({ type: 'SET_DESTINATION_PICKER', termId });
  };
  const closePicker = () => dispatch({ type: 'SET_DESTINATION_PICKER', termId: null });

  if (oldTableList.length === 0) {
    return (
      <div style={{ maxWidth: '960px', margin: '60px auto', textAlign: 'center', padding: '40px', background: 'white', borderRadius: '12px', border: '1px solid oklch(90% 0.005 250)' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>No old-site taxonomies yet</div>
        <div style={{ fontSize: '14px', color: 'oklch(55% 0.01 250)', marginBottom: '20px' }}>
          Head to the Import tab to add old-site categories, tags, or custom taxonomies before mapping them.
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '960px', width: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '22px', fontWeight: 700 }}>Map taxonomies</div>
          <div style={{ fontSize: '14px', color: 'oklch(55% 0.01 250)', marginTop: '2px', maxWidth: '560px' }}>
            Decide where every term from the old site lands: a category, a tag, or nowhere at all.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={exportFullBackup} className="btn btn-secondary">
            Export session JSON
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: 'OPEN_MODAL', modal: 'resetConfirm' })}
            style={{ border: '1px solid oklch(85% 0.1 25)', background: 'white', color: 'oklch(50% 0.18 25)', fontSize: '13px', fontWeight: 600, padding: '9px 14px', borderRadius: '8px', cursor: 'pointer' }}
          >
            Clear everything
          </button>
        </div>
      </div>

      {oldTableList.map((table) => {
        const domainName = table.id;
        const isExpanded = expandedDomains[domainName] ?? true;
        const isCore = CORE_DOMAINS.has(domainName);
        const siteTerms = source.taxonomies?.[domainName] ?? [];
        const siteTermsByNicename = new Map(siteTerms.map((s) => [s.nicename, s]));

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
                {isCore && (
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'oklch(50% 0.01 250)', background: 'oklch(95% 0.005 250)', padding: '2px 7px', borderRadius: '5px' }}>
                    built-in
                  </div>
                )}
              </div>
              <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)' }}>{table.terms.length} terms</div>
            </div>

            {isExpanded && (
              <div style={{ borderTop: '1px solid oklch(93% 0.005 250)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.6fr 0.9fr 1.8fr 0.8fr', gap: '12px', padding: '10px 20px', fontSize: '11px', fontWeight: 600, color: 'oklch(55% 0.01 250)', textTransform: 'uppercase', letterSpacing: '0.03em', background: 'oklch(99% 0.002 250)' }}>
                  <div>Term</div>
                  <div>Count</div>
                  <div>Action</div>
                  <div>Destination</div>
                  <div></div>
                </div>

                {table.terms.map((term) => {
                  const nicename = term.slug || term.id;
                  const key = termMappingId(domainName, nicename);
                  const mapping = mappings[key];
                  const targetTableId = mapping?.targetTableId ?? null;
                  const targetTermIds = mapping?.targetTermIds ?? [];
                  const excluded = mapping?.excluded ?? false;
                  const selectedTable = targetTables.find((t) => t.id === targetTableId) ?? null;
                  const selectedTableTermsById = targetTableId ? targetTermsById.get(targetTableId) : undefined;
                  const chipTerms = selectedTableTermsById
                    ? targetTermIds.map((id) => selectedTableTermsById.get(id)).filter((t): t is NonNullable<typeof t> => t != null)
                    : [];
                  const pickerOpen = openPickerTermId === key;
                  const pickerOptions =
                    pickerOpen && selectedTable
                      ? selectedTable.terms.filter(
                          (t) => !targetTermIds.includes(t.id) && t.name.toLowerCase().includes(pickerSearch.toLowerCase()),
                        )
                      : [];
                  const siteMatch = siteTermsByNicename.get(nicename);

                  return (
                    <div
                      key={term.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 0.6fr 0.9fr 1.8fr 0.8fr',
                        gap: '12px',
                        padding: '12px 20px',
                        alignItems: 'center',
                        borderTop: '1px solid oklch(95% 0.005 250)',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 500 }}>{term.name}</div>
                        {mapping?.origin === 'suggested' && chipTerms.length > 0 && (
                          <div style={{ fontSize: '11px', color: 'oklch(50% 0.14 150)', marginTop: '2px' }}>
                            suggested: {chipTerms.map((t) => t.name).join(', ')}
                          </div>
                        )}
                      </div>

                      <div style={{ fontSize: '13px' }}>
                        {siteMatch ? (
                          <span style={{ color: 'oklch(55% 0.01 250)' }}>{siteMatch.count}</span>
                        ) : (
                          <span style={{ color: 'oklch(60% 0.01 250)', fontStyle: 'italic' }}>not in this import</span>
                        )}
                      </div>

                      {excluded ? (
                        <div style={{ fontSize: '13px', color: 'oklch(60% 0.01 250)', gridColumn: 'span 2' }}>
                          Won't be migrated
                        </div>
                      ) : (
                        <>
                          <select
                            value={targetTableId ?? ''}
                            onChange={(e) => {
                              const val = e.target.value || null;
                              dispatch({ type: 'SET_TERM_ACTION', oldDomain: domainName, oldNicename: nicename, targetTableId: val });
                            }}
                            style={{ padding: '7px 8px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '7px', fontSize: '13px' }}
                          >
                            <option value="">-- Choose --</option>
                            {targetTables.map((tbl) => (
                              <option key={tbl.id} value={tbl.id}>
                                {tbl.label}
                              </option>
                            ))}
                          </select>

                          <div style={{ position: 'relative' }}>
                            {selectedTable ? (
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', border: '1px solid oklch(88% 0.005 250)', borderRadius: '6px', padding: '4px 6px' }}>
                                {chipTerms.map((chip) => (
                                  <div
                                    key={chip.id}
                                    style={{ display: 'flex', alignItems: 'center', fontSize: '12px', fontWeight: 600, background: 'oklch(94% 0.03 265)', color: 'oklch(40% 0.16 265)', padding: '3px 8px', borderRadius: '999px' }}
                                  >
                                    {chip.name}
                                    <span
                                      onClick={() =>
                                        dispatch({ type: 'REMOVE_TERM_DESTINATION', oldDomain: domainName, oldNicename: nicename, targetTermId: chip.id })
                                      }
                                      style={{ cursor: 'pointer', marginLeft: '5px', opacity: 0.7 }}
                                    >
                                      ✕
                                    </span>
                                  </div>
                                ))}
                                <input
                                  value={pickerOpen ? pickerSearch : ''}
                                  onChange={(e) => setPickerSearch(e.target.value)}
                                  onFocus={() => openPicker(key)}
                                  onBlur={() => window.setTimeout(closePicker, 150)}
                                  placeholder={`Add ${selectedTable.label}…`}
                                  style={{ flex: 1, minWidth: '80px', border: 'none', outline: 'none', padding: '4px 2px', fontSize: '12px' }}
                                />
                              </div>
                            ) : (
                              <div style={{ fontSize: '12px', color: 'oklch(60% 0.01 250)' }}>Choose an action first</div>
                            )}
                            {pickerOpen && selectedTable && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '2px', background: 'white', border: '1px solid oklch(88% 0.005 250)', borderRadius: '8px', boxShadow: '0 4px 14px oklch(0% 0 0 / .1)', maxHeight: '150px', overflowY: 'auto', zIndex: 5 }}>
                                {pickerOptions.map((opt) => (
                                  <div
                                    key={opt.id}
                                    onMouseDown={() =>
                                      dispatch({ type: 'ADD_TERM_DESTINATION', oldDomain: domainName, oldNicename: nicename, targetTermId: opt.id })
                                    }
                                    style={{ padding: '8px 10px', fontSize: '13px', cursor: 'pointer' }}
                                  >
                                    {opt.name}
                                  </div>
                                ))}
                                {pickerOptions.length === 0 && (
                                  <div style={{ padding: '8px 10px', fontSize: '12px', color: 'oklch(55% 0.01 250)' }}>No matching terms</div>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          dispatch({ type: 'SET_TERM_EXCLUDED', oldDomain: domainName, oldNicename: nicename, excluded: !excluded })
                        }
                        style={
                          excluded
                            ? { padding: '6px 10px', background: 'white', border: '1px solid oklch(88% 0.005 250)', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: 'oklch(45% 0.01 250)' }
                            : { padding: '6px 10px', background: 'white', border: '1px solid oklch(85% 0.1 25)', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: 'oklch(50% 0.18 25)' }
                        }
                      >
                        {excluded ? 'Undo' : 'Exclude'}
                      </button>
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

      {state.ui.modals.resetConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(20% 0 0 / 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '26px', width: '400px' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '8px' }}>Clear all mappings?</div>
            <div style={{ fontSize: '14px', color: 'oklch(45% 0.01 250)', lineHeight: 1.5, marginBottom: '20px' }}>
              This resets every taxonomy mapping back to unmapped. Your import and articles stay intact. This can't be undone — export a JSON backup first if you're not sure.
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => dispatch({ type: 'CLOSE_MODAL', modal: 'resetConfirm' })}
                style={{ padding: '9px 16px', background: 'white', border: '1px solid oklch(88% 0.005 250)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: 'CLEAR_ALL_MAPPINGS' });
                  dispatch({ type: 'CLOSE_MODAL', modal: 'resetConfirm' });
                }}
                style={{ padding: '9px 16px', background: 'oklch(50% 0.18 25)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Clear everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
