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
import { RefreshCw, Sparkles, Database, ArrowRight } from "lucide-react";

interface Props {
  intake: any;
  updateIntake: (key: any, val: string) => void;
  analysis: any | null;
  generateBrandData: () => void;
  generatingData: boolean;
  brandProfileReady: boolean;
  brandDataGenerated: boolean;
  tenantId: string | null;
  setActiveStep: (step: 1 | 2) => void;
}

export function BrandDataStep({
  intake,
  updateIntake,
  analysis,
  generateBrandData,
  generatingData,
  brandProfileReady,
  brandDataGenerated,
  tenantId,
  setActiveStep,
}: Props) {
  return (
    <div className="space-y-6">
      <Card className="rounded-[28px] border-blue-100 shadow-sm overflow-hidden bg-white pt-0">
        <CardHeader className="bg-blue-50/50 p-8 border-b border-blue-50 rounded-t-[28px]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <Database className="w-4 h-4 text-blue-600" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">
                  Step 01
                </span>
              </div>
              <CardTitle className="text-2xl font-black text-gray-900 tracking-tight">
                Brand Data Context
              </CardTitle>
              <CardDescription className="text-gray-600 max-w-xl">
                Content Studio uses your website and company details to create
                contextual posts. Review or generate this data below.
              </CardDescription>
            </div>

            <Button
              onClick={generateBrandData}
              disabled={generatingData || !tenantId || !intake.website}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-6 font-bold shadow-md shadow-blue-100"
            >
              {generatingData ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : brandDataGenerated ? (
                "Regenerate Data"
              ) : (
                "Generate Data"
              )}
            </Button>
          </div>

          {!brandProfileReady && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800 text-sm font-medium flex items-start gap-3">
              <div className="p-1 bg-white rounded-lg shadow-sm mt-0.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
              </div>
              <p>
                Add a website below, then click **Generate Data**. Our AI will
                scrape your site and fill this page and the content settings
                automatically.
              </p>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Company Name
              </Label>
              <Input
                value={intake.brand_name}
                onChange={(e) => updateIntake("brand_name", e.target.value)}
                className="rounded-xl border-gray-200 h-11 focus-visible:ring-blue-500/20"
                placeholder="e.g. Ainomiq"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Website URL
              </Label>
              <Input
                value={intake.website}
                onChange={(e) => updateIntake("website", e.target.value)}
                className="rounded-xl border-gray-200 h-11 focus-visible:ring-blue-500/20"
                placeholder="https://example.com"
              />
              <p className="text-[10px] text-gray-400 font-medium px-1">
                Fresh scrape fills brand context and content settings.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                What do you sell?
              </Label>
              <Textarea
                value={intake.what_you_sell}
                onChange={(e) => updateIntake("what_you_sell", e.target.value)}
                rows={3}
                className="rounded-xl border-gray-200 resize-none focus-visible:ring-blue-500/20"
                placeholder="Products, services, categories..."
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Ideal Customer
              </Label>
              <Textarea
                value={intake.ideal_customer}
                onChange={(e) => updateIntake("ideal_customer", e.target.value)}
                rows={3}
                className="rounded-xl border-gray-200 resize-none focus-visible:ring-blue-500/20"
                placeholder="Who buys, why they buy, interests..."
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Customer Problem
              </Label>
              <Textarea
                value={intake.customer_problem}
                onChange={(e) =>
                  updateIntake("customer_problem", e.target.value)
                }
                rows={3}
                className="rounded-xl border-gray-200 resize-none focus-visible:ring-blue-500/20"
                placeholder="What pain or desire does this solve?"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Main Offer
              </Label>
              <Textarea
                value={intake.main_offer}
                onChange={(e) => updateIntake("main_offer", e.target.value)}
                rows={3}
                className="rounded-xl border-gray-200 resize-none focus-visible:ring-blue-500/20"
                placeholder="Core offer, demo, trial, campaign..."
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Brand Tone
              </Label>
              <Textarea
                value={intake.brand_tone}
                onChange={(e) => updateIntake("brand_tone", e.target.value)}
                rows={3}
                className="rounded-xl border-gray-200 resize-none focus-visible:ring-blue-500/20"
                placeholder="Direct, premium, playful, bold..."
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Content Goals
              </Label>
              <Textarea
                value={intake.content_goals}
                onChange={(e) => updateIntake("content_goals", e.target.value)}
                rows={3}
                className="rounded-xl border-gray-200 resize-none focus-visible:ring-blue-500/20"
                placeholder="More leads, daily posts, campaign launches..."
              />
            </div>
          </div>

          {analysis && (
            <div className="pt-8 border-t border-gray-50 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 p-6 md:p-8 bg-blue-600 rounded-[24px] text-white shadow-lg shadow-blue-100 relative overflow-hidden flex flex-col justify-center">
                  <Sparkles className="absolute top-0 right-0 w-40 h-40 text-white/5 -mr-10 -mt-10" />
                  <div className="relative z-10">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-200 mb-4">
                      AI Company Profile
                    </div>
                    <p className="text-base font-semibold leading-relaxed mb-4 line-clamp-4">
                      {analysis.summary}
                    </p>
                    <p className="text-sm text-blue-100/90 leading-relaxed line-clamp-3">
                      {analysis.positioning}
                    </p>
                  </div>
                </div>

                <div className="p-6 md:p-8 bg-gray-50 rounded-[24px] border border-gray-100">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-5">
                    Content Pillars
                  </div>
                  <div className="flex flex-col gap-2">
                    {(analysis.content_pillars || []).map(
                      (pillar: string, idx: number) => (
                        <Badge
                          key={idx}
                          variant="secondary"
                          className="bg-white border-gray-200 text-gray-700 px-3.5 py-2.5 rounded-xl font-medium text-xs leading-normal whitespace-normal wrap-break-word text-left h-auto max-w-full shadow-sm"
                        >
                          {pillar}
                        </Badge>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-gray-50 gap-4">
            <p className="text-sm text-gray-500 italic font-medium">
              Continue when the context above looks accurate for your brand.
            </p>
            <Button
              onClick={() => setActiveStep(2)}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 px-8 font-bold shadow-md shadow-blue-100 min-w-[160px]"
            >
              Continue to Settings
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
