export function reminderClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    today: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
  };
}
export function reminderDueLimit(today, leadDays) {
  return new Date(Date.parse(today + "T00:00:00Z") + leadDays * 86400000)
    .toISOString()
    .slice(0, 10);
}
