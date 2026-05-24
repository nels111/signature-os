'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Invalid email or password');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div
      className="min-h-[100svh] flex items-center justify-center"
      style={{ background: 'var(--sidebar-bg)' }}
    >
      {/* Subtle gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--brand-blue) 15%, transparent) 0%, transparent 60%)',
        }}
      />

      <div className="w-full max-w-[400px] relative z-10 px-4">
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'var(--surface)',
            boxShadow: '0 24px 80px color-mix(in srgb, var(--text-primary) 30%, transparent)',
          }}
        >
          <div className="text-center mb-8">
            <div className="flex justify-center mb-5">
              <Image
                src="/logo-badge.svg"
                alt="Signature Cleans"
                width={56}
                height={56}
                className="rounded-full"
              />
            </div>
            <h1
              className="text-xl font-bold"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            >
              Signature Cleans
            </h1>
            <p
              className="text-[10px] mt-1.5 uppercase font-semibold"
              style={{
                color: 'var(--text-muted)',
                letterSpacing: '0.15em',
              }}
            >
              Peace of Mind, Every Time
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                className="text-sm p-3 rounded-xl flex items-center gap-2"
                style={{
                  background: 'var(--status-danger-bg)',
                  color: 'var(--status-danger)',
                }}
              >
                <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: 'var(--status-danger)' }} />
                {error}
              </div>
            )}

            <div>
              <label
                className="block text-[11px] font-semibold uppercase mb-1.5"
                style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}
              >
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl transition-all duration-200"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--brand-blue)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--brand-blue) 10%, transparent)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                required
              />
            </div>

            <div>
              <label
                className="block text-[11px] font-semibold uppercase mb-1.5"
                style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}
              >
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl transition-all duration-200"
                style={{
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--brand-blue)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--brand-blue) 10%, transparent)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50"
              style={{
                background: 'var(--brand-blue)',
                color: 'var(--surface)',
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--brand-blue-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--brand-blue)'; }}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        </div>

        <p
          className="text-center mt-6 text-[11px]"
          style={{ color: 'var(--sidebar-text-muted)' }}
        >
          Signature Cleans OS v1.0
        </p>
      </div>
    </div>
  );
}
