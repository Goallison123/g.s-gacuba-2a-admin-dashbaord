import React, { useState } from 'react';
import { BookOpen, AlertTriangle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { SCHOOL_NAME } from '@/lib/constants';

export default function LoginScreen({ onLogin }: { onLogin: (email: string, password: string) => string | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = onLogin(email, password);
    setError(err ?? '');
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-mark"><BookOpen size={26} strokeWidth={2.5} /></div>
          <strong>{SCHOOL_NAME}</strong>
          <span>Administrator Portal</span>
        </div>
        <form onSubmit={submit} className="login-form">
          <label>Email address
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@school.ac.rw" autoComplete="username" />
          </label>
          <label>Password
            <div className="password-wrap">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" />
              <button type="button" className="reveal-btn" onClick={() => setShowPassword((s) => !s)}>{showPassword ? 'Hide' : 'Show'}</button>
            </div>
          </label>
          {error && <div className="login-error"><AlertTriangle size={15} /> {error}</div>}
          <Button type="submit" variant="primary" className="login-submit" disabled={!email.trim() || !password}>Sign in</Button>
        </form>
        <p className="login-foot">Secure access for authorised school administrators only.</p>
      </div>
    </div>
  );
}
