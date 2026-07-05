"use client";

import { CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DueDateSelect, Input, Textarea } from "../../_components/FormFields";
import {
  CREATIVE_FORMAT_OPTIONS,
  type BriefEditDraft,
  type CreativeTask,
  type ProductPermission,
  type SourceCreative,
} from "../../types";
import { editorAssigneeValue } from "../../lib/products";
import { sourceGroupValue, sourceStatusLabel } from "../../lib/sources";
import { normalizeFutureDueDate, WEEKDAY_OPTIONS } from "../../lib/dates";

type ProductTaskSelectionGroup = {
  key: string;
  name: string;
  sources: SourceCreative[];
};

type BriefEditDialogProps = {
  open: boolean;
  task: CreativeTask | null;
  editDraft: BriefEditDraft | null;
  activeEditors: ProductPermission[];
  productTaskSelectionGroups: ProductTaskSelectionGroup[];
  productTaskSources: SourceCreative[];
  sourceDraftOptionExists: (value: string) => boolean;
  sourceLabelByDraftValue: (value: string) => string;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
  onUpdateDraft: (patch: Partial<BriefEditDraft>) => void;
  taskError?: string;
};

export function BriefEditDialog({
  open,
  task,
  editDraft,
  activeEditors,
  productTaskSelectionGroups,
  productTaskSources,
  sourceDraftOptionExists,
  sourceLabelByDraftValue,
  onOpenChange,
  onSave,
  onCancel,
  onUpdateDraft,
  taskError = "",
}: BriefEditDialogProps) {
  if (!open || !task || !editDraft) return null;
  const resolvedTask = task;
  const resolvedDraft = editDraft;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[min(90vh,880px)] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        showCloseButton
      >
        <DialogHeader className="px-5 py-4 pr-12 border-b border-border/60">
          <DialogTitle>Edit brief</DialogTitle>
          <DialogDescription>
            Update the editor, source material, and production instructions for{" "}
            <span className="font-semibold text-foreground">
              {resolvedTask.brief}
            </span>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 px-5 py-4 overflow-y-auto">
          {taskError ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{taskError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Brief name"
              value={resolvedDraft.brief}
              onChange={(event) => onUpdateDraft({ brief: event.target.value })}
            />
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                Assign to editor
              </Label>
              <Select
                value={resolvedDraft.assignee}
                onValueChange={(value) => onUpdateDraft({ assignee: value })}
              >
                <SelectTrigger className="w-full min-h-12">
                  <SelectValue placeholder="Assign editor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Unassigned">Unassigned</SelectItem>
                  {activeEditors.map((permission) => {
                    const value = editorAssigneeValue(permission);
                    return (
                      <SelectItem key={permission.id} value={value}>
                        {permission.email || permission.userName} -{" "}
                        {permission.role}
                      </SelectItem>
                    );
                  })}
                  {!activeEditors.some(
                    (permission) =>
                      editorAssigneeValue(permission) === resolvedDraft.assignee,
                  ) && resolvedDraft.assignee !== "Unassigned" ? (
                    <SelectItem value={resolvedDraft.assignee}>
                      {resolvedDraft.assignee}
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                Source material
              </Label>
              <Select
                value={resolvedDraft.sourceCreativeId}
                onValueChange={(value) =>
                  onUpdateDraft({ sourceCreativeId: value })
                }
              >
                <SelectTrigger className="w-full min-h-12">
                  <SelectValue placeholder="Select source material" />
                </SelectTrigger>
                <SelectContent>
                  {productTaskSelectionGroups.map((group) => (
                    <SelectItem
                      key={group.key}
                      value={sourceGroupValue(group.key)}
                    >
                      {group.name} - {group.sources.length} editable files
                    </SelectItem>
                  ))}
                  {productTaskSources.map((sourceItem) => (
                    <SelectItem key={sourceItem.id} value={sourceItem.id}>
                      {sourceItem.name} - single file -{" "}
                      {sourceStatusLabel(sourceItem)} -{" "}
                      {sourceItem.derivativeCount}/{sourceItem.derivativeCap}{" "}
                      approved
                    </SelectItem>
                  ))}
                  {!sourceDraftOptionExists(resolvedDraft.sourceCreativeId) ? (
                    <SelectItem value={resolvedDraft.sourceCreativeId}>
                      {sourceLabelByDraftValue(resolvedDraft.sourceCreativeId)} -
                      current source
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
              <p className="text-xs font-semibold text-muted-foreground">
                Used sources stay visible only if they are already attached to
                this brief. New assignments must use Ready source material.
              </p>
            </div>
            <Textarea
              label="Angles"
              value={resolvedDraft.angles}
              onChange={(event) =>
                onUpdateDraft({ angles: event.target.value })
              }
            />
            <Textarea
              label="Hooks"
              value={resolvedDraft.hooks}
              onChange={(event) => onUpdateDraft({ hooks: event.target.value })}
            />
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                Format
              </Label>
              <Select
                value={resolvedDraft.format}
                onValueChange={(value) => onUpdateDraft({ format: value })}
              >
                <SelectTrigger className="w-full min-h-12">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {CREATIVE_FORMAT_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              label={
                resolvedDraft.scheduleType === "returning"
                  ? "Outputs per week"
                  : "Output count"
              }
              value={resolvedDraft.outputCount}
              onChange={(event) =>
                onUpdateDraft({ outputCount: event.target.value })
              }
            />
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                Schedule
              </Label>
              <Select
                value={resolvedDraft.scheduleType}
                onValueChange={(value) => {
                  const scheduleType = value as "one-time" | "returning";
                  onUpdateDraft({
                    scheduleType,
                    dueDate:
                      scheduleType === "one-time"
                        ? normalizeFutureDueDate(resolvedDraft.dueDate)
                        : resolvedDraft.dueDate,
                  });
                }}
              >
                <SelectTrigger className="w-full min-h-12">
                  <SelectValue placeholder="Select schedule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one-time">One-time brief</SelectItem>
                  <SelectItem value="returning">Returning brief</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {resolvedDraft.scheduleType === "returning" ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                  Delivery day
                </Label>
                <Select
                  value={resolvedDraft.recurrenceDay}
                  onValueChange={(value) =>
                    onUpdateDraft({ recurrenceDay: value })
                  }
                >
                  <SelectTrigger className="w-full min-h-12">
                    <SelectValue placeholder="Select delivery day" />
                  </SelectTrigger>
                  <SelectContent>
                    {WEEKDAY_OPTIONS.map((day) => (
                      <SelectItem key={day.value} value={day.value}>
                        Every {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <DueDateSelect
                value={resolvedDraft.dueDate}
                onChange={(value) => onUpdateDraft({ dueDate: value })}
              />
            )}
            <div className="md:col-span-2">
              <Textarea
                label="Instructions"
                value={resolvedDraft.notes}
                onChange={(event) =>
                  onUpdateDraft({ notes: event.target.value })
                }
                rows={5}
              />
            </div>
          </div>
        </div>
        <DialogFooter className="px-8 pb-8 border-t border-border/60 bg-muted/30">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave}>
            <CheckCircle2 size={14} /> Save brief
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
