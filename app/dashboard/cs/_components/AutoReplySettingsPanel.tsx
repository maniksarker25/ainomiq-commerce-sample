"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, MessageCircle, MessagesSquare } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { AutoReplyChannel, AutoReplySettings } from "@/lib/cs-auto-reply";
import { DEFAULT_AUTO_REPLY } from "@/lib/cs-auto-reply";
import { cn } from "@/lib/utils";

type AutoReplySettingsPanelProps = {
  tenantId: string | null;
  settings: AutoReplySettings | null;
  onSettingsChange: (settings: AutoReplySettings) => void;
  highlight?: boolean;
};

const CHANNEL_ROWS: Array<{
  key: AutoReplyChannel;
  label: string;
  description: string;
  icon: typeof Mail;
}> = [
  {
    key: "email",
    label: "Email",
    description: "Automatically draft and send replies to new support emails.",
    icon: Mail,
  },
  {
    key: "instagram",
    label: "Instagram DMs",
    description: "Reply to incoming Instagram direct messages without manual action.",
    icon: MessageCircle,
  },
  {
    key: "facebook",
    label: "Facebook Messenger",
    description: "Reply to incoming Facebook Messenger conversations automatically.",
    icon: MessagesSquare,
  },
];

export function AutoReplySettingsPanel({
  tenantId,
  settings,
  onSettingsChange,
  highlight = false,
}: AutoReplySettingsPanelProps) {
  const [local, setLocal] = useState<AutoReplySettings>(
    settings || DEFAULT_AUTO_REPLY,
  );
  const [savingChannel, setSavingChannel] = useState<AutoReplyChannel | null>(
    null,
  );

  useEffect(() => {
    if (settings) setLocal(settings);
  }, [settings]);

  async function toggleChannel(channel: AutoReplyChannel, enabled: boolean) {
    if (!tenantId || savingChannel) return;

    const previous = local;
    const next = { ...local, [channel]: enabled };
    setLocal(next);
    setSavingChannel(channel);

    try {
      const res = await fetch("/api/cs/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          auto_reply: { [channel]: enabled },
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to update auto-reply settings");
      }

      const updated = data.auto_reply as AutoReplySettings;
      setLocal(updated);
      onSettingsChange(updated);
      toast.success(
        `${CHANNEL_ROWS.find((row) => row.key === channel)?.label} auto-reply ${enabled ? "enabled" : "disabled"}`,
      );
    } catch (err) {
      setLocal(previous);
      toast.error(
        err instanceof Error ? err.message : "Failed to update auto-reply",
      );
    } finally {
      setSavingChannel(null);
    }
  }

  return (
    <Card
      id="auto-reply-settings"
      className={cn(
        "scroll-mt-24 shadow-none",
        highlight && "ring-2 ring-primary/30",
      )}
    >
      <CardHeader>
        <CardTitle className="text-lg">Automated replies</CardTitle>
        <CardDescription>
          Turn automated responses on or off per channel. Inbound messages still
          appear in your inbox when auto-reply is off.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {CHANNEL_ROWS.map(({ key, label, description, icon: Icon }) => {
          const enabled = local[key];
          const saving = savingChannel === key;

          return (
            <div
              key={key}
              className="flex items-start justify-between gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-muted/40"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/60">
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <Label htmlFor={`auto-reply-${key}`} className="text-sm">
                    {label}
                  </Label>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {description}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 pt-1">
                {saving ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : null}
                <Switch
                  id={`auto-reply-${key}`}
                  checked={enabled}
                  disabled={!tenantId || savingChannel !== null}
                  onCheckedChange={(checked) =>
                    void toggleChannel(key, checked)
                  }
                  aria-label={`${label} auto-reply ${enabled ? "on" : "off"}`}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
