import React from 'react';
import { SectionDescription } from './Typography';

interface AdAccountSelectorProps {
  adAccountsLoading: boolean;
  adAccounts: any[];
  selectedAdAccounts: string[];
  setSelectedAdAccounts: (ids: string[]) => void;
  savingAdAccount: boolean;
  saveAdAccount: () => Promise<void>;
  closeSelector: () => void;
}

export function AdAccountSelector({
  adAccountsLoading,
  adAccounts,
  selectedAdAccounts,
  setSelectedAdAccounts,
  savingAdAccount,
  saveAdAccount,
  closeSelector,
}: AdAccountSelectorProps) {
  
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="glass rounded-2xl animate-in zoom-in duration-200" style={{ padding: '32px', maxWidth: '520px', width: '100%', maxHeight: '80vh', overflow: 'auto' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#1a1a2e', marginBottom: '4px' }}>Select Ad Accounts</h3>
        <SectionDescription className="mb-6">
          Choose which ad accounts to connect to your dashboard.
        </SectionDescription>

        {adAccountsLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#6b7280' }}>Loading ad accounts...</div>
        ) : adAccounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <SectionDescription className="mb-3">No ad accounts found.</SectionDescription>
            <SectionDescription className="!text-[12px]">Make sure you have access to at least one Meta ad account.</SectionDescription>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            {adAccounts.map(acc => {
              const isSelected = selectedAdAccounts.includes(acc.id);
              return (
                <button
                  key={acc.id}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedAdAccounts(selectedAdAccounts.filter(id => id !== acc.id));
                    } else {
                      setSelectedAdAccounts([...selectedAdAccounts, acc.id]);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: '2px solid',
                    borderColor: isSelected ? '#3b82f6' : '#e2e6ef',
                    background: isSelected ? 'rgba(59,130,246,0.06)' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a2e' }}>{acc.name}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                      {acc.businessName ? `${acc.businessName} · ` : ''}{acc.accountId} · {acc.currency}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: acc.status === 'active' ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)',
                      color: acc.status === 'active' ? '#16a34a' : '#ef4444',
                    }}>
                      {acc.status}
                    </span>
                    <div style={{
                      width: 20, height: 20, borderRadius: '6px',
                      border: '2px solid',
                      borderColor: isSelected ? '#3b82f6' : '#d1d5db',
                      background: isSelected ? '#3b82f6' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}>
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={closeSelector}
            className="btn-secondary"
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button
            onClick={saveAdAccount}
            className="btn-primary"
            style={{ flex: 1 }}
            disabled={selectedAdAccounts.length === 0 || savingAdAccount}
          >
            {savingAdAccount ? 'Connecting...' : 'Connect Accounts'}
          </button>
        </div>
      </div>
    </div>
  );
}
