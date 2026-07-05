import fs from "fs";

const lines = fs
  .readFileSync("app/dashboard/creative-os/components/CreativeOsWorkspace.tsx", "utf8")
  .split(/\r?\n/);

const header = `"use client";

import { useState } from "react";
import {
  ChevronRight,
  Link2,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  BrandReferenceLink,
  ChatMessage,
  CreativeTask,
  ProductPermission,
} from "../../types";
import { formatChatTime } from "../../lib/dates";
import { normalizeBrandReferenceLinks } from "../../lib/normalize";
import { normalizeEmail } from "../../lib/products";
import { Input, Textarea } from "../../_components/FormFields";

export type ChatRoomView = {
  id: string;
  title: string;
  description: string;
  tasks: CreativeTask[];
  assignees: string[];
  roomIds: string[];
  lastMessage?: ChatMessage;
};

`;

let body = lines.slice(7205, 7927).join("\n");
body = body.replace(/^function Input\b[\s\S]*$/m, "");
body = body.replace(/^function FinishedAdUploadField\b[\s\S]*$/m, "");
body = body.replace(/^function LibraryFileSelect\b[\s\S]*$/m, "");
body = body.replace(/^function DueDateSelect\b[\s\S]*$/m, "");
body = body.replace(/^function Textarea\b[\s\S]*$/m, "");
body = body.replace(/^function BriefFocusPanel\b[\s\S]*$/m, "");
body = body.replace(/^function ActionButton\b[\s\S]*$/m, "");
body = body.replace(/^function ClipboardIcon\b[\s\S]*$/m, "");
body = body.replace(/^type ChatRoomView[\s\S]*?};\s*/m, "");
body = body.replace(/^function /gm, "export function ");
body = body
  .replace(/text-slate-950/g, "text-foreground")
  .replace(/text-slate-900/g, "text-foreground")
  .replace(/text-slate-600/g, "text-muted-foreground")
  .replace(/text-slate-500/g, "text-muted-foreground")
  .replace(/border-slate-200/g, "border-primary/15");

fs.writeFileSync(
  "app/dashboard/creative-os/components/shared/WorkspaceWidgets.tsx",
  header + body.trim() + "\n",
);
console.log("Wrote WorkspaceWidgets.tsx");
