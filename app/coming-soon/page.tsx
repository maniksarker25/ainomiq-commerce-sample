'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

function getTargetDate() {
  // 30 days from now, stored in localStorage so it's consistent
  if (typeof window === 'undefined') return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const stored = localStorage.getItem('ainomiq_launch_date');
  if (stored) return new Date(stored);
  const target = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  localStorage.setItem('ainomiq_launch_date', target.toISOString());
  return target;
}

export default function ComingSoonPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 30, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const target = getTargetDate();
    const tick = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/coming-soon-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    console.log('Response status:', res);
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      {/* Logo */}
      <img
        src="/logo.png?v=2"
        alt="ainomiq"
        style={{ height: '32px', marginBottom: '48px', filter: 'brightness(0) invert(1)' }}
      />

      {/* Coming Soon label */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          borderRadius: '999px',
          border: '1px solid rgba(59,130,246,0.4)',
          background: 'rgba(59,130,246,0.1)',
          color: '#60a5fa',
          fontSize: '12px',
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: '32px',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#3b82f6',
            display: 'inline-block',
          }}
        />
        Coming Soon
      </div>

      {/* Headline */}
      <h1
        style={{
          fontSize: 'clamp(32px, 6vw, 64px)',
          fontWeight: 800,
          color: '#ffffff',
          textAlign: 'center',
          lineHeight: 1.1,
          marginBottom: '16px',
          letterSpacing: '-0.02em',
        }}
      >
        Something big
        <br />
        is launching.
      </h1>
      <p
        style={{
          color: '#94a3b8',
          fontSize: '18px',
          textAlign: 'center',
          marginBottom: '56px',
          maxWidth: 400,
        }}
      >
        Ainomiq is getting ready. Your store, fully automated - arriving in:
      </p>

      {/* Countdown */}
      <div
        style={{
          display: 'flex',
          gap: '24px',
          marginBottom: '64px',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {[
          { value: timeLeft.days, label: 'Days' },
          { value: timeLeft.hours, label: 'Hours' },
          { value: timeLeft.minutes, label: 'Min' },
          { value: timeLeft.seconds, label: 'Sec' },
        ].map(({ value, label }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 90,
                height: 90,
                borderRadius: '16px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '42px',
                fontWeight: 800,
                color: '#ffffff',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
              }}
            >
              {pad(value)}
            </div>
            <div
              style={{
                color: '#64748b',
                fontSize: '12px',
                fontWeight: 500,
                marginTop: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Password form */}
      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          padding: '32px',
          width: '100%',
          maxWidth: 400,
        }}
      >
        <p
          style={{ color: '#cbd5e1', fontSize: '14px', textAlign: 'center', marginBottom: '20px' }}
        >
          Early access? Enter your tester password.
        </p>
        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
        >
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="off"
            style={{
              height: '48px',
              borderRadius: '10px',
              border: error ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.06)',
              color: '#ffffff',
              fontSize: '15px',
              padding: '0 16px',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />
          {error && (
            <p style={{ color: '#f87171', fontSize: '13px', textAlign: 'center', margin: 0 }}>
              Incorrect password
            </p>
          )}
          <button
            type="submit"
            style={{
              height: '48px',
              borderRadius: '10px',
              background: '#3b82f6',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Enter
          </button>
        </form>
      </div>

      <p style={{ color: '#475569', fontSize: '12px', marginTop: '40px' }}>
        &copy; {new Date().getFullYear()} Ainomiq. All rights reserved.
      </p>
    </div>
  );
}
