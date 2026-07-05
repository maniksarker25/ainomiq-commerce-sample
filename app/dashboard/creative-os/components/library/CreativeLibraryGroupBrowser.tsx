"use client";

import { ChevronRight, FolderClosed, MoreVertical, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SourceCreative } from "../../types";
import { CreativeLibraryFileTile } from "./CreativeLibraryFileTile";

export function CreativeLibraryGroupBrowser({
  group,
  activeFolderKey,
  onOpenFolder,
  onPreviewSource,
  onDeleteGroup,
  onUpdateSourceStatus,
}: {
  group: {
    key: string;
    name: string;
    importUrl?: string;
    backendFolderUrl?: string;
    isLegacy: boolean;
    sources: SourceCreative[];
  };
  activeFolderKey: string;
  onOpenFolder: (key: string) => void;
  onPreviewSource: (id: string) => void;
  onDeleteGroup?: (sourceIds: string[], label: string) => void;
  onUpdateSourceStatus?: (
    sourceId: string,
    nextStatus: "ready" | "do not use",
  ) => void;
}) {
  const readyCount = group.sources.filter(
    (source) =>
      source.status === "available" &&
      source.derivativeCount < source.derivativeCap,
  ).length;
  const inBriefCount = group.sources.filter(
    (source) => source.status === "assigned",
  ).length;
  const usedCount = group.sources.filter(
    (source) =>
      source.status === "maxed out" ||
      source.derivativeCount >= source.derivativeCap,
  ).length;
  const sourceIds = group.sources.map((source) => source.id);
  const folderDisplayPathFor = (source: SourceCreative) => {
    const fullPath = (
      source.sourceFolderPath ||
      group.name ||
      "Unsorted"
    ).trim();
    return fullPath === group.name
      ? "Root"
      : fullPath.startsWith(`${group.name} / `)
        ? fullPath.slice(group.name.length + 3)
        : fullPath;
  };
  const topFolders = Array.from(
    group.sources
      .reduce((folders, source) => {
        const displayPath = folderDisplayPathFor(source);
        const topName =
          displayPath === "Root"
            ? "Root"
            : displayPath.split(" / ")[0]?.trim() || displayPath;
        const key = `${group.key}::top::${topName}`;
        const current = folders.get(key) || {
          key,
          name: topName,
          sources: [] as SourceCreative[],
        };
        current.sources.push(source);
        folders.set(key, current);
        return folders;
      }, new Map<string, { key: string; name: string; sources: SourceCreative[] }>())
      .values(),
  ).sort((a, b) => {
    if (a.name === "Root") return -1;
    if (b.name === "Root") return 1;
    return a.name.localeCompare(b.name);
  });
  const activeFolder = topFolders.find(
    (folder) => folder.key === activeFolderKey,
  );
  const folderSections = activeFolder
    ? Array.from(
        activeFolder.sources
          .reduce((sections, source) => {
            const displayPath = folderDisplayPathFor(source);
            const sectionName =
              activeFolder.name === "Root"
                ? "Root"
                : displayPath === activeFolder.name
                  ? "Root"
                  : displayPath.startsWith(`${activeFolder.name} / `)
                    ? displayPath.slice(activeFolder.name.length + 3)
                    : displayPath;
            const current = sections.get(sectionName) || {
              name: sectionName,
              count: 0,
            };
            current.count += 1;
            sections.set(sectionName, current);
            return sections;
          }, new Map<string, { name: string; count: number }>())
          .values(),
      ).sort((a, b) => {
        if (a.name === "Root") return -1;
        if (b.name === "Root") return 1;
        return a.name.localeCompare(b.name);
      })
    : [];

  return (
    <Card className="min-w-0 overflow-hidden py-0 shadow-none">
      <CardHeader className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-foreground">
            {group.name}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary">
              {group.sources.length} file{group.sources.length === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline">
              {topFolders.length} folder{topFolders.length === 1 ? "" : "s"}
            </Badge>
            {readyCount ? (
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                {readyCount} ready
              </Badge>
            ) : null}
            {inBriefCount ? (
              <Badge variant="default">{inBriefCount} in brief</Badge>
            ) : null}
            {usedCount ? (
              <Badge variant="secondary">{usedCount} used</Badge>
            ) : null}
          </div>
        </div>
        {onDeleteGroup ? (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => onDeleteGroup(sourceIds, group.name)}
            aria-label={`Delete ${group.name}`}
            title="Delete source group"
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 size={15} />
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="min-w-0 p-4">
        {activeFolder ? (
          <div className="min-w-0">
            <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 px-2"
                  onClick={() => onOpenFolder("")}
                >
                  Library
                </Button>
                <ChevronRight
                  size={15}
                  className="shrink-0 text-muted-foreground/50"
                />
                <span
                  className="min-w-0 truncate font-bold text-foreground"
                  title={activeFolder.name}
                >
                  {activeFolder.name}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {activeFolder.sources.length} file
                  {activeFolder.sources.length === 1 ? "" : "s"}
                </Badge>
                <Badge className="border-primary/15 bg-primary/10 text-primary">
                  {
                    activeFolder.sources.filter(
                      (source) => source.type === "video",
                    ).length
                  }{" "}
                  video
                </Badge>
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  {
                    activeFolder.sources.filter(
                      (source) => source.type === "image",
                    ).length
                  }{" "}
                  image
                </Badge>
              </div>
            </div>
            {folderSections.length > 1 ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {folderSections.map((section) => (
                  <Badge key={section.name} variant="outline">
                    {section.name} · {section.count}
                  </Badge>
                ))}
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {activeFolder.sources.map((source) => (
                <CreativeLibraryFileTile
                  key={source.id}
                  source={source}
                  onPreviewSource={onPreviewSource}
                  onUpdateSourceStatus={onUpdateSourceStatus}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="min-w-0">
            <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
              <div className="shrink-0 text-sm font-bold text-foreground">
                Folders
              </div>
              <div className="min-w-0 truncate text-right text-xs font-semibold text-muted-foreground">
                Grouped by product/style
              </div>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {topFolders.map((folder) => {
                const videoCount = folder.sources.filter(
                  (source) => source.type === "video",
                ).length;
                const imageCount = folder.sources.filter(
                  (source) => source.type === "image",
                ).length;
                return (
                  <button
                    key={folder.key}
                    type="button"
                    onClick={() => onOpenFolder(folder.key)}
                    className={cn(
                      "group flex min-w-0 max-w-full items-center justify-between gap-3 overflow-hidden rounded-xl bg-muted/60 px-4 py-3 text-left transition-colors hover:bg-primary/5",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
                      <FolderClosed
                        size={20}
                        className="shrink-0 text-muted-foreground group-hover:text-primary"
                      />
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div
                          className="truncate text-sm font-bold text-foreground"
                          title={folder.name}
                        >
                          {folder.name}
                        </div>
                        <div className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
                          {folder.sources.length} files · {videoCount} video ·{" "}
                          {imageCount} image
                        </div>
                      </div>
                    </div>
                    <MoreVertical
                      size={16}
                      className="shrink-0 text-muted-foreground/60"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
