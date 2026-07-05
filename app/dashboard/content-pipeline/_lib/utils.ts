import { CONTENT_IMAGE_MODELS } from "@/lib/content-image-models";
import { 
  Draft, 
  ManualLayout, 
  ProductCatalogItem, 
  Idea, 
  ScheduledPost, 
  BrandProfile,
  ContentConfig
} from "./types";

export function sameAsset(left?: string | null, right?: string | null) {
  if (!left || !right) return false;
  const clean = (value: string) => {
    try {
      const url = new URL(value);
      url.hash = "";
      url.search = "";
      return url.toString().replace(/\/$/, "").toLowerCase();
    } catch {
      return value.split(/[?#]/)[0].replace(/\/$/, "").toLowerCase();
    }
  };
  return clean(left) === clean(right);
}

export const STARTER_IDEAS: Idea[] = [
  {
    title: "Product spotlight",
    angle: "Show one product with a clean benefit and product image.",
    channel: "Instagram",
  },
  {
    title: "New drop post",
    angle: "Turn selected products into a simple launch-style post.",
    channel: "Instagram",
  },
  {
    title: "Style idea",
    angle: "Explain how the customer can wear or use the product.",
    channel: "Instagram",
  },
  {
    title: "Proof post",
    angle: "Turn a review, result, or product detail into trust.",
    channel: "Instagram",
  },
];

export function outputLabel(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function cleanDisplayText(value: string) {
  return value.replace(/[\u2014\u2013]/g, " - ");
}

export function platformLabel(type: string) {
  const value = type.toLowerCase();
  if (value.includes("instagram")) return "Instagram";
  if (value.includes("ad")) return "Meta ad";
  if (value.includes("email")) return "Email";
  if (value.includes("linkedin")) return "LinkedIn";
  return "Social post";
}

export function postTypeLabel(type: string) {
  const value = outputLabel(type);
  if (value.toLowerCase() === "draft") return "Post";
  return value.replace(/Caption$/i, "Caption");
}

export function modelLabel(id?: string) {
  const model = CONTENT_IMAGE_MODELS.find((item) => item.id === id);
  return model
    ? `${model.label} - ${model.billableCredits} credit${model.billableCredits === 1 ? "" : "s"}`
    : "Text content";
}

export function stripTemplateLabels(value: string) {
  return cleanDisplayText(value)
    .replace(
      /^\s*(visual\s*direction|direction|layout|image|image\s*direction|copy|caption|subline|headline|title)\s*:\s*/i,
      "",
    )
    .trim();
}

export function shortWords(value: string, maxWords: number, maxChars: number) {
  const words = stripTemplateLabels(value)
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean);
  const clipped = words.slice(0, maxWords).join(" ");
  const text =
    clipped.length > maxChars
      ? `${clipped.slice(0, maxChars).trim()}...`
      : clipped;
  return text.replace(/\s+([,.!?])/g, "$1");
}

export function splitDraftSections(content: string) {
  const sections: Record<string, string> = {};
  cleanDisplayText(content)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const match = line.match(
        /^(visual\s*direction|direction|layout|image|image\s*direction|headline|title|copy|caption|subline|body)\s*:\s*(.+)$/i,
      );
      if (match)
        sections[match[1].toLowerCase().replace(/\s+/g, "_")] = match[2].trim();
    });
  return sections;
}

export function customerCaption(content: string) {
  const clean = cleanDisplayText(content);
  const lines = clean
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !/^(visual\s*direction|direction|layout|image|image\s*direction|template)\s*:/i.test(
          line,
        ),
    );
  const captionLines = lines
    .filter((line) => /^(copy|caption)\s*:/i.test(line))
    .map((line) => line.replace(/^(copy|caption)\s*:\s*/i, ""));
  const finalLines = captionLines.length
    ? captionLines
    : lines.map((line) =>
        line.replace(/^(headline|title|subline|copy|caption)\s*:\s*/i, ""),
      );
  return finalLines.join("\n").trim() || clean;
}

export function templateDisplayCopy(draft: Draft, index: number) {
  const sections = splitDraftSections(draft.content || "");
  const titleWithoutPrefix = draft.title
    .replace(/^Template\s*\d+\s*-\s*/i, "")
    .replace(
      /^(Ideas|Instagram Post|Instagram Caption|Ad Copy|Content Calendar|Hook List|Email Snippet)\s*:\s*/i,
      "",
    );
  const fallbackSentences = cleanDisplayText(draft.content || draft.title)
    .split(/[.!?\n]/)
    .map((item) => item.trim())
    .filter(
      (item) =>
        item &&
        !/^(visual\s*direction|direction|layout|image|image\s*direction)\s*:/i.test(
          item,
        ),
    );
  const headlineSource =
    sections.headline ||
    sections.copy ||
    sections.caption ||
    titleWithoutPrefix ||
    fallbackSentences[0] ||
    `Template ${index + 1}`;
  const sublineSource =
    [sections.subline, sections.body].filter(Boolean).join(" ") ||
    fallbackSentences.find(
      (item) => item !== headlineSource && !/^copy\s*:/i.test(item),
    ) ||
    "";
  return {
    headline:
      shortWords(headlineSource, index === 1 ? 7 : 6, 46) ||
      `Template ${index + 1}`,
    subline: shortWords(sublineSource, 18, 110),
  };
}

export function visibleTemplateCount(total: number) {
  return Math.min(Math.max(total, 1), 5);
}

export function feedbackTargetIndexes(feedback: string, total: number) {
  const limit = visibleTemplateCount(total);
  const indexes = new Set<number>();
  const words: Record<string, number> = {
    one: 1, first: 1, een: 1, eerste: 1,
    two: 2, second: 2, twee: 2, tweede: 2,
    three: 3, third: 3, drie: 3, derde: 3,
    four: 4, fourth: 4, vier: 4, vierde: 4,
    five: 5, fifth: 5, vijf: 5, vijfde: 5,
  };
  const patterns = [
    /(?:template|templates|tmplte|tmpltes|temp|kaart|card)\s*(?:nr\.?|number|num|#)?\s*(\d+)/gi,
    /(?:template|templates|tmplte|tmpltes|temp|kaart|card)\s*(one|first|een|eerste|two|second|twee|tweede|three|third|drie|derde|four|fourth|vier|vierde|five|fifth|vijf|vijfde)/gi,
    /(?:nr\.?|number|num|#)\s*(\d+)/gi,
  ];
  patterns.forEach((pattern) => {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(feedback)) !== null) {
      const raw = String(match[1] || "").toLowerCase();
      const value = Number(raw) || words[raw];
      if (Number.isFinite(value) && value >= 1 && value <= limit)
        indexes.add(value - 1);
    }
  });
  return indexes.size
    ? Array.from(indexes).sort((a, b) => a - b)
    : Array.from({ length: limit }, (_, index) => index);
}

export function feedbackTargetLabel(indexes: number[]) {
  if (indexes.length === 1) return `template ${indexes[0] + 1}`;
  return `${indexes.length} templates`;
}

export function stripFeedbackTargetWords(feedback: string) {
  return cleanDisplayText(feedback)
    .replace(
      /\b(?:pas|adjust|change|edit|update|refine|improve|aanpassen|aan|dit|this|deze|huidige|current)\b/gi,
      " ",
    )
    .replace(
      /\b(?:template|templates|tmplte|tmpltes|temp|kaart|card)\s*(?:nr\.?|number|num|#)?\s*(\d+|one|first|een|eerste|two|second|twee|tweede|three|third|drie|derde|four|fourth|vier|vierde|five|fifth|vijf|vijfde)?/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function hasVisibleTemplateChange(before: Draft, after: Draft) {
  return (
    cleanDisplayText(before.title) !== cleanDisplayText(after.title) ||
    cleanDisplayText(before.content) !== cleanDisplayText(after.content) ||
    before.templateIndex !== after.templateIndex ||
    before.hideLogo !== after.hideLogo ||
    before.cleanAlign !== after.cleanAlign ||
    before.roundedFrames !== after.roundedFrames ||
    before.imageUrl !== after.imageUrl
  );
}

export function templatePurpose(index: number) {
  const purposes = [
    "Hero image",
    "Problem split",
    "Feature spotlight",
    "Proof post",
    "Carousel cover",
  ];
  return purposes[index % purposes.length];
}

export function templateStyle(index: number) {
  const styles = [
    "photo-split",
    "graphic-hub",
    "dark-loop",
    "editorial-band",
    "modular-frame",
  ] as const;
  return styles[index % styles.length];
}

export function hasFinalImage(draft: Draft) {
  const value = (draft.imageUrl || "").trim();
  return (
    Boolean(value) && !/placeholder|image area|hero image area/i.test(value)
  );
}

export function localDraftKey(tenantId?: string) {
  return `ainomiq-content-drafts-${tenantId || "default"}`;
}

export function localChatKey(tenantId?: string) {
  return `ainomiq-content-chat-${tenantId || "default"}`;
}

export function localTemplateKey(tenantId?: string) {
  return `ainomiq-content-saved-templates-${tenantId || "default"}`;
}

export function localMenuKey(tenantId?: string) {
  return `ainomiq-content-menu-${tenantId || "default"}`;
}

export function localScheduleKey(tenantId?: string) {
  return `ainomiq-content-schedule-${tenantId || "default"}`;
}

export function localPostCountKey(tenantId?: string) {
  return `ainomiq-content-post-count-${tenantId || "default"}`;
}
