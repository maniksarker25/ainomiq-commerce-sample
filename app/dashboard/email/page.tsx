'use client';

import { useState, useEffect, useCallback } from 'react';
import ConnectionStatus from '../../../components/ConnectionStatus';
import RefreshButton from '../../../components/RefreshButton';
import ChangeRequestModal from '../../../components/ChangeRequestModal';
import { fetchSession, getSession, type Session } from '../../../lib/session';
import AppSettingsPanel from '../../../components/AppSettingsPanel';

interface Flow {
  id: string;
  name: string;
  status: string;
  triggerType: string;
  created: string;
  updated: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  sendTime: string | null;
}

interface EmailStats {
  totalSubscribers: number;
  avgOpenRate: string;
  avgClickRate: string;
  activeFlows: number;
  totalFlows: number;
}

function GearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        color: '#6b7280',
        cursor: 'pointer',
        padding: '4px',
        borderRadius: '6px',
        display: 'flex',
        alignItems: 'center',
      }}
      title="Request changes"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    </button>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTriggerType(type: string): string {
  if (!type) return '-';
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function EmailPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changeModal, setChangeModal] = useState<{ section: string; fields: Array<{ label: string; placeholder: string; key: string; type?: 'text' | 'textarea' }> } | null>(null);
  const [session, setSession] = useState<Session | null>(() => getSession());

  const getTenantId = useCallback(async () => {
    const current = session || getSession() || await fetchSession();
    if (current && !session) setSession(current);
    return current?.tenantId || current?.email || '';
  }, [session]);

  const tenantIdForLinks = session?.tenantId || session?.email || '';

  const fetchFlows = useCallback(async () => {
    const tenantId = await getTenantId();
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/email/flows?tenant_id=${encodeURIComponent(tenantId)}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setFlows(data.flows || []);
      setError(null);
    } catch {
      setError('Failed to load flows');
    }
  }, [getTenantId]);

  const fetchCampaigns = useCallback(async () => {
    const tenantId = await getTenantId();
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/email/campaigns?tenant_id=${encodeURIComponent(tenantId)}`);
      const data = await res.json();
      if (!data.error) setCampaigns(data.campaigns || []);
    } catch {
      // Non-critical
    }
  }, [getTenantId]);

  const fetchStats = useCallback(async () => {
    const tenantId = await getTenantId();
    if (!tenantId) return;
    try {
      const res = await fetch(`/api/email/stats?tenant_id=${encodeURIComponent(tenantId)}`);
      const data = await res.json();
      if (!data.error) setStats(data);
    } catch {
      // Non-critical
    }
  }, [getTenantId]);

  useEffect(() => {
    Promise.all([fetchFlows(), fetchCampaigns(), fetchStats()]).finally(() => setLoading(false));
  }, [fetchFlows, fetchCampaigns, fetchStats]);

  const handleRefresh = useCallback(() => {
    fetchFlows();
    fetchCampaigns();
    fetchStats();
  }, [fetchFlows, fetchCampaigns, fetchStats]);

  return (
    <ConnectionStatus connections={[{platform:'klaviyo', required:true}]}>
      <div>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Email Marketing</h1>
            <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
              Flows, campaigns, and subscriber insights from Klaviyo
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GearButton onClick={() => setChangeModal({
              section: 'Email Marketing Settings',
              fields: [
                { label: 'New flow request', placeholder: 'e.g. Add a birthday flow', key: 'new_flow' },
                { label: 'Campaign request', placeholder: 'e.g. Schedule a monthly newsletter', key: 'campaign' },
                { label: 'Additional notes', placeholder: 'Any other changes...', key: 'notes', type: 'textarea' },
              ],
            })} />
            <RefreshButton onRefresh={handleRefresh} intervalMs={30000} />
          </div>
        </div>

        <AppSettingsPanel
          appName="Email Marketing"
          appKey="email"
          directory="/dashboard/email"
          setupHref="/dashboard/email/flows"
          integrations={[{ provider: 'klaviyo', label: 'Klaviyo', required: true, href: `/api/auth/klaviyo/connect?tenant_id=${encodeURIComponent(tenantIdForLinks)}` }]}
          settingsName="Email settings"
          description="Email keeps its own flow, campaign, revenue, and sending preferences for this workspace."
        />

        {error && (
          <div className="glass rounded-2xl mb-6" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#ef4444', fontSize: '14px' }}>{error}</span>
            {error.includes('reconnect') || error.includes('401') ? (
              <a href={`/api/auth/klaviyo/connect?tenant_id=${encodeURIComponent(tenantIdForLinks)}`} className="btn-primary" style={{ textDecoration: 'none', padding: '8px 16px', fontSize: '13px' }}>
                Reconnect Klaviyo
              </a>
            ) : (
              <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '18px' }}>x</button>
            )}
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Subscribers', value: loading ? '-' : (stats?.totalSubscribers?.toLocaleString() || '0') },
            { label: 'Active Flows', value: loading ? '-' : String(stats?.activeFlows ?? 0) },
            { label: 'Avg Open Rate', value: loading ? '-' : ((parseFloat(stats?.avgOpenRate || '0') > 0) ? stats?.avgOpenRate + '%' : 'N/A') },
            { label: 'Avg Click Rate', value: loading ? '-' : ((parseFloat(stats?.avgClickRate || '0') > 0) ? stats?.avgClickRate + '%' : 'N/A') },
          ].map((kpi, i) => (
            <div key={i} className="kpi-card">
              <div className="label">{kpi.label}</div>
              <div className="value">{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Flows */}
        <div className="glass rounded-2xl p-6 mb-6">
          <h3 className="text-gray-900 font-semibold mb-4">Flows</h3>
          {loading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ width: 24, height: 24, border: '2px solid #d1d5db', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.6s linear infinite', margin: '0 auto' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '16px' }}>Loading flows from Klaviyo...</p>
            </div>
          ) : flows.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>No flows found</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th>Flow</th>
                    <th>Status</th>
                    <th>Trigger Type</th>
                    <th>Created</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {flows.map((flow) => (
                    <tr key={flow.id}>
                      <td style={{ fontWeight: 500, color: '#1a1a2e' }}>{flow.name}</td>
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 500,
                          background: flow.status === 'live' ? '#dcfce7' : flow.status === 'draft' ? '#f3f4f6' : '#fef9c3',
                          color: flow.status === 'live' ? '#16a34a' : flow.status === 'draft' ? '#6b7280' : '#ca8a04',
                        }}>
                          {flow.status === 'live' ? 'Active' : flow.status.charAt(0).toUpperCase() + flow.status.slice(1)}
                        </span>
                      </td>
                      <td style={{ color: '#6b7280' }}>{formatTriggerType(flow.triggerType)}</td>
                      <td style={{ color: '#6b7280' }}>{formatDate(flow.created)}</td>
                      <td style={{ color: '#6b7280' }}>{formatDate(flow.updated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Campaigns */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-gray-900 font-semibold mb-4">Recent Campaigns</h3>
          {loading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ width: 24, height: 24, border: '2px solid #d1d5db', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.6s linear infinite', margin: '0 auto' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          ) : campaigns.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>No campaigns found</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Status</th>
                    <th>Send Date</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.slice(0, 15).map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500, color: '#1a1a2e' }}>{c.name}</td>
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 500,
                          background: c.status === 'sent' ? '#dcfce7' : c.status === 'draft' ? '#f3f4f6' : '#e0f2fe',
                          color: c.status === 'sent' ? '#16a34a' : c.status === 'draft' ? '#6b7280' : '#0284c7',
                        }}>
                          {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                        </span>
                      </td>
                      <td style={{ color: '#6b7280' }}>{formatDate(c.sendTime)}</td>
                      <td style={{ color: '#6b7280' }}>{formatDate(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {changeModal && (
        <ChangeRequestModal
          section={changeModal.section}
          fields={changeModal.fields}
          onClose={() => setChangeModal(null)}
        />
      )}
    </ConnectionStatus>
  );
}
