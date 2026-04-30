import { DEFAULT_TIMEZONE } from '../domain.constants';

export function resolveTimezone(timezone?: string | null): string {
  return timezone ?? DEFAULT_TIMEZONE;
}

export function getLocalDateParts(date: Date, timezone: string): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value ?? '0');
  const month = Number(parts.find((part) => part.type === 'month')?.value ?? '0');
  const day = Number(parts.find((part) => part.type === 'day')?.value ?? '0');

  return { year, month, day };
}

export function toLocalDateString(date: Date, timezone: string): string {
  const { year, month, day } = getLocalDateParts(date, timezone);
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

export function diffCalendarDays(start: Date, end: Date, timezone: string): number {
  const startParts = getLocalDateParts(start, timezone);
  const endParts = getLocalDateParts(end, timezone);

  const startUtc = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  const endUtc = Date.UTC(endParts.year, endParts.month - 1, endParts.day);

  return Math.floor((endUtc - startUtc) / 86_400_000);
}

export function calculateProgramDay(startedAt: Date, now: Date, timezone: string): number {
  return diffCalendarDays(startedAt, now, timezone) + 1;
}

export function localDateForProgramDay(startedAt: Date, timezone: string, programDay: number): string {
  const startParts = getLocalDateParts(startedAt, timezone);
  const dateUtc = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day + programDay - 1));
  return toLocalDateString(dateUtc, 'UTC');
}

export function progressPercent(currentProgramDay: number, totalDays: number): number {
  const boundedDay = Math.min(currentProgramDay, totalDays);
  return Math.floor((boundedDay / totalDays) * 100);
}

export function levelFromTotalXp(totalXP: number): number {
  return Math.floor(totalXP / 100) + 1;
}
