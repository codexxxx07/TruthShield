import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEye, FiEyeOff, FiLock, FiMail, FiInfo, FiArrowRight, FiCheckCircle } from 'react-icons/fi';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import { Field, Input } from '../components/ui/Field';
import Modal from '../components/ui/Modal';
import Notice from '../components/ui/Notice';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { validateEmail, validatePassword } from '../lib/validation';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const { login, busy } = useAuth();
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
    if (!email.ok) next.email = email.error;
    if (!password.ok) next.password = password.error;
    setErrors(next);
    if (Object.keys(next).length) return;

    try {
      await login({ email: form.email, password: form.password, remember: form.remember });
    } catch (failure) {
      setErrors({ password: failure.message });
      toast.error('Could not sign in', failure.message);
      return;
    }
    toast.success('Welcome back', 'You are signed in.');
    navigate('/dashboard');
  };

  const useDemo = () => {
    setForm({ email: 'analyst@truthshield.demo', password: 'truthshield-demo', remember: true });
    setErrors({});
    toast.info('Demo credentials filled', 'Submit the form to enter the workspace.');
  };

  const sendReset = (event) => {
    event.preventDefault();
    const email = validateEmail(forgotEmail);
    if (!email.ok) {
      setForgotError(email.error);
      return;
    }
    setForgotError('');
    setResetSent(true);
  };

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to your workspace"
      description="Access scans, detections and the report queue for your organisation."
      footer={
        <>
          New to TruthShield?{' '}
          <Link to="/signup" className="font-medium text-brand hover:underline">Create an account</Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Work email" htmlFor="login-email" error={errors.email} required>
          <Input
            id="login-email"
            type="email"
            icon={FiMail}
            value={form.email}
            onChange={(event) => update('email', event.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            invalid={Boolean(errors.email)}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="login-password"
          error={errors.password}
          required
          action={
            <button type="button" onClick={() => setForgotOpen(true)} className="text-[11.5px] font-medium text-brand hover:underline">
              Forgot password?
            </button>
          }
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3">
              <FiLock className="text-[15px]" aria-hidden="true" />
            </span>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
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

        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={form.remember}
            onChange={(event) => update('remember', event.target.checked)}
            className="h-4 w-4 appearance-none rounded-[5px] border border-line-strong bg-surface checked:border-brand checked:bg-brand"
          />
          <span className="text-[12px] text-ink-2">Keep me signed in for 30 days</span>
        </label>

        <Button type="submit" size="lg" full loading={busy} disabled={busy} iconRight={FiArrowRight}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink-3">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <Button type="button" variant="secondary" size="md" full onClick={useDemo} icon={FiInfo}>
          Use the demo account
        </Button>

        <Notice tone="neutral" icon={FiInfo} className="mt-1">
          This is a frontend-only demo. Any valid email and an 8+ character password will sign you in locally.
        </Notice>
      </form>

      <Modal
        open={forgotOpen}
        onClose={() => {
          setForgotOpen(false);
          setResetSent(false);
        }}
        title="Reset your password"
        description="We will send a reset link to your work email."
        size="sm"
      >
        {resetSent ? (
          <div className="text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-safe/30 bg-safe/10 text-safe">
              <FiCheckCircle className="text-lg" aria-hidden="true" />
            </span>
            <p className="mt-3 text-[13px] font-semibold text-ink">Check your inbox</p>
            <p className="mt-1 text-[12px] leading-5 text-ink-2">
              If an account exists for {forgotEmail}, a reset link is on its way. The link expires in 30 minutes.
            </p>
            <p className="mt-3 text-[10.5px] text-ink-3">Demo only — no email was sent.</p>
            <Button size="sm" variant="secondary" className="mt-4" onClick={() => { setForgotOpen(false); setResetSent(false); }}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <form
            onSubmit={sendReset}
            noValidate
            className="space-y-4"
          >
            <Field label="Work email" htmlFor="reset-email" error={forgotError} required>
              <Input
                id="reset-email"
                type="email"
                icon={FiMail}
                value={forgotEmail}
                onChange={(event) => {
                  setForgotEmail(event.target.value);
                  if (forgotError) setForgotError('');
                }}
                placeholder="you@company.com"
                invalid={Boolean(forgotError)}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setForgotOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" iconRight={FiArrowRight}>Send reset link</Button>
            </div>
          </form>
        )}
      </Modal>
    </AuthLayout>
  );
}
