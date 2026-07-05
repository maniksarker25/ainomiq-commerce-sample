"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MANUAL_CANVAS_REFERENCE } from "../_lib/manual-canvas";

type Props = {
  children: React.ReactNode;
  className?: string;
};

/** Renders children at a fixed design size, then scales to fit - keeps manual layouts pixel-faithful in thumbnails. */
export function ScaledTemplatePreview({ children, className }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;

    const update = () => {
      const width = node.getBoundingClientRect().width;
      if (width > 0) {
        setScale(width / MANUAL_CANVAS_REFERENCE.width);
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      className={cn("relative w-full overflow-hidden rounded-2xl", className)}
      style={{
        aspectRatio: `${MANUAL_CANVAS_REFERENCE.width} / ${MANUAL_CANVAS_REFERENCE.height}`,
      }}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: MANUAL_CANVAS_REFERENCE.width,
          height: MANUAL_CANVAS_REFERENCE.height,
          transform: `scale(${scale})`,
        }}
      >
        <div className="relative h-full w-full">{children}</div>
      </div>
    </div>
  );
}
