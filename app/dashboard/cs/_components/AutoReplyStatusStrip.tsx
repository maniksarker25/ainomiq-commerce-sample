"use client";

import { Mail, MessageCircle, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AutoReplyChannel, AutoReplySettings } from "@/lib/cs-auto-reply";
import { cn } from "@/lib/utils";

type ChannelMeta = {
  key: AutoReplyChannel;
  label: string;
  icon: typeof Mail;
};

const CHANNELS: ChannelMeta[] = [
  { key: "email", label: "Email", icon: Mail },
  { key: "instagram", label: "Instagram", icon: MessageCircle },
  { key: "facebook", label: "Facebook", icon: MessageCircle },
];

type AutoReplyStatusStripProps = {
  settings: AutoReplySettings | null;
  channels: AutoReplyChannel[];
  onOpenSettings: () => void;
  className?: string;
};

export function AutoReplyStatusStrip({
  settings,
  channels,
  onOpenSettings,
  className,
}: AutoReplyStatusStripProps) {
  if (!settings || channels.length === 0) return null;

  const visible = CHANNELS.filter((channel) => channels.includes(channel.key));

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-2",
        className,
      )}
    >
      <span className="text-xs font-medium text-muted-foreground">
        Auto-reply
      </span>
      {visible.map(({ key, label, icon: Icon }) => {
        const enabled = settings[key];
        return (
          <Badge
            key={key}
            variant="outline"
            className={cn(
              "gap-1.5 px-2.5 py-1 font-medium",
              enabled
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-amber-200 bg-amber-50 text-amber-900",
            )}
          >
            <Icon className="size-3 shrink-0" />
            {label}
            <span className="text-[10px] uppercase tracking-wide opacity-80">
              {enabled ? "On" : "Off"}
            </span>
          </Badge>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="ml-auto h-7 px-2 text-xs"
        onClick={onOpenSettings}
      >
        <Settings2 className="size-3.5" />
        Settings
      </Button>
    </div>
  );
}
