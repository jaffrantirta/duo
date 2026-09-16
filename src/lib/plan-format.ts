// Dates are wall-clock, not instants: parse and format in UTC so "2026-10-03"
// reads as 3 October everywhere.
export function formatPlanDate(onDate: string | null, atTime: string | null): string | null {
  if (!onDate) return null;

  const [year, month, day] = onDate.split("-").map(Number);
  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(year, month - 1, day)));

  if (!atTime) return label;

  const [hour, minute] = atTime.split(":").map(Number);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(Date.UTC(2000, 0, 1, hour, minute)));

  return `${label} · ${time}`;
}
