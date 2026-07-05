"use client";

import { MessageCircle, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { CreativeOsCard } from "../../_components/CreativeOsCard";
import {
  StatusBadge,
  taskStatusTone,
} from "../../_components/StatusBadge";
import {
  FinishedAdUploadField,
  Input,
  LibraryFileSelect,
} from "../../_components/FormFields";
import type { CreativeTask, ReviewItem, SourceCreative } from "../../types";
import {
  deliveryPreviewHelp,
  deliveryPreviewLabel,
  deliverySourceHelp,
  deliverySourceLabel,
  isReturningBrief,
  outputCountLabel,
  taskScheduleLabel,
} from "../../lib/tasks";
import { optionsText } from "../../lib/strategy";
import {
  SubmittedAdPreview,
  TimestampedFeedbackMarks,
} from "../shared/MediaPreview";

type UploadState = {
  status: "uploading" | "uploaded" | "error";
  message?: string;
};

type SourceOption = { value: string; label: string };

export type EditorTaskCardProps = {
  task: CreativeTask;
  productName: string;
  source?: SourceCreative;
  taskSources: SourceCreative[];
  sourceOptions: SourceOption[];
  taskSourceHref: string;
  taskSourceLabelText: string;
  expectedOutputs: number;
  submittedOutputs: number;
  remainingOutputs: number;
  draftSlots: number;
  revisionReview?: ReviewItem;
  deliveryDraft?: { previewUrl?: string; sourceUsedUrl?: string; adName?: string };
  suggestedAdName: (index?: number) => string;
  deliveryUploadState: Record<string, UploadState>;
  taskUploadInProgress: boolean;
  deliveryUploadKey: (taskId: string, index?: number) => string;
  deliveryDraftLines: (value: string, slots: number) => string[];
  onBrowseLibrary: () => void;
  onMarkDelivered: () => void;
  onOpenChat: () => void;
  onUploadFinishedAd: (file: File | undefined, index?: number) => void;
  onUploadFinishedAds: (files: File[], index?: number) => void;
  onUpdateDeliveryDraft: (
    field: "previewUrl" | "sourceUsedUrl" | "adName",
    value: string,
  ) => void;
  onUpdateDeliveryDraftLine: (
    field: "previewUrl" | "sourceUsedUrl" | "adName",
    index: number,
    value: string,
  ) => void;
  onRemoveDeliveryDraftLine: (index: number) => void;
  onAddDeliveryDraftLine: () => void;
};

export function EditorTaskCard(props: EditorTaskCardProps) {
  const {
    task,
    productName,
    source,
    taskSources,
    sourceOptions,
    taskSourceHref,
    taskSourceLabelText,
    expectedOutputs,
    submittedOutputs,
    remainingOutputs,
    draftSlots,
    revisionReview,
    deliveryDraft,
    suggestedAdName,
    deliveryUploadState,
    taskUploadInProgress,
    deliveryUploadKey,
    deliveryDraftLines,
    onBrowseLibrary,
    onMarkDelivered,
    onOpenChat,
    onUploadFinishedAd,
    onUploadFinishedAds,
    onUpdateDeliveryDraft,
    onUpdateDeliveryDraftLine,
    onRemoveDeliveryDraftLine,
    onAddDeliveryDraftLine,
  } = props;
  const returning = isReturningBrief(task);
  const multipleOutputs = returning || expectedOutputs > 1;

  return (
    <CreativeOsCard>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">
              {task.brief}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {taskScheduleLabel(task)} - {task.format} -{" "}
              {outputCountLabel(task)}
            </div>
          </div>
          <StatusBadge label={task.status} tone={taskStatusTone(task.status)} />
        </div>

        <div className="grid gap-2 text-sm text-muted-foreground">
          <div>
            <strong className="text-foreground">Product:</strong> {productName}
          </div>
          <div>
            <strong className="text-foreground">Library:</strong>{" "}
            {taskSourceLabelText}
          </div>
          <div className="whitespace-pre-line">
            <strong className="text-foreground">Angles:</strong>{" "}
            {optionsText(task.angles, task.angle)}
          </div>
          <div className="whitespace-pre-line">
            <strong className="text-foreground">Hooks:</strong>{" "}
            {optionsText(task.hooks, task.hook)}
          </div>
          {task.notes ? (
            <div className="whitespace-pre-line">
              <strong className="text-foreground">Instructions:</strong>{" "}
              {task.notes}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {taskSourceHref ? (
            <Button variant="secondary" size="sm" asChild>
              <a href={taskSourceHref} target="_blank" rel="noreferrer">
                Open Library
              </a>
            </Button>
          ) : null}
          {taskSources.length ? (
            <Button type="button" variant="outline" size="sm" onClick={onBrowseLibrary}>
              Browse in Library
            </Button>
          ) : null}
        </div>

        {taskSources.length ? (
          <CreativeOsCard className="ring-border/80">
            <CardContent className="space-y-3 p-3">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-foreground">Library</div>
                  <div className="mt-1 max-w-3xl text-xs font-medium leading-5 text-muted-foreground">
                    Open the assigned Library and pick the file you used.
                  </div>
                </div>
                <div className="text-xs font-semibold text-muted-foreground">
                  {taskSources.length} file
                  {taskSources.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <div
                    className="truncate text-sm font-semibold leading-5 text-foreground"
                    title={taskSourceLabelText}
                  >
                    {taskSourceLabelText}
                  </div>
                  <div className="mt-1 truncate text-xs font-semibold leading-5 text-muted-foreground">
                    {taskSources.length} Library file
                    {taskSources.length === 1 ? "" : "s"} assigned
                  </div>
                </div>
                {taskSourceHref ? (
                  <Button variant="secondary" size="sm" asChild>
                    <a href={taskSourceHref} target="_blank" rel="noreferrer">
                      Open Library
                    </a>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </CreativeOsCard>
        ) : null}

        {revisionReview ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertTitle className="text-xs font-bold uppercase tracking-wide text-amber-700">
              Revision requested
            </AlertTitle>
            <AlertDescription className="mt-2 whitespace-pre-line text-sm font-medium leading-6">
              {revisionReview.feedback ||
                "The owner requested changes. No feedback text was added."}
            </AlertDescription>
            <TimestampedFeedbackMarks feedback={revisionReview.feedback} />
          </Alert>
        ) : null}

        {task.status !== "delivered" ? (
          <div className="rounded-2xl border border-primary/15 bg-primary/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold uppercase tracking-wide text-primary">
                Submit work
              </div>
              {multipleOutputs ? (
                <div className="text-xs font-semibold text-primary">
                  {submittedOutputs}/{expectedOutputs} submitted
                  {returning ? " this week" : ""}
                </div>
              ) : null}
            </div>
            <div className="mt-3">
              {multipleOutputs ? (
                <div className="space-y-3">
                  {Array.from({ length: draftSlots }).map((_, index) => {
                    const previewLines = deliveryDraftLines(
                      deliveryDraft?.previewUrl || "",
                      draftSlots,
                    );
                    const sourceLines = deliveryDraftLines(
                      deliveryDraft?.sourceUsedUrl || "",
                      draftSlots,
                    );
                    const adNameLines = deliveryDraftLines(
                      deliveryDraft?.adName || "",
                      draftSlots,
                    );
                    return (
                      <CreativeOsCard
                        key={`${task.id}-delivery-${index}`}
                        className="bg-background ring-border/80"
                      >
                        <CardContent className="space-y-3 p-3">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <div className="text-xs font-bold uppercase tracking-wide text-primary">
                              Ad {submittedOutputs + index + 1}
                            </div>
                            {draftSlots > 1 ? (
                              <Button
                                type="button"
                                variant="destructive"
                                size="xs"
                                onClick={() => onRemoveDeliveryDraftLine(index)}
                              >
                                <Trash2 size={12} /> Remove
                              </Button>
                            ) : null}
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="md:col-span-2">
                              <Input
                                label="Ads Manager name"
                                value={adNameLines[index] || suggestedAdName(submittedOutputs + index + 1)}
                                onChange={(event) =>
                                  onUpdateDeliveryDraftLine(
                                    "adName",
                                    index,
                                    event.target.value,
                                  )
                                }
                              />
                              <div className="mt-1 text-xs font-medium text-muted-foreground">
                                Upload the file with this name; Creative OS uses it again in Launch.
                              </div>
                            </div>
                            <FinishedAdUploadField
                              label="Finished ad file"
                              value={previewLines[index] || ""}
                              uploadState={
                                deliveryUploadState[
                                  deliveryUploadKey(task.id, index)
                                ]
                              }
                              onUpload={(file) => onUploadFinishedAd(file, index)}
                              onUploadFiles={(files) =>
                                onUploadFinishedAds(files, index)
                              }
                              onClear={() =>
                                onUpdateDeliveryDraftLine(
                                  "previewUrl",
                                  index,
                                  "",
                                )
                              }
                              multiple
                              help={deliveryPreviewHelp(task)}
                            />
                            <LibraryFileSelect
                              label={deliverySourceLabel(task)}
                              value={
                                sourceLines[index] ||
                                sourceOptions[0]?.value ||
                                ""
                              }
                              options={sourceOptions}
                              onChange={(value) =>
                                onUpdateDeliveryDraftLine(
                                  "sourceUsedUrl",
                                  index,
                                  value,
                                )
                              }
                              help={deliverySourceHelp(task)}
                            />
                          </div>
                        </CardContent>
                      </CreativeOsCard>
                    );
                  })}
                  {draftSlots < remainingOutputs ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onAddDeliveryDraftLine}
                    >
                      Add another ad
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Input
                      label="Ads Manager name"
                      value={deliveryDraft?.adName || suggestedAdName(1)}
                      onChange={(event) =>
                        onUpdateDeliveryDraft("adName", event.target.value)
                      }
                    />
                    <div className="mt-1 text-xs font-medium text-muted-foreground">
                      Upload the file with this name; Creative OS uses it again in Launch.
                    </div>
                  </div>
                  <FinishedAdUploadField
                    label={deliveryPreviewLabel(task)}
                    value={deliveryDraft?.previewUrl || ""}
                    uploadState={
                      deliveryUploadState[deliveryUploadKey(task.id)]
                    }
                    onUpload={(file) => onUploadFinishedAd(file)}
                    onClear={() => onUpdateDeliveryDraft("previewUrl", "")}
                    help={deliveryPreviewHelp(task)}
                  />
                  <LibraryFileSelect
                    label={deliverySourceLabel(task)}
                    value={
                      deliveryDraft?.sourceUsedUrl ||
                      sourceOptions[0]?.value ||
                      ""
                    }
                    options={sourceOptions}
                    onChange={(value) =>
                      onUpdateDeliveryDraft("sourceUsedUrl", value)
                    }
                    help={deliverySourceHelp(task)}
                  />
                </div>
              )}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="rounded-xl"
            onClick={onMarkDelivered}
            disabled={task.status === "delivered" || taskUploadInProgress}
          >
            {taskUploadInProgress
              ? "Uploading..."
              : returning
                ? "Submit this week"
                : "Submit for review"}
          </Button>
          <Button type="button" variant="outline" className="rounded-xl" onClick={onOpenChat}>
            <MessageCircle size={15} /> Chat
          </Button>
        </div>
      </CardContent>
    </CreativeOsCard>
  );
}

export function EditorDeliveredCard({
  previewUrl,
  title,
  deliveredAt,
  status,
  feedback,
}: {
  previewUrl: string;
  title: string;
  deliveredAt: string;
  status: string;
  feedback?: string;
}) {
  const tone = status.toLowerCase().includes("revision")
    ? "revision"
    : status.toLowerCase() === "approved"
      ? "active"
      : "delivered";

  return (
    <CreativeOsCard>
      <CardContent className="space-y-3 p-4">
        <SubmittedAdPreview url={previewUrl} title={title} />
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">
          Delivered {deliveredAt}
        </div>
        <StatusBadge label={status || "delivered"} tone={tone} />
        {status === "revision requested" ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertTitle className="text-xs font-bold uppercase tracking-wide text-amber-700">
              Revision feedback
            </AlertTitle>
            <AlertDescription className="mt-1 whitespace-pre-line text-sm font-medium leading-6">
              {feedback ||
                "The owner requested changes. No feedback text was added."}
            </AlertDescription>
            <TimestampedFeedbackMarks feedback={feedback} />
          </Alert>
        ) : null}
      </CardContent>
    </CreativeOsCard>
  );
}
