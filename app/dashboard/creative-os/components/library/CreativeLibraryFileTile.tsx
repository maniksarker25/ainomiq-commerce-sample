"use client";

import { useState } from "react";
import {
  Archive,
  CheckCircle2,
  CircleHelp,
  Download,
  Link2,
  MoreVertical,
  Play,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { SourceCreative } from "../../types";
import { sourceLibraryUrl } from "../../lib/library-urls";
import { sourceStatusLabel } from "../../lib/sources";
import { CreativeLibraryVideoThumb } from "./CreativeLibraryVideoThumb";

function statusBadgeClass(statusLabel: string) {
  if (statusLabel === "Used") {
    return "bg-muted text-muted-foreground";
  }
  if (statusLabel === "In brief") {
    return "bg-primary/10 text-primary";
  }
  if (statusLabel === "Paused") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export function CreativeLibraryFileTile({
  source,
  onPreviewSource,
  onUpdateSourceStatus,
}: {
  source: SourceCreative;
  onPreviewSource: (id: string) => void;
  onUpdateSourceStatus?: (
    sourceId: string,
    nextStatus: "ready" | "do not use",
  ) => void;
}) {
  const sourceUrl = sourceLibraryUrl(source);
  const usageLabel = `${Math.min(source.derivativeCount, source.derivativeCap)}/${source.derivativeCap} uses`;
  const statusLabel = sourceStatusLabel(source);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const openFile = () => {
    if (sourceUrl) onPreviewSource(source.id);
    setMenuOpen(false);
  };
  const copyLibraryLink = () => {
    if (!sourceUrl) return;
    void navigator.clipboard?.writeText(sourceUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
    setMenuOpen(false);
  };
  const updateStatus = (nextStatus: "ready" | "do not use") => {
    onUpdateSourceStatus?.(source.id, nextStatus);
    setMenuOpen(false);
  };

  return (
    <div
      className={`group relative overflow-visible rounded-xl bg-muted/40 text-left transition-colors ${sourceUrl ? "hover:bg-primary/5" : "opacity-75"}`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          className={cn(
            "size-3 shrink-0 rounded-sm",
            source.type === "video" ? "bg-red-500" : "bg-primary",
          )}
        />
        <button
          type="button"
          onClick={openFile}
          disabled={!sourceUrl}
          className="flex-1 min-w-0 text-sm font-bold text-left truncate text-foreground disabled:cursor-not-allowed"
          title={source.name}
        >
          {source.name}
        </button>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={!sourceUrl}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`More actions for ${source.name}`}
              title="More actions"
            >
              <MoreVertical size={15} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" role="menu" className="w-56">
            <DropdownMenuItem role="menuitem" onClick={openFile}>
              <Play size={15} />
              Open preview
            </DropdownMenuItem>
            <DropdownMenuItem asChild role="menuitem">
              <a
                href={sourceUrl}
                download={source.name || `ainomiq-library-${source.id}`}
                onClick={() => setMenuOpen(false)}
              >
                <Download size={15} /> Download
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem role="menuitem" onClick={copyLibraryLink}>
              <Link2 size={15} />
              {copied ? "Copied link" : "Copy Library link"}
            </DropdownMenuItem>
            <DropdownMenuItem role="menuitem" onClick={openFile}>
              <CircleHelp size={15} />
              File information
            </DropdownMenuItem>
            {onUpdateSourceStatus ? (
              <>
                <DropdownMenuSeparator />
                {source.status === "do not use" ? (
                  <DropdownMenuItem
                    role="menuitem"
                    onClick={() => updateStatus("ready")}
                  >
                    <CheckCircle2 size={15} />
                    Mark ready
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    role="menuitem"
                    onClick={() => updateStatus("do not use")}
                  >
                    <Archive size={15} />
                    Mark do not use
                  </DropdownMenuItem>
                )}
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <button
        type="button"
        onClick={openFile}
        disabled={!sourceUrl}
        className="mx-2 mb-2 flex aspect-4/3 w-[calc(100%-1rem)] items-center justify-center overflow-hidden rounded-lg bg-background disabled:cursor-not-allowed"
        aria-label={`Preview Library file ${source.name}`}
      >
        {sourceUrl ? (
          source.type === "video" ? (
            <CreativeLibraryVideoThumb
              src={sourceUrl}
              poster={source.thumbnailUrl || ""}
              name={source.name}
            />
          ) : (
            <img
              src={source.thumbnailUrl || sourceUrl}
              alt=""
              className="object-contain w-auto h-full max-w-full"
            />
          )
        ) : (
          <div className="flex items-center justify-center h-full text-xs font-semibold text-muted-foreground">
            Reference only
          </div>
        )}
      </button>

      <div className="flex items-center justify-between px-3 pb-3 text-xs font-semibold text-muted-foreground">
        <span className="capitalize">{source.type}</span>
        <span className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn("px-2 py-0.5", statusBadgeClass(statusLabel))}
          >
            {statusLabel}
          </Badge>
          <span>{usageLabel}</span>
        </span>
      </div>
    </div>
  );
}
