"use client";

import { CheckCircle2, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CreativeTask, SourceCreative } from "../../types";
import { optionsText } from "../../lib/strategy";
import {
  outputCountLabel,
  taskScheduleLabel,
  taskSourceLabel,
} from "../../lib/tasks";

type PostedBriefCardProps = {
  task: CreativeTask;
  source?: SourceCreative;
  productName?: string;
  progress?: {
    requestedCount: number;
    submittedCount: number;
    approvedCount: number;
    notApprovedCount: number;
    openCount: number;
  };
  onEdit: () => void;
  onOpenChat: () => void;
  onClose: () => void;
  onDelete: () => void;
};

export function PostedBriefCard({
  task,
  source,
  productName,
  progress,
  onEdit,
  onOpenChat,
  onClose,
  onDelete,
}: PostedBriefCardProps) {
  const resolvedProgress = progress || {
    requestedCount: Math.max(1, Number(task.outputCount) || 1),
    submittedCount: 0,
    approvedCount: 0,
    notApprovedCount: 0,
    openCount: Math.max(1, Number(task.outputCount) || 1),
  };
  return (
    <Card className="w-full rounded-2xl shadow-none ring-primary/10">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {productName ? (
                  <Badge
                    variant="outline"
                    className="mb-1 max-w-full truncate"
                    title={productName}
                  >
                    {productName}
                  </Badge>
                ) : null}
                <h3
                  className="text-base font-semibold leading-snug text-foreground"
                  title={task.brief}
                >
                  {task.brief}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {task.assignee} · {taskScheduleLabel(task)}
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {task.status}
              </Badge>
            </div>
            <dl className="grid gap-x-6 gap-y-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
              <div className="min-w-0 sm:col-span-2 lg:col-span-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                  Progress
                </dt>
                <dd className="mt-2 grid gap-2 text-foreground sm:grid-cols-5">
                  {[
                    ["Requested", resolvedProgress.requestedCount],
                    ["Submitted", resolvedProgress.submittedCount],
                    ["Approved", resolvedProgress.approvedCount],
                    ["Not approved", resolvedProgress.notApprovedCount],
                    ["Open", resolvedProgress.openCount],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-border bg-muted/30 px-3 py-2"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {label}
                      </div>
                      <div className="mt-0.5 text-base font-semibold leading-none">
                        {value}
                      </div>
                    </div>
                  ))}
                </dd>
              </div>
              <div className="min-w-0 sm:col-span-2 lg:col-span-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                  Source
                </dt>
                <dd className="mt-0.5 text-foreground">
                  {taskSourceLabel(task, source)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                  Format
                </dt>
                <dd className="mt-0.5 text-foreground">{task.format}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                  {task.scheduleType === "returning"
                    ? "Outputs / week"
                    : "Outputs"}
                </dt>
                <dd className="mt-0.5 text-foreground">
                  {outputCountLabel(task)}
                </dd>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                  Angles
                </dt>
                <dd className="mt-0.5 line-clamp-2 whitespace-pre-line text-foreground">
                  {optionsText(task.angles, task.angle)}
                </dd>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                  Hooks
                </dt>
                <dd className="mt-0.5 line-clamp-2 whitespace-pre-line text-foreground">
                  {optionsText(task.hooks, task.hook)}
                </dd>
              </div>
              {task.notes ? (
                <div className="min-w-0 sm:col-span-2 lg:col-span-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
                    Instructions
                  </dt>
                  <dd className="mt-0.5 line-clamp-3 whitespace-pre-line text-foreground">
                    {task.notes}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:items-stretch">
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              <Pencil size={15} /> Edit
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onOpenChat}
            >
              <MessageCircle size={15} /> Chat
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              aria-label={`Close brief ${task.brief}`}
            >
              <CheckCircle2 size={15} /> Close brief
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onDelete}
              aria-label={`Delete ad brief ${task.brief}`}
            >
              <Trash2 size={15} /> Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
