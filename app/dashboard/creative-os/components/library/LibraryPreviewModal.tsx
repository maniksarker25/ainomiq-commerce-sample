"use client";

import { Archive, Download, FolderClosed, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { SourceCreative } from "../../types";
import { sourceLibraryUrl } from "../../lib/library-urls";
import {
  sourceGroupName,
  sourceStatusLabel,
  sourceStorageLabel,
} from "../../lib/sources";

function enableVideoAudio(video: HTMLVideoElement | null) {
  if (!video) return;
  video.defaultMuted = false;
  video.muted = false;
  video.volume = 1;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold text-foreground">{value}</div>
    </div>
  );
}

export function LibraryPreviewModal({
  source,
  onClose,
}: {
  source: SourceCreative;
  onClose: () => void;
}) {
  const previewUrl = sourceLibraryUrl(source);
  const folderPath = source.sourceFolderPath || sourceGroupName(source);
  const downloadName = source.name || `ainomiq-library-${source.id}`;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        showCloseButton
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden p-0 sm:max-w-5xl"
      >
        <DialogHeader className="gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {source.type === "video" ? (
                <Play size={16} />
              ) : (
                <Archive size={16} />
              )}
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate" title={source.name}>
                {source.name}
              </DialogTitle>
              <DialogDescription className="truncate" title={folderPath}>
                {folderPath}
              </DialogDescription>
            </div>
          </div>
          {previewUrl ? (
            <Button variant="secondary" size="sm" asChild className="shrink-0">
              <a
                href={previewUrl}
                download={downloadName}
                aria-label={`Download ${source.name}`}
                title="Download Library file"
              >
                <Download size={15} />
                <span>Download</span>
              </a>
            </Button>
          ) : null}
        </DialogHeader>

        <div className="grid min-h-0 flex-1 bg-muted/30 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex min-h-[360px] min-w-0 items-center justify-center overflow-auto p-4">
            {previewUrl ? (
              source.type === "video" ? (
                <video
                  key={previewUrl}
                  src={previewUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="h-auto max-h-[72vh] w-auto max-w-full rounded-xl bg-transparent"
                  ref={enableVideoAudio}
                  onLoadedMetadata={(event) =>
                    enableVideoAudio(event.currentTarget)
                  }
                  onPlay={(event) => enableVideoAudio(event.currentTarget)}
                />
              ) : (
                <img
                  src={previewUrl}
                  alt={source.name}
                  className="h-auto max-h-[72vh] w-auto max-w-full rounded-xl object-contain"
                />
              )
            ) : (
              <div className="rounded-xl border border-dashed p-8 text-center text-sm font-semibold text-muted-foreground">
                This source is only saved as a reference. Import it to the
                Ainomiq Library before previewing.
              </div>
            )}
          </div>

          <div className="border-t bg-card p-4 lg:border-l lg:border-t-0">
            <Badge variant="outline" className="mb-3">
              Library file
            </Badge>
            <div className="space-y-4 text-sm">
              <InfoRow label="Type" value={source.type} />
              <InfoRow label="Storage" value={sourceStorageLabel(source)} />
              <InfoRow label="Status" value={sourceStatusLabel(source)} />
              <InfoRow
                label="Usage"
                value={`${Math.min(source.derivativeCount, source.derivativeCap)}/${source.derivativeCap} approved uses`}
              />
              <Separator />
              <InfoRow label="Path" value={folderPath} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
