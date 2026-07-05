'use client';

import { useEffect, useState } from 'react';
import { getSession, getSessionTenantId } from '../lib/session';
import { buildShopifyConnectHref } from '../lib/shopify-oauth';

const PLATFORM_LOGOS: Record<string, string> = {
  shopify: '/logos/shopify.svg',
  meta: '/logos/meta.svg',
  klaviyo: '/logos/klaviyo.webp',
  google: '/logos/google.svg',
};

interface ConnectGateProps {
  platform: 'shopify' | 'meta' | 'klaviyo' | 'google';
  platformName: string;
  description: string;
  icon?: string;
  children: React.ReactNode;
}

export default function ConnectGate({ platform, platformName, description, children }: ConnectGateProps) {
  const [status, setStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading');

  useEffect(() => {
    const session = getSession();
    if (!session) return;

    const tenantId = getSessionTenantId(session);
    fetch(`/api/auth/${platform}/status?tenant_id=${encodeURIComponent(tenantId)}`)
      .then(res => res.json())
      .then(data => setStatus(data.connected ? 'connected' : 'disconnected'))
      .catch(() => setStatus('disconnected'));
  }, [platform]);

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{
          width: 24, height: 24,
          border: '2px solid #d1d5db',
          borderTopColor: '#5b8def',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (status === 'disconnected') {
    return (
      <div className="glass rounded-2xl" style={{ padding: '60px 24px', textAlign: 'center', maxWidth: 480, margin: '40px auto' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: '#ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <img
            src={PLATFORM_LOGOS[platform]}
            alt={platformName}
            style={{ width: 44, height: 44, objectFit: 'contain' }}
          />
        </div>
        <h3 className="text-lg font-semibold" style={{ marginBottom: 8, color: '#1a1a2e' }}>
          Connect {platformName}
        </h3>
        <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: 1.6, marginBottom: 28 }}>
          {description}
        </p>
        <a
          href={
            platform === 'shopify'
              ? buildShopifyConnectHref({
                  tenantId: getSessionTenantId(getSession()),
                  returnTo: typeof window !== 'undefined' ? window.location.pathname : '/dashboard',
                })
              : `/api/auth/${platform}/connect?tenant_id=${encodeURIComponent(getSessionTenantId(getSession()))}`
          }
          className="btn-primary"
          style={{ textDecoration: 'none', display: 'inline-block', padding: '12px 32px', fontSize: '14px' }}
        >
          Connect {platformName}
        </a>
        <div style={{ marginTop: 16 }}>
          <a href="/dashboard/settings" style={{ color: '#6b7280', fontSize: '13px', textDecoration: 'none' }}>
            or manage integrations in Settings
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
