import Link from 'next/link';

export const metadata = { title: 'Terms of Service - Ainomiq' };

export default function TermsOfService() {
  return (
    <div style={{ background: '#f5f7fb', minHeight: '100vh' }}>
      <header style={{ padding: '24px 32px', borderBottom: '1px solid #e2e6ef' }}>
        <Link href="/login" style={{ textDecoration: 'none', fontSize: '20px', fontWeight: 700 }}>
          <span style={{ color: '#3b82f6' }}>ai</span>
          <span style={{ color: '#1a1a2e' }}>nomiq</span>
        </Link>
      </header>
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1a1a2e', marginBottom: '8px' }}>Terms of Service</h1>
        <p style={{ color: '#6b7280', marginBottom: '32px' }}>Last updated: March 6, 2026</p>

        <div style={{ color: '#374151', lineHeight: 1.7, fontSize: '15px' }}>
          <p>These Terms of Service ("Terms") govern your use of the Ainomiq platform at app.ainomiq.com (the "Service") operated by Ainomiq ("we", "us", "our").</p>

          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a2e', marginTop: '32px', marginBottom: '12px' }}>1. Acceptance of Terms</h2>
          <p>By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>

          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a2e', marginTop: '32px', marginBottom: '12px' }}>2. Description of Service</h2>
          <p>Ainomiq is an e-commerce dashboard platform that connects your existing tools (Shopify, Meta Ads, Klaviyo, Google Workspace) into a unified interface for stock management, ad monitoring, email marketing, and customer service.</p>

          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a2e', marginTop: '32px', marginBottom: '12px' }}>3. Account Registration</h2>
          <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the security of your account credentials. You must notify us immediately of any unauthorized use of your account.</p>

          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a2e', marginTop: '32px', marginBottom: '12px' }}>4. Integrations</h2>
          <p>The Service connects to third-party platforms through their official APIs. By connecting an integration, you authorize us to access your data on those platforms. You can revoke access at any time by disconnecting the integration in Settings.</p>
          <p>We are not responsible for the availability, accuracy, or functionality of third-party platforms.</p>

          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a2e', marginTop: '32px', marginBottom: '12px' }}>5. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul style={{ paddingLeft: '20px' }}>
            <li>Use the Service for any unlawful purpose</li>
            <li>Attempt to gain unauthorized access to other accounts or systems</li>
            <li>Interfere with or disrupt the Service</li>
            <li>Reverse engineer or attempt to extract the source code of the Service</li>
            <li>Share your account credentials with unauthorized parties</li>
          </ul>

          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a2e', marginTop: '32px', marginBottom: '12px' }}>6. Data and Privacy</h2>
          <p>Your use of the Service is also governed by our <Link href="/privacy-policy" style={{ color: '#3b82f6' }}>Privacy Policy</Link>. We take data protection seriously and encrypt all sensitive information.</p>

          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a2e', marginTop: '32px', marginBottom: '12px' }}>7. Availability</h2>
          <p>We strive to maintain high availability of the Service but do not guarantee uninterrupted access. We may perform maintenance or updates that temporarily affect availability.</p>

          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a2e', marginTop: '32px', marginBottom: '12px' }}>8. Limitation of Liability</h2>
          <p>The Service is provided "as is" without warranties of any kind. Ainomiq shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service. Our total liability shall not exceed the amount you paid for the Service in the 12 months prior to the claim.</p>

          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a2e', marginTop: '32px', marginBottom: '12px' }}>9. Termination</h2>
          <p>You may terminate your account at any time by contacting us. We may suspend or terminate your account if you violate these Terms. Upon termination, your data will be deleted within 30 days.</p>

          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a2e', marginTop: '32px', marginBottom: '12px' }}>10. Changes to Terms</h2>
          <p>We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the updated Terms.</p>

          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a2e', marginTop: '32px', marginBottom: '12px' }}>11. Governing Law</h2>
          <p>These Terms are governed by the laws of the Netherlands.</p>

          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a2e', marginTop: '32px', marginBottom: '12px' }}>12. Contact</h2>
          <p>For questions about these Terms, contact us at info@ainomiq.com.</p>
        </div>
      </main>
    </div>
  );
}
