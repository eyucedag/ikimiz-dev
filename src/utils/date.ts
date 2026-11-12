import type { SharedRecord } from '../types';

/** A calendar day is deliberately built from local fields, never ISO/UTC. */
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseLocalDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  // Noon avoids DST transitions at midnight in some time zones.
  const date = new Date(year, month - 1, day, 12);
  return localDay(date) === value ? date : null;
}

export function formatDate(value: string | Date): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !parseLocalDay(value)) return '';
  const date = typeof value === 'string'
    ? parseLocalDay(value) ?? new Date(value)
    : value;
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
}

export function relationshipDuration(start: string, now = new Date()) {
  const zero = { days: 0, hours: 0, minutes: 0, seconds: 0 };
  if (!start) return zero;
  const parsedDay = parseLocalDay(start);
  const startDate = parsedDay
    ? new Date(parsedDay.getFullYear(), parsedDay.getMonth(), parsedDay.getDate())
    : new Date(start);
  if (!Number.isFinite(startDate.getTime())) return zero;
  const total = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor(total / 3600) % 24,
    minutes: Math.floor(total / 60) % 60,
    seconds: total % 60,
  };
}

export function firstAnniversaryReminder(start: string, now = new Date()): string | null {
  const parsed = parseLocalDay(start);
  if (!parsed) return null;
  const anniversary = new Date(now.getFullYear(), parsed.getMonth(), parsed.getDate(), 12);
  if (anniversary.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime()) anniversary.setFullYear(now.getFullYear() + 1);
  const days = Math.ceil((anniversary.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime()) / 86400000);
  if (days < 0 || days > 28) return null;
  if (now.getFullYear() - parsed.getFullYear() !== 0) return null;
  if (days === 0) return 'Bugün birlikte 1. senenizi tamamlıyorsunuz. Güzel bir kutlama zamanı!';
  const weeks = Math.ceil(days / 7);
  return `1. senenize ${weeks} hafta kaldı. Bu hafta küçük bir kutlama planı yapın.`;
}

function anniversaryInYear(day: Date, year: number): Date {
  // Feb 29 anniversaries are observed on Feb 28 in non-leap years.
  const lastDay = new Date(year, day.getMonth() + 1, 0).getDate();
  return new Date(year, day.getMonth(), Math.min(day.getDate(), lastDay), 12);
}

export function nextOccurrence(record: SharedRecord, today = localDay()): string | null {
  if (!record.date) return null;
  const original = parseLocalDay(record.date);
  const start = parseLocalDay(today);
  if (!original || !start) return null;
  const type = (record as SharedRecord & { specialDayType?: string }).specialDayType;
  const recurring = record.category === 'special-days' && (type === 'birthday' || type === 'anniversary');
  if (!recurring) return record.date;
  let occurrence = anniversaryInYear(original, start.getFullYear());
  if (localDay(occurrence) < today) occurrence = anniversaryInYear(original, start.getFullYear() + 1);
  // A future first occurrence must not be moved into an earlier year.
  return localDay(occurrence) < record.date ? record.date : localDay(occurrence);
}

export function getUpcoming(records: SharedRecord[], now = new Date()): SharedRecord[] {
  const today = localDay(now);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6, 12);
  const lastDay = localDay(end);
  return records
    .filter(record => record.category === 'calendar' || record.category === 'special-days')
    .flatMap(record => {
      const day = nextOccurrence(record, today);
      return day && day >= today && day <= lastDay ? [{ ...record, date: day }] : [];
    })
    .sort((a, b) => {
      const dateOrder = (a.date ?? '').localeCompare(b.date ?? '');
      // All-day records precede timed records on the same day.
      return dateOrder || (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title, 'tr');
    });
}
