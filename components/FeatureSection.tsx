'use client';

import { useState } from 'react';

interface Feature {
  title: string;
  desc: string;
  tag?: 'free' | 'soon';
  details: string[];
  automations?: string[];
}

const FEATURES: Feature[] = [
  {
    title: 'Intelli Support',
    desc: 'Email, chat, DMs, and comments - handled automatically in your brand voice.',
    details: [
      'Automated email responses with your tone and policies',
      'Facebook and Instagram DM handling',
      'Comment moderation (auto-delete negative, reply positive)',
      'Ticket categorization and priority scoring',
      'Multi-language support (matches customer language)',
      'Escalation rules for complex cases',
      'Response time and resolution tracking',
      'Satisfaction trend monitoring',
    ],
    automations: [
      'Automated replies every 2 hours across all channels',
      'Negative comments auto-removed',
      'Positive comments auto-replied in your voice',
      'Complex cases escalated to your team',
      'Discount codes auto-applied for complaints',
    ],
  },
  {
    title: 'Inventory Management',
    desc: 'Stock tracking, alerts, and reorder suggestions - always up to date.',
    details: [
      'Live inventory levels synced from Shopify',
      'Low stock and out-of-stock alerts',
      'Reorder point calculations',
      'Supplier contact management',
      'Product variant tracking (size, color, style)',
      'Demand forecasting based on sales velocity',
      'Inventory value calculations',
    ],
    automations: [
      'Low stock alerts when threshold hit',
      'Auto-generated reorder suggestions',
      'Weekly inventory summary reports',
      'Out-of-stock notifications to your team',
    ],
  },
  {
    title: 'Email Marketing',
    desc: 'Klaviyo flows & campaigns on autopilot.',
    details: [
      'Active flow monitoring with revenue attribution',
      'Campaign performance tracking (open rate, click rate, revenue)',
      'Subscriber growth and list health metrics',
      'Flow status overview (active, draft, paused)',
      'Revenue per flow and per campaign',
      'A/B test results tracking',
      'Deliverability monitoring',
    ],
    automations: [
      'Campaign performance alerts (drops in open/click rates)',
      'Flow health monitoring',
      'Subscriber churn detection',
    ],
  },
  {
    title: 'Performance & Profit Tracking',
    tag: 'free',
    desc: 'Revenue, profit, and growth metrics - free for everyone.',
    details: [
      'Revenue, ad spend, and net profit overview',
      'Blended ROAS and per-platform tracking',
      'COGS, shipping, and gateway fee breakdown',
      'New vs returning customer split',
      'Customer Acquisition Cost (CAC) trends',
      'Average Order Value (AOV) tracking',
      'Profit margin per product',
      'Growth indicators on all key metrics',
    ],
    automations: [
      'Daily profit summary notifications',
      'Margin drop alerts',
      'Weekly growth report',
      'ROAS threshold alerts',
    ],
  },
  {
    title: 'Ads Manager',
    tag: 'soon',
    desc: 'Meta, Google, and TikTok campaigns - managed automatically.',
    details: [
      'Automated ad creation from your product content',
      'Multiple ad variations per creative asset',
      'Persona-based targeting',
      'Real-time ROAS, CPC, CPA tracking',
      'Break-even analysis with profitability indicators',
      'Creative health monitoring (fatigue, frequency)',
      'Ainomiq Library integration for Content Studio',
    ],
    automations: [
      'Weekly ad batch generation from new content',
      'Midweek performance check',
      'Kill underperformers / scale winners automatically',
      'Weekly performance report',
      'Creative fatigue detection',
    ],
  },
  {
    title: 'Social Media',
    tag: 'soon',
    desc: 'Posting, scheduling, and engagement across platforms.',
    details: [
      'Multi-platform posting (Instagram, Facebook, TikTok)',
      'Content calendar and scheduling',
      'Engagement tracking and analytics',
      'Hashtag and caption suggestions',
    ],
  },
  {
    title: 'Reviews & UGC',
    tag: 'soon',
    desc: 'Collect and showcase customer content automatically.',
    details: [
      'Automated review request emails',
      'UGC collection and approval workflow',
      'Review aggregation across platforms',
      'Social proof widgets for your store',
    ],
  },
  {
    title: 'Returns & Exchanges',
    tag: 'soon',
    desc: 'Automated return flows and labels.',
    details: [
      'Self-service return portal for customers',
      'Automated return label generation',
      'Exchange suggestions (size/color swap)',
      'Refund tracking and status updates',
    ],
  },
  {
    title: 'Website Builder',
    tag: 'soon',
    desc: 'Prompt-based store pages - describe what you want, get a page.',
    details: [
      'Natural language page generation',
      'Product page optimization',
      'Landing page builder',
      'A/B testing built in',
    ],
  },
];

function TagBadge({ tag }: { tag?: 'free' | 'soon' }) {
  if (!tag) return null;
  const styles = tag === 'free'
    ? { background: '#dcfce7', color: '#166534' }
    : { background: '#fef3c7', color: '#92400e' };
  return (
    <span style={{ ...styles, fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', marginLeft: '8px' }}>
      {tag === 'free' ? 'Free' : 'Coming Soon'}
    </span>
  );
}

export default function FeatureSection() {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <section style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px 40px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {FEATURES.map((f, i) => {
          const isOpen = expanded === i;
          return (
            <div
              key={i}
              onClick={() => setExpanded(isOpen ? null : i)}
              style={{
                background: '#fff',
                border: '1px solid',
                borderColor: isOpen ? 'rgba(91,141,239,0.3)' : '#e2e6ef',
                borderRadius: '14px',
                padding: '24px',
                boxShadow: isOpen ? '0 4px 20px rgba(91,141,239,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                gridColumn: isOpen ? '1 / -1' : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a2e', marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                    {f.title}
                    <TagBadge tag={f.tag} />
                  </h3>
                  <p style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>{f.desc}</p>
                </div>
                <svg
                  width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"
                  style={{ flexShrink: 0, marginLeft: '12px', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {isOpen && (
                <div style={{ marginTop: '20px', borderTop: '1px solid #f0f2f5', paddingTop: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: f.automations ? '1fr 1fr' : '1fr', gap: '24px' }}>
                    <div>
                      <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a2e', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Features</h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {f.details.map((d, j) => (
                          <li key={j} style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.5, display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5b8def" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {f.automations && (
                      <div>
                        <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a2e', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Automations</h4>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {f.automations.map((a, j) => (
                            <li key={j} style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.5, display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                              </svg>
                              {a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
