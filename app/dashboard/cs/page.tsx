"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import ConnectionStatus from "../../../components/ConnectionStatus";
import RefreshButton from "../../../components/RefreshButton";
import ChangeRequestModal from "../../../components/ChangeRequestModal";
import { getSession, getSessionTenantId } from "../../../lib/session";
import {
  buildShopifyConnectHref,
  SHOPIFY_RETURN_PATHS,
} from "../../../lib/shopify-oauth";
import AppSettingsPanel from "../../../components/AppSettingsPanel";
import AutomationWorkspaceLayout, {
  type AutomationNavItem,
} from "../../../components/AutomationWorkspaceLayout";
import {
  Mail,
  MessageCircle,
  Phone,
  Settings,
  X,
  Settings2,
} from "lucide-react";
import { Alert, AlertDescription, AlertAction } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConnectionStrip } from "./_components/ConnectionStrip";
import { AutoReplySettingsPanel } from "./_components/AutoReplySettingsPanel";
import { getEmailStatus } from "./utils";
import {
  DEFAULT_AUTO_REPLY,
  type AutoReplySettings,
} from "@/lib/cs-auto-reply";

import {
  Email,
  EmailDetail,
  Stats,
  CallItem,
  TranscriptLine,
  Category,
  SendAs,
  CSConfig,
} from "./types";
import { getTodayMidnight } from "./utils";

import MailTab from "./components/MailTab";
import CallsTab from "./components/CallsTab";
import SocialsTab from "./components/SocialsTab";

export default function CSPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailDetail | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sendAs, setSendAs] = useState<SendAs[]>([]);
  const [config, setConfig] = useState<CSConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [changeModal, setChangeModal] = useState<{
    section: string;
    fields: Array<{
      label: string;
      placeholder: string;
      key: string;
      type?: "text" | "textarea";
    }>;
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [category, setCategory] = useState<Category>("all");
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<number>(7);
  const [view, setView] = useState<"inbox" | "sent">("inbox");
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [sentLoading, setSentLoading] = useState(false);
  const [escalations, setEscalations] = useState<
    Array<{
      id: string;
      subject: string;
      from: string;
      date: string;
      escalatedTo: string;
      status: string;
      threadId: string;
    }>
  >([]);
  const [mainTab, setMainTab] = useState<
    "mail" | "socials" | "calls" | "settings"
  >("mail");
  const [socialTab, setSocialTab] = useState<
    "ig-dms" | "fb-dms" | "ig-comments" | "fb-comments"
  >("ig-dms");
  const [socialConnections, setSocialConnections] = useState<{
    instagram: boolean;
    facebook: boolean;
    igMessaging?: boolean;
    igPosting?: boolean;
    fbMessaging?: boolean;
    fbPosting?: boolean;
  }>({
    instagram: false,
    facebook: false,
  });
  const [twilioStatus, setTwilioStatus] = useState<{
    connected: boolean;
    number?: string;
    status?: string;
  }>({
    connected: false,
  });
  const [socialData, setSocialData] = useState<any[]>([]);
  const [socialError, setSocialError] = useState("");
  const [socialLoading, setSocialLoading] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [conversationMessages, setConversationMessages] = useState<any[]>([]);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [socialReplyText, setSocialReplyText] = useState("");
  const [socialReplyLoading, setSocialReplyLoading] = useState(false);
  const [socialReplyError, setSocialReplyError] = useState("");
  const [commentReplyDrafts, setCommentReplyDrafts] = useState<
    Record<string, string>
  >({});
  const [commentReplyLoadingId, setCommentReplyLoadingId] = useState<
    string | null
  >(null);
  const [calls, setCalls] = useState<CallItem[]>([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [selectedCall, setSelectedCall] = useState<CallItem | null>(null);
  const [callTranscript, setCallTranscript] = useState<TranscriptLine[]>([]);
  const [callTranscriptLoading, setCallTranscriptLoading] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [autoReplyHighlight, setAutoReplyHighlight] = useState(false);

  const autoReplySettings: AutoReplySettings =
    config?.auto_reply || DEFAULT_AUTO_REPLY;

  const openAutoReplySettings = useCallback(() => {
    setMainTab("settings");
    setAutoReplyHighlight(true);
    window.setTimeout(() => {
      document
        .getElementById("auto-reply-settings")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    window.setTimeout(() => setAutoReplyHighlight(false), 2400);
  }, []);

  const handleAutoReplySettingsChange = useCallback(
    (next: AutoReplySettings) => {
      setConfig((prev) =>
        prev
          ? { ...prev, auto_reply: next }
          : ({ auto_reply: next } as CSConfig),
      );
    },
    [],
  );

  const getTenantId = () => getSessionTenantId(getSession());

  const fetchEmails = useCallback(async () => {
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
      const sinceParam = timeframe === 0 ? `&since=${getTodayMidnight()}` : "";
      const res = await fetch(
        `/api/cs/emails?tenant_id=${encodeURIComponent(tenantId)}&days=${timeframe}${sinceParam}&_t=${Date.now()}`,
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setEmails(data.emails || []);
      setError(null);
      setGoogleConnected(true);
    } catch {
      setError("Failed to load emails");
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  const fetchStats = useCallback(async () => {
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
      const sinceParam = timeframe === 0 ? `&since=${getTodayMidnight()}` : "";
      const res = await fetch(
        `/api/cs/stats?tenant_id=${encodeURIComponent(tenantId)}&days=${timeframe}${sinceParam}&_t=${Date.now()}`,
      );
      const data = await res.json();
      if (!data.error) setStats(data);
    } catch {
      // Non-critical
    }
  }, [timeframe]);

  const fetchSendAs = useCallback(async () => {
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
      const res = await fetch(
        `/api/cs/sendas?tenant_id=${encodeURIComponent(tenantId)}`,
      );
      const data = await res.json();
      if (!data.error) setSendAs(data.sendAs || []);
    } catch {
      // Non-critical
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
      const res = await fetch(
        `/api/cs/config?tenant_id=${encodeURIComponent(tenantId)}`,
      );
      const data = await res.json();
      if (!data.error) setConfig(data);
    } catch {
      // Non-critical
    }
  }, []);

  const loadConversationMessages = useCallback(
    async (
      convId: string,
      platform: "facebook" | "instagram",
      quiet = false,
    ) => {
      const tenantId = getTenantId();
      if (!tenantId) return;
      if (!quiet) setConversationLoading(true);
      try {
        const res = await fetch(
          `/api/cs/social/conversation?tenant_id=${encodeURIComponent(tenantId)}&id=${convId}&platform=${platform}&_t=${Date.now()}`,
        );
        const data = await res.json();
        setConversationMessages(data.messages || []);
      } catch {
        setConversationMessages([]);
      } finally {
        if (!quiet) setConversationLoading(false);
      }
    },
    [],
  );

  const selectConversation = async (conv: any) => {
    setSelectedConversation(conv);
    setSocialReplyText("");
    setSocialReplyError("");
    const platform = socialTab.startsWith("fb") ? "facebook" : "instagram";
    await loadConversationMessages(conv.id, platform, false);
  };

  async function sendSocialDmReply() {
    const tenantId = getTenantId();
    const trimmed = socialReplyText.trim();
    if (!tenantId || !selectedConversation || !trimmed || socialReplyLoading)
      return;

    const isFacebook = socialTab === "fb-dms";
    const endpoint = isFacebook
      ? "/api/cs/social/fb-dms/reply"
      : "/api/cs/social/ig-dms/reply";

    setSocialReplyLoading(true);
    setSocialReplyError("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          conversation_id: selectedConversation.id,
          message: trimmed,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to send reply");
      }

      const optimistic = {
        id: data.messageId || `local-${Date.now()}`,
        from: "You",
        text: trimmed,
        createdAt: new Date().toISOString(),
        direction: "outgoing",
      };
      setConversationMessages((current) => [...current, optimistic]);
      setSocialReplyText("");
      toast.success("Reply sent");
    } catch (err: unknown) {
      setSocialReplyError(
        err instanceof Error ? err.message : "Failed to send reply",
      );
    } finally {
      setSocialReplyLoading(false);
    }
  }

  async function sendSocialCommentReply(commentId: string) {
    const tenantId = getTenantId();
    const trimmed = (commentReplyDrafts[commentId] || "").trim();
    if (!tenantId || !selectedConversation || !trimmed || commentReplyLoadingId)
      return;

    const isFacebook = socialTab === "fb-comments";
    const endpoint = isFacebook
      ? "/api/cs/social/fb-comments/reply"
      : "/api/cs/social/ig-comments/reply";

    setCommentReplyLoadingId(commentId);
    setSocialReplyError("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          comment_id: commentId,
          message: trimmed,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to send comment reply");
      }

      const replyComment = {
        id: data.replyId || `reply-${Date.now()}`,
        from: "You",
        message: trimmed,
        createdTime: new Date().toISOString(),
        likeCount: 0,
      };

      setSelectedConversation((current: any) => {
        if (!current) return current;
        if (current.id === commentId) {
          return {
            ...current,
            replies: [...(current.replies || []), replyComment],
          };
        }
        return current;
      });
      setSocialData((current) =>
        current.map((post: any) => {
          if (post.id !== selectedConversation.postId) return post;
          const updatedComments = (post.comments || []).map((c: any) => {
            if (c.id === commentId) {
              return {
                ...c,
                replies: [...(c.replies || []), replyComment],
              };
            }
            return c;
          });
          return {
            ...post,
            comments: updatedComments,
          };
        }),
      );
      setCommentReplyDrafts((current) => ({ ...current, [commentId]: "" }));
      toast.success("Comment reply sent");
    } catch (err: unknown) {
      setSocialReplyError(
        err instanceof Error ? err.message : "Failed to send comment reply",
      );
    } finally {
      setCommentReplyLoadingId(null);
    }
  }

  const fetchSocialData = useCallback(async (tab: string, quiet = false) => {
    const tenantId = getTenantId();
    if (!tenantId) return;
    if (!quiet) {
      setSocialLoading(true);
      setSocialError("");
      setSocialData([]); // Clear previous data immediately to prevent ghost tab item count lagging
    }
    try {
      const res = await fetch(
        `/api/cs/social/${tab}?tenant_id=${encodeURIComponent(tenantId)}&_t=${Date.now()}`,
      );
      const data = await res.json();
      if (!data.error) {
        setSocialData(data.conversations || data.comments || []);
      } else if (!quiet) {
        setSocialData([]);
        setSocialError(data.error);
      }
    } catch {
      if (!quiet) {
        setSocialData([]);
        setSocialError("Could not load social inbox data");
      }
    } finally {
      if (!quiet) setSocialLoading(false);
    }
  }, []);

  const fetchCalls = useCallback(async () => {
    const tenantId = getTenantId();
    if (!tenantId) return;

    setCallsLoading(true);
    try {
      const res = await fetch(
        `/api/cs/calls?tenant_id=${encodeURIComponent(tenantId)}&days=${timeframe}&_t=${Date.now()}`,
      );
      const data = await res.json();
      if (!data.error) {
        setCalls(data.calls || []);
      } else {
        setCalls([]);
      }
    } catch {
      setCalls([]);
    } finally {
      setCallsLoading(false);
    }
  }, [timeframe]);

  const fetchCallTranscript = useCallback(async (callSid: string) => {
    const tenantId = getTenantId();
    if (!tenantId || !callSid) return;

    setCallTranscriptLoading(true);
    try {
      const res = await fetch(
        `/api/cs/calls/${encodeURIComponent(callSid)}?tenant_id=${encodeURIComponent(tenantId)}&_t=${Date.now()}`,
      );
      const data = await res.json();
      if (!data.error) {
        setCallTranscript(data.transcript || []);
      } else {
        setCallTranscript([]);
      }
    } catch {
      setCallTranscript([]);
    } finally {
      setCallTranscriptLoading(false);
    }
  }, []);

  const fetchSocialConnections = useCallback(async () => {
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
      const [igRes, fbRes, twilioRes, googleRes] = await Promise.all([
        fetch(
          `/api/auth/instagram/status?tenant_id=${encodeURIComponent(tenantId)}`,
        ).catch(() => null),
        fetch(
          `/api/auth/facebook/status?tenant_id=${encodeURIComponent(tenantId)}`,
        ).catch(() => null),
        fetch(
          `/api/auth/twilio/status?tenant_id=${encodeURIComponent(tenantId)}&_t=${Date.now()}`,
        ).catch(() => null),
        fetch(
          `/api/auth/google/status?tenant_id=${encodeURIComponent(tenantId)}&service=gmail`,
          {
            credentials: "same-origin",
            cache: "no-store",
          },
        ).catch(() => null),
      ]);
      const igData = igRes ? await igRes.json().catch(() => ({})) : {};
      const fbData = fbRes ? await fbRes.json().catch(() => ({})) : {};
      const twilioData = twilioRes
        ? await twilioRes.json().catch(() => ({}))
        : {};
      const googleData = googleRes
        ? await googleRes.json().catch(() => ({}))
        : {};

      const igPermissions = Array.isArray(igData.permissions)
        ? igData.permissions.map((p: string) => p.toLowerCase())
        : [];
      const fbPermissions = Array.isArray(fbData.permissions)
        ? fbData.permissions.map((p: string) => p.toLowerCase())
        : [];

      const igMessaging =
        igData.connected === true &&
        (igPermissions.includes("instagram_manage_messages") ||
          igPermissions.includes("pages_messaging"));
      const igPosting =
        igData.connected === true &&
        (igPermissions.includes("instagram_content_publish") ||
          igPermissions.includes("instagram_manage_comments") ||
          igPermissions.includes("pages_manage_posts"));
      const fbMessaging =
        fbData.connected === true && fbPermissions.includes("pages_messaging");
      const fbPosting =
        fbData.connected === true &&
        (fbPermissions.includes("pages_manage_posts") ||
          fbPermissions.includes("pages_read_engagement"));

      setSocialConnections({
        instagram: igData.connected === true,
        facebook: fbData.connected === true,
        igMessaging,
        igPosting,
        fbMessaging,
        fbPosting,
      });
      setTwilioStatus({
        connected: twilioData.connected === true,
        number:
          typeof twilioData.number === "string" ? twilioData.number : undefined,
        status:
          typeof twilioData.status === "string" ? twilioData.status : undefined,
      });
      setGoogleConnected(
        googleData.connected === true ||
          (googleRes?.ok === true &&
            typeof googleData.email === "string" &&
            googleData.email.length > 0),
      );
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    void fetchSendAs();
    void fetchConfig();
    void fetchSocialConnections();
  }, [fetchSendAs, fetchConfig, fetchSocialConnections]);

  useEffect(() => {
    if (mainTab === "socials") {
      const isTabConnected = (
        tab: "ig-dms" | "fb-dms" | "ig-comments" | "fb-comments",
      ) => {
        switch (tab) {
          case "ig-dms":
            return !!(
              socialConnections.igMessaging ?? socialConnections.instagram
            );
          case "fb-dms":
            return !!(
              socialConnections.fbMessaging ?? socialConnections.facebook
            );
          case "ig-comments":
            return !!(
              socialConnections.igPosting ?? socialConnections.instagram
            );
          case "fb-comments":
            return !!(
              socialConnections.fbPosting ?? socialConnections.facebook
            );
          default:
            return false;
        }
      };

      if (!isTabConnected(socialTab)) {
        const tabs: Array<"ig-dms" | "fb-dms" | "ig-comments" | "fb-comments"> =
          ["ig-dms", "fb-dms", "ig-comments", "fb-comments"];
        const firstConnected = tabs.find(isTabConnected);
        if (firstConnected && firstConnected !== socialTab) {
          setSocialTab(firstConnected);
          return;
        }
      }
    }
    if (
      mainTab === "socials" &&
      (socialConnections.instagram || socialConnections.facebook)
    ) {
      void fetchSocialData(socialTab);
    }
    if (mainTab === "calls") {
      void fetchCalls();
    }
  }, [mainTab, socialTab, socialConnections, fetchSocialData, fetchCalls]);

  // Poll conversation messages when a conversation is selected
  useEffect(() => {
    if (
      mainTab !== "socials" ||
      !selectedConversation?.id ||
      !socialTab.includes("dms")
    )
      return;
    let cancelled = false;
    const platform = socialTab.startsWith("fb") ? "facebook" : "instagram";

    const interval = setInterval(() => {
      if (!cancelled) {
        void loadConversationMessages(selectedConversation.id, platform, true);
      }
    }, 4000); // Poll every 4 seconds

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [mainTab, selectedConversation?.id, socialTab, loadConversationMessages]);

  // Poll social inbox data (conversations/comments list)
  useEffect(() => {
    if (
      mainTab !== "socials" ||
      !(socialConnections.instagram || socialConnections.facebook)
    )
      return;
    let cancelled = false;

    const interval = setInterval(() => {
      if (!cancelled) {
        void fetchSocialData(socialTab, true);
      }
    }, 8000); // Poll list every 8 seconds

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [mainTab, socialTab, socialConnections, fetchSocialData]);

  const fetchEscalations = useCallback(async () => {
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
      const sinceParam = timeframe === 0 ? `&since=${getTodayMidnight()}` : "";
      const res = await fetch(
        `/api/cs/escalations?tenant_id=${encodeURIComponent(tenantId)}&days=${timeframe}${sinceParam}&_t=${Date.now()}`,
      );
      const data = await res.json();
      if (!data.error) setEscalations(data.escalations || []);
    } catch {
      /* Non-critical */
    }
  }, [timeframe]);

  const fetchSentEmails = useCallback(async () => {
    const tenantId = getTenantId();
    if (!tenantId) return;
    setSentLoading(true);
    try {
      const sinceParam = timeframe === 0 ? `&since=${getTodayMidnight()}` : "";
      const res = await fetch(
        `/api/cs/sent?tenant_id=${encodeURIComponent(tenantId)}&days=${timeframe}${sinceParam}&_t=${Date.now()}`,
      );
      const data = await res.json();
      if (!data.error) setSentEmails(data.emails || []);
    } catch {
      // Non-critical
    } finally {
      setSentLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    setLoading(true);
    void fetchEmails();
    void fetchStats();
    void fetchSentEmails();
    void fetchEscalations();
  }, [fetchEmails, fetchStats, fetchSentEmails, fetchEscalations]);

  const selectEmail = async (email: Email) => {
    const tenantId = getTenantId();
    if (!tenantId) return;
    setDetailLoading(true);
    try {
      const res = await fetch(
        `/api/cs/email/${email.id}?tenant_id=${encodeURIComponent(tenantId)}`,
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setSelectedEmail(data);
    } catch {
      setError("Failed to load email");
    } finally {
      setDetailLoading(false);
    }
  };

  const mailPendingCount = useMemo(
    () => emails.filter((e) => getEmailStatus(e) === "pending").length,
    [emails],
  );

  const socialOpenCount = useMemo(() => {
    if (!socialConnections.instagram && !socialConnections.facebook) return 0;
    if (socialTab.includes("dms")) return socialData.length;
    return socialData.reduce(
      (sum, post) => sum + (post.comments?.length ?? 0),
      0,
    );
  }, [socialConnections, socialData, socialTab]);

  const handleRefresh = useCallback(() => {
    setLoading(true);
    setSentLoading(true);
    void fetchEmails();
    void fetchStats();
    void fetchSentEmails();
    void fetchEscalations();
    void fetchSocialConnections();
    if (mainTab === "socials") void fetchSocialData(socialTab);
    if (mainTab === "calls") void fetchCalls();
  }, [
    fetchEmails,
    fetchStats,
    fetchSentEmails,
    fetchEscalations,
    fetchSocialConnections,
    fetchSocialData,
    fetchCalls,
    mainTab,
    socialTab,
  ]);

  const supportNavItems: AutomationNavItem[] = [
    {
      id: "mail",
      label: "Mail",
      icon: Mail,
      active: mainTab === "mail",
      badge: mailPendingCount > 0 ? mailPendingCount : undefined,
      onClick: () => setMainTab("mail"),
    },
    {
      id: "socials",
      label: "Socials",
      icon: MessageCircle,
      active: mainTab === "socials",
      badge: socialOpenCount > 0 ? socialOpenCount : undefined,
      onClick: () => setMainTab("socials"),
    },
    {
      id: "calls",
      label: "Calls",
      icon: Phone,
      active: mainTab === "calls",
      badge: calls.length > 0 ? calls.length : undefined,
      onClick: () => setMainTab("calls"),
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      active: mainTab === "settings",
      group: "settings",
      onClick: () => setMainTab("settings"),
    },
  ];

  const connectedChannels = [
    googleConnected && "Gmail",
    (socialConnections.instagram || socialConnections.facebook) && "Meta",
    twilioStatus.connected && "Phone",
  ].filter(Boolean);

  const headerSubtitle =
    connectedChannels.length > 0
      ? `${connectedChannels.join(", ")} connected - triage mail, socials, and calls in one workspace.`
      : "Connect Gmail, Meta, or phone to start handling support in one place.";

  return (
    <ConnectionStatus
      connections={[
        { platform: "google", required: false },
        { platform: "twilio", required: false },
        { platform: "shopify", required: false },
        { platform: "instagram", required: false },
        { platform: "facebook", required: false },
      ]}
    >
      <div>
        <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-1.5 flex items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight text-gray-900">
                Intelli Support
              </h1>
              <Badge className="rounded-md border-none bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 hover:bg-blue-50">
                Active App
              </Badge>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              {headerSubtitle}
            </p>
            <ConnectionStrip
              className="mt-3"
              googleConnected={googleConnected}
              metaConnected={
                socialConnections.instagram || socialConnections.facebook
              }
              twilioConnected={twilioStatus.connected}
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <RefreshButton onRefresh={handleRefresh} intervalMs={30000} />
            <Button
              asChild
              variant="outline"
              className="px-4 text-sm font-semibold shadow-sm h-9 rounded-xl"
            >
              <Link href="/dashboard/automations/cs-onboarding">
                <Settings2 className="mr-2 size-4" />
                Configure
              </Link>
            </Button>
          </div>
        </div>

        <AutomationWorkspaceLayout items={supportNavItems} variant="shadcn">
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertDescription>{error}</AlertDescription>
              <AlertAction>
                {error.includes("reconnect") ||
                error.includes("expired") ||
                error.includes("401") ? (
                  <Button asChild size="sm">
                    <a href="/api/auth/google/connect">Reconnect Google</a>
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setError(null)}
                    aria-label="Dismiss error"
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </AlertAction>
            </Alert>
          )}

          {mainTab === "settings" && (
            <div className="space-y-6">
              <AutoReplySettingsPanel
                tenantId={getTenantId()}
                settings={autoReplySettings}
                onSettingsChange={handleAutoReplySettingsChange}
                highlight={autoReplyHighlight}
              />
              <AppSettingsPanel
              appName="Intelli Support"
              appKey="cs"
              directory="/dashboard/cs"
              setupHref="/dashboard/automations/cs-onboarding"
              settingsHref="/dashboard/settings?tab=integrations"
              integrations={[
                {
                  provider: "google",
                  label: "Gmail / Google Workspace",
                  required: false,
                  href: "/dashboard/settings?tab=integrations",
                },
                {
                  provider: "shopify",
                  label: "Shopify orders",
                  href: buildShopifyConnectHref({
                    tenantId: getTenantId(),
                    returnTo: SHOPIFY_RETURN_PATHS.cs,
                  }),
                },
                {
                  provider: "instagram",
                  label: "Instagram comments and DMs",
                  href: "/dashboard/settings?tab=integrations",
                },
                {
                  provider: "facebook",
                  label: "Facebook messages",
                  href: "/dashboard/settings?tab=integrations",
                },
                {
                  provider: "twilio",
                  label: "Calls",
                  href: "/dashboard/settings?tab=integrations",
                },
              ]}
              settingsName="Support settings"
              description="Manage inbox sources, connected channels, reply rules, escalation setup and workflow preferences."
              defaultOpen
            />
            </div>
          )}

          {mainTab === "mail" && (
            <MailTab
              timeframe={timeframe}
              setTimeframe={setTimeframe}
              stats={stats}
              loading={loading}
              emails={emails}
              selectedEmail={selectedEmail}
              selectEmail={selectEmail}
              detailLoading={detailLoading}
              category={category}
              setCategory={setCategory}
              view={view}
              setView={setView}
              sentEmails={sentEmails}
              sentLoading={sentLoading}
              escalations={escalations}
              sendAs={sendAs}
              config={config}
              setChangeModal={setChangeModal}
              autoReplySettings={autoReplySettings}
              onOpenAutoReplySettings={openAutoReplySettings}
            />
          )}

          {mainTab === "calls" && (
            <CallsTab
              tenantId={getTenantId()}
              twilioStatus={twilioStatus}
              timeframe={timeframe}
              stats={stats}
              loading={loading}
              calls={calls}
              callsLoading={callsLoading}
              selectedCall={selectedCall}
              setSelectedCall={setSelectedCall}
              callTranscript={callTranscript}
              callTranscriptLoading={callTranscriptLoading}
              fetchCallTranscript={fetchCallTranscript}
            />
          )}

          {mainTab === "socials" && (
            <SocialsTab
              tenantId={getTenantId()}
              socialConnections={socialConnections}
              socialTab={socialTab}
              setSocialTab={setSocialTab}
              selectedConversation={selectedConversation}
              setSelectedConversation={setSelectedConversation}
              socialReplyText={socialReplyText}
              setSocialReplyText={setSocialReplyText}
              socialReplyError={socialReplyError}
              setSocialReplyError={setSocialReplyError}
              socialReplyLoading={socialReplyLoading}
              commentReplyDrafts={commentReplyDrafts}
              setCommentReplyDrafts={setCommentReplyDrafts}
              commentReplyLoadingId={commentReplyLoadingId}
              socialLoading={socialLoading}
              socialError={socialError}
              socialData={socialData}
              conversationLoading={conversationLoading}
              conversationMessages={conversationMessages}
              selectConversation={selectConversation}
              sendSocialDmReply={sendSocialDmReply}
              sendSocialCommentReply={sendSocialCommentReply}
              autoReplySettings={autoReplySettings}
              onOpenAutoReplySettings={openAutoReplySettings}
            />
          )}
        </AutomationWorkspaceLayout>

        {changeModal && (
          <ChangeRequestModal
            section={changeModal.section}
            fields={changeModal.fields}
            onClose={() => setChangeModal(null)}
          />
        )}
      </div>
    </ConnectionStatus>
  );
}
