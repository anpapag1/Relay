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

/** A single modal for picking both ends of the fetch date filter at once —
 * a calendar grid (react-day-picker in range mode) instead of two separate
 * native date inputs. Nothing commits to the caller's state until "Apply";
 * closing or cancelling discards the in-progress selection. */
export const DateRangeModal: React.FC<DateRangeModalProps> = ({ isOpen, initialStart, initialEnd, onApply, onClose }) => {
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    if (!isOpen) return;
    setRange({ from: parseDateInput(initialStart), to: parseDateInput(initialEnd) });
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
          mode="range"
          selected={range}
          onSelect={setRange}
          numberOfMonths={2}
          defaultMonth={range?.from}
          showOutsideDays
        />
      </div>
    </Modal>
  );
};
