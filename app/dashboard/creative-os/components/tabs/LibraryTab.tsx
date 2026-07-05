"use client";

import { Archive, Link2, Plus, Trash2, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CreativeLibraryGroupBrowser } from "../library/CreativeLibraryGroupBrowser";
import { SectionTitle } from "../shared/SectionTitle";
import type { LibraryTabProps } from "./types";

export function LibraryTab(props: LibraryTabProps) {
  const {
    sectionRefs,
    productSources,
    productSourceGroups,
    sourceLinkRows,
    sourceLinkError,
    sourceLinkStatus,
    sourceLinkValues,
    activeLibraryFolderKey,
    updateSourceLinkRow,
    addSourceLinkRow,
    removeSourceLinkRow,
    addSourceLinks,
    importDriveLinksToLibrary,
    uploadSourceFiles,
    setActiveLibraryFolderKey,
    setLibraryPreviewSourceId,
    deleteSourceGroup,
    updateLibrarySourceStatus,
  } = props;

  const isSaving = sourceLinkStatus.startsWith("Saving");
  const isImporting = sourceLinkStatus.startsWith("Importing");

  return (
    <div
      ref={(el) => {
        sectionRefs.current.sources = el;
      }}
      className="mt-4 min-w-0 space-y-5"
    >
      <Card className="rounded-2xl shadow-none ring-primary/10">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Archive size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Connect source material for new ads
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload files or import a Drive folder into the Ainomiq Library.
              </p>
            </div>
          </div>

          <Card className="gap-4 py-4 shadow-none">
            <CardContent className="space-y-4 px-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Link2 size={16} className="text-primary" />
                  Add sources
                </div>
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  Files are stored in Ainomiq. Links are saved as references
                  unless you import them.
                </p>
              </div>

              <label
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-primary/20 bg-primary/5 px-4 py-5 text-center transition-colors hover:bg-primary/10",
                )}
              >
                <Upload size={18} className="text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  Upload files to Ainomiq Library
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  Images and videos are stored in Ainomiq storage for this
                  product.
                </span>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  className="sr-only"
                  onChange={(event) => {
                    void uploadSourceFiles(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>

              <div className="space-y-2">
                {sourceLinkRows.map((row, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={row}
                      onChange={(event) =>
                        updateSourceLinkRow(index, event.target.value)
                      }
                      placeholder={
                        index === 0
                          ? "Paste a Drive folder or source link"
                          : `Line ${index + 1} - paste another link`
                      }
                      className="h-9 flex-1"
                    />
                    {sourceLinkRows.length > 1 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeSourceLinkRow(index)}
                        aria-label="Remove source link row"
                      >
                        <Trash2 size={15} />
                      </Button>
                    ) : null}
                  </div>
                ))}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={addSourceLinkRow}
                  >
                    <Plus size={15} />
                    Add line
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={addSourceLinks}
                    disabled={!sourceLinkValues.length || isSaving}
                  >
                    <Archive size={15} />
                    {isSaving ? "Saving..." : "Save references"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void importDriveLinksToLibrary()}
                    disabled={!sourceLinkValues.length || isImporting}
                  >
                    <Upload size={15} />
                    {isImporting ? "Importing..." : "Import Drive to Library"}
                  </Button>
                </div>
              </div>

              {sourceLinkStatus ? (
                <Alert className="border-primary/15 bg-primary/5">
                  <AlertDescription className="text-foreground">
                    {sourceLinkStatus}
                  </AlertDescription>
                </Alert>
              ) : null}

              {sourceLinkError ? (
                <Alert variant="destructive">
                  <AlertDescription>{sourceLinkError}</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <SectionTitle
            title="Ainomiq Library"
            subtitle="Open a folder, preview the file, then use it in briefs."
          />
          <Badge variant="secondary" className="w-fit px-3 py-1">
            {productSources.length} sources
          </Badge>
        </div>

        {productSources.length ? (
          <div className="min-w-0 space-y-2">
            {productSourceGroups.map((group) => (
              <CreativeLibraryGroupBrowser
                key={group.key}
                group={group}
                activeFolderKey={activeLibraryFolderKey}
                onOpenFolder={setActiveLibraryFolderKey}
                onPreviewSource={setLibraryPreviewSourceId}
                onDeleteGroup={deleteSourceGroup}
                onUpdateSourceStatus={updateLibrarySourceStatus}
              />
            ))}
          </div>
        ) : (
          <Alert className="border-dashed">
            <AlertDescription>
              No Library sources saved yet. Add source file or source-set links
              to save them in the Ainomiq Library.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
