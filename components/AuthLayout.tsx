import React from 'react';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-bg min-h-screen flex flex-col">
      <header style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10, padding: '24px 32px' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <img src="/logo.png?v=2" alt="ainomiq" style={{ height: '28px', width: 'auto' }} />
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-10 w-full max-w-md">
          {children}
        </div>
      </main>
      <footer className="py-6 text-center text-sm" style={{ color: '#6b7280' }}>
        <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center', gap: '16px' }}>
          <Link href="/privacy-policy" style={{ color: '#6b7280', textDecoration: 'none' }}>Privacy Policy</Link>
          <Link href="/terms-of-service" style={{ color: '#6b7280', textDecoration: 'none' }}>Terms of Service</Link>
        </div>
        &copy; {new Date().getFullYear()} Ainomiq. All rights reserved.
      </footer>
    </div>
  );
}
