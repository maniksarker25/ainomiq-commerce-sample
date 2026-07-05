"use client";

import type { ChangeEventHandler, ReactNode } from "react";
import { CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input as ShadcnInput } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea as ShadcnTextarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Field } from "./Field";
import {
  defaultDueDate,
  dueDateOptionLabel,
  futureDueDateOptions,
  normalizeFutureDueDate,
} from "../lib/dates";

export function Input({
  label,
  value,
  onChange,
  placeholder = "",
  help = "",
  type = "text",
}: {
  label: string;
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  help?: string;
  type?: string;
}) {
  return (
    <Field label={label} help={help || undefined}>
      <ShadcnInput
        type={type}
        aria-label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-10 min-h-10 w-full min-w-0 rounded-lg"
      />
    </Field>
  );
}

export function Textarea({
  label,
  value,
  onChange,
  placeholder = "",
  muted = false,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  muted?: boolean;
  rows?: number;
}) {
  return (
    <Field label={label}>
      <ShadcnTextarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          "min-h-10 w-full min-w-0 rounded-lg",
          muted && "text-muted-foreground focus-visible:ring-primary/15",
        )}
      />
    </Field>
  );
}

export function FinishedAdUploadField({
  label,
  value,
  uploadState,
  onUpload,
  onUploadFiles,
  onClear,
  multiple = false,
  help = "",
}: {
  label: string;
  value: string;
  uploadState?: {
    status: "uploading" | "uploaded" | "error";
    message?: string;
  };
  onUpload: (file: File | undefined) => void;
  onUploadFiles?: (files: File[]) => void;
  onClear: () => void;
  multiple?: boolean;
  help?: string;
}) {
  const uploading = uploadState?.status === "uploading";
  const uploaded = Boolean(value);
  const hasError = uploadState?.status === "error";

  return (
    <Field label={label} help={help || undefined}>
      <Card
        className={cn(
          "shadow-none",
          hasError
            ? "border-destructive/30 bg-destructive/5"
            : uploaded
              ? "border-green-200 bg-green-50"
              : "border-border bg-card",
        )}
      >
        <CardContent className="p-3">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <label
              className={cn(
                "inline-flex min-w-0 cursor-pointer items-center gap-2 text-sm font-semibold",
                uploading
                  ? "text-muted-foreground"
                  : uploaded
                    ? "text-green-700 hover:text-green-800"
                    : "text-primary hover:text-primary/80",
              )}
            >
              {uploading ? (
                <Loader2 size={16} className="shrink-0 animate-spin" />
              ) : uploaded ? (
                <CheckCircle2 size={16} className="shrink-0" />
              ) : (
                <Upload size={16} className="shrink-0" />
              )}
              <span className="truncate">
                {uploading
                  ? "Uploading..."
                  : uploaded
                    ? "Uploaded to Ainomiq"
                    : multiple
                      ? "Upload finished ads"
                      : "Upload finished ad"}
              </span>
              <input
                type="file"
                accept="video/*,image/*"
                multiple={multiple}
                className="sr-only"
                disabled={uploading}
                onChange={(event) => {
                  const files = Array.from(event.currentTarget.files || []);
                  if (multiple && files.length > 1 && onUploadFiles) {
                    onUploadFiles(files);
                  } else {
                    onUpload(files[0]);
                  }
                  event.currentTarget.value = "";
                }}
              />
            </label>
            {uploaded ? (
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-green-700"
                  asChild
                >
                  <a href={value} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                  onClick={onClear}
                  aria-label={`Clear ${label}`}
                >
                  <X size={15} />
                </Button>
              </div>
            ) : null}
          </div>
          {uploadState?.message || !uploaded ? (
            <p
              className={cn(
                "mt-1 text-xs font-medium leading-4",
                hasError
                  ? "text-destructive"
                  : uploaded
                    ? "text-green-700"
                    : "text-muted-foreground",
              )}
            >
              {uploadState?.message ||
                (multiple
                  ? "Select one or multiple videos/images from your device."
                  : "Video or image from your device.")}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </Field>
  );
}

export function LibraryFileSelect({
  label,
  value,
  options,
  onChange,
  help = "",
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  help?: string;
}) {
  const selectedValue = options.some((option) => option.value === value)
    ? value
    : options[0]?.value || "";

  return (
    <Field label={label} help={help || undefined}>
      {options.length ? (
        <Select value={selectedValue} onValueChange={onChange}>
          <SelectTrigger className="min-h-12 w-full rounded-xl font-semibold">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Alert className="min-h-12 border-amber-200 bg-amber-50 text-amber-800">
          <AlertDescription className="font-semibold">
            No assigned Library files available.
          </AlertDescription>
        </Alert>
      )}
    </Field>
  );
}

export function DueDateSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const options = futureDueDateOptions();
  const selectedValue = options.includes(value) ? value : defaultDueDate();

  return (
    <Field label="Due date">
      <Select
        value={selectedValue}
        onValueChange={(next) => onChange(normalizeFutureDueDate(next))}
      >
        <SelectTrigger className="min-h-12 w-full rounded-xl font-semibold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {dueDateOptionLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function BriefFocusPanel({
  angles,
  hooks,
  context,
}: {
  angles: string[];
  hooks: string[];
  context: string[];
}) {
  const personas = context
    .filter((item) => /^target persona:/i.test(item))
    .map((item) => item.replace(/^target persona:\s*/i, "").trim())
    .filter(Boolean);
  const otherContext = context.filter(
    (item) => !/^target persona:/i.test(item),
  );
  const sections = [
    { label: "Persona", items: personas, empty: "Pick a persona" },
    { label: "Angles", items: angles, empty: "Magic Fill or add angles" },
    { label: "Hooks", items: hooks, empty: "Magic Fill or add hooks" },
    ...(otherContext.length
      ? [{ label: "Extra context", items: otherContext, empty: "" }]
      : []),
  ];
  const hasFocus = sections.some((section) => section.items.length);

  return (
    <Card className="min-w-0 overflow-hidden shadow-none ring-primary/10">
      <CardContent className="min-w-0 p-3 sm:p-4">
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-bold text-foreground">Brief focus</div>
          <div className="text-xs font-semibold text-muted-foreground">
            {hasFocus
              ? "This is what the editor will work from."
              : "Choose strategy below to shape the brief."}
          </div>
        </div>
        <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {sections.map((section) => (
            <Card
              key={section.label}
              className="min-w-0 overflow-hidden border-0 bg-background/80 shadow-none"
            >
              <CardContent className="min-w-0 p-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  {section.label}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {section.items.length ? (
                    <>
                      {section.items.slice(0, 6).map((item) => (
                        <span
                          key={`${section.label}-${item}`}
                          className="max-w-full truncate rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-semibold text-foreground"
                          title={item}
                        >
                          {item}
                        </span>
                      ))}
                      {section.items.length > 6 ? (
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">
                          +{section.items.length - 6} more
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-xs font-semibold text-muted-foreground">
                      {section.empty}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function GridList({
  title,
  subtitle,
  items,
  emptyText,
  layout = "cards",
}: {
  title: string;
  subtitle: string;
  items: ReactNode[];
  emptyText: string;
  layout?: "cards" | "wide" | "full";
}) {
  const gridClassName =
    layout === "full"
      ? "grid gap-3"
      : layout === "wide"
        ? "grid gap-3 xl:grid-cols-2"
        : "grid gap-3 md:grid-cols-2 xl:grid-cols-3";

  return (
    <div className="space-y-3">
      <div>
        <div className="text-base font-bold text-foreground">{title}</div>
        <div className="mt-0.5 text-sm leading-5 text-muted-foreground">
          {subtitle}
        </div>
      </div>
      {items.length ? (
        <div className={gridClassName}>{items}</div>
      ) : (
        <Card className="border-dashed shadow-none">
          <CardContent className="p-4 text-sm text-muted-foreground sm:p-5">
            {emptyText}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
