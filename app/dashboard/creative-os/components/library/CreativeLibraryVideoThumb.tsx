"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

export function CreativeLibraryVideoThumb({
  src,
  poster,
  name,
}: {
  src: string;
  poster: string;
  name: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasPreview, setHasPreview] = useState(Boolean(poster));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasPreview(Boolean(poster));
    setHasError(false);
    videoRef.current?.load();
  }, [poster, src]);

  const showPreviewFrame = (video: HTMLVideoElement) => {
    setHasError(false);
    if (!poster) setHasPreview(true);
    try {
      if (
        Number.isFinite(video.duration) &&
        video.duration > 0 &&
        video.currentTime < 0.05
      ) {
        video.currentTime = Math.min(
          0.35,
          Math.max(0.08, video.duration * 0.02),
        );
      }
    } catch {
      setHasPreview(true);
    }
  };

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-muted">
      <video
        ref={videoRef}
        src={src}
        poster={poster || undefined}
        muted
        playsInline
        preload="auto"
        aria-label={`Preview thumbnail for ${name}`}
        onLoadedMetadata={event => showPreviewFrame(event.currentTarget)}
        onLoadedData={event => showPreviewFrame(event.currentTarget)}
        onSeeked={() => setHasPreview(true)}
        onCanPlay={() => setHasPreview(true)}
        onError={() => setHasError(true)}
        className={`h-full w-full object-cover transition-opacity duration-200 ${hasPreview && !hasError ? "opacity-100" : "opacity-0"}`}
      />
      {!hasPreview || hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted text-xs font-bold text-muted-foreground">
          <Play size={20} className="text-muted-foreground/70" />
          <span>{hasError ? "Open to preview" : "Loading preview"}</span>
        </div>
      ) : (
        <div className="pointer-events-none absolute left-2 top-2 inline-flex size-7 items-center justify-center rounded-full bg-foreground/55 text-background">
          <Play size={13} fill="currentColor" />
        </div>
      )}
    </div>
  );
}
