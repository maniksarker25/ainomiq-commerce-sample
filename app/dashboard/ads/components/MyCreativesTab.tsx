"use client";

import { CheckCircle2, Image as ImageIcon, Trash2 } from "lucide-react";
import type { DbRow, Overview } from "../types";
import { getCreativePreview, ratioClass } from "../lib/creative-preview";
import { EmptyState, MetricCard, Panel } from "./CoreUI";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MyCreativesTabProps = {
  overview: Overview | null;
  openActionCount: number;
  creatives: DbRow[];
  creativeSelectMode: boolean;
  selectedCreativeIds: Set<string>;
  pendingBulkDeleteCreatives: boolean;
  bulkCreativeDeleteError: string | null;
  bulkDeletingCreatives: boolean;
  pendingDeleteCreativeId: string | null;
  creativeDeleteError: string | null;
  deletingCreativeId: string | null;
  onToggleSelectMode: () => void;
  onSelectAllVisible: () => void;
  onStartBulkDelete: () => void;
  onCancelBulkDelete: () => void;
  onConfirmBulkDelete: () => void;
  onToggleCreativeSelection: (creativeId: string) => void;
  onOpenCreative: (creative: DbRow) => void;
  onStartDeleteCreative: (creativeId: string) => void;
  onCancelDeleteCreative: () => void;
  onConfirmDeleteCreative: (creativeId: string) => void;
};

export default function MyCreativesTab({
  overview,
  openActionCount,
  creatives,
  creativeSelectMode,
  selectedCreativeIds,
  pendingBulkDeleteCreatives,
  bulkCreativeDeleteError,
  bulkDeletingCreatives,
  pendingDeleteCreativeId,
  creativeDeleteError,
  deletingCreativeId,
  onToggleSelectMode,
  onSelectAllVisible,
  onStartBulkDelete,
  onCancelBulkDelete,
  onConfirmBulkDelete,
  onToggleCreativeSelection,
  onOpenCreative,
  onStartDeleteCreative,
  onCancelDeleteCreative,
  onConfirmDeleteCreative,
}: MyCreativesTabProps) {
  return (
    <Panel title="My Creatives">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard
          label="Generated creatives"
          value={overview?.counts?.ad_creatives || 0}
        />
        <MetricCard
          label="Library assets"
          value={overview?.counts?.creative_library_assets || 0}
        />
        <MetricCard label="Open actions" value={openActionCount} />
      </div>

      <Card className="mt-5 shadow-none">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">
                Bulk actions
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {selectedCreativeIds.size} selected
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={creativeSelectMode ? "default" : "outline"}
                size="sm"
                onClick={onToggleSelectMode}
              >
                {creativeSelectMode ? "Cancel selection" : "Select creatives"}
              </Button>
              {creativeSelectMode ? (
                <Button variant="outline" size="sm" onClick={onSelectAllVisible}>
                  Select all creatives
                </Button>
              ) : null}
              {creativeSelectMode && selectedCreativeIds.size > 0 ? (
                <Button variant="destructive" size="sm" onClick={onStartBulkDelete}>
                  <Trash2 className="size-3.5" />
                  Delete selected
                </Button>
              ) : null}
            </div>
          </div>

          {pendingBulkDeleteCreatives ? (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>
                <div className="font-medium">
                  Delete {selectedCreativeIds.size} selected creatives?
                </div>
                <p className="mt-1 text-xs">
                  This removes them from My Creatives and review lists.
                </p>
                {bulkCreativeDeleteError ? (
                  <p className="mt-2 text-xs">{bulkCreativeDeleteError}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={bulkDeletingCreatives}
                    onClick={onConfirmBulkDelete}
                  >
                    {bulkDeletingCreatives ? "Deleting…" : "Delete selected"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={bulkDeletingCreatives}
                    onClick={onCancelBulkDelete}
                  >
                    Cancel
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {creatives.map((creative) => {
          const preview = getCreativePreview(creative);
          const creativeId = String(creative.id || "");
          const isConfirmingDelete = pendingDeleteCreativeId === creativeId;

          return (
            <Card key={creativeId} className="gap-0 overflow-hidden py-0">
              <div className={cn("relative bg-muted/30", ratioClass(preview.ratio))}>
                <button
                  type="button"
                  aria-label={`Open creative ${preview.title}`}
                  onClick={() => onOpenCreative(creative)}
                  className="absolute inset-0 block size-full cursor-zoom-in overflow-hidden text-left transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {preview.imageUrl ? (
                    <img
                      src={preview.imageUrl}
                      alt={preview.title}
                      className="size-full bg-background object-contain"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-muted-foreground/40">
                      <ImageIcon className="size-7" />
                    </div>
                  )}
                </button>
                {creativeSelectMode ? (
                  <button
                    type="button"
                    aria-label={
                      selectedCreativeIds.has(creativeId)
                        ? "Deselect creative"
                        : "Select creative"
                    }
                    onClick={() => onToggleCreativeSelection(creativeId)}
                    className={cn(
                      "absolute left-2 top-2 z-10 flex size-8 items-center justify-center rounded-full shadow-sm ring-1 transition focus:outline-none focus:ring-2 focus:ring-primary/30",
                      selectedCreativeIds.has(creativeId)
                        ? "bg-primary text-primary-foreground ring-primary/30"
                        : "bg-background/95 text-muted-foreground ring-border hover:bg-primary/10 hover:text-primary",
                    )}
                  >
                    {selectedCreativeIds.has(creativeId) ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <span className="size-4 rounded border-2 border-current" />
                    )}
                  </button>
                ) : null}
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label="Delete creative"
                  onClick={() => onStartDeleteCreative(creativeId)}
                  className="absolute right-2 top-2 z-10 bg-background/95 hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <CardContent className="space-y-2 p-3">
                <div className="truncate text-sm font-semibold text-foreground">
                  {preview.title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {preview.source}
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {preview.productName ? (
                    <Badge variant="secondary">{preview.productName}</Badge>
                  ) : null}
                  {preview.personaName ? (
                    <Badge variant="outline">{preview.personaName}</Badge>
                  ) : null}
                </div>
                {isConfirmingDelete ? (
                  <Alert variant="destructive" className="mt-2 py-3">
                    <AlertDescription>
                      <div className="font-medium">Delete this creative?</div>
                      <p className="mt-1 text-xs">
                        This removes it from My Creatives and review lists.
                      </p>
                      {creativeDeleteError ? (
                        <p className="mt-2 text-xs">{creativeDeleteError}</p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deletingCreativeId === creativeId}
                          onClick={() => onConfirmDeleteCreative(creativeId)}
                        >
                          {deletingCreativeId === creativeId
                            ? "Deleting…"
                            : "Delete creative"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={deletingCreativeId === creativeId}
                          onClick={onCancelDeleteCreative}
                        >
                          Cancel
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!creatives.length ? (
        <EmptyState text="No generated creatives yet. Use Create ads to build the first package, then Logic Ads can analyze refresh needs here." />
      ) : null}
    </Panel>
  );
}
