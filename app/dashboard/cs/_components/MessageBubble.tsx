import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MessageBubbleProps = {
  speaker?: string;
  children: ReactNode;
  align?: "start" | "end";
  variant?: "agent" | "customer" | "outgoing" | "incoming";
  className?: string;
};

export function MessageBubble({
  speaker,
  children,
  align = "start",
  variant = "incoming",
  className,
}: MessageBubbleProps) {
  const isOutgoing =
    variant === "outgoing" || variant === "agent" || align === "end";

  return (
    <div
      className={cn(
        "max-w-[85%] min-w-0 rounded-xl border px-3 py-2",
        isOutgoing
          ? "ml-auto border-primary/10 bg-primary/5"
          : "mr-auto border-border/60 bg-muted/40",
        className,
      )}
    >
      {speaker ? (
        <div className="mb-1 text-[11px] font-semibold capitalize text-muted-foreground">
          {speaker}
        </div>
      ) : null}
      <div className="min-w-0 wrap-break-word text-sm leading-relaxed whitespace-pre-wrap ">
        {children}
      </div>
    </div>
  );
}
