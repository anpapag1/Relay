import React, { useEffect, useRef, useState } from 'react';
import { useAppState } from '../../state/AppStateContext';
import {
  deleteSiteProfile,
  domainForState,
  listSiteProfiles,
  loadSiteProfile,
  normalizeDomain,
  renameSiteProfile,
  saveSiteProfile,
} from '../../state/siteProfiles';
import { createSiteDataBackup, restoreSiteDataBackup } from '../../state/session';
import { Modal } from '../../ui/Modal';
import type { AppState } from '../../state/types';
import type { SiteProfile } from '../../state/siteProfiles';

export interface SitesDrawerProps {
  open: boolean;
  onClose: () => void;
}

const smallBtn: React.CSSProperties = {
  background: 'white',
  border: '1px solid oklch(88% 0.005 250)',
  borderRadius: '8px',
  padding: '6px 10px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
};

const primaryBtn: React.CSSProperties = {
  background: 'oklch(50% 0.16 265)',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  padding: '8px 14px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
};

function formatSavedAt(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const SitesDrawer: React.FC<SitesDrawerProps> = ({ open, onClose }) => {
  const { state, dispatch } = useAppState();
  const activeDomain = domainForState(state);
  const [profiles, setProfiles] = useState<SiteProfile[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SiteProfile | null>(null);
  const [renameTarget, setRenameTarget] = useState<SiteProfile | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = () => setProfiles(listSiteProfiles());

  useEffect(() => {
    if (open) {
      setQuery('');
      setError('');
      refresh();
    }
  }, [open]);

  if (!open) return null;

  const filtered = query.trim()
    ? profiles.filter((p) => p.domain.toLowerCase().includes(query.trim().toLowerCase()))
    : profiles;

  const handleExport = (profile: SiteProfile) => {
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relay-site-${profile.domain}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setError('');
      try {
        const parsed = JSON.parse(text) as Partial<SiteProfile>;
        if (!parsed || parsed.version !== 1 || !parsed.domain || !parsed.data) {
          setError("Couldn't parse that file — not a saved-site JSON.");
          return;
        }
        const res = restoreSiteDataBackup(parsed.data, state);
        if (!res.ok) {
          setError(res.message);
          return;
        }
        saveSiteProfile(parsed.domain, createSiteDataBackup({ ...state, ...res.state } as AppState));
        if (activeDomain && normalizeDomain(parsed.domain) === activeDomain) {
          dispatch({ type: 'RESTORE_SESSION', state: res.state });
        }
        refresh();
      } catch {
        setError("Couldn't parse that file — not a saved-site JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteSiteProfile(deleteTarget.domain);
    setDeleteTarget(null);
    refresh();
  };

  const confirmRename = () => {
    const target = renameTarget;
    if (!target) return;
    const newDomain = renameDraft.trim();
    if (!newDomain) return;
    const collision = loadSiteProfile(newDomain);
    if (collision && collision.domain !== target.domain && !window.confirm(`"${newDomain}" already has a saved config. Overwrite it?`)) {
      return;
    }
    const ok = renameSiteProfile(target.domain, newDomain);
    if (ok && activeDomain === target.domain && !state.source?.siteUrl) {
      dispatch({ type: 'SET_SOURCE_DOMAIN', domain: newDomain });
    }
    setRenameTarget(null);
    refresh();
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'oklch(0% 0 0 / 0.3)',
          zIndex: 50,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: 'white',
            width: '380px',
            maxWidth: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-12px 0 24px oklch(0% 0 0 / 0.08)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid oklch(90% 0.005 250)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 700 }}>Auto saved site preferences</div>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'oklch(55% 0.01 250)' }} aria-label="Close sites drawer">
              ×
            </button>
          </div>

          <div
            style={{
              padding: '12px 20px',
              display: 'flex',
              gap: '8px',
              borderBottom: '1px solid oklch(90% 0.005 250)',
            }}
          >
            <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImportFile} />
            <button type="button" onClick={() => fileInputRef.current?.click()} style={primaryBtn}>
              Import
            </button>
            <input
              type="text"
              aria-label="Search sites"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sites…"
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid oklch(88% 0.005 250)',
                borderRadius: '8px',
                fontSize: '13px',
              }}
            />
          </div>

          {error && <div style={{ padding: '8px 20px', fontSize: '13px', color: 'oklch(50% 0.15 20)' }}>{error}</div>}

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.length === 0 && (
              <div style={{ fontSize: '14px', color: 'oklch(55% 0.01 250)', textAlign: 'center', marginTop: '40px' }}>
                {profiles.length === 0
                  ? 'No saved sites yet. Configs auto-save when you import a site.'
                  : 'No sites match your search.'}
              </div>
            )}
            {filtered.map((p) => (
              <div key={p.domain} style={{ border: '1px solid oklch(90% 0.005 250)', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.domain}</div>
                  {p.domain === activeDomain && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: 'oklch(50% 0.16 265)',
                        background: 'oklch(97% 0.004 250)',
                        border: '1px solid oklch(88% 0.005 250)',
                        borderRadius: '5px',
                        padding: '2px 7px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Active
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'oklch(55% 0.01 250)', margin: '2px 0 8px' }}>Saved {formatSavedAt(p.savedAt)}</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={() => { setRenameTarget(p); setRenameDraft(p.domain); }} style={smallBtn}>
                    Edit domain
                  </button>
                  <button type="button" onClick={() => handleExport(p)} style={smallBtn}>
                    Export
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(p)} style={{ ...smallBtn, color: 'oklch(50% 0.18 25)' }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete saved site?">
        <div style={{ fontSize: '14px', color: 'oklch(45% 0.01 250)' }}>
          This removes the auto-saved config for <strong>{deleteTarget?.domain}</strong>. This can't be undone.
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button type="button" onClick={() => setDeleteTarget(null)} style={smallBtn}>
            Cancel
          </button>
          <button type="button" onClick={confirmDelete} style={{ ...smallBtn, color: 'oklch(50% 0.18 25)' }}>
            Delete
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!renameTarget} onClose={() => setRenameTarget(null)} title="Edit domain">
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px' }}>New domain for this config</label>
        <input
          type="text"
          aria-label="New domain"
          value={renameDraft}
          onChange={(e) => setRenameDraft(e.target.value)}
          style={{ width: '100%', padding: '8px 12px', border: '1px solid oklch(88% 0.005 250)', borderRadius: '8px', fontSize: '13px' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button type="button" onClick={() => setRenameTarget(null)} style={smallBtn}>
            Cancel
          </button>
          <button type="button" onClick={confirmRename} style={smallBtn}>
            Save
          </button>
        </div>
      </Modal>
    </>
  );
};
