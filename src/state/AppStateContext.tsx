import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react';
import type { Action } from './actions';
import { appReducer, initialState } from './reducer';
import type { AppState, BuildHistoryEntry } from './types';
import { createSiteDataBackup } from './session';
import { domainForState, loadSiteProfile, saveSiteProfile } from './siteProfiles';
import { runBuild, type BuildArticleInput } from '../core/build/runBuild';

interface AppStateContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  /** Starts a build, or does nothing if one is already running. Lives
   * here — on the provider, which stays mounted for the whole session —
   * rather than in BuildTab, whose own component state (and any promise
   * closures tied to it) would be discarded the instant the user
   * navigates to a different tab, since BuildTab unmounts entirely when
   * it isn't the active one (see App.tsx). Progress/completion are
   * dispatched into global `state.build`, so the build keeps running (and
   * keeps updating visible state once you return to the tab) regardless
   * of what's mounted while it's in flight. */
  startBuild: (exportPendingForReview: boolean) => Promise<void>;
  cancelBuild: () => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

export interface AppStateProviderProps {
  children: ReactNode;
  initialStateOverride?: Partial<AppState>;
  enableAutosave?: boolean;
}

export const AppStateProvider: React.FC<AppStateProviderProps> = ({
  children,
  initialStateOverride,
  enableAutosave = true,
}) => {
  const [state, dispatch] = useReducer(appReducer, {
    ...initialState,
    ...initialStateOverride,
  });
  const cancelRef = useRef(false);

  const domain = domainForState(state);
  const lastDomainRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enableAutosave) return;
    if (domain !== lastDomainRef.current) {
      lastDomainRef.current = domain;
      if (domain) {
        const profile = loadSiteProfile(domain);
        if (profile) {
          dispatch({
            type: 'RESTORE_SESSION',
            state: {
              target: { tables: profile.data.targetTables },
              oldTables: profile.data.oldTables ?? {},
              mappings: profile.data.mappings,
              settings: profile.data.settings,
            },
          });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, enableAutosave]);

  useEffect(() => {
    if (!enableAutosave) return;
    if (!domain) return;
    const timer = setTimeout(() => {
      saveSiteProfile(domain, createSiteDataBackup(state));
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, state.target.tables, state.oldTables, state.mappings, state.settings, enableAutosave]);

  useEffect(() => {
    if (!enableAutosave) return;
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.removeItem('relay_session_backup_v1');
    } catch {
      // ignore
    }
  }, [enableAutosave]);

  const startBuild = useCallback(
    async (exportPendingForReview: boolean) => {
      if (!state.source || state.build.running) return;
      cancelRef.current = false;
      dispatch({ type: 'START_BUILD' });

      const source = state.source;
      const buildInputs: BuildArticleInput[] = source.articles.map((art, idx) => {
        const override = state.articles[art.postId ?? idx];
        return {
          article: art,
          excluded: override?.excluded ?? false,
          editedHtml: override?.editedHtml,
        };
      });
      const builderId = state.builderId || 'plainHtml';

      try {
        const res = await runBuild({
          articles: buildInputs,
          attachments: source.attachments ?? [],
          mappings: state.mappings,
          newTables: Object.values(state.target.tables),
          settings: state.settings,
          builderId,
          siteTitle: 'Relay Migration Site',
          siteUrl: source.siteUrl || 'https://example.com',
          exportPendingForReview,
          fetchImpl: window.fetch ? window.fetch.bind(window) : ((async () => new Response()) as any),
          onProgress: ({ completed, total }) => {
            const pct = Math.round((completed / Math.max(total, 1)) * 100);
            dispatch({ type: 'BUILD_PROGRESS', completed, total, logLine: `Converted post ${completed}/${total} (${pct}%)` });
          },
          isCancelled: () => cancelRef.current,
        });

        if (res.cancelled) {
          dispatch({ type: 'CANCEL_BUILD' });
          return;
        }

        const historyEntry: BuildHistoryEntry = {
          id: `build-${Date.now()}`,
          date: new Date().toISOString(),
          articleCount: res.articles.length,
          sizeBytes: res.wxr.length,
          builderId,
        };
        dispatch({ type: 'BUILD_COMPLETE', report: { wxr: res.wxr, articles: res.articles }, historyEntry });
      } catch (err) {
        dispatch({ type: 'BUILD_FAILED', message: err instanceof Error ? err.message : String(err) });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state],
  );

  const cancelBuild = useCallback(() => {
    cancelRef.current = true;
  }, []);

  return (
    <AppStateContext.Provider value={{ state, dispatch, startBuild, cancelBuild }}>{children}</AppStateContext.Provider>
  );
};

export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within an AppStateProvider');
  return ctx;
}

export function useAppDispatch(): React.Dispatch<Action> {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppDispatch must be used within an AppStateProvider');
  return ctx.dispatch;
}
