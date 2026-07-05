"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { CreativeOsCard } from "../../_components/CreativeOsCard";
import { MagicButton } from "../../_components/MagicButton";
import { Input, Textarea } from "../../_components/FormFields";
import { BrandReferenceLinksEditor } from "../shared/WorkspaceWidgets";
import { SectionTitle } from "../shared/SectionTitle";
import type { BrandTabProps } from "./types";

export function BrandTab(props: BrandTabProps) {
  const {
    sectionRefs,
    brand,
    companyName,
    brandFillStatus,
    brandFillError,
    magicFillBrand,
    updateBrand,
    addBrandReferenceLink,
    updateBrandReferenceLink,
    removeBrandReferenceLink,
  } = props;

  return (
    <div
      ref={(el) => {
        sectionRefs.current.brand = el;
      }}
      className="space-y-4"
    >
      <CreativeOsCard>
        <CardContent className="space-y-4 p-4">
          <SectionTitle
            title="Brand"
            subtitle="Shared brand context for every invited editor. Keep it practical: what the brand stands for, how to write, and what never to claim."
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  Visible to editors
                </Badge>
                <MagicButton
                  size="sm"
                  onClick={magicFillBrand}
                  loading={brandFillStatus === "filling"}
                >
                  {brandFillStatus === "filling"
                    ? "Filling..."
                    : brandFillStatus === "filled"
                      ? "Magic filled"
                      : "Magic Fill"}
                </MagicButton>
              </div>
            }
          />

          {brandFillError ? (
            <Alert variant="destructive">
              <AlertDescription>{brandFillError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4">
            <Input
              label="Brand name"
              value={brand.name}
              onChange={(event) => updateBrand("name", event.target.value)}
              placeholder={companyName || "Brand name"}
            />
            <Textarea
              label="Brand story"
              value={brand.story}
              onChange={(event) => updateBrand("story", event.target.value)}
              placeholder="What should editors understand about the brand, customer and mission?"
            />
            <Textarea
              label="Brand voice"
              value={brand.voice}
              onChange={(event) => updateBrand("voice", event.target.value)}
              placeholder="Example: direct, premium, clear, no hype, benefit-first."
            />
            <Textarea
              label="Creative instructions"
              value={brand.instructions}
              onChange={(event) =>
                updateBrand("instructions", event.target.value)
              }
              placeholder="General rules editors should follow for every ad, regardless of catalog."
            />
            <Textarea
              label="Do not say / claim boundaries"
              value={brand.doNotSay}
              onChange={(event) => updateBrand("doNotSay", event.target.value)}
              placeholder="Claims, phrases, competitor mentions, discount language or visuals editors should avoid."
            />
            <BrandReferenceLinksEditor
              links={brand.referenceLinks}
              onAdd={addBrandReferenceLink}
              onUpdate={updateBrandReferenceLink}
              onRemove={removeBrandReferenceLink}
            />
          </div>
        </CardContent>
      </CreativeOsCard>
    </div>
  );
}
