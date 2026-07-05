'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchSession, type Session } from '../../lib/session';
import RefreshButton from '../../components/RefreshButton';

interface OverviewData {
  performance: any;
  stock: any;
  cs: any;
  ads: any;
}

function formatEUR(n: number): string {
  return `EUR ${n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ChangeIndicator({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span style={{ fontSize: '12px', fontWeight: 600, color: positive ? '#16a34a' : '#ef4444' }}>
      {positive ? '+' : ''}{value.toFixed(1)}%
    </span>
  );
}

function MiniCard({ label, value, change, prefix }: { label: string; value: string | number; change?: number; prefix?: string }) {
  const isZero = value === 'EUR 0,00' || value === '0.00x' || value === 0 || value === 'EUR 0.00';
  return (
    <div className="glass rounded-xl p-4" style={{ border: '1px solid #e5e7eb', opacity: isZero ? 0.5 : 1 }}>
      <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a2e', lineHeight: 1.2 }}>{prefix}{value}</div>
      {change !== undefined && change !== 0 && <ChangeIndicator value={change} />}
    </div>
  );
}

export default function DashboardOverview() {
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [platforms, setPlatforms] = useState<Record<string, boolean>>({});
  const enabledModules = new Set((session?.modules || []).filter(m => ['performance', 'stock', 'cs', 'instagram'].includes(m)));
  const hasPerformance = true;
  const hasStock = enabledModules.has('stock');
  const hasCS = enabledModules.has('cs');

  const fetchData = useCallback(async () => {
    const tenantId = session?.email;
    if (!tenantId) {
      setLoading(false);
      return;
    }

    try {
      const [perfRes, stockRes, csStatsRes, csEmailsRes, adsRes] = await Promise.all([
        hasPerformance ? fetch(`/api/performance/summary?tenant_id=${encodeURIComponent(tenantId)}&days=7`).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
        hasStock ? fetch(`/api/stock/stats?tenant_id=${encodeURIComponent(tenantId)}`).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
        hasCS ? fetch(`/api/cs/stats?tenant_id=${encodeURIComponent(tenantId)}&days=7&_t=${Date.now()}`).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
        hasCS ? fetch(`/api/cs/emails?tenant_id=${encodeURIComponent(tenantId)}&days=7&_t=${Date.now()}`).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
        hasPerformance ? fetch(`/api/ads/summary?tenant_id=${encodeURIComponent(tenantId)}&days=7`).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
      ]);
      const csRes = csStatsRes ? { stats: csStatsRes, emails: csEmailsRes?.emails || [] } : null;

      setData({
        performance: perfRes,
        stock: stockRes,
        cs: csRes,
        ads: adsRes,
      });

      // Platform statuses from real account data only.
      const p: Record<string, boolean> = {};
      if (perfRes?.platforms) {
        Object.entries(perfRes.platforms).forEach(([k, v]: [string, any]) => {
          p[k] = v.connected || false;
        });
      }
      const integrations = await fetch(`/api/integrations?tenant_id=${encodeURIComponent(tenantId)}&_t=${Date.now()}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
      (integrations?.integrations || []).forEach((integration: { provider: string }) => {
        p[integration.provider] = true;
      });
      setPlatforms(p);
    } catch (err) {
      console.error('[Overview] Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.email, hasPerformance, hasStock, hasCS]);

  useEffect(() => {
    fetchSession().then(fresh => {
      setSession(fresh);
    });
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #e5e7eb', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  const perf = data?.performance;
  const stock = data?.stock;
  const cs = data?.cs;
  const ads = data?.ads;

  // Count connected platforms
  const connectedCount = Object.values(platforms).filter(Boolean).length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
            Welcome back, {session?.name}
          </p>
        </div>
        <RefreshButton onRefresh={() => { setLoading(true); fetchData(); }} intervalMs={0} />
      </div>

      {connectedCount === 0 && (
        <div className="glass rounded-2xl p-8 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Connect your platforms to get started</h2>
        <p className="text-gray-700 mb-6">Connect Shopify, Meta Ads, Klaviyo, and Google to unlock dashboard insights.</p>
          <a href="/dashboard/settings" className="inline-block px-5 py-2.5 bg-[#3b82f6] text-white font-medium rounded-lg hover:bg-[#2563eb] transition">Go to Settings</a>
        </div>
      )}
      {connectedCount > 0 && perf && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <MiniCard label="Revenue (7d)" value={formatEUR(perf.revenue?.total || 0)} change={perf.revenue?.total ? perf.revenue?.change : undefined} />
          <MiniCard label="Ad Spend (7d)" value={formatEUR(perf.adSpend?.total || 0)} change={perf.adSpend?.total ? perf.adSpend?.change : undefined} />
          <MiniCard label="Net Profit" value={formatEUR(perf.netProfit?.total || 0)} change={perf.netProfit?.total ? perf.netProfit?.change : undefined} />
          <MiniCard label="Blended ROAS" value={`${(perf.blendedROAS?.value || 0).toFixed(2)}x`} change={perf.blendedROAS?.value ? perf.blendedROAS?.change : undefined} />
          <MiniCard label="Orders" value={perf.orders?.total || 0} change={perf.orders?.total ? perf.orders?.change : undefined} />
          <MiniCard label="AOV" value={formatEUR(perf.aov?.value || 0)} change={perf.aov?.value ? perf.aov?.change : undefined} />
          <MiniCard label="CAC" value={formatEUR(perf.cac?.value || 0)} change={perf.cac?.value ? perf.cac?.change : undefined} />
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Ad Performance Quick View */}
        {hasPerformance && ads && (
          <div className="glass rounded-2xl p-6" style={{ border: '1px solid #e5e7eb' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Ad Performance</h2>
              <a href="/dashboard/ads" style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>View all</a>
            </div>
            {ads.ads ? (
              <div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a2e' }}>{formatEUR(ads.totalSpend || 0)}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>Total Spend</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a2e' }}>{(ads.roas || 0).toFixed(2)}x</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>ROAS</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a2e' }}>{ads.purchases || 0}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>Purchases</div>
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  Top performing: <strong style={{ color: '#1a1a2e' }}>{ads.ads?.[0]?.name || 'N/A'}</strong>
                  {ads.ads?.[0]?.roas && <span> ({ads.ads[0].roas.toFixed(2)}x ROAS)</span>}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#6b7280', fontSize: '14px' }}>
                Connect Meta Ads to see performance
              </div>
            )}
          </div>
        )}

        {/* Intelli Support Quick View */}
        {hasCS && <div className="glass rounded-2xl p-6" style={{ border: '1px solid #e5e7eb' }}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Intelli Support</h2>
            <a href="/dashboard/cs" style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>View all</a>
          </div>
          {cs?.stats ? (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a2e' }}>{cs.stats.received ?? 0}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>Received (7d)</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#1a1a2e' }}>{cs.stats.handled ?? 0}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>Handled</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: cs.stats.escalated > 0 ? '#ea580c' : '#16a34a' }}>{cs.stats.escalated ?? 0}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280' }}>Escalated</div>
                </div>
              </div>
              {cs.emails?.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', marginBottom: '8px' }}>Recent emails</div>
                  {cs.emails.slice(0, 3).map((e: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < 2 ? '1px solid #f0f2f5' : 'none' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.subject || '(no subject)'}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>{e.from?.split('<')[0]?.trim() || ''}</div>
                      </div>
                      <span style={{
                        fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '4px', flexShrink: 0, marginLeft: '8px',
                        background: e.isUnread ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.1)',
                        color: e.isUnread ? '#ca8a04' : '#16a34a'
                      }}>{e.isUnread ? 'Pending' : 'Handled'}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#6b7280', fontSize: '14px' }}>
              Connect Google to see CS data
            </div>
          )}
        </div>}
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Stock Summary */}
        {hasStock && stock && (
          <div className="glass rounded-2xl p-6" style={{ border: '1px solid #e5e7eb' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Inventory</h2>
              <a href="/dashboard/stock" style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>View all</a>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a2e' }}>{stock.totalProducts || 0}</div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>Products</div>
              </div>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a2e' }}>{(stock.totalInventory || 0).toLocaleString()}</div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>Total Units</div>
              </div>
            </div>
            {stock.lowStockCount > 0 && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#ef4444', marginBottom: '6px' }}>Low Stock Alerts</div>
                <div style={{ fontSize: '12px', color: '#4b5563' }}>{stock.lowStockCount} products low on stock</div>
              </div>
            )}
          </div>
        )}

        {/* Performance Summary */}
        {hasPerformance && perf && (
          <div className="glass rounded-2xl p-6" style={{ border: '1px solid #e5e7eb' }}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Performance</h2>
              <a href="/dashboard/performance" style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>View all</a>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a2e' }}>{formatEUR(perf.revenue?.total || 0)}</div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>Revenue (7d)</div>
              </div>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a2e' }}>{formatEUR(perf.netProfit?.total || 0)}</div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>Net Profit</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a2e' }}>{(perf.blendedROAS?.value || 0).toFixed(2)}x</div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>Blended ROAS</div>
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a2e' }}>{formatEUR(perf.cac?.value || 0)}</div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>CAC</div>
              </div>
            </div>
          </div>
        )}

        {/* Platform Connections */}
        <div className="glass rounded-2xl p-6" style={{ border: '1px solid #e5e7eb' }}>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Connections</h2>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a2e' }}>{connectedCount}/6</div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>Platforms connected</div>
          </div>
          <div className="space-y-2">
            {[
              { id: 'shopify', name: 'Shopify', logo: '/logos/shopify.svg', type: 'img' },
              { id: 'meta', name: 'Meta Ads', logo: '/logos/meta.svg', type: 'img' },
              { id: 'instagram', name: 'Instagram', logo: '', type: 'instagram' },
              { id: 'facebook', name: 'Facebook', logo: '', type: 'facebook' },
              { id: 'klaviyo', name: 'Klaviyo', logo: '/logos/klaviyo.webp', type: 'img' },
              { id: 'google', name: 'Google', logo: '/logos/google.svg', type: 'img' },
            ].map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {p.type === 'instagram' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><defs><linearGradient id="ig" x1="0" y1="24" x2="24" y2="0"><stop stopColor="#FD5"/><stop offset=".5" stopColor="#E1306C"/><stop offset="1" stopColor="#833AB4"/></linearGradient></defs><rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig)" strokeWidth="2"/><circle cx="12" cy="12" r="5" stroke="url(#ig)" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.5" fill="url(#ig)"/></svg>
                  ) : p.type === 'facebook' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.312 0 2.686.234 2.686.234v2.953H15.83c-1.491 0-1.956.925-1.956 1.875V12h3.328l-.532 3.469h-2.796v8.385C19.612 22.954 24 17.99 24 12z"/></svg>
                  ) : (
                    <img src={p.logo} alt={p.name} style={{ width: 18, height: 18, objectFit: 'contain' }} />
                  )}
                  <span style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a2e' }}>{p.name}</span>
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '6px',
                  background: platforms[p.id] ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  color: platforms[p.id] ? '#16a34a' : '#ef4444',
                }}>
                  {platforms[p.id] ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            ))}
          </div>
          <a href="/dashboard/settings" style={{ display: 'block', marginTop: '16px', fontSize: '13px', color: '#3b82f6', textDecoration: 'none', fontWeight: 500 }}>
            Manage connections
          </a>
        </div>
      </div>

      {/* Profit Breakdown Bar */}
      {connectedCount > 0 && perf && (
        <div className="glass rounded-2xl p-6 mb-6" style={{ border: '1px solid #e5e7eb' }}>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Profit Breakdown (7d)</h2>
          {perf.revenue?.total ? (
            <>
              <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: '16px' }}>
                {[
                  { label: 'Net Profit', value: perf.netProfit?.total || 0, color: (perf.netProfit?.total || 0) >= 0 ? '#16a34a' : '#ef4444' },
                  { label: 'COGS', value: perf.cogs?.total || 0, color: '#ef4444' },
                  { label: 'Shipping', value: perf.shipping?.total || 0, color: '#f59e0b' },
                  { label: 'Gateway', value: perf.gatewayFees?.total || 0, color: '#8b5cf6' },
                  { label: 'Ad Spend', value: perf.adSpend?.total || 0, color: '#3b82f6' },
                ].map((item, i) => {
                  const total = perf.revenue.total;
                  const pct = total > 0 ? (item.value / total) * 100 : 0;
                  return <div key={i} style={{ width: `${pct}%`, background: item.color, minWidth: pct > 0 ? '2px' : '0' }} title={`${item.label}: ${formatEUR(item.value)}`} />;
                })}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                {[
                  { label: 'Revenue', value: perf.revenue.total, color: '#1a1a2e' },
                  { label: 'Net Profit', value: perf.netProfit?.total || 0, color: (perf.netProfit?.total || 0) >= 0 ? '#16a34a' : '#ef4444' },
                  { label: 'COGS', value: perf.cogs?.total || 0, color: '#ef4444' },
                  { label: 'Ad Spend', value: perf.adSpend?.total || 0, color: '#3b82f6' },
                  { label: 'Margin', value: 0, color: '#6b7280', pct: perf.grossMargin?.value },
                ].map((item, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>{item.label}</span>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: item.color }}>
                      {item.pct !== undefined ? `${item.pct.toFixed(1)}%` : formatEUR(item.value)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#6b7280', fontSize: '14px' }}>
              No revenue data available
            </div>
          )}
        </div>
      )}

      
    </div>
  );
}
