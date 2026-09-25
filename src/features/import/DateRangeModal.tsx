import React, { useEffect, useState } from 'react';
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

function parseMonthInput(value: string): Date | undefined {
  if (!value) return undefined;
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return undefined;
  return new Date(year, month - 1, 1);
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
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              className="btn btn-secondary"
              style={{ padding: '5px 9px', fontSize: '13px', pointerEvents: 'none' }}
            >
              📅
            </button>
            <input
              type="month"
              aria-label="Jump to month"
              value={formatMonthInput(month)}
              onChange={(e) => {
                const parsed = parseMonthInput(e.target.value);
                if (parsed) setMonth(parsed);
              }}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }}
            />
          </div>
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
