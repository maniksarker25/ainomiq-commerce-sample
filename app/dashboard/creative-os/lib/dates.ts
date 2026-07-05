export const WEEKDAY_OPTIONS = [
  { value: "monday", label: "Monday", index: 1 },
  { value: "tuesday", label: "Tuesday", index: 2 },
  { value: "wednesday", label: "Wednesday", index: 3 },
  { value: "thursday", label: "Thursday", index: 4 },
  { value: "friday", label: "Friday", index: 5 },
  { value: "saturday", label: "Saturday", index: 6 },
  { value: "sunday", label: "Sunday", index: 0 },
];

export const MONTH_OPTIONS = [
  { value: "01", label: "Jan" },
  { value: "02", label: "Feb" },
  { value: "03", label: "Mar" },
  { value: "04", label: "Apr" },
  { value: "05", label: "May" },
  { value: "06", label: "Jun" },
  { value: "07", label: "Jul" },
  { value: "08", label: "Aug" },
  { value: "09", label: "Sep" },
  { value: "10", label: "Oct" },
  { value: "11", label: "Nov" },
  { value: "12", label: "Dec" },
];

export const DUE_DATE_OPTION_DAYS = 90;

export function dateInputValue(date: Date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFromInputValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function defaultDueDate() {
  const next = new Date();
  next.setDate(next.getDate() + 7);
  return dateInputValue(next);
}

export function dueDateOptionLabel(value: string) {
  const date = dateFromInputValue(value);
  if (!date || Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function futureDueDateOptions() {
  const now = new Date();
  return Array.from({ length: DUE_DATE_OPTION_DAYS }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() + index + 1);
    return dateInputValue(date);
  });
}

export function normalizeFutureDueDate(value: string) {
  const options = futureDueDateOptions();
  return options.includes(value) ? value : defaultDueDate();
}

export function parseDateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  const fallback = normalizeFutureDueDate(match ? value : "");
  return {
    year: fallback.slice(0, 4),
    month: fallback.slice(5, 7),
    day: fallback.slice(8, 10),
  };
}

export function nextWeekdayDate(dayValue: string) {
  const selected =
    WEEKDAY_OPTIONS.find((day) => day.value === dayValue) || WEEKDAY_OPTIONS[6];
  const now = new Date();
  const daysUntil = (selected.index - now.getDay() + 7) % 7 || 7;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntil);
  return dateInputValue(next);
}

export function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function formatChatTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
