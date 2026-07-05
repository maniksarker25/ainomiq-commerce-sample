"use client";

import { useState } from "react";

const SCOPES = [
  { id: "accounts:read", description: "Read Klaviyo account information" },
  { id: "accounts:write", description: "Update Klaviyo account settings" },
  { id: "campaigns:read", description: "View email campaigns and performance" },
  { id: "campaigns:write", description: "Create and manage email campaigns" },
  { id: "catalogs:read", description: "View catalog items and feeds" },
  { id: "catalogs:write", description: "Create and manage catalog items and feeds" },
  { id: "conversations:read", description: "View conversations" },
  { id: "conversations:write", description: "Manage conversations" },
  { id: "coupon-codes:read", description: "View coupon codes" },
  { id: "coupon-codes:write", description: "Create and manage coupon codes" },
  { id: "coupons:read", description: "View coupons" },
  { id: "coupons:write", description: "Create and manage coupons" },
  { id: "custom-objects:read", description: "View custom objects" },
  { id: "custom-objects:write", description: "Create and manage custom objects" },
  { id: "data-privacy:read", description: "View data privacy requests" },
  { id: "data-privacy:write", description: "Submit data privacy/deletion requests" },
  { id: "events:read", description: "View tracked events and metrics" },
  { id: "events:write", description: "Create and manage tracked events" },
  { id: "flows:read", description: "View automated flows and their metrics" },
  { id: "flows:write", description: "Create and manage automated flows" },
  { id: "forms:read", description: "View signup forms" },
  { id: "forms:write", description: "Create and manage signup forms" },
  { id: "images:read", description: "View uploaded images" },
  { id: "images:write", description: "Upload and manage images" },
  { id: "lists:read", description: "View subscriber lists" },
  { id: "lists:write", description: "Create and manage subscriber lists" },
  { id: "metrics:read", description: "View analytics and metrics data" },
  { id: "metrics:write", description: "Create and manage metrics" },
  { id: "profiles:read", description: "View customer profiles" },
  { id: "profiles:write", description: "Create and update customer profiles" },
  { id: "push-tokens:read", description: "View push tokens" },
  { id: "push-tokens:write", description: "Create and manage push tokens" },
  { id: "reviews:read", description: "View product reviews" },
  { id: "reviews:write", description: "Manage product reviews" },
  { id: "segments:read", description: "View audience segments" },
  { id: "segments:write", description: "Create and manage audience segments" },
  { id: "subscriptions:read", description: "View email/SMS subscription status" },
  { id: "subscriptions:write", description: "Manage email/SMS subscription status" },
  { id: "tags:read", description: "View tags" },
  { id: "tags:write", description: "Create and manage tags" },
  { id: "templates:read", description: "View email templates" },
  { id: "templates:write", description: "Create and manage email templates" },
  { id: "tracking-settings:read", description: "View tracking settings" },
  { id: "tracking-settings:write", description: "Update tracking settings" },
  { id: "web-feeds:read", description: "View web feeds" },
  { id: "web-feeds:write", description: "Create and manage web feeds" },
  { id: "webhooks:read", description: "View webhooks" },
  { id: "webhooks:write", description: "Create and manage webhooks" },
];

export default function KlaviyoTestPage() {
  const [connecting, setConnecting] = useState(false);

  const handleConnect = () => {
    setConnecting(true);
    const clientId = "ac952070-0c1d-499d-86a3-b4c9b74b17a7";
    const redirectUri = `${window.location.origin}/api/auth/klaviyo/callback`;
    const scope = SCOPES.map(s => s.id).join(" ");
    const state = "klaviyo-test-" + Math.random().toString(36).slice(2);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope,
      state,
    });

    window.location.href = `https://www.klaviyo.com/oauth/authorize?${params}`;
  };

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
        <p style={{ color: "#888", fontSize: 14, marginBottom: 32 }}>
          Connect your Klaviyo account to enable AI-powered email marketing insights.
          Ainomiq requests full API access to analyze and optimize your campaigns, flows,
          segments, and customer data.
        </p>

        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>
            Permissions requested ({SCOPES.length} scopes)
          </h2>
          {SCOPES.map((scope) => (
            <div
              key={scope.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "10px 0",
                borderBottom: "1px solid #222",
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: 4,
                background: "#333", display: "flex", alignItems: "center",
                justifyContent: "center", flexShrink: 0, marginTop: 1,
                fontSize: 12, color: "#0f0",
              }}>✓</div>
              <div>
                <div style={{ fontSize: 14, color: "#fff" }}>{scope.description}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{scope.id}</div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleConnect}
          disabled={connecting}
          style={{
            width: "100%",
            padding: "14px 24px",
            background: connecting ? "#666" : "#fff",
            color: "#000",
            border: "none",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 500,
            cursor: connecting ? "not-allowed" : "pointer",
          }}
        >
          {connecting ? "Redirecting..." : "Connect Klaviyo Account"}
        </button>

        <p style={{ color: "#555", fontSize: 11, marginTop: 16, lineHeight: 1.5 }}>
          By connecting, you agree to let Ainomiq access your Klaviyo data.
          You can revoke access at any time from your Klaviyo account settings.
        </p>
      </div>
    </div>
  );
}
