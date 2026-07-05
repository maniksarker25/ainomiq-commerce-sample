import fs from "node:fs";

const path = new URL(
  "../app/dashboard/creative-os/components/CreativeOsWorkspace.tsx",
  import.meta.url,
);
let src = fs.readFileSync(path, "utf8");

const propsStart = src.indexOf("export type CreativeOsWorkspaceProps");
const uiHelpersStart = src.indexOf("\nfunction revisionFeedbackChatBody");
const mainStart = src.indexOf("export default function CreativeOsWorkspace");

if (propsStart === -1 || uiHelpersStart === -1 || mainStart === -1) {
  throw new Error(
    `markers not found: ${propsStart} ${uiHelpersStart} ${mainStart}`,
  );
}

const uiHelpers = src.slice(uiHelpersStart, mainStart);

const imports = `"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  FolderClosed,
  Layers3,
  Link2,
  Loader2,
  MessageCircle,
  MoreVertical,
  Package,
  Pencil,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import AutomationWorkspaceLayout, {
  type AutomationNavItem,
} from "@/components/AutomationWorkspaceLayout";
import type {
  BriefEditDraft,
  CreativeOsState,
  CreativeOsWorkspaceProps,
  CreativeTask,
  DeliveredEdit,
  LaunchItem,
  Product,
  ProductPermission,
  ReviewItem,
  SetupGuideStep,
  SourceCreative,
  StrategyListField,
  TaskDraft,
} from "../types";
import {
  CREATIVE_FORMAT_OPTIONS,
  MONTH_OPTIONS,
  SOURCE_GROUP_VALUE_PREFIX,
  WEEKDAY_OPTIONS,
  blankProduct,
  createInitialTaskDraft,
  emptyState,
  catalogDisplayName,
  createCatalogGroup,
  collectionUrlForProduct,
  normalizeAiProductFields,
} from "../types";
import {
  formatChatTime,
  formatDate,
  futureDueDateOptions,
  normalizeFutureDueDate,
  nextWeekdayDate,
  parseDateParts,
  dueDateOptionLabel,
} from "../lib/dates";
import {
  extractGoogleDriveId,
  isGoogleDriveFileLink,
  isGoogleDriveFolderLink,
  isAinomiqStoredSource,
  librarySourceOptions,
  sourceLibraryUrl,
  sourceMatchesFolderUrl,
  sourceMatchesUrl,
} from "../lib/library-urls";
import {
  approvedSourceUsageCount,
  catalogScopeKey,
  sourceBelongsToProduct,
  sourceGroupKey,
  sourceGroupKeyFromValue,
  sourceGroupName,
  sourceGroupValue,
  sourceIsEditable,
  sourceMatchesGroupKey,
  sourceStatusLabel,
  sourceStorageLabel,
} from "../lib/sources";
import {
  cleanCompanyName,
  looksLikeEmail,
  normalizeEmail,
} from "../lib/products";
import {
  appendStrategyNote,
  appendUniqueOption,
  hasStrategyNote,
  mergeNotesWithStrategyContext,
  optionsText,
  parseMultilineOptions,
  removeOption,
  removeStrategyNote,
  strategyContextLines,
} from "../lib/strategy";
import {
  deliveryDraftLineCount,
  deliveryDraftLines,
  deliveryPreviewHelp,
  deliveryPreviewLabel,
  deliverySourceHelp,
  deliverySourceLabel,
  findDeliveredSource,
  findDeliveredSources,
  isReturningBrief,
  outputCountLabel,
  sourceCreativeIdList,
  sourceUsedUrlList,
  taskChatRoomId,
  taskLegacyParticipantChatRoomId,
  taskParticipantChatRoomId,
  taskScheduleLabel,
  taskSourceLabel,
} from "../lib/tasks";
import {
  mergeCreativeOsState,
  normalizeChatMessages,
  normalizeCreativeOsState,
  uniqueStrings,
} from "../lib/normalize";

export type { CreativeOsWorkspaceProps } from "../types";

function sourceNameFromUrl(value: string, fallback: string) {
  try {
    const url = new URL(value);
    const lastPathPart =
      url.pathname.split("/").filter(Boolean).pop() || url.hostname;
    return (
      decodeURIComponent(lastPathPart)
        .replace(/\\.[a-z0-9]+$/i, "")
        .replace(/[-_]+/g, " ")
        .trim() || fallback
    );
  } catch {
    return fallback;
  }
}

function sourceTypeFromUrl(value: string): "image" | "video" {
  const clean = value.split("?")[0].toLowerCase();
  return /\\.(mp4|mov|m4v|webm|mpeg|mpg)$/i.test(clean) ? "video" : "image";
}

`;

src =
  imports +
  uiHelpers +
  src.slice(mainStart);
fs.writeFileSync(path, src);
console.log("Stripped workspace, lines:", src.split("\n").length);
