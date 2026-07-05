"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  contentApiFetch,
  toastContentApiError,
} from "@/app/dashboard/content-pipeline/_lib/content-api";
import { useSearchParams } from "next/navigation";
import {
  brandProfileToAnalysis,
  brandProfileToIntake,
  isBrandProfileReady,
} from "@/lib/brand-profile";
import { fetchSession, type Session } from "@/lib/session";
import { buildMetaConnectHref, META_RETURN_PATHS } from "@/lib/meta-oauth";
import {
  CONTENT_IMAGE_MODELS,
  getContentImageModel,
} from "@/lib/content-image-models";
import AppSettingsPanel from "@/components/AppSettingsPanel";
import { SuccessState } from "./_components/SuccessState";
import { BrandDataStep } from "./_components/BrandDataStep";
import { ContentSettingsStep } from "./_components/ContentSettingsStep";
import { GeneratedPreview } from "./_components/GeneratedPreview";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle2,
  Settings,
  ArrowRight,
  RefreshCw,
  Smartphone,
  Globe,
  Check,
} from "lucide-react";

type CompanyIntake = {
  brand_name: string;
  website: string;
  what_you_sell: string;
  ideal_customer: string;
  customer_problem: string;
  main_offer: string;
  proof_points: string;
  competitors: string;
  brand_tone: string;
  content_goals: string;
};

type CompanyAnalysis = {
  summary?: string;
  positioning?: string;
  target_audience?: string;
  product_focus?: string;
  brand_voice?: string;
  content_goals?: string;
  content_pillars?: string[];
  products?: string[];
  recommended_outputs?: string[];
  missing_inputs?: string[];
};

type TrainingMessage = { role: "user" | "assistant"; content: string };

type TrainingNote = { note: string; created_at: string };

type Config = {
  brand_name: string;
  content_source: string;
  content_generation_mode: "source_material" | "ai_images";
  ai_image_model: string;
  ai_image_credits_per_image: number;
  output_types: string[];
  brand_voice: string;
  target_audience: string;
  product_focus: string;
  agent_webhook_url: string;
  company_intake?: CompanyIntake | null;
  company_analysis?: CompanyAnalysis | null;
  training_notes?: TrainingNote[];
  publish_platforms: string[];
  publishing_enabled: boolean;
  posting_addon_mode: string;
  status?: string;
  updated_at?: string;
  agent_token?: string;
};

type PlatformStatus = {
  connected: boolean;
  username?: string | null;
  accountName?: string | null;
  permissions?: string[];
};

const OUTPUT_TYPES = [
  "instagram_caption",
  "ad_copy",
  "email_snippet",
  "content_calendar",
];
const PUBLISH_PLATFORMS = ["instagram", "facebook"];
const AI_IMAGE_MODELS = CONTENT_IMAGE_MODELS;
const DEFAULT_INTAKE: CompanyIntake = {
  brand_name: "",
  website: "",
  what_you_sell: "",
  ideal_customer: "",
  customer_problem: "",
  main_offer: "",
  proof_points: "",
  competitors: "",
  brand_tone: "",
  content_goals: "",
};

const DEFAULT_CONFIG: Config = {
  brand_name: "",
  content_source: "",
  content_generation_mode: "source_material",
  ai_image_model: "openai/gpt-image-2",
  ai_image_credits_per_image: 1,
  output_types: ["instagram_caption", "ad_copy"],
  brand_voice: "Clear, practical, confident, no corporate fluff.",
  target_audience: "",
  product_focus: "",
  agent_webhook_url: "",
  company_intake: null,
  company_analysis: null,
  training_notes: [],
  publish_platforms: ["instagram"],
  publishing_enabled: true,
  posting_addon_mode: "free_beta",
};

function labelFor(type: string) {
  return (
    (
      {
        instagram_caption: "Instagram captions",
        ad_copy: "Ad copy",
        email_snippet: "Email snippets",
        content_calendar: "Content calendar ideas",
      } as Record<string, string>
    )[type] || type
  );
}

function platformLabel(platform: string) {
  return (
    (
      { instagram: "Instagram", facebook: "Facebook" } as Record<string, string>
    )[platform] || platform
  );
}

function connectLabel(platforms: string[]) {
  const hasInstagram = platforms.includes("instagram");
  const hasFacebook = platforms.includes("facebook");
  if (hasInstagram && hasFacebook) return "Connect Instagram + Facebook";
  if (hasInstagram) return "Connect Instagram";
  if (hasFacebook) return "Connect Facebook";
  return "Select a platform";
}

function connectHref(platforms: string[], tenantId: string) {
  const hasInstagram = platforms.includes("instagram");
  const hasFacebook = platforms.includes("facebook");
  if (hasInstagram || hasFacebook) {
    const platform =
      hasInstagram && hasFacebook
        ? "both"
        : hasInstagram
          ? "instagram"
          : "facebook";
    return buildMetaConnectHref({
      tenantId,
      intent: "content",
      platform,
      returnTo: META_RETURN_PATHS.contentSetup,
      force: true,
    });
  }
  return "#";
}

function firstInstagramCaption(generated: any) {
  const item = generated?.outputs?.find(
    (output: any) => output.type === "instagram_caption",
  );
  return String(item?.content || "").trim();
}

export default function ContentPipelineSetupPage() {
  const searchParams = useSearchParams();
  const connectedProvider = searchParams.get("connected");
  const connectionError = searchParams.get("error");
  const [session, setSession] = useState<Session | null>(null);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [intake, setIntake] = useState<CompanyIntake>(DEFAULT_INTAKE);
  const [analysis, setAnalysis] = useState<CompanyAnalysis | null>(null);
  const [brandProfile, setBrandProfile] = useState<any>(null);
  const [trainingMessages, setTrainingMessages] = useState<TrainingMessage[]>([
    {
      role: "assistant",
      content:
        "Add extra brand voice rules, content rules, offers, audience details, and boundaries. I cannot publish, change settings, or touch customer data from this chat.",
    },
  ]);
  const [trainingInput, setTrainingInput] = useState("");
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [topic, setTopic] = useState("New product or campaign announcement");
  const [generationImageModel, setGenerationImageModel] =
    useState("openai/gpt-image-2");
  const [generated, setGenerated] = useState<any>(null);
  const [platforms, setPlatforms] = useState<Record<string, PlatformStatus>>(
    {},
  );
  const [publishImageUrl, setPublishImageUrl] = useState("");
  const [publishCaption, setPublishCaption] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingData, setGeneratingData] = useState(false);
  const [brandDataGenerated, setBrandDataGenerated] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [activeStep, setActiveStep] = useState<1 | 2>(1);
  const step1PanelRef = useRef<HTMLDivElement>(null);
  const step2PanelRef = useRef<HTMLDivElement>(null);

  const tenantId = session?.tenantId || session?.email || "";
  const instagramConnected = platforms.instagram?.connected === true;
  const brandProfileReady = isBrandProfileReady(brandProfile);
  const setupReady = Boolean(analysis?.summary || brandProfileReady);
  const generatedCaption = useMemo(
    () => firstInstagramCaption(generated),
    [generated],
  );

  const loadPlatformStatuses = useCallback(async (id: string) => {
    const [instagramRes, facebookRes] = await Promise.all([
      fetch(`/api/auth/instagram/status?tenant_id=${encodeURIComponent(id)}`, {
        cache: "no-store",
      }).catch(() => null),
      fetch(`/api/auth/facebook/status?tenant_id=${encodeURIComponent(id)}`, {
        cache: "no-store",
      }).catch(() => null),
    ]);
    const [instagram, facebook] = await Promise.all([
      instagramRes?.ok
        ? instagramRes.json().catch(() => ({ connected: false }))
        : Promise.resolve({ connected: false }),
      facebookRes?.ok
        ? facebookRes.json().catch(() => ({ connected: false }))
        : Promise.resolve({ connected: false }),
    ]);
    setPlatforms({ instagram, facebook });
  }, []);

  const load = useCallback(async () => {
    const fresh = await fetchSession();
    setSession(fresh);
    if (!fresh) {
      setLoading(false);
      return;
    }
    const id = fresh.tenantId || fresh.email;
    const brandIds = Array.from(
      new Set([fresh.tenantId, fresh.email].filter(Boolean)),
    );
    const [configRes, brandResults] = await Promise.all([
      fetch(`/api/content/config?tenant_id=${encodeURIComponent(id)}`, {
        cache: "no-store",
      }),
      Promise.all(
        brandIds.map((brandId) =>
          fetch(
            `/api/settings/brand-profile?tenant_id=${encodeURIComponent(brandId)}`,
            { cache: "no-store" },
          )
            .then((res) => (res.ok ? res.json() : { profile: null }))
            .catch(() => ({ profile: null })),
        ),
      ),
    ]);
    const data = await configRes.json();
    const savedBrand =
      brandResults.find((result) => result.profile)?.profile || null;
    setBrandProfile(savedBrand);
    const savedBrandIntake = brandProfileToIntake(savedBrand);
    const savedBrandAnalysis = brandProfileToAnalysis(savedBrand);
    const nextConfig = data.config
      ? { ...DEFAULT_CONFIG, ...data.config }
      : {
          ...DEFAULT_CONFIG,
          brand_name: savedBrand?.brand_name || fresh.organization || "",
        };
    setConfig(nextConfig);
    const sourceIntake = nextConfig.company_intake || savedBrandIntake || {};
    setIntake({
      ...DEFAULT_INTAKE,
      ...sourceIntake,
      brand_name:
        sourceIntake.brand_name ||
        nextConfig.brand_name ||
        fresh.organization ||
        "",
    });
    setAnalysis(nextConfig.company_analysis || savedBrandAnalysis || null);
    await loadPlatformStatuses(id);
    setLoading(false);
  }, [loadPlatformStatuses]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (connectedProvider) setActiveStep(2);
  }, [connectedProvider]);

  // After switching steps, no auto-scroll needed as per user request to maintain position.
  useEffect(() => {
    // Scroll handling removed as per user request.
  }, [activeStep]);

  useEffect(() => {
    if (generatedCaption && !publishCaption)
      setPublishCaption(generatedCaption);
  }, [generatedCaption, publishCaption]);

  async function generateBrandData() {
    if (!tenantId) return;
    const website = (intake.website || brandProfile?.website || "").trim();
    if (!website) {
      toast.warning("Add a website first, then generate data.");
      return;
    }
    setGeneratingData(true);

    try {
      const res = await fetch("/api/settings/brand-profile/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, website }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generate data failed");
      const profile = data.draft || data.profile || null;
      const profileIntake = brandProfileToIntake(profile);
      const nextIntake: CompanyIntake = {
        ...DEFAULT_INTAKE,
        ...profileIntake,
        what_you_sell: profileIntake.what_you_sell || "",
      };
      const nextAnalysis = brandProfileToAnalysis(profile);
      setBrandProfile(profile);
      setIntake(nextIntake);
      setAnalysis(nextAnalysis);
      setConfig((current) => ({
        ...current,
        brand_name: nextIntake.brand_name || current.brand_name,
        brand_voice:
          nextAnalysis?.brand_voice ||
          nextIntake.brand_tone ||
          current.brand_voice,
        target_audience:
          nextAnalysis?.target_audience ||
          nextIntake.ideal_customer ||
          current.target_audience,
        product_focus:
          nextAnalysis?.product_focus ||
          nextIntake.main_offer ||
          nextIntake.what_you_sell ||
          current.product_focus,
        output_types: nextAnalysis?.recommended_outputs?.length
          ? nextAnalysis.recommended_outputs
          : current.output_types,
        company_intake: nextIntake,
        company_analysis: nextAnalysis,
      }));
      setBrandDataGenerated(true);
      toast.success(
        "Brand Data draft loaded. Save your Content Studio config to apply it.",
      );
    } catch (err: any) {
      toast.error(err.message || "Generate data failed");
    } finally {
      setGeneratingData(false);
    }
  }

  async function saveConfig() {
    if (!tenantId) return;
    setSaving(true);

    try {
      const data = await contentApiFetch<{ config?: Config }>(
        "/api/content/config",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: tenantId,
            ...config,
            company_intake: intake,
            company_analysis: analysis,
            training_notes: config.training_notes || [],
          }),
        },
      );
      setConfig({
        ...config,
        status: "active",
        updated_at: data.config?.updated_at || config.updated_at,
      });
      toast.success(
        "Content Studio saved. Generation and direct posting are active.",
      );
    } catch (err: unknown) {
      toastContentApiError(err, "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function trainAgent() {
    if (!tenantId || !trainingInput.trim()) return;
    const userMessage: TrainingMessage = {
      role: "user",
      content: trainingInput.trim(),
    };
    const nextMessages = [...trainingMessages, userMessage];
    setTrainingMessages(nextMessages);
    setTrainingInput("");
    setTrainingLoading(true);
    try {
      const data = await contentApiFetch<{
        reply?: string;
        training_notes?: TrainingNote[];
      }>("/api/content/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          message: userMessage.content,
          history: trainingMessages.slice(-10),
        }),
      });
      setTrainingMessages([
        ...nextMessages,
        { role: "assistant", content: data.reply || "Training saved." },
      ]);
      setConfig((current) => ({
        ...current,
        training_notes: data.training_notes || current.training_notes || [],
      }));
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Training failed. Try again.";
      setTrainingMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: errorMsg,
        },
      ]);
      toastContentApiError(err, "Training failed. Try again.");
    } finally {
      setTrainingLoading(false);
    }
  }

  async function publishToSelectedPlatforms() {
    if (!tenantId) return;
    const targets = config.publish_platforms.filter((p) =>
      PUBLISH_PLATFORMS.includes(p),
    );
    if (targets.length === 0) {
      toast.error("Select at least one publishing platform in settings.");
      return;
    }
    if (!publishImageUrl.trim() || !publishCaption.trim()) {
      toast.error("Add a public image URL and caption before publishing.");
      return;
    }

    setPublishing(true);
    const results: string[] = [];
    const errors: string[] = [];

    try {
      if (targets.includes("instagram")) {
        try {
          const data = await contentApiFetch<{ permalink?: string | null }>(
            "/api/cs/social/ig-posts/publish",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tenant_id: tenantId,
                image_url: publishImageUrl,
                caption: publishCaption,
              }),
            },
          );
          results.push(
            data.permalink
              ? `Instagram: ${data.permalink}`
              : "Instagram: published",
          );
        } catch (err: unknown) {
          errors.push(
            `Instagram: ${err instanceof Error ? err.message : "failed"}`,
          );
        }
      }

      if (targets.includes("facebook")) {
        try {
          const data = await contentApiFetch<{ permalink?: string | null }>(
            "/api/cs/social/fb-posts/publish",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tenant_id: tenantId,
                image_url: publishImageUrl,
                caption: publishCaption,
              }),
            },
          );
          results.push(
            data.permalink
              ? `Facebook: ${data.permalink}`
              : "Facebook: published",
          );
        } catch (err: unknown) {
          errors.push(
            `Facebook: ${err instanceof Error ? err.message : "failed"}`,
          );
        }
      }

      if (results.length) toast.success(results.join(" · "));
      if (errors.length) toastContentApiError(new Error(errors.join(" · ")), "Some publishes failed");
      if (!results.length && errors.length) {
        toastContentApiError(new Error(errors[0]), "Publish failed");
      }
    } finally {
      setPublishing(false);
    }
  }

  function toggleOutput(type: string) {
    setConfig((current) => ({
      ...current,
      output_types: current.output_types.includes(type)
        ? current.output_types.filter((t) => t !== type)
        : [...current.output_types, type],
    }));
  }

  function updateIntake(key: keyof CompanyIntake, value: string) {
    setIntake((current) => ({ ...current, [key]: value }));
  }

  function togglePublishPlatform(platform: string) {
    setConfig((current) => ({
      ...current,
      publish_platforms: current.publish_platforms.includes(platform)
        ? current.publish_platforms.filter((t) => t !== platform)
        : [...current.publish_platforms, platform],
    }));
  }

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm font-bold tracking-widest text-gray-500 uppercase">
          Loading Content Studio...
        </p>
      </div>
    );

  if (connectedProvider) return <SuccessState />;

  return (
    <div className="max-w-6xl pb-20 mx-auto space-y-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-blue-600">
              Automation Setup
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950">
            Content Studio
          </h1>
          <p className="mt-1 text-sm font-medium text-gray-500">
            Generate content, connect social channels, and publish posts from
            one flow.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-100 max-w-min">
          <Button
            variant={activeStep === 1 ? "secondary" : "ghost"}
            onClick={() => setActiveStep(1)}
            className={`rounded-lg h-9 text-xs font-bold ${activeStep === 1 ? "bg-white shadow-sm text-blue-600" : "text-gray-500"}`}
          >
            1. Brand Data
          </Button>
          <Button
            variant={activeStep === 2 ? "secondary" : "ghost"}
            onClick={() => setActiveStep(2)}
            className={`rounded-lg h-9 text-xs font-bold ${activeStep === 2 ? "bg-white shadow-sm text-blue-600" : "text-gray-500"}`}
          >
            2. Settings
          </Button>
        </div>
      </div>

      <AppSettingsPanel
        appName="Content Studio"
        appKey="content-pipeline"
        directory="/dashboard/content-pipeline"
        setupHref="/dashboard/automations/content-pipeline"
        settingsHref="/dashboard/settings?tab=brand-data"
        integrations={[
          {
            provider: "instagram",
            label: "Instagram publishing",
            href: tenantId
              ? buildMetaConnectHref({
                  tenantId,
                  intent: "content",
                  platform: "instagram",
                  returnTo: META_RETURN_PATHS.contentSetup,
                  force: true,
                })
              : "/dashboard/settings?tab=integrations",
          },
          {
            provider: "facebook",
            label: "Facebook page",
            href: tenantId
              ? buildMetaConnectHref({
                  tenantId,
                  intent: "content",
                  platform: "facebook",
                  returnTo: META_RETURN_PATHS.contentSetup,
                  force: true,
                })
              : "/dashboard/settings?tab=integrations",
          },
          {
            provider: "shopify",
            label: "Product catalog",
            href: "/dashboard/settings?tab=integrations",
          },
          {
            provider: "asset_library",
            label: "Ainomiq Library",
            href: "/dashboard/ads?tab=generate&assets=1",
          },
        ]}
        settingsName="Studio settings"
        description="Setup writes the studio source, output format, model, and content preferences for this workspace."
      />

      {(connectionError === "meta_no_accounts" ||
        connectionError === "meta_no_instagram" ||
        connectionError === "meta_no_facebook") && (
        <Card className="rounded-[24px] border-amber-100 bg-amber-50 p-6 shadow-sm flex items-start gap-4">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-3">
            <div>
              <div className="text-sm font-bold text-amber-950">
                Meta connection incomplete
              </div>
              <p className="mt-1 text-sm leading-relaxed text-amber-800/80">
                Meta login worked, but the selected publishing channel was not
                shared with Ainomiq. Reconnect and make sure the Facebook Page
                and Instagram business account you want to use are selected.
              </p>
            </div>
            {tenantId && (
              <Button
                asChild
                variant="outline"
                className="h-10 px-6 font-bold bg-white rounded-xl border-amber-200 text-amber-900 hover:bg-amber-50"
              >
                <a
                  href={buildMetaConnectHref({
                    tenantId,
                    intent: "content",
                    platform: "both",
                    returnTo: META_RETURN_PATHS.contentSetup,
                    force: true,
                  })}
                >
                  Reconnect Meta
                </a>
              </Button>
            )}
          </div>
        </Card>
      )}

      <div className="relative min-h-[600px]">
        <div
          ref={step1PanelRef}
          className={activeStep === 1 ? "block" : "hidden"}
        >
          <BrandDataStep
            intake={intake}
            updateIntake={updateIntake}
            analysis={analysis}
            generateBrandData={generateBrandData}
            generatingData={generatingData}
            brandProfileReady={brandProfileReady}
            brandDataGenerated={brandDataGenerated}
            tenantId={tenantId}
            setActiveStep={setActiveStep}
          />
        </div>

        <div
          ref={step2PanelRef}
          className={activeStep === 2 ? "block" : "hidden"}
        >
          <ContentSettingsStep
            config={config}
            setConfig={setConfig}
            toggleOutput={toggleOutput}
            togglePublishPlatform={togglePublishPlatform}
            saveConfig={saveConfig}
            saving={saving}
            platforms={platforms}
            tenantId={tenantId}
            setupReady={setupReady}
            setActiveStep={setActiveStep}
            OUTPUT_TYPES={OUTPUT_TYPES}
            PUBLISH_PLATFORMS={PUBLISH_PLATFORMS}
            labelFor={labelFor}
            platformLabel={platformLabel}
            connectLabel={connectLabel}
            connectHref={connectHref}
          />
        </div>
      </div>

      <GeneratedPreview generated={generated} labelFor={labelFor} />

      {config.publishing_enabled && config.publish_platforms.length > 0 ? (
        <Card className="rounded-[24px] border-gray-100 shadow-sm">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-1">
              <h3 className="text-lg font-black text-gray-950 tracking-tight">
                Publish to connected channels
              </h3>
              <p className="text-sm text-gray-500">
                Public HTTPS image URL required. Publishes to{" "}
                {config.publish_platforms.map(platformLabel).join(" and ")}.
              </p>
            </div>
            <input
              type="url"
              value={publishImageUrl}
              onChange={(e) => setPublishImageUrl(e.target.value)}
              placeholder="https://… image URL"
              className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm"
            />
            <textarea
              value={publishCaption}
              onChange={(e) => setPublishCaption(e.target.value)}
              placeholder="Caption"
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-y"
            />
            <Button
              type="button"
              disabled={publishing || !publishImageUrl.trim() || !publishCaption.trim()}
              onClick={publishToSelectedPlatforms}
            >
              {publishing ? "Publishing…" : "Publish now"}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
