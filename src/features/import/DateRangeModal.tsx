/* global MouseEvent, Node */
import React, { useEffect, useRef, useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { Modal } from '../../ui/Modal';

export interface DateRangeModalProps {
  isOpen: boolean;
  /** Currently committed range, as `yyyy-mm-dd` strings (or `''` if unset) —
   * the same format the rest of ImportTab's fetch-filter state already
   * uses, so the modal is a pure presentation layer over it. */
  initialStart: string;
  initialEnd: string;
  onApply: (start: string, end: string) => void;
  onClose: () => void;
}

function parseDateInput(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMonthInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** With two months shown side by side, anchoring the left one here puts
 * the actual current month on the right — the default view someone
 * filtering by "recent" dates wants, and what the "Today" button returns
 * to. */
function currentMonthOnRightAnchor(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthYearPickerProps {
  month: Date;
  onPick: (month: Date) => void;
}

/** Own themed replacement for the browser's native month/year picker
 * (which can't be restyled to match the app) — a small popover with a
 * year stepper and a 12-month grid, closing on pick or outside click. */
const MonthYearPicker: React.FC<MonthYearPickerProps> = ({ month, onPick }) => {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(month.getFullYear());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  const openPicker = () => {
    setPickerYear(month.getFullYear());
    setOpen(true);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        aria-label="Jump to month"
        onClick={() => (open ? setOpen(false) : openPicker())}
        className="btn btn-secondary"
        style={{ padding: '5px 9px', display: 'inline-flex' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: '6px',
            background: 'var(--relay-surface)',
            border: '1px solid var(--relay-border)',
            borderRadius: '10px',
            boxShadow: '0 4px 14px oklch(0% 0 0 / .1)',
            padding: '10px',
            zIndex: 10,
            width: '210px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <button
              type="button"
              aria-label="Previous year"
              onClick={() => setPickerYear((y) => y - 1)}
              className="btn btn-secondary"
              style={{ padding: '3px 8px', fontSize: '12px' }}
            >
              ‹
            </button>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>{pickerYear}</div>
            <button
              type="button"
              aria-label="Next year"
              onClick={() => setPickerYear((y) => y + 1)}
              className="btn btn-secondary"
              style={{ padding: '3px 8px', fontSize: '12px' }}
            >
              ›
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {MONTH_LABELS.map((label, index) => {
              const isCurrent = pickerYear === month.getFullYear() && index === month.getMonth();
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    onPick(new Date(pickerYear, index, 1));
                    setOpen(false);
                  }}
                  style={{
                    padding: '6px 0',
                    fontSize: '12px',
                    fontWeight: isCurrent ? 700 : 500,
                    border: '1px solid ' + (isCurrent ? 'var(--relay-accent)' : 'var(--relay-border)'),
                    borderRadius: '6px',
                    background: isCurrent ? 'var(--relay-accent-soft)' : 'var(--relay-surface)',
                    color: isCurrent ? 'var(--relay-accent-hover)' : 'var(--relay-text)',
                    cursor: 'pointer',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/** A single modal for picking both ends of the fetch date filter at once —
 * a calendar grid (react-day-picker in range mode) instead of two separate
 * native date inputs. Nothing commits to the caller's state until "Apply";
 * closing or cancelling discards the in-progress selection. */
export const DateRangeModal: React.FC<DateRangeModalProps> = ({ isOpen, initialStart, initialEnd, onApply, onClose }) => {
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [month, setMonth] = useState<Date>(currentMonthOnRightAnchor);

  useEffect(() => {
    if (!isOpen) return;
    setRange({ from: parseDateInput(initialStart), to: parseDateInput(initialEnd) });
    setMonth(currentMonthOnRightAnchor());
  }, [isOpen, initialStart, initialEnd]);

  const canApply = Boolean(range?.from && range?.to);

  const handleApply = () => {
    if (!range?.from || !range?.to) return;
    onApply(formatDateInput(range.from), formatDateInput(range.to));
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select date range"
      maxWidth="640px"
      headerCenter={
        <>
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            className="btn btn-secondary"
            style={{ padding: '5px 9px', fontSize: '12px' }}
          >
            ‹
          </button>
          <MonthYearPicker month={month} onPick={setMonth} />
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="btn btn-secondary"
            style={{ padding: '5px 9px', fontSize: '12px' }}
          >
            ›
          </button>
        </>
      }
      headerActions={
        <button type="button" onClick={() => setMonth(currentMonthOnRightAnchor())} className="btn btn-secondary" style={{ padding: '5px 10px', fontSize: '12px' }}>
          Today
        </button>
      }
      footer={
        <>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={handleApply} disabled={!canApply} className="btn btn-primary">
            Apply
          </button>
        </>
      }
    >
      <div className="relay-date-range-picker">
        <DayPicker
          key={formatMonthInput(month)}
          mode="range"
          selected={range}
          onSelect={setRange}
          numberOfMonths={2}
          defaultMonth={month}
          disableNavigation
          showOutsideDays
        />
      </div>
    </Modal>
  );
};
