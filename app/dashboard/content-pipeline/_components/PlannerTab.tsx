"use client";

import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Calendar,
  RefreshCw,
  Wand2,
  Plus,
  Minus,
  Zap,
  Sparkles,
  LayoutTemplate,
  Info,
} from "lucide-react";
import {
  ScheduledPost,
  ContentConfig,
  BrandProfile,
  SavedTemplate,
  Draft,
} from "../_lib/types";
import { PlannerFeedPreview } from "./PlannerFeedPreview";
import { PlannerWeeklyBoard } from "./PlannerWeeklyBoard";
import { PlannerTemplateLibrary } from "./PlannerTemplateLibrary";

interface Props {
  weeklyPostCount: number;
  setWeeklyPostCount: React.Dispatch<React.SetStateAction<number>>;
  topic: string;
  setTopic: (val: string) => void;
  generateWeeklyDirection: () => void;
  generating: boolean;
  visibleDraftCount: number;
  savedTemplates: SavedTemplate[];
  generateFeedFromSavedTemplates: () => void;
  scheduleOneWeekFromTemplates: () => void;
  scheduledPosts: ScheduledPost[];
  updateScheduledPost: (id: string, patch: Partial<ScheduledPost>) => void;
  copyScheduledCaption: (post: ScheduledPost) => void;
  publishScheduledPostNow: (postId: string) => void;
  publishingPostId: string | null;
  clearScheduledPosts: () => void;
  onOpenPreviewFeed: () => void;
  previewFeedOpen: boolean;
  onClosePreviewFeed: () => void;
  openManualEditor: (draft: Draft, index: number) => void;
  onClearTemplateLibrary: () => void;
  onSeedDefaultTemplates?: () => void;
  config: ContentConfig | null;
  brandProfile: BrandProfile | null;
}

export function PlannerTab({
  weeklyPostCount,
  setWeeklyPostCount,
  topic,
  setTopic,
  generateWeeklyDirection,
  generating,
  visibleDraftCount,
  savedTemplates,
  generateFeedFromSavedTemplates,
  scheduleOneWeekFromTemplates,
  scheduledPosts,
  updateScheduledPost,
  copyScheduledCaption,
  publishScheduledPostNow,
  publishingPostId,
  clearScheduledPosts,
  onOpenPreviewFeed,
  previewFeedOpen,
  onClosePreviewFeed,
  openManualEditor,
  onClearTemplateLibrary,
  onSeedDefaultTemplates,
  config,
  brandProfile,
}: Props) {
  const canScheduleWeek = visibleDraftCount > 0 || savedTemplates.length > 0;
  const readyCount = useMemo(
    () => scheduledPosts.filter((p) => p.status === "Ready").length,
    [scheduledPosts],
  );
  const publishingEnabled = config?.publishing_enabled !== false;

  const clampCount = (value: number) => Math.max(1, Math.min(30, value));

  return (
    <TooltipProvider delayDuration={300}>
      <div className="pb-10 space-y-6">
        <div className="flex flex-wrap items-center gap-2 px-1">
          <Badge variant="outline" className="gap-1.5 px-3 py-1 font-semibold">
            <Calendar className="h-3.5 w-3.5 text-blue-600" />
            {scheduledPosts.length} scheduled
          </Badge>
          <Badge
            variant="outline"
            className="gap-1.5 px-3 py-1 font-semibold text-green-700"
          >
            {readyCount} ready
          </Badge>
          <Badge variant="outline" className="gap-1.5 px-3 py-1 font-semibold">
            <LayoutTemplate className="h-3.5 w-3.5 text-blue-600" />
            {savedTemplates.length} saved templates
          </Badge>
          {visibleDraftCount > 0 ? (
            <Badge variant="secondary" className="font-semibold">
              {visibleDraftCount} on-screen drafts
            </Badge>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(300px,360px)_1fr]">
          <aside>
            <Card className="overflow-hidden rounded-[24px] border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
              <CardHeader className="px-5 py-4 space-y-1 border-b border-gray-50 bg-slate-50/50">
                <CardTitle className="flex items-center gap-2 text-lg font-bold text-gray-900">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Plan your week
                </CardTitle>
                <CardDescription className="text-sm">
                  {publishingEnabled
                    ? "Mark posts Ready to auto-publish within about 1 minute of their scheduled time (Vercel cron)."
                    : "Planning only - enable Automate Posting in Settings to publish Ready posts on schedule."}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 space-y-5">
                <section className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-bold text-gray-900">
                      Quick schedule
                    </span>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        onClick={scheduleOneWeekFromTemplates}
                        disabled={!canScheduleWeek || generating}
                        className="w-full font-bold text-white bg-blue-600 h-11 rounded-xl hover:bg-blue-700"
                      >
                        Schedule week
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs text-xs">
                      Uses templates visible in Drafts first, then saved
                      library. No AI credits.
                    </TooltipContent>
                  </Tooltip>
                </section>

                <Separator />

                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-bold text-gray-900">
                      AI weekly posts
                    </span>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="planner-post-count"
                      className="text-xs font-bold tracking-wider text-gray-500 uppercase"
                    >
                      Posts per week
                    </Label>
                    <div className="flex items-center gap-2 p-2 border border-gray-100 rounded-xl bg-gray-50/80">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="rounded-lg h-9 w-9 shrink-0"
                        disabled={weeklyPostCount <= 1 || generating}
                        onClick={() =>
                          setWeeklyPostCount((c) => clampCount(c - 1))
                        }
                        aria-label="Decrease posts per week"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Input
                        id="planner-post-count"
                        type="number"
                        min={1}
                        max={30}
                        value={weeklyPostCount}
                        disabled={generating}
                        onChange={(e) =>
                          setWeeklyPostCount(
                            clampCount(Number(e.target.value) || 1),
                          )
                        }
                        className="h-9 border-0 bg-transparent text-center text-xl font-black shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="rounded-lg h-9 w-9 shrink-0"
                        disabled={weeklyPostCount >= 30 || generating}
                        onClick={() =>
                          setWeeklyPostCount((c) => clampCount(c + 1))
                        }
                        aria-label="Increase posts per week"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label
                        htmlFor="planner-topic"
                        className="text-xs font-bold tracking-wider text-gray-500 uppercase"
                      >
                        Weekly direction
                      </Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={generateWeeklyDirection}
                        disabled={generating}
                        className="px-2 text-xs font-bold text-blue-600 rounded-lg h-7 hover:bg-blue-50"
                      >
                        {generating ? (
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Wand2 className="w-3 h-3 mr-1" />
                        )}
                        Auto-fill
                      </Button>
                    </div>
                    <Textarea
                      id="planner-topic"
                      value={topic}
                      disabled={generating}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="Mix education, proof, features, and a soft CTA…"
                      rows={4}
                      className="text-sm resize-none rounded-xl"
                    />
                    <p className="flex items-start gap-1.5 text-xs text-gray-500">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Broad context only - each post still gets a unique angle.
                    </p>
                  </div>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        onClick={generateFeedFromSavedTemplates}
                        disabled={generating || savedTemplates.length === 0}
                        variant="outline"
                        className="w-full font-bold text-blue-700 border-blue-200 h-11 rounded-xl hover:bg-blue-50"
                      >
                        {generating ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Generating…
                          </>
                        ) : (
                          <>Generate {weeklyPostCount} unique posts</>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs text-xs">
                      Uses saved layouts plus brand context. Generates copy and
                      images (Nomi credits apply).
                    </TooltipContent>
                  </Tooltip>

                  {savedTemplates.length === 0 ? (
                    <div className="p-4 text-center border border-blue-100 rounded-xl bg-blue-50/50">
                      <p className="mb-3 text-xs font-semibold leading-normal text-blue-900">
                        Your saved template library is currently empty.
                      </p>
                      {onSeedDefaultTemplates && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={onSeedDefaultTemplates}
                          className="w-full text-xs font-bold text-blue-700 bg-white border-blue-200 rounded-lg shadow-sm hover:bg-blue-50 h-9"
                        >
                          Quick Seed Brand Templates
                        </Button>
                      )}
                    </div>
                  ) : null}
                </section>
              </CardContent>
            </Card>
          </aside>

          <PlannerWeeklyBoard
            scheduledPosts={scheduledPosts}
            config={config}
            brandProfile={brandProfile}
            generating={generating}
            updateScheduledPost={updateScheduledPost}
            copyScheduledCaption={copyScheduledCaption}
            publishScheduledPostNow={publishScheduledPostNow}
            publishingPostId={publishingPostId}
            publishingEnabled={publishingEnabled}
            onOpenPreviewFeed={onOpenPreviewFeed}
            clearScheduledPosts={clearScheduledPosts}
          />
        </div>

        <PlannerTemplateLibrary
          savedTemplates={savedTemplates}
          onClearTemplateLibrary={onClearTemplateLibrary}
          openManualEditor={openManualEditor}
        />
      </div>

      <PlannerFeedPreview
        open={previewFeedOpen}
        posts={scheduledPosts}
        config={config}
        brandProfile={brandProfile}
        onClose={onClosePreviewFeed}
      />
    </TooltipProvider>
  );
}
