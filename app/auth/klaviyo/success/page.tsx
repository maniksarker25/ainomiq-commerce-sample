"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const SCOPES = [
  "accounts:read", "accounts:write",
  "campaigns:read", "campaigns:write",
  "catalogs:read", "catalogs:write",
  "conversations:read", "conversations:write",
  "coupon-codes:read", "coupon-codes:write",
  "coupons:read", "coupons:write",
  "custom-objects:read", "custom-objects:write",
  "data-privacy:read", "data-privacy:write",
  "events:read", "events:write",
  "flows:read", "flows:write",
  "forms:read", "forms:write",
  "images:read", "images:write",
  "lists:read", "lists:write",
  "metrics:read", "metrics:write",
  "profiles:read", "profiles:write",
  "push-tokens:read", "push-tokens:write",
  "reviews:read", "reviews:write",
  "segments:read", "segments:write",
  "subscriptions:read", "subscriptions:write",
  "tags:read", "tags:write",
  "templates:read", "templates:write",
  "tracking-settings:read", "tracking-settings:write",
  "web-feeds:read", "web-feeds:write",
  "webhooks:read", "webhooks:write",
];

function SuccessContent() {
  const params = useSearchParams();
  const error = params.get("error");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const expiresIn = params.get("expires_in");
  const scope = params.get("scope");

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#000",
      color: "#fff",
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{ maxWidth: 560, width: "100%", padding: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: "-0.02em", marginBottom: 8 }}>
          ainomiq
        </h1>

        {error ? (
          <div style={{
            background: "#1a0a0a",
            border: "1px solid #3a1a1a",
            borderRadius: 12,
            padding: 24,
            marginBottom: 32,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "#3a1a1a", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 18, color: "#f87171",
              }}>✕</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>Connection Failed</div>
                <div style={{ fontSize: 12, color: "#888", wordBreak: "break-all" }}>{error}</div>
              </div>
            </div>
          </div>
        ) : accessToken ? (
          <div style={{
            background: "#0a1a0a",
            border: "1px solid #1a3a1a",
            borderRadius: 12,
            padding: 24,
            marginBottom: 32,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "#1a3a1a", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 18, color: "#4ade80",
              }}>✓</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>Klaviyo Connected</div>
                <div style={{ fontSize: 12, color: "#888" }}>OAuth token received successfully</div>
              </div>
            </div>
            <div style={{ background: "#111", borderRadius: 8, padding: 16, fontSize: 12 }}>
              <div style={{ color: "#888", marginBottom: 4 }}>Access Token</div>
              <div style={{ color: "#4ade80", fontFamily: "monospace", wordBreak: "break-all" }}>
                {accessToken.slice(0, 20)}...{accessToken.slice(-8)}
              </div>
              {expiresIn && (
                <div style={{ color: "#888", marginTop: 8 }}>Expires in: {expiresIn}s</div>
              )}
              {refreshToken && (
                <div style={{ color: "#888", marginTop: 4 }}>Refresh token: received ✓</div>
              )}
              {scope && (
                <div style={{ color: "#888", marginTop: 4 }}>Scopes: {scope.split(" ").length} granted</div>
              )}
            </div>
          </div>
        ) : (
          <div style={{
            background: "#0a1a0a",
            border: "1px solid #1a3a1a",
            borderRadius: 12,
            padding: 24,
            marginBottom: 32,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "#1a3a1a", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 18, color: "#4ade80",
              }}>✓</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>Klaviyo Connected</div>
                <div style={{ fontSize: 12, color: "#888" }}>Authorization successful</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>
            Authorized permissions ({SCOPES.length} scopes)
          </h2>
          {SCOPES.map((s) => (
            <div
              key={s}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "8px 0",
                borderBottom: "1px solid #222",
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: 4,
                background: "#1a3a1a", display: "flex", alignItems: "center",
                justifyContent: "center", flexShrink: 0, marginTop: 2,
                fontSize: 10, color: "#4ade80",
              }}>✓</div>
              <div style={{ fontSize: 13, color: "#ccc", fontFamily: "monospace" }}>{s}</div>
            </div>
          ))}
        </div>

        <p style={{ color: "#555", fontSize: 11, lineHeight: 1.5 }}>
          Ainomiq now has full read/write access to your Klaviyo data. 
          You can revoke access at any time from your Klaviyo account settings 
          or from the Ainomiq dashboard under Settings → Integrations.
        </p>
      </div>
    </div>
  );
}

export default function KlaviyoSuccessPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#000" }} />}>
      <SuccessContent />
    </Suspense>
  );
}
