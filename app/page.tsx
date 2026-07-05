import Link from "next/link";
import FeatureSection from "../components/FeatureSection";

export const metadata = {
  title: "Ainomiq - Your store, fully automated",
  description:
    "Connect your store. Ainomiq handles customer service, emails, inventory, and reporting - so you can focus on growth.",
};

export default function Home() {
  return (
    <div
      style={{
        background:
          "linear-gradient(180deg, #dbeafe 0%, #f5f7fb 50%, #ffffff 100%)",
        minHeight: "100vh",
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "24px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <img
          src="/logo.png?v=2"
          alt="ainomiq"
          style={{ height: "28px", width: "auto" }}
        />
        <div style={{ display: "flex", gap: "12px" }}>
          <Link
            href="/login?switch=1"
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              color: "#3b82f6",
              fontSize: "14px",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Sign in
          </Link>
          <Link
            href="/register"
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              background: "#3b82f6",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main
        style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: "80px 24px 60px",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "42px",
            fontWeight: 700,
            color: "#1a1a2e",
            lineHeight: 1.2,
            marginBottom: "20px",
          }}
        >
          Your store,
          <br />
          fully automated
        </h1>
        <p
          style={{
            fontSize: "18px",
            color: "#6b7280",
            lineHeight: 1.6,
            maxWidth: 480,
            margin: "0 auto 40px",
          }}
        >
          One app. Every department. Always running.
        </p>
        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/register"
            style={{
              padding: "14px 32px",
              borderRadius: "10px",
              background: "#3b82f6",
              color: "#fff",
              fontSize: "15px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Get started free
          </Link>
          <a
            href="https://www.ainomiq.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "14px 32px",
              borderRadius: "10px",
              border: "1px solid #e2e6ef",
              color: "#1a1a2e",
              fontSize: "15px",
              fontWeight: 500,
              textDecoration: "none",
              background: "#fff",
            }}
          >
            Learn more
          </a>
        </div>
      </main>

      {/* Features */}
      <FeatureSection />

      {/* Integrations */}
      <section
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "40px 24px 80px",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontSize: "24px",
            fontWeight: 700,
            color: "#1a1a2e",
            marginBottom: "12px",
          }}
        >
          Connects with your stack
        </h2>
        <p style={{ fontSize: "15px", color: "#6b7280", marginBottom: "32px" }}>
          One-click integrations. Your data stays yours.
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "32px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {["Shopify", "Meta Ads", "Klaviyo", "Google", "Gmail"].map((name) => (
            <div
              key={name}
              style={{
                padding: "12px 24px",
                borderRadius: "10px",
                background: "#fff",
                border: "1px solid #e2e6ef",
                fontSize: "14px",
                fontWeight: 500,
                color: "#1a1a2e",
              }}
            >
              {name}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: "24px",
          textAlign: "center",
          borderTop: "1px solid #e2e6ef",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "16px",
            marginBottom: "12px",
            fontSize: "13px",
          }}
        >
          <Link
            href="/privacy-policy"
            style={{ color: "#6b7280", textDecoration: "none" }}
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms-of-service"
            style={{ color: "#6b7280", textDecoration: "none" }}
          >
            Terms of Service
          </Link>
          <a
            href="https://www.ainomiq.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#6b7280", textDecoration: "none" }}
          >
            ainomiq.com
          </a>
        </div>
        <p style={{ color: "#9ca3af", fontSize: "12px" }}>
          &copy; {new Date().getFullYear()} Ainomiq. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
