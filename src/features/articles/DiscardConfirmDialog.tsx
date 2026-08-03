// src/features/articles/DiscardConfirmDialog.tsx
import React from 'react';
import type { PendingAction } from './useDrawerNavigationGuard';

export interface DiscardConfirmDialogProps {
  pendingAction: PendingAction;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DiscardConfirmDialog: React.FC<DiscardConfirmDialogProps> = ({ pendingAction, onCancel, onConfirm }) => {
  if (pendingAction === null) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'oklch(20% 0 0 / 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 70,
      }}
    >
      <div style={{ background: 'white', borderRadius: '14px', padding: '26px', width: '400px' }}>
        <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '8px' }}>Discard unsaved edit?</div>
        <div style={{ fontSize: '13px', color: 'oklch(55% 0.01 250)', marginBottom: '20px', lineHeight: 1.5 }}>
          You made manual edits to the converted HTML. {pendingAction === 'close' ? 'Closing' : 'Navigating away'} now
          will discard them.
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            Keep editing
          </button>
          <button type="button" onClick={onConfirm} className="btn btn-danger">
            {pendingAction === 'close' ? 'Discard & close' : 'Discard & continue'}
          </button>
        </div>
      </div>
    </div>
  );
};
