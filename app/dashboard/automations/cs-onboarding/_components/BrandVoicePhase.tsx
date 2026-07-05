"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSession, getSessionTenantId } from "@/lib/session";
import type { ScrapeResult } from "@/lib/scraper";
import type { EmailSetupData, BrandVoiceData } from "../_lib/types";
import { LANGUAGES } from "../_lib/types";
import {
  langFromCode,
  buildDefaultEscalationRules,
  defaultEscalationName,
} from "../_lib/helpers";
import { SetupStepIndicator } from "./SetupStepIndicator";
import { FormGroup } from "./shared";


export function BrandVoicePhase({
  data,
  emailSetupData,
  onBack,
  onConfirm,
  saving,
}: {
  data: ScrapeResult;
  emailSetupData: EmailSetupData | null;
  onBack: () => void;
  onConfirm: (brandData: BrandVoiceData) => void;
  saving: boolean;
}) {
  const isImap = emailSetupData?.connectionMethod === "imap_smtp";

  const [googleConnected, setGoogleConnected] = useState<boolean | null>(
    isImap ? null : null,
  );
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [emailsAnalyzed, setEmailsAnalyzed] = useState(0);
  const [analyzedEmails, setAnalyzedEmails] = useState<
    { subject: string; to: string; hasInbound?: boolean }[]
  >([]);
  const [showEmails, setShowEmails] = useState(false);

  // Editable brand voice fields (populated by AI)
  const [tone, setTone] = useState("");
  const [languageHandling, setLanguageHandling] = useState("");
  const [emailSignature, setEmailSignature] = useState("");
  const [dos, setDos] = useState<string[]>([]);
  const [donts, setDonts] = useState<string[]>([]);
  const [hasResult, setHasResult] = useState(false);

  // Escalation fields (populated after AI analysis)
  const [escalationName, setEscalationName] = useState("");
  const [escalationEmail, setEscalationEmail] = useState("");
  const [internalLang, setInternalLang] = useState(
    langFromCode(data.storeInfo.language),
  );
  const [escalationRules, setEscalationRules] = useState("");

  // Preview state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewQuestion, setPreviewQuestion] = useState<{
    from: string;
    subject: string;
    body: string;
  } | null>(null);
  const [previewReply, setPreviewReply] = useState("");
  const [previewThinking, setPreviewThinking] = useState("");
  const [previewSteps, setPreviewSteps] = useState<
    {
      step: string;
      category?: string;
      reasoning?: string;
      lookup?: string[];
      sources?: string[];
      found?: number;
      toolCalls?: { tool: string; query?: string; result?: string }[];
      model?: string;
    }[]
  >([]);
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([]);

  const getTenantId = useCallback(() => getSessionTenantId(getSession()), []);

  // Check Google connection status (only for Google OAuth)
  useEffect(() => {
    if (isImap) return;
    const tenantId = getTenantId();
    if (!tenantId) return;
    fetch(`/api/auth/google/status?tenant_id=${encodeURIComponent(tenantId)}`, {
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then((d) => {
        setGoogleConnected(d.connected === true);
        if (d.email) setGoogleEmail(d.email);
      })
      .catch(() => setGoogleConnected(false));
  }, [getTenantId, isImap]);

  // Poll for Google connection after redirect back
  useEffect(() => {
    if (isImap || googleConnected !== false) return;
    const interval = setInterval(() => {
      const tenantId = getTenantId();
      if (!tenantId) return;
      fetch(
        `/api/auth/google/status?tenant_id=${encodeURIComponent(tenantId)}`,
        { credentials: "same-origin" },
      )
        .then((r) => r.json())
        .then((d) => {
          if (d.connected) {
            setGoogleConnected(true);
            if (d.email) setGoogleEmail(d.email);
            clearInterval(interval);
          }
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(interval);
  }, [googleConnected, getTenantId, isImap]);

  const runAnalysis = async () => {
    const tenantId = getTenantId();
    if (!tenantId) return;
    setAnalyzing(true);
    setAnalyzeError("");

    try {
      const payload: Record<string, string> = { tenant_id: tenantId };

      // For IMAP, pass credentials so the API can connect directly
      if (isImap && emailSetupData) {
        payload.connectionMethod = "imap_smtp";
        payload.imapHost = emailSetupData.imapHost || "";
        payload.imapPort = emailSetupData.imapPort || "993";
        payload.imapUser = emailSetupData.imapUser || "";
        payload.imapPassword = emailSetupData.imapPassword || "";
      }

      const res = await fetch("/api/onboarding/analyze-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Analysis failed");

      const bv = json.brandVoice;
      setTone(bv.tone || "");
      setLanguageHandling(bv.languageHandling || "");
      setEmailSignature(bv.emailSignature || "");
      setDos(bv.dos?.length ? bv.dos : [""]);
      setDonts(bv.donts?.length ? bv.donts : [""]);
      setEmailsAnalyzed(json.emailsAnalyzed || 0);
      setAnalyzedEmails(json.analyzedEmails || []);

      // Pre-fill escalation based on AI-detected language and labels
      const detectedLang = (bv.languageHandling || "")
        .toLowerCase()
        .includes("dutch")
        ? "Dutch"
        : internalLang;
      setInternalLang(detectedLang);
      const fallbackEmail =
        data.contact.email || emailSetupData?.supportEmails?.[0] || "";
      setEscalationEmail((prev) => prev || fallbackEmail);
      setEscalationName(
        (prev) => prev || defaultEscalationName(data.storeInfo.name),
      );
      setEscalationRules(
        (prev) =>
          prev ||
          buildDefaultEscalationRules(
            detectedLang,
            json.analyzedEmails?.map((e: { subject: string }) => e.subject) ||
              [],
          ),
      );

      setHasResult(true);
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const connectGoogle = () => {
    window.open("/api/auth/google/connect", "_blank");
  };

  const addDo = () => setDos((prev) => [...prev, ""]);
  const addDont = () => setDonts((prev) => [...prev, ""]);
  const updateDo = (i: number, v: string) =>
    setDos((prev) => prev.map((d, j) => (j === i ? v : d)));
  const updateDont = (i: number, v: string) =>
    setDonts((prev) => prev.map((d, j) => (j === i ? v : d)));
  const removeDo = (i: number) =>
    setDos((prev) => prev.filter((_, j) => j !== i));
  const removeDont = (i: number) =>
    setDonts((prev) => prev.filter((_, j) => j !== i));

  const isValid =
    hasResult &&
    tone !== "" &&
    languageHandling.trim() !== "" &&
    emailSignature.trim() !== "" &&
    escalationName.trim() !== "" &&
    escalationEmail.includes("@") &&
    escalationRules.trim() !== "";

  const generatePreview = async () => {
    const tenantId = getTenantId();
    if (!tenantId || !tone || !emailSignature) return;
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/onboarding/preview-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          tone,
          languageHandling,
          emailSignature,
          dos: dos.filter((d) => d.trim()),
          donts: donts.filter((d) => d.trim()),
          storeName: data.storeInfo.name || "",
          storeUrl: data.storeUrl || "",
          storeDescription: data.storeInfo.description || "",
          platform: data.platform || "",
          products:
            data.products
              ?.slice(0, 10)
              ?.map((p) => ({ title: p.title, url: p.url })) || [],
          policies:
            data.policies?.map((p) => ({
              title: p.title,
              url: p.url,
              content: p.content?.slice(0, 500),
            })) || [],
          faq: data.faq?.slice(0, 5) || [],
          analyzedSubjects: analyzedEmails.slice(0, 8).map((e) => e.subject),
          previousQuestions,
        }),
        credentials: "same-origin",
      });
      const json = await res.json();
      if (res.ok) {
        setPreviewQuestion(json.question);
        setPreviewReply(json.reply);
        setPreviewThinking(json.thinking || "");
        setPreviewSteps(json.agentSteps || []);
        if (json.question?.subject) {
          setPreviousQuestions((prev) => [
            ...prev.slice(-4),
            json.question.subject,
          ]);
        }
      }
    } catch {
      // Silent fail for preview
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      tone,
      languageHandling,
      emailSignature,
      dos: dos.filter((d) => d.trim() !== ""),
      donts: donts.filter((d) => d.trim() !== ""),
      escalationName,
      escalationEmail,
      internalLang,
      escalationRules,
    });
  };

  // Determine if we can show the "Analyze emails" button
  const canAnalyze = isImap || googleConnected === true;

  return (
    <div>
      <SetupStepIndicator current="brand-voice" platform={data.platform} />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brand Voice</h1>
          <p className="text-gray-500 text-sm mt-1">
            We&apos;ll analyze your sent emails to automatically detect your
            brand voice.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={onBack}
            className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            ← Back
          </Button>
        </div>
      </div>

      {/* Step 1: Analyze emails */}
      {!hasResult && (
        <div className="max-w-2xl space-y-6">
          <div className="p-6 bg-white border border-gray-200 rounded-2xl">
            {/* IMAP connection info */}
            {isImap && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-gray-600"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <polyline points="22,7 12,13 2,7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      IMAP / SMTP
                    </h3>
                    <p className="text-xs text-green-600">
                      Connected as {emailSetupData?.imapUser}
                    </p>
                  </div>
                </div>
                {!analyzing && (
                  <div>
                    <p className="text-sm text-gray-500 mb-4">
                      We&apos;ll connect to your mailbox via IMAP, read your
                      recent sent emails, and use AI to extract your
                      brand&apos;s tone of voice, language rules, and email
                      signature.
                    </p>
                    <Button
                      onClick={runAnalysis}
                      className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
                    >
                      Analyze emails
                    </Button>
                  </div>
                )}
              </>
            )}

            {/* Google connection info */}
            {!isImap && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      Google Workspace
                    </h3>
                    {googleConnected === null && (
                      <p className="text-xs text-gray-400">
                        Checking connection...
                      </p>
                    )}
                    {googleConnected === true && (
                      <p className="text-xs text-green-600">
                        Connected as {googleEmail}
                      </p>
                    )}
                    {googleConnected === false && (
                      <p className="text-xs text-gray-400">Not connected</p>
                    )}
                  </div>
                </div>

                {googleConnected === false && (
                  <div>
                    <p className="text-sm text-gray-500 mb-4">
                      Connect your Google account so we can read your sent
                      emails and automatically detect your brand voice, tone,
                      and signature.
                    </p>
                    <Button
                      onClick={connectGoogle}
                      className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
                    >
                      Connect Google
                    </Button>
                  </div>
                )}

                {googleConnected === true && !analyzing && (
                  <div>
                    <p className="text-sm text-gray-500 mb-4">
                      We&apos;ll read your recent sent emails and use AI to
                      extract your brand&apos;s tone of voice, language rules,
                      email signature, and communication patterns.
                    </p>
                    <Button
                      onClick={runAnalysis}
                      className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
                    >
                      Analyze emails
                    </Button>
                  </div>
                )}
              </>
            )}

            {analyzing && (
              <div className="flex items-center gap-3 py-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <p className="text-sm text-gray-500">
                  {isImap
                    ? "Connecting to mailbox and analyzing emails..."
                    : "Reading and analyzing your emails..."}
                </p>
              </div>
            )}

            {analyzeError && (
              <Alert variant="destructive" className="mt-4">
                <AlertDescription className="flex items-center gap-2">
                  {analyzeError}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAnalyzeError("")}
                    className="h-auto px-1 text-destructive"
                  >
                    ✕
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Review & Edit AI results */}
      {hasResult && (
        <div className="flex gap-8 items-start">
          {/* Left: Form */}
          <form
            onSubmit={handleSubmit}
            className="space-y-6 flex-1 min-w-0 max-w-2xl"
          >
            <div className="bg-green-50 border border-green-100 rounded-xl overflow-hidden">
              <div className="p-4 flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-green-600 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm text-green-800 flex-1">
                  Analyzed {emailsAnalyzed} conversations. Review and adjust the
                  results below.
                </p>
                {analyzedEmails.length > 0 && (
                  <Button
                    type="button"
                    onClick={() => setShowEmails(!showEmails)}
                    className="text-xs text-green-700 hover:text-green-900 font-medium flex items-center gap-1"
                  >
                    {showEmails ? "Hide" : "Show"} conversations
                    <svg
                      className={`w-3.5 h-3.5 transition-transform ${showEmails ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </Button>
                )}
              </div>
              {showEmails && analyzedEmails.length > 0 && (
                <div className="border-t border-green-100 px-4 py-3 space-y-1.5 max-h-64 overflow-y-auto">
                  {analyzedEmails.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-green-400 font-mono shrink-0 w-5 text-right">
                        {i + 1}.
                      </span>
                      {e.hasInbound && (
                        <span className="shrink-0 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                          Q&amp;A
                        </span>
                      )}
                      <span className="text-green-800 font-medium truncate flex-1">
                        {e.subject || "(no subject)"}
                      </span>
                      <span className="text-green-500 shrink-0 truncate max-w-48">
                        → {e.to || "unknown"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tone */}
            <FormGroup label="Tone of voice" required>
              <Select value={tone || undefined} onValueChange={setTone}>
                <SelectTrigger className="w-full rounded-xl bg-muted/50">
                  <SelectValue placeholder="Select a tone..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">Casual &amp; Friendly</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enthusiastic">Enthusiastic &amp; Upbeat</SelectItem>
                  <SelectItem value="empathetic">Empathetic &amp; Warm</SelectItem>
                  <SelectItem value="concise">Concise &amp; Direct</SelectItem>
                </SelectContent>
              </Select>
            </FormGroup>

            {/* Language Handling */}
            <FormGroup
              label="Language handling"
              required
              hint="When should the AI switch language?"
            >
              <Textarea
                value={languageHandling}
                onChange={(e) => setLanguageHandling(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 resize-none"
              />
            </FormGroup>

            {/* Email Signature */}
            <FormGroup
              label="Email signature"
              required
              hint="How should the AI sign off emails?"
            >
              <Textarea
                value={emailSignature}
                onChange={(e) => setEmailSignature(e.target.value)}
                placeholder={
                  "Met vriendelijke groet,\nTeis Egelie\nOprichter Schoolregister.nl"
                }
                rows={4}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 resize-none"
              />
            </FormGroup>

            {/* Do's */}
            <FormGroup label="Do's" hint="Rules the AI should always follow.">
              <div className="space-y-2">
                {dos.map((d, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      type="text"
                      value={d}
                      onChange={(e) => updateDo(i, e.target.value)}
                      placeholder="e.g., Always apologize for delays"
                      className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300"
                    />
                    {dos.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removeDo(i)}
                        className="text-gray-300 hover:text-gray-500 text-sm px-1"
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  onClick={addDo}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  + Add another rule
                </Button>
              </div>
            </FormGroup>

            {/* Don'ts */}
            <FormGroup label="Don'ts" hint="Things the AI should never do.">
              <div className="space-y-2">
                {donts.map((d, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      type="text"
                      value={d}
                      onChange={(e) => updateDont(i, e.target.value)}
                      placeholder="e.g., Never make up shipping dates"
                      className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300"
                    />
                    {donts.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removeDont(i)}
                        className="text-gray-300 hover:text-gray-500 text-sm px-1"
                      >
                        ✕
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  onClick={addDont}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  + Add another rule
                </Button>
              </div>
            </FormGroup>

            {/* Escalation - pre-filled after email analysis */}
            <div className="pt-4 border-t border-gray-100 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  Escalation Settings
                </h3>
                <p className="text-xs text-gray-500">
                  Pre-filled based on your email history. Adjust as needed.
                </p>
              </div>

              <FormGroup
                label="Final escalation contact"
                required
                hint="When all automated steps fail, who do we escalate to?"
              >
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="text"
                    value={escalationName}
                    onChange={(e) => setEscalationName(e.target.value)}
                    placeholder="Name"
                    className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300"
                    required
                  />
                  <Input
                    type="email"
                    value={escalationEmail}
                    onChange={(e) => setEscalationEmail(e.target.value)}
                    placeholder="manager@yourbrand.com"
                    className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300"
                    required
                  />
                </div>
              </FormGroup>

              <FormGroup
                label="Preferred Language for Internal Communication"
                required
              >
                <Select value={internalLang} onValueChange={setInternalLang}>
                  <SelectTrigger className="w-full rounded-xl bg-muted/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormGroup>

              <FormGroup
                label="When should we escalate?"
                required
                hint="Based on your email patterns and ecommerce best-practice defaults."
              >
                <Textarea
                  value={escalationRules}
                  onChange={(e) => setEscalationRules(e.target.value)}
                  placeholder="e.g., After 3 back-and-forth emails, legal threats, refund requests over $100..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300 resize-none"
                  required
                />
              </FormGroup>
            </div>

            {/* Submit */}
            <div className="pt-2 flex gap-3">
              <Button
                type="button"
                onClick={runAnalysis}
                className="px-5 py-3 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Re-analyze
              </Button>
              <Button
                type="submit"
                disabled={!isValid || saving}
                className="px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Saving..." : "Continue →"}
              </Button>
            </div>
          </form>

          {/* Right: Preview Panel */}
          <div className="w-96 shrink-0 sticky top-6">
            <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Preview</h3>
                <Button
                  type="button"
                  onClick={() => generatePreview()}
                  disabled={previewLoading || !tone || !emailSignature}
                  className="text-xs font-medium text-black hover:text-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                >
                  {previewLoading ? (
                    <>
                      <div className="w-3 h-3 border-[1.5px] border-gray-200 border-t-black rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : previewReply ? (
                    <>
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Try another
                    </>
                  ) : (
                    "Generate preview"
                  )}
                </Button>
              </div>

              {!previewQuestion && !previewLoading && (
                <div className="px-5 py-12 text-center">
                  <svg
                    className="w-10 h-10 text-gray-200 mx-auto mb-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-sm text-gray-400">
                    Generate a preview to see how the AI would respond to a
                    customer email.
                  </p>
                </div>
              )}

              {previewLoading && !previewQuestion && (
                <div className="px-5 py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-400">
                    Generating example reply...
                  </p>
                </div>
              )}

              {previewQuestion && (
                <div className="divide-y divide-gray-100">
                  {/* Customer question */}
                  <div className="px-5 py-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                        <span className="text-[10px] font-bold text-gray-500">
                          {previewQuestion.from.charAt(0)}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-gray-900">
                        {previewQuestion.from}
                      </span>
                      <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                        Customer
                      </span>
                    </div>
                    <p className="text-xs font-medium text-gray-700 mb-1">
                      {previewQuestion.subject}
                    </p>
                    <p className="text-xs text-gray-500 whitespace-pre-line leading-relaxed">
                      {previewQuestion.body}
                    </p>
                  </div>

                  {/* AI reply */}
                  <div className="px-5 py-4 bg-blue-50/30">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white">
                          AI
                        </span>
                      </div>
                      <span className="text-xs font-medium text-gray-900">
                        {data.storeInfo.name || "AI Assistant"}
                      </span>
                      <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        AI Reply
                      </span>
                    </div>
                    {previewLoading ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span className="text-xs text-gray-400">
                          Regenerating...
                        </span>
                      </div>
                    ) : (
                      <>
                        {/* Agent steps */}
                        {previewSteps.length > 0 && (
                          <details className="mb-3">
                            <summary className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600 select-none flex items-center gap-1">
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                              Agent steps ({previewSteps.length})
                            </summary>
                            <div className="mt-1.5 pl-2 border-l-2 border-gray-200 space-y-1">
                              {previewSteps.map((s, i) => (
                                <div
                                  key={i}
                                  className="flex items-start gap-1.5"
                                >
                                  <span className="text-[10px] font-mono text-gray-300 mt-px">
                                    {i + 1}.
                                  </span>
                                  <div className="text-[10px] text-gray-400">
                                    {s.step === "triage" && (
                                      <span>
                                        <span className="font-medium text-gray-500">
                                          Triage
                                        </span>
                                        {" → "}
                                        {s.category}
                                        {s.lookup?.length
                                          ? ` (lookup: ${s.lookup.join(", ")})`
                                          : ""}
                                        {s.reasoning ? ` - ${s.reasoning}` : ""}
                                      </span>
                                    )}
                                    {s.step === "lookup" && (
                                      <div>
                                        <span>
                                          <span className="font-medium text-gray-500">
                                            Lookup
                                          </span>
                                          {" → "}
                                          {s.found} source
                                          {s.found !== 1 ? "s" : ""} checked
                                          {s.sources?.length
                                            ? ` (${s.sources.join(", ")})`
                                            : ""}
                                        </span>
                                        {s.toolCalls &&
                                          s.toolCalls.length > 0 && (
                                            <div className="mt-1 space-y-0.5 pl-1">
                                              {s.toolCalls.map((tc, ti) => (
                                                <div
                                                  key={ti}
                                                  className="flex items-center gap-1 text-[10px]"
                                                >
                                                  <span className="text-gray-300">
                                                    ↳
                                                  </span>
                                                  <span className="font-mono text-gray-500">
                                                    {tc.tool}
                                                  </span>
                                                  {tc.query && (
                                                    <span className="text-gray-400">
                                                      ({tc.query})
                                                    </span>
                                                  )}
                                                  <span className="text-gray-300">
                                                    →
                                                  </span>
                                                  <span
                                                    className={
                                                      tc.result?.startsWith(
                                                        "Error",
                                                      )
                                                        ? "text-red-400"
                                                        : "text-green-500"
                                                    }
                                                  >
                                                    {tc.result || "done"}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                      </div>
                                    )}
                                    {s.step === "reply" && (
                                      <span>
                                        <span className="font-medium text-gray-500">
                                          Reply
                                        </span>
                                        {" → "}generated
                                        {previewThinking
                                          ? ` - ${previewThinking}`
                                          : ""}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                        <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">
                          {previewReply}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
