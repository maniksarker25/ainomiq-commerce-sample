"use client";

import React from "react";
import { ScheduledPost, BrandProfile, ContentConfig } from "../_lib/types";
import { VisualTemplateCard } from "./VisualTemplateCard";
import { ScaledTemplatePreview } from "./ScaledTemplatePreview";

interface Props {
  post: ScheduledPost;
  index: number;
  config?: ContentConfig | null;
  brandProfile?: BrandProfile | null;
}

export function FinalFeedPostCard({ post, index, config, brandProfile }: Props) {
  return (
    <ScaledTemplatePreview className="rounded-xl border border-gray-100">
      <VisualTemplateCard
        draft={post.draft}
        index={index}
        config={config}
        brandProfile={brandProfile}
        final
      />
    </ScaledTemplatePreview>
  );
}
