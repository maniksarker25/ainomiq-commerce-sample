import React from "react";
import { CheckCircle2 } from "lucide-react";
import { SectionDescription, PlatformLogo } from "./Typography";
import { IntegrationStatus } from "../_lib/types";
import {
  SHOPIFY_CONNECTOR_FREE_NOTICE,
  getShopifyAppStoreListingUrl,
} from "../../../../lib/shopify-oauth";
import {
  connectHrefForIntegration,
  disconnectPathForIntegration,
  integrationProviderId,
} from "../_lib/utils";
import { getSessionTenantId } from "../../../../lib/session";

interface IntegrationsTabProps {
  integrations: IntegrationStatus[];
  openIntegrationGroups: Record<string, boolean>;
  setOpenIntegrationGroups: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  shopifyInstallHint: boolean;
  session: any;
  onViewDetails?: (id: string) => void;
}

function InlineMetaAdAccountSelector({
  session,
  initialSelected,
}: {
  session: any;
  initialSelected?: string;
}) {
  const [accounts, setAccounts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedAccounts, setSelectedAccounts] = React.useState<string[]>(
    () => {
      return initialSelected ? initialSelected.split(",").filter(Boolean) : [];
    },
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const tenantId = session?.tenantId || session?.email || "";

  React.useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    fetch(
      `/api/auth/meta/ad-accounts?tenant_id=${encodeURIComponent(tenantId)}`,
    )
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load accounts");
        return r.json();
      })
      .then((data) => {
        setAccounts(data.accounts || []);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [tenantId]);

  const handleToggle = async (accId: string) => {
    let newSelection: string[];
    if (selectedAccounts.includes(accId)) {
      newSelection = selectedAccounts.filter((id) => id !== accId);
    } else {
      newSelection = [...selectedAccounts, accId];
    }
    setSelectedAccounts(newSelection);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/meta/select-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          adAccountIds: newSelection,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save account selection");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
          Active Ad Accounts
        </label>
        {selectedAccounts.length > 0 && !loading && (
          <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-medium">
            {selectedAccounts.length} Active Syncing
          </span>
        )}
      </div>
      {loading ? (
        <div className="text-xs text-gray-400 animate-pulse py-1">
          Loading ad accounts...
        </div>
      ) : error ? (
        <div className="text-[11px] text-red-500 bg-red-50 px-2 py-1.5 rounded-lg border border-red-100 mb-2">
          {error}
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2">
          No ad accounts found. Make sure you have permission to at least one
          active ad account on Meta.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="max-h-[160px] overflow-y-auto border border-gray-100 rounded-xl p-2 bg-gray-50/50 flex flex-col gap-1.5">
            {accounts.map((acc) => {
              const isSelected = selectedAccounts.includes(acc.id);
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => handleToggle(acc.id)}
                  disabled={saving}
                  className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition text-left w-full disabled:opacity-60"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-semibold text-gray-900 truncate">
                      {acc.name}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate mt-0.5">
                      {acc.businessName ? `${acc.businessName} · ` : ""}
                      {acc.accountId}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider"
                      style={{
                        background:
                          acc.status === "active"
                            ? "rgba(22,163,74,0.08)"
                            : "rgba(239,68,68,0.08)",
                        color: acc.status === "active" ? "#16a34a" : "#ef4444",
                      }}
                    >
                      {acc.status}
                    </span>
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "4px",
                        border: "1.5px solid",
                        borderColor: isSelected ? "#3b82f6" : "#d1d5db",
                        background: isSelected ? "#3b82f6" : "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.1s",
                      }}
                    >
                      {isSelected && (
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#fff"
                          strokeWidth="4.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {saving && (
            <div className="text-[10px] text-gray-400 animate-pulse text-right">
              Saving changes...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function IntegrationsTab({
  integrations,
  openIntegrationGroups,
  setOpenIntegrationGroups,
  shopifyInstallHint,
  session,
  onViewDetails,
}: IntegrationsTabProps) {
  const integrationGroups = [
    {
      id: "core",
      title: "Core platforms",
      desc: "Main store and email systems.",
      logo: "/logos/ainomiq-ai-v1.png",
      items: integrations.filter((ig) =>
        ["commerce", "marketing"].includes((ig as any).group),
      ),
    },
    {
      id: "internal",
      title: "Ainomiq Library",
      desc: "Built-in storage for product photos, videos, and approved creative.",
      logo: "asset-library-icon",
      items: integrations.filter((ig) => (ig as any).group === "internal"),
    },
    {
      id: "google",
      title: "Google Integrations",
      desc: "Workspace, Drive and Ads under one clean Google connection group.",
      logo: "/logos/google.svg",
      items: integrations.filter((ig) => (ig as any).group === "google"),
    },
    {
      id: "meta",
      title: "Meta Integrations",
      desc: "Messaging, posting and performance data for Facebook and Instagram.",
      logo: "/logos/meta.svg",
      items: integrations.filter((ig) => (ig as any).group === "meta"),
    },
    {
      id: "social",
      title: "Other channels",
      desc: "Additional social ad and content platforms.",
      logo: "",
      items: integrations.filter((ig) => (ig as any).group === "social"),
    },
    {
      id: "custom",
      title: "Custom",
      desc: "Request anything that is not listed yet.",
      logo: "custom-question",
      items: integrations.filter((ig) => (ig as any).group === "custom"),
    },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
      <SectionDescription className="mb-4">
        Connect your platforms to sync live data into your dashboard.
      </SectionDescription>
      <p className="mb-6 text-[11px] text-[var(--ai-text-muted)] max-w-2xl uppercase tracking-wider font-bold">
        {SHOPIFY_CONNECTOR_FREE_NOTICE}
      </p>

      {shopifyInstallHint && (
        <div className="mb-6 p-4 rounded-xl border border-blue-100 bg-blue-50/80">
          <p className="text-sm font-medium text-gray-900">
            Connect Shopify from your store admin
          </p>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            Install or open the free Ainomiq app in Shopify Admin to authorize
            access. Shopify will identify your store-no need to type a store URL
            here.
          </p>
          <a
            href={getShopifyAppStoreListingUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 px-4 py-2 text-sm font-medium rounded-lg bg-[#96bf48] text-white hover:bg-[#7fa73c]"
          >
            Open in Shopify
          </a>
        </div>
      )}

      <div className="space-y-4">
        {integrationGroups.map((group) => {
          const connectedCount = group.items.filter(
            (ig) => ig.connected,
          ).length;
          const open =
            group.id === "core" ||
            group.id === "custom" ||
            group.id === "internal" ||
            Boolean(openIntegrationGroups[group.id]);
          return (
            <div key={group.id} className="glass rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  if (
                    group.id === "core" ||
                    group.id === "custom" ||
                    group.id === "internal"
                  )
                    return;
                  setOpenIntegrationGroups((current) => ({
                    ...current,
                    [group.id]: !open,
                  }));
                }}
                className="w-full flex items-center justify-between gap-4 p-5 text-left"
                style={{
                  cursor:
                    group.id === "core" ||
                    group.id === "custom" ||
                    group.id === "internal"
                      ? "default"
                      : "pointer",
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-11 w-11 rounded-xl bg-white flex items-center justify-center shrink-0">
                    {group.logo ? (
                      <PlatformLogo logo={group.logo} name={group.title} />
                    ) : (
                      <span className="text-lg font-black text-gray-500">
                        +
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div
                        className="text-gray-900 font-bold"
                        style={{ fontSize: "15px" }}
                      >
                        {group.title}
                      </div>
                      <span
                        className={
                          connectedCount
                            ? "badge-connected"
                            : "badge-disconnected"
                        }
                      >
                        {connectedCount}/{group.items.length} connected
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{group.desc}</p>
                  </div>
                </div>
                {group.id !== "core" &&
                  group.id !== "custom" &&
                  group.id !== "internal" && (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#6b7280"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        transform: open ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform .18s ease",
                      }}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  )}
              </button>
              {open && (
                <div className="border-t border-gray-200 p-4 pt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-4">
                    {group.items.map((ig) => (
                      <div
                        key={ig.id}
                        className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-col gap-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                              <PlatformLogo logo={ig.logo} name={ig.name} />
                            </div>
                            <div className="min-w-0">
                              <div
                                className="text-gray-900 font-semibold"
                                style={{ fontSize: "15px" }}
                              >
                                {ig.name}
                              </div>
                              <div className="mt-1">
                                {ig.connected ? (
                                  <div className="flex flex-col items-start gap-1">
                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                      <CheckCircle2 size={10} />
                                      Connected
                                    </span>
                                    {ig.email && (
                                      <span
                                        className="text-xs text-gray-500 font-medium truncate max-w-[220px]"
                                        title={ig.email}
                                      >
                                        {ig.email}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                                    Not connected
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <SectionDescription className="mt-auto">
                          {ig.desc}
                        </SectionDescription>
                        {ig.connected && ig.id === "meta_ads" && (
                          <InlineMetaAdAccountSelector
                            session={session}
                            initialSelected={ig.providerAccountId}
                          />
                        )}
                        {(ig as any).builtIn ? (
                          <div className="flex gap-3 mt-auto">
                            <button
                              className="btn-secondary flex-1"
                              style={{ fontSize: "13px", padding: "8px 12px" }}
                              onClick={() => {
                                window.location.href =
                                  "/dashboard/ads?tab=generate&assets=1";
                              }}
                            >
                              Manage assets
                            </button>
                          </div>
                        ) : ig.connected ? (
                          <div className="flex gap-3 mt-auto">
                            {ig.id === "meta_ads" && (
                              <button
                                className="btn-secondary flex-1"
                                style={{
                                  fontSize: "13px",
                                  padding: "8px 12px",
                                }}
                                onClick={() => onViewDetails?.(ig.id)}
                              >
                                Configure Accounts
                              </button>
                            )}
                            <button
                              className="btn-danger flex-1"
                              onClick={() => {
                                if (confirm(`Disconnect ${ig.name}?`)) {
                                  const providerId = ig.id;
                                  fetch(disconnectPathForIntegration(ig.id), {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify({
                                      tenant_id:
                                        session?.tenantId ||
                                        session?.email ||
                                        "",
                                      provider: providerId,
                                    }),
                                  }).then(() => location.reload());
                                }
                              }}
                            >
                              Disconnect
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn-primary mt-auto"
                            style={{
                              fontSize: "13px",
                              padding: "10px",
                              opacity: (ig as any).comingSoon ? 0.5 : 1,
                              cursor: (ig as any).comingSoon
                                ? "default"
                                : "pointer",
                            }}
                            onClick={() => {
                              if ((ig as any).comingSoon) return;
                              if ((ig as any).isRequest) {
                                window.open(
                                  "mailto:info@ainomiq.com?subject=Custom Integration Request",
                                  "_blank",
                                );
                                return;
                              }
                              window.location.href = connectHrefForIntegration(
                                ig.id,
                                getSessionTenantId(session),
                              );
                            }}
                            disabled={(ig as any).comingSoon}
                          >
                            {(ig as any).isRequest
                              ? "Request Integration"
                              : (ig as any).comingSoon
                                ? "Coming Soon"
                                : "Connect"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
