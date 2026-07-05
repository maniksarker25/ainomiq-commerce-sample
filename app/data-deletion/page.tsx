import Link from 'next/link';

export const metadata = { title: 'Data Deletion - Ainomiq' };

export default function DataDeletion() {
  return (
    <div style={{ background: '#f5f7fb', minHeight: '100vh' }}>
      <header style={{ padding: '24px 32px', borderBottom: '1px solid #e2e6ef' }}>
        <Link href="/login" style={{ textDecoration: 'none', fontSize: '20px', fontWeight: 700 }}>
          <span style={{ color: '#3b82f6' }}>ai</span>
          <span style={{ color: '#1a1a2e' }}>nomiq</span>
        </Link>
      </header>
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1a1a2e', marginBottom: '8px' }}>Data Deletion Instructions</h1>
        <p style={{ color: '#6b7280', marginBottom: '32px' }}>Last updated: March 19, 2026</p>

        <div style={{ color: '#374151', lineHeight: 1.7, fontSize: '15px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a2e', marginTop: '32px', marginBottom: '12px' }}>How to Request Data Deletion</h2>
          <p>If you would like to request the deletion of your personal data from Ainomiq, follow these steps:</p>
          <ol style={{ paddingLeft: '20px' }}>
            <li style={{ marginBottom: '8px' }}>Send an email to <strong>support@ainomiq.com</strong> with the subject line <strong>"Data Deletion Request"</strong></li>
            <li style={{ marginBottom: '8px' }}>Include your account email address and any relevant details</li>
            <li style={{ marginBottom: '8px' }}>We will process your request within 30 days and confirm deletion via email</li>
          </ol>

          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a2e', marginTop: '32px', marginBottom: '12px' }}>What Data We Delete</h2>
          <p>Upon request, we will permanently delete:</p>
          <ul style={{ paddingLeft: '20px' }}>
            <li>Your account information (name, email, company details)</li>
            <li>Connected platform credentials and tokens</li>
            <li>Customer service history and logs</li>
            <li>Dashboard configuration and preferences</li>
            <li>Any analytics data associated with your account</li>
          </ul>

          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a2e', marginTop: '32px', marginBottom: '12px' }}>What We May Retain</h2>
          <p>We may retain certain data as required by law, including:</p>
          <ul style={{ paddingLeft: '20px' }}>
            <li>Transaction records required for tax or legal compliance</li>
            <li>Data necessary to resolve disputes or enforce agreements</li>
          </ul>

          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a2e', marginTop: '32px', marginBottom: '12px' }}>Automatic Deletion</h2>
          <p>When you disconnect an integration through your Ainomiq dashboard, all associated platform tokens and cached data are immediately removed. When you delete your account, all data is permanently removed within 30 days.</p>

          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1a1a2e', marginTop: '32px', marginBottom: '12px' }}>Contact</h2>
          <p>For questions about data deletion, contact us at <a href="mailto:support@ainomiq.com" style={{ color: '#3b82f6' }}>support@ainomiq.com</a></p>
        </div>
      </main>
    </div>
  );
}
