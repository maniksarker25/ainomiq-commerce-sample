"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Rnd } from "react-rnd";
import { toBlob } from "html-to-image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Draft,
  ManualLayout,
  ContentConfig,
  BrandProfile,
  CanvasElement,
  CanvasElementId,
} from "../_lib/types";
import {
  manualLayoutToElements,
  elementsToManualLayout,
  copyFieldsFromLayout,
  migrateManualLayout,
  visibilityKeyForElement,
  CANVAS_ELEMENT_LABELS,
  MANUAL_CANVAS_REFERENCE,
} from "../_lib/manual-canvas";
import { ImageSlot } from "./VisualTemplateCard";
import { sameAsset } from "../_lib/utils";
import { inlineImagesForExport } from "../_lib/canvas-export";
import { Download, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: Draft | null;
  index: number;
  tenantId: string;
  manualEditor: ManualLayout | null;
  config: ContentConfig | null;
  brandProfile: BrandProfile | null;
  onUpdateManualEditor: (key: string, value: unknown) => void;
  onDeleteManualSection: (key: string) => void;
  onRestoreManualSection: (key: string) => void;
  onSave: (layout: ManualLayout) => void;
  onReset: () => void;
  layoutSeed?: number;
}

function LayerContent({
  id,
  layout,
  draft,
  primary,
  textColor,
  frameClass,
  visual,
}: {
  id: CanvasElementId;
  layout: ManualLayout;
  draft: Draft;
  primary: string;
  textColor: string;
  frameClass: string;
  visual: string | null;
}) {
  if (id === "image") {
    return (
      <ImageSlot
        label="Customer image"
        visual={visual}
        className={`h-full w-full border-0 rounded-none ${frameClass}`}
      />
    );
  }
  if (id === "headline") {
    return (
      <div
        className="flex h-full w-full items-center overflow-hidden px-2 font-black leading-[0.95] tracking-tight"
        style={{ color: textColor, fontSize: "clamp(14px, 5cqw, 32px)" }}
      >
        <span className="line-clamp-4 wrap-break-word">{layout.headline}</span>
      </div>
    );
  }
  if (id === "subline") {
    return (
      <div
        className="flex items-start w-full h-full px-2 overflow-hidden font-semibold leading-tight text-gray-600"
        style={{ fontSize: "clamp(10px, 3cqw, 16px)" }}
      >
        <span className="line-clamp-4 wrap-break-word">
          {layout.subline || "\u00a0"}
        </span>
      </div>
    );
  }
  if (id === "extra") {
    return (
      <div
        className="flex h-full w-full items-end overflow-hidden px-2 font-bold uppercase tracking-[0.16em] text-blue-600"
        style={{ fontSize: "clamp(8px, 2.5cqw, 11px)" }}
      >
        <span className="truncate">{layout.extraText}</span>
      </div>
    );
  }
  return (
    <div
      className="w-full h-full rounded-full"
      style={{ background: primary }}
    />
  );
}

export function ManualEditor({
  open,
  onOpenChange,
  draft,
  tenantId,
  manualEditor,
  config,
  brandProfile,
  onUpdateManualEditor,
  onDeleteManualSection,
  onRestoreManualSection,
  onSave,
  onReset,
  layoutSeed = 0,
}: Props) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const manualEditorRef = useRef(manualEditor);
  manualEditorRef.current = manualEditor;
  const layoutInitRef = useRef("");
  const [displayScale, setDisplayScale] = useState(1);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<CanvasElementId | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!open) {
      layoutInitRef.current = "";
      return;
    }

    let observer: ResizeObserver | undefined;
    let frame = 0;

    const attach = () => {
      const node = canvasWrapRef.current;
      if (!node) {
        frame = requestAnimationFrame(attach);
        return;
      }

      const update = () => {
        const width = node.getBoundingClientRect().width;
        if (width > 0) {
          setDisplayScale(width / MANUAL_CANVAS_REFERENCE.width);
        }
      };

      update();
      observer = new ResizeObserver(update);
      observer.observe(node);
    };

    attach();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [open]);

  const layout = manualEditor ? migrateManualLayout(manualEditor) : null;

  const brand = config?.brand_name || brandProfile?.brand_name || "Ainomiq";
  const visual = draft?.imageUrl?.trim() || null;
  const rawIcon =
    brandProfile?.icon_url ||
    brandProfile?.source_summary?.icon ||
    brandProfile?.source_summary?.favicon ||
    "";
  const rawLogo =
    brandProfile?.full_logo_url ||
    brandProfile?.logo_url ||
    brandProfile?.source_summary?.logo ||
    "";
  const logo = rawLogo && !sameAsset(rawLogo, rawIcon) ? rawLogo : "";
  const colors = (brandProfile?.source_summary?.brand_colors || []).filter(
    (c) => /^#[0-9a-f]{6}$/i.test(c),
  );
  const primary = colors[0] || "#3b82f6";
  const tone =
    `${brandProfile?.visual_style || ""} ${brandProfile?.brand_tone || ""}`.toLowerCase();
  const isLight =
    tone.includes("minimal") ||
    tone.includes("clean") ||
    tone.includes("white") ||
    colors.some((c) =>
      ["#ffffff", "#f8fafc", "#f9fafb", "#f5f5f5"].includes(c.toLowerCase()),
    );
  const baseBg = isLight ? "#ffffff" : "#f8fafc";
  const textColor = "#0f172a";
  const frameClass = draft?.roundedFrames ? "rounded-[28px]" : "rounded-[18px]";

  const logoNode = draft?.hideLogo ? null : logo ? (
    <img
      src={logo}
      alt={`${brand} logo`}
      className="h-7 max-w-[116px] object-contain"
      referrerPolicy="no-referrer"
    />
  ) : (
    <div className="text-xl font-bold lowercase">{brand}</div>
  );

  useLayoutEffect(() => {
    const current = manualEditorRef.current;
    if (!open || !current) return;

    const layoutKey = `${draft?.id ?? ""}-${layoutSeed}`;
    if (layoutInitRef.current === layoutKey) return;
    layoutInitRef.current = layoutKey;

    setElements(
      manualLayoutToElements(
        migrateManualLayout(current),
        MANUAL_CANVAS_REFERENCE,
      ),
    );
    setSelectedId(null);
  }, [open, draft?.id, layoutSeed]);

  useEffect(() => {
    if (!manualEditor) return;
    const migrated = migrateManualLayout(manualEditor);
    setElements((prev) => {
      if (!prev.length) return prev;
      return prev.map((el) => ({
        ...el,
        visible: migrated[visibilityKeyForElement(el.id)] !== false,
      }));
    });
  }, [
    manualEditor?.showImage,
    manualEditor?.showHeadline,
    manualEditor?.showSubline,
    manualEditor?.showExtraText,
    manualEditor?.showAccent,
  ]);

  const displayElements = useMemo(() => {
    if (!layout) return [];
    if (elements.length > 0) return elements;
    return manualLayoutToElements(layout, MANUAL_CANVAS_REFERENCE);
  }, [elements, layout]);

  const updateElement = useCallback(
    (id: CanvasElementId, patch: Partial<CanvasElement>) => {
      setElements((current) =>
        current.map((el) => (el.id === id ? { ...el, ...patch } : el)),
      );
    },
    [],
  );

  const toggles: Array<[keyof ManualLayout, string]> = [
    ["showImage", "Image"],
    ["showHeadline", "Headline"],
    ["showSubline", "Subline"],
    ["showExtraText", "Extra label"],
    ["showAccent", "Accent"],
    ["showCaption", "Caption"],
  ];

  async function handleExport() {
    if (!canvasRef.current || !layout) return;
    setExporting(true);
    setSelectedId(null);
    canvasRef.current.setAttribute("data-exporting", "true");
    let restoreImages: (() => void) | undefined;
    try {
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
      restoreImages = await inlineImagesForExport(canvasRef.current, tenantId);
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
      const blob = await toBlob(canvasRef.current, {
        pixelRatio: 2,
        skipFonts: true,
        backgroundColor: baseBg,
        filter: (node) => {
          if (!(node instanceof HTMLElement)) return true;
          return (
            !node.classList.contains("rnd-handle") &&
            !node.classList.contains("editor-chrome")
          );
        },
        onImageErrorHandler: () => undefined,
      });
      if (!blob) {
        toast.error("Export failed");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `content-template-${draft?.id || "export"}.png`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("PNG exported");
    } catch (err) {
      console.error("[ManualEditor] export error", err);
      toast.error(
        "Could not export image. Try again or use a different product image.",
      );
    } finally {
      restoreImages?.();
      canvasRef.current?.removeAttribute("data-exporting");
      setExporting(false);
    }
  }

  function handleSaveClick() {
    if (!layout) return;
    const next = elementsToManualLayout(
      displayElements,
      MANUAL_CANVAS_REFERENCE,
      copyFieldsFromLayout(layout),
    );
    onSave(migrateManualLayout(next));
  }

  if (!draft || !layout) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="fixed inset-0 top-0 left-0 z-50 flex h-dvh max-h-dvh w-full max-w-full translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-blue-100 bg-white p-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(96vh,920px)] sm:max-h-[96vh] sm:w-[min(96vw,1400px)] sm:max-w-[min(96vw,1400px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px]"
      >
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <DialogHeader className="px-4 py-3 pr-12 border-b border-gray-100 shrink-0 bg-slate-50/80 sm:px-6 sm:py-4">
            <div className="flex flex-col min-w-0 gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <Badge
                  variant="outline"
                  className="mb-1 border-blue-100 text-[10px] font-bold uppercase tracking-[0.22em] text-blue-600"
                >
                  Manual Editor
                </Badge>
                <DialogTitle className="text-lg font-bold text-gray-950 sm:text-2xl">
                  Refine Layout
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-gray-600 sm:text-sm">
                  Tap a layer, then drag or resize. Save when done.
                </DialogDescription>
              </div>
              <div className="flex-wrap hidden gap-2 sm:flex">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReset}
                  className="h-10 font-semibold text-blue-700 bg-white border-blue-100 rounded-xl hover:bg-blue-50"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={exporting || displayElements.length === 0}
                  className="h-10 font-semibold text-blue-700 bg-white border-blue-100 rounded-xl hover:bg-blue-50"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {exporting ? "Exporting…" : "Export PNG"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="h-10 font-semibold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveClick}
                  className="h-10 font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
              <div className="flex gap-2 sm:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReset}
                  className="flex-1 text-xs font-semibold text-blue-700 border-blue-100 h-9 rounded-xl"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Reset
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={exporting || displayElements.length === 0}
                  className="flex-1 text-xs font-semibold text-blue-700 border-blue-100 h-9 rounded-xl"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {exporting ? "…" : "Export"}
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 p-3 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-slate-50 sm:p-5 md:p-6">
            <div className="grid min-w-0 grid-cols-1 items-start gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,420px)] xl:gap-8">
              <div className="flex flex-col min-w-0 gap-3 sm:gap-4">
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none [-webkit-overflow-scrolling:touch] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                  {toggles.map(([key, label]) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={
                        layout[key] !== false ? "destructive" : "outline"
                      }
                      onClick={() =>
                        layout[key] !== false
                          ? onDeleteManualSection(key)
                          : onRestoreManualSection(key)
                      }
                      className={`h-8 shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${layout[key] !== false ? "" : "bg-gray-100"}`}
                    >
                      {layout[key] !== false
                        ? `Hide ${label}`
                        : `Show ${label}`}
                    </Button>
                  ))}
                </div>

                {selectedId ? (
                  <div className="px-3 py-2 text-xs font-semibold text-blue-800 border border-blue-100 rounded-xl bg-blue-50 sm:text-sm">
                    Selected: {CANVAS_ELEMENT_LABELS[selectedId]} - drag handles
                    to resize
                  </div>
                ) : null}

                <div className="flex justify-center w-full min-w-0">
                  <div
                    ref={canvasWrapRef}
                    className="relative w-full max-w-[520px] overflow-hidden rounded-[14px] border border-gray-200 bg-white shadow-xl sm:rounded-[18px]"
                    style={{
                      aspectRatio: `${MANUAL_CANVAS_REFERENCE.width} / ${MANUAL_CANVAS_REFERENCE.height}`,
                    }}
                  >
                    <div
                      className="absolute top-0 left-0 origin-top-left"
                      style={{
                        width: MANUAL_CANVAS_REFERENCE.width,
                        height: MANUAL_CANVAS_REFERENCE.height,
                        transform: `scale(${displayScale})`,
                      }}
                    >
                      <div
                        ref={canvasRef}
                        className="manual-editor-canvas relative touch-none overflow-hidden [&[data-exporting=true]_.editor-chrome]:hidden"
                        style={{
                          width: MANUAL_CANVAS_REFERENCE.width,
                          height: MANUAL_CANVAS_REFERENCE.height,
                          background: baseBg,
                          color: textColor,
                          containerType: "size",
                        }}
                        onMouseDown={(e) => {
                          if (e.target === e.currentTarget) setSelectedId(null);
                        }}
                        onTouchStart={(e) => {
                          if (e.target === e.currentTarget) setSelectedId(null);
                        }}
                      >
                        {displayElements
                          .filter((el) => el.visible)
                          .map((el, index) => {
                            const selected = selectedId === el.id;
                            const z = selected ? 50 : 10 + index;
                            return (
                              <Rnd
                                key={el.id}
                                bounds="parent"
                                scale={displayScale}
                                position={{ x: el.x, y: el.y }}
                                size={{ width: el.width, height: el.height }}
                                enableResizing={selected}
                                style={{ zIndex: z }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setSelectedId(el.id);
                                }}
                                className={
                                  selected
                                    ? "manual-editor-layer-selected"
                                    : undefined
                                }
                                onDragStop={(_e, data) => {
                                  updateElement(el.id, {
                                    x: data.x,
                                    y: data.y,
                                  });
                                }}
                                onResizeStop={(
                                  _e,
                                  _dir,
                                  ref,
                                  _delta,
                                  position,
                                ) => {
                                  updateElement(el.id, {
                                    width: ref.offsetWidth,
                                    height: ref.offsetHeight,
                                    x: position.x,
                                    y: position.y,
                                  });
                                }}
                              >
                                <div
                                  className={`h-full w-full overflow-hidden bg-white/95 ${
                                    el.id === "image"
                                      ? `border border-dashed border-blue-200 bg-blue-50 ${frameClass}`
                                      : ""
                                  } ${selected ? "editor-chrome ring-2 ring-blue-600 ring-offset-1" : ""}`}
                                  onTouchStart={(e) => {
                                    e.stopPropagation();
                                    setSelectedId(el.id);
                                  }}
                                >
                                  <LayerContent
                                    id={el.id}
                                    layout={layout}
                                    draft={draft}
                                    primary={primary}
                                    textColor={textColor}
                                    frameClass={frameClass}
                                    visual={visual}
                                  />
                                </div>
                              </Rnd>
                            );
                          })}

                        {!draft.hideLogo ? (
                          <div className="absolute pointer-events-none bottom-5 right-5 z-60">
                            {logoNode}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-center text-[11px] leading-relaxed text-gray-500 sm:text-xs">
                  Tap a layer to select · drag to move · pull handles to resize
                </p>
              </div>

              <div className="min-w-0 space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Headline</Label>
                    <Input
                      value={layout.headline}
                      onChange={(e) =>
                        onUpdateManualEditor("headline", e.target.value)
                      }
                      className="min-w-0 border-gray-200 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Subline</Label>
                    <Input
                      value={layout.subline}
                      onChange={(e) =>
                        onUpdateManualEditor("subline", e.target.value)
                      }
                      className="min-w-0 border-gray-200 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Extra Label</Label>
                  <Input
                    value={layout.extraText}
                    onChange={(e) =>
                      onUpdateManualEditor("extraText", e.target.value)
                    }
                    className="min-w-0 border-gray-200 rounded-xl"
                    placeholder="e.g. Special Offer"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">
                    Caption (post copy, off canvas)
                  </Label>
                  <Textarea
                    value={layout.caption}
                    onChange={(e) =>
                      onUpdateManualEditor("caption", e.target.value)
                    }
                    rows={4}
                    className="min-w-0 border-gray-200 resize-none rounded-xl"
                  />
                </div>

                {selectedId ? (
                  <div className="hidden pt-4 border-t border-gray-100 sm:block">
                    <p className="text-sm font-bold text-gray-900">
                      Selected: {CANVAS_ELEMENT_LABELS[selectedId]}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 gap-2 border-t border-gray-100 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:hidden">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 font-semibold h-11 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveClick}
              className="flex-1 font-semibold text-white bg-blue-600 h-11 rounded-xl hover:bg-blue-700"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
