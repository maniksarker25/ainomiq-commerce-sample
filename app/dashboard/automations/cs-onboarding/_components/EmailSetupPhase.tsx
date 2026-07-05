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
import type { EmailSetupData, GmailInfo } from "../_lib/types";
import { SetupStepIndicator } from "./SetupStepIndicator";
import { ProviderIcon, FormGroup } from "./shared";


export function EmailSetupPhase({
  data,
  onBack,
  onContinue,
}: {
  data: ScrapeResult;
  onBack: () => void;
  onContinue: (emailData: EmailSetupData) => void;
}) {
  const isGoogleProvider =
    data.contact.emailProvider?.includes("Google") ?? false;
  const [connectionMethod, setConnectionMethod] = useState<
    "google_oauth" | "imap_smtp" | null
  >(isGoogleProvider ? null : "imap_smtp");
  const [gmailInfo, setGmailInfo] = useState<GmailInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

  // IMAP/SMTP fields
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [imapUser, setImapUser] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [manualEmail, setManualEmail] = useState(data.contact.email || "");
  const [autodetecting, setAutodetecting] = useState(false);
  const [autodetectSource, setAutodetectSource] = useState<string | null>(null);
  const autodetectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const autodetectMailSettings = useCallback(async (email: string) => {
    if (!email.includes("@") || email.indexOf("@") === email.length - 1) return;
    const domain = email.split("@")[1];
    if (!domain || domain.length < 3 || !domain.includes(".")) return;

    setAutodetecting(true);
    setAutodetectSource(null);
    try {
      const res = await fetch(
        `/api/onboarding/mail-settings?email=${encodeURIComponent(email)}`,
      );
      if (!res.ok) return;
      const settings = await res.json();
      if (settings.imapHost) {
        setImapHost(settings.imapHost);
        setImapPort(settings.imapPort || "993");
        setSmtpHost(settings.smtpHost);
        setSmtpPort(settings.smtpPort || "587");
        setAutodetectSource(
          settings.source === "guess"
            ? null
            : settings.provider || settings.source,
        );
      }
    } catch {
      // Non-critical
    } finally {
      setAutodetecting(false);
    }
  }, []);

  const handleManualEmailChange = useCallback(
    (val: string) => {
      setManualEmail(val);
      setImapUser(val);
      if (autodetectTimerRef.current) clearTimeout(autodetectTimerRef.current);
      autodetectTimerRef.current = setTimeout(
        () => autodetectMailSettings(val),
        600,
      );
    },
    [autodetectMailSettings],
  );

  const getTenantId = useCallback(() => getSessionTenantId(getSession()), []);

  // Fetch Gmail info on mount
  const fetchInfo = useCallback(async () => {
    const tenantId = getTenantId();
    if (!tenantId) return;
    try {
      const res = await fetch(
        `/api/onboarding/email-info?tenant_id=${encodeURIComponent(tenantId)}`,
        { credentials: "same-origin" },
      );
      const info: GmailInfo = await res.json();
      setGmailInfo(info);
      if (info.connected) {
        setConnectionMethod("google_oauth");
        if (info.sendAsEmails?.length) {
          setSelectedEmails((prev) =>
            prev.length ? prev : info.sendAsEmails!,
          );
        }
      }
    } catch {
      setGmailInfo({ connected: false });
    } finally {
      setLoading(false);
    }
  }, [getTenantId]);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  // Pre-detect mail provider on mount so the IMAP card shows the provider name
  useEffect(() => {
    const email = data.contact.email;
    if (
      email &&
      email.includes("@") &&
      !data.contact.emailProvider?.includes("Google")
    ) {
      autodetectMailSettings(email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll while Google selected but not connected
  useEffect(() => {
    if (connectionMethod !== "google_oauth" || gmailInfo?.connected !== false)
      return;
    const interval = setInterval(fetchInfo, 2500);
    return () => clearInterval(interval);
  }, [connectionMethod, gmailInfo?.connected, fetchInfo]);

  const connectGoogle = () => {
    window.open("/api/auth/google/connect", "_blank");
  };

  const disconnectGoogle = async () => {
    const tenantId = getTenantId();
    if (!tenantId || disconnectingGoogle) return;
    if (!window.confirm("Disconnect Google Workspace for this onboarding?"))
      return;

    setDisconnectingGoogle(true);
    try {
      const res = await fetch("/api/auth/google/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ tenant_id: tenantId }),
      });

      if (!res.ok) throw new Error("Failed to disconnect Google");

      setConnectionMethod(null);
      setGmailInfo({ connected: false });
      setSelectedEmails([]);
      await fetchInfo();
    } catch (err) {
      console.error("[Onboarding] Disconnect Google failed:", err);
      alert("Could not disconnect Google right now. Please try again.");
    } finally {
      setDisconnectingGoogle(false);
    }
  };

  const toggleEmail = (email: string) => {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email],
    );
  };

  const googleConnected =
    connectionMethod === "google_oauth" && gmailInfo?.connected;
  const imapValid =
    connectionMethod === "imap_smtp" &&
    imapHost &&
    smtpHost &&
    imapUser &&
    imapPassword &&
    manualEmail.includes("@");
  const emailConnected = googleConnected || imapValid;

  const isValid =
    emailConnected &&
    (connectionMethod === "imap_smtp" || selectedEmails.length > 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !connectionMethod) return;
    onContinue({
      emailProvider:
        connectionMethod === "google_oauth" ? "google_workspace" : "imap_smtp",
      connectionMethod,
      supportEmails:
        connectionMethod === "google_oauth" ? selectedEmails : [manualEmail],
      hasWorkspace: connectionMethod === "google_oauth" ? "yes" : "no",
      hasWorkspaceOther: "",
      ...(connectionMethod === "imap_smtp"
        ? {
            imapHost,
            imapPort,
            smtpHost,
            smtpPort,
            imapUser,
            imapPassword,
          }
        : {}),
    });
  };

  return (
    <div>
      <SetupStepIndicator current="email-setup" platform={data.platform} />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Connect Email</h1>
          <p className="text-gray-500 text-sm mt-1">
            Connect your email so we can handle customer service automatically.
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

      <div className="max-w-2xl space-y-6">
        {/* Connection Method Picker */}
        {!googleConnected && !imapValid && (
          <div className="space-y-3">
            <div
              className={`grid gap-4 ${isGoogleProvider ? "grid-cols-2" : "grid-cols-1"}`}
            >
              {/* Primary card based on detected provider */}
              {isGoogleProvider ? (
                <>
                  {/* Google first when detected */}
                  <Button
                    onClick={() => setConnectionMethod("google_oauth")}
                    className={`p-5 text-left border rounded-2xl transition-all ${
                      connectionMethod === "google_oauth"
                        ? "border-black bg-gray-50 ring-1 ring-black"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <ProviderIcon provider="Google Workspace" size={20} />
                      <span className="text-sm font-semibold text-gray-900">
                        Google Workspace
                      </span>
                      <span className="ml-auto text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                        Detected
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      One-click connect via OAuth. Recommended for Gmail &amp;
                      Google Workspace users.
                    </p>
                  </Button>
                  {/* IMAP as secondary */}
                  <Button
                    onClick={() => {
                      setConnectionMethod("imap_smtp");
                      if (manualEmail.includes("@"))
                        autodetectMailSettings(manualEmail);
                    }}
                    className={`p-5 text-left border rounded-2xl transition-all ${
                      connectionMethod === "imap_smtp"
                        ? "border-black bg-gray-50 ring-1 ring-black"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {data.contact.mxProvider ? (
                        <ProviderIcon
                          provider={data.contact.mxProvider}
                          size={20}
                        />
                      ) : (
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
                      )}
                      <span className="text-sm font-semibold text-gray-900">
                        {data.contact.mxProvider
                          ? `${data.contact.mxProvider} IMAP`
                          : "IMAP / SMTP"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {data.contact.mxProvider ? (
                        <>
                          Connect via {data.contact.mxProvider} IMAP/SMTP
                          instead.
                        </>
                      ) : (
                        "Manual setup for Outlook, Yahoo, or any other email provider."
                      )}
                    </p>
                  </Button>
                </>
              ) : (
                <>
                  {/* IMAP first when Google not detected */}
                  <Button
                    onClick={() => {
                      setConnectionMethod("imap_smtp");
                      if (manualEmail.includes("@"))
                        autodetectMailSettings(manualEmail);
                    }}
                    className={`p-5 text-left border rounded-2xl transition-all ${
                      connectionMethod === "imap_smtp"
                        ? "border-black bg-gray-50 ring-1 ring-black"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {data.contact.emailProvider &&
                      data.contact.emailProvider !== "other" ? (
                        <ProviderIcon
                          provider={data.contact.emailProvider}
                          size={20}
                        />
                      ) : (
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
                      )}
                      <span className="text-sm font-semibold text-gray-900">
                        {data.contact.emailProvider &&
                        data.contact.emailProvider !== "other"
                          ? data.contact.emailProvider
                          : "IMAP / SMTP"}
                      </span>
                      {autodetectSource && (
                        <span className="ml-auto text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                          {autodetectSource}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {data.contact.email ? (
                        <>
                          Connect{" "}
                          <span className="font-medium text-gray-700">
                            {data.contact.email}
                          </span>{" "}
                          via IMAP/SMTP.
                        </>
                      ) : (
                        "Manual setup for Outlook, Yahoo, or any other email provider."
                      )}
                    </p>
                  </Button>
                </>
              )}
            </div>

            {/* Show Google as a subtle alternative when not detected */}
            {!isGoogleProvider && connectionMethod !== "google_oauth" && (
              <Button
                onClick={() => setConnectionMethod("google_oauth")}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <ProviderIcon provider="Google Workspace" size={16} />
                Or connect via Google Workspace instead →
              </Button>
            )}
          </div>
        )}

        {/* Google OAuth Details */}
        {connectionMethod === "google_oauth" && !gmailInfo?.connected && (
          <div className="p-6 bg-white border border-gray-200 rounded-2xl">
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
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900">
                  Google Workspace
                </h3>
                {loading ? (
                  <p className="text-xs text-gray-400">
                    Checking connection...
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">Not connected</p>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Connect your Google account to let us read and respond to customer
              emails.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={connectGoogle}
                className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
              >
                Connect Google
              </Button>
              <Button
                type="button"
                onClick={() => setConnectionMethod(null)}
                className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700"
              >
                Choose different method
              </Button>
            </div>
          </div>
        )}

        {/* Google Connected Summary */}
        {googleConnected && (
          <div className="p-6 bg-white border border-gray-200 rounded-2xl">
            <div className="flex items-center gap-3">
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
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900">
                  Google Workspace
                </h3>
                <p className="text-xs text-green-600">
                  Connected as {gmailInfo?.email}
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 rounded-lg">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                <span className="text-xs text-green-700 font-medium">
                  Active
                </span>
              </div>
            </div>
            {gmailInfo?.messagesTotal != null && (
              <div className="flex gap-4 mt-3">
                <div className="text-xs text-gray-400">
                  <span className="font-medium text-gray-600">
                    {gmailInfo.messagesTotal.toLocaleString()}
                  </span>{" "}
                  messages
                </div>
                <div className="text-xs text-gray-400">
                  <span className="font-medium text-gray-600">
                    {gmailInfo.threadsTotal?.toLocaleString()}
                  </span>{" "}
                  threads
                </div>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <Button
                type="button"
                onClick={disconnectGoogle}
                disabled={disconnectingGoogle}
                className="text-xs font-medium text-red-600 hover:text-red-700 disabled:text-red-300 disabled:cursor-not-allowed"
              >
                {disconnectingGoogle ? "Disconnecting..." : "Disconnect Google"}
              </Button>
            </div>
          </div>
        )}

        {/* IMAP/SMTP Form */}
        {connectionMethod === "imap_smtp" && (
          <div className="p-6 bg-white border border-gray-200 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                IMAP / SMTP Settings
              </h3>
              <Button
                type="button"
                onClick={() => setConnectionMethod(null)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Choose different method
              </Button>
            </div>

            <FormGroup label="Email address" required>
              <Input
                type="email"
                value={manualEmail}
                onChange={(e) => handleManualEmailChange(e.target.value)}
                placeholder="support@yourdomain.com"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300"
                required
              />
              {autodetecting && (
                <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1.5">
                  <svg
                    className="w-3 h-3 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Detecting mail server settings…
                </p>
              )}
              {!autodetecting && autodetectSource && (
                <p className="text-[11px] text-green-600 mt-1.5 flex items-center gap-1">
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Detected: {autodetectSource} - IMAP/SMTP auto-filled
                </p>
              )}
            </FormGroup>

            <FormGroup label="Username" required>
              <Input
                type="text"
                value={imapUser}
                onChange={(e) => setImapUser(e.target.value)}
                placeholder="Usually your full email address"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300"
                required
              />
            </FormGroup>

            <FormGroup label="Password / App password" required>
              <Input
                type="password"
                value={imapPassword}
                onChange={(e) => setImapPassword(e.target.value)}
                placeholder="App-specific password recommended"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300"
                required
              />
            </FormGroup>

            <div className="grid grid-cols-2 gap-4">
              <FormGroup label="IMAP host" required>
                <Input
                  type="text"
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                  placeholder="imap.gmail.com"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300"
                  required
                />
              </FormGroup>
              <FormGroup label="IMAP port" required>
                <Input
                  type="text"
                  value={imapPort}
                  onChange={(e) => setImapPort(e.target.value)}
                  placeholder="993"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300"
                  required
                />
              </FormGroup>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormGroup label="SMTP host" required>
                <Input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300"
                  required
                />
              </FormGroup>
              <FormGroup label="SMTP port" required>
                <Input
                  type="text"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="587"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300"
                  required
                />
              </FormGroup>
            </div>

            {imapValid && (
              <div className="flex items-center gap-2 pt-1">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                <span className="text-xs text-green-600">
                  Settings filled - credentials will be verified on save.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Rest of the form - shown when email is connected/configured */}
        {emailConnected && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Addresses (send-as aliases) - Google only */}
            {googleConnected &&
              gmailInfo?.sendAsEmails &&
              gmailInfo.sendAsEmails.length > 0 && (
                <FormGroup
                  label="Support Email Addresses"
                  required
                  hint="Select which email addresses should handle customer support."
                >
                  <div className="space-y-2">
                    {gmailInfo.sendAsEmails.map((email) => (
                      <label
                        key={email}
                        className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
                      >
                        <Checkbox
                          checked={selectedEmails.includes(email)}
                          onCheckedChange={() => toggleEmail(email)}
                        />
                        <span className="text-sm text-gray-900">{email}</span>
                        {email === gmailInfo.email && (
                          <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
                            primary
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                </FormGroup>
              )}

            {/* Labels - Google only */}
            {googleConnected &&
              gmailInfo?.labels &&
              gmailInfo.labels.length > 0 && (
                <FormGroup
                  label="Custom Labels"
                  hint="Existing labels in your mailbox - we'll use these for organizing."
                >
                  <div className="flex flex-wrap gap-1.5">
                    {gmailInfo.labels.map((l) => (
                      <span
                        key={l.id}
                        className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-2.5 py-1 rounded-lg"
                      >
                        {l.name}
                      </span>
                    ))}
                  </div>
                </FormGroup>
              )}

            {/* Submit */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={!isValid}
                className="px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Continue →
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
