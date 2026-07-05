import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Settings,
  ArrowLeft,
  Save,
  Globe,
  Smartphone,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface Props {
  config: any;
  setConfig: (val: any) => void;
  toggleOutput: (type: string) => void;
  togglePublishPlatform: (platform: string) => void;
  saveConfig: () => void;
  saving: boolean;
  platforms: any;
  tenantId: string | null;
  setupReady: boolean;

  setActiveStep: (step: 1 | 2) => void;
  OUTPUT_TYPES: string[];
  PUBLISH_PLATFORMS: string[];
  labelFor: (type: string) => string;
  platformLabel: (platform: string) => string;
  connectLabel: (platforms: string[]) => string;
  connectHref: (platforms: string[], tenantId: string) => string;
}

export function ContentSettingsStep({
  config,
  setConfig,
  toggleOutput,
  togglePublishPlatform,
  saveConfig,
  saving,
  platforms,
  tenantId,
  setupReady,

  setActiveStep,
  OUTPUT_TYPES,
  PUBLISH_PLATFORMS,
  labelFor,
  platformLabel,
  connectLabel,
  connectHref,
}: Props) {
  return (
    <div className="space-y-6">
      <Card className="rounded-[28px] border-blue-100 shadow-sm overflow-hidden bg-white pt-0">
        <CardHeader className="bg-blue-50/50 p-8 border-b border-blue-50 rounded-t-[28px]">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div className="space-y-1">
              <Button
                variant="ghost"
                onClick={() => setActiveStep(1)}
                className="h-auto p-0 mb-2 text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-transparent"
              >
                <ArrowLeft className="w-3 h-3 mr-1" />
                Back to Brand Data
              </Button>
              <div className="flex items-center gap-2 mb-1">
                <Settings className="w-4 h-4 text-blue-600" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">
                  Step 02
                </span>
              </div>
              <CardTitle className="text-2xl font-black tracking-tight text-gray-900">
                Content Settings
              </CardTitle>
              <CardDescription className="max-w-xl text-gray-600">
                Choose outputs, sources, and publishing channels for this
                automation.
              </CardDescription>
            </div>

            <Badge
              className={`${setupReady ? "bg-green-50 text-green-700 border-green-100" : "bg-amber-50 text-amber-700 border-amber-100"} font-bold px-3 py-1 rounded-lg border shadow-sm`}
            >
              {setupReady ? "Context Ready" : "Context Needed"}
            </Badge>
          </div>

          {!setupReady && (
            <div className="flex items-start gap-3 p-4 mt-6 text-sm font-medium border bg-amber-50 border-amber-100 rounded-2xl text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <p>
                Set up Brand Data in Step 1 first. Content Studio needs saved
                company context before it can generate useful content.
              </p>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-8 space-y-10">
          {/* Brand & Mode */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold tracking-widest text-gray-500 uppercase">
                Brand Display Name
              </Label>
              <Input
                value={config.brand_name}
                onChange={(e) =>
                  setConfig({ ...config, brand_name: e.target.value })
                }
                className="border-gray-200 rounded-xl h-11 focus-visible:ring-blue-500/20"
                placeholder="e.g. Ainomiq"
              />
            </div>

            <div className="space-y-4">
              <Label className="block text-xs font-bold tracking-widest text-gray-500 uppercase">
                Generation Strategy
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      ...config,
                      content_generation_mode: "source_material",
                    })
                  }
                  className={`text-left p-4 rounded-2xl border transition-all ${config.content_generation_mode === "source_material" ? "border-blue-500 bg-blue-50 shadow-sm" : "border-gray-100 bg-gray-50/50 hover:border-gray-200"}`}
                >
                  <Globe
                    className={`w-4 h-4 mb-2 ${config.content_generation_mode === "source_material" ? "text-blue-600" : "text-gray-400"}`}
                  />
                  <div className="text-sm font-bold leading-tight text-gray-900">
                    Content Source
                  </div>
                  <p className="mt-1 text-[10px] text-gray-500 leading-normal">
                    Blogs, URLs, or Product pages.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setConfig({
                      ...config,
                      content_generation_mode: "ai_images",
                    })
                  }
                  className={`text-left p-4 rounded-2xl border transition-all ${config.content_generation_mode === "ai_images" ? "border-blue-500 bg-blue-50 shadow-sm" : "border-gray-100 bg-gray-50/50 hover:border-gray-200"}`}
                >
                  <Smartphone
                    className={`w-4 h-4 mb-2 ${config.content_generation_mode === "ai_images" ? "text-blue-600" : "text-gray-400"}`}
                  />
                  <div className="text-sm font-bold leading-tight text-gray-900">
                    AI Visuals
                  </div>
                  <p className="mt-1 text-[10px] text-gray-500 leading-normal">
                    Generate from Brand Data.
                  </p>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {config.content_generation_mode === "source_material" ? (
              <>
                <Label className="text-xs font-bold tracking-widest text-gray-500 uppercase">
                  Source URL / Folder
                </Label>
                <Input
                  value={config.content_source}
                  onChange={(e) =>
                    setConfig({ ...config, content_source: e.target.value })
                  }
                  className="border-gray-200 rounded-xl h-11 focus-visible:ring-blue-500/20"
                  placeholder="Optional: Ainomiq Library collection, sheet, blog URL, product page, or internal source"
                />
                <p className="text-[10px] text-gray-400 font-medium px-1">
                  Leave empty if Brand Data context is sufficient.
                </p>
              </>
            ) : (
              <div className="flex items-center gap-3 p-4 text-sm font-medium text-blue-900 border border-blue-100 bg-blue-50/50 rounded-2xl">
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                AI images will be generated autonomously from your Brand Data
                context.
              </div>
            )}
          </div>

          <Separator className="bg-gray-100" />

          {/* Persona */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold tracking-widest text-gray-500 uppercase">
                Target Audience Summary
              </Label>
              <Input
                value={config.target_audience}
                onChange={(e) =>
                  setConfig({ ...config, target_audience: e.target.value })
                }
                className="border-gray-200 rounded-xl h-11 focus-visible:ring-blue-500/20"
                placeholder="E-commerce founders, tech enthusiasts..."
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold tracking-widest text-gray-500 uppercase">
                Core Product Focus
              </Label>
              <Input
                value={config.product_focus}
                onChange={(e) =>
                  setConfig({ ...config, product_focus: e.target.value })
                }
                className="border-gray-200 rounded-xl h-11 focus-visible:ring-blue-500/20"
                placeholder="AI Support, Marketing Suite..."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-xs font-bold tracking-widest text-gray-500 uppercase">
                Detailed Brand Voice
              </Label>
              <Textarea
                value={config.brand_voice}
                onChange={(e) =>
                  setConfig({ ...config, brand_voice: e.target.value })
                }
                rows={4}
                className="p-4 border-gray-200 resize-none rounded-xl focus-visible:ring-blue-500/20"
              />
            </div>
          </div>

          <Separator className="bg-gray-100" />

          {/* Outputs */}
          <div className="space-y-5">
            <Label className="block text-xs font-bold tracking-widest text-gray-500 uppercase">
              Active Outputs
            </Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {OUTPUT_TYPES.map((type) => (
                <label
                  key={type}
                  className={`flex items-center gap-3 p-4 border rounded-2xl cursor-pointer transition-all ${config.output_types.includes(type) ? "border-blue-200 bg-blue-50/30" : "border-gray-100 bg-gray-50/50 hover:border-gray-200"}`}
                >
                  <Checkbox
                    id={`output-${type}`}
                    checked={config.output_types.includes(type)}
                    onCheckedChange={() => toggleOutput(type)}
                    className="border-gray-300 rounded-md"
                  />
                  <span className="text-sm font-bold leading-none text-gray-800">
                    {labelFor(type)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Publishing */}
          <div className="space-y-5">
            <Label className="block text-xs font-bold tracking-widest text-gray-500 uppercase">
              Publishing Platforms
            </Label>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {PUBLISH_PLATFORMS.map((platform) => {
                const status = platforms[platform];
                const connected = status?.connected === true;
                return (
                  <Card
                    key={platform}
                    className={`rounded-2xl border transition-all ${config.publish_platforms.includes(platform) ? "border-blue-200 bg-blue-50/10 shadow-sm" : "border-gray-100 bg-white"}`}
                  >
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div className="flex items-center gap-4">
                        <Checkbox
                          id={`platform-${platform}`}
                          checked={config.publish_platforms.includes(platform)}
                          onCheckedChange={() =>
                            togglePublishPlatform(platform)
                          }
                          className="border-gray-300 rounded-md"
                        />
                        <div className="space-y-0.5">
                          <div className="text-sm font-bold text-gray-900">
                            {platformLabel(platform)}
                          </div>
                          <div className="text-[10px] font-medium text-gray-500">
                            {connected
                              ? status?.username || "Connected"
                              : "Needs connection"}
                          </div>
                        </div>
                      </div>
                      <Badge
                        className={`${connected ? "bg-green-50 text-green-700 border-green-100" : "bg-gray-50 text-gray-400 border-gray-200"} text-[9px] uppercase font-black tracking-widest border px-2 py-0.5 rounded-md`}
                      >
                        {connected ? "LIVE" : "DISCONNECTED"}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {config.publish_platforms.length > 0 && (
              <div className="p-5 bg-blue-600 rounded-[24px] text-white shadow-xl shadow-blue-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-lg font-bold">
                    Connect Social Channels
                  </div>
                  <p className="max-w-sm text-xs leading-relaxed text-blue-100/80">
                    {config.publish_platforms.length > 1
                      ? "Instagram and Facebook connect through your Meta business account."
                      : `Link your ${platformLabel(config.publish_platforms[0])} account to enable automated posting.`}
                  </p>
                </div>
                <Button
                  asChild
                  className="bg-white text-blue-600 hover:bg-blue-50 rounded-xl h-12 px-6 font-bold shrink-0 transition-transform active:scale-[0.98]"
                >
                  <a
                    href={connectHref(config.publish_platforms, tenantId || "")}
                  >
                    {connectLabel(config.publish_platforms)}
                  </a>
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 p-4 border border-gray-100 bg-gray-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white border border-gray-100 shadow-sm rounded-xl">
                  <Smartphone className="w-4 h-4 text-blue-600" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-sm font-bold text-gray-900">
                    Direct Posting Engine
                  </div>
                  <p className="text-[10px] text-gray-500 font-medium leading-none">
                    Automate the final publishing step.
                  </p>
                </div>
              </div>
              <Switch
                checked={config.publishing_enabled}
                onCheckedChange={(val) =>
                  setConfig({ ...config, publishing_enabled: val })
                }
                className="data-[state=checked]:bg-blue-600"
              />
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 pt-10 border-t sm:flex-row border-gray-50">
            <Button
              variant="outline"
              onClick={() => setActiveStep(1)}
              className="rounded-xl h-12 px-8 font-bold border-gray-200 text-gray-700 bg-white hover:bg-gray-50 min-w-[120px] sm:w-auto w-full"
            >
              Back
            </Button>

            <div className="flex flex-col items-center w-full gap-4 sm:flex-row sm:w-auto">
              <Button
                onClick={saveConfig}
                disabled={saving}
                className="w-full h-12 px-10 font-bold text-white bg-blue-600 shadow-lg hover:bg-blue-700 rounded-xl shadow-blue-100 sm:w-auto"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Configuration
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
