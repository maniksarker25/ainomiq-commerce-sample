'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchSession, getSession, type Session } from '../../../../lib/session';
import ConnectionStatus from '../../../../components/ConnectionStatus';

// ─── Rich Flow Configuration ────────────────────────────────────

interface FlowConfig {
  title: string;
  subtitle: string;
  description: string;
  triggerEvent: string | null; // null = list-based
  cooldownHours: number;
  timeDelays: string[];
  filters: string[];
  badge?: string;
}

const FLOW_CONFIG: Record<string, FlowConfig> = {
  'Project Accepted Flow': {
    title: 'Client Onboarding',
    subtitle: 'Fires when a new client signs on',
    description: 'Welcomes the client, sets expectations, and starts the onboarding journey.',
    triggerEvent: 'Project Accepted',
    cooldownHours: 24,
    timeDelays: ['Email 1: Immediate - welcome + next steps', 'Email 2: Day 3 - check-in', 'Email 3: Day 7 - progress update'],
    filters: ['24h cooldown per contact', 'Skip if already received in last 24h'],
    badge: 'Critical',
  },
  'Project Completed Flow': {
    title: 'Project Delivery',
    subtitle: 'Fires when a project is marked complete',
    description: 'Celebrates the delivery, asks for a review, and presents upsell opportunities.',
    triggerEvent: 'Project Completed',
    cooldownHours: 24,
    timeDelays: ['Email 1: Immediate - delivery confirmation', 'Email 2: Day 2 - review request', 'Email 3: Day 7 - upsell'],
    filters: ['24h cooldown per contact'],
    badge: 'Revenue',
  },
  'Project Payment Confirmed Flow': {
    title: 'Payment Confirmation',
    subtitle: 'Fires when payment clears',
    description: 'Confirms receipt of payment and provides invoice/receipt details.',
    triggerEvent: 'Project Payment Confirmed',
    cooldownHours: 1,
    timeDelays: ['Email 1: Immediate - payment receipt'],
    filters: ['1h cooldown (allows retries)', 'Idempotent - safe to fire again after 1h'],
    badge: 'Critical',
  },
  'Form Submitted - Price Shock Nurture': {
    title: 'Lead Nurture - Price Objection',
    subtitle: 'Fires when someone fills the lead form but doesnt buy',
    description: 'Nurtures leads who saw the price and hesitated. Addresses objections over 7 days.',
    triggerEvent: 'Form Submitted',
    cooldownHours: 48,
    timeDelays: ['Email 1: Immediate - acknowledge interest', 'Email 2: Day 2 - social proof', 'Email 3: Day 5 - ROI breakdown', 'Email 4: Day 7 - final nudge'],
    filters: ['48h cooldown - no spam', 'Skip if already paying client'],
    badge: 'Lead nurture',
  },
  'Custom Solution Submitted - Not Paid': {
    title: 'Custom Solution - Follow-up',
    subtitle: 'Fires when the custom form is filled but payment not received',
    description: 'Follows up on custom solution requests to convert leads who expressed interest.',
    triggerEvent: 'Custom Solution Form Submitted',
    cooldownHours: 48,
    timeDelays: ['Email 1: Immediate - confirm receipt', 'Email 2: Day 2 - next steps', 'Email 3: Day 5 - check-in'],
    filters: ['48h cooldown per contact', 'Stops automatically when payment received'],
    badge: 'Lead nurture',
  },
  'Custom Solution Submitted - Paid': {
    title: 'Custom Solution - Onboarding',
    subtitle: 'Fires when custom solution payment is confirmed',
    description: 'Kicks off onboarding for custom solution clients with timeline and deliverables.',
    triggerEvent: 'Custom Solution Payment Received',
    cooldownHours: 1,
    timeDelays: ['Email 1: Immediate - payment confirmed + kickoff', 'Email 2: Day 1 - onboarding checklist'],
    filters: ['1h cooldown (retry-safe)', 'Cancels Not Paid flow automatically'],
    badge: 'Critical',
  },
  'Newsletter Welcome Flow': {
    title: 'Newsletter Welcome',
    subtitle: 'Fires when someone subscribes to the newsletter',
    description: 'Welcomes new subscribers and introduces Ainomiq services over 5 days.',
    triggerEvent: null,
    cooldownHours: 0,
    timeDelays: ['Email 1: Immediate - welcome', 'Email 2: Day 3 - services overview', 'Email 3: Day 7 - case study'],
    filters: ['List-based trigger - no event needed', 'Klaviyo handles deduplication'],
    badge: 'Lead nurture',
  },
};

// Derive event map from config
const FLOW_EVENT_MAP: Record<string, string | null> = {};
for (const [flowName, config] of Object.entries(FLOW_CONFIG)) {
  FLOW_EVENT_MAP[flowName] = config.triggerEvent;
}

// ─── Types ──────────────────────────────────────────────────────

interface Flow {
  id: string;
  name: string;
  status: string;
  triggerType: string;
  created: string;
  updated: string;
}

interface EventFormState {
  flowName: string;
  eventName: string;
  email: string;
  firstName: string;
  lastName: string;
  projectName: string;
  projectValue: string;
}

// ─── Badge Components ───────────────────────────────────────────

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  Critical: { bg: '#fee2e2', text: '#dc2626' },
  Revenue: { bg: '#dcfce7', text: '#16a34a' },
  'Lead nurture': { bg: '#dbeafe', text: '#1d4ed8' },
};

function FlowBadge({ label }: { label: string }) {
  const color = BADGE_COLORS[label] || { bg: '#f3f4f6', text: '#6b7280' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, background: color.bg, color: color.text,
      textTransform: 'uppercase', letterSpacing: '0.03em',
    }}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'live'
      ? { bg: '#dcfce7', text: '#16a34a' }
      : status === 'draft'
      ? { bg: '#f3f4f6', text: '#6b7280' }
      : { bg: '#fef9c3', text: '#ca8a04' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 20,
      fontSize: 12, fontWeight: 600, background: color.bg, color: color.text,
    }}>
      {status === 'live' ? 'Active' : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function DuplicateGuardIndicator() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, color: '#16a34a', fontWeight: 600,
    }}>
      <span style={{ fontSize: 12 }}>&#10003;</span>
      Guard
    </span>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function formatDate(d: string) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Flow Detail Panel ──────────────────────────────────────────

function FlowDetailPanel({ config }: { config: FlowConfig }) {
  return (
    <div style={{
      padding: '16px 20px', background: '#f9fafb', borderTop: '1px solid #e5e7eb',
    }}>
      <p style={{ fontSize: 13, color: '#374151', marginBottom: 14, lineHeight: 1.5 }}>{config.description}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Timeline */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Email Timeline ({config.timeDelays.length} email{config.timeDelays.length !== 1 ? 's' : ''})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {config.timeDelays.map((delay, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{
                  minWidth: 20, height: 20, borderRadius: '50%', background: '#3b82f6',
                  color: '#fff', fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
                }}>
                  {i + 1}
                </span>
                <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.4 }}>{delay}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Filters &amp; Guards
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {config.filters.map((filter, i) => (
              <li key={i} style={{ fontSize: 12, color: '#374151', lineHeight: 1.4 }}>{filter}</li>
            ))}
          </ul>
          {config.cooldownHours > 0 && (
            <div style={{
              marginTop: 10, padding: '6px 10px', borderRadius: 8,
              background: '#dcfce7', fontSize: 11, color: '#16a34a', fontWeight: 600,
            }}>
              Duplicate guard: {config.cooldownHours}h cooldown active
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

export default function KlaviyoFlowsPage() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null);

  // Event fire modal
  const [modal, setModal] = useState<EventFormState | null>(null);
  const [firing, setFiring] = useState(false);
  const [fireResult, setFireResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [session, setSession] = useState<Session | null>(() => getSession());

  const getTenantId = useCallback(async () => {
    const current = session || getSession() || await fetchSession();
    if (current && !session) setSession(current);
    return current?.tenantId || current?.email || '';
  }, [session]);

  const fetchFlows = useCallback(async () => {
    const tenantId = await getTenantId();
    if (!tenantId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/email/flows?tenant_id=${encodeURIComponent(tenantId)}`);
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setFlows(data.flows || []);
      setError(null);
    } catch {
      setError('Failed to load flows');
    } finally {
      setLoading(false);
    }
  }, [getTenantId]);

  useEffect(() => { fetchFlows(); }, [fetchFlows]);

  const openModal = (flowName: string) => {
    const config = FLOW_CONFIG[flowName];
    const eventName = config?.triggerEvent;
    if (!eventName) return;
    setFireResult(null);
    setModal({
      flowName,
      eventName,
      email: '',
      firstName: '',
      lastName: '',
      projectName: '',
      projectValue: '',
    });
  };

  const fireEvent = async () => {
    if (!modal) return;
    setFiring(true);
    setFireResult(null);
    try {
      const tenantId = await getTenantId();
      if (!tenantId) { setFireResult({ ok: false, msg: 'Session expired. Please sign in again.' }); return; }
      const res = await fetch(`/api/klaviyo/track?tenant_id=${encodeURIComponent(tenantId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventName: modal.eventName,
          profile: {
            email: modal.email,
            firstName: modal.firstName || undefined,
            lastName: modal.lastName || undefined,
          },
          properties: {
            ...(modal.projectName && { projectName: modal.projectName }),
            source: 'ainomiq-dashboard',
          },
          value: modal.projectValue ? parseFloat(modal.projectValue) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFireResult({ ok: true, msg: `Event "${modal.eventName}" sent to Klaviyo. Flow will trigger shortly.` });
      } else if (data.error === 'duplicate') {
        setFireResult({ ok: false, msg: data.message || 'Duplicate event blocked by cooldown guard.' });
      } else {
        setFireResult({ ok: false, msg: data.error || 'Unknown error' });
      }
    } catch {
      setFireResult({ ok: false, msg: 'Network error' });
    } finally {
      setFiring(false);
    }
  };

  // ─── KPI calculations ──────────────────────────────────────────

  // Merge Klaviyo flows with FLOW_CONFIG for display
  const allFlowNames = new Set([
    ...flows.map(f => f.name),
    ...Object.keys(FLOW_CONFIG),
  ]);

  const displayFlows = Array.from(allFlowNames).map(name => {
    const apiFlow = flows.find(f => f.name === name);
    const config = FLOW_CONFIG[name];
    return { name, apiFlow, config };
  });

  const activeCount = displayFlows.filter(f => f.apiFlow?.status === 'live').length;
  const guardedCount = displayFlows.filter(f => f.config && f.config.cooldownHours > 0).length;
  const avgDelays = displayFlows.length > 0
    ? (displayFlows.reduce((sum, f) => sum + (f.config?.timeDelays.length || 0), 0) / displayFlows.length).toFixed(1)
    : '0';

  // ─── Modal cooldown warning ─────────────────────────────────

  const modalConfig = modal ? FLOW_CONFIG[modal.flowName] : null;
  const modalCooldown = modalConfig?.cooldownHours || 0;

  return (
    <ConnectionStatus connections={[{ platform: 'klaviyo', required: true }]}>
      <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Klaviyo Flows</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>
            Manage flow triggers, time delays, and duplicate guards from your dashboard
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Flows', value: loading ? '-' : String(displayFlows.length) },
            { label: 'Active', value: loading ? '-' : String(activeCount) },
            { label: 'With Duplicate Guard', value: loading ? '-' : String(guardedCount) },
            { label: 'Avg Delays / Flow', value: loading ? '-' : avgDelays },
          ].map((kpi, i) => (
            <div key={i} className="kpi-card">
              <div className="label">{kpi.label}</div>
              <div className="value">{kpi.value}</div>
            </div>
          ))}
        </div>

        {error && (
          <div className="glass rounded-2xl mb-6" style={{ padding: '16px 20px', background: '#fef2f2', border: '1px solid #fecaca' }}>
            <span style={{ color: '#ef4444', fontSize: 14 }}>{error}</span>
          </div>
        )}

        {/* Flows table */}
        <div className="glass rounded-2xl p-6 mb-6">
          <h3 className="text-gray-900 font-semibold mb-4">All Flows</h3>
          {loading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ width: 24, height: 24, border: '2px solid #d1d5db', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.6s linear infinite', margin: '0 auto' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              <p style={{ color: '#6b7280', fontSize: 14, marginTop: 16 }}>Loading flows...</p>
            </div>
          ) : displayFlows.length === 0 ? (
            <p style={{ color: '#6b7280', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>No flows found</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '2.5fr 1fr 1.2fr 0.8fr 1fr 0.8fr',
                padding: '10px 16px', borderBottom: '2px solid #e5e7eb',
                fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                <div>Flow</div>
                <div>Status</div>
                <div>Trigger Event</div>
                <div>Delays</div>
                <div>Guard</div>
                <div>Action</div>
              </div>

              {/* Table rows */}
              {displayFlows.map(({ name, apiFlow, config }) => {
                const isExpanded = expandedFlow === name;
                const eventName = config?.triggerEvent;
                const isLinked = eventName !== undefined && eventName !== null;

                return (
                  <div key={name} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    {/* Row */}
                    <div
                      style={{
                        display: 'grid', gridTemplateColumns: '2.5fr 1fr 1.2fr 0.8fr 1fr 0.8fr',
                        padding: '14px 16px', alignItems: 'center',
                        cursor: config ? 'pointer' : 'default',
                        background: isExpanded ? '#f9fafb' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onClick={() => config && setExpandedFlow(isExpanded ? null : name)}
                    >
                      {/* Title + subtitle + badge */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e' }}>
                            {config?.title || name}
                          </span>
                          {config?.badge && <FlowBadge label={config.badge} />}
                          {config && (
                            <span style={{
                              fontSize: 10, color: '#9ca3af', transition: 'transform 0.15s',
                              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block',
                            }}>
                              &#9654;
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>
                          {config?.subtitle || name}
                        </span>
                      </div>

                      {/* Status */}
                      <div>
                        {apiFlow ? (
                          <StatusBadge status={apiFlow.status} />
                        ) : (
                          <span style={{ fontSize: 12, color: '#9ca3af' }}>Not found in Klaviyo</span>
                        )}
                      </div>

                      {/* Trigger event */}
                      <div style={{ fontSize: 12, color: '#374151' }}>
                        {isLinked ? (
                          <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#f3f4f6', padding: '2px 8px', borderRadius: 6 }}>
                            {eventName}
                          </span>
                        ) : config?.triggerEvent === null ? (
                          <span style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>List-based</span>
                        ) : (
                          <span style={{ color: '#d1d5db' }}>-</span>
                        )}
                      </div>

                      {/* Delays count */}
                      <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                        {config ? `${config.timeDelays.length}` : '-'}
                      </div>

                      {/* Duplicate guard */}
                      <div>
                        {config && config.cooldownHours > 0 ? (
                          <DuplicateGuardIndicator />
                        ) : config?.cooldownHours === 0 ? (
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>N/A</span>
                        ) : (
                          <span style={{ color: '#d1d5db' }}>-</span>
                        )}
                      </div>

                      {/* Action */}
                      <div>
                        {isLinked ? (
                          <button
                            onClick={e => { e.stopPropagation(); openModal(name); }}
                            style={{
                              padding: '6px 14px', borderRadius: 8, background: '#3b82f6',
                              color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            Fire Event
                          </button>
                        ) : (
                          <span style={{ color: '#d1d5db', fontSize: 12 }}>-</span>
                        )}
                      </div>
                    </div>

                    {/* Expandable detail panel */}
                    {isExpanded && config && <FlowDetailPanel config={config} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="glass rounded-2xl p-6">
          <h3 className="text-gray-900 font-semibold mb-4">How Event Linking Works</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {Object.entries(FLOW_CONFIG).filter(([, c]) => c.triggerEvent).map(([flowName, config]) => (
              <div key={flowName} style={{ padding: '14px 16px', background: 'rgba(59,130,246,0.06)', borderRadius: 12, border: '1px solid rgba(59,130,246,0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Event</div>
                  {config.badge && <FlowBadge label={config.badge} />}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', marginBottom: 4 }}>{config.triggerEvent}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>{config.title}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>
                  {config.timeDelays.length} email{config.timeDelays.length !== 1 ? 's' : ''} &middot; {config.cooldownHours}h guard
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fire Event Modal */}
      {modal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null); }}
        >
          <div style={{
            background: '#fff', borderRadius: 20, padding: 32, maxWidth: 480, width: '100%',
            boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>
              Fire Event
            </h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              Sending <strong>&quot;{modal.eventName}&quot;</strong> &rarr; triggers <strong>{modalConfig?.title || modal.flowName}</strong>
            </p>

            {/* Cooldown warning */}
            {modalCooldown > 0 && (
              <div style={{
                padding: '10px 14px', borderRadius: 10, marginBottom: 16,
                background: '#fffbeb', border: '1px solid #fde68a',
                fontSize: 12, color: '#92400e', lineHeight: 1.5,
              }}>
                <strong>Duplicate guard active:</strong> will be blocked if already sent within {modalCooldown}h
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Email *</label>
                <input
                  type="email"
                  placeholder="client@example.com"
                  value={modal.email}
                  onChange={e => setModal({ ...modal, email: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>First name</label>
                  <input
                    placeholder="John"
                    value={modal.firstName}
                    onChange={e => setModal({ ...modal, firstName: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Last name</label>
                  <input
                    placeholder="Doe"
                    value={modal.lastName}
                    onChange={e => setModal({ ...modal, lastName: e.target.value })}
                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Project name</label>
                <input
                  placeholder="e.g. Intelli Support Setup"
                  value={modal.projectName}
                  onChange={e => setModal({ ...modal, projectName: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Project value (EUR)</label>
                <input
                  type="number"
                  placeholder="e.g. 2500"
                  value={modal.projectValue}
                  onChange={e => setModal({ ...modal, projectValue: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {fireResult && (
              <div style={{
                marginTop: 16, padding: '12px 16px', borderRadius: 10,
                background: fireResult.ok ? '#dcfce7' : '#fee2e2',
                color: fireResult.ok ? '#16a34a' : '#dc2626',
                fontSize: 13, fontWeight: 500,
              }}>
                {fireResult.msg}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setModal(null)}
                style={{ flex: 1, padding: '11px 0', border: '1px solid #d1d5db', borderRadius: 10, background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={fireEvent}
                disabled={!modal.email || firing}
                style={{
                  flex: 2, padding: '11px 0', border: 'none', borderRadius: 10,
                  background: !modal.email || firing ? '#93c5fd' : '#3b82f6',
                  color: '#fff', fontSize: 14, fontWeight: 600, cursor: !modal.email || firing ? 'not-allowed' : 'pointer',
                }}
              >
                {firing ? 'Sending...' : `Fire "${modal.eventName}"`}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConnectionStatus>
  );
}
