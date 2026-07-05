import React, { useEffect, useState } from "react";
import { SectionHeader, SectionDescription } from "./Typography";
import { BrandProfile } from "../_lib/types";
import { sameAsset, uniqueAssets } from "../_lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  BrandAssetCard,
  BrandProfileCompactView,
  BrandProfileFields,
  ScanMetricsStrip,
  ScannedSourcePanel,
} from "./BrandDataFormPanels";

const SCAN_STEPS = [
  "Connecting to site",
  "Reading products & policies",
  "Detecting tools & assets",
  "AI is thinking...",
] as const;

const TAB_ENTER_CLASS =
  "animate-in fade-in slide-in-from-bottom-2 duration-300";

interface BrandDataTabProps {
  brandScannerRef: React.RefObject<HTMLDivElement | null>;
  brandWebsiteInputRef: React.RefObject<HTMLInputElement | null>;
  brandProfile: BrandProfile;
  brandScraping: boolean;
  brandSaving: boolean;
  brandDeleting: boolean;
  brandDeleteConfirm: boolean;
  brandSourceOpen: boolean;
  setBrandSourceOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeScanStep: number;
  scanProgressPercent: number;
  brandIsDirty: boolean;
  hasPersistedBrand: boolean;
  brandSaveDisabled: boolean;
  brandSaveLabel: string;
  hasBrandData: boolean;
  scrapeBrandWebsite: () => Promise<void>;
  saveBrandProfile: () => Promise<void>;
  deleteBrandProfile: () => Promise<void>;
  updateBrandProfile: (key: keyof BrandProfile, value: string) => void;
  handleBrandAssetUpload: (
    key: "icon_url" | "full_logo_url" | "logo_url",
    file?: File | null,
  ) => void;
  setBrandDeleteConfirm: React.Dispatch<React.SetStateAction<boolean>>;
  brandEditorExpanded: boolean;
  setBrandEditorExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}

export function BrandDataTab({
  brandScannerRef,
  brandWebsiteInputRef,
  brandProfile,
  brandScraping,
  brandSaving,
  brandDeleting,
  brandDeleteConfirm,
  brandSourceOpen,
  setBrandSourceOpen,
  activeScanStep,
  scanProgressPercent,
  brandIsDirty,
  hasPersistedBrand,
  brandSaveDisabled,
  brandSaveLabel,
  hasBrandData,
  scrapeBrandWebsite,
  saveBrandProfile,
  deleteBrandProfile,
  updateBrandProfile,
  handleBrandAssetUpload,
  setBrandDeleteConfirm,
  brandEditorExpanded,
  setBrandEditorExpanded,
}: BrandDataTabProps) {
  const brandIconPreview =
    uniqueAssets([
      brandProfile.icon_url,
      brandProfile.source_summary?.icon,
      brandProfile.source_summary?.favicon,
    ])[0] || "";
  const rawBrandLogoPreview =
    uniqueAssets([
      brandProfile.full_logo_url,
      brandProfile.logo_url,
      brandProfile.source_summary?.logo,
    ]).find((logo) => !sameAsset(logo, brandIconPreview)) || "";
  const brandLogoPreview =
    rawBrandLogoPreview && !sameAsset(rawBrandLogoPreview, brandIconPreview)
      ? rawBrandLogoPreview
      : "";
  const distinctLogoCandidates = uniqueAssets(
    brandProfile.source_summary?.logo_candidates || [],
  ).filter((logo) => !sameAsset(logo, brandIconPreview));
  const visibleIconCandidates = uniqueAssets(
    brandProfile.source_summary?.icon_candidates || [],
  )
    .filter((icon) => {
      if (sameAsset(icon, brandIconPreview)) return false;
      if (/\/favicon\.ico(?:$|[?#])/i.test(icon) && brandIconPreview)
        return false;
      return true;
    })
    .slice(0, 1);

  const showCompactSavedView =
    hasBrandData &&
    hasPersistedBrand &&
    !brandIsDirty &&
    !brandScraping &&
    !brandEditorExpanded;

  const [scannerVisible, setScannerVisible] = useState(!hasPersistedBrand);

  useEffect(() => {
    if (showCompactSavedView) setScannerVisible(false);
  }, [showCompactSavedView]);

  useEffect(() => {
    if (brandScraping) setScannerVisible(true);
  }, [brandScraping]);

  const openEditor = (focusScanner = false) => {
    setBrandEditorExpanded(true);
    if (focusScanner) {
      setScannerVisible(true);
      window.setTimeout(() => {
        brandScannerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        brandWebsiteInputRef.current?.focus();
      }, 120);
    }
  };

  const showScannerHero = scannerVisible || !hasBrandData;

  if (showCompactSavedView) {
    return (
      <div className={TAB_ENTER_CLASS}>
        <BrandProfileCompactView
          profile={brandProfile}
          brandIconPreview={brandIconPreview}
          brandLogoPreview={brandLogoPreview}
          brandSourceOpen={brandSourceOpen}
          onToggleSource={() => setBrandSourceOpen((open) => !open)}
          onEdit={() => openEditor(false)}
          onRescan={() => openEditor(true)}
          onDelete={deleteBrandProfile}
          brandDeleting={brandDeleting}
          brandDeleteConfirm={brandDeleteConfirm}
          onCancelDelete={() => setBrandDeleteConfirm(false)}
        />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${TAB_ENTER_CLASS}`}>
      {showScannerHero && (
        <div
          id="brand-data-scanner"
          ref={brandScannerRef}
          className="relative overflow-hidden rounded-[32px] border border-blue-100 bg-white p-8 md:p-12 text-center shadow-sm"
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at 50% 0%, rgba(59,130,246,.12), transparent 32%), radial-gradient(circle at 92% 18%, rgba(99,102,241,.10), transparent 26%)",
            }}
          />
          <div className="relative z-10 max-w-3xl mx-auto">
            <Badge
              variant="secondary"
              className="px-3 py-1 mb-5 text-xs font-bold text-blue-600 border-none bg-blue-50 hover:bg-blue-50"
            >
              Brand Data Scanner
            </Badge>
            <h3 className="text-4xl font-black leading-tight tracking-tight md:text-6xl text-gray-950">
              Let&apos;s analyze your{" "}
              <span className="text-transparent bg-linear-to-r from-blue-500 to-indigo-500 bg-clip-text">
                business
              </span>
            </h3>
            <SectionDescription className="mt-5 max-w-xl mx-auto text-base! md:text-lg!">
              Enter your website URL and Ainomiq will scan your brand, products,
              tools, policies and channels for every future automation.
            </SectionDescription>

            <div className="max-w-2xl mx-auto mt-9">
              <div className="relative flex items-center rounded-full border-2 border-blue-200 bg-white p-2 shadow-[0_18px_55px_rgba(37,99,235,.14)] focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100">
                <div className="pl-4 pr-2 text-blue-500">
                  <Globe className="w-5 h-5" />
                </div>
                <Input
                  ref={brandWebsiteInputRef}
                  value={brandProfile.website}
                  onChange={(e) =>
                    updateBrandProfile("website", e.target.value)
                  }
                  placeholder="yourstore.com"
                  className="flex-1 h-12 text-base bg-transparent border-none shadow-none focus-visible:ring-0 text-gray-950 placeholder:text-gray-400"
                />
                <Button
                  onClick={scrapeBrandWebsite}
                  disabled={brandScraping || !brandProfile.website.trim()}
                  className="h-12 px-6 text-sm font-bold text-white transition bg-blue-500 rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {brandScraping
                    ? "Analyzing"
                    : hasBrandData
                      ? "Rescan"
                      : "Analyze business"}
                  {!brandScraping && <ArrowRight className="w-4 h-4 ml-2" />}
                </Button>
              </div>
              <p className="mt-4 text-xs text-gray-400">
                We scan products, prices, tech stack, ads pixels, email tools,
                policies, FAQ, markets, contact data and social channels.
              </p>
            </div>

            {brandScraping && (
              <div className="mt-8 space-y-4 text-left">
                <div className="p-4 border border-blue-100 rounded-2xl bg-blue-50/80">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-sm font-bold text-blue-950">
                      {SCAN_STEPS[activeScanStep]}
                    </p>
                    <span className="text-xs font-bold text-blue-700 tabular-nums">
                      Step {activeScanStep + 1} of {SCAN_STEPS.length}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden bg-blue-100 rounded-full">
                    <div
                      className={`h-full rounded-full bg-linear-to-r from-blue-400 via-blue-600 to-indigo-500 transition-all duration-500 ${
                        activeScanStep >= 3 ? "w-[88%] ainomiq-scan-bar" : ""
                      }`}
                      style={{
                        width:
                          activeScanStep >= 3
                            ? undefined
                            : `${scanProgressPercent}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-blue-800/80">
                    This usually takes 15–30 seconds while we scrape your site
                    and run AI analysis.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                  {SCAN_STEPS.map((step, i) => {
                    const done = i < activeScanStep;
                    const active = i === activeScanStep;
                    return (
                      <div
                        key={step}
                        className={`rounded-2xl border p-3 transition-all duration-300 ${active ? "border-blue-300 bg-blue-50 shadow-[0_12px_30px_rgba(59,130,246,0.14)]" : done ? "border-blue-100 bg-blue-50/70" : "border-gray-200 bg-white"}`}
                      >
                        <div className="relative h-1.5 rounded-full bg-blue-100 overflow-hidden mb-3">
                          {done && (
                            <div className="w-full h-full bg-blue-500 rounded-full" />
                          )}
                          {active && (
                            <div className="absolute inset-y-0 left-0 w-2/3 rounded-full bg-linear-to-r from-blue-300 via-blue-600 to-blue-300 ainomiq-scan-bar" />
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-gray-800">
                            {step}
                          </p>
                          <span
                            className={`h-2 w-2 rounded-full ${done ? "bg-blue-500" : active ? "bg-blue-500 ainomiq-scan-dot" : "bg-gray-300"}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {hasBrandData && <ScanMetricsStrip profile={brandProfile} />}
          </div>
        </div>
      )}

      {!hasBrandData && (
        <Card className="p-8 text-center border-gray-200 shadow-sm rounded-3xl">
          <CardContent className="p-0">
            <div className="flex items-center justify-center mx-auto mb-4 font-black text-blue-700 h-14 w-14 rounded-2xl bg-blue-50">
              01
            </div>
            <h3 className="text-xl font-black text-gray-950">
              Brand profile is empty until the site is scanned
            </h3>
            <SectionDescription className="mt-2 max-w-xl mx-auto text-sm!">
              Add the website above and run the scan. Ainomiq will fill the
              brand profile from detected source data and AI analysis. Then you
              can review and correct it.
            </SectionDescription>
          </CardContent>
        </Card>
      )}

      {hasBrandData && (
        <Card className="overflow-hidden rounded-[24px] border border-gray-200/90 bg-white shadow-[0_8px_40px_rgba(15,23,42,0.06)]">
          <CardHeader className="border-b border-gray-100 bg-linear-to-r from-white to-gray-50/80 px-6 py-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="flex flex-wrap items-center gap-3 text-lg font-bold text-gray-900">
                  Review brand profile
                  <Badge
                    variant="secondary"
                    className={`text-[10px] uppercase tracking-wider font-black px-2.5 py-1 rounded-full border-none ${
                      hasPersistedBrand && !brandIsDirty
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {hasPersistedBrand && !brandIsDirty
                      ? "Saved"
                      : brandIsDirty
                        ? hasPersistedBrand
                          ? "Unsaved changes"
                          : "New - not saved"
                        : "Draft"}
                  </Badge>
                </CardTitle>
                <CardDescription className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-(--ai-text-muted)">
                  {hasPersistedBrand && !brandIsDirty
                    ? "Update fields below, or return to the saved overview."
                    : "Validate scan results, adjust copy, then save. Automations only use data after you confirm."}
                </CardDescription>
              </div>
              {hasPersistedBrand && !brandIsDirty && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setBrandEditorExpanded(false)}
                  className="h-10 shrink-0 rounded-xl border-gray-200 px-4 text-sm font-bold text-gray-700 hover:bg-gray-50"
                >
                  Back to overview
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-8 p-6 md:p-8">
            {brandIsDirty && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/90 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <p className="text-sm font-bold text-amber-950">
                    {hasPersistedBrand
                      ? "You have unsaved changes"
                      : "Save this brand profile"}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-amber-900/85">
                    {hasPersistedBrand
                      ? "Click Update brand data to apply your edits before leaving this tab."
                      : "This scan is a draft until you save. Review the fields, then click Save brand data."}
                  </p>
                </div>
              </div>
            )}

            <ScannedSourcePanel
              profile={brandProfile}
              brandLogoPreview={brandLogoPreview}
              open={brandSourceOpen}
              onToggle={() => setBrandSourceOpen((open) => !open)}
            />

            <section>
              <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-gray-400">
                Visual identity
              </h3>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <BrandAssetCard
                  kind="icon"
                  preview={brandIconPreview}
                  inputValue={brandProfile.icon_url || ""}
                  onInputChange={(value) =>
                    updateBrandProfile("icon_url", value)
                  }
                  onUpload={(file) => handleBrandAssetUpload("icon_url", file)}
                  candidates={visibleIconCandidates}
                  onSelectCandidate={(url) =>
                    updateBrandProfile("icon_url", url)
                  }
                />
                <BrandAssetCard
                  kind="logo"
                  preview={brandLogoPreview}
                  inputValue={brandLogoPreview}
                  onInputChange={(value) => {
                    updateBrandProfile("full_logo_url", value);
                    updateBrandProfile("logo_url", value);
                  }}
                  onUpload={(file) =>
                    handleBrandAssetUpload("full_logo_url", file)
                  }
                  candidates={distinctLogoCandidates.slice(0, 6)}
                  onSelectCandidate={(url) => {
                    updateBrandProfile("full_logo_url", url);
                    updateBrandProfile("logo_url", url);
                  }}
                />
              </div>
            </section>

            <BrandProfileFields
              profile={brandProfile}
              updateBrandProfile={updateBrandProfile}
            />
            <Separator className="bg-gray-100" />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  onClick={saveBrandProfile}
                  disabled={brandSaveDisabled}
                  className="px-6 font-bold text-white transition-all bg-blue-600 hover:bg-blue-700 h-11 rounded-xl disabled:opacity-50 disabled:pointer-events-none"
                >
                  {brandSaving ? (
                    <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  )}
                  {brandSaveLabel}
                </Button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {brandDeleteConfirm && (
                  <Button
                    variant="outline"
                    onClick={() => setBrandDeleteConfirm(false)}
                    disabled={brandDeleting}
                    className="h-10 px-4 text-sm font-bold text-gray-700 border-gray-200 rounded-xl hover:bg-gray-50"
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  variant={brandDeleteConfirm ? "destructive" : "outline"}
                  onClick={deleteBrandProfile}
                  disabled={brandDeleting || brandSaving}
                  className={`rounded-xl px-4 h-10 text-sm font-bold transition-all ${!brandDeleteConfirm ? "border-red-100 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800" : ""}`}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {brandDeleting
                    ? "Deleting..."
                    : brandDeleteConfirm
                      ? "Yes, delete all data"
                      : "Delete all brand data"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
