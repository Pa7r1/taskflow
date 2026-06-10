const DAY_MS = 86400000;

export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysFromToday(dateISO) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${dateISO}T00:00:00`);
  return Math.round((date - today) / DAY_MS);
}

export function isOverdue(dateISO) {
  return daysFromToday(dateISO) < 0;
}

export function formatRelative(dateISO) {
  const diff = daysFromToday(dateISO);
  if (isNaN(diff)) return dateISO;
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff === -1) return "ayer";
  if (diff < 0) return `hace ${-diff} días`;
  if (diff <= 7) return `en ${diff} días`;
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
  });
}
