import type { CanvasElement, CanvasElementId, CanvasSize, ManualLayout } from "./types";

export const MANUAL_CANVAS_REFERENCE = { width: 416, height: 520 } as const;

const ELEMENT_IDS: CanvasElementId[] = ["image", "headline", "subline", "extra", "accent"];

function clampPercent(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function percentToPx(percent: number, total: number) {
  return Math.round((percent / 100) * total);
}

function pxToPercent(px: number, total: number) {
  if (total <= 0) return 0;
  return clampPercent(Math.round((px / total) * 100));
}

function hasSplitTextLayers(layout: ManualLayout) {
  return typeof layout.headlineX === "number";
}

/** Derive per-layer boxes from legacy single text block. */
export function migrateManualLayout(layout: ManualLayout): ManualLayout {
  if (hasSplitTextLayers(layout)) {
    return {
      ...layout,
      headlineX: layout.headlineX ?? layout.textX,
      headlineY: layout.headlineY ?? layout.textY,
      headlineW: layout.headlineW ?? layout.textW ?? 58,
      headlineH: layout.headlineH ?? 22,
      sublineX: layout.sublineX ?? layout.textX,
      sublineY: layout.sublineY ?? Math.min(layout.textY + 24, 84),
      sublineW: layout.sublineW ?? layout.textW ?? 58,
      sublineH: layout.sublineH ?? 12,
      extraX: layout.extraX ?? layout.textX,
      extraY: layout.extraY ?? Math.max(layout.textY - 8, 0),
      extraW: layout.extraW ?? layout.textW ?? 58,
      extraH: layout.extraH ?? 8,
    };
  }

  const textW = layout.textW || 58;
  const textX = layout.textX;
  const textY = layout.textY;

  return {
    ...layout,
    headlineX: textX,
    headlineY: textY + (layout.showExtraText !== false && layout.extraText ? 10 : 0),
    headlineW: textW,
    headlineH: 22,
    sublineX: textX,
    sublineY: textY + (layout.showExtraText !== false && layout.extraText ? 34 : 24),
    sublineW: textW,
    sublineH: 12,
    extraX: textX,
    extraY: Math.max(textY, 0),
    extraW: textW,
    extraH: 8,
  };
}

function layoutBox(
  layout: ManualLayout,
  id: CanvasElementId,
): { x: number; y: number; w: number; h: number; visible: boolean } {
  const migrated = migrateManualLayout(layout);
  switch (id) {
    case "image":
      return {
        x: migrated.imageX,
        y: migrated.imageY,
        w: migrated.imageW,
        h: migrated.imageH,
        visible: migrated.showImage !== false,
      };
    case "headline":
      return {
        x: migrated.headlineX ?? migrated.textX,
        y: migrated.headlineY ?? migrated.textY,
        w: migrated.headlineW ?? migrated.textW ?? 58,
        h: migrated.headlineH ?? 22,
        visible: migrated.showHeadline !== false,
      };
    case "subline":
      return {
        x: migrated.sublineX ?? migrated.textX,
        y: migrated.sublineY ?? migrated.textY + 24,
        w: migrated.sublineW ?? migrated.textW ?? 58,
        h: migrated.sublineH ?? 12,
        visible: migrated.showSubline !== false,
      };
    case "extra":
      return {
        x: migrated.extraX ?? migrated.textX,
        y: migrated.extraY ?? migrated.textY,
        w: migrated.extraW ?? migrated.textW ?? 58,
        h: migrated.extraH ?? 8,
        visible: migrated.showExtraText !== false,
      };
    case "accent":
      return {
        x: migrated.accentX,
        y: migrated.accentY,
        w: migrated.accentW || 16,
        h: migrated.accentH || 1.5,
        visible: migrated.showAccent !== false,
      };
  }
}

export function manualLayoutToElements(layout: ManualLayout, canvasSize: CanvasSize): CanvasElement[] {
  const migrated = migrateManualLayout(layout);
  const { width, height } = canvasSize;
  if (width <= 0 || height <= 0) return [];

  return ELEMENT_IDS.map((id) => {
    const box = layoutBox(migrated, id);
    return {
      id,
      x: percentToPx(box.x, width),
      y: percentToPx(box.y, height),
      width: Math.max(id === "accent" ? 8 : 40, percentToPx(box.w, width)),
      height: Math.max(id === "accent" ? 4 : 24, percentToPx(box.h, height)),
      visible: box.visible,
    };
  });
}

export function elementsToManualLayout(
  elements: CanvasElement[],
  canvasSize: CanvasSize,
  copy: Pick<
    ManualLayout,
    | "headline"
    | "subline"
    | "caption"
    | "extraText"
    | "showImage"
    | "showHeadline"
    | "showSubline"
    | "showExtraText"
    | "showAccent"
    | "showCaption"
  >,
): ManualLayout {
  const { width, height } = canvasSize;
  const byId = Object.fromEntries(elements.map((el) => [el.id, el])) as Record<
    CanvasElementId,
    CanvasElement | undefined
  >;

  const toPct = (el: CanvasElement | undefined, fallback: { x: number; y: number; w: number; h: number }) => {
    if (!el || width <= 0 || height <= 0) return fallback;
    return {
      x: pxToPercent(el.x, width),
      y: pxToPercent(el.y, height),
      w: pxToPercent(el.width, width),
      h: pxToPercent(el.height, height),
    };
  };

  const image = toPct(byId.image, { x: 8, y: 8, w: 84, h: 47 });
  const headline = toPct(byId.headline, { x: 8, y: 64, w: 80, h: 22 });
  const subline = toPct(byId.subline, { x: 8, y: 76, w: 80, h: 12 });
  const extra = toPct(byId.extra, { x: 8, y: 58, w: 80, h: 8 });
  const accent = toPct(byId.accent, { x: 8, y: 91, w: 14, h: 1.5 });

  return {
    ...copy,
    textX: headline.x,
    textY: headline.y,
    textW: headline.w,
    imageX: image.x,
    imageY: image.y,
    imageW: image.w,
    imageH: image.h,
    headlineX: headline.x,
    headlineY: headline.y,
    headlineW: headline.w,
    headlineH: headline.h,
    sublineX: subline.x,
    sublineY: subline.y,
    sublineW: subline.w,
    sublineH: subline.h,
    extraX: extra.x,
    extraY: extra.y,
    extraW: extra.w,
    extraH: extra.h,
    accentX: accent.x,
    accentY: accent.y,
    accentW: accent.w,
    accentH: accent.h,
  };
}

export function copyFieldsFromLayout(layout: ManualLayout) {
  return {
    headline: layout.headline,
    subline: layout.subline,
    caption: layout.caption,
    extraText: layout.extraText,
    showImage: layout.showImage,
    showHeadline: layout.showHeadline,
    showSubline: layout.showSubline,
    showExtraText: layout.showExtraText,
    showAccent: layout.showAccent,
    showCaption: layout.showCaption,
  };
}

export function visibilityKeyForElement(id: CanvasElementId): keyof ManualLayout {
  const map: Record<CanvasElementId, keyof ManualLayout> = {
    image: "showImage",
    headline: "showHeadline",
    subline: "showSubline",
    extra: "showExtraText",
    accent: "showAccent",
  };
  return map[id];
}

export const CANVAS_ELEMENT_LABELS: Record<CanvasElementId, string> = {
  image: "Image",
  headline: "Headline",
  subline: "Subline",
  extra: "Extra label",
  accent: "Accent",
};
