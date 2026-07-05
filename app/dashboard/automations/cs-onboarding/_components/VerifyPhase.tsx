"use client";

import { useState } from "react";
import { Globe, Pencil } from "lucide-react";
import type { ScrapeResult, ScrapedProduct, ScrapedPolicy } from "@/lib/scraper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { langFlag, langName, platformLabel } from "../_lib/helpers";
import { ProviderIcon, PlatformIcon } from "./shared";
import { Section } from "./Section";
import { MarketsTable } from "./MarketsTable";


export function VerifyPhase({
  data,
  onBack,
  onContinue,
  onChangeDomain,
}: {
  data: ScrapeResult;
  onBack: () => void;
  onContinue: () => void;
  onChangeDomain: (url: string) => void;
}) {
  const [editingUrl, setEditingUrl] = useState(false);
  const [newUrl, setNewUrl] = useState(data.storeUrl || "");

  const hasProducts = data.products.length > 0;
  const hasPolicies = data.policies.length > 0;
  const hasFaq = data.faq.length > 0;
  const hasMarkets = (data.availableMarkets?.length || 0) > 0;

  return (
    <div className="max-w-4xl">
      {/* Hero header with favicon & store info */}
      <div className="mb-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-14 h-14 bg-white border border-gray-200 rounded-2xl flex items-center justify-center overflow-hidden shadow-sm shrink-0">
            {data.storeInfo.favicon ? (
              <img
                src={data.storeInfo.favicon}
                alt=""
                className="w-8 h-8 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <svg
                className="w-6 h-6 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"
                />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              {data.storeInfo.name || "Untitled Store"}
            </h1>
            {editingUrl ? (
              <form
                className="flex items-center gap-2 mt-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = newUrl.trim();
                  if (trimmed && trimmed !== data.storeUrl)
                    onChangeDomain(trimmed);
                  setEditingUrl(false);
                }}
              >
                <Input
                  type="text"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="flex-1 max-w-xs px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-400"
                  autoFocus
                />
                <Button
                  type="submit"
                  className="rounded-lg px-3 py-1.5 text-xs font-medium"
                >
                  Scan
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setEditingUrl(false);
                    setNewUrl(data.storeUrl || "");
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </Button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{data.storeUrl}</span>
                <Button
                  onClick={() => setEditingUrl(true)}
                  className="text-gray-300 hover:text-gray-500 transition-colors"
                  title="Change domain"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </Button>
              </div>
            )}
            {/* Meta badges */}
            {!editingUrl && (
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                  <PlatformIcon platform={data.platform} size={13} />
                  {platformLabel(data.platform)}
                </span>
                {(data.storeInfo.languages?.length > 0
                  ? data.storeInfo.languages
                  : data.storeInfo.language
                    ? [data.storeInfo.language]
                    : []
                ).map((lang) => (
                  <span
                    key={lang}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full"
                  >
                    <span className="text-[13px] leading-none">
                      {langFlag(lang)}
                    </span>
                    {langName(lang)}
                  </span>
                ))}
                {data.storeInfo.currency && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                    {data.storeInfo.currency}
                  </span>
                )}
                {data.contact.emailProvider &&
                  data.contact.emailProvider !== "other" && (
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${
                        data.contact.emailProvider.includes("Google")
                          ? "bg-blue-50 text-blue-600"
                          : data.contact.emailProvider.includes("Microsoft")
                            ? "bg-sky-50 text-sky-600"
                            : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <ProviderIcon
                        provider={data.contact.emailProvider}
                        size={13}
                      />
                      {data.contact.emailProvider}
                    </span>
                  )}
                {data.contact.mxProvider &&
                  data.contact.mxProvider !== data.contact.emailProvider && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">
                      <ProviderIcon
                        provider={data.contact.mxProvider}
                        size={13}
                      />
                      {data.contact.mxProvider}
                      <span className="text-[9px] text-gray-400">(MX)</span>
                    </span>
                  )}
              </div>
            )}
          </div>
          <div className="flex gap-2 shrink-0 pt-1">
            <Button
              onClick={onBack}
              className="px-4 py-2 text-[13px] font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Re-scan
            </Button>
            <Button
              onClick={onContinue}
              className="rounded-xl px-5 py-2 text-[13px] font-medium"
            >
              Continue →
            </Button>
          </div>
        </div>

        {/* Description */}
        {data.storeInfo.description && (
          <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
            {data.storeInfo.description}
          </p>
        )}
      </div>

      {/* Contact row */}
      <div className="flex items-center gap-6 mb-8 py-4 px-5 bg-gray-50/80 border border-gray-100 rounded-2xl">
        {data.contact.email && (
          <div className="flex items-center gap-2.5 min-w-0">
            <svg
              className="w-4 h-4 text-gray-400 shrink-0"
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
            <span className="text-sm text-gray-700 truncate">
              {data.contact.email}
            </span>
          </div>
        )}
        {data.contact.phone && (
          <div className="flex items-center gap-2.5">
            <svg
              className="w-4 h-4 text-gray-400 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
              />
            </svg>
            <span className="text-sm text-gray-700">{data.contact.phone}</span>
          </div>
        )}
        {data.contact.address && data.contact.address !== "Not found" && (
          <div className="flex items-center gap-2.5">
            <svg
              className="w-4 h-4 text-gray-400 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span className="text-sm text-gray-700">
              {data.contact.address}
            </span>
          </div>
        )}
        {!data.contact.email && !data.contact.phone && (
          <span className="text-sm text-gray-400">
            No contact information found
          </span>
        )}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Products */}
        <Section
          title="Products"
          count={data.products.length}
          muted={!hasProducts}
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          }
        >
          {!hasProducts ? (
            <p className="text-[13px] text-gray-400">
              No products extracted. You can add them manually later.
            </p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {data.products.map((p: ScrapedProduct, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.title}
                      className="w-10 h-10 rounded-lg object-cover border border-gray-100 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-gray-900 truncate">
                      {p.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {p.variants?.length > 1
                        ? `${p.variants.length} variants · `
                        : ""}
                      {p.price
                        ? p.price.match(/^[€$£]/)
                          ? p.price
                          : `€${p.price}`
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Policies */}
        <Section
          title="Policies"
          count={data.policies.length}
          muted={!hasPolicies}
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          }
        >
          {!hasPolicies ? (
            <p className="text-[13px] text-gray-400">
              No policies found. You can add them later.
            </p>
          ) : (
            <div className="space-y-3">
              {data.policies.map((p: ScrapedPolicy, i: number) => (
                <div key={i} className="p-3 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-700 capitalize">
                      {p.type}
                    </span>
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-gray-400 hover:text-gray-600"
                      >
                        ↗
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                    {p.content.slice(0, 200)}
                    {p.content.length > 200 ? "…" : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Shipping */}
        {data.shippingCosts && (
          <Section
            title="Shipping"
            icon={
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                />
              </svg>
            }
          >
            <p className="text-[13px] text-gray-700 leading-relaxed">
              {data.shippingCosts}
            </p>
          </Section>
        )}

        {/* FAQ */}
        {hasFaq && (
          <Section
            title="FAQ"
            count={data.faq.length}
            icon={
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          >
            <ul className="space-y-2">
              {data.faq.map((q, i) => (
                <li
                  key={i}
                  className="text-[13px] text-gray-600 flex items-start gap-2"
                >
                  <span className="text-gray-300 shrink-0 font-medium">Q</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Available Markets */}
        {hasMarkets && (
          <Section
            title="Markets"
            count={data.availableMarkets!.length}
            icon={
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          >
            <MarketsTable markets={data.availableMarkets!} />
          </Section>
        )}
      </div>
    </div>
  );
}
