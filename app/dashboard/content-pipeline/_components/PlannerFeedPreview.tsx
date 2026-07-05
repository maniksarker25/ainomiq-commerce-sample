"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScheduledPost, BrandProfile, ContentConfig } from "../_lib/types";
import { FinalFeedPostCard } from "./FinalFeedPostCard";

interface Props {
  open: boolean;
  posts: ScheduledPost[];
  config: ContentConfig | null;
  brandProfile: BrandProfile | null;
  onClose: () => void;
}

export function PlannerFeedPreview({ open, posts, config, brandProfile, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(92vh,900px)] w-[min(96vw,960px)] max-w-[min(96vw,960px)] flex-col gap-0 overflow-hidden rounded-[24px] border-blue-100 p-0 sm:max-w-[min(96vw,960px)]"
      >
        <DialogHeader className="border-b border-gray-100 px-6 py-5 text-left">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <DialogTitle className="text-xl font-black text-gray-950">Feed preview</DialogTitle>
            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider">
              {posts.length} posts
            </Badge>
          </div>
          <DialogDescription>Review final visuals and captions before manual posting.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, index) => (
              <article
                key={`feed-preview-${post.id}`}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50"
              >
                <div className="bg-white p-3">
                  <FinalFeedPostCard
                    post={post}
                    index={index}
                    config={config}
                    brandProfile={brandProfile}
                  />
                </div>
                <div className="space-y-2 border-t border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-gray-500">
                    <Badge variant="secondary" className="text-[10px] font-bold">
                      {post.platform}
                    </Badge>
                    <span>
                      {post.date} · {post.time}
                    </span>
                  </div>
                  <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-gray-800">
                    {post.caption}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="flex justify-end border-t border-gray-100 px-6 py-4">
          <Button type="button" onClick={onClose} className="rounded-xl bg-blue-600 font-semibold hover:bg-blue-700">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
