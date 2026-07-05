import {
  WEEKDAY_OPTIONS,
  type BriefEditDraft,
  type CreativeTask,
  type SourceCreative,
} from "../types";
import { formatDate } from "./dates";
import {
  sourceMatchesFolderUrl,
  sourceMatchesUrl,
} from "./library-urls";
import { sourceMatchesGroupKey } from "./sources";
import { normalizeEmail, resolveBriefAssignee } from "./products";
import { optionsText } from "./strategy";
import { nextWeekdayDate, normalizeFutureDueDate } from "./dates";

function uniqueStrings(values: unknown[]): string[] {
  return [
    ...new Set(
      values
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean),
    ),
  ];
}

export function taskScheduleLabel(
  task: Pick<
    CreativeTask,
    "dueDate" | "scheduleType" | "recurrenceFrequency" | "recurrenceDay"
  >,
) {
  if (task.scheduleType === "returning") {
    const day =
      WEEKDAY_OPTIONS.find((item) => item.value === task.recurrenceDay)
        ?.label || "Sunday";
    return `Weekly, every ${day}`;
  }
  return task.dueDate ? `Due ${formatDate(task.dueDate)}` : "No due date";
}

export function outputCountLabel(
  task: Pick<CreativeTask, "outputCount" | "scheduleType">,
) {
  return task.scheduleType === "returning"
    ? `${task.outputCount} outputs/week`
    : `${task.outputCount} outputs`;
}

export function isReturningBrief(task: Pick<CreativeTask, "scheduleType">) {
  return task.scheduleType === "returning";
}

export function deliveryPreviewLabel(task: Pick<CreativeTask, "scheduleType">) {
  return isReturningBrief(task) ? "Finished ad files" : "Finished ad file";
}

export function deliverySourceLabel(_task: Pick<CreativeTask, "scheduleType">) {
  return "Library file used";
}

export function deliveryPreviewHelp(task: Pick<CreativeTask, "scheduleType">) {
  return isReturningBrief(task)
    ? "Upload one finished video or image per ad. Creative OS stores it in the Ainomiq Library automatically."
    : "Upload the finished video or image. Creative OS stores it in the Ainomiq Library automatically.";
}

export function deliverySourceHelp(_task: Pick<CreativeTask, "scheduleType">) {
  return "Choose the Library file you used for this edit. Only files assigned through this brief are available.";
}

export function taskSourceLabel(
  task: Pick<CreativeTask, "sourceGroupName" | "sourceCreativeId">,
  source?: SourceCreative,
) {
  return (
    task.sourceGroupName ||
    source?.importName ||
    source?.name ||
    "Missing source"
  );
}

export function parseDeliveryLinks(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function sourceUsedUrlList(
  item:
    | { sourceUsedUrl?: string; sourceUsedUrls?: string[] }
    | null
    | undefined,
) {
  return uniqueStrings([
    ...(Array.isArray(item?.sourceUsedUrls) ? item.sourceUsedUrls : []),
    ...(item?.sourceUsedUrl ? parseDeliveryLinks(item.sourceUsedUrl) : []),
  ]);
}

export function sourceCreativeIdList(
  item:
    | { sourceCreativeId?: string; sourceCreativeIds?: string[] }
    | null
    | undefined,
) {
  return uniqueStrings([
    ...(Array.isArray(item?.sourceCreativeIds) ? item.sourceCreativeIds : []),
    item?.sourceCreativeId || "",
  ]);
}

export function deliveryDraftLines(value: string, count: number) {
  const lines = String(value || "").split("\n");
  while (lines.length < count) lines.push("");
  return lines.slice(0, count);
}

export function deliveryDraftLineCount(
  draft: { previewUrl?: string; sourceUsedUrl?: string } | undefined,
) {
  const previewCount = String(draft?.previewUrl || "").split("\n").length;
  const sourceCount = String(draft?.sourceUsedUrl || "").split("\n").length;
  return Math.max(1, previewCount, sourceCount);
}

export function findDeliveredSource(
  task: CreativeTask,
  sources: SourceCreative[],
  sourceUsedUrl: string,
) {
  const groupSources = task.sourceGroupKey
    ? sources.filter((item) =>
        sourceMatchesGroupKey(item, task.sourceGroupKey || ""),
      )
    : [];
  if (sourceUsedUrl && groupSources.length) {
    const exactSource = groupSources.find((item) =>
      sourceMatchesUrl(item, sourceUsedUrl),
    );
    if (exactSource) return exactSource;
    const folderMatchesBrief = groupSources.some((item) =>
      sourceMatchesFolderUrl(item, sourceUsedUrl),
    );
    if (folderMatchesBrief) {
      return (
        groupSources.find((item) => item.id === task.sourceCreativeId) ||
        groupSources.find(
          (item) => item.status !== "maxed out" && item.status !== "do not use",
        ) ||
        groupSources[0] ||
        null
      );
    }
    return null;
  }
  const assignedSource =
    sources.find((item) => item.id === task.sourceCreativeId) || null;
  if (
    sourceUsedUrl &&
    assignedSource &&
    (sourceMatchesUrl(assignedSource, sourceUsedUrl) ||
      sourceMatchesFolderUrl(assignedSource, sourceUsedUrl))
  )
    return assignedSource;
  return assignedSource;
}

export function findDeliveredSources(
  task: CreativeTask,
  sources: SourceCreative[],
  sourceUsedUrls: string[],
) {
  const matched = sourceUsedUrls
    .map((sourceUsedUrl) => findDeliveredSource(task, sources, sourceUsedUrl))
    .filter((source): source is SourceCreative => Boolean(source));
  const byId = new Map<string, SourceCreative>();
  matched.forEach((source) => byId.set(source.id, source));
  return [...byId.values()];
}

export function taskChatRoomId(task: Pick<CreativeTask, "id" | "chatRoomId">) {
  return task.chatRoomId || task.id;
}

export function taskLegacyParticipantChatRoomId(
  task: Pick<CreativeTask, "id" | "chatRoomId" | "assignee">,
) {
  const assignee = normalizeEmail(task.assignee);
  return assignee ? `editor:${assignee}` : taskChatRoomId(task);
}

export function taskParticipantChatRoomId(
  task: Pick<CreativeTask, "id" | "chatRoomId" | "assignee" | "productId">,
) {
  const assignee = normalizeEmail(task.assignee);
  return assignee
    ? `editor:${task.productId}:${assignee}`
    : taskChatRoomId(task);
}

export function briefEditHasStructuralChanges(
  previousTask: CreativeTask,
  draft: BriefEditDraft,
  nextSourceId: string,
  nextSourceGroupKey: string | undefined,
  permissions: Array<{ email?: string; userName: string }>,
) {
  const nextDueDate =
    draft.scheduleType === "returning"
      ? nextWeekdayDate(draft.recurrenceDay)
      : normalizeFutureDueDate(draft.dueDate);
  const nextOutputCount = Math.max(1, Number(draft.outputCount) || 1);
  if (
    resolveBriefAssignee(draft.assignee, permissions) !==
    resolveBriefAssignee(previousTask.assignee, permissions)
  ) {
    return true;
  }
  if (previousTask.sourceCreativeId !== nextSourceId) return true;
  if ((previousTask.sourceGroupKey || "") !== (nextSourceGroupKey || ""))
    return true;
  if (
    optionsText(previousTask.angles, previousTask.angle) !== draft.angles.trim()
  )
    return true;
  if (optionsText(previousTask.hooks, previousTask.hook) !== draft.hooks.trim())
    return true;
  if ((previousTask.format || "").trim() !== draft.format.trim()) return true;
  if (previousTask.outputCount !== nextOutputCount) return true;
  if (previousTask.dueDate !== nextDueDate) return true;
  if ((previousTask.scheduleType || "one-time") !== draft.scheduleType)
    return true;
  if (
    draft.scheduleType === "returning" &&
    (previousTask.recurrenceDay || "sunday") !== draft.recurrenceDay
  ) {
    return true;
  }
  if ((previousTask.notes || "").trim() !== draft.notes.trim()) return true;
  return false;
}
