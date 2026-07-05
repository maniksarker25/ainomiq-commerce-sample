'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home, AlertCircle } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f1729 0%, #1a2744 50%, #0f1729 100%)',
        padding: '24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background 404 text */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontSize: 'clamp(120px, 25vw, 300px)',
            fontWeight: 800,
            color: 'rgba(255,255,255,0.03)',
            letterSpacing: '-0.05em',
            lineHeight: 1,
          }}
        >
          404
        </span>
      </div>

      {/* Card */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '24px',
          padding: '48px 40px',
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(99,179,237,0.15)',
            border: '1px solid rgba(99,179,237,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}
        >
          <AlertCircle size={28} color="#63b3ed" />
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 700,
            color: '#ffffff',
            marginBottom: '12px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          Page not found
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: '15px',
            color: 'rgba(255,255,255,0.55)',
            lineHeight: 1.6,
            marginBottom: '36px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          This page doesn&apos;t exist or has been moved.
          <br />
          Head back to Ainomiq to continue.
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
          <button
            onClick={() => router.back()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 24px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.85)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.13)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
            }}
          >
            <ArrowLeft size={16} />
            Go back
          </button>

          <a
            href="https://ainomiq.com"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 24px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'none',
              transition: 'opacity 0.2s',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.opacity = '0.9';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.opacity = '1';
            }}
          >
            <Home size={16} />
            Go to Ainomiq
          </a>
        </div>

        {/* Footer */}
        <p
          style={{
            marginTop: '28px',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.25)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          ainomiq.com
        </p>
      </div>
    </div>
  );
}
