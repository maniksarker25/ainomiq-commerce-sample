import React from 'react';
import { SectionHeader } from './Typography';
import { NOTIF_EMAILS_KEY, NOTIF_ALERTS_KEY, ALERT_TYPES } from '../_lib/constants';

interface NotificationsTabProps {
  notifEmails: string[];
  setNotifEmails: React.Dispatch<React.SetStateAction<string[]>>;
  notifAlerts: Record<string, number[]>;
  setNotifAlerts: React.Dispatch<React.SetStateAction<Record<string, number[]>>>;
}

export function NotificationsTab({
  notifEmails,
  setNotifEmails,
  notifAlerts,
  setNotifAlerts,
}: NotificationsTabProps) {
  
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Email Recipients */}
      <div className="glass rounded-2xl p-4 md:p-6">
        <SectionHeader 
          title="Email Recipients"
          description="Add email addresses that can receive notifications. Choose per alert which emails are notified."
        />
        <div className="space-y-3">
          {notifEmails.map((email, i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                type="email"
                placeholder="email@company.com"
                value={email}
                onChange={(e) => {
                  const updated = [...notifEmails];
                  updated[i] = e.target.value;
                  setNotifEmails(updated);
                  localStorage.setItem(NOTIF_EMAILS_KEY, JSON.stringify(updated));
                }}
                className="input flex-1"
              />
              {notifEmails.length > 1 && (
                <button
                  onClick={() => {
                    const updated = notifEmails.filter((_, idx) => idx !== i);
                    setNotifEmails(updated);
                    localStorage.setItem(NOTIF_EMAILS_KEY, JSON.stringify(updated));
                    // Clean up alert assignments
                    const updatedAlerts = { ...notifAlerts };
                    Object.keys(updatedAlerts).forEach(key => {
                      updatedAlerts[key] = updatedAlerts[key].filter(idx => idx !== i).map(idx => idx > i ? idx - 1 : idx);
                    });
                    setNotifAlerts(updatedAlerts);
                    localStorage.setItem(NOTIF_ALERTS_KEY, JSON.stringify(updatedAlerts));
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '8px' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => {
              const updated = [...notifEmails, ''];
              setNotifEmails(updated);
              localStorage.setItem(NOTIF_EMAILS_KEY, JSON.stringify(updated));
            }}
            className="btn-secondary"
            style={{ fontSize: '13px', padding: '8px 16px' }}
          >
            + Add email
          </button>
        </div>
      </div>

      {/* Alert Preferences */}
      <div className="glass rounded-2xl p-4 md:p-6">
        <SectionHeader 
          title="Alert Preferences"
          description="Toggle alerts and choose which emails receive each notification."
        />
        <div>
          {ALERT_TYPES.map((alert) => {
            const assignedEmails = notifAlerts[alert.id] || [];
            const filledEmails = notifEmails.filter(e => e.trim() !== '');
            return (
              <div key={alert.id} className="py-4" style={{ borderBottom: '1px solid #f0f2f5' }}>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ color: '#1a1a2e', fontSize: '14px' }}>{alert.label}</span>
                  <button
                    className={`toggle ${assignedEmails.length > 0 ? 'active' : ''}`}
                    onClick={() => {
                      const updated = { ...notifAlerts };
                      if (assignedEmails.length > 0) {
                        updated[alert.id] = [];
                      } else {
                        updated[alert.id] = filledEmails.map((_, idx) => idx);
                      }
                      setNotifAlerts(updated);
                      localStorage.setItem(NOTIF_ALERTS_KEY, JSON.stringify(updated));
                    }}
                  />
                </div>
                {assignedEmails.length > 0 && filledEmails.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {filledEmails.map((email, idx) => {
                      const originalIdx = notifEmails.indexOf(email);
                      const isActive = assignedEmails.includes(originalIdx);
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            const updated = { ...notifAlerts };
                            if (isActive) {
                              updated[alert.id] = assignedEmails.filter(i => i !== originalIdx);
                            } else {
                              updated[alert.id] = [...assignedEmails, originalIdx];
                            }
                            setNotifAlerts(updated);
                            localStorage.setItem(NOTIF_ALERTS_KEY, JSON.stringify(updated));
                          }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            border: '1px solid',
                            borderColor: isActive ? 'rgba(59,130,246,0.4)' : '#e2e6ef',
                            background: isActive ? 'var(--ai-blue-light)' : 'transparent',
                            color: isActive ? '#3b82f6' : '#8b8b9e',
                            cursor: 'pointer',
                          }}
                        >
                          {email}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
