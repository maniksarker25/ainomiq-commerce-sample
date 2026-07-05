export const metadata = {
  title: "Privacy Policy - Ainomiq Platform",
  description:
    "How the Ainomiq platform collects, uses, and protects your data.",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-12">
      <h2
        className="text-xl font-bold tracking-tight mb-4"
        style={{ color: "#1a1a2e" }}
      >
        {title}
      </h2>
      <div
        className="text-[15px] leading-relaxed space-y-3"
        style={{ color: "#6b7280" }}
      >
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <div
      className="min-h-screen"
      style={{
        background: "#ffffff",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div className="max-w-3xl mx-auto px-6 py-20 md:py-28">
        {/* Header */}
        <div className="mb-16">
          <div
            className="mb-6 inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wider"
            style={{ background: "#dbeafe", color: "#3b82f6" }}
          >
            Legal
          </div>
          <h1
            className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4"
            style={{ color: "#1a1a2e" }}
          >
            Privacy Policy
          </h1>
          <p className="text-lg" style={{ color: "#6b7280" }}>
            Ainomiq Platform - app.ainomiq.com
          </p>
          <p className="text-lg" style={{ color: "#6b7280" }}>
            Version 1.0 - April 9, 2026
          </p>
        </div>

        {/* Website policy link */}
        <div
          className="mb-12 flex items-center gap-3 rounded-2xl px-6 py-4"
          style={{ background: "#f8fafc", border: "1px solid #e2e6ef" }}
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
            style={{ background: "#dbeafe" }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" x2="21" y1="14" y2="3" />
            </svg>
          </div>
          <p className="text-sm" style={{ color: "#6b7280" }}>
            For our website privacy policy, see{" "}
            <a
              href="https://ainomiq.com/privacy"
              style={{ color: "#3b82f6", fontWeight: 500 }}
            >
              ainomiq.com/privacy
            </a>
          </p>
        </div>

        {/* Content */}
        <Section title="1. Introduction">
          <p>
            Ainomiq (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) provides
            AI-powered automation tools for e-commerce businesses. This Privacy
            Policy describes how we collect, use, and protect your information
            when you use our platform at{" "}
            <a href="https://app.ainomiq.com" style={{ color: "#3b82f6" }}>
              app.ainomiq.com
            </a>
            .
          </p>
          <p>
            Ainomiq is established in the Netherlands and operates in compliance
            with the General Data Protection Regulation (GDPR), the Dutch GDPR
            Implementation Act (UAVG) and other applicable privacy legislation.
          </p>
          <p>
            Data Controller: Ainomiq, established in the Netherlands. For
            questions, contact us at{" "}
            <a href="mailto:privacy@ainomiq.com" style={{ color: "#3b82f6" }}>
              privacy@ainomiq.com
            </a>
            .
          </p>
        </Section>

        <Section title="2. Data We Collect">
          <p className="font-medium" style={{ color: "#1a1a2e" }}>
            Data you provide to us
          </p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>
              <strong style={{ color: "#1a1a2e" }}>Account information:</strong>{" "}
              email, name, company name, and password provided during
              registration.
            </li>
            <li>
              <strong style={{ color: "#1a1a2e" }}>
                Integration credentials:
              </strong>{" "}
              OAuth tokens from connected platforms (Shopify, Klaviyo, Meta,
              Google). Encrypted and stored server-side only.
            </li>
            <li>
              <strong style={{ color: "#1a1a2e" }}>Communication:</strong>{" "}
              messages you send us via email, support forms, or the platform.
            </li>
          </ul>

          <p className="font-medium pt-3" style={{ color: "#1a1a2e" }}>
            Data collected through integrations
          </p>
          <div className="space-y-3 pt-1">
            <div
              className="rounded-xl p-4"
              style={{ border: "1px solid #e2e6ef" }}
            >
              <p className="font-medium text-sm" style={{ color: "#1a1a2e" }}>
                Shopify
              </p>
              <p className="text-sm mt-1">
                Store data, orders, products, and customer information for
                analytics and AI customer service automation.
              </p>
            </div>
            <div
              className="rounded-xl p-4"
              style={{ border: "1px solid #e2e6ef" }}
            >
              <p className="font-medium text-sm" style={{ color: "#1a1a2e" }}>
                Klaviyo
              </p>
              <p className="text-sm mt-1">
                Email campaigns, flows, segments, and subscriber data for email
                marketing analytics.
              </p>
            </div>
            <div
              className="rounded-xl p-4"
              style={{ border: "1px solid #e2e6ef" }}
            >
              <p className="font-medium text-sm" style={{ color: "#1a1a2e" }}>
                Meta (Facebook / Instagram)
              </p>
              <p className="text-sm mt-1">
                Ad accounts, campaigns, and performance data for advertising
                analytics.
              </p>
            </div>
            <div
              className="rounded-xl p-4"
              style={{ border: "1px solid #e2e6ef" }}
            >
              <p className="font-medium text-sm" style={{ color: "#1a1a2e" }}>
                Google (Analytics, Ads)
              </p>
              <p className="text-sm mt-1">
                Website analytics, ad campaigns, and performance data.
              </p>
            </div>
          </div>
          <p className="pt-2">
            Each integration uses OAuth 2.0 with the minimum required scopes. We
            only request read-only access unless explicitly stated otherwise.
          </p>

          <p className="font-medium pt-3" style={{ color: "#1a1a2e" }}>
            Data collected automatically
          </p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>
              <strong style={{ color: "#1a1a2e" }}>Usage data:</strong> pages
              visited, features used, timestamps, browser type, and IP address.
            </li>
            <li>
              <strong style={{ color: "#1a1a2e" }}>Cookies:</strong> essential
              cookies for authentication and session management only.
            </li>
          </ul>

          <p className="font-medium pt-3" style={{ color: "#1a1a2e" }}>
            Customer data processed on your behalf
          </p>
          <p>
            When you use our AI customer service features, we process your
            customers&apos; emails and support requests on your behalf. See
            Section 4 (Data Processing Role).
          </p>
          <p>
            We do <strong style={{ color: "#1a1a2e" }}>not</strong> collect
            passwords, payment card information, or personally identifiable
            customer data beyond what is necessary. We do{" "}
            <strong style={{ color: "#1a1a2e" }}>not</strong> use your data or
            your customers&apos; data to train AI models.
          </p>
        </Section>

        <Section title="3. How We Use Your Data">
          <ul className="list-disc pl-6 space-y-1.5">
            <li>
              To provide AI-powered analytics, recommendations, and automation.
            </li>
            <li>To display performance dashboards and reports.</li>
            <li>
              To operate AI customer service on your behalf (processing inbound
              emails, generating responses).
            </li>
            <li>
              To send automated alerts and reports about your connected
              platforms.
            </li>
            <li>To authenticate your identity and manage your account.</li>
            <li>To improve our platform and develop new features.</li>
            <li>To comply with legal obligations.</li>
          </ul>
          <p className="font-medium pt-2" style={{ color: "#1a1a2e" }}>
            We never sell, share, or distribute your data to third parties for
            their own purposes.
          </p>
        </Section>

        <Section title="4. Data Processing Role">
          <p>
            When we process your customers&apos; personal data (e.g., handling
            customer service emails on your behalf), we act as a{" "}
            <strong style={{ color: "#1a1a2e" }}>data processor</strong> under
            the GDPR. You remain the{" "}
            <strong style={{ color: "#1a1a2e" }}>data controller</strong>. A
            Data Processing Agreement (DPA) governs this relationship and is
            available upon request.
          </p>
        </Section>

        <Section title="5. Legal Basis for Processing">
          <ul className="list-disc pl-6 space-y-1.5">
            <li>
              <strong style={{ color: "#1a1a2e" }}>
                Performance of contract (Art. 6(1)(b) GDPR)
              </strong>{" "}
              - processing necessary to provide our platform services.
            </li>
            <li>
              <strong style={{ color: "#1a1a2e" }}>
                Legitimate interest (Art. 6(1)(f) GDPR)
              </strong>{" "}
              - analytics, security, and service improvement.
            </li>
            <li>
              <strong style={{ color: "#1a1a2e" }}>
                Consent (Art. 6(1)(a) GDPR)
              </strong>{" "}
              - where explicitly provided (e.g., marketing communications).
            </li>
            <li>
              <strong style={{ color: "#1a1a2e" }}>
                Legal obligation (Art. 6(1)(c) GDPR)
              </strong>{" "}
              - compliance with applicable laws.
            </li>
          </ul>
        </Section>

        <Section title="6. Third Parties and Sub-Processors">
          <div className="space-y-3">
            <div
              className="rounded-xl p-4"
              style={{ border: "1px solid #e2e6ef" }}
            >
              <p className="font-medium text-sm" style={{ color: "#1a1a2e" }}>
                Vercel - Hosting
              </p>
              <p className="text-sm mt-1">US-based; GDPR DPA in place.</p>
            </div>
            <div
              className="rounded-xl p-4"
              style={{ border: "1px solid #e2e6ef" }}
            >
              <p className="font-medium text-sm" style={{ color: "#1a1a2e" }}>
                Auth0 - Authentication
              </p>
              <p className="text-sm mt-1">US-based; GDPR DPA in place.</p>
            </div>
            <div
              className="rounded-xl p-4"
              style={{ border: "1px solid #e2e6ef" }}
            >
              <p className="font-medium text-sm" style={{ color: "#1a1a2e" }}>
                Turso - Database
              </p>
              <p className="text-sm mt-1">EU region.</p>
            </div>
            <div
              className="rounded-xl p-4"
              style={{ border: "1px solid #e2e6ef" }}
            >
              <p className="font-medium text-sm" style={{ color: "#1a1a2e" }}>
                Anthropic &amp; OpenAI - AI
              </p>
              <p className="text-sm mt-1">
                US-based; processing based on Standard Contractual Clauses.
              </p>
            </div>
            <div
              className="rounded-xl p-4"
              style={{ border: "1px solid #e2e6ef" }}
            >
              <p className="font-medium text-sm" style={{ color: "#1a1a2e" }}>
                Stripe - Payments
              </p>
              <p className="text-sm mt-1">US-based; GDPR DPA in place.</p>
            </div>
          </div>
          <p className="pt-2">
            We have entered into data processing agreements with all
            sub-processors. Personal data is not transferred outside the EEA
            without appropriate safeguards (Standard Contractual Clauses).
          </p>
        </Section>

        <Section title="7. Data Security">
          <ul className="list-disc pl-6 space-y-1.5">
            <li>All OAuth tokens are encrypted at rest.</li>
            <li>All data is transmitted over HTTPS/TLS.</li>
            <li>Access is restricted to authenticated users only.</li>
            <li>Access control based on the principle of least privilege.</li>
            <li>Regular security assessments.</li>
          </ul>
          <p className="pt-2">
            In the event of a data breach, we will notify you and the Dutch Data
            Protection Authority within 72 hours of discovery, in accordance
            with Articles 33 and 34 of the GDPR.
          </p>
        </Section>

        <Section title="8. Data Retention">
          <ul className="list-disc pl-6 space-y-1.5">
            <li>
              <strong style={{ color: "#1a1a2e" }}>Account data:</strong> for as
              long as your account is active.
            </li>
            <li>
              <strong style={{ color: "#1a1a2e" }}>OAuth tokens:</strong>{" "}
              deleted immediately when you disconnect an integration.
            </li>
            <li>
              <strong style={{ color: "#1a1a2e" }}>Customer data:</strong>{" "}
              deleted within 30 days after account deletion, unless retention is
              required by law.
            </li>
            <li>
              <strong style={{ color: "#1a1a2e" }}>Usage data:</strong> up to 26
              months, after which it is anonymized or deleted.
            </li>
          </ul>
        </Section>

        <Section title="9. Your Rights">
          <p>Under the GDPR, you have the following rights:</p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>
              <strong style={{ color: "#1a1a2e" }}>
                Right of access (Art. 15)
              </strong>{" "}
              - request information about your personal data.
            </li>
            <li>
              <strong style={{ color: "#1a1a2e" }}>
                Right to rectification (Art. 16)
              </strong>{" "}
              - request correction of inaccurate data.
            </li>
            <li>
              <strong style={{ color: "#1a1a2e" }}>
                Right to erasure (Art. 17)
              </strong>{" "}
              - request deletion of your personal data.
            </li>
            <li>
              <strong style={{ color: "#1a1a2e" }}>
                Right to restriction (Art. 18)
              </strong>{" "}
              - request restriction of processing.
            </li>
            <li>
              <strong style={{ color: "#1a1a2e" }}>
                Right to data portability (Art. 20)
              </strong>{" "}
              - receive your data in a machine-readable format.
            </li>
            <li>
              <strong style={{ color: "#1a1a2e" }}>
                Right to object (Art. 21)
              </strong>{" "}
              - object to processing based on legitimate interest.
            </li>
            <li>
              <strong style={{ color: "#1a1a2e" }}>
                Right to withdraw consent
              </strong>{" "}
              - withdraw consent at any time.
            </li>
            <li>
              <strong style={{ color: "#1a1a2e" }}>Revoke OAuth access</strong>{" "}
              - disconnect connected platforms at any time through your
              dashboard.
            </li>
          </ul>
          <p className="pt-2">
            Exercise your rights via{" "}
            <a href="mailto:privacy@ainomiq.com" style={{ color: "#3b82f6" }}>
              privacy@ainomiq.com
            </a>
            . We will respond within 30 days. You may also lodge a complaint
            with the{" "}
            <a
              href="https://autoriteitpersoonsgegevens.nl"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#3b82f6" }}
            >
              Dutch Data Protection Authority
            </a>
            .
          </p>
        </Section>

        <Section title="10. Data Deletion">
          <p>
            You can request deletion of all your data at any time by contacting
            us at{" "}
            <a href="mailto:privacy@ainomiq.com" style={{ color: "#3b82f6" }}>
              privacy@ainomiq.com
            </a>{" "}
            or through our{" "}
            <a href="/data-deletion" style={{ color: "#3b82f6" }}>
              data deletion page
            </a>
            . We will process your request within 30 days.
          </p>
        </Section>

        <Section title="11. Cookies">
          <p>
            We use essential cookies for authentication and session management
            only. We do not place tracking, advertising, or social media
            cookies.
          </p>
        </Section>

        <Section title="12. Children">
          <p>
            Our platform is not directed at individuals under the age of 16. We
            do not knowingly collect personal data from minors.
          </p>
        </Section>

        <Section title="13. Changes">
          <p>
            We may update this Privacy Policy from time to time. Material
            changes will be communicated via email or a notice within the
            platform, at least 30 days before taking effect.
          </p>
        </Section>

        <Section title="14. Contact">
          <p>
            <strong style={{ color: "#1a1a2e" }}>Ainomiq</strong>
            <br />
            Email:{" "}
            <a href="mailto:privacy@ainomiq.com" style={{ color: "#3b82f6" }}>
              privacy@ainomiq.com
            </a>
            <br />
            Website:{" "}
            <a href="https://ainomiq.com" style={{ color: "#3b82f6" }}>
              ainomiq.com
            </a>
          </p>
        </Section>

        {/* Footer */}
        <div
          className="mt-16 pt-8 text-center"
          style={{ borderTop: "1px solid #e2e6ef" }}
        >
          <span className="text-xs" style={{ color: "#6b7280" }}>
            &copy; {new Date().getFullYear()} Ainomiq. All rights reserved.
          </span>
        </div>
      </div>
    </div>
  );
}
