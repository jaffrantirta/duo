const MS_PER_DAY = 86_400_000;

export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function daysTogether(togetherSince: string, timeZone: string, now: Date = new Date()): number {
  const diff = toUtcMs(todayInTimeZone(timeZone, now)) - toUtcMs(togetherSince);
  return Math.max(0, Math.round(diff / MS_PER_DAY));
}

function resolveTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

function toUtcMs(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}
