import React from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Overrides the default 480px cap — for content that's naturally wider,
   * e.g. a two-month date-range calendar. */
  maxWidth?: string;
  /** Extra controls rendered in the header, left of the close button. */
  headerActions?: React.ReactNode;
  /** Controls centered in the header, independent of the title and headerActions. */
  headerCenter?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, maxWidth, headerActions, headerCenter }) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'var(--relay-overlay)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--relay-surface)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: maxWidth ?? '480px',
          boxShadow: '0 20px 25px -5px oklch(0% 0 0 / 0.1), 0 10px 10px -5px oklch(0% 0 0 / 0.04)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--relay-border-soft)',
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 700 }}>{title}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>{headerCenter}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
            {headerActions}
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '18px',
                cursor: 'pointer',
                color: 'var(--relay-text-muted)',
              }}
            >
              ×
            </button>
          </div>
        </div>
        <div style={{ padding: '20px' }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: '12px 20px',
              background: 'var(--relay-surface-subtle)',
              borderTop: '1px solid var(--relay-border-soft)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
