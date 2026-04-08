import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  startOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  getWeek,
  getYear,
  setWeek,
} from 'date-fns';
import { sv } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '../utils/cn';

const SWEDISH_DAYS = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'] as const;

export const PLANNER_WEEK_OPTIONS = { weekStartsOn: 1 as const, firstWeekContainsDate: 4 as const };

/** Date on the given planner week (same rules as Planner.tsx) och veckodag. */
export function getDateInPlannerWeek(year: number, week: number, weekday: string): Date {
  const mid = new Date(year, 5, 15);
  const inWeek = setWeek(mid, week, PLANNER_WEEK_OPTIONS);
  const monday = startOfWeek(inWeek, { weekStartsOn: 1 });
  const idx = SWEDISH_DAYS.indexOf(weekday.toLowerCase() as (typeof SWEDISH_DAYS)[number]);
  return addDays(monday, idx >= 0 ? idx : 0);
}

interface ScheduleCalendarModalProps {
  open: boolean;
  onClose: () => void;
  initialDate: Date;
  onConfirm: (date: Date) => void;
}

export default function ScheduleCalendarModal({ open, onClose, initialDate, onConfirm }: ScheduleCalendarModalProps) {
  const { t, i18n } = useTranslation();
  const [cursor, setCursor] = useState(() => startOfMonth(initialDate));
  const [selected, setSelected] = useState(() => new Date(initialDate));

  React.useEffect(() => {
    if (open) {
      const d = new Date(initialDate);
      setCursor(startOfMonth(d));
      setSelected(d);
    }
  }, [open, initialDate]);

  if (!open) return null;

  const monthStart = startOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const rows: Date[][] = [];
  for (let r = 0; r < 6; r++) {
    const row: Date[] = [];
    for (let c = 0; c < 7; c++) {
      row.push(addDays(gridStart, r * 7 + c));
    }
    rows.push(row);
  }

  const weekDayShort = ['M', 'T', 'O', 'T', 'F', 'L', 'S'];
  if (i18n.language === 'en') {
    weekDayShort.splice(0, 7, 'M', 'T', 'W', 'T', 'F', 'S', 'S');
  }

  const selWeek = getWeek(selected, PLANNER_WEEK_OPTIONS);
  const selYear = getYear(selected);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="schedule-cal-title">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full border border-black/10 dark:border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 dark:border-white/10">
          <h2 id="schedule-cal-title" className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            {t('planner.scheduleCalendarTitle')}
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800 text-stone-500" aria-label={t('planner.cancel')}>
            <X size={20} />
          </button>
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <button type="button" onClick={() => setCursor(subMonths(cursor, 1))} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800" aria-label="Previous month">
            <ChevronLeft size={22} />
          </button>
          <span className="text-sm font-medium capitalize text-stone-800 dark:text-stone-200">
            {format(cursor, 'LLLL yyyy', { locale: i18n.language === 'en' ? undefined : sv })}
          </span>
          <button type="button" onClick={() => setCursor(addMonths(cursor, 1))} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-slate-800" aria-label="Next month">
            <ChevronRight size={22} />
          </button>
        </div>
        <p className="px-4 text-xs text-stone-500 dark:text-stone-400 mb-2">
          {t('planner.scheduleCalendarSelected', { week: selWeek, year: selYear, day: format(selected, 'EEEE d MMMM', { locale: i18n.language === 'en' ? undefined : sv }) })}
        </p>
        <div className="px-2 pb-2">
          <div className="grid grid-cols-[2.25rem_repeat(7,minmax(0,1fr))] gap-0.5 text-[10px] text-stone-400 uppercase tracking-wide mb-1">
            <div />
            {weekDayShort.map((d, i) => (
              <div key={i} className="text-center py-1 font-semibold">
                {d}
              </div>
            ))}
          </div>
          {rows.map((row, ri) => {
            const weekNum = getWeek(row[0], PLANNER_WEEK_OPTIONS);
            return (
              <div key={ri} className="grid grid-cols-[2.25rem_repeat(7,minmax(0,1fr))] gap-0.5 mb-0.5">
                <div className="flex items-center justify-center text-[10px] font-medium text-stone-400 tabular-nums">
                  v{weekNum}
                </div>
                {row.map((day) => {
                  const inMonth = isSameMonth(day, cursor);
                  const isSel = isSameDay(day, selected);
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => setSelected(day)}
                      className={cn(
                        'aspect-square max-h-10 rounded-lg text-sm transition-colors',
                        !inMonth && 'text-stone-300 dark:text-slate-600',
                        inMonth && !isSel && 'text-stone-800 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-slate-800',
                        isSel && 'bg-emerald-600 text-white font-semibold shadow-md'
                      )}
                    >
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 px-4 py-4 border-t border-black/5 dark:border-white/10 bg-stone-50 dark:bg-slate-800/50">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-stone-200 dark:border-slate-600 text-stone-700 dark:text-stone-200 font-medium hover:bg-stone-100 dark:hover:bg-slate-700">
            {t('planner.cancel')}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selected)}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700"
          >
            {t('planner.scheduleCalendarConfirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
