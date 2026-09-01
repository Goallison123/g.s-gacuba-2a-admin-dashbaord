import { useState } from 'react';
import { School as SchoolIcon, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth';

const CLASSROOM_IMG = 'https://images.pexels.com/photos/8617957/pexels-photo-8617957.jpeg?auto=compress&cs=tinysrgb&h=1200&w=900';

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);

    const fn = mode === 'login' ? signIn : signUp;
    const { error } = await fn(email.trim(), password);

    if (error) {
      setError(error);
      setBusy(false);
    } else if (mode === 'signup') {
      setInfo('Account created! Check your email for a confirmation link, or sign in if email confirmation is disabled.');
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="flex w-full max-w-4xl overflow-hidden rounded-2xl shadow-2xl">
        {/* Left panel — form */}
        <div className="flex w-full flex-col justify-center bg-navy-900 px-8 py-10 sm:px-12 lg:w-1/2 lg:px-14">
          {/* Logo + heading */}
          <div className="mb-8">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
              <SchoolIcon size={26} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="mt-1.5 text-sm text-slate-400">
              {mode === 'login'
                ? 'Sign in to manage your school.'
                : 'Set up your school management account.'}
            </p>
          </div>

          {/* Mode toggle */}
          <div className="mb-6 flex rounded-lg bg-white/5 p-1">
            <button
              onClick={() => { setMode('login'); setError(null); }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                mode === 'login' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null); }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                mode === 'signup' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Create account
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Email address</label>
              <input
                type="email"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white shadow-sm transition-colors placeholder:text-slate-500 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/10"
                placeholder="you@school.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 pr-11 text-sm text-white shadow-sm transition-colors placeholder:text-slate-500 focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-error-500/10 px-3 py-2.5 text-sm text-error-400">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            {info && (
              <div className="rounded-lg bg-accent-500/10 px-3 py-2.5 text-sm text-accent-400">
                {info}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 shadow-sm transition-all hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-navy-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            {mode === 'login'
              ? 'New to S4Me? Switch to "Create account" to get started.'
              : 'Already have an account? Switch to "Sign in".'}
          </p>
        </div>

        {/* Right panel — image */}
        <div className="relative hidden lg:block lg:w-1/2">
          <img
            src={CLASSROOM_IMG}
            alt="Students learning in a classroom"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950/60 via-transparent to-transparent" />
          <div className="absolute bottom-8 left-8 right-8">
            <h2 className="text-xl font-bold text-white drop-shadow-lg">
              S4Me
            </h2>
            <p className="mt-1 text-sm text-slate-200 drop-shadow">
              The all-in-one platform for school management.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
