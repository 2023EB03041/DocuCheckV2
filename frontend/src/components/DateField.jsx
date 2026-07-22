import { useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';

// Parse a 'YYYY-MM-DD' string into a local Date (avoids UTC timezone shift).
const parseYMD = (str) => {
  if (!str) return undefined;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
};

const pad = (n) => String(n).padStart(2, '0');
// Format a Date back to 'YYYY-MM-DD' using local components.
const formatYMD = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const firstOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

/**
 * A date input backed by react-day-picker.
 * Scroll the mouse wheel over the calendar to move between months.
 *
 * Props:
 *   label    – field label text
 *   icon     – lucide icon component rendered inside the field
 *   value    – selected date as 'YYYY-MM-DD' (or '')
 *   onChange – called with the new 'YYYY-MM-DD' string
 *   minDate  – earliest selectable Date (days before it are disabled)
 */
export default function DateField({ label, icon: Icon, value, onChange, minDate }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const popoverRef = useRef(null);

  const selected = useMemo(() => parseYMD(value), [value]);
  const minMonth = useMemo(() => (minDate ? firstOfMonth(minDate) : undefined), [minDate]);
  const minMonthTime = minMonth ? minMonth.getTime() : null;

  const [month, setMonth] = useState(() => firstOfMonth(selected || minDate || new Date()));

  // When opening, jump the view to the selected date (or the earliest allowed month).
  useEffect(() => {
    if (open) setMonth(firstOfMonth(selected || minDate || new Date()));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Mouse-wheel over the calendar changes the month (native listener so we can
  // preventDefault the page scroll; React's onWheel is passive).
  useEffect(() => {
    if (!open) return;
    const el = popoverRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      setMonth((prev) => {
        const next = new Date(prev.getFullYear(), prev.getMonth() + dir, 1);
        if (minMonthTime !== null && next.getTime() < minMonthTime) return prev;
        return next;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [open, minMonthTime]);

  const handleSelect = (date) => {
    if (!date) return;
    onChange(formatYMD(date));
    setOpen(false);
  };

  const display = selected
    ? selected.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : 'Select date';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-sm focus:ring-2 focus:ring-[#d4af37] focus:border-transparent outline-none transition-all"
      >
        {Icon && <Icon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />}
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>{display}</span>
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={label}
          className="absolute z-50 mt-2 bg-white border border-gray-200 rounded-md shadow-xl p-2"
          style={{
            // Match the app's navy/gold palette.
            '--rdp-accent-color': '#1a365d',
            '--rdp-today-color': '#d4af37',
          }}
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            month={month}
            onMonthChange={setMonth}
            startMonth={minMonth}
            disabled={minDate ? { before: minDate } : undefined}
          />
        </div>
      )}
    </div>
  );
}
