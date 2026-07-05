import type { Draft, SavedTemplate, ScheduledPost } from "./types";
import { computeScheduledAt, DEFAULT_PUBLISH_TIMEZONE } from "@/lib/content-studio-schedule-utils";
import { customerCaption } from "./utils";

export function draftFromSavedTemplate(template: SavedTemplate, index = 0): Draft {
  return {
    id: `template-${template.id}-${index}`,
    title: template.title,
    type: "Template",
    content: template.content,
    status: "Draft",
    templateId: template.id,
    templateIndex: template.styleIndex,
    hideLogo: template.hideLogo,
    cleanAlign: template.cleanAlign,
    roundedFrames: template.roundedFrames,
    updatedAt: template.updatedAt,
    manualLayout: template.manualLayout,
    imageUrl: template.imageUrl || null,
    imageError: template.imageError || null,
  };
}

export function scheduleTimeForIndex(index: number) {
  return index % 2 === 0 ? "10:00" : "15:00";
}

export function buildScheduledPostsFromDrafts(
  sources: Draft[],
  weeklyPostCount: number,
  startDate = new Date(),
  timeZone = DEFAULT_PUBLISH_TIMEZONE,
): ScheduledPost[] {
  if (!sources.length || weeklyPostCount < 1) return [];

  return Array.from({ length: weeklyPostCount }, (_, index) => {
    const source = sources[index % sources.length];
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const dateStr = date.toISOString().slice(0, 10);
    const time = scheduleTimeForIndex(index);
    return {
      id: `${Date.now()}-week-${index}-${Math.random().toString(16).slice(2)}`,
      date: dateStr,
      time,
      scheduledAt: computeScheduledAt(dateStr, time, timeZone),
      platform: "Instagram",
      status: "Planned",
      templateTitle: source.title,
      caption: customerCaption(source.content),
      draft: { ...source, id: `${source.id}-scheduled-${index}`, type: "Scheduled Post" },
    };
  });
}

export function buildWeeklyFeedGenerationPrompt(options: {
  weeklyPostCount: number;
  savedTemplates: SavedTemplate[];
  topic: string;
  productFocus?: string;
}) {
  const { weeklyPostCount, savedTemplates, topic, productFocus } = options;
  const templateBrief = savedTemplates
    .slice(0, 5)
    .map(
      (template, index) =>
        `${index + 1}. ${template.title} - ${template.purpose}. Reuse this layout purpose and only change the editable copy/image direction.`,
    )
    .join("\n");
  const direction = topic.trim() || "balanced weekly content mix";

  return `Create exactly ${weeklyPostCount} official weekly social posts using my saved templates. Cycle through the saved templates if needed. Do not create new template layouts. Give every post a different subject and angle, for example: problem, proof, education, behind the scenes, feature, objection, soft CTA. For each post return a short headline, short subline, final caption, and a concrete image direction for a matching realistic visual. Treat the weekly direction as broad context, not as the same topic for every post.

Saved templates:
${templateBrief}

Weekly direction: ${direction}
Product or offer context from Brand Data: ${productFocus || "main offer"}`;
}
