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
import { getSession } from "@/lib/session";
import type { ScrapeResult } from "@/lib/scraper";
import type { EmailSetupData, BrandVoiceData, ChannelUpsellData } from "../_lib/types";
import { defaultBotStartLocalValue } from "../_lib/helpers";
import { SetupStepIndicator } from "./SetupStepIndicator";
import { FormGroup } from "./shared";


export function ChannelUpsellPhase({
  result,
  emailSetupData,
  brandVoiceData,
  onBack,
  onConfirm,
  saving,
}: {
  result: ScrapeResult;
  emailSetupData: EmailSetupData | null;
  brandVoiceData: BrandVoiceData | null;
  onBack: () => void;
  onConfirm: (upsell: ChannelUpsellData) => void;
  saving: boolean;
}) {
  const [whatsappUpsell, setWhatsappUpsell] = useState(true);
  const [phoneNumberUpsell, setPhoneNumberUpsell] = useState(true);

  const recommendedCountry = (
    result.availableMarkets?.[0]?.country || "NL"
  ).toUpperCase();
  const recommendedLanguage =
    brandVoiceData?.internalLang ||
    (result.storeInfo.language?.toLowerCase().startsWith("nl")
      ? "Dutch"
      : "English");
  const recommendedVoice: "friendly" | "professional" | "warm" =
    brandVoiceData?.tone === "professional" ||
    brandVoiceData?.tone === "concise"
      ? "professional"
      : brandVoiceData?.tone === "empathetic"
        ? "warm"
        : "friendly";

  const [preferredCountry, setPreferredCountry] = useState(recommendedCountry);
  const [numberType, setNumberType] = useState<"local" | "mobile">("local");
  const [numberContains, setNumberContains] = useState("");
  const [useExistingNumber, setUseExistingNumber] = useState(false);
  const [existingPhoneNumber, setExistingPhoneNumber] = useState("");
  const [preferredLanguage, setPreferredLanguage] =
    useState(recommendedLanguage);
  const [voiceStyle, setVoiceStyle] = useState<
    "friendly" | "professional" | "warm"
  >(recommendedVoice);
  const [expectedMonthlyEmails, setExpectedMonthlyEmails] = useState(800);
  const [expectedMonthlyMessages, setExpectedMonthlyMessages] = useState(300);
  const [expectedMonthlyCalls, setExpectedMonthlyCalls] = useState(40);
  const [botStartMode, setBotStartMode] = useState<"now" | "scheduled">("now");
  const [botStartLocal, setBotStartLocal] = useState(defaultBotStartLocalValue);
  const botStartTimezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Amsterdam";
  const [numberValidationLoading, setNumberValidationLoading] = useState(false);
  const [numberValidationState, setNumberValidationState] = useState<
    "idle" | "ok" | "error"
  >("idle");
  const [numberValidationMessage, setNumberValidationMessage] = useState("");
  const [shopifyCheckLoading, setShopifyCheckLoading] = useState(false);
  const [shopifyConnected, setShopifyConnected] = useState<boolean | null>(
    null,
  );

  const normalizedExistingNumber = existingPhoneNumber.replace(/[\s().-]/g, "");
  const existingNumberValid = /^\+[1-9]\d{7,14}$/.test(
    normalizedExistingNumber,
  );

  useEffect(() => {
    const tenantId = getSession()?.email || "";
    if (!tenantId) return;

    (async () => {
      setShopifyCheckLoading(true);
      try {
        const res = await fetch(
          `/api/auth/shopify/status?tenant_id=${encodeURIComponent(tenantId)}&_t=${Date.now()}`,
        );
        const json = await res.json().catch(() => ({}));
        setShopifyConnected(json.connected === true);
      } catch {
        setShopifyConnected(false);
      } finally {
        setShopifyCheckLoading(false);
      }
    })();
  }, []);

  const validateExistingNumber = async () => {
    if (!existingNumberValid || numberValidationLoading) return;
    const tenantId = getSession()?.email || "";
    if (!tenantId) return;

    setNumberValidationLoading(true);
    setNumberValidationState("idle");
    setNumberValidationMessage("");

    try {
      const res = await fetch("/api/onboarding/validate-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          tenant_id: tenantId,
          phoneNumber: normalizedExistingNumber,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.valid) {
        setNumberValidationState("error");
        setNumberValidationMessage(json.error || "Number validation failed");
      } else {
        setNumberValidationState("ok");
        setNumberValidationMessage(
          "Number found in Twilio and webhooks are configured.",
        );
      }
    } catch {
      setNumberValidationState("error");
      setNumberValidationMessage("Could not validate number right now.");
    } finally {
      setNumberValidationLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumberUpsell && useExistingNumber && !existingNumberValid) return;
    onConfirm({
      whatsappUpsell,
      phoneNumberUpsell,
      preferredCountry,
      numberType,
      numberContains: numberContains.trim() || undefined,
      useExistingNumber: phoneNumberUpsell ? useExistingNumber : false,
      existingPhoneNumber:
        phoneNumberUpsell && useExistingNumber
          ? normalizedExistingNumber
          : undefined,
      preferredLanguage,
      voiceStyle,
      expectedMonthlyEmails,
      expectedMonthlyMessages,
      expectedMonthlyCalls,
      botStartMode,
      botStartAt:
        botStartMode === "scheduled"
          ? new Date(botStartLocal).toISOString()
          : new Date().toISOString(),
      botStartTimezone,
    });
  };

  return (
    <div>
      <SetupStepIndicator current="channel-upsell" platform={result.platform} />
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Channels & Upsells
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Enable add-ons that get provisioned automatically via Twilio after
            checkout.
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

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div className="p-6 bg-white border border-gray-200 rounded-2xl space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={whatsappUpsell}
              onCheckedChange={(checked) => setWhatsappUpsell(checked === true)}
              className="mt-1"
            />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                WhatsApp Business automation
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Adds WhatsApp Business via Twilio (display name + templates +
                sender onboarding).
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={phoneNumberUpsell}
              onCheckedChange={(checked) => setPhoneNumberUpsell(checked === true)}
              className="mt-1"
            />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Website phone number
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Auto-purchases and configures a Twilio phone number for
                calls/messages.
              </p>
            </div>
          </label>
        </div>

        {(whatsappUpsell || phoneNumberUpsell) && (
          <div className="p-6 bg-white border border-gray-200 rounded-2xl space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">
              Provisioning preferences
            </h3>

            <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-xs text-gray-700">
              {shopifyCheckLoading ? (
                <span>Checking Shopify connection...</span>
              ) : shopifyConnected ? (
                <span>
                  ✓ Shopify connected (read access) for order lookup in voice
                  agent.
                </span>
              ) : (
                <span>
                  ⚠ Shopify not connected yet. Order-number lookup in calls will
                  not work until Shopify is connected in Settings.
                </span>
              )}
            </div>

            {phoneNumberUpsell && (
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={useExistingNumber}
                    onCheckedChange={(checked) => setUseExistingNumber(checked === true)}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Use existing number
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Skip number purchase and connect your already-owned Twilio
                      number.
                    </p>
                  </div>
                </label>

                {useExistingNumber ? (
                  <div className="space-y-3">
                    <FormGroup
                      label="Existing phone number (E.164)"
                      required
                      hint="Example: +31612345678"
                    >
                      <Input
                        type="text"
                        value={existingPhoneNumber}
                        onChange={(e) => {
                          setExistingPhoneNumber(e.target.value);
                          setNumberValidationState("idle");
                          setNumberValidationMessage("");
                        }}
                        placeholder="+31612345678"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300"
                        required
                      />
                      {!existingNumberValid &&
                        existingPhoneNumber.trim().length > 0 && (
                          <p className="text-xs text-red-600 mt-1">
                            Use E.164 format, e.g. +31612345678
                          </p>
                        )}
                    </FormGroup>

                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        onClick={validateExistingNumber}
                        disabled={
                          !existingNumberValid || numberValidationLoading
                        }
                        className="px-3 py-2 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {numberValidationLoading
                          ? "Testing..."
                          : "Test number in Twilio"}
                      </Button>
                      {numberValidationState === "ok" && (
                        <span className="text-xs text-green-600">
                          ✓ {numberValidationMessage}
                        </span>
                      )}
                      {numberValidationState === "error" && (
                        <span className="text-xs text-red-600">
                          ✕ {numberValidationMessage}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <FormGroup label="Preferred country" required>
                        <Select
                          value={preferredCountry}
                          onValueChange={setPreferredCountry}
                        >
                          <SelectTrigger className="w-full rounded-xl bg-muted/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NL">Netherlands (NL)</SelectItem>
                            <SelectItem value="BE">Belgium (BE)</SelectItem>
                            <SelectItem value="DE">Germany (DE)</SelectItem>
                            <SelectItem value="GB">United Kingdom (GB)</SelectItem>
                            <SelectItem value="US">United States (US)</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormGroup>
                      <FormGroup label="Number type" required>
                        <Select
                          value={numberType}
                          onValueChange={(v) =>
                            setNumberType(v as "local" | "mobile")
                          }
                        >
                          <SelectTrigger className="w-full rounded-xl bg-muted/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="local">Local</SelectItem>
                            <SelectItem value="mobile">Mobile</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormGroup>
                    </div>
                    <FormGroup
                      label="Preferred digits (optional)"
                      hint="We try to match this pattern if available."
                    >
                      <Input
                        type="text"
                        value={numberContains}
                        onChange={(e) => setNumberContains(e.target.value)}
                        placeholder="e.g. 020 or 1234"
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300"
                      />
                    </FormGroup>
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormGroup
                label="Preferred support language"
                required
                hint="Recommended from your site + onboarding."
              >
                <Select
                  value={preferredLanguage}
                  onValueChange={setPreferredLanguage}
                >
                  <SelectTrigger className="w-full rounded-xl bg-muted/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Dutch">Dutch</SelectItem>
                    <SelectItem value="German">German</SelectItem>
                    <SelectItem value="French">French</SelectItem>
                    <SelectItem value="Spanish">Spanish</SelectItem>
                  </SelectContent>
                </Select>
              </FormGroup>
              <FormGroup
                label="Voice style"
                required
                hint="How phone assistant should sound."
              >
                <Select
                  value={voiceStyle}
                  onValueChange={(v) =>
                    setVoiceStyle(v as "friendly" | "professional" | "warm")
                  }
                >
                  <SelectTrigger className="w-full rounded-xl bg-muted/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="warm">Warm</SelectItem>
                  </SelectContent>
                </Select>
              </FormGroup>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600">
              Recommended:{" "}
              <span className="font-medium text-gray-900">
                {recommendedCountry}
              </span>{" "}
              country,{" "}
              <span className="font-medium text-gray-900">
                {recommendedLanguage}
              </span>{" "}
              language,{" "}
              <span className="font-medium text-gray-900">
                {recommendedVoice}
              </span>{" "}
              voice. You can fully override these.
            </div>
          </div>
        )}

        <div className="p-6 bg-white border border-gray-200 rounded-2xl space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Agent start time
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Choose when Intelli Support may start processing customer emails
              for this workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              className={`rounded-xl border p-4 cursor-pointer transition-colors ${botStartMode === "now" ? "border-black bg-gray-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}
            >
              <input type="radio"
                name="botStartMode"
                value="now"
                checked={botStartMode === "now"}
                onChange={() => setBotStartMode("now")}
                className="sr-only"
              />
              <p className="text-sm font-semibold text-gray-900">
                Start after onboarding
              </p>
              <p className="text-xs text-gray-500 mt-1">
                The CS agent can begin on the next cron run.
              </p>
            </label>

            <label
              className={`rounded-xl border p-4 cursor-pointer transition-colors ${botStartMode === "scheduled" ? "border-black bg-gray-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}
            >
              <input type="radio"
                name="botStartMode"
                value="scheduled"
                checked={botStartMode === "scheduled"}
                onChange={() => setBotStartMode("scheduled")}
                className="sr-only"
              />
              <p className="text-sm font-semibold text-gray-900">
                Schedule a start time
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Use this when the team wants to go live later.
              </p>
            </label>
          </div>

          {botStartMode === "scheduled" && (
            <FormGroup
              label="Start date and time"
              required
              hint={`Timezone: ${botStartTimezone}`}
            >
              <Input
                type="datetime-local"
                value={botStartLocal}
                onChange={(e) => setBotStartLocal(e.target.value)}
                min={defaultBotStartLocalValue()}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5 focus:border-gray-300"
                required
              />
            </FormGroup>
          )}
        </div>

        <div className="p-6 bg-white border border-gray-200 rounded-2xl space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Pricing</h3>
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex items-center justify-between">
              <span>WhatsApp Business automation (one-time)</span>
              <span className="font-semibold">EUR 495</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Website phone number setup (one-time)</span>
              <span className="font-semibold">EUR 495</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="font-medium">Bundle deal (both)</span>
              <span className="font-bold text-gray-900">EUR 890</span>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 space-y-3">
            <p className="text-xs text-gray-500">
              Monthly cost is volume-based. Fill expected monthly usage so we
              can sync pricing and provisioning.
            </p>
            <div className="grid grid-cols-3 gap-3">
              <FormGroup label="Emails / month" required>
                <Input
                  type="number"
                  min={0}
                  value={expectedMonthlyEmails}
                  onChange={(e) =>
                    setExpectedMonthlyEmails(
                      Math.max(0, Number(e.target.value) || 0),
                    )
                  }
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                />
              </FormGroup>
              <FormGroup label="Messages / month" required>
                <Input
                  type="number"
                  min={0}
                  value={expectedMonthlyMessages}
                  onChange={(e) =>
                    setExpectedMonthlyMessages(
                      Math.max(0, Number(e.target.value) || 0),
                    )
                  }
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                />
              </FormGroup>
              <FormGroup label="Calls / month" required>
                <Input
                  type="number"
                  min={0}
                  value={expectedMonthlyCalls}
                  onChange={(e) =>
                    setExpectedMonthlyCalls(
                      Math.max(0, Number(e.target.value) || 0),
                    )
                  }
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/5"
                />
              </FormGroup>
            </div>
          </div>
        </div>

        <div className="pt-2 flex gap-3">
          <Button
            type="submit"
            disabled={
              saving ||
              (phoneNumberUpsell &&
                useExistingNumber &&
                (!existingNumberValid || numberValidationState !== "ok"))
            }
            className="px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Continue →"}
          </Button>
        </div>
      </form>
    </div>
  );
}
