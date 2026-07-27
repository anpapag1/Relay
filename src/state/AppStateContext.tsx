import React, { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import type { Action } from './actions';
import { appReducer, initialState } from './reducer';
import type { AppState } from './types';
import { loadFromLocalStorage, saveToLocalStorage } from './session';

interface AppStateContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
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

  useEffect(() => {
    if (!enableAutosave) return;
    const restored = loadFromLocalStorage(initialState);
    if (restored) {
      dispatch({ type: 'RESTORE_SESSION', state: restored });
    }
  }, [enableAutosave]);

  useEffect(() => {
    if (enableAutosave) {
      saveToLocalStorage(state);
    }
  }, [state, enableAutosave]);

  return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>;
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
