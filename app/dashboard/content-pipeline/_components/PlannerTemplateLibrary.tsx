"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Draft, SavedTemplate } from "../_lib/types";
import { VisualTemplateCard } from "./VisualTemplateCard";
import { ScaledTemplatePreview } from "./ScaledTemplatePreview";
import { draftFromSavedTemplate } from "../_lib/planner";
import { LayoutTemplate, Pencil } from "lucide-react";

type Props = {
  savedTemplates: SavedTemplate[];
  onClearTemplateLibrary: () => void;
  openManualEditor: (draft: Draft, index: number) => void;
};

export function PlannerTemplateLibrary({ savedTemplates, onClearTemplateLibrary, openManualEditor }: Props) {
  return (
    <Card className="rounded-[24px] border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 border-b border-gray-50 px-6 py-5">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-xl font-black text-gray-900">
            <LayoutTemplate className="h-5 w-5 text-blue-600" />
            Saved template library
          </CardTitle>
          <CardDescription>Reused for AI feed generation and one-click scheduling.</CardDescription>
        </div>
        {savedTemplates.length > 0 ? (
          <Button type="button" size="sm" variant="outline" onClick={onClearTemplateLibrary} className="rounded-xl font-semibold">
            Clear library
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="p-6">
        {savedTemplates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 px-6 py-10 text-center">
            <p className="font-bold text-gray-950">No saved templates yet</p>
            <p className="mt-2 text-sm text-gray-500">Save layouts from the Templates tab. They sync here automatically.</p>
          </div>
        ) : (
          <ScrollArea className="h-[min(720px,55vh)] pr-3">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {savedTemplates.map((template, index) => (
                <article
                  key={template.id}
                  className="flex flex-col rounded-2xl border border-gray-100 bg-slate-50/50 p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <Badge variant="outline" className="shrink-0 font-black uppercase tracking-wider text-blue-700">
                      Template {index + 1}
                    </Badge>
                  </div>
                  <h4 className="font-bold text-gray-950">{template.title}</h4>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-500">{template.purpose}</p>
                  <div className="my-3 min-h-0 flex-1">
                    <ScaledTemplatePreview className="border border-gray-100 bg-white">
                      <VisualTemplateCard
                        draft={{
                        id: template.id,
                        title: template.title,
                        type: "Template",
                        content: template.content,
                        status: "Draft",
                        templateId: template.id,
                        templateIndex: template.styleIndex,
                        hideLogo: template.hideLogo,
                        cleanAlign: template.cleanAlign,
                        roundedFrames: template.roundedFrames,
                        updatedAt: template.updatedAt,
                        manualLayout: template.manualLayout,
                        imageUrl: template.imageUrl || null,
                        imageError: template.imageError || null,
                      }}
                        index={template.styleIndex}
                        compact
                      />
                    </ScaledTemplatePreview>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openManualEditor(draftFromSavedTemplate(template, index), template.styleIndex)}
                    className="mt-auto h-10 w-full rounded-xl border-blue-100 font-semibold text-blue-700 hover:bg-blue-50"
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit layout
                  </Button>
                </article>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

