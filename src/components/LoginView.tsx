import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, Shield, AlertCircle, ArrowRight, UserCheck } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(email, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Authentication failed.');
    }
  };

  const handleQuickFill = async (presetEmail: string) => {
    setEmail(presetEmail);
    setPassword('Password123!');
    setError(null);
    setLoading(true);
    const result = await login(presetEmail, 'Password123!');
    setLoading(false);
    if (!result.success) {
      setError(result.error || 'Authentication failed.');
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100vw',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
        color: '#F8FAFC',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'rgba(30, 41, 59, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '36px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)',
        }}
      >
        {/* Brand Identity */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #4F46E5, #6366F1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '900',
              color: '#FFFFFF',
              fontSize: '24px',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)',
              marginBottom: '12px',
            }}
          >
            V
          </div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px', color: '#FFFFFF' }}>
            VOLKS HRMS
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94A3B8' }}>
            Enterprise Security & Session Gateway
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              background: '#451A03',
              border: '1px solid #78350F',
              color: '#FDBA74',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#CBD5E1', marginBottom: '6px' }}>
              Work Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748B' }} />
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@volks.com"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  background: '#0F172A',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#CBD5E1', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748B' }} />
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  borderRadius: '8px',
                  border: '1px solid #334155',
                  background: '#0F172A',
                  color: '#FFFFFF',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <button
            id="login-submit-btn"
            type="submit"
            disabled={loading}
            style={{
              marginTop: '8px',
              background: 'linear-gradient(135deg, #4F46E5, #6366F1)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '14px',
              fontWeight: '800',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
            }}
          >
            {loading ? 'Authenticating...' : <>Sign In <ArrowRight size={16} /></>}
          </button>
        </form>

        {/* DEVELOPMENT / UAT QUICK-FILL BAR */}
        <div style={{ marginTop: '28px', borderTop: '1px solid #334155', paddingTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '10px' }}>
            <Shield size={12} style={{ color: '#6366F1' }} />
            Development UAT Quick-Fill Accounts
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <button
              type="button"
              onClick={() => handleQuickFill('employee@volks.com')}
              style={{ background: '#1E293B', color: '#38BDF8', border: '1px solid #0284C7', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
            >
              Employee
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('manager@volks.com')}
              style={{ background: '#1E293B', color: '#A7F3D0', border: '1px solid #059669', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
            >
              Manager
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('hr@volks.com')}
              style={{ background: '#1E293B', color: '#FDE047', border: '1px solid #CA8A04', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
            >
              HR Admin
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('finance@volks.com')}
              style={{ background: '#1E293B', color: '#F472B6', border: '1px solid #DB2777', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
            >
              Finance
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill('admin@volks.com')}
              style={{ background: '#1E293B', color: '#C084FC', border: '1px solid #7E22CE', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
            >
              System Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
