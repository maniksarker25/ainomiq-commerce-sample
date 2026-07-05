import fs from "fs";
import path from "path";

const root = path.join(process.cwd(), "app/dashboard/creative-os/components");
const srcPath = path.join(root, "CreativeOsWorkspace.tsx");
const lines = fs.readFileSync(srcPath, "utf8").split(/\r?\n/);

const TOKEN_REPLACEMENTS = [
  [/text-slate-950/g, "text-foreground"],
  [/text-slate-900/g, "text-foreground"],
  [/text-slate-600/g, "text-muted-foreground"],
  [/text-slate-500/g, "text-muted-foreground"],
  [/border-slate-200/g, "border-primary/15"],
  [/border-slate-100/g, "border-primary/10"],
];

function applyTokens(code) {
  let out = code;
  for (const [pattern, replacement] of TOKEN_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function slice(start, end) {
  return lines.slice(start - 1, end).join("\n");
}

function stripOuterConditional(code, patterns) {
  let out = code.trim();
  for (const pattern of patterns) {
    const match = out.match(pattern);
    if (match) {
      out = out.replace(match[0], "").trim();
    }
  }
  return out;
}

function dedentInner(code) {
  const bodyLines = code.split("\n");
  const minIndent = bodyLines
    .filter((line) => line.trim())
    .reduce((min, line) => {
      const m = line.match(/^(\s+)/);
      return m ? Math.min(min, m[1].length) : min;
    }, Infinity);
  if (!Number.isFinite(minIndent) || minIndent === Infinity) return code;
  return bodyLines
    .map((line) => (line.length >= minIndent ? line.slice(minIndent) : line))
    .join("\n");
}

const tabDefs = [
  {
    file: "ProductsTab.tsx",
    sections: [
      { start: 4662, end: 4749, strip: [/\{\(state\.activeSection === "dashboard" \|\|[\s\S]*?\) && \(\s*/],
      },
      { start: 4751, end: 4986, strip: [/\{\(state\.activeSection === "dashboard" \|\|[\s\S]*?\) && \(\s*/],
      },
    ],
    imports: `import { Layers3, Loader2, Package, Plus, Sparkles, Trash2, Users } from "lucide-react";
import { Input, Textarea } from "../../_components/FormFields";
import { PreviewCard } from "../shared/PreviewCard";
import { SectionTitle } from "../shared/SectionTitle";
import { CardList, TagInput } from "../shared/WorkspaceWidgets";
import type { ProductsTabProps } from "./types";`,
    propsType: "ProductsTabProps",
  },
  {
    file: "LibraryTab.tsx",
    single: { start: 4987, end: 5155 },
    strip: [
      /\{state\.activeSection === "sources" && state\.products\.length \? \(\s*/,
      /\s*\) : null\}\s*$/,
    ],
    imports: `import { Archive, Link2, Plus, Trash2, Upload } from "lucide-react";
import { CreativeLibraryGroupBrowser } from "../library/CreativeLibraryGroupBrowser";
import type { LibraryTabProps } from "./types";`,
    propsType: "LibraryTabProps",
  },
  {
    file: "BrandTab.tsx",
    single: { start: 5157, end: 5250 },
    strip: [
      /\{canManageAccess && state\.activeSection === "brand" \? \(\s*/,
      /\s*\) : null\}\s*$/,
    ],
    imports: `import { Loader2, Sparkles } from "lucide-react";
import { Input, Textarea } from "../../_components/FormFields";
import { BrandReferenceLinksEditor } from "../shared/WorkspaceWidgets";
import type { BrandTabProps } from "./types";`,
    propsType: "BrandTabProps",
  },
  {
    file: "PostBriefsTab.tsx",
    single: { start: 5252, end: 6249 },
    strip: [/\{state\.activeSection === "tasks" && \(\s*/, /\s*\)\}\s*$/],
    imports: `import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  MessageCircle,
  Package,
  Pencil,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BriefFocusPanel,
  DueDateSelect,
  GridList,
  Input,
  Textarea,
} from "../../_components/FormFields";
import { CREATIVE_FORMAT_OPTIONS } from "../../types";
import { catalogDisplayName } from "../../lib/products";
import { sourceGroupValue } from "../../lib/sources";
import { sourceStatusLabel } from "../../lib/sources";
import { parseMultilineOptions } from "../../lib/strategy";
import { formatDate, nextWeekdayDate, WEEKDAY_OPTIONS } from "../../lib/dates";
import {
  isReturningBrief,
  optionsText,
  outputCountLabel,
  taskChatRoomId,
  taskScheduleLabel,
  taskSourceLabel,
} from "../../lib/tasks";
import { SectionTitle } from "../shared/SectionTitle";
import { StrategyPicker } from "../shared/WorkspaceWidgets";
import type { PostBriefsTabProps } from "./types";`,
    propsType: "PostBriefsTabProps",
  },
  {
    file: "ChatTab.tsx",
    single: { start: 6251, end: 6277 },
    strip: [/\{state\.activeSection === "chat" && \(\s*/, /\s*\)\}\s*$/],
    imports: `import { ChatPanel } from "../shared/WorkspaceWidgets";
import type { ChatTabProps } from "./types";`,
    propsType: "ChatTabProps",
  },
  {
    file: "ReviewTab.tsx",
    single: { start: 6279, end: 6522 },
    strip: [/\{state\.activeSection === "review" && \(\s*/, /\s*\)\}\s*$/],
    imports: `import { CheckCircle2, Loader2, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GridList } from "../../_components/FormFields";
import { sourceUsedUrlList } from "../../lib/tasks";
import { isReturningBrief, taskSourceLabel } from "../../lib/tasks";
import { SubmittedAdPreview } from "../shared/MediaPreview";
import { SectionTitle } from "../shared/SectionTitle";
import type { ReviewTabProps } from "./types";`,
    propsType: "ReviewTabProps",
  },
  {
    file: "LaunchTab.tsx",
    single: { start: 6524, end: 6583 },
    strip: [/\{state\.activeSection === "launch" && \(\s*/, /\s*\)\}\s*$/],
    imports: `import { GridList } from "../../_components/FormFields";
import type { LaunchTabProps } from "./types";`,
    propsType: "LaunchTabProps",
  },
  {
    file: "LearningTab.tsx",
    single: { start: 6585, end: 6635 },
    strip: [/\{state\.activeSection === "learning" && \(\s*/, /\s*\)\}\s*$/],
    imports: `import { BarChart3 } from "lucide-react";
import { Metric } from "../../_components/StatCard";
import { SectionTitle } from "../shared/SectionTitle";
import type { LearningTabProps } from "./types";`,
    propsType: "LearningTabProps",
  },
  {
    file: "SettingsTab.tsx",
    single: { start: 6637, end: 6841 },
    strip: [
      /\{canManageAccess && state\.activeSection === "access" && \(\s*/,
      /\s*\)\}\s*$/,
    ],
    imports: `import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, GridList } from "../../_components/FormFields";
import { formatDate } from "../../lib/dates";
import { SectionTitle } from "../shared/SectionTitle";
import { AccessPersonCard, MiniFlow } from "../shared/WorkspaceWidgets";
import type { SettingsTabProps } from "./types";`,
    propsType: "SettingsTabProps",
  },
];

const tabsDir = path.join(root, "tabs");
fs.mkdirSync(tabsDir, { recursive: true });

for (const def of tabDefs) {
  let body = "";
  if (def.sections) {
    body = def.sections
      .map((section) => {
        let chunk = slice(section.start, section.end);
        for (const pattern of section.strip || []) {
          chunk = stripOuterConditional(chunk, [pattern]);
        }
        return dedentInner(chunk);
      })
      .join("\n\n");
  } else {
    let chunk = slice(def.single.start, def.single.end);
    for (const pattern of def.strip || []) {
      chunk = chunk.replace(pattern, "").trim();
    }
    body = dedentInner(chunk);
  }

  body = applyTokens(body);
  body = body.replace(/\bsectionRefs\.current\.(\w+)\s*=/g, "props.sectionRefs.$1 =");
  body = body.replace(
    /ref=\{\(el\) => \{\s*sectionRefs\.current\.(\w+) = el;\s*\}\}/g,
    "ref={(el) => { props.sectionRefs.$1 = el; }}",
  );

  const content = `"use client";

${def.imports}

export function ${def.file.replace(".tsx", "")}(props: ${def.propsType}) {
  const {
${Object.keys({}).length ? "" : ""}  } = props;
  return (
    <>
${body
  .split("\n")
  .map((line) => `      ${line}`)
  .join("\n")}
    </>
  );
}
`;

  fs.writeFileSync(path.join(tabsDir, def.file), content);
  console.log("Wrote", def.file);
}

console.log("Done. Fill types.ts and fix prop destructuring.");
