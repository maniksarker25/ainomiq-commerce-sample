import React from 'react';
import { SectionHeader, SectionDescription } from './Typography';
import { ALL_NAV_ITEMS, NAV_HIDDEN_KEY, NAV_ORDER_KEY } from '../_lib/constants';

interface AccountTabProps {
  session: any;
  navOrder: string[];
  hiddenNav: string[];
  toggleNavItem: (id: string) => void;
  moveNavItem: (id: string, direction: 'up' | 'down') => void;
}

export function AccountTab({
  session,
  navOrder,
  hiddenNav,
  toggleNavItem,
  moveNavItem,
}: AccountTabProps) {
  
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="glass rounded-2xl p-4 md:p-6">
        <h3 className="text-gray-900 font-semibold mb-6">Account Details</h3>
        <div className="space-y-1">
          {[
            { label: 'Email', value: session?.email },
            { label: 'Organization', value: session?.organization },
            { label: 'Plan', value: 'Active', valueColor: '#4ade80' },
            { label: 'AI Assistant', value: 'Online', valueColor: '#4ade80' },
          ].map((row, i) => (
            <div key={i} className="flex justify-between py-4" style={{ borderBottom: '1px solid #f0f2f5' }}>
              <SectionDescription>{row.label}</SectionDescription>
              <span style={{ color: row.valueColor || '#1a1a2e', fontSize: '14px', fontWeight: 500 }}>{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-4 md:p-6">
        <SectionHeader 
          title="Navigation Bar"
          description="Toggle visibility and reorder tabs in your bottom navigation."
        />
        <div>
          {navOrder.map((id, idx) => {
            const item = ALL_NAV_ITEMS.find(n => n.id === id);
            if (!item) return null;
            const isHidden = hiddenNav.includes(id);
            return (
              <div
                key={item.id}
                className="flex items-center justify-between py-3"
                style={{
                  borderBottom: '1px solid #f0f2f5',
                  opacity: isHidden ? 0.4 : item.alwaysOn ? 0.6 : 1,
                }}
              >
                <div className="flex items-center gap-3">
                  {/* Reorder buttons */}
                  <div className="flex flex-col" style={{ gap: '2px' }}>
                    <button
                      onClick={() => moveNavItem(id, 'up')}
                      disabled={idx === 0}
                      style={{
                        background: idx === 0 ? '#f5f7fb' : '#dbeafe',
                        border: '1px solid',
                        borderColor: idx === 0 ? '#e2e6ef' : '#c4d7f7',
                        borderRadius: '6px',
                        cursor: idx === 0 ? 'default' : 'pointer',
                        padding: '4px 6px',
                        color: idx === 0 ? '#d1d5db' : '#3b82f6',
                        lineHeight: 1,
                        display: 'flex',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <button
                      onClick={() => moveNavItem(id, 'down')}
                      disabled={idx === navOrder.length - 1}
                      style={{
                        background: idx === navOrder.length - 1 ? '#f5f7fb' : '#dbeafe',
                        border: '1px solid',
                        borderColor: idx === navOrder.length - 1 ? '#e2e6ef' : '#c4d7f7',
                        borderRadius: '6px',
                        cursor: idx === navOrder.length - 1 ? 'default' : 'pointer',
                        padding: '4px 6px',
                        color: idx === navOrder.length - 1 ? '#d1d5db' : '#3b82f6',
                        lineHeight: 1,
                        display: 'flex',
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                  </div>
                  <span style={{ color: '#1a1a2e', fontSize: '14px' }}>{item.label}</span>
                </div>
                <button
                  className={`toggle ${!isHidden ? 'active' : ''}`}
                  disabled={item.alwaysOn}
                  onClick={() => toggleNavItem(item.id)}
                />
              </div>
            );
          })}
        </div>

        {/* Live preview */}
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e2e6ef' }}>
          <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-3">Preview</div>
          <div style={{
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'space-around',
            background: '#ffffff',
            border: '1px solid #e2e6ef',
            borderRadius: '12px',
            padding: '8px 0',
          }}>
            {navOrder
              .filter(id => !hiddenNav.includes(id))
              .map(id => {
                const item = ALL_NAV_ITEMS.find(n => n.id === id);
                if (!item) return null;
                const isFirst = id === navOrder.filter(i => !hiddenNav.includes(i))[0];
                return (
                  <div
                    key={id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '3px',
                      flex: 1,
                      color: isFirst ? '#3b82f6' : '#9ca3af',
                      fontSize: '10px',
                    }}
                  >
                    <div style={{ width: 20, height: 20, borderRadius: 4, background: '#dbeafe' }} />
                    <span>{item.label.split(' ')[0]}</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="glass rounded-2xl p-4 md:p-6">
        <SectionHeader 
          title="Data Management"
          description="Export or delete your account data. Exports include all stored settings, integrations, and change requests."
        />
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            className="btn-secondary"
            style={{ fontSize: '13px', padding: '10px 20px' }}
            onClick={() => {
              const tenantId = session?.email || '';
              if (!tenantId) return;
              window.location.href = `/api/account/export?tenant_id=${encodeURIComponent(tenantId)}`;
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export my data
            </span>
          </button>
          <button
            style={{
              fontSize: '13px',
              padding: '10px 20px',
              borderRadius: '10px',
              border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.05)',
              color: '#ef4444',
              cursor: 'pointer',
              fontWeight: 500,
            }}
            onClick={() => {
              const tenantId = session?.email || '';
              if (!tenantId) return;
              if (!confirm('Are you sure you want to delete your account? This action cannot be undone. All your data, integrations, and settings will be permanently removed.')) return;
              fetch('/api/account/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_id: tenantId }),
              }).then(res => res.json()).then(data => {
                if (data.success) {
                  localStorage.clear();
                  window.location.href = '/login';
                } else {
                  alert(data.error || 'Failed to delete account');
                }
              }).catch(() => alert('Failed to delete account'));
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
              Delete my account
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
