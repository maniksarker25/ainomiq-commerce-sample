"use client";

import { useState, useRef, useEffect } from "react";
import { fetchSession } from "@/lib/session";
import AppSettingsPanel from "@/components/AppSettingsPanel";
import type { ScrapeResult } from "@/lib/scraper";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import type {
  Phase,
  ScrapeProgress,
  EmailSetupData,
  BrandVoiceData,
  ChannelUpsellData,
} from "./_lib/types";
import {
  readOnboardingDraft,
  patchOnboardingDraft,
  clearOnboardingDraft,
} from "./_lib/draft";

import { UrlInputStep } from "./_components/UrlInputStep";
import { ScrapingPhase } from "./_components/ScrapingPhase";
import { VerifyPhase } from "./_components/VerifyPhase";
import { EmailSetupPhase } from "./_components/EmailSetupPhase";
import { ShopifyConnectPhase } from "./_components/ShopifyConnectPhase";
import { BrandVoicePhase } from "./_components/BrandVoicePhase";
import { ChannelUpsellPhase } from "./_components/ChannelUpsellPhase";
import { SuccessState } from "./_components/SuccessState";

export default function CSOnboardingPage() {
  const [phase, setPhase] = useState<Phase>("url-input");
  const [currentStep, setCurrentStep] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [emailSetupData, setEmailSetupData] = useState<EmailSetupData | null>(
    null,
  );
  const [brandVoiceData, setBrandVoiceData] = useState<BrandVoiceData | null>(
    null,
  );
  const abortRef = useRef<AbortController | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

  useEffect(() => {
    if (draftLoaded) return;
    const draft = readOnboardingDraft();
    if (draft?.phase && draft.phase !== "scraping")
      setPhase(draft.phase as Phase);
    if (draft?.result) setResult(draft.result as ScrapeResult);
    if (draft?.emailSetupData)
      setEmailSetupData(draft.emailSetupData as EmailSetupData);
    if (draft?.brandVoiceData)
      setBrandVoiceData(draft.brandVoiceData as BrandVoiceData);
    setDraftLoaded(true);
  }, [draftLoaded]);

  useEffect(() => {
    if (!draftLoaded) return;
    patchOnboardingDraft({
      phase: phase === "scraping" ? "url-input" : phase,
      result,
      emailSetupData,
      brandVoiceData,
    });
  }, [draftLoaded, phase, result, emailSetupData, brandVoiceData]);

  const startScrape = async (url: string) => {
    setPhase("scraping");
    setError("");
    setCurrentStep("detecting");
    setMessage("Detecting platform...");

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/onboarding/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        credentials: "same-origin",
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: "Request failed" }));
        throw new Error(data.error || "Request failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload: ScrapeProgress = JSON.parse(line.slice(6));
            setCurrentStep(payload.step);
            setMessage(payload.message);
            if (payload.step === "complete" && payload.data) {
              setResult(payload.data);
              setPhase("verify");
            }
            if (payload.step === "error") {
              throw new Error(payload.message);
            }
          } catch (e) {
            if (e instanceof Error && e.message !== "No stream") throw e;
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("url-input");
    }
  };

  const handleConfirm = async (
    brandData: BrandVoiceData,
    upsellData: ChannelUpsellData | null,
  ) => {
    if (!result || !emailSetupData) return;
    setSaving(true);
    try {
      const res = await fetch("/api/onboarding/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...result,
          emailSetup: emailSetupData,
          brandVoice: brandData,
          channelUpsells: upsellData,
        }),
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Save failed");
      await fetchSession();
      clearOnboardingDraft();
      setPhase("success");
    } catch {
      setError("Failed to save. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <AppSettingsPanel
        appName="Intelli Support"
        appKey="ai-customer-service"
        directory="/dashboard/cs"
        setupHref="/dashboard/automations/cs-onboarding"
        integrations={[
          {
            provider: "gmail",
            label: "Gmail / Google Workspace",
            required: true,
            href: "/dashboard/settings?tab=integrations",
          },
          {
            provider: "shopify",
            label: "Shopify orders",
            href: "/dashboard/settings?tab=integrations",
          },
          {
            provider: "instagram",
            label: "Instagram support",
            href: "/dashboard/settings?tab=integrations",
          },
          {
            provider: "facebook",
            label: "Facebook support",
            href: "/dashboard/settings?tab=integrations",
          },
          {
            provider: "twilio",
            label: "Phone support",
            href: "/dashboard/settings?tab=integrations",
          },
        ]}
        settingsName="Support settings"
        description="Setup saves support-specific mail, webshop, support channel, and voice preferences for this workspace."
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          {error}
          <button
            onClick={() => setError("")}
            className="ml-3 text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      )}

      {phase === "url-input" && (
        <UrlInputStep onSubmit={startScrape} loading={false} />
      )}
      {phase === "scraping" && (
        <ScrapingPhase currentStep={currentStep} message={message} />
      )}
      {phase === "verify" && result && (
        <VerifyPhase
          data={result}
          onBack={() => {
            setPhase("url-input");
            setResult(null);
          }}
          onContinue={() => setPhase("email-setup")}
          onChangeDomain={(url) => {
            setResult(null);
            startScrape(url);
          }}
        />
      )}
      {phase === "email-setup" && result && (
        <EmailSetupPhase
          data={result}
          onBack={() => setPhase("verify")}
          onContinue={(emailData) => {
            setEmailSetupData(emailData);
            setPhase(
              result.platform === "shopify" ? "shopify-connect" : "brand-voice",
            );
          }}
        />
      )}
      {phase === "shopify-connect" && result && (
        <ShopifyConnectPhase
          data={result}
          onBack={() => setPhase("email-setup")}
          onContinue={() => setPhase("brand-voice")}
        />
      )}
      {phase === "brand-voice" && result && (
        <BrandVoicePhase
          data={result}
          emailSetupData={emailSetupData}
          onBack={() =>
            setPhase(
              result.platform === "shopify" ? "shopify-connect" : "email-setup",
            )
          }
          onConfirm={(brandData) => {
            setSaving(false);
            setBrandVoiceData(brandData);
            setPhase("channel-upsell");
          }}
          saving={saving}
        />
      )}
      {phase === "channel-upsell" && result && (
        <ChannelUpsellPhase
          result={result}
          emailSetupData={emailSetupData}
          brandVoiceData={brandVoiceData}
          onBack={() => setPhase("brand-voice")}
          saving={saving}
          onConfirm={async (upsellData) => {
            if (!brandVoiceData) {
              setError(
                "Brand voice data missing. Please go back and confirm again.",
              );
              return;
            }
            await handleConfirm(brandVoiceData, upsellData);
          }}
        />
      )}
      {phase === "success" && (
        <div className="max-w-2xl mx-auto p-8 bg-white border border-gray-200 rounded-2xl text-center">
          <div className="w-14 h-14 rounded-full bg-green-50 text-green-600 mx-auto flex items-center justify-center mb-4">
            ✓
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            CS onboarding completed
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            Your voice + number setup is saved. You can now open the Intelli
            Support dashboard.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => (window.location.href = "/dashboard/cs")}
              className="px-5 py-3 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800"
            >
              Open CS dashboard
            </button>
            <button
              onClick={() => (window.location.href = "/dashboard/settings")}
              className="px-5 py-3 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50"
            >
              Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}