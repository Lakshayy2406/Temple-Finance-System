export function currentTime() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

export function formatDateTime(date, time) {
  if (!date) return "—";
  return time ? `${date} ${time}` : date;
}
