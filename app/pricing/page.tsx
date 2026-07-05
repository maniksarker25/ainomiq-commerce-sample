"use client";

import { useState } from "react";

const MODULES = [
  {
    id: "cs",
    name: "Customer Support AI",
    desc: "Automated email & DM responses, escalation routing, multi-language",
    icon: "💬",
  },
  {
    id: "ads",
    name: "Ad Monitoring",
    desc: "Performance tracking, kill/scale alerts, creative analysis",
    icon: "📊",
  },
  {
    id: "email",
    name: "Email Automation",
    desc: "Campaign scheduling, flow optimization, A/B testing insights",
    icon: "✉️",
  },
  {
    id: "stock",
    name: "Inventory Management",
    desc: "Stock alerts, reorder predictions, fulfillment monitoring",
    icon: "📦",
  },
  {
    id: "analytics",
    name: "Analytics & Reporting",
    desc: "Unified dashboard, weekly reports, trend detection",
    icon: "📈",
  },
  {
    id: "social",
    name: "Social Media Management",
    desc: "Comment moderation, DM handling, sentiment analysis",
    icon: "🌐",
  },
];

const TIERS = [
  {
    id: "starter",
    name: "Starter",
    orders: "0–500 orders/mo",
    base: 49,
    perModule: 29,
    maxModules: 2,
  },
  {
    id: "growth",
    name: "Growth",
    orders: "500–2,500 orders/mo",
    base: 99,
    perModule: 49,
    maxModules: 4,
  },
  {
    id: "scale",
    name: "Scale",
    orders: "2,500–10,000 orders/mo",
    base: 199,
    perModule: 79,
    maxModules: 6,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    orders: "10,000+ orders/mo",
    base: null,
    perModule: null,
    maxModules: 6,
  },
];

export default function PricingPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set(["cs"]));
  const [annual, setAnnual] = useState(false);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const discount = annual ? 0.8 : 1;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        padding: "48px 24px",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 300,
            letterSpacing: "-0.02em",
            marginBottom: 4,
          }}
        >
          ainomiq
        </h1>
        <h2 style={{ fontSize: 22, fontWeight: 500, marginBottom: 8 }}>
          Pricing
        </h2>
        <p style={{ color: "#888", fontSize: 14, marginBottom: 32 }}>
          Pay for what you use. Select the modules you need - scale up anytime.
        </p>

        {/* Billing toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 32,
          }}
        >
          <span style={{ color: annual ? "#666" : "#fff", fontSize: 14 }}>
            Monthly
          </span>
          <div
            onClick={() => setAnnual(!annual)}
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              background: annual ? "#fff" : "#333",
              cursor: "pointer",
              position: "relative",
              transition: "background 0.2s",
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                background: annual ? "#000" : "#888",
                position: "absolute",
                top: 3,
                left: annual ? 23 : 3,
                transition: "left 0.2s",
              }}
            />
          </div>
          <span style={{ color: annual ? "#fff" : "#666", fontSize: 14 }}>
            Annual <span style={{ color: "#0f0", fontSize: 12 }}>Save 20%</span>
          </span>
        </div>

        {/* Module selector */}
        <div style={{ marginBottom: 40 }}>
          <h3 style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}>
            Select your modules
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 12,
            }}
          >
            {MODULES.map((mod) => (
              <div
                key={mod.id}
                onClick={() => toggle(mod.id)}
                style={{
                  padding: "16px 20px",
                  borderRadius: 10,
                  border: selected.has(mod.id)
                    ? "1px solid #fff"
                    : "1px solid #222",
                  background: selected.has(mod.id) ? "#111" : "#0a0a0a",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 500 }}>
                    {mod.icon} {mod.name}
                  </span>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      border: selected.has(mod.id) ? "none" : "1px solid #444",
                      background: selected.has(mod.id) ? "#fff" : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      color: "#000",
                    }}
                  >
                    {selected.has(mod.id) && "✓"}
                  </div>
                </div>
                <p
                  style={{
                    color: "#777",
                    fontSize: 12,
                    marginTop: 6,
                    lineHeight: 1.4,
                  }}
                >
                  {mod.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing tiers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
            gap: 16,
          }}
        >
          {TIERS.map((tier) => {
            const moduleCount = selected.size;
            const total =
              tier.base !== null
                ? Math.round(
                    (tier.base +
                      tier.perModule! *
                        Math.min(moduleCount, tier.maxModules)) *
                      discount,
                  )
                : null;
            const overMax = moduleCount > tier.maxModules;

            return (
              <div
                key={tier.id}
                style={{
                  padding: 24,
                  borderRadius: 12,
                  border:
                    tier.id === "growth" ? "1px solid #fff" : "1px solid #222",
                  background: tier.id === "growth" ? "#111" : "#0a0a0a",
                  position: "relative",
                }}
              >
                {tier.id === "growth" && (
                  <div
                    style={{
                      position: "absolute",
                      top: -10,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: "#fff",
                      color: "#000",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 12px",
                      borderRadius: 10,
                    }}
                  >
                    Most popular
                  </div>
                )}
                <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                  {tier.name}
                </h4>
                <p style={{ color: "#666", fontSize: 12, marginBottom: 16 }}>
                  {tier.orders}
                </p>
                {total !== null ? (
                  <>
                    <div style={{ fontSize: 32, fontWeight: 300 }}>
                      €{total}
                      <span style={{ fontSize: 14, color: "#666" }}>/mo</span>
                    </div>
                    <p style={{ color: "#555", fontSize: 11, marginTop: 4 }}>
                      €{tier.base} base + €{tier.perModule}/module ×{" "}
                      {Math.min(moduleCount, tier.maxModules)}
                      {annual && " (20% off)"}
                    </p>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 24, fontWeight: 300 }}>Custom</div>
                    <p style={{ color: "#555", fontSize: 11, marginTop: 4 }}>
                      Tailored to your needs
                    </p>
                  </>
                )}
                <div style={{ marginTop: 16 }}>
                  <p style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
                    Up to {tier.maxModules} modules
                  </p>
                  {overMax && tier.base !== null && (
                    <p style={{ fontSize: 11, color: "#f90" }}>
                      {moduleCount} selected - upgrade for more
                    </p>
                  )}
                </div>
                <button
                  style={{
                    width: "100%",
                    marginTop: 16,
                    padding: "10px 0",
                    background: tier.id === "growth" ? "#fff" : "transparent",
                    color: tier.id === "growth" ? "#000" : "#fff",
                    border: tier.id === "growth" ? "none" : "1px solid #333",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {tier.base !== null ? "Get started" : "Contact us"}
                </button>
              </div>
            );
          })}
        </div>

        <p
          style={{
            color: "#444",
            fontSize: 11,
            marginTop: 32,
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          All plans include OAuth integrations, encrypted data storage, and
          email support.
          <br />
          No setup fees. Cancel anytime. Prices exclude VAT.
        </p>
      </div>
    </div>
  );
}
