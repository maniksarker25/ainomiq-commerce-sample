"use client";

import { CheckCircle2, Loader2, Plus, RefreshCcw, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GridList } from "../../_components/FormFields";
import { sourceUsedUrlList } from "../../lib/tasks";
import { isReturningBrief, taskSourceLabel } from "../../lib/tasks";
import { TimestampedReviewPreview } from "../shared/MediaPreview";
import { SectionTitle } from "../shared/SectionTitle";
import type { ReviewTabProps } from "@/app/dashboard/creative-os/components/tabs/types";

const REVIEW_ENHANCEMENTS = [
  "Stronger hook in first 2 seconds",
  "Show product/fit closer",
  "Improve text or captions",
  "Tighter pacing and cuts",
  "Cleaner audio or music",
  "Stronger CTA/end frame",
];

function appendFeedbackLine(current: string, line: string) {
  return [current.trim(), line].filter(Boolean).join("\n");
}

export function ReviewTab(props: ReviewTabProps) {
  const {
    sectionRefs,
    state,
    readyAdRows,
    readyAdError,
    reviewActionError,
    workspaceReviews,
    workspaceEdits,
    productNameById,
    revisionSendStatus,
    hiddenRevisionReviewIds,
    updateReadyAdRow,
    addReadyAdRow,
    removeReadyAdRow,
    addReadyAdsToReview,
    updateReviewFeedback,
    approveReview,
    requestRevision,
    rejectReview,
  } = props;
  const readyReviews = workspaceReviews.filter(
    (review) =>
      review.status === "ready" &&
      !hiddenRevisionReviewIds.includes(review.id) &&
      !["sending", "sent"].includes(revisionSendStatus[review.id] || ""),
  );

  return (
    <div
      ref={(el) => {
        sectionRefs.current.review = el;
      }}
      className="space-y-5"
    >
      <Card className="rounded-2xl shadow-none ring-primary/10">
        <CardContent className="space-y-4 p-5">
          <SectionTitle
            title="Add ready ads"
            subtitle="Already have finished ad files or links? Add them here. Product photos and source material stay in Sources."
          />
          <div className="space-y-2">
            {readyAdRows.map((row, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={row}
                  onChange={(event) =>
                    updateReadyAdRow(index, event.target.value)
                  }
                  placeholder={
                    index === 0
                      ? "Line 1 - paste ready ad link"
                      : `Line ${index + 1} - paste another ready ad link`
                  }
                  className="h-9 flex-1"
                />
                {readyAdRows.length > 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeReadyAdRow(index)}
                    aria-label="Remove ready ad row"
                  >
                    <Trash2 size={15} />
                  </Button>
                ) : null}
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={addReadyAdRow}>
              <Plus size={15} />
              Add line
            </Button>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              These links go straight to Review Ads for approval. They are not
              used as source material.
            </p>
            <Button
              type="button"
              onClick={addReadyAdsToReview}
              disabled={!readyAdRows.some((row) => row.trim())}
            >
              Add to review
            </Button>
          </div>
          {readyAdError ? (
            <Alert variant="destructive">
              <AlertDescription>{readyAdError}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {reviewActionError ? (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertDescription>{reviewActionError}</AlertDescription>
        </Alert>
      ) : null}

      <GridList
        title="Review Ads"
        subtitle="Finished ads for approval. Approving consumes source usage; Library sources move when they hit their cap."
        emptyText="No ads to review yet. Add ready ad links above or create a brief in Post Briefs."
        layout="full"
        items={readyReviews.map((review) => {
          const edit = workspaceEdits.find(
            (item) => item.id === review.deliveredEditId,
          );
          const source = state.sources.find(
            (item) => item.id === review.sourceCreativeId,
          );
          const task = edit
            ? state.tasks.find((item) => item.id === edit.taskId)
            : null;
          const returning = task ? isReturningBrief(task) : false;
          const submittedUrl = edit?.previewUrl || "";
          const revisionStatus = revisionSendStatus[review.id];
          const usedSourceUrls = sourceUsedUrlList(review).length
            ? sourceUsedUrlList(review)
            : sourceUsedUrlList(edit);

          return (
            <Card key={review.id} className="rounded-2xl shadow-none ring-primary/10">
              <CardContent className="p-4">
                <div className="grid gap-5 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)] lg:items-start">
                  <TimestampedReviewPreview
                    url={submittedUrl}
                    title={review.adName || review.briefSummary}
                    feedback={review.feedback}
                    onFeedbackChange={(value) =>
                      updateReviewFeedback(review.id, value)
                    }
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-foreground">
                          {review.angle ||
                            review.briefSummary ||
                            "Submitted ad"}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-muted-foreground">
                          {review.editor}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-primary">
                          {productNameById.get(review.productId) || "Product"}
                        </div>
                      </div>
                      <Badge variant="secondary">ready for review</Badge>
                    </div>
                    {review.hook ? (
                      <div className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-sm font-medium text-foreground">
                        {review.hook}
                      </div>
                    ) : null}
                    {review.briefSummary ? (
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {review.briefSummary}
                      </p>
                    ) : null}
                    {review.adName ? (
                      <div className="mt-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
                        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Ads Manager name
                        </div>
                        <div className="mt-1 break-words text-sm font-semibold text-foreground">
                          {review.adName}
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
                        <div className="font-bold text-foreground">Library</div>
                        <div className="mt-1">
                          {task
                            ? taskSourceLabel(task, source)
                            : source?.name || "Ready ad link"}
                        </div>
                        {usedSourceUrls.length ? (
                          <div className="mt-1 flex flex-col gap-1">
                            {usedSourceUrls.map((url, index) => (
                              <a
                                key={`${review.id}-source-${index}`}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex font-semibold text-primary hover:text-primary/80"
                              >
                                {usedSourceUrls.length > 1
                                  ? `Open Library file ${index + 1}`
                                  : returning
                                    ? "Open Library files used"
                                    : "Open Library file used"}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-1 font-semibold text-amber-700">
                            {returning
                              ? "No Library files selected"
                              : "No Library file selected"}
                          </div>
                        )}
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
                        <div className="font-bold text-foreground">Usage</div>
                        <div className="mt-1">
                          {source
                            ? `${source.derivativeCount}/${source.derivativeCap} approved from this source`
                            : "No source cap attached"}
                        </div>
                        <div className="mt-1 text-muted-foreground">
                          Approval will count this delivery.
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 rounded-xl border border-border/70 bg-background p-3">
                      <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Enhancements
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {REVIEW_ENHANCEMENTS.map((enhancement) => (
                          <Button
                            key={enhancement}
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              updateReviewFeedback(
                                review.id,
                                appendFeedbackLine(
                                  review.feedback,
                                  `Enhancement: ${enhancement}`,
                                ),
                              )
                            }
                          >
                            {enhancement}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <Textarea
                      aria-label="Review feedback"
                      placeholder="Feedback for the editor, optional"
                      value={review.feedback}
                      onChange={(event) =>
                        updateReviewFeedback(review.id, event.target.value)
                      }
                      className="mt-3 min-h-24"
                      rows={3}
                    />
                    {revisionStatus === "sent" ? (
                      <Alert className="mt-2 border-emerald-200 bg-emerald-50 text-emerald-800">
                        <AlertDescription className="text-xs font-semibold">
                          Feedback sent to editor and added to chat.
                        </AlertDescription>
                      </Alert>
                    ) : revisionStatus === "error" ? (
                      <Alert variant="destructive" className="mt-2">
                        <AlertDescription className="text-xs font-semibold">
                          Feedback was not sent. Try again.
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => approveReview(review.id)}
                      >
                        <CheckCircle2 size={14} />
                        Approve
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => requestRevision(review.id)}
                        disabled={revisionStatus === "sending"}
                      >
                        {revisionStatus === "sending" ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <RefreshCcw size={14} />
                        )}
                        {revisionStatus === "sending"
                          ? "Sending feedback..."
                          : revisionStatus === "sent"
                            ? "Feedback sent"
                            : "Send revision feedback"}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => rejectReview(review.id)}
                      >
                        <Trash2 size={14} />
                        Delete delivery
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      />
    </div>
  );
}
