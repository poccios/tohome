'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { requestOTP, verifyOTP } from '@/lib/api';
import { getDeviceId } from '@/lib/device';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  // Timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [resendTimer]);

  // Auto-focus OTP input when switching to OTP step
  useEffect(() => {
    if (step === 'otp' && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [step]);

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (otp.length === 6 && step === 'otp' && !loading) {
      handleVerifyOTP();
    }
  }, [otp]);

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const deviceId = getDeviceId();
      const result = await requestOTP(email.trim(), deviceId);

      setMessage(result.message || 'OTP code sent to your email');
      setDebugCode(result.debug_code || null);
      setStep('otp');
      setResendTimer(60); // 60 seconds before can resend
      setOtp('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const deviceId = getDeviceId();
      await verifyOTP(email.trim(), otp, deviceId);

      setMessage('Login successful! Redirecting...');
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid OTP code');
      setOtp('');
      if (otpInputRef.current) {
        otpInputRef.current.focus();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    setOtp('');
    setError('');
    setMessage('');
    setDebugCode(null);
    handleRequestOTP(new Event('submit') as any);
  };

  const handleBack = () => {
    setStep('email');
    setOtp('');
    setError('');
    setMessage('');
    setDebugCode(null);
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(value);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '2rem',
          borderRadius: '8px',
          border: '1px solid #ddd',
          backgroundColor: '#fff',
        }}
      >
        <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          Login to ToHome
        </h1>

        {step === 'email' && (
          <form onSubmit={handleRequestOTP}>
            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 500,
                }}
              >
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                }}
              />
              <small style={{ color: '#666', fontSize: '0.875rem' }}>
                We'll send you a 6-digit code
              </small>
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                fontWeight: 500,
                color: '#fff',
                backgroundColor: loading ? '#999' : '#0070f3',
                border: 'none',
                borderRadius: '4px',
                cursor: loading || !email ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Sending...' : 'Send Code'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <div>
            <div style={{ marginBottom: '1rem', textAlign: 'center', color: '#666' }}>
              Code sent to <strong>{email}</strong>
            </div>

            {debugCode && (
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '1rem',
                  backgroundColor: '#fff3cd',
                  border: '2px solid #ffc107',
                  borderRadius: '8px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.875rem', color: '#856404', marginBottom: '0.5rem' }}>
                  🔧 E2E Mode - Your OTP Code:
                </div>
                <div
                  style={{
                    fontSize: '2rem',
                    fontWeight: 'bold',
                    letterSpacing: '0.5rem',
                    color: '#856404',
                    fontFamily: 'monospace',
                  }}
                >
                  {debugCode}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="otp"
                style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontWeight: 500,
                }}
              >
                Enter 6-Digit Code
              </label>
              <input
                ref={otpInputRef}
                type="text"
                id="otp"
                value={otp}
                onChange={handleOtpChange}
                placeholder="000000"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1.5rem',
                  textAlign: 'center',
                  letterSpacing: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxSizing: 'border-box',
                }}
              />
              <small style={{ color: '#666', fontSize: '0.875rem' }}>
                Code expires in 5 minutes
              </small>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <button
                onClick={handleBack}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  fontSize: '1rem',
                  fontWeight: 500,
                  color: '#0070f3',
                  backgroundColor: '#fff',
                  border: '1px solid #0070f3',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                Back
              </button>
              <button
                onClick={handleResend}
                disabled={loading || resendTimer > 0}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  fontSize: '1rem',
                  fontWeight: 500,
                  color: resendTimer > 0 ? '#999' : '#0070f3',
                  backgroundColor: '#fff',
                  border: '1px solid ' + (resendTimer > 0 ? '#999' : '#0070f3'),
                  borderRadius: '4px',
                  cursor: loading || resendTimer > 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {resendTimer > 0 ? `Resend (${resendTimer}s)` : 'Resend Code'}
              </button>
            </div>
          </div>
        )}

        {message && (
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#d4edda',
              border: '1px solid #c3e6cb',
              borderRadius: '4px',
              color: '#155724',
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#f8d7da',
              border: '1px solid #f5c6cb',
              borderRadius: '4px',
              color: '#721c24',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <a
            href="/"
            style={{
              color: '#0070f3',
              textDecoration: 'none',
            }}
          >
            ← Back to home
          </a>
        </div>
      </div>
    </div>
  );
}
