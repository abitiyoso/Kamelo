export function dashboardPeriods(today) {
  const [year, month, day] = today.split("-").map(Number);
  const date = (y, m, d) =>
    new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
  return {
    start: today.slice(0, 7) + "-01",
    comparisonStart: date(year, month - 2, 1),
    comparisonEnd: date(
      year,
      month - 2,
      Math.min(day, new Date(Date.UTC(year, month - 1, 0)).getUTCDate()),
    ),
    months: Array.from({ length: 6 }, (_, i) =>
      date(year, month - 6 + i, 1).slice(0, 7),
    ),
  };
}
