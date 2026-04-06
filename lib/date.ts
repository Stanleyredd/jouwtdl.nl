import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  getISOWeek,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { enUS, nl } from "date-fns/locale";
import type { AppLanguage } from "@/lib/i18n";

export function toDateKey(date: Date | string) {
  const safeDate = typeof date === "string" ? parseISO(date) : date;
  return format(safeDate, "yyyy-MM-dd");
}

export function formatLongDate(date: Date | string, language: AppLanguage = "en") {
  const safeDate = typeof date === "string" ? parseISO(date) : date;
  return format(safeDate, "EEEE, d MMMM yyyy", { locale: getDateLocale(language) });
}

export function formatShortDate(date: Date | string) {
  const safeDate = typeof date === "string" ? parseISO(date) : date;
  return format(safeDate, "d MMM");
}

export function formatMonthLabel(
  month: number,
  year: number,
  language: AppLanguage = "en",
) {
  return format(new Date(year, month - 1, 1), "MMMM yyyy", {
    locale: getDateLocale(language),
  });
}

export function getWeekRange(date: Date | string, language: AppLanguage = "en") {
  const safeDate = typeof date === "string" ? parseISO(date) : date;
  const start = startOfWeek(safeDate, { weekStartsOn: 1 });
  const end = endOfWeek(safeDate, { weekStartsOn: 1 });

  return {
    start,
    end,
    label: `${format(start, "d MMM", { locale: getDateLocale(language) })} - ${format(end, "d MMM", { locale: getDateLocale(language) })}`,
    weekNumber: getISOWeek(safeDate),
    startKey: toDateKey(start),
    endKey: toDateKey(end),
  };
}

export function getMonthRange(date: Date | string, language: AppLanguage = "en") {
  const safeDate = typeof date === "string" ? parseISO(date) : date;
  const start = startOfMonth(safeDate);
  const end = endOfMonth(safeDate);

  return {
    start,
    end,
    label: format(safeDate, "MMMM yyyy", { locale: getDateLocale(language) }),
    startKey: toDateKey(start),
    endKey: toDateKey(end),
  };
}

export function withinDateRange(dateKey: string, start: string, end: string) {
  return isWithinInterval(parseISO(dateKey), {
    start: parseISO(start),
    end: parseISO(end),
  });
}

export function isDateKeyToday(dateKey: string) {
  return isSameDay(parseISO(dateKey), new Date());
}

export function shiftDate(dateKey: string, days: number) {
  return toDateKey(addDays(parseISO(dateKey), days));
}

function getDateLocale(language: AppLanguage) {
  return language === "nl" ? nl : enUS;
}
