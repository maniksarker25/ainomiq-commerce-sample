'use client';

import { useState, useEffect, useRef } from 'react';

interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
  time: string;
  links?: { label: string; href: string }[];
  suggestions?: string[];
  rated?: 'up' | 'down';
}

export default function SupportPage() {
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([
    { role: 'assistant', text: "Hey! Welcome to Ainomiq support. Pick a topic or type your question.", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), suggestions: ['Getting Started', 'Stock Management', 'Ad Monitoring', 'Billing & Pricing', 'Report a Bug'] },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendChat = async (overrideMsg?: string) => {
    const msg = (overrideMsg || chatInput).trim();
    if (!msg || chatLoading) return;
    const userMsg: ChatMsg = { role: 'user', text: msg, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...chatMessages, userMsg].map(m => ({ role: m.role, content: m.text })) }),
      });
      const data = await res.json();
      const botMsg: ChatMsg = {
        role: 'assistant',
        text: data.reply || "Sorry, I didn't understand that. Try rephrasing or contact our team.",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        links: data.links || [],
        suggestions: data.suggestions || [],
        rated: undefined,
      };
      setChatMessages(prev => [...prev, botMsg]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', text: 'Something went wrong. Please try again.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    }
    setChatLoading(false);
  };

  const rateMessage = (index: number, rating: 'up' | 'down') => {
    setChatMessages(prev => prev.map((m, i) => i === index ? { ...m, rated: m.rated === rating ? undefined : rating } : m));
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 120px)',
      minHeight: '400px',
      background: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #e2e6ef',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #e2e6ef',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', color: '#fff', fontWeight: 700,
          }}>A</div>
          <div>
            <p style={{ color: '#1a1a2e', fontSize: '14px', fontWeight: 600, margin: 0 }}>Ainomiq Support</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a' }} />
              <span style={{ color: '#6b7280', fontSize: '12px' }}>Online, typically replies instantly</span>
            </div>
          </div>
        </div>
        <a
          href="https://www.ainomiq.com/pages/book-a-call"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            padding: '6px 12px',
            borderRadius: '8px',
            background: '#f0f3f9',
            color: '#6b7280',
            fontSize: '12px',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Contact us
        </a>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        {chatMessages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: msg.role === 'user' ? '#3b82f6' : '#e2e6ef',
              color: msg.role === 'user' ? '#fff' : '#1a1a2e',
              fontSize: '14px',
              lineHeight: '1.5',
            }}>
              {msg.text}
            </div>

            {msg.links && msg.links.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {msg.links.map((link, li) => (
                  <a
                    key={li}
                    href={link.href}
                    target={link.href.startsWith('http') ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      background: '#dbeafe',
                      color: '#3b82f6',
                      fontSize: '13px',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      border: '1px solid #3b82f6',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    {link.label}
                  </a>
                ))}
              </div>
            )}

            {msg.suggestions && msg.suggestions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {msg.suggestions.map((s, si) => (
                  <button
                    key={si}
                    onClick={() => sendChat(s)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      background: '#f0f3f9',
                      color: '#1a1a2e',
                      fontSize: '13px',
                      border: '1px solid #d1d5db',
                      cursor: 'pointer',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', padding: '0 4px' }}>
              <span style={{ color: '#6b7280', fontSize: '11px' }}>{msg.time}</span>
              {msg.role === 'assistant' && i > 0 && (
                <div style={{ display: 'flex', gap: '2px' }}>
                  <button
                    onClick={() => rateMessage(i, 'up')}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                      color: msg.rated === 'up' ? '#34d399' : '#9ca3af',
                      opacity: msg.rated === 'down' ? 0.3 : 1,
                      fontSize: '13px',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={msg.rated === 'up' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
                  </button>
                  <button
                    onClick={() => rateMessage(i, 'down')}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                      color: msg.rated === 'down' ? '#ef4444' : '#9ca3af',
                      opacity: msg.rated === 'up' ? 0.3 : 1,
                      fontSize: '13px',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={msg.rated === 'down' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10zM17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {chatLoading && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '10px 14px',
            borderRadius: '14px 14px 14px 4px',
            background: '#f0f3f9',
            alignSelf: 'flex-start',
            maxWidth: '80px',
          }}>
            <div className="typing-dot" style={{ animationDelay: '0ms' }} />
            <div className="typing-dot" style={{ animationDelay: '150ms' }} />
            <div className="typing-dot" style={{ animationDelay: '300ms' }} />
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid #e2e6ef',
        display: 'flex',
        gap: '10px',
      }}>
        <input
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendChat(); }}
          placeholder="Type a message..."
          style={{
            flex: 1,
            background: '#f0f3f9',
            border: '1px solid #e2e6ef',
            borderRadius: '10px',
            padding: '10px 14px',
            color: '#1a1a2e',
            fontSize: '14px',
            outline: 'none',
          }}
        />
        <button
          onClick={() => sendChat()}
          disabled={chatLoading || !chatInput.trim()}
          style={{
            background: '#3b82f6',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 16px',
            cursor: chatLoading || !chatInput.trim() ? 'default' : 'pointer',
            opacity: chatLoading || !chatInput.trim() ? 0.4 : 1,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  );
}
