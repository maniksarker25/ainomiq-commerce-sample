"use client";

import { useState, useEffect } from "react";
import { fetchSession, getSession, type Session } from "../../../lib/session";

interface AdAccount {
  id: string;
  name: string;
  accountId: string;
  status: string;
  currency: string;
  businessName: string | null;
  timezone: string | null;
}

interface MetaStatus {
  connected: boolean;
  accountName?: string;
  email?: string;
  accountId?: string;
  accountIds?: string[];
  connectedAt?: string;
}

export default function MetaSetupPage() {
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [metaStatus, setMetaStatus] = useState<MetaStatus | null>(null);
  const [session, setSession] = useState<Session | null>(() => getSession());

  const tenantId = session?.tenantId || session?.email || "";
  const nextUrl =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("next") ||
        "/dashboard/ads"
      : "/dashboard/ads";

  useEffect(() => {
    fetchSession().then((fresh) => {
      if (fresh) setSession(fresh);
    });
  }, []);

  useEffect(() => {
    if (!tenantId) return;

    async function fetchData() {
      try {
        const [statusRes, accountsRes] = await Promise.all([
          fetch(
            `/api/auth/meta/status?tenant_id=${encodeURIComponent(tenantId)}`,
          ),
          fetch(
            `/api/auth/meta/ad-accounts?tenant_id=${encodeURIComponent(tenantId)}`,
          ),
        ]);

        if (statusRes.ok) {
          const status = await statusRes.json();
          setMetaStatus(status);
          // Pre-select currently connected accounts
          if (status.connected && status.accountIds?.length) {
            setSelected(new Set(status.accountIds));
          } else if (status.connected && status.accountId) {
            // Fallback for single account
            setSelected(
              new Set(
                status.accountId
                  .split(",")
                  .map((s: string) => s.trim())
                  .filter(Boolean),
              ),
            );
          }
        }

        if (accountsRes.ok) {
          const data = await accountsRes.json();
          setAccounts(data.accounts || []);
        } else {
          const data = await accountsRes.json();
          throw new Error(data.error || "Failed to fetch ad accounts");
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [tenantId]);

  function toggleAccount(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function saveSelectionAndContinue() {
    if (selected.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/auth/meta/select-account?tenant_id=${encodeURIComponent(tenantId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: tenantId,
            adAccountIds: Array.from(selected),
          }),
        },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save selection");
      }
      window.location.href = `${nextUrl}${nextUrl.includes("?") ? "&" : "?"}connected=meta`;
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function handleSave() {
    await saveSelectionAndContinue();
  }

  function handleConnectMeta() {
    if (!tenantId) return;
    window.location.href = `/api/auth/meta/connect?tenant_id=${encodeURIComponent(tenantId)}`;
  }

  async function handleDisconnect() {
    if (
      !confirm(
        "Are you sure you want to disconnect Meta Ads? You will need to reconnect to see ad performance data.",
      )
    )
      return;
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/meta/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to disconnect");
      }
      window.location.href = "/dashboard/performance";
    } catch (err: any) {
      setError(err.message);
      setDisconnecting(false);
    }
  }

  const activeAccounts = accounts.filter((a) => a.status === "active");
  const inactiveAccounts = accounts.filter((a) => a.status !== "active");
  const isAlreadyConnected = !!(metaStatus?.connected && metaStatus?.accountId);
  const currentIds = new Set(
    metaStatus?.accountIds?.length
      ? metaStatus.accountIds
      : (metaStatus?.accountId || "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
  );
  const hasChangedSelection = (() => {
    if (selected.size !== currentIds.size) return true;
    for (const id of selected) {
      if (!currentIds.has(id)) return true;
    }
    return false;
  })();

  const selectedCount = selected.size;

  return (
    <div style={{ maxWidth: 560, margin: "40px auto", padding: "0 20px" }}>
      <div className="glass rounded-2xl" style={{ padding: "40px 32px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "linear-gradient(135deg, #1877F2, #0668E1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {isAlreadyConnected ? "Meta Ads Settings" : "Select Ad Accounts"}
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {isAlreadyConnected
              ? "Manage your connected Meta ad accounts."
              : "Connect Meta first, then select the ad accounts AI Ad Manager can use."}
          </p>
        </div>

        {/* Current connection info */}
        {isAlreadyConnected && !loading && (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "#dcfce7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#16a34a"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="text-sm font-medium text-green-800">
                Connected - {currentIds.size} account
                {currentIds.size !== 1 ? "s" : ""}
              </div>
              <div className="text-xs text-green-600" style={{ marginTop: 2 }}>
                {metaStatus.email && <span>{metaStatus.email}</span>}
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div
              style={{
                width: 24,
                height: 24,
                border: "2px solid #e2e6ef",
                borderTopColor: "#3b82f6",
                borderRadius: "50%",
                animation: "spin 0.6s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            <p className="text-sm text-gray-500">Loading ad accounts...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: 10,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#dc2626",
              fontSize: 14,
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        {!loading && !isAlreadyConnected && accounts.length === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <button
              onClick={handleConnectMeta}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: 12,
                border: "none",
                background: "#3b82f6",
                color: "#fff",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              Connect Meta Ads
            </button>
            <p className="text-xs text-gray-500 text-center">
              After connecting, you will select one or more ad accounts and AI
              Ad Manager will unlock.
            </p>
          </div>
        )}

        {/* Account list */}
        {!loading && accounts.length > 0 && (
          <div>
            {activeAccounts.length > 0 && (
              <div
                style={{ marginBottom: inactiveAccounts.length > 0 ? 20 : 0 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Active accounts
                  </div>
                  {activeAccounts.length > 1 && (
                    <button
                      onClick={() => {
                        const allActive = activeAccounts.map((a) => a.id);
                        const allSelected = allActive.every((id) =>
                          selected.has(id),
                        );
                        if (allSelected) {
                          setSelected(new Set());
                        } else {
                          setSelected(new Set(allActive));
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {activeAccounts.every((a) => selected.has(a.id))
                        ? "Deselect all"
                        : "Select all"}
                    </button>
                  )}
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {activeAccounts.map((acc) => {
                    const isChecked = selected.has(acc.id);
                    return (
                      <button
                        key={acc.id}
                        onClick={() => toggleAccount(acc.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "14px 16px",
                          borderRadius: 12,
                          border: isChecked
                            ? "2px solid #3b82f6"
                            : "1px solid #e5e7eb",
                          background: isChecked ? "#eff6ff" : "#fff",
                          cursor: "pointer",
                          textAlign: "left",
                          width: "100%",
                          transition: "all 0.15s",
                        }}
                      >
                        {/* Checkbox */}
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 5,
                            flexShrink: 0,
                            border: isChecked ? "none" : "2px solid #d1d5db",
                            background: isChecked ? "#3b82f6" : "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.15s",
                          }}
                        >
                          {isChecked && (
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="white"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            className="font-medium text-gray-900 text-sm"
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {acc.name}
                            {currentIds.has(acc.id) && (
                              <span className="ml-2 text-xs text-green-600 font-normal">
                                (active)
                              </span>
                            )}
                          </div>
                          <div
                            className="text-xs text-gray-500"
                            style={{ marginTop: 2 }}
                          >
                            {acc.businessName && (
                              <span>{acc.businessName} &middot; </span>
                            )}
                            {acc.currency} &middot; ID: {acc.accountId}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {inactiveAccounts.length > 0 && (
              <div>
                <div
                  className="text-xs font-semibold text-gray-400 uppercase tracking-wider"
                  style={{ marginBottom: 8 }}
                >
                  Inactive
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    opacity: 0.5,
                  }}
                >
                  {inactiveAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 16px",
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                        background: "#f9fafb",
                      }}
                    >
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 5,
                          border: "2px solid #d1d5db",
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="font-medium text-gray-500 text-sm">
                          {acc.name}
                        </div>
                        <div
                          className="text-xs text-gray-400"
                          style={{ marginTop: 2 }}
                        >
                          {acc.businessName && (
                            <span>{acc.businessName} &middot; </span>
                          )}
                          {acc.currency} &middot; ID: {acc.accountId}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div
              style={{
                marginTop: 24,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {isAlreadyConnected &&
                !hasChangedSelection &&
                selectedCount > 0 && (
                  <button
                    onClick={() => {
                      void saveSelectionAndContinue();
                    }}
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: 12,
                      border: "none",
                      background: "#3b82f6",
                      color: "#fff",
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    Continue to AI Ad Manager
                  </button>
                )}

              <button
                onClick={handleSave}
                disabled={
                  selectedCount === 0 ||
                  saving ||
                  (isAlreadyConnected && !hasChangedSelection)
                }
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: 12,
                  border: "none",
                  background:
                    selectedCount > 0 &&
                    (!isAlreadyConnected || hasChangedSelection)
                      ? "#3b82f6"
                      : "#e5e7eb",
                  color:
                    selectedCount > 0 &&
                    (!isAlreadyConnected || hasChangedSelection)
                      ? "#fff"
                      : "#9ca3af",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor:
                    selectedCount > 0 &&
                    (!isAlreadyConnected || hasChangedSelection)
                      ? "pointer"
                      : "not-allowed",
                  transition: "all 0.15s",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving
                  ? "Saving..."
                  : isAlreadyConnected
                    ? `Save Changes${hasChangedSelection ? ` (${selectedCount} account${selectedCount !== 1 ? "s" : ""})` : ""}`
                    : `Continue with ${selectedCount} account${selectedCount !== 1 ? "s" : ""}`}
              </button>

              {isAlreadyConnected && (
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: 12,
                    border: "1px solid #fecaca",
                    background: "#fff",
                    color: "#dc2626",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    opacity: disconnecting ? 0.7 : 1,
                  }}
                >
                  {disconnecting ? "Disconnecting..." : "Disconnect Meta Ads"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* No accounts */}
        {!loading && accounts.length === 0 && !error && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p className="text-sm text-gray-500">
              No ad accounts found. Make sure your Meta account has access to at
              least one ad account.
            </p>
          </div>
        )}

        {/* Back link */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <a
            href="/dashboard/automations"
            className="text-sm text-gray-500 hover:text-gray-700 hover:underline"
          >
            Back to Automations
          </a>
        </div>
      </div>
    </div>
  );
}
