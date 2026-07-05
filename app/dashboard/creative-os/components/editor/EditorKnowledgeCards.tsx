"use client";

import type { ComponentType } from "react";
import {
  Archive,
  BookOpen,
  Layers3,
  Link2,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { CreativeOsCard } from "../../_components/CreativeOsCard";
import {
  normalizeBrandReferenceLinks,
  normalizeBrandProfile,
} from "../../lib/normalize";
import { cleanCompanyName } from "../../lib/products";
import type { BrandProfile, BrandReferenceLink, Product } from "../../types";
import { CardList } from "../shared/WorkspaceWidgets";

export function ProductKnowledgeCard({ product }: { product: Product }) {
  const catalogCount = product.catalogItems?.length || 0;
  const isCatalogGroup = product.isCatalogGroup || catalogCount > 1;
  const title = isCatalogGroup
    ? `Catalog group (${catalogCount} products)`
    : product.name || "Selected product";

  return (
    <CreativeOsCard>
      <CardContent className="grid gap-4 p-4 lg:grid-cols-[0.9fr_1.1fr] lg:gap-5">
        <div>
          <div className="overflow-hidden aspect-4/3 rounded-2xl bg-muted">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name || "Product"}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="flex items-center justify-center h-full px-6 text-sm text-center text-muted-foreground">
                No product image available.
              </div>
            )}
          </div>
          <div className="mt-4">
            <div className="text-xl font-bold tracking-tight text-foreground">
              {title}
            </div>
            {!isCatalogGroup && product.url ? (
              <Button variant="link" className="h-auto px-0 mt-1" asChild>
                <a href={product.url} target="_blank" rel="noreferrer">
                  Open product page
                </a>
              </Button>
            ) : null}
            {isCatalogGroup ? (
              <div className="mt-2 space-y-2">
                <div className="text-sm text-muted-foreground">
                  {catalogCount} products grouped in this brief.
                </div>
                <div className="flex flex-wrap gap-2">
                  {(product.catalogItems || []).map((item) =>
                    item.url ? (
                      <Badge key={item.id} variant="secondary" asChild>
                        <a href={item.url} target="_blank" rel="noreferrer">
                          {item.name || "Catalog product"}
                        </a>
                      </Badge>
                    ) : (
                      <Badge key={item.id} variant="outline">
                        {item.name || "Catalog product"}
                      </Badge>
                    ),
                  )}
                </div>
              </div>
            ) : null}
          </div>
          <p className="p-4 mt-4 text-sm leading-6 border rounded-2xl border-primary/15 bg-primary/5 text-foreground">
            {product.explanation ||
              "No product explanation has been added yet. Ask the owner to run Magic Fill or add product context before creating more briefs."}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <CardList
            title="Buying reasons"
            icon={Sparkles}
            items={product.sellingPoints}
            emptyText="No buying reasons saved for this product yet."
          />
          <CardList
            title="Customer pains"
            icon={Target}
            items={product.pains}
            emptyText="No customer pains saved for this product yet."
          />
          <CardList
            title="Personas"
            icon={Users}
            items={product.personas}
            emptyText="No personas saved for this product yet."
          />
          <CardList
            title="Claim boundaries"
            icon={ShieldCheck}
            items={product.claimBoundaries}
            emptyText="No claim boundaries saved for this product yet."
          />
          <CardList
            title="Platforms"
            icon={Layers3}
            items={product.platforms}
            emptyText="No platforms saved for this product yet."
          />
          <CardList
            title="Brief rules"
            icon={Archive}
            items={[
              product.namingConvention
                ? `Naming: ${product.namingConvention}`
                : "",
              `Derivative cap per source: ${product.defaultDerivativeCap || 5}`,
            ].filter(Boolean)}
            emptyText="No brief rules saved yet."
          />
        </div>
      </CardContent>
    </CreativeOsCard>
  );
}

export function BrandKnowledgeCard({
  brand,
  companyName = "",
}: {
  brand: BrandProfile;
  companyName?: string;
}) {
  const normalizedBrand = normalizeBrandProfile(brand);
  const displayName =
    normalizedBrand.name || cleanCompanyName(companyName) || "Brand";
  const referenceLinks = normalizeBrandReferenceLinks(
    normalizedBrand.referenceLinks,
  );

  return (
    <div className="space-y-4">
      <CreativeOsCard>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <BookOpen size={18} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xl font-bold tracking-tight text-foreground">
                    Brand
                  </div>
                  <Badge variant="secondary" className="text-[11px] uppercase">
                    Read-only
                  </Badge>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Shared brand context from the workspace owner. Use this across
                  every assigned Creative OS brief.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-4">
            <BrandTextSection
              title="Brand name"
              icon={BookOpen}
              value={displayName}
              emptyText="No brand name saved yet."
              compact
            />
            <BrandTextSection
              title="Brand story"
              icon={BookOpen}
              value={normalizedBrand.story}
              emptyText="No brand story added yet."
              accent
            />
            <BrandTextSection
              title="Brand voice"
              icon={Sparkles}
              value={normalizedBrand.voice}
              emptyText="No brand voice saved yet."
            />
            <BrandTextSection
              title="Creative instructions"
              icon={Target}
              value={normalizedBrand.instructions}
              emptyText="No creative instructions saved yet."
            />
            <BrandTextSection
              title="Do not say / claim boundaries"
              icon={ShieldCheck}
              value={normalizedBrand.doNotSay}
              emptyText="No global claim boundaries saved yet."
            />
            <BrandReferenceLinksCard links={referenceLinks} />
          </div>
        </CardContent>
      </CreativeOsCard>
    </div>
  );
}

function BrandTextSection({
  title,
  icon: Icon,
  value,
  emptyText,
  accent = false,
  compact = false,
}: {
  title: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  value: string;
  emptyText: string;
  accent?: boolean;
  compact?: boolean;
}) {
  const text = value.trim();
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-muted-foreground">
        <Icon size={14} className="text-primary" />
        {title}
      </div>
      <div
        className={`rounded-2xl border px-4 py-3 text-sm leading-6 shadow-sm ${
          compact ? "font-semibold" : "whitespace-pre-wrap"
        } ${
          accent
            ? "border-primary/15 bg-primary/5 text-foreground"
            : text
              ? "border-border bg-background text-foreground"
              : "border-dashed border-border bg-muted/30 text-muted-foreground"
        }`}
      >
        {text || emptyText}
      </div>
    </section>
  );
}

function BrandReferenceLinksCard({ links }: { links: BrandReferenceLink[] }) {
  const normalizedLinks = normalizeBrandReferenceLinks(links);
  return (
    <CreativeOsCard className="ring-border/80">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Link2 size={16} className="text-primary" /> Reference links
        </div>
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          {normalizedLinks.length ? (
            normalizedLinks.map((link) => {
              const href = normalizeReferenceHref(link.url);
              const title = link.info || "Reference link";
              return (
                <div
                  key={link.id}
                  className="flex flex-col gap-3 rounded-xl bg-muted/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 whitespace-pre-wrap text-[15px] font-semibold leading-6 text-foreground">
                    {title}
                  </div>
                  <div className="relative self-start group shrink-0 sm:self-center">
                    {href ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={href} target="_blank" rel="noreferrer">
                          Visit
                        </a>
                      </Button>
                    ) : (
                      <Badge variant="outline">No link</Badge>
                    )}
                    {link.url ? (
                      <div className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 hidden max-w-[18rem] truncate rounded-xl border bg-background px-3 py-2 text-xs font-medium leading-5 text-muted-foreground shadow-xl group-hover:block group-focus-within:block">
                        {link.url}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div>No reference links saved yet.</div>
          )}
        </div>
      </CardContent>
    </CreativeOsCard>
  );
}

function normalizeReferenceHref(value: string) {
  const url = value.trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(url)) return `https://${url}`;
  return "";
}
