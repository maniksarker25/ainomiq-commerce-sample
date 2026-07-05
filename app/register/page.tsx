'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthLayout from '../../components/AuthLayout';
import PasswordInput from '../../components/PasswordInput';
import { cacheSession, clearSessionCache } from '../../lib/session';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organization, setOrganization] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteMode, setInviteMode] = useState(false);
  const [loginHref, setLoginHref] = useState('/login');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invitedEmail = params.get('email') || '';
    const returnUrl = params.get('return') || '';
    const forceInviteMode = params.get('force') === '1' || returnUrl === '/dashboard/creative-os' || params.has('invite');
    setInviteMode(forceInviteMode);
    if (invitedEmail) setEmail(invitedEmail);
    if (forceInviteMode) {
      const loginParams = new URLSearchParams({
        return: '/dashboard/creative-os',
        force: '1',
      });
      if (invitedEmail) loginParams.set('email', invitedEmail);
      const invite = params.get('invite');
      if (invite) loginParams.set('invite', invite);
      setLoginHref(`/login?${loginParams.toString()}`);
    }
    if (forceInviteMode) {
      clearSessionCache();
      fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, organization }),
        credentials: 'same-origin',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      // Cache session data for UI (JWT cookie is already set by the server)
      cacheSession({
        tenantId: data.user.id,
        email: data.user.email,
        name: data.user.name,
        organization: data.user.organization || organization,
        modules: data.user.modules || ['performance'],
        accessMode: data.user.accessMode || 'customer',
      });

      const params = new URLSearchParams(window.location.search);
      window.location.href = params.get('return') || (data.user.accessMode === 'creative-editor' ? '/dashboard/creative-os' : '/dashboard');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{inviteMode ? 'Create Creative OS account' : 'Create account'}</h1>
        <p className="mt-2" style={{ color: '#6b7280', fontSize: '14px' }}>
          {inviteMode ? 'Use the invited email so we can connect you to the Creative OS workspace.' : 'Get started with Ainomiq'}
        </p>
      </div>

      {error && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '10px',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          color: '#ef4444',
          fontSize: '13px',
          marginBottom: '16px',
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block mb-2" style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280' }}>Full name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="input" placeholder="John Doe" required />
        </div>
        <div className="mb-4">
          <label className="block mb-2" style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280' }}>Email address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input" placeholder="you@company.com" required />
        </div>
        <div className="mb-4">
          <label className="block mb-2" style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280' }}>Organization</label>
          <input type="text" value={organization} onChange={e => setOrganization(e.target.value)} className="input" placeholder="Your company name" />
        </div>
        <div className="mb-6">
          <label className="block mb-2" style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280' }}>Password</label>
          <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a password" minLength={6} />
        </div>
        <button type="submit" className="btn-primary w-full" style={{ padding: '12px', fontSize: '14px' }} disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <div className="mt-8 text-center" style={{ fontSize: '14px', color: '#6b7280' }}>
        Already have an account?{' '}
        <Link href={loginHref} style={{ color: '#3b82f6', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
      </div>
    </AuthLayout>
  );
}
