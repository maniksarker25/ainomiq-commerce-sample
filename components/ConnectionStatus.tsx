"use client";

import { useEffect, useState } from "react";
import { getSession, getSessionTenantId } from "../lib/session";
import { buildShopifyConnectHref } from "../lib/shopify-oauth";

const PLATFORM_LOGOS: Record<string, string> = {
  shopify: "/logos/shopify.svg",
  meta: "/logos/meta.svg",
  instagram: "instagram-gradient",
  facebook: "facebook-blue",
  klaviyo: "/logos/klaviyo.webp",
  google: "/logos/google.svg",
  twilio: "/logos/twilio.svg",
};

const PLATFORM_NAMES: Record<string, string> = {
  shopify: "Shopify",
  meta: "Meta Ads",
  instagram: "Instagram",
  facebook: "Facebook",
  klaviyo: "Klaviyo",
  google: "Google",
  twilio: "Phone Number",
};

interface Connection {
  platform:
    | "shopify"
    | "meta"
    | "instagram"
    | "facebook"
    | "klaviyo"
    | "google"
    | "twilio";
  required: boolean; // true = blocks dashboard, false = recommended
}

interface ConnectionStatusProps {
  connections: Connection[];
  children: React.ReactNode;
}

interface PlatformStatus {
  platform: string;
  connected: boolean;
  data?: {
    email?: string;
    shop?: string;
    accountName?: string;
    accountId?: string;
    number?: string;
  };
}

function PlatformLogo({
  platform,
  logo,
}: {
  platform: string;
  logo: string;
}) {
  if (logo === "instagram-gradient") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <defs>
          <radialGradient
            id={`ig-conn-${platform}`}
            cx="30%"
            cy="107%"
            r="150%"
          >
            <stop offset="0%" stopColor="#fdf497" />
            <stop offset="5%" stopColor="#fdf497" />
            <stop offset="45%" stopColor="#fd5949" />
            <stop offset="60%" stopColor="#d6249f" />
            <stop offset="90%" stopColor="#285AEB" />
          </radialGradient>
        </defs>
        <rect
          x="2"
          y="2"
          width="20"
          height="20"
          rx="5"
          stroke={`url(#ig-conn-${platform})`}
          strokeWidth="2"
          fill="none"
        />
        <circle
          cx="12"
          cy="12"
          r="4.5"
          stroke={`url(#ig-conn-${platform})`}
          strokeWidth="2"
          fill="none"
        />
        <circle
          cx="17.5"
          cy="6.5"
          r="1.2"
          fill={`url(#ig-conn-${platform})`}
        />
      </svg>
    );
  }
  if (logo === "facebook-blue") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
        <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
      </svg>
    );
  }
  return (
    <img
      src={logo}
      alt={PLATFORM_NAMES[platform]}
      style={{ width: 20, height: 20, objectFit: "contain" }}
    />
  );
}

export default function ConnectionStatus({
  connections,
  children,
}: ConnectionStatusProps) {
  const requiredConnections = connections.filter((conn) => conn.required);
  const [statuses, setStatuses] = useState<PlatformStatus[]>([]);
  const [loading, setLoading] = useState(requiredConnections.length > 0);

  useEffect(() => {
    if (requiredConnections.length === 0) return;

    const session = getSession();
    if (!session) {
      setLoading(false);
      return;
    }

    const fetchStatuses = async () => {
      const results: PlatformStatus[] = [];
      for (const conn of requiredConnections) {
        try {
          const tenantId = getSessionTenantId(session);
          const res = await fetch(
            `/api/auth/${conn.platform}/status?tenant_id=${encodeURIComponent(tenantId)}`,
          );
          const data = await res.json();
          results.push({
            platform: conn.platform,
            connected: data.connected,
            data: data,
          });
        } catch {
          results.push({
            platform: conn.platform,
            connected: false,
          });
        }
      }
      setStatuses(results);
      setLoading(false);
    };
    fetchStatuses();
  }, [connections]);

  if (requiredConnections.length === 0) {
    return <>{children}</>;
  }

  const allRequiredConnected = requiredConnections.every((conn) => {
    const status = statuses.find((s) => s.platform === conn.platform);
    return status?.connected;
  });

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "40vh",
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            border: "2px solid #d1d5db",
            borderTopColor: "#5b8def",
            borderRadius: "50%",
            animation: "spin 0.6s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (allRequiredConnected) {
    return <>{children}</>;
  }

  const session = getSession();
  const tenantId = session ? getSessionTenantId(session) : "";
  const returnTo =
    typeof window !== "undefined" ? window.location.pathname : "/dashboard";

  return (
    <div
      className="glass rounded-2xl"
      style={{
        padding: "48px 24px",
        textAlign: "center",
        maxWidth: 520,
        margin: "40px auto",
      }}
    >
      <h3
        className="text-lg font-semibold"
        style={{ marginBottom: 8, color: "#1a1a2e" }}
      >
        Connect required platforms
      </h3>
      <p
        style={{
          color: "#6b7280",
          fontSize: "14px",
          lineHeight: 1.6,
          marginBottom: 24,
        }}
      >
        Connect the integrations below to use this dashboard.
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginBottom: 24,
          textAlign: "left",
        }}
      >
        {requiredConnections.map((conn) => {
          const status = statuses.find((s) => s.platform === conn.platform);
          const connected = status?.connected ?? false;
          if (connected) return null;

          const logo = PLATFORM_LOGOS[conn.platform];
          const name = PLATFORM_NAMES[conn.platform];

          return (
            <div
              key={conn.platform}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <PlatformLogo platform={conn.platform} logo={logo} />
                <span
                  style={{ fontSize: "14px", fontWeight: 500, color: "#1a1a2e" }}
                >
                  {name}
                </span>
              </div>
              <a
                href={
                  conn.platform === "shopify"
                    ? buildShopifyConnectHref({ tenantId, returnTo })
                    : `/api/auth/${conn.platform}/connect?tenant_id=${encodeURIComponent(tenantId)}`
                }
                style={{
                  padding: "6px 14px",
                  fontSize: "13px",
                  fontWeight: 500,
                  background: "#5b8def",
                  color: "white",
                  borderRadius: 8,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Connect
              </a>
            </div>
          );
        })}
      </div>
      <a
        href="/dashboard/settings"
        className="btn-primary"
        style={{
          textDecoration: "none",
          display: "inline-block",
          padding: "12px 32px",
          fontSize: "14px",
        }}
      >
        Go to Settings
      </a>
    </div>
  );
}
