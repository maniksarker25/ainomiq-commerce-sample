export function parseMultilineOptions(value: string, fallback: string, limit = 8) {
  const items = value
    .split(/\n|;/)
    .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);
  return Array.from(new Set(items.length ? items : [fallback])).slice(0, limit);
}

export function optionsText(items: string[] | undefined, fallback: string) {
  return (items?.length ? items : [fallback]).join("\n");
}

export function appendUniqueOption(value: string, item: string) {
  const cleanItem = item.trim();
  if (!cleanItem) return value;
  const current = parseMultilineOptions(value, "", 20).filter(Boolean);
  if (
    current.some((option) => option.toLowerCase() === cleanItem.toLowerCase())
  )
    return current.join("\n");
  return [...current, cleanItem].join("\n");
}

export function removeOption(value: string, item: string) {
  const cleanItem = item.trim().toLowerCase();
  if (!cleanItem) return value;
  return parseMultilineOptions(value, "", 20)
    .filter((option) => option.trim().toLowerCase() !== cleanItem)
    .join("\n");
}

export function strategyNoteLine(label: string, item: string) {
  return `${label}: ${item.trim()}`;
}

export function appendStrategyNote(notes: string, label: string, item: string) {
  const cleanItem = item.trim();
  if (!cleanItem) return notes;
  const line = strategyNoteLine(label, cleanItem);
  const current = notes.trim();
  if (current.toLowerCase().includes(line.toLowerCase())) return notes;
  return [current, line].filter(Boolean).join("\n");
}

export function removeStrategyNote(notes: string, label: string, item: string) {
  const line = strategyNoteLine(label, item).toLowerCase();
  return notes
    .split("\n")
    .filter((noteLine) => noteLine.trim().toLowerCase() !== line)
    .join("\n")
    .trim();
}

export function hasStrategyNote(notes: string, label: string, item: string) {
  const line = strategyNoteLine(label, item).toLowerCase();
  return notes
    .split("\n")
    .some((noteLine) => noteLine.trim().toLowerCase() === line);
}

export function strategyContextLines(notes: string) {
  return notes
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^target persona:|^claim boundary:/i.test(line));
}

export function mergeNotesWithStrategyContext(
  currentNotes: string,
  nextNotes: string,
) {
  const contextLines = strategyContextLines(currentNotes);
  const cleanNextNotes = nextNotes
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^target persona:|^claim boundary:/i.test(line))
    .join("\n");
  return [...(cleanNextNotes ? [cleanNextNotes] : []), ...contextLines]
    .join("\n")
    .trim();
}
