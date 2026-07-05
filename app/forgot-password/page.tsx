'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import AuthLayout from '../../components/AuthLayout';
import PasswordInput from '../../components/PasswordInput';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code' | 'newpass'>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong'); return; }
      setStep('code');
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(''));
      inputRefs.current[5]?.focus();
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length !== 6) { setError('Please enter the full 6-digit code'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: fullCode }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Invalid code'); return; }
      setResetToken(data.resetToken);
      setStep('newpass');
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong'); return; }
      setSuccess(true);
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };

  if (success) {
    return (
      <AuthLayout>
        <div className="text-center">
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(74,222,128,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Password updated</h1>
          <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>Your password has been reset successfully.</p>
          <Link href="/login" className="btn-primary" style={{ display: 'inline-block', padding: '12px 24px', fontSize: '14px', textDecoration: 'none', borderRadius: '8px' }}>
            Sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const codeInputStyle = {
    width: 48, height: 56, textAlign: 'center' as const, fontSize: '24px', fontWeight: 600,
    background: '#fff', border: '2px solid #d1d5db',
    borderRadius: 10, color: '#111', outline: 'none', caretColor: '#3b82f6',
  };

  return (
    <AuthLayout>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#1a1a2e' }}>
          {step === 'email' ? 'Reset password' : step === 'code' ? 'Enter verification code' : 'Set new password'}
        </h1>
        <p className="mt-2" style={{ color: '#6b7280', fontSize: '14px' }}>
          {step === 'email' ? 'Enter your email to receive a verification code' :
           step === 'code' ? <>We sent a 6-digit code to <strong style={{ color: '#1a1a2e' }}>{email}</strong>. It can take up to 2 minutes to arrive. Check your spam folder if needed.</> :
           'Choose a new password for your account'}
        </p>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ef4444', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {step === 'email' && (
        <form onSubmit={handleEmailSubmit}>
          <div className="mb-6">
            <label className="block mb-2" style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280' }}>Email address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input" placeholder="you@company.com" required />
          </div>
          <button type="submit" className="btn-primary w-full" style={{ padding: '12px', fontSize: '14px' }} disabled={loading}>
            {loading ? 'Sending...' : 'Send verification code'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={handleCodeSubmit}>
          <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '13px', marginBottom: 20 }}>
            Code sent to <strong style={{ color: '#111' }}>{email}</strong>
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }} onPaste={handleCodePaste}>
            {code.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleCodeChange(i, e.target.value)}
                onKeyDown={e => handleCodeKeyDown(i, e)}
                style={{
                  ...codeInputStyle,
                  borderColor: digit ? '#3b82f6' : '#d1d5db',
                }}
                autoFocus={i === 0}
              />
            ))}
          </div>
          <button type="submit" className="btn-primary w-full" style={{ padding: '12px', fontSize: '14px' }} disabled={loading}>
            {loading ? 'Verifying...' : 'Verify code'}
          </button>
          <div className="mt-4 text-center">
            <button type="button" onClick={() => { setStep('email'); setCode(['','','','','','']); setError(''); }} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '13px', cursor: 'pointer' }}>
              Didn't receive a code? Try again
            </button>
          </div>
        </form>
      )}

      {step === 'newpass' && (
        <form onSubmit={handlePasswordSubmit}>
          <div className="mb-4">
            <label className="block mb-2" style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280' }}>New password</label>
            <PasswordInput value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" minLength={6} />
          </div>
          <div className="mb-6">
            <label className="block mb-2" style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280' }}>Confirm password</label>
            <PasswordInput value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm your password" minLength={6} />
          </div>
          <button type="submit" className="btn-primary w-full" style={{ padding: '12px', fontSize: '14px' }} disabled={loading}>
            {loading ? 'Updating...' : 'Update password'}
          </button>
        </form>
      )}

      <div className="mt-8 text-center">
        <Link href="/login" style={{ color: '#3b82f6', fontSize: '14px', textDecoration: 'none', fontWeight: 500 }}>
          Back to sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
