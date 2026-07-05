"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { buildMetaConnectHref, META_RETURN_PATHS } from "@/lib/meta-oauth";
import { timeAgo } from "../utils";
import { InboxRow } from "../_components/InboxRow";
import { MessageBubble } from "../_components/MessageBubble";
import { EmptyState } from "../_components/EmptyState";
import { SectionHeader } from "../_components/SectionHeader";
import { AutoReplyStatusStrip } from "../_components/AutoReplyStatusStrip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PillTabBar } from "@/components/PillTabBar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AutoReplySettings } from "@/lib/cs-auto-reply";

type WebhookStatusPayload = {
  connected?: boolean;
  pageId?: string;
  pageName?: string;
  subscribed?: boolean;
  appSubscribed?: boolean;
  subscribedFields?: string[];
  missingFields?: string[];
  verifyTokenConfigured?: boolean;
  appSecretConfigured?: boolean;
  error?: string;
};

type SocialTabKey = "ig-dms" | "fb-dms" | "ig-comments" | "fb-comments";

interface SocialsTabProps {
  tenantId: string | null;
  socialConnections: {
    instagram: boolean;
    facebook: boolean;
    igMessaging?: boolean;
    igPosting?: boolean;
    fbMessaging?: boolean;
    fbPosting?: boolean;
  };
  socialTab: SocialTabKey;
  setSocialTab: (tab: SocialTabKey) => void;
  selectedConversation: any;
  setSelectedConversation: (c: any) => void;
  socialReplyText: string;
  setSocialReplyText: (text: string) => void;
  socialReplyError: string;
  setSocialReplyError: (err: string) => void;
  socialReplyLoading: boolean;
  commentReplyDrafts: Record<string, string>;
  setCommentReplyDrafts: (
    updater: (prev: Record<string, string>) => Record<string, string>,
  ) => void;
  commentReplyLoadingId: string | null;
  socialLoading: boolean;
  socialError: string;
  socialData: any[];
  conversationLoading: boolean;
  conversationMessages: any[];
  selectConversation: (c: any) => Promise<void>;
  sendSocialDmReply: () => Promise<void>;
  sendSocialCommentReply: (commentId: string) => Promise<void>;
  autoReplySettings: AutoReplySettings;
  onOpenAutoReplySettings: () => void;
}

const SOCIAL_TABS: {
  key: SocialTabKey;
  label: string;
  connected: (connections: SocialsTabProps["socialConnections"]) => boolean;
}[] = [
  {
    key: "ig-dms",
    label: "IG DMs",
    connected: (c) => c.igMessaging ?? c.instagram,
  },
  {
    key: "fb-dms",
    label: "FB DMs",
    connected: (c) => c.fbMessaging ?? c.facebook,
  },
  {
    key: "ig-comments",
    label: "IG Comments",
    connected: (c) => c.igPosting ?? c.instagram,
  },
  {
    key: "fb-comments",
    label: "FB Comments",
    connected: (c) => c.fbPosting ?? c.facebook,
  },
];

function InstagramIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <radialGradient id="ig-grad-cs" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="5%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="20"
        height="20"
        rx="5"
        stroke="url(#ig-grad-cs)"
        strokeWidth="2"
        fill="none"
      />
      <circle
        cx="12"
        cy="12"
        r="4.5"
        stroke="url(#ig-grad-cs)"
        strokeWidth="2"
        fill="none"
      />
      <circle cx="17.5" cy="6.5" r="1.2" fill="url(#ig-grad-cs)" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="#1877F2" aria-hidden>
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
    </svg>
  );
}

function listTitle(tab: SocialTabKey) {
  switch (tab) {
    case "ig-dms":
      return "Instagram DMs";
    case "fb-dms":
      return "Facebook DMs";
    case "ig-comments":
      return "Instagram Comments";
    default:
      return "Facebook Comments";
  }
}

function postContentPreview(content: string, maxLength = 120) {
  const text = content.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

export default function SocialsTab({
  tenantId,
  socialConnections,
  socialTab,
  setSocialTab,
  selectedConversation,
  setSelectedConversation,
  socialReplyText,
  setSocialReplyText,
  socialReplyError,
  setSocialReplyError,
  socialReplyLoading,
  commentReplyDrafts,
  setCommentReplyDrafts,
  commentReplyLoadingId,
  socialLoading,
  socialError,
  socialData,
  conversationLoading,
  conversationMessages,
  selectConversation,
  sendSocialDmReply,
  sendSocialCommentReply,
  autoReplySettings,
  onOpenAutoReplySettings,
}: SocialsTabProps) {
  const router = useRouter();
  const [webhookStatus, setWebhookStatus] =
    useState<WebhookStatusPayload | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookRepairLoading, setWebhookRepairLoading] = useState(false);
  const [webhookNotice, setWebhookNotice] = useState("");
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  useEffect(() => {
    if (!mobileShowDetail) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileShowDetail(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileShowDetail]);

  const handleSelectConversation = (c: any) => {
    setMobileShowDetail(true);
    void selectConversation(c);
  };

  const handleSelectComment = (c: any) => {
    setSelectedConversation(c);
    setMobileShowDetail(true);
  };

  const loadWebhookStatus = useCallback(async () => {
    if (!tenantId) return;
    setWebhookLoading(true);
    try {
      const res = await fetch(
        `/api/cs/social/webhooks/status?tenant_id=${encodeURIComponent(tenantId)}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as WebhookStatusPayload & {
        revoked?: boolean;
      };
      setWebhookStatus(data);
      if (data.revoked) {
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch {
      setWebhookStatus({
        connected: false,
        subscribed: false,
        error: "Could not check webhook status",
      });
    } finally {
      setWebhookLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (
      !tenantId ||
      (!socialConnections.instagram && !socialConnections.facebook)
    ) {
      setWebhookStatus(null);
      return;
    }
    void loadWebhookStatus();
  }, [
    tenantId,
    socialConnections.instagram,
    socialConnections.facebook,
    loadWebhookStatus,
  ]);

  const repairWebhooks = async () => {
    if (!tenantId || webhookRepairLoading) return;
    setWebhookRepairLoading(true);
    setWebhookNotice("");
    try {
      const res = await fetch("/api/cs/social/webhooks/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWebhookNotice(String(data.error || "Repair failed"));
        if (data.revoked) {
          setTimeout(() => window.location.reload(), 1500);
        }
        return;
      }
      toast.success("Webhooks repaired");
      setWebhookNotice(
        String(
          data.message ||
            (data.ok ? "Webhooks repaired." : "Repair incomplete"),
        ),
      );
      await loadWebhookStatus();
    } catch {
      setWebhookNotice("Repair failed - try again.");
    } finally {
      setWebhookRepairLoading(false);
    }
  };

  const commentsList = (socialData || []).flatMap((post: any) => {
    return (post.comments || []).map((comment: any) => ({
      ...comment,
      postId: post.id,
      postContent: post.content,
      postPermalink: post.permalink,
      postPicture: post.picture,
    }));
  });

  useEffect(() => {
    if (!selectedConversation || !socialTab.includes("comments") || !socialData)
      return;
    for (const post of socialData) {
      const found = (post.comments || []).find(
        (c: any) => c.id === selectedConversation.id,
      );
      if (found) {
        if (
          JSON.stringify(found.replies) !==
          JSON.stringify(selectedConversation.replies)
        ) {
          setSelectedConversation({
            ...found,
            postId: post.id,
            postContent: post.content,
            postPermalink: post.permalink,
            postPicture: post.picture,
          });
        }
        break;
      }
    }
  }, [socialData, socialTab, selectedConversation, setSelectedConversation]);

  const handleSocialTabChange = (tab: SocialTabKey) => {
    const tabConfig = SOCIAL_TABS.find((t) => t.key === tab);
    if (!tabConfig?.connected(socialConnections)) return;
    setSocialTab(tab);
    setSelectedConversation(null);
    setMobileShowDetail(false);
    setSocialReplyText("");
    setSocialReplyError("");
    setCommentReplyDrafts(() => ({}));
  };

  if (!socialConnections.instagram && !socialConnections.facebook) {
    const connectMetaMessaging = () => {
      if (!tenantId) return;
      window.location.href = buildMetaConnectHref({
        tenantId,
        intent: "messaging",
        platform: "both",
        returnTo: META_RETURN_PATHS.intelliSupport,
        force: true,
      });
    };

    return (
      <div className="max-w-lg">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-border/60">
                  <InstagramIcon />
                </div>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-border/60">
                  <FacebookIcon />
                </div>
              </div>
              <Badge variant="secondary">Not connected</Badge>
            </div>
            <CardTitle className="mt-2">Meta Messaging</CardTitle>
            <CardDescription>
              Connect once to manage Instagram and Facebook support from one
              inbox.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-foreground/40" aria-hidden>
                  ·
                </span>
                <span>Instagram direct messages and post comments</span>
              </li>
              <li className="flex gap-2">
                <span className="text-foreground/40" aria-hidden>
                  ·
                </span>
                <span>Facebook Page messaging and post comments</span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={connectMetaMessaging}>
              Connect Meta Messaging
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const webhookNeedsRepair =
    webhookStatus &&
    webhookStatus.connected !== false &&
    webhookStatus.subscribed === false;
  const webhookHealthy =
    Boolean(webhookStatus?.subscribed) &&
    !webhookNeedsRepair &&
    !webhookLoading;
  const showLiveWebhookBadge =
    (socialConnections.instagram || socialConnections.facebook) &&
    webhookHealthy;
  const showWebhookBanner =
    (socialConnections.instagram || socialConnections.facebook) &&
    !webhookHealthy &&
    (webhookLoading ||
      webhookNeedsRepair ||
      Boolean(webhookNotice) ||
      Boolean(webhookStatus?.error && webhookStatus.connected === false) ||
      webhookStatus?.verifyTokenConfigured === false);

  const listCount = socialTab.includes("dms")
    ? socialData.length
    : commentsList.length;

  const detailCardClassName =
    "flex max-h-[700px] min-w-0 flex-col gap-0 overflow-hidden py-0";

  const detailPanel = (
    <>
      {conversationLoading ? (
        <div className="flex items-center justify-center flex-1 p-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : selectedConversation && socialTab.includes("dms") ? (
        <>
          <CardHeader className="p-0 space-y-0 border-b">
            <div className="px-5 py-4">
              {mobileShowDetail && selectedConversation ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 px-2 mb-2 -ml-2 text-muted-foreground lg:hidden"
                  onClick={() => setMobileShowDetail(false)}
                >
                  <ChevronLeft className="size-4" />
                  Back
                </Button>
              ) : null}
              <div className="flex items-center min-w-0 gap-3">
                <div className="flex items-center justify-center text-sm font-semibold rounded-full size-8 shrink-0 bg-primary/10 text-primary">
                  {(selectedConversation.participantName || "?")
                    .charAt(0)
                    .toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base font-semibold">
                    {selectedConversation.participantName}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {socialTab.startsWith("fb")
                      ? "Facebook DM"
                      : "Instagram DM"}
                    {selectedConversation.followerCount != null &&
                      ` · ${selectedConversation.followerCount.toLocaleString()} followers`}
                  </p>
                </div>
                {selectedConversation.url ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="shrink-0"
                  >
                    <a
                      href={selectedConversation.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open source
                      <ExternalLink className="size-3.5" />
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          </CardHeader>

          <ScrollArea className="flex-1 min-w-0 overflow-x-hidden">
            <div className="flex flex-col min-w-0 gap-3 p-5 overflow-x-hidden">
              {conversationMessages.length === 0 ? (
                <EmptyState message="No messages loaded" className="py-8" />
              ) : (
                conversationMessages.map((msg: any) => {
                  const isOut = msg.direction === "outgoing";
                  return (
                    <MessageBubble
                      key={msg.id}
                      variant={isOut ? "outgoing" : "incoming"}
                      align={isOut ? "end" : "start"}
                    >
                      <div>{msg.text || "(empty)"}</div>
                      <div
                        className={cn(
                          "mt-1 flex items-center gap-1 text-[10px]",
                          isOut ? "text-primary/70" : "text-muted-foreground",
                        )}
                      >
                        {isOut ? (
                          <Badge
                            variant="secondary"
                            className="h-4 px-1.5 text-[9px]"
                          >
                            Sent
                          </Badge>
                        ) : null}
                        <span>
                          {msg.from || ""}
                          {msg.from ? " · " : ""}
                          {msg.createdAt ? timeAgo(msg.createdAt) : ""}
                        </span>
                      </div>
                    </MessageBubble>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <CardFooter className="flex-col items-stretch gap-2 px-5 py-4 mt-auto border-t bg-background">
            {socialReplyError ? (
              <Alert variant="destructive" className="py-2">
                <AlertDescription>{socialReplyError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex gap-2">
              <Textarea
                value={socialReplyText}
                onChange={(e) => setSocialReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendSocialDmReply();
                  }
                }}
                placeholder={
                  socialTab === "fb-dms"
                    ? "Reply on Messenger…"
                    : "Reply on Instagram…"
                }
                disabled={socialReplyLoading}
                rows={2}
                className="flex-1 resize-none min-h-10"
              />
              <Button
                disabled={!socialReplyText.trim() || socialReplyLoading}
                onClick={() => void sendSocialDmReply()}
                className="self-end shrink-0"
              >
                {socialReplyLoading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send"
                )}
              </Button>
            </div>
          </CardFooter>
        </>
      ) : selectedConversation && socialTab.includes("comments") ? (
        <>
          <CardHeader className="p-0 space-y-0 border-b">
            <div className="px-5 py-4">
              {mobileShowDetail && selectedConversation ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 px-2 mb-2 -ml-2 text-muted-foreground lg:hidden"
                  onClick={() => setMobileShowDetail(false)}
                >
                  <ChevronLeft className="size-4" />
                  Back
                </Button>
              ) : null}
              <div className="flex items-center min-w-0 gap-3">
                <div className="flex items-center justify-center text-sm rounded-full size-8 shrink-0 bg-primary/10">
                  💬
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base font-semibold">
                    Comment Thread
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {selectedConversation.replies?.length || 0} replies ·{" "}
                    {selectedConversation.likeCount || 0} likes
                  </p>
                </div>
                {selectedConversation.postPermalink ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="shrink-0"
                  >
                    <a
                      href={selectedConversation.postPermalink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Post
                      <ExternalLink className="size-3.5" />
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          </CardHeader>

          <ScrollArea className="flex-1 min-w-0 overflow-x-hidden">
            <div className="flex flex-col min-w-0 gap-4 p-5 overflow-x-hidden">
              {selectedConversation.postContent ? (
                <div className="min-w-0 p-3 border rounded-xl bg-muted/30">
                  <div className="mb-1 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                    Post preview
                  </div>
                  <p className="text-sm line-clamp-2 text-muted-foreground">
                    {postContentPreview(selectedConversation.postContent)}
                  </p>
                </div>
              ) : null}

              <div className="min-w-0 p-4 border rounded-xl border-border/60">
                <div className="flex items-center min-w-0 gap-2 mb-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-semibold text-indigo-700">
                    {(selectedConversation.from || "?").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold wrap-break-word">
                      {selectedConversation.from || "Unknown"}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {selectedConversation.createdTime
                        ? timeAgo(selectedConversation.createdTime)
                        : ""}
                    </div>
                  </div>
                  {selectedConversation.likeCount > 0 ? (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      ❤️ {selectedConversation.likeCount}
                    </span>
                  ) : null}
                </div>
                <p className="min-w-0 text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">
                  {selectedConversation.message || "(empty comment)"}
                </p>
              </div>

              <Separator />

              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Replies ({(selectedConversation.replies || []).length})
              </div>

              {!selectedConversation.replies ||
              selectedConversation.replies.length === 0 ? (
                <EmptyState
                  message="No replies yet. Use the reply box below to start the conversation."
                  className="py-6"
                />
              ) : (
                <div className="flex flex-col min-w-0 gap-3 overflow-x-hidden">
                  {selectedConversation.replies.map((reply: any) => {
                    const isOwn =
                      reply.from === "You" ||
                      reply.from === "Page" ||
                      reply.from === "Instagram Business Account";
                    return (
                      <MessageBubble
                        key={reply.id}
                        variant={isOwn ? "outgoing" : "incoming"}
                        align={isOwn ? "end" : "start"}
                        speaker={reply.from || "Unknown"}
                      >
                        {reply.message}
                        <div className="mt-1 text-[9px] text-muted-foreground">
                          {reply.createdTime ? timeAgo(reply.createdTime) : ""}
                        </div>
                      </MessageBubble>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>

          <CardFooter className="flex-col items-stretch gap-2 px-5 py-4 mt-auto border-t bg-background">
            {socialReplyError ? (
              <Alert variant="destructive" className="py-2">
                <AlertDescription>{socialReplyError}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex gap-2">
              <Textarea
                value={commentReplyDrafts[selectedConversation.id] || ""}
                onChange={(e) =>
                  setCommentReplyDrafts((current) => ({
                    ...current,
                    [selectedConversation.id]: e.target.value,
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendSocialCommentReply(selectedConversation.id);
                  }
                }}
                placeholder={
                  socialTab === "fb-comments"
                    ? "Reply on Facebook…"
                    : "Reply on Instagram…"
                }
                disabled={commentReplyLoadingId === selectedConversation.id}
                rows={2}
                className="flex-1 resize-none min-h-10"
              />
              <Button
                disabled={
                  !(commentReplyDrafts[selectedConversation.id] || "").trim() ||
                  commentReplyLoadingId === selectedConversation.id
                }
                onClick={() =>
                  void sendSocialCommentReply(selectedConversation.id)
                }
                className="self-end shrink-0"
              >
                {commentReplyLoadingId === selectedConversation.id ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Reply"
                )}
              </Button>
            </div>
          </CardFooter>
        </>
      ) : (
        <EmptyState
          message={
            socialTab.includes("dms")
              ? "Select a conversation to view messages"
              : "Select a post to view comments"
          }
          className="flex-1 py-16"
        >
          <MessageCircle className="mb-2 size-12 text-muted-foreground/40" />
        </EmptyState>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      <AutoReplyStatusStrip
        settings={autoReplySettings}
        channels={["instagram", "facebook"]}
        onOpenSettings={onOpenAutoReplySettings}
      />
      {showLiveWebhookBadge ? (
        <Badge
          variant="outline"
          className="gap-1.5 border-green-200 bg-green-50 font-normal text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-100"
        >
          <CheckCircle2 className="size-3 shrink-0" />
          Live webhooks
        </Badge>
      ) : null}

      {showWebhookBanner ? (
        <Alert
          className={cn(
            webhookNeedsRepair &&
              "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
          )}
        >
          {webhookLoading ? (
            <>
              <Loader2 className="animate-spin" />
              <AlertTitle>Checking webhooks</AlertTitle>
              <AlertDescription>
                Checking live webhook delivery…
              </AlertDescription>
            </>
          ) : webhookNeedsRepair ? (
            <>
              <AlertTriangle />
              <AlertTitle>Webhooks need repair</AlertTitle>
              <AlertDescription>
                {webhookStatus?.error ||
                  "Incoming DMs and comments may not reach this inbox until the Facebook Page is re-subscribed."}
                {webhookStatus?.pageName ? ` (${webhookStatus.pageName})` : ""}
              </AlertDescription>
              <div className="col-start-2 mt-3">
                <Button
                  size="sm"
                  disabled={webhookRepairLoading}
                  onClick={() => void repairWebhooks()}
                >
                  {webhookRepairLoading ? (
                    <>
                      <Loader2 className="animate-spin" />
                      Repairing…
                    </>
                  ) : (
                    "Repair webhooks"
                  )}
                </Button>
              </div>
            </>
          ) : webhookStatus?.error ? (
            <>
              <AlertTriangle />
              <AlertTitle>Webhook status</AlertTitle>
              <AlertDescription>{webhookStatus.error}</AlertDescription>
            </>
          ) : null}
          {webhookNotice &&
          !webhookNeedsRepair &&
          webhookStatus?.subscribed !== true ? (
            <AlertDescription className="col-start-2 mt-2">
              {webhookNotice}
            </AlertDescription>
          ) : null}
          {webhookStatus && !webhookStatus.verifyTokenConfigured ? (
            <AlertDescription className="col-start-2 mt-2 text-xs">
              Server: set META_WEBHOOK_VERIFY_TOKEN so Meta can verify the
              callback URL.
            </AlertDescription>
          ) : null}
        </Alert>
      ) : null}

      <PillTabBar
        tabs={SOCIAL_TABS.map((tab) => ({
          id: tab.key,
          label: tab.label,
          shortLabel: tab.label.split(" ")[0],
        }))}
        activeId={socialTab}
        onChange={handleSocialTabChange}
        ariaLabel="Social sections"
      />

      <div
        className={cn(
          "mb-8 grid-cols-1 gap-4 lg:grid-cols-5",
          mobileShowDetail && selectedConversation ? "hidden lg:grid" : "grid",
        )}
      >
        <Card
          className={cn(
            "flex flex-col overflow-hidden py-0 lg:col-span-2 gap-0",
            mobileShowDetail &&
              selectedConversation &&
              "hidden lg:flex lg:flex-col",
          )}
        >
          <CardHeader className="py-3 border-b">
            <SectionHeader
              className="mb-0"
              title={listTitle(socialTab)}
              action={
                <span className="text-xs text-muted-foreground">
                  {socialLoading
                    ? "…"
                    : socialTab.includes("dms")
                      ? `${listCount} chats`
                      : `${listCount} comments`}
                </span>
              }
            />
          </CardHeader>
          <ScrollArea className="h-[640px]">
            {socialLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="w-full h-16" />
                ))}
              </div>
            ) : socialError ? (
              <EmptyState
                message={socialError}
                actionLabel="Check Meta connection"
                onAction={() =>
                  router.push("/dashboard/settings?tab=integrations")
                }
              >
                <p className="mt-2 text-sm font-semibold text-foreground">
                  Connected, but no inbox data loaded
                </p>
              </EmptyState>
            ) : (
                socialTab.includes("dms")
                  ? socialData.length === 0
                  : commentsList.length === 0
              ) ? (
              <EmptyState
                message={
                  socialTab.includes("dms")
                    ? "No recent messages"
                    : "No comments available"
                }
              />
            ) : socialTab.includes("dms") ? (
              socialData.map((c: any) => (
                <InboxRow
                  key={c.id}
                  selected={selectedConversation?.id === c.id}
                  onClick={() => handleSelectConversation(c)}
                  title={c.participantName || "Unknown"}
                  subtitle={c.lastMessage || "(no message preview)"}
                  meta={c.updatedTime ? timeAgo(c.updatedTime) : ""}
                  badges={
                    <>
                      <Badge variant="secondary">
                        {c.status === "active" ? "Active" : c.status}
                      </Badge>
                      {c.followerCount != null ? (
                        <span className="text-[11px] text-muted-foreground">
                          {c.followerCount.toLocaleString()} followers
                        </span>
                      ) : null}
                    </>
                  }
                />
              ))
            ) : (
              commentsList.map((c: any) => (
                <InboxRow
                  key={c.id}
                  selected={selectedConversation?.id === c.id}
                  onClick={() => handleSelectComment(c)}
                  title={c.from || "Unknown"}
                  subtitle={c.message || "(empty comment)"}
                  meta={c.createdTime ? timeAgo(c.createdTime) : ""}
                  badges={
                    <>
                      <Badge
                        variant={
                          (c.replies?.length || 0) > 0 ? "default" : "secondary"
                        }
                      >
                        {c.replies?.length || 0}{" "}
                        {(c.replies?.length || 0) === 1 ? "reply" : "replies"}
                      </Badge>
                      {c.likeCount > 0 ? (
                        <span className="text-[11px] text-muted-foreground">
                          {c.likeCount} {c.likeCount === 1 ? "like" : "likes"}
                        </span>
                      ) : null}
                    </>
                  }
                />
              ))
            )}
          </ScrollArea>
        </Card>

        <Card
          className={cn(
            detailCardClassName,
            "hidden lg:col-span-3 lg:flex lg:flex-col",
          )}
        >
          {detailPanel}
        </Card>
      </div>

      {mobileShowDetail && selectedConversation ? (
        <Card
          className={cn(detailCardClassName, "mb-8 flex flex-col lg:hidden")}
        >
          {detailPanel}
        </Card>
      ) : null}
    </div>
  );
}
