import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEye, FiEyeOff, FiLock, FiMail, FiUser, FiBriefcase, FiArrowRight, FiCheck, FiX } from 'react-icons/fi';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import { Field, Input, Checkbox } from '../components/ui/Field';
import Notice from '../components/ui/Notice';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { passwordStrength, validateEmail, validatePassword } from '../lib/validation';
import { cn } from '../lib/utils';

function StrengthMeter({ password }) {
  const strength = passwordStrength(password);
  const tones = ['bg-critical', 'bg-critical', 'bg-medium', 'bg-brand', 'bg-safe'];
  const textTones = ['text-ink-3', 'text-critical', 'text-critical', 'text-medium', 'text-brand', 'text-safe'];

  return (
    <div className="rounded-xl border border-line bg-surface-2/50 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] uppercase tracking-[0.07em] text-ink-3">Password strength</span>
        <span className={cn('text-[11px] font-medium', textTones[strength.score])}>{password ? strength.label : '—'}</span>
      </div>
      <div className="mt-1.5 flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              password && index < Math.max(strength.score, 1) ? tones[strength.score] : 'bg-surface-3',
            )}
          />
        ))}
      </div>
      <ul className="mt-2.5 grid gap-1 sm:grid-cols-2">
        {strength.checks.map((check) => (
          <li key={check.id} className="flex items-center gap-1.5 text-[10.5px]">
            {check.pass ? <FiCheck className="text-[10px] text-safe" aria-hidden="true" /> : <FiX className="text-[10px] text-ink-3" aria-hidden="true" />}
            <span className={check.pass ? 'text-ink-2' : 'text-ink-3'}>{check.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Signup() {
  const [form, setForm] = useState({ name: '', email: '', org: '', password: '', confirm: '', terms: false });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const { signup, busy } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    const email = validateEmail(form.email);
    const password = validatePassword(form.password);
    if (form.name.trim().length < 2) next.name = 'Enter your full name.';
    if (!email.ok) next.email = email.error;
    if (!password.ok) next.password = password.error;
    else if (passwordStrength(form.password).score < 2) next.password = 'Choose a stronger password (add case, numbers or symbols).';
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match.';
    if (!form.terms) next.terms = 'Accept the demo terms to continue.';
    setErrors(next);
    if (Object.keys(next).length) return;

    try {
      await signup({ name: form.name.trim(), email: form.email, password: form.password, org: form.org.trim() });
    } catch (failure) {
      setErrors({ email: failure.message });
      toast.error('Could not create the account', failure.message);
      return;
    }
    toast.success('Workspace created', 'You are signed in.');
    navigate('/dashboard');
  };

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Create your trust workspace"
      description="Set up a demo workspace and explore every detection module with sample data."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand hover:underline">Sign in</Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Full name" htmlFor="signup-name" error={errors.name} required>
          <Input
            id="signup-name"
            icon={FiUser}
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="Aarav Mehta"
            autoComplete="name"
            invalid={Boolean(errors.name)}
          />
        </Field>

        <Field label="Work email" htmlFor="signup-email" error={errors.email} required>
          <Input
            id="signup-email"
            type="email"
            icon={FiMail}
            value={form.email}
            onChange={(event) => update('email', event.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            invalid={Boolean(errors.email)}
          />
        </Field>

        <Field label="Organisation" htmlFor="signup-org" hint="Optional — shown across your workspace.">
          <Input
            id="signup-org"
            icon={FiBriefcase}
            value={form.org}
            onChange={(event) => update('org', event.target.value)}
            placeholder="Northline Security"
            autoComplete="organization"
          />
        </Field>

        <Field label="Password" htmlFor="signup-password" error={errors.password} required>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3">
              <FiLock className="text-[15px]" aria-hidden="true" />
            </span>
            <input
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
              placeholder="Create a password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              className={`h-11 w-full rounded-xl border bg-surface pl-10 pr-11 text-sm text-ink outline-none transition placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand/10 ${errors.password ? 'border-critical/60' : 'border-line-strong'}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ink-3 transition hover:bg-surface-2 hover:text-ink"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <FiEyeOff className="text-[15px]" /> : <FiEye className="text-[15px]" />}
            </button>
          </div>
        </Field>

        <StrengthMeter password={form.password} />

        <Field label="Confirm password" htmlFor="signup-confirm" error={errors.confirm} required>
          <Input
            id="signup-confirm"
            type={showPassword ? 'text' : 'password'}
            icon={FiLock}
            value={form.confirm}
            onChange={(event) => update('confirm', event.target.value)}
            placeholder="Repeat your password"
            autoComplete="new-password"
            invalid={Boolean(errors.confirm)}
          />
        </Field>

        <div className="rounded-xl border border-line bg-surface-2/50 p-3">
          <Checkbox
            label="I accept the demo terms and privacy notice"
            description="This build runs entirely in the browser; no data is stored on a server."
            checked={form.terms}
            onChange={(event) => update('terms', event.target.checked)}
          />
          {errors.terms ? <p className="mt-1.5 text-[12px] text-critical" role="alert">{errors.terms}</p> : null}
        </div>

        <Button type="submit" size="lg" full loading={busy} disabled={busy} iconRight={FiArrowRight}>
          {busy ? 'Creating workspace…' : 'Create account'}
        </Button>

        <Notice tone="neutral">
          Frontend demo — no account, email verification or password is stored anywhere.
        </Notice>
      </form>
    </AuthLayout>
  );
}
