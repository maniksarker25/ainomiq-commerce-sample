"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import {
  ChevronRight,
  ExternalLink,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCcw,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreativeOsCard } from "../../_components/CreativeOsCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input as ShadcnInput } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea as ShadcnTextarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MagicButton } from "../../_components/MagicButton";
import { Input, Textarea } from "../../_components/FormFields";
import { formatChatTime } from "../../lib/dates";
import { normalizeEmail } from "../../lib/products";
import { normalizeBrandReferenceLinks } from "../../lib/normalize";
import { isImageUrl, isVideoUrl } from "./MediaPreview";
import type {
  BrandReferenceLink,
  ChatMessage,
  CreativeTask,
  ProductPermission,
} from "../../types";

export type ChatRoomView = {
  id: string;
  title: string;
  description: string;
  tasks: CreativeTask[];
  assignees: string[];
  roomIds: string[];
  lastMessage?: ChatMessage;
};

const urlPattern = /(https?:\/\/[^\s]+)/g;

function splitSubmittedAdLine(line: string) {
  const match = /^Submitted ad:\s*(https?:\/\/\S+)/i.exec(line.trim());
  if (!match) return null;
  return match[1];
}

function ChatMessageBody({ body, mine }: { body: string; mine: boolean }) {
  const lines = body.split("\n");
  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        const submittedAdUrl = splitSubmittedAdLine(line);
        if (submittedAdUrl) {
          return (
            <div key={`${index}-${submittedAdUrl}`} className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-wide opacity-80">
                Submitted ad
              </div>
              {isVideoUrl(submittedAdUrl) ? (
                <video
                  src={submittedAdUrl}
                  className="max-h-80 w-full rounded-xl bg-black object-contain"
                  controls
                  playsInline
                  preload="metadata"
                />
              ) : isImageUrl(submittedAdUrl) ? (
                <img
                  src={submittedAdUrl}
                  alt="Submitted ad"
                  className="max-h-80 w-full rounded-xl bg-black object-contain"
                />
              ) : null}
              <a
                href={submittedAdUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold",
                  mine
                    ? "bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25"
                    : "bg-primary/10 text-primary hover:bg-primary/15",
                )}
              >
                <ExternalLink size={13} />
                Open submitted ad
              </a>
            </div>
          );
        }

        const parts = line.split(urlPattern);
        return (
          <div key={`${index}-${line || "blank"}`} className="whitespace-pre-wrap">
            {parts.map((part, partIndex) =>
              /^https?:\/\//i.test(part) ? (
                <a
                  key={`${part}-${partIndex}`}
                  href={part}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "break-all font-bold underline underline-offset-2",
                    mine ? "text-primary-foreground" : "text-primary",
                  )}
                >
                  {part}
                </a>
              ) : (
                <span key={`${part}-${partIndex}`}>{part}</span>
              ),
            )}
          </div>
        );
      })}
    </div>
  );
}

export function BrandReferenceLinksEditor({
  links,
  onAdd,
  onUpdate,
  onRemove,
}: {
  links: BrandReferenceLink[];
  onAdd: () => void;
  onUpdate: (id: string, field: "url" | "info", value: string) => void;
  onRemove: (id: string) => void;
}) {
  const normalizedLinks = normalizeBrandReferenceLinks(links, {
    keepEmpty: true,
    keepDraftSpacing: true,
  });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
          Reference links
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus size={14} />
          Add link
        </Button>
      </div>
      <div className="space-y-3">
        {normalizedLinks.length ? (
          normalizedLinks.map((link) => (
            <Card key={link.id} className="py-4 shadow-none">
              <CardContent className="grid gap-3 px-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_auto] lg:items-start">
                <Input
                  label="Link"
                  value={link.url}
                  onChange={(event) =>
                    onUpdate(link.id, "url", event.target.value)
                  }
                  placeholder="https://..."
                />
                <Textarea
                  label="Info about this link"
                  value={link.info}
                  onChange={(event) =>
                    onUpdate(link.id, "info", event.target.value)
                  }
                  rows={2}
                  placeholder="What should editors use this for?"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => onRemove(link.id)}
                  className="text-muted-foreground hover:text-destructive lg:mt-6"
                  aria-label="Remove reference link"
                >
                  <Trash2 size={14} />
                </Button>
              </CardContent>
            </Card>
          ))
        ) : (
          <Button
            type="button"
            variant="outline"
            className="min-h-20 w-full border-dashed"
            onClick={onAdd}
          >
            <Plus size={16} />
            Add a reference link
          </Button>
        )}
      </div>
    </div>
  );
}

export function ChatPanel({
  emptyText,
  rooms,
  selectedRoomId,
  messages,
  currentUserEmail,
  draft,
  onSelectRoom,
  onDraftChange,
  onSend,
  onDeleteMessage,
}: {
  emptyText: string;
  rooms: ChatRoomView[];
  selectedRoomId: string;
  messages: ChatMessage[];
  currentUserEmail: string;
  draft: string;
  onSelectRoom: (roomId: string) => void;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onDeleteMessage?: (messageId: string) => void;
}) {
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const selectedRoom =
    rooms.find((room) => room.id === selectedRoomId) || rooms[0] || null;

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages.length, selectedRoom?.id]);

  if (!rooms.length) {
    return (
      <Alert className="border-dashed">
        <AlertDescription>{emptyText}</AlertDescription>
      </Alert>
    );
  }

  return (
    <CreativeOsCard className="overflow-hidden py-0">
      <div className="grid h-[clamp(440px,calc(100vh-210px),760px)] min-w-0 grid-rows-[auto_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)] xl:grid-rows-1 2xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="min-h-0 min-w-0 border-b bg-muted/30 p-3 xl:border-b-0 xl:border-r">
          <div className="px-2 pb-2 text-xs font-bold tracking-wide uppercase text-muted-foreground">
            Editors
          </div>
          <ScrollArea className="max-h-44 pr-1 xl:max-h-none">
            <div className="space-y-1">
              {rooms.map((room) => {
                const active = room.id === selectedRoom?.id;
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => onSelectRoom(room.id)}
                    className={cn(
                      "w-full min-w-0 overflow-hidden rounded-xl px-3 py-3 text-left transition-colors",
                      active
                        ? "bg-background shadow-sm ring-1 ring-primary/15"
                        : "hover:bg-background/80",
                    )}
                  >
                    <div className="flex min-w-0 items-start gap-2 sm:gap-3">
                      <div
                        className={cn(
                          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full sm:size-10",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-primary ring-1 ring-border",
                        )}
                      >
                        <MessageCircle size={16} />
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="max-w-full truncate text-sm font-bold text-foreground">
                          {room.title}
                        </div>
                        <div className="mt-0.5 max-w-full truncate text-xs font-medium text-muted-foreground">
                          {room.description ||
                            room.assignees.join(", ") ||
                            "Founder chat"}
                        </div>
                        {room.lastMessage ? (
                          <div className="mt-1 max-w-full truncate text-xs text-muted-foreground/80">
                            {room.lastMessage.body}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
        <div className="flex min-h-0 min-w-0 flex-col bg-muted/20">
          <div className="flex items-center justify-between gap-3 border-b bg-background px-4 py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-foreground">
                {selectedRoom?.title || "Brief chat"}
              </div>
              <div className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
                {selectedRoom?.description ||
                  selectedRoom?.assignees.join(", ") ||
                  "No editors assigned"}
              </div>
            </div>
            <Badge variant="secondary">
              {messages.length} message{messages.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <ScrollArea className="min-h-0 flex-1 px-4 py-5">
            <div className="space-y-3">
              {messages.length ? (
                messages.map((message) => {
                  const mine =
                    normalizeEmail(message.authorEmail) ===
                    normalizeEmail(currentUserEmail);
                  const name =
                    message.authorName ||
                    (message.authorRole === "founder" ? "Founder" : "Editor");
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        mine ? "justify-end" : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "flex max-w-[78%] flex-col gap-1",
                          mine ? "items-end" : "items-start",
                        )}
                      >
                        <div
                          className={cn(
                            "flex items-center gap-1 px-1 text-[11px] font-semibold",
                            mine
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                        >
                          <span className="min-w-0 truncate">
                            {mine ? "You" : name} ·{" "}
                            {formatChatTime(message.createdAt)}
                          </span>
                          {onDeleteMessage ? (
                            <button
                              type="button"
                              className={cn(
                                "rounded-full p-1 opacity-60 transition hover:opacity-100",
                                mine ? "hover:bg-primary/10" : "hover:bg-muted",
                              )}
                              title="Delete message for everyone"
                              aria-label="Delete message for everyone"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "Delete this message for everyone?",
                                  )
                                ) {
                                  onDeleteMessage(message.id);
                                }
                              }}
                            >
                              <Trash2 size={12} aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                        <div
                          className={cn(
                            "rounded-[1.35rem] px-4 py-2.5 text-[15px] leading-6 shadow-sm",
                            mine
                              ? "rounded-br-md bg-primary text-primary-foreground"
                              : "rounded-bl-md bg-background text-foreground ring-1 ring-border",
                          )}
                        >
                          <ChatMessageBody body={message.body} mine={mine} />
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex min-h-[280px] items-center justify-center">
                  <Alert className="max-w-md border-dashed">
                    <AlertDescription>
                      No messages yet. Start the brief conversation here.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
              <div ref={chatBottomRef} data-chat-bottom-anchor />
            </div>
          </ScrollArea>
          <div className="shrink-0 border-t bg-background p-3">
            <div className="flex items-end gap-2 rounded-[1.75rem] border border-input bg-muted/30 px-3 py-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
              <ShadcnTextarea
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    onSend();
                  }
                }}
                rows={1}
                placeholder="Write a message..."
                className="max-h-32 min-h-10 flex-1 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
              />
              <Button
                type="button"
                size="icon"
                className="mb-0.5 size-9 shrink-0 rounded-full"
                onClick={onSend}
                disabled={!draft.trim()}
                aria-label="Send message"
              >
                <Send size={16} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </CreativeOsCard>
  );
}

export function CardList({
  title,
  icon: Icon,
  items,
  emptyText,
}: {
  title: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  items: string[];
  emptyText: string;
}) {
  return (
    <Card className="shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Icon size={16} className="text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {items.length ? (
          items.map((item) => (
            <div
              key={item}
              className="rounded-lg bg-muted/50 px-3 py-2 text-foreground"
            >
              {item}
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function AccessPersonCard({
  permission,
  statusLabel,
  statusTone,
  detail,
  actions,
}: {
  permission: ProductPermission;
  statusLabel: string;
  statusTone: "green" | "blue" | "slate";
  detail?: string;
  actions: Array<{
    label: string;
    onClick: () => void;
    tone: "primary" | "warning" | "danger" | "neutral";
    icon?: "trash";
    iconOnly?: boolean;
    ariaLabel?: string;
    disabled?: boolean;
  }>;
}) {
  const statusBadgeClass = {
    green: "border-green-200 bg-green-50 text-green-700",
    blue: "border-primary/20 bg-primary/5 text-primary",
    slate: "border-border bg-muted/40 text-muted-foreground",
  }[statusTone];
  const actionButtonProps = (
    tone: "primary" | "warning" | "danger" | "neutral",
  ) => {
    if (tone === "danger") {
      return {
        variant: "outline" as const,
        className:
          "border-destructive/20 text-destructive hover:bg-destructive/5 hover:text-destructive",
      };
    }
    if (tone === "warning") {
      return {
        variant: "outline" as const,
        className:
          "border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800",
      };
    }
    if (tone === "primary") {
      return { variant: "secondary" as const, className: undefined };
    }
    return { variant: "outline" as const, className: undefined };
  };
  const identity = permission.email || permission.userName || "Unknown editor";
  const cornerActions = actions.filter((action) => action.iconOnly);
  const rowActions = actions.filter((action) => !action.iconOnly);
  return (
    <Card className="relative min-w-0 py-0 pr-12 shadow-none ring-primary/10">
      <CardContent className="p-3.5 sm:p-4">
        {cornerActions.length ? (
          <div className="absolute right-3 top-3 flex gap-1">
            {cornerActions.map((action) => {
              const buttonProps = actionButtonProps(action.tone);
              return (
                <Button
                  key={action.label}
                  type="button"
                  variant={buttonProps.variant}
                  size="icon"
                  className={cn("size-9 rounded-xl", buttonProps.className)}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  aria-label={action.ariaLabel || action.label}
                  title={action.ariaLabel || action.label}
                >
                  {action.icon === "trash" ? (
                    <Trash2 size={15} aria-hidden="true" />
                  ) : null}
                  <span className="sr-only">{action.label}</span>
                </Button>
              );
            })}
          </div>
        ) : null}
        <div className="min-w-0">
          <div className="wrap-break-word text-[15px] font-bold leading-snug text-foreground sm:text-sm">
            {identity}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="capitalize">{permission.role}</span>
            <Badge
              variant="outline"
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
                statusBadgeClass,
              )}
            >
              {statusLabel}
            </Badge>
            {detail ? <span className="wrap-break-word">{detail}</span> : null}
          </div>
        </div>
        {rowActions.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {rowActions.map((action) => {
              const buttonProps = actionButtonProps(action.tone);
              return (
                <Button
                  key={action.label}
                  type="button"
                  variant={buttonProps.variant}
                  size="sm"
                  className={cn(
                    "min-h-10 rounded-xl sm:min-h-0",
                    buttonProps.className,
                  )}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  aria-label={action.ariaLabel || action.label}
                  title={action.ariaLabel || action.label}
                >
                  {action.icon === "trash" ? (
                    <Trash2 size={15} aria-hidden="true" />
                  ) : null}
                  {action.label}
                </Button>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function MiniFlow({ title, body }: { title: string; body: string }) {
  return (
    <Card className="py-0 shadow-none ring-primary/10">
      <CardContent className="p-4">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="mt-1 text-sm text-muted-foreground">{body}</div>
      </CardContent>
    </Card>
  );
}

type StrategyPickerMode = "audience" | "angle" | "style" | "hook";

export function StrategyPicker({
  personas,
  selectedPersonas,
  onPick,
  onEditCatalog,
  onRefreshPersonas,
  personasRefreshing = false,
  angles = [],
  selectedAngles = [],
  onRefreshAngles,
  anglesRefreshing = false,
  hooks = [],
  selectedHooks = [],
  onRefreshHooks,
  hooksRefreshing = false,
  styles = [],
  selectedStyles = [],
  onRefreshStyles,
  stylesRefreshing = false,
}: {
  personas: string[];
  selectedPersonas: string[];
  onPick: (
    kind: "reason" | "pain" | "persona" | "claim" | "hook" | "style",
    value: string,
  ) => void;
  onEditCatalog: () => void;
  onRefreshPersonas?: () => void;
  personasRefreshing?: boolean;
  angles?: string[];
  selectedAngles?: string[];
  onRefreshAngles?: () => void;
  anglesRefreshing?: boolean;
  hooks?: string[];
  selectedHooks?: string[];
  onRefreshHooks?: () => void;
  hooksRefreshing?: boolean;
  styles?: readonly string[];
  selectedStyles?: string[];
  onRefreshStyles?: () => void;
  stylesRefreshing?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [mode, setMode] = useState<StrategyPickerMode>("audience");

  const dedupeItems = (base: readonly string[], selected: string[]) =>
    Array.from(
      new Set(
        [...base, ...selected]
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => item.toLowerCase()),
      ),
    )
      .map(
        (lowerItem) =>
          [...selected, ...base].find(
            (item) => item.trim().toLowerCase() === lowerItem,
          )?.trim() || lowerItem,
      )
      .filter(Boolean);

  // Each tab toggles its picks into a different brief field via onPick:
  // audiences -> personas/notes, angles -> angle list, formats -> format list,
  // hooks -> hook list. All four reuse the same chip UI below.
  const modes: Array<{
    key: StrategyPickerMode;
    tab: string;
    group: string;
    noun: string;
    selectLabel: string;
    kind: "reason" | "persona" | "hook" | "style";
    items: string[];
    selected: string[];
    onRefresh?: () => void;
    refreshing: boolean;
  }> = [
    {
      key: "audience",
      tab: "Audiences",
      group: "Audiences",
      noun: "audience",
      selectLabel: "Select audience",
      kind: "persona",
      items: dedupeItems(personas, selectedPersonas),
      selected: selectedPersonas,
      onRefresh: onRefreshPersonas,
      refreshing: personasRefreshing,
    },
    {
      key: "angle",
      tab: "Angles",
      group: "Angles",
      noun: "angle",
      selectLabel: "Select angle",
      kind: "reason",
      items: dedupeItems(angles, selectedAngles),
      selected: selectedAngles,
      onRefresh: onRefreshAngles,
      refreshing: anglesRefreshing,
    },
    {
      key: "style",
      tab: "Styles",
      group: "Styles",
      noun: "style",
      selectLabel: "Select style",
      kind: "style",
      items: dedupeItems(styles, selectedStyles),
      selected: selectedStyles,
      onRefresh: onRefreshStyles,
      refreshing: stylesRefreshing,
    },
    {
      key: "hook",
      tab: "Hooks",
      group: "Hooks",
      noun: "hook",
      selectLabel: "Select hook",
      kind: "hook",
      items: dedupeItems(hooks, selectedHooks),
      selected: selectedHooks,
      onRefresh: onRefreshHooks,
      refreshing: hooksRefreshing,
    },
  ];

  if (modes.every((entry) => !entry.items.length)) return null;

  const active = modes.find((entry) => entry.key === mode) || modes[0];
  const activeItems = active.items;
  const activeSelected = active.selected;
  const activeKind = active.kind;
  const activeRefresh = active.onRefresh;
  const activeRefreshing = active.refreshing;
  const noun = active.noun;
  const groupLabel = active.group;
  const customTrimmed = customValue.trim();

  return (
    <Card className="min-w-0 overflow-hidden py-0 shadow-none">
      <CardHeader className="flex min-w-0 flex-col gap-3 border-b px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-foreground">
              Who is this brief for?
            </span>
            <span className="mt-0.5 block text-xs font-semibold text-muted-foreground">
              Pick audiences, angles, styles and hooks. Magic Fill turns them
              into the brief.
            </span>
          </span>
          <ChevronRight
            size={16}
            className={cn(
              "shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
        </button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full shrink-0 sm:w-auto"
          onClick={onEditCatalog}
        >
          Edit in Products
        </Button>
      </CardHeader>
      {open ? (
        <CardContent className="min-w-0 space-y-4 p-3 sm:p-4">
          <div className="min-w-0 rounded-xl border border-border/60 bg-muted/30 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="text-sm font-bold text-foreground">
                  {active.selectLabel}
                </div>
                <div className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
                  You can select more than one. Then click Magic Fill below to
                  generate the brief.
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1 rounded-lg bg-muted p-1">
                {modes.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => setMode(entry.key)}
                    className={cn(
                      "flex-1 rounded-md px-3 py-1.5 text-xs font-bold transition-colors sm:flex-none",
                      mode === entry.key
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {entry.tab}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 min-w-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs font-bold tracking-wide uppercase text-muted-foreground">
                  {groupLabel}
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {activeSelected.length} selected
                  </Badge>
                  {activeRefresh ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="max-w-full"
                      onClick={activeRefresh}
                      disabled={activeRefreshing}
                    >
                      {activeRefreshing ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCcw size={14} />
                      )}
                      <span className="truncate">Refresh {groupLabel.toLowerCase()}</span>
                    </Button>
                  ) : null}
                </div>
              </div>
              {activeItems.length ? (
                <div className="mt-2 space-y-1.5">
                  {activeItems.map((item) => {
                    const isSelected = activeSelected.some(
                      (selected) =>
                        selected.trim().toLowerCase() === item.toLowerCase(),
                    );
                    return (
                      <button
                        key={`${mode}-${item}`}
                        type="button"
                        onClick={() => onPick(activeKind, item)}
                        className={cn(
                          "flex w-full min-w-0 flex-col gap-1 rounded-lg border bg-background px-3 py-2 text-left text-sm font-semibold transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-3",
                          isSelected
                            ? "border-primary/25 bg-primary/5 text-primary"
                            : "border-border text-foreground hover:border-primary/20 hover:bg-primary/5 hover:text-primary",
                        )}
                      >
                        <span className="min-w-0 wrap-break-word sm:truncate">
                          {item}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-[11px] font-bold",
                            isSelected ? "text-destructive" : "text-primary",
                          )}
                        >
                          {isSelected ? "Remove" : `Add ${noun}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-xs font-semibold text-muted-foreground">
                  No {groupLabel.toLowerCase()} yet. Add your own below
                  {activeRefresh ? ` or click Refresh ${groupLabel.toLowerCase()}` : ""}.
                </p>
              )}
              <div className="mt-3 rounded-lg border border-dashed border-border bg-background p-3">
                <div className="mb-2 text-xs font-bold tracking-wide uppercase text-muted-foreground">
                  Other {noun}
                </div>
                <form
                  className="flex min-w-0 flex-col gap-2 sm:flex-row"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!customTrimmed) return;
                    onPick(activeKind, customTrimmed);
                    setCustomValue("");
                  }}
                >
                  <ShadcnInput
                    value={customValue}
                    onChange={(event) => setCustomValue(event.target.value)}
                    placeholder={`Write your own ${noun}`}
                    className="h-9 min-w-0 w-full flex-1"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto"
                    disabled={!customTrimmed}
                  >
                    Add {noun}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

export function TagInput({
  title,
  description,
  items,
  placeholder,
  onChange,
  muted = false,
  onUpgrade,
  isUpgrading = false,
  onEnhanceDraft,
  isEnhancing = false,
  variant = "card",
}: {
  title: string;
  description?: string;
  items: string[];
  placeholder: string;
  onChange: (items: string[]) => void;
  muted?: boolean;
  onUpgrade?: () => void;
  isUpgrading?: boolean;
  onEnhanceDraft?: (input: string) => Promise<string>;
  isEnhancing?: boolean;
  variant?: "card" | "embedded";
}) {
  const [draft, setDraft] = useState("");
  const cleanItems = items.map((item) => item.trim()).filter(Boolean);
  const addItems = () => {
    const nextItems = draft
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!nextItems.length) return;
    const merged = [...cleanItems, ...nextItems];
    onChange(merged);
    setDraft("");
  };
  const updateItem = (index: number, value: string) => {
    onChange(
      cleanItems.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  };
  const removeItem = (index: number) => {
    onChange(cleanItems.filter((_, itemIndex) => itemIndex !== index));
  };
  const enhanceDraft = async () => {
    if (!onEnhanceDraft || !draft.trim()) return;
    const enhanced = await onEnhanceDraft(draft);
    setDraft(enhanced);
  };

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <CardTitle className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
          {title}
        </CardTitle>
        {description ? (
          <p className="mt-1 text-xs font-medium leading-5 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {onUpgrade ? (
          <MagicButton
            tone="soft"
            size="xs"
            onClick={onUpgrade}
            loading={isUpgrading}
          >
            {isUpgrading ? "Filling" : "Magic Fill"}
          </MagicButton>
        ) : null}
        <Badge variant="secondary">{cleanItems.length}</Badge>
      </div>
    </div>
  );

  const body = (
    <>
      {cleanItems.length ? (
        <div className="space-y-2">
          {cleanItems.map((item, index) => (
            <div
              key={`${item}-${index}`}
              className="flex min-w-0 items-center gap-2"
            >
              <ShadcnInput
                value={item}
                onChange={(event) => updateItem(index, event.target.value)}
                onBlur={() =>
                  onChange(
                    cleanItems
                      .map((currentItem, itemIndex) =>
                        itemIndex === index ? item : currentItem,
                      )
                      .map((currentItem) => currentItem.trim())
                      .filter(Boolean),
                  )
                }
                className={cn(
                  "h-9 min-w-0 flex-1 font-medium",
                  muted && "text-muted-foreground",
                )}
              />
              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                className="shrink-0"
                onClick={() => removeItem(index)}
                aria-label={`Delete ${item}`}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed px-3 py-3 text-sm font-medium text-muted-foreground">
          {placeholder || "Add the first item below."}
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
        <ShadcnInput
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addItems();
            }
          }}
          placeholder="Add one item, or paste multiple with commas"
          className="h-9 min-w-0 flex-1 sm:min-w-[180px]"
        />
        {onEnhanceDraft ? (
          <MagicButton
            tone="soft"
            size="sm"
            className="w-full sm:w-auto"
            onClick={enhanceDraft}
            loading={isEnhancing}
            disabled={!draft.trim()}
          >
            {isEnhancing ? "Enhancing" : "Enhance"}
          </MagicButton>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={addItems}
          disabled={!draft.trim()}
        >
          <Plus size={15} />
          Add
        </Button>
      </div>
    </>
  );

  if (variant === "embedded") {
    return (
      <div className="min-w-0 space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3 sm:p-4">
        {header}
        <div className="space-y-3">{body}</div>
      </div>
    );
  }

  return (
    <Card className="gap-3 py-4 shadow-none">
      <CardHeader className="pb-0">{header}</CardHeader>
      <CardContent className="space-y-3">{body}</CardContent>
    </Card>
  );
}
