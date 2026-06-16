export const PERIODS = [
  { id: "all", label: "All Time" },
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
  { id: "year", label: "This Year" },
  { id: "custom", label: "Custom" },
];

export function parseSheetDate(dateStr) {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [d, m, y] = dateStr.split("-").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

export function getTransactionDate(record) {
  return record?.date || record?.Date || record?.created_at || "";
}

export function sortByTransactionDateDesc(records) {
  return [...records].sort(
    (a, b) => new Date(getTransactionDate(b)) - new Date(getTransactionDate(a))
  );
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date) {
  const d = startOfDay(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1);
}

export function isInPeriod(dateStr, period, customRange = {}) {
  const date = parseSheetDate(dateStr);
  if (!date) return false;
  const now = new Date();
  const record = startOfDay(date);

  switch (period) {
    case "all":
      return true;
    case "today":
      return record.getTime() === startOfDay(now).getTime();
    case "week":
      return record >= startOfWeek(now) && record <= startOfDay(now);
    case "month":
      return record >= startOfMonth(now) && record <= startOfDay(now);
    case "year":
      return record >= startOfYear(now) && record <= startOfDay(now);
    case "custom": {
      const from = customRange.from ? startOfDay(new Date(customRange.from)) : null;
      const to = customRange.to ? startOfDay(new Date(customRange.to)) : null;
      if (from && record < from) return false;
      if (to && record > to) return false;
      return true;
    }
    default:
      return true;
  }
}

export function filterByPeriod(records, period, customRange) {
  return records.filter((row) =>
    isInPeriod(getTransactionDate(row), period, customRange)
  );
}

export function sumAmount(records) {
  return records.reduce((sum, row) => sum + (Number(row.Amount) || 0), 0);
}

export function activeIncome(records) {
  return records.filter(
    (row) => String(row.Mode || "").trim().toLowerCase() !== "converted"
  );
}

export function periodLabel(period, customRange) {
  if (period === "custom" && customRange.from && customRange.to) {
    return `${customRange.from} → ${customRange.to}`;
  }
  return PERIODS.find((p) => p.id === period)?.label ?? "All Time";
}
