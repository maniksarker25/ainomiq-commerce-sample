"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Calendar,
  ChevronDown,
  Eye,
  Trash2,
  Copy,
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  Send,
  ExternalLink,
} from "lucide-react";
import type {
  ScheduledPost,
  ScheduledPostStatus,
  ContentConfig,
  BrandProfile,
  PublishTarget,
} from "../_lib/types";
import { FinalFeedPostCard } from "./FinalFeedPostCard";

const PLATFORMS: PublishTarget[] = ["Instagram", "Facebook", "Instagram + Facebook"];

function StatusBadge({ status }: { status: ScheduledPostStatus }) {
  if (status === "Published") {
    return (
      <Badge className="bg-emerald-600 font-semibold hover:bg-emerald-600">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Published
      </Badge>
    );
  }
  if (status === "Failed") {
    return (
      <Badge variant="destructive" className="font-semibold">
        <AlertCircle className="mr-1 h-3 w-3" />
        Failed
      </Badge>
    );
  }
  if (status === "Publishing") {
    return (
      <Badge className="bg-blue-600 font-semibold hover:bg-blue-600">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        Publishing
      </Badge>
    );
  }
  if (status === "Ready") {
    return (
      <Badge className="bg-green-600 font-semibold hover:bg-green-600">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Ready
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="font-semibold">
      <Clock className="mr-1 h-3 w-3" />
      Planned
    </Badge>
  );
}

type Props = {
  scheduledPosts: ScheduledPost[];
  config: ContentConfig | null;
  brandProfile: BrandProfile | null;
  generating?: boolean;
  publishingEnabled?: boolean;
  updateScheduledPost: (id: string, patch: Partial<ScheduledPost>) => void;
  copyScheduledCaption: (post: ScheduledPost) => void;
  publishScheduledPostNow: (postId: string) => void;
  publishingPostId: string | null;
  onOpenPreviewFeed: () => void;
  clearScheduledPosts: () => void;
};

export function PlannerWeeklyBoard({
  scheduledPosts,
  config,
  brandProfile,
  generating = false,
  publishingEnabled = true,
  updateScheduledPost,
  copyScheduledCaption,
  publishScheduledPostNow,
  publishingPostId,
  onOpenPreviewFeed,
  clearScheduledPosts,
}: Props) {
  const readyCount = scheduledPosts.filter((p) => p.status === "Ready").length;
  const publishedCount = scheduledPosts.filter((p) => p.status === "Published").length;

  return (
    <Card className="min-w-0 overflow-hidden rounded-[24px] border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b border-gray-50 bg-slate-50/40 px-6 py-5">
        <div className="space-y-1">
          <CardTitle className="text-xl font-black text-gray-900">Weekly planner</CardTitle>
          <CardDescription>
            Edit schedule and captions. Ready posts publish automatically when posting is enabled.
          </CardDescription>
          {scheduledPosts.length > 0 ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="outline" className="font-semibold">
                {scheduledPosts.length} scheduled
              </Badge>
              <Badge className="border-green-100 bg-green-50 font-semibold text-green-700 hover:bg-green-50">
                {readyCount} ready
              </Badge>
              {publishedCount > 0 ? (
                <Badge className="border-emerald-100 bg-emerald-50 font-semibold text-emerald-700 hover:bg-emerald-50">
                  {publishedCount} published
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
        {scheduledPosts.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={onOpenPreviewFeed}
              className="rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700"
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Preview feed
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={clearScheduledPosts}
              disabled={generating}
              className="rounded-xl font-semibold"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="p-0">
        {scheduledPosts.length === 0 ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center p-10 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-gray-100 bg-white shadow-sm">
              <Calendar className="h-7 w-7 text-gray-300" />
            </div>
            <p className="text-lg font-bold text-gray-900">No week planned yet</p>
            <p className="mt-2 max-w-sm text-sm text-gray-500">
              Use Schedule week for a fast layout pass, or generate unique AI posts from saved templates.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[min(760px,70vh)]">
            <div className="space-y-3 p-4 md:p-6">
              {scheduledPosts.map((post, index) => {
                const isTerminal =
                  post.status === "Published" ||
                  post.status === "Publishing" ||
                  publishingPostId === post.id;
                const canToggleReady =
                  post.status === "Planned" || post.status === "Ready";
                const canPublishNow =
                  publishingEnabled &&
                  post.status === "Ready" &&
                  publishingPostId !== post.id;

                return (
                  <article
                    key={post.id}
                    className="rounded-2xl border border-blue-100/80 bg-white p-4 shadow-sm"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <Badge className="bg-blue-50 font-black uppercase tracking-wider text-blue-700 hover:bg-blue-50">
                        Day {index + 1}
                      </Badge>
                      <StatusBadge status={post.status} />
                    </div>

                    {post.status === "Failed" && post.lastError ? (
                      <p className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
                        {post.lastError}
                      </p>
                    ) : null}

                    {post.permalink ? (
                      <a
                        href={post.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                      >
                        View live post
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}

                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,200px)_minmax(0,240px)_1fr]">
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label
                            htmlFor={`date-${post.id}`}
                            className="text-xs font-bold uppercase tracking-wider text-gray-500"
                          >
                            Date
                          </Label>
                          <Input
                            id={`date-${post.id}`}
                            type="date"
                            value={post.date}
                            disabled={generating || isTerminal}
                            onChange={(e) => updateScheduledPost(post.id, { date: e.target.value })}
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label
                            htmlFor={`time-${post.id}`}
                            className="text-xs font-bold uppercase tracking-wider text-gray-500"
                          >
                            Time
                          </Label>
                          <Input
                            id={`time-${post.id}`}
                            type="time"
                            value={post.time}
                            disabled={generating || isTerminal}
                            onChange={(e) => updateScheduledPost(post.id, { time: e.target.value })}
                            className="rounded-xl"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                            Platform
                          </Label>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                disabled={generating || isTerminal}
                                className="w-full justify-between rounded-xl font-semibold"
                              >
                                <span className="truncate">{post.platform}</span>
                                <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="start"
                              className="w-[var(--radix-dropdown-menu-trigger-width)]"
                            >
                              {PLATFORMS.map((platform) => (
                                <DropdownMenuItem
                                  key={platform}
                                  onClick={() => updateScheduledPost(post.id, { platform })}
                                >
                                  {platform}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {canToggleReady ? (
                          <Button
                            type="button"
                            variant={post.status === "Ready" ? "outline" : "default"}
                            disabled={generating}
                            onClick={() =>
                              updateScheduledPost(post.id, {
                                status: post.status === "Ready" ? "Planned" : "Ready",
                              })
                            }
                            className={
                              post.status === "Ready"
                                ? "w-full rounded-xl font-semibold"
                                : "w-full rounded-xl bg-blue-600 font-semibold hover:bg-blue-700"
                            }
                          >
                            {post.status === "Ready" ? "Mark as planned" : "Mark ready"}
                          </Button>
                        ) : null}
                        {canPublishNow ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={generating}
                            onClick={() => publishScheduledPostNow(post.id)}
                            className="w-full rounded-xl border-blue-200 font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            <Send className="mr-1.5 h-3.5 w-3.5" />
                            Publish now
                          </Button>
                        ) : null}
                        {post.status === "Failed" ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={generating}
                            onClick={() =>
                              updateScheduledPost(post.id, {
                                status: "Ready",
                                lastError: null,
                              })
                            }
                            className="w-full rounded-xl font-semibold"
                          >
                            Retry (mark ready)
                          </Button>
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <Label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">
                          Post preview
                        </Label>
                        <FinalFeedPostCard
                          post={post}
                          index={index}
                          config={config}
                          brandProfile={brandProfile}
                        />
                      </div>

                      <div className="flex min-h-0 flex-col">
                        <Label
                          htmlFor={`caption-${post.id}`}
                          className="text-xs font-bold uppercase tracking-wider text-gray-500"
                        >
                          Caption
                        </Label>
                        <p className="mt-1 text-sm font-bold text-gray-950">{post.templateTitle}</p>
                        <Textarea
                          id={`caption-${post.id}`}
                          value={post.caption}
                          disabled={generating || post.status === "Published"}
                          onChange={(e) =>
                            updateScheduledPost(post.id, { caption: e.target.value })
                          }
                          rows={6}
                          className="mt-2 min-h-[140px] flex-1 resize-none rounded-xl"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={generating}
                          onClick={() => copyScheduledCaption(post)}
                          className="mt-3 w-fit rounded-xl border-blue-100 font-semibold text-blue-700 hover:bg-blue-50"
                        >
                          <Copy className="mr-1.5 h-3.5 w-3.5" />
                          Copy caption
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
