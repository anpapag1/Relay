import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { Action } from '../../state/actions';
import { useAppState } from '../../state/AppStateContext';
import { termMappingId } from '../../core/mappings/termId';
import { createSessionBackup } from '../../state/session';
import * as mappingTransitions from '../../state/mappingTransitions';
import type { NewSiteTerm, TaxonomyTermSummary, TermMapping, TermTable } from '../../types/domain';

const CORE_DOMAINS = new Set(['category', 'post_tag']);

const ROW_GRID_COLUMNS = '2fr 0.6fr 0.9fr 1.8fr 0.8fr';

// A real taxonomy on a long-lived site can carry thousands of terms (e.g. a
// per-meeting category used for years). Rendering every row's full DOM
// subtree (select + destination chips + input) at once produces a DOM tree
// large enough (tens of thousands of nodes) to make the whole browser tab —
// not just this component — freeze for seconds on any interaction. Above
// VIRTUALIZE_THRESHOLD terms, only rows near the current scroll position are
// mounted; below it, the list renders exactly as before (no scroll
// container, no behavior change) since the DOM cost is negligible.
const VIRTUALIZE_THRESHOLD = 150;
const ROW_HEIGHT = 64;
const OVERSCAN = 10;
const VIRTUAL_LIST_HEIGHT = 600;

interface TermRowProps {
  domainName: string;
  nicename: string;
  term: NewSiteTerm;
  initialMapping: TermMapping | undefined;
  targetTables: TermTable[];
  targetTermsById: Map<string, Map<string, NewSiteTerm>>;
  siteMatch: TaxonomyTermSummary | undefined;
  pickerOpen: boolean;
  pickerSearch: string;
  dispatch: React.Dispatch<Action>;
  onOpenPicker: (key: string) => void;
  onClosePicker: () => void;
  onPickerSearchChange: (value: string) => void;
}

/** Owns its own mapping locally (seeded once from `initialMapping`) instead
 * of reading it back from global state on every render. Toggling exclude,
 * changing the destination, or adding/removing a chip updates this row's
 * own state immediately — via the same pure transition functions the
 * reducer uses, so the two never drift — and separately dispatches to the
 * global store to persist it and keep the Build/Articles tabs in sync.
 * That decouples a row's paint entirely from every other row: excluding
 * one term no longer causes the parent to recompute anything for the
 * other thousands of terms in the list, which is what actually froze the
 * tab on large taxonomies. */
const TermRow: React.FC<TermRowProps> = React.memo(function TermRow({
  domainName,
  nicename,
  term,
  initialMapping,
  targetTables,
  targetTermsById,
  siteMatch,
  pickerOpen,
  pickerSearch,
  dispatch,
  onOpenPicker,
  onClosePicker,
  onPickerSearchChange,
}) {
  const key = termMappingId(domainName, nicename);
  const [mapping, setMapping] = useState(initialMapping);

  const targetTableId = mapping?.targetTableId ?? null;
  const targetTermIds = mapping?.targetTermIds ?? [];
  const excluded = mapping?.excluded ?? false;
  const selectedTable = targetTables.find((t) => t.id === targetTableId) ?? null;
  const selectedTableTermsById = targetTableId ? targetTermsById.get(targetTableId) : undefined;
  const chipTerms = selectedTableTermsById
    ? targetTermIds.map((id) => selectedTableTermsById.get(id)).filter((t): t is NewSiteTerm => t != null)
    : [];
  const pickerOptions =
    pickerOpen && selectedTable
      ? selectedTable.terms.filter(
          (t) => !targetTermIds.includes(t.id) && t.name.toLowerCase().includes(pickerSearch.toLowerCase()),
        )
      : [];

  const handleSetAction = (targetTableIdValue: string | null) => {
    setMapping(mappingTransitions.setTargetTable(mapping, domainName, nicename, targetTableIdValue));
    dispatch({ type: 'SET_TERM_ACTION', oldDomain: domainName, oldNicename: nicename, targetTableId: targetTableIdValue });
  };

  const handleAddDestination = (targetTermId: string) => {
    const next = mappingTransitions.addDestination(mapping, targetTermId);
    if (next) setMapping(next);
    dispatch({ type: 'ADD_TERM_DESTINATION', oldDomain: domainName, oldNicename: nicename, targetTermId });
  };

  const handleRemoveDestination = (targetTermId: string) => {
    const next = mappingTransitions.removeDestination(mapping, targetTermId);
    if (next) setMapping(next);
    dispatch({ type: 'REMOVE_TERM_DESTINATION', oldDomain: domainName, oldNicename: nicename, targetTermId });
  };

  const handleToggleExcluded = () => {
    const nextExcluded = !excluded;
    setMapping(mappingTransitions.setExcluded(mapping, domainName, nicename, nextExcluded));
    dispatch({ type: 'SET_TERM_EXCLUDED', oldDomain: domainName, oldNicename: nicename, excluded: nextExcluded });
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: ROW_GRID_COLUMNS,
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
            onChange={(e) => handleSetAction(e.target.value || null)}
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
                      onClick={() => handleRemoveDestination(chip.id)}
                      style={{ cursor: 'pointer', marginLeft: '5px', opacity: 0.7 }}
                    >
                      ✕
                    </span>
                  </div>
                ))}
                <input
                  value={pickerOpen ? pickerSearch : ''}
                  onChange={(e) => onPickerSearchChange(e.target.value)}
                  onFocus={() => onOpenPicker(key)}
                  onBlur={() => window.setTimeout(onClosePicker, 150)}
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
                    onMouseDown={() => handleAddDestination(opt.id)}
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
        onClick={handleToggleExcluded}
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
});

interface TermRowListProps {
  domainName: string;
  terms: NewSiteTerm[];
  targetTables: TermTable[];
  targetTermsById: Map<string, Map<string, NewSiteTerm>>;
  siteTermsByNicename: Map<string, TaxonomyTermSummary> | undefined;
  mappingsRef: { current: Record<string, TermMapping> };
  openNicenameInDomain: string | null;
  pickerSearch: string;
  resetGeneration: number;
  dispatch: React.Dispatch<Action>;
  onOpenPicker: (key: string) => void;
  onClosePicker: () => void;
  onPickerSearchChange: (value: string) => void;
}

function renderRow(
  term: NewSiteTerm,
  {
    domainName,
    targetTables,
    targetTermsById,
    siteTermsByNicename,
    mappingsRef,
    openNicenameInDomain,
    pickerSearch,
    resetGeneration,
    dispatch,
    onOpenPicker,
    onClosePicker,
    onPickerSearchChange,
  }: Omit<TermRowListProps, 'terms'>,
) {
  const nicename = term.slug || term.id;
  const key = termMappingId(domainName, nicename);
  const pickerOpen = openNicenameInDomain === nicename;

  return (
    <TermRow
      key={`${term.id}:${resetGeneration}`}
      domainName={domainName}
      nicename={nicename}
      term={term}
      initialMapping={mappingsRef.current[key]}
      targetTables={targetTables}
      targetTermsById={targetTermsById}
      siteMatch={siteTermsByNicename?.get(nicename)}
      pickerOpen={pickerOpen}
      pickerSearch={pickerOpen ? pickerSearch : ''}
      dispatch={dispatch}
      onOpenPicker={onOpenPicker}
      onClosePicker={onClosePicker}
      onPickerSearchChange={onPickerSearchChange}
    />
  );
}

/** Below VIRTUALIZE_THRESHOLD, renders the plain list (unchanged behavior).
 * Above it, only the rows within VIRTUAL_LIST_HEIGHT of the current scroll
 * position (plus OVERSCAN rows of buffer) are mounted; a spacer div of the
 * same total height keeps the scrollbar and scroll position accurate for
 * the un-rendered rows above and below. Assumes a fixed ROW_HEIGHT per row
 * — generous enough to fit the two-line "suggested: ..." case — so rows
 * never need to be measured. */
const TermRowList: React.FC<TermRowListProps> = (props) => {
  const { terms } = props;
  const [scrollTop, setScrollTop] = useState(0);

  if (terms.length <= VIRTUALIZE_THRESHOLD) {
    return <>{terms.map((term) => renderRow(term, props))}</>;
  }

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(VIRTUAL_LIST_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2;
  const endIndex = Math.min(terms.length, startIndex + visibleCount);
  const visibleTerms = terms.slice(startIndex, endIndex);

  return (
    <div
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      style={{ maxHeight: VIRTUAL_LIST_HEIGHT, overflowY: 'auto' }}
    >
      <div style={{ height: terms.length * ROW_HEIGHT, position: 'relative' }}>
        <div style={{ position: 'absolute', top: startIndex * ROW_HEIGHT, left: 0, right: 0 }}>
          {visibleTerms.map((term) => renderRow(term, props))}
        </div>
      </div>
    </div>
  );
};

interface DomainSectionProps {
  domainName: string;
  table: TermTable;
  isExpanded: boolean;
  isCore: boolean;
  targetTables: TermTable[];
  targetTermsById: Map<string, Map<string, NewSiteTerm>>;
  siteTermsByNicename: Map<string, TaxonomyTermSummary> | undefined;
  mappingsRef: { current: Record<string, TermMapping> };
  openNicenameInDomain: string | null;
  pickerSearch: string;
  resetGeneration: number;
  dispatch: React.Dispatch<Action>;
  onToggle: (domain: string) => void;
  onOpenPicker: (key: string) => void;
  onClosePicker: () => void;
  onPickerSearchChange: (value: string) => void;
}

/** Memoized at the domain (taxonomy) level so that excluding/mapping a
 * term in one domain, or opening the destination picker in one domain,
 * never touches the row list of any other domain — and so the row list
 * for THIS domain is only rebuilt on structural changes (import reload,
 * expand/collapse, picker open/close here, or an explicit reset), never
 * on every keystroke or click against the shared mappings object. */
const DomainSection: React.FC<DomainSectionProps> = React.memo(function DomainSection({
  domainName,
  table,
  isExpanded,
  isCore,
  targetTables,
  targetTermsById,
  siteTermsByNicename,
  mappingsRef,
  openNicenameInDomain,
  pickerSearch,
  resetGeneration,
  dispatch,
  onToggle,
  onOpenPicker,
  onClosePicker,
  onPickerSearchChange,
}) {
  return (
    <div
      style={{
        background: 'white',
        border: '1px solid oklch(90% 0.005 250)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px oklch(0% 0 0 / 0.02)',
      }}
    >
      <div
        onClick={() => onToggle(domainName)}
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
          <div style={{ display: 'grid', gridTemplateColumns: ROW_GRID_COLUMNS, gap: '12px', padding: '10px 20px', fontSize: '11px', fontWeight: 600, color: 'oklch(55% 0.01 250)', textTransform: 'uppercase', letterSpacing: '0.03em', background: 'oklch(99% 0.002 250)' }}>
            <div>Term</div>
            <div>Count</div>
            <div>Action</div>
            <div>Destination</div>
            <div></div>
          </div>

          <TermRowList
            domainName={domainName}
            terms={table.terms}
            targetTables={targetTables}
            targetTermsById={targetTermsById}
            siteTermsByNicename={siteTermsByNicename}
            mappingsRef={mappingsRef}
            openNicenameInDomain={openNicenameInDomain}
            pickerSearch={pickerSearch}
            resetGeneration={resetGeneration}
            dispatch={dispatch}
            onOpenPicker={onOpenPicker}
            onClosePicker={onClosePicker}
            onPickerSearchChange={onPickerSearchChange}
          />
        </div>
      )}
    </div>
  );
});

export const MappingsTab: React.FC = () => {
  const { state, dispatch } = useAppState();
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({ category: true, post_tag: true });
  const [pickerSearch, setPickerSearch] = useState('');
  const [resetGeneration, setResetGeneration] = useState(0);

  const { source, mappings, target, oldTables } = state;
  const openPickerTermId = state.ui.pickers.destinationTermId;

  // Rows read mappings through this ref (only at the moment a domain
  // section actually rebuilds) instead of as a normal prop, so a mapping
  // change elsewhere never forces this component — or any domain section
  // — to recompute anything just because `mappings` got a new reference.
  const mappingsRef = useRef(mappings);
  mappingsRef.current = mappings;

  const oldTableList = useMemo(() => Object.values(oldTables), [oldTables]);
  const targetTables = useMemo(() => Object.values(target.tables), [target.tables]);
  const targetTermsById = useMemo(
    () => new Map(targetTables.map((tbl) => [tbl.id, new Map(tbl.terms.map((t) => [t.id, t]))])),
    [targetTables],
  );
  const siteTermsByDomain = useMemo(() => {
    const byDomain = new Map<string, Map<string, TaxonomyTermSummary>>();
    for (const [domain, terms] of Object.entries(source?.taxonomies ?? {})) {
      byDomain.set(domain, new Map(terms.map((t) => [t.nicename, t])));
    }
    return byDomain;
  }, [source?.taxonomies]);

  const toggleDomain = useCallback((domain: string) => {
    setExpandedDomains((prev) => ({ ...prev, [domain]: !prev[domain] }));
  }, []);

  const openPicker = useCallback(
    (termId: string) => {
      setPickerSearch('');
      dispatch({ type: 'SET_DESTINATION_PICKER', termId });
    },
    [dispatch],
  );
  const closePicker = useCallback(() => dispatch({ type: 'SET_DESTINATION_PICKER', termId: null }), [dispatch]);

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
            onClick={() => dispatch({ type: 'OPEN_MODAL', modal: 'autoMatchConfirm' })}
            className="btn btn-secondary"
          >
            Auto-match all
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
        const siteTermsByNicename = siteTermsByDomain.get(domainName);
        const openNicenameInDomain =
          openPickerTermId && openPickerTermId.startsWith(`${domainName}:`)
            ? openPickerTermId.slice(domainName.length + 1)
            : null;

        return (
          <DomainSection
            key={domainName}
            domainName={domainName}
            table={table}
            isExpanded={isExpanded}
            isCore={isCore}
            targetTables={targetTables}
            targetTermsById={targetTermsById}
            siteTermsByNicename={siteTermsByNicename}
            mappingsRef={mappingsRef}
            openNicenameInDomain={openNicenameInDomain}
            pickerSearch={pickerSearch}
            resetGeneration={resetGeneration}
            dispatch={dispatch}
            onToggle={toggleDomain}
            onOpenPicker={openPicker}
            onClosePicker={closePicker}
            onPickerSearchChange={setPickerSearch}
          />
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
                  setResetGeneration((g) => g + 1);
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

      {state.ui.modals.autoMatchConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(20% 0 0 / 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '26px', width: '420px' }}>
            <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '8px' }}>Auto-match all taxonomies?</div>
            <div style={{ fontSize: '14px', color: 'oklch(45% 0.01 250)', lineHeight: 1.5, marginBottom: '20px' }}>
              This replaces every current taxonomy mapping — including any exclusions or manual choices you've made — with fresh automatic matches. Anything without a good match gets excluded rather than left for review. This can't be undone — export a JSON backup first if you're not sure.
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => dispatch({ type: 'CLOSE_MODAL', modal: 'autoMatchConfirm' })}
                style={{ padding: '9px 16px', background: 'white', border: '1px solid oklch(88% 0.005 250)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  dispatch({ type: 'AUTO_MATCH_MAPPINGS' });
                  setResetGeneration((g) => g + 1);
                  dispatch({ type: 'CLOSE_MODAL', modal: 'autoMatchConfirm' });
                }}
                style={{ padding: '9px 16px', background: 'oklch(50% 0.16 265)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Auto-match all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
