"use client";

import { useEffect, useState } from "react";
import {
  Mail,
  Check,
  Clock,
  AlertTriangle,
  Phone,
  Activity,
  Send,
  User,
  Star,
  UserPlus,
  Truck,
  BarChart3,
  Loader2,
  ChevronLeft,
  Inbox,
  Settings2,
} from "lucide-react";
import {
  Email,
  EmailDetail,
  Stats,
  Category,
  SendAs,
  CSConfig,
} from "../types";
import {
  timeAgo,
  extractName,
  extractEmail,
  categorizeEmail,
  getEmailStatus,
  getAlias,
  groupQuestions,
  timeframePeriodLabel,
} from "../utils";
import { GearButton, StatusBadge, CategoryBadge } from "./Badges";
import { StatCard } from "../_components/StatCard";
import { AutoReplyStatusStrip } from "../_components/AutoReplyStatusStrip";
import { TimeframeToggle } from "../_components/TimeframeToggle";
import { InboxRow } from "../_components/InboxRow";
import { EmptyState } from "../_components/EmptyState";
import { PillTabBar } from "@/components/PillTabBar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { AutoReplySettings } from "@/lib/cs-auto-reply";

interface MailTabProps {
  timeframe: number;
  setTimeframe: (t: number) => void;
  stats: Stats | null;
  loading: boolean;
  emails: Email[];
  selectedEmail: EmailDetail | null;
  selectEmail: (email: Email) => Promise<void>;
  detailLoading: boolean;
  category: Category;
  setCategory: (c: Category) => void;
  view: "inbox" | "sent";
  setView: (v: "inbox" | "sent") => void;
  sentEmails: Email[];
  sentLoading: boolean;
  escalations: any[];
  sendAs: SendAs[];
  config: CSConfig | null;
  setChangeModal: (modal: any) => void;
  autoReplySettings: AutoReplySettings;
  onOpenAutoReplySettings: () => void;
}

type MailSubTab = "inbox" | "insights" | "rules";

const CATEGORIES: Category[] = [
  "all",
  "shipping",
  "returns",
  "product",
  "other",
];

const MAIL_SUB_TABS = [
  { id: "inbox" as const, label: "Inbox", icon: Inbox },
  { id: "insights" as const, label: "Insights", icon: BarChart3 },
  { id: "rules" as const, label: "Rules", icon: Settings2 },
];

const periodLabel = (days: number) => timeframePeriodLabel(days).toLowerCase();

function EmailListSkeleton() {
  return (
    <div className="p-4 space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="w-full h-16" />
      ))}
    </div>
  );
}

function RulesListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="w-full h-12 rounded-lg" />
      ))}
    </div>
  );
}

function EmailDetailPane({
  detailLoading,
  selectedEmail,
  selectEmail,
  onBack,
  showBack,
}: {
  detailLoading: boolean;
  selectedEmail: EmailDetail | null;
  selectEmail: (email: Email) => Promise<void>;
  onBack?: () => void;
  showBack?: boolean;
}) {
  return (
    <>
      {detailLoading ? (
        <div className="flex items-center justify-center flex-1 py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : selectedEmail ? (
        <>
          <CardHeader className="p-0 space-y-0 border-b">
            <div className="px-5 py-4">
              {showBack && onBack ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 px-2 mb-2 -ml-2 text-muted-foreground lg:hidden"
                  onClick={onBack}
                >
                  <ChevronLeft className="size-4" />
                  Back
                </Button>
              ) : null}
              <CardTitle className="text-base font-semibold">
                {selectedEmail.subject || "(no subject)"}
              </CardTitle>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <StatusBadge status={getEmailStatus(selectedEmail)} />
                <CategoryBadge
                  category={categorizeEmail(
                    selectedEmail.subject,
                    selectedEmail.snippet,
                  )}
                />
              </div>
              <div className="flex items-center gap-2 mt-3">
                <div className="flex items-center justify-center text-sm font-semibold rounded-full size-8 shrink-0 bg-primary/10 text-primary">
                  {extractName(selectedEmail.from).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {extractName(selectedEmail.from)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {extractEmail(selectedEmail.from)} -{" "}
                    {timeAgo(selectedEmail.date)}
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden p-0",
              !selectedEmail.htmlBody && "overflow-y-auto p-5",
            )}
          >
            {selectedEmail.htmlBody ? (
              <div className="flex-1 min-w-0 min-h-0 overflow-x-hidden overflow-y-auto">
                <iframe
                  srcDoc={`
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <meta charset="utf-8">
                          <meta name="viewport" content="width=device-width, initial-scale=1">
                          <style>
                            html {
                              overflow-x: hidden;
                            }
                            body {
                              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                              font-size: 14px;
                              line-height: 1.6;
                              color: #1a1a2e;
                              margin: 0;
                              padding: 20px;
                              word-wrap: break-word;
                              overflow-wrap: anywhere;
                              overflow-x: hidden;
                              max-width: 100%;
                            }
                            img, video, iframe, table, pre, blockquote {
                              max-width: 100% !important;
                              height: auto !important;
                            }
                            table {
                              width: auto !important;
                              table-layout: fixed;
                            }
                            td, th {
                              word-break: break-word;
                            }
                            a {
                              word-break: break-all;
                            }
                          </style>
                        </head>
                        <body>
                          ${selectedEmail.htmlBody}
                        </body>
                      </html>
                    `}
                  title="Email Content"
                  sandbox="allow-popups allow-popups-to-escape-sandbox"
                  className="block h-full min-h-[350px] w-full max-w-full border-0"
                />
              </div>
            ) : (
              <div className="min-w-0 text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">
                {selectedEmail.body}
              </div>
            )}
          </CardContent>

          {selectedEmail.thread.length > 0 && (
            <>
              <Separator />
              <div className="px-5 py-3 text-xs font-medium text-muted-foreground">
                {selectedEmail.thread.length} other{" "}
                {selectedEmail.thread.length === 1 ? "message" : "messages"} in
                thread
              </div>
              <ScrollArea className="max-h-[200px]">
                {selectedEmail.thread.map((msg) => (
                  <button
                    key={msg.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void selectEmail({
                        ...selectedEmail,
                        id: msg.id,
                        threadId: selectedEmail.threadId,
                      } as Email);
                    }}
                    className={cn(
                      "w-full border-t border-border/60 px-5 py-2.5 text-left transition-colors hover:bg-muted/50",
                      msg.isSent
                        ? "bg-green-50/80 hover:bg-green-50"
                        : "bg-muted/20",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="text-xs font-medium truncate">
                          {extractName(msg.from)}
                        </span>
                        {msg.isSent && (
                          <Badge
                            variant="secondary"
                            className="shrink-0 bg-green-100 text-[10px] text-green-700"
                          >
                            Ainomiq Reply
                          </Badge>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {timeAgo(msg.date)}
                      </span>
                    </div>
                    <div className="text-xs truncate text-muted-foreground">
                      {msg.snippet}
                    </div>
                  </button>
                ))}
              </ScrollArea>
            </>
          )}
        </>
      ) : (
        <EmptyState
          message="Select an email to view details"
          className="flex-1 py-20"
        >
          <Mail
            className="mt-3 size-12 text-muted-foreground/40"
            strokeWidth={1}
          />
        </EmptyState>
      )}
    </>
  );
}

export default function MailTab({
  timeframe,
  setTimeframe,
  stats,
  loading,
  emails,
  selectedEmail,
  selectEmail,
  detailLoading,
  category,
  setCategory,
  view,
  setView,
  sentEmails,
  sentLoading,
  escalations,
  sendAs,
  config,
  setChangeModal,
  autoReplySettings,
  onOpenAutoReplySettings,
}: MailTabProps) {
  const [subTab, setSubTab] = useState<MailSubTab>("inbox");
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  const period = timeframePeriodLabel(timeframe);

  useEffect(() => {
    if (!mobileShowDetail) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileShowDetail(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileShowDetail]);

  const handleSelectEmail = async (email: Email) => {
    await selectEmail(email);
    setMobileShowDetail(true);
  };

  const filteredEmails = emails.filter((e) => {
    return (
      category === "all" || categorizeEmail(e.subject, e.snippet) === category
    );
  });

  const knownAliases = Array.from(
    new Set(
      [
        ...sendAs.map((s) => s.email.trim().toLowerCase()).filter(Boolean),
        config?.fulfillment_email?.trim().toLowerCase(),
        config?.escalation_contact?.trim().toLowerCase(),
      ].filter((v): v is string => Boolean(v)),
    ),
  );

  const aliasBreakdown = (() => {
    const map: Record<
      string,
      { received: number; handled: number; pending: number }
    > = {};
    for (const a of knownAliases) {
      map[a] = { received: 0, handled: 0, pending: 0 };
    }
    for (const e of emails) {
      const alias = getAlias(e);
      const matched = knownAliases.find((ka) => alias.includes(ka));
      if (!matched) continue;
      map[matched].received++;
      const status = getEmailStatus(e);
      if (status === "handled") map[matched].handled++;
      else map[matched].pending++;
    }
    return Object.entries(map)
      .map(([alias, data]) => ({ alias, ...data }))
      .sort((a, b) => b.received - a.received);
  })();

  const escalatedEmails = emails.filter((e) =>
    e.labels.some((l) => l.toLowerCase().includes("escalat")),
  );

  const questions = groupQuestions(emails);

  const escalationRows =
    escalations.length > 0
      ? escalations
      : escalatedEmails.map((e) => ({
          id: e.id,
          subject: e.subject,
          from: e.from,
          date: e.date || new Date(parseInt(e.internalDate)).toISOString(),
          escalatedTo: "Unknown",
          status: e.isUnread ? "waiting" : "resolved",
          threadId: "",
        }));

  const sendAsLoading = sendAs.length === 0;

  return (
    <div className="space-y-6">
      <AutoReplyStatusStrip
        settings={autoReplySettings}
        channels={["email"]}
        onOpenSettings={onOpenAutoReplySettings}
      />
      <PillTabBar
        tabs={MAIL_SUB_TABS}
        activeId={subTab}
        onChange={setSubTab}
        ariaLabel="Mail sections"
      />

      {subTab === "inbox" && (
        <>
          <TimeframeToggle value={timeframe} onChange={setTimeframe} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <Card
              className={cn(
                "flex max-h-[700px] min-w-0 flex-col overflow-hidden py-0 lg:col-span-2 gap-0",
                mobileShowDetail ? "hidden lg:flex" : "flex",
              )}
            >
              <CardHeader className="py-3 space-y-3 border-b">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 shrink-0 text-primary" />
                  <Tabs
                    value={view}
                    onValueChange={(v) => setView(v as "inbox" | "sent")}
                  >
                    <TabsList>
                      <TabsTrigger value="inbox">Inbox</TabsTrigger>
                      <TabsTrigger value="sent">Sent</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={category}
                  onValueChange={(next) => {
                    if (next) setCategory(next as Category);
                  }}
                  className="flex-wrap"
                >
                  {CATEGORIES.map((cat) => (
                    <ToggleGroupItem
                      key={cat}
                      value={cat}
                      aria-label={cat}
                      className="px-3 text-xs capitalize"
                    >
                      {cat}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </CardHeader>

              <ScrollArea className="h-[530px]">
                {view === "sent" ? (
                  sentLoading ? (
                    <EmailListSkeleton />
                  ) : sentEmails.length === 0 ? (
                    <EmptyState message="No sent emails in this period" />
                  ) : (
                    sentEmails.map((email) => (
                      <InboxRow
                        key={email.id}
                        selected={selectedEmail?.id === email.id}
                        onClick={() => void handleSelectEmail(email)}
                        title={`To: ${email.to ? extractName(email.to) : "(unknown)"}`}
                        subtitle={
                          <>
                            <div className="font-medium line-clamp-2 wrap-break-word text-foreground">
                              {email.subject || "(no subject)"}
                            </div>
                            <div className="mt-0.5 line-clamp-2 wrap-break-word text-xs">
                              {email.snippet}
                            </div>
                          </>
                        }
                        meta={timeAgo(
                          email.date ||
                            new Date(
                              parseInt(email.internalDate),
                            ).toISOString(),
                        )}
                        badges={
                          <Badge
                            variant="secondary"
                            className="bg-primary/10 text-primary"
                          >
                            Sent
                          </Badge>
                        }
                      />
                    ))
                  )
                ) : loading ? (
                  <EmailListSkeleton />
                ) : filteredEmails.length === 0 ? (
                  <EmptyState
                    message={
                      category !== "all"
                        ? "No emails match your filter"
                        : "No emails in inbox"
                    }
                  />
                ) : (
                  filteredEmails.map((email) => {
                    const status = getEmailStatus(email);
                    const cat = categorizeEmail(email.subject, email.snippet);
                    const alias = getAlias(email);
                    return (
                      <InboxRow
                        key={email.id}
                        selected={selectedEmail?.id === email.id}
                        unread={email.isUnread}
                        onClick={() => void handleSelectEmail(email)}
                        title={extractName(email.from)}
                        subtitle={
                          <>
                            <div className="font-medium line-clamp-2 wrap-break-word text-foreground">
                              {email.subject || "(no subject)"}
                            </div>
                            <div className="mt-0.5 line-clamp-2 wrap-break-word text-xs">
                              {email.snippet}
                            </div>
                          </>
                        }
                        meta={timeAgo(
                          email.date ||
                            new Date(
                              parseInt(email.internalDate),
                            ).toISOString(),
                        )}
                        badges={
                          <>
                            <StatusBadge status={status} />
                            <CategoryBadge category={cat} />
                            <span className="text-[11px] text-muted-foreground">
                              {alias}
                            </span>
                          </>
                        }
                      />
                    );
                  })
                )}
              </ScrollArea>
            </Card>

            <Card
              className={cn(
                "flex max-h-[700px] min-w-0 flex-col gap-0 overflow-hidden py-0 lg:col-span-3",
                !mobileShowDetail ? "hidden lg:flex" : "flex",
              )}
            >
              <EmailDetailPane
                detailLoading={detailLoading}
                selectedEmail={selectedEmail}
                selectEmail={handleSelectEmail}
                showBack
                onBack={() => setMobileShowDetail(false)}
              />
            </Card>
          </div>
        </>
      )}

      {subTab === "insights" && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
            <StatCard
              label="Emails Received"
              value={stats?.received ?? 0}
              hint={period}
              icon={Mail}
              iconClassName="text-primary"
              loading={loading}
            />
            <StatCard
              label="Emails Handled"
              value={stats?.handled ?? 0}
              hint={`Replied ${periodLabel(timeframe)}`}
              icon={Check}
              iconClassName="text-green-600"
              loading={loading}
            />
            <StatCard
              label="Avg Response Time"
              value={stats?.avgResponseTime ?? "-"}
              hint="Ainomiq response speed"
              icon={Clock}
              iconClassName="text-primary"
              loading={loading}
            />
            <StatCard
              label="Escalated"
              value={stats?.escalated ?? escalatedEmails.length}
              hint={`Forwarded ${periodLabel(timeframe)}`}
              icon={AlertTriangle}
              iconClassName="text-orange-600"
              loading={loading}
            />
            <StatCard
              label="Calls"
              value={stats?.calls ?? 0}
              hint={`Handled ${periodLabel(timeframe)}`}
              icon={Phone}
              iconClassName="text-primary"
              loading={loading}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="text-orange-600 size-4" />
                Escalation Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="w-full h-10" />
                  ))}
                </div>
              ) : escalations.length === 0 && escalatedEmails.length === 0 ? (
                <EmptyState
                  message={`No escalated emails in ${periodLabel(timeframe)}`}
                  className="py-6"
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>Escalated To</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {escalationRows.map((esc) => (
                      <TableRow
                        key={esc.id}
                        className="cursor-pointer"
                        onClick={() => {
                          const match = emails.find((e) => e.id === esc.id);
                          if (match) void handleSelectEmail(match);
                        }}
                      >
                        <TableCell className="max-w-[250px] truncate font-medium">
                          {esc.subject || "(no subject)"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {extractName(esc.from)}
                        </TableCell>
                        <TableCell>{extractName(esc.escalatedTo)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {timeAgo(esc.date)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(
                              esc.status === "waiting"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-green-100 text-green-700",
                            )}
                          >
                            {esc.status === "waiting" ? "Waiting" : "Resolved"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="size-4 text-primary" />
                Most Common Topics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="w-full h-24 rounded-xl" />
                  ))}
                </div>
              ) : questions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No data yet</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
                  {questions.map((q) => {
                    const pct = Math.round((q.count / emails.length) * 100);
                    return (
                      <Card key={q.label} size="sm" className="text-center">
                        <CardContent className="pt-4">
                          <div className="text-2xl font-bold tracking-tight">
                            {q.count}
                          </div>
                          <div className="mb-2 text-xs font-medium text-muted-foreground">
                            {q.label}
                          </div>
                          <Progress value={pct} className="h-1" />
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {pct}% of total
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {subTab === "rules" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Send className="size-4 text-primary" />
                    We send emails as
                  </CardTitle>
                  <CardDescription>
                    Addresses customers see when Ainomiq replies.
                  </CardDescription>
                </div>
                <GearButton
                  onClick={() =>
                    setChangeModal({
                      section: "Send-as Addresses",
                      fields: [
                        {
                          label: "Add email address",
                          placeholder: "e.g. support@yourdomain.com",
                          key: "add_email",
                        },
                        {
                          label: "Remove email address",
                          placeholder: "e.g. old@yourdomain.com",
                          key: "remove_email",
                        },
                        {
                          label: "Additional notes",
                          placeholder: "Any other changes...",
                          key: "notes",
                          type: "textarea",
                        },
                      ],
                    })
                  }
                />
              </div>
            </CardHeader>
            <CardContent>
              {sendAsLoading ? (
                <RulesListSkeleton rows={2} />
              ) : (
                <div className="flex flex-col gap-2">
                  {sendAs.map((s) => (
                    <div
                      key={s.email}
                      className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5"
                    >
                      <div
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full",
                          s.isPrimary ? "bg-primary/10" : "bg-muted",
                        )}
                      >
                        <Mail
                          className={cn(
                            "size-3.5",
                            s.isPrimary
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {s.email}
                        </div>
                        {s.name ? (
                          <div className="truncate text-[11px] text-muted-foreground">
                            {s.name}
                          </div>
                        ) : null}
                      </div>
                      {s.isPrimary ? (
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 text-[10px] text-primary"
                        >
                          Primary
                        </Badge>
                      ) : null}
                      {s.isDefault && !s.isPrimary ? (
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-[10px] text-green-700"
                        >
                          Default
                        </Badge>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Mail className="size-4 text-primary" />
                    Emails received per address
                  </CardTitle>
                  <CardDescription>
                    Volume per inbox address in the selected period.
                  </CardDescription>
                </div>
                <GearButton
                  onClick={() =>
                    setChangeModal({
                      section: "Receiving Addresses",
                      fields: [
                        {
                          label: "Add receiving address",
                          placeholder: "e.g. returns@yourdomain.com",
                          key: "add_address",
                        },
                        {
                          label: "Remove receiving address",
                          placeholder: "e.g. old@yourdomain.com",
                          key: "remove_address",
                        },
                        {
                          label: "Additional notes",
                          placeholder: "Any other changes...",
                          key: "notes",
                          type: "textarea",
                        },
                      ],
                    })
                  }
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <RulesListSkeleton />
              ) : aliasBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No emails yet</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {aliasBreakdown.map((row) => (
                    <div
                      key={row.alias}
                      className="rounded-lg bg-muted/50 px-3 py-2.5"
                    >
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-sm font-medium">{row.alias}</span>
                        <span className="text-sm font-semibold">
                          {row.received}
                        </span>
                      </div>
                      <div className="flex gap-3 text-xs">
                        <span className="text-green-600">
                          Handled: {row.handled}
                        </span>
                        <span
                          className={
                            row.pending > 0
                              ? "text-yellow-600"
                              : "text-muted-foreground"
                          }
                        >
                          Pending: {row.pending}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="text-orange-600 size-4" />
                    We escalate emails to
                  </CardTitle>
                  <CardDescription>
                    Where urgent threads forward when the bot escalates.
                  </CardDescription>
                </div>
                <GearButton
                  onClick={() =>
                    setChangeModal({
                      section: "Escalation Contact",
                      fields: [
                        {
                          label: "New escalation contact",
                          placeholder: "e.g. manager@yourdomain.com",
                          key: "escalation_contact",
                        },
                        {
                          label: "Escalation rules",
                          placeholder: "e.g. Escalate refunds over 50 EUR",
                          key: "escalation_rules",
                          type: "textarea",
                        },
                        {
                          label: "Additional notes",
                          placeholder: "Any other changes...",
                          key: "notes",
                          type: "textarea",
                        },
                      ],
                    })
                  }
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {!config ? (
                <RulesListSkeleton rows={2} />
              ) : (
                <>
                  {config.escalation_contact ? (
                    <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
                      <div className="flex items-center justify-center bg-orange-100 rounded-full size-8 shrink-0">
                        <User className="size-3.5 text-orange-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {config.escalation_contact}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          General escalation
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {config.vip?.influencers ? (
                    <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
                      <div className="flex items-center justify-center bg-purple-100 rounded-full size-8 shrink-0">
                        <Star className="size-3.5 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {config.vip.influencers.replace("Escalate to ", "")}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Influencer inquiries
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {config.vip?.wholesale ? (
                    <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
                      <div className="flex items-center justify-center rounded-full size-8 shrink-0 bg-primary/10">
                        <UserPlus className="size-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {config.vip.wholesale.replace("Escalate to ", "")}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Wholesale accounts
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {config.fulfillment_email ? (
                    <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5">
                      <div className="flex items-center justify-center bg-green-100 rounded-full size-8 shrink-0">
                        <Truck className="size-3.5 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {config.fulfillment_email}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Fulfillment partner
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {!config.escalation_contact &&
                  !config.vip &&
                  !config.fulfillment_email ? (
                    <p className="text-sm text-muted-foreground">
                      Not configured
                    </p>
                  ) : null}

                  {config.bot_scope?.auto_escalate ? (
                    <div className="mt-3 rounded-lg border border-orange-200/60 bg-orange-50/40 px-3 py-2.5">
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-orange-600">
                        Auto-escalate when
                      </div>
                      <ul className="list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-muted-foreground">
                        {config.bot_scope.auto_escalate.map((rule, i) => (
                          <li key={i}>{rule}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
