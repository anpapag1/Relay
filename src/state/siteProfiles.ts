import type { AppState } from './types';
import type { SiteDataBackup } from './session';

export interface SiteProfile {
  version: 1;
  domain: string;
  savedAt: string;
  data: SiteDataBackup;
}

const KEY_PREFIX = 'relay_site_v1_';

export function normalizeDomain(raw: string): string {
  let s = (raw || '').trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
  const slash = s.indexOf('/');
  if (slash !== -1) s = s.slice(0, slash);
  return s;
}

export function siteProfileKey(domain: string): string {
  return `${KEY_PREFIX}${normalizeDomain(domain)}`;
}

function hasStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function listSiteProfiles(): SiteProfile[] {
  if (!hasStorage()) return [];
  const out: SiteProfile[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(KEY_PREFIX)) continue;
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as SiteProfile;
        if (parsed && parsed.version === 1 && parsed.domain && parsed.data) out.push(parsed);
      } catch {
        // skip corrupt record
      }
    }
  } catch {
    // storage unavailable
  }
  return out.sort((a, b) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0));
}

export function loadSiteProfile(domain: string): SiteProfile | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(siteProfileKey(domain));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SiteProfile;
    if (!parsed || parsed.version !== 1 || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSiteProfile(domain: string, data: SiteDataBackup): void {
  if (!hasStorage()) return;
  const normalized = normalizeDomain(domain);
  if (!normalized) return;
  try {
    const profile: SiteProfile = {
      version: 1,
      domain: normalized,
      savedAt: new Date().toISOString(),
      data,
    };
    window.localStorage.setItem(siteProfileKey(domain), JSON.stringify(profile));
  } catch {
    // quota exceeded or storage unavailable — ignore
  }
}

export function deleteSiteProfile(domain: string): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(siteProfileKey(domain));
  } catch {
    // ignore
  }
}

export function renameSiteProfile(oldDomain: string, newDomain: string): boolean {
  const profile = loadSiteProfile(oldDomain);
  if (!profile) return false;
  const normalized = normalizeDomain(newDomain);
  if (!normalized) return false;
  profile.domain = normalized;
  profile.savedAt = new Date().toISOString();
  const oldKey = siteProfileKey(oldDomain);
  const newKey = siteProfileKey(newDomain);
  try {
    window.localStorage.setItem(newKey, JSON.stringify(profile));
    if (newKey !== oldKey) window.localStorage.removeItem(oldKey);
    return true;
  } catch {
    return false;
  }
}

export function domainForState(state: AppState): string | null {
  let domain: string | null = null;
  if (state.source?.siteUrl) {
    domain = normalizeDomain(state.source.siteUrl);
  } else if (state.ui.sourceDomain) {
    domain = normalizeDomain(state.ui.sourceDomain);
  }
  return domain || null;
}
