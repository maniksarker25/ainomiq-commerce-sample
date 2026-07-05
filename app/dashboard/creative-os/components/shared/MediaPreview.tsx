"use client";

import { useRef, useState } from "react";
import { Link2, Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function isVideoUrl(value: string) {
  return /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(value);
}

export function isImageUrl(value: string) {
  return /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(value);
}

export function isPreviewableMediaUrl(value: string) {
  return isVideoUrl(value) || isImageUrl(value);
}

export function enableVideoAudio(video: HTMLVideoElement | null) {
  if (!video) return;
  video.defaultMuted = false;
  video.muted = false;
  video.volume = 1;
}

export function MediaPreview({
  src,
  alt,
  fit = "cover",
  allowFullscreen = true,
  onAspectRatio,
}: {
  src?: string;
  alt: string;
  fit?: "cover" | "contain";
  allowFullscreen?: boolean;
  onAspectRatio?: (ratio: number) => void;
}) {
  const [failed, setFailed] = useState(false);

  if (!src) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No preview
      </div>
    );
  }

  if (failed) {
    return (
      <div className="flex items-center justify-center h-full px-4 text-sm font-semibold text-center text-muted-foreground">
        Preview unavailable
      </div>
    );
  }

  if (isVideoUrl(src)) {
    return (
      <video
        src={src}
        className={cn("h-full w-full", fit === "contain" ? "object-contain" : "object-cover")}
        controls
        controlsList={allowFullscreen ? undefined : "nodownload nofullscreen noremoteplayback"}
        disablePictureInPicture={!allowFullscreen}
        playsInline
        preload="metadata"
        ref={enableVideoAudio}
        onLoadedMetadata={(event) => {
          enableVideoAudio(event.currentTarget);
          const { videoWidth, videoHeight } = event.currentTarget;
          if (videoWidth && videoHeight) onAspectRatio?.(videoWidth / videoHeight);
        }}
        onPlay={(event) => enableVideoAudio(event.currentTarget)}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={cn("h-full w-full", fit === "contain" ? "object-contain" : "object-cover")}
      onLoad={(event) => {
        const { naturalWidth, naturalHeight } = event.currentTarget;
        if (naturalWidth && naturalHeight) onAspectRatio?.(naturalWidth / naturalHeight);
      }}
      onError={() => setFailed(true)}
    />
  );
}

export function SubmittedAdPreview({
  url,
  title,
  variant = "compact",
}: {
  url?: string;
  title: string;
  variant?: "compact" | "review" | "launch";
}) {
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const cleanUrl = (url || "").trim();
  const isReview = variant === "review";
  const isLaunch = variant === "launch";

  if (cleanUrl && isPreviewableMediaUrl(cleanUrl)) {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-border bg-muted",
          isReview
            ? "mx-auto aspect-9/16 w-full max-w-[360px]"
            : isLaunch
              ? "mx-auto w-full max-w-[320px] bg-black"
              : "aspect-video",
        )}
        style={isLaunch ? { aspectRatio: aspectRatio || 9 / 16 } : undefined}
      >
        <MediaPreview
          src={cleanUrl}
          alt={title}
          fit={isLaunch ? "contain" : "cover"}
          allowFullscreen={!isLaunch}
          onAspectRatio={isLaunch ? setAspectRatio : undefined}
        />
      </div>
    );
  }

  return (
    <a
      href={cleanUrl || undefined}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "flex min-h-32 flex-col justify-between rounded-xl border p-4 transition",
        cleanUrl
          ? "border-primary/15 bg-primary/5 text-primary hover:border-primary/25 hover:bg-primary/10"
          : "pointer-events-none border-border bg-muted text-muted-foreground",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="p-2 shadow-sm rounded-xl bg-background/80">
          <Link2 size={18} />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-bold">
            {cleanUrl ? "Submitted ad link" : "No submitted ad link"}
          </div>
          <div className="mt-1 text-xs font-semibold opacity-75">
            {cleanUrl
              ? "Open the finished ad in a new tab."
              : "The editor did not attach a delivery link."}
          </div>
        </div>
      </div>
      {cleanUrl ? (
        <span className="inline-flex mt-4 text-xs font-bold">
          Open submitted ad
        </span>
      ) : null}
    </a>
  );
}

function formatTimestamp(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

const timestampFeedbackPattern = /^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.*)$/;

export function timestampToSeconds(timestamp: string) {
  const parts = timestamp.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export function parseTimestampedFeedback(feedback = "") {
  return feedback
    .split("\n")
    .map((line) => line.trim())
    .map((line) => {
      const match = line.match(timestampFeedbackPattern);
      if (!match) return null;
      return {
        timestamp: match[1],
        note: match[2] || "Review this moment",
      };
    })
    .filter((item): item is { timestamp: string; note: string } => Boolean(item));
}

export function TimestampedFeedbackMarks({
  feedback,
  onSeek,
}: {
  feedback?: string;
  onSeek?: (seconds: number) => void;
}) {
  const marks = parseTimestampedFeedback(feedback || "");
  if (!marks.length) return null;

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-white p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-amber-700">
        Video time marks
      </div>
      <div className="mt-2 space-y-2">
        {marks.map((mark, index) => (
          <button
            key={`${mark.timestamp}-${index}`}
            type="button"
            aria-label={`Jump to ${mark.timestamp} in submitted video`}
            className="flex w-full gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-left transition hover:border-amber-300 hover:bg-amber-100"
            onClick={() => onSeek?.(timestampToSeconds(mark.timestamp))}
          >
            <span
              className="mt-0.5 inline-flex h-7 shrink-0 items-center rounded-full bg-amber-200 px-2 text-xs font-black text-amber-950"
              title={`Go to ${mark.timestamp} in the submitted video`}
            >
              {mark.timestamp}
            </span>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
                Go to {mark.timestamp} in the submitted video
              </div>
              <div className="mt-0.5 text-sm font-semibold leading-5 text-amber-950">
                {mark.note}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function TimestampedReviewPreview({
  url,
  title,
  feedback,
  onFeedbackChange,
}: {
  url?: string;
  title: string;
  feedback: string;
  onFeedbackChange: (value: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [note, setNote] = useState("");
  const [duration, setDuration] = useState(0);
  const [videoActive, setVideoActive] = useState(false);
  const cleanUrl = (url || "").trim();
  const marks = parseTimestampedFeedback(feedback);

  if (!cleanUrl || !isVideoUrl(cleanUrl)) {
    return <SubmittedAdPreview url={url} title={title} variant="review" />;
  }

  const addNote = () => {
    const timestamp = formatTimestamp(videoRef.current?.currentTime || 0);
    const text = note.trim();
    const line = text ? `[${timestamp}] ${text}` : `[${timestamp}] `;
    onFeedbackChange([feedback.trim(), line].filter(Boolean).join("\n"));
    setNote("");
  };

  const seekToTimestamp = (seconds: number) => {
    setVideoActive(true);
    requestAnimationFrame(() => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = Math.max(0, Math.min(seconds, video.duration || seconds));
      video.pause();
      video.focus();
    });
  };

  return (
    <div className="mx-auto w-full max-w-[360px] space-y-3">
      <div className="aspect-9/16 overflow-hidden rounded-xl border border-border bg-muted">
        {!videoActive ? (
          <button
            type="button"
            className="flex h-full w-full flex-col items-center justify-center gap-3 bg-black text-white"
            onClick={() => setVideoActive(true)}
          >
            <span className="flex size-14 items-center justify-center rounded-full bg-white/15 backdrop-blur">
              <Play size={24} fill="currentColor" />
            </span>
            <span className="text-sm font-bold">Load review video</span>
          </button>
        ) : (
          <video
            ref={(node) => {
              videoRef.current = node;
              enableVideoAudio(node);
            }}
            src={cleanUrl}
            className="h-full w-full object-cover"
            controls
            controlsList="nodownload noremoteplayback"
            disableRemotePlayback
            playsInline
            preload="none"
            onLoadedMetadata={(event) => {
              enableVideoAudio(event.currentTarget);
              setDuration(event.currentTarget.duration || 0);
            }}
            onPlay={(event) => enableVideoAudio(event.currentTarget)}
          />
        )}
      </div>
      {marks.length && duration ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="relative h-3 rounded-full bg-amber-100">
            {marks.map((mark, index) => (
              <button
                key={`${mark.timestamp}-timeline-${index}`}
                type="button"
                aria-label={`Jump to ${mark.timestamp} in submitted video`}
                className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-amber-400 shadow"
                style={{
                  left: `${Math.min(100, Math.max(0, (timestampToSeconds(mark.timestamp) / duration) * 100))}%`,
                }}
                onClick={() => seekToTimestamp(timestampToSeconds(mark.timestamp))}
              />
            ))}
          </div>
        </div>
      ) : null}
      <div className="rounded-xl border border-border/70 bg-background p-3">
        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Timestamp note
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Note for current video time"
            className="h-9"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addNote();
              }
            }}
          />
          <Button type="button" size="sm" variant="secondary" onClick={addNote}>
            <Plus size={14} />
            Add
          </Button>
        </div>
        <div className="mt-1 text-xs font-medium text-muted-foreground">
          Pause or scrub the video, then add a note. It will be inserted into the feedback.
        </div>
      </div>
      <TimestampedFeedbackMarks feedback={feedback} onSeek={seekToTimestamp} />
    </div>
  );
}
