import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiAlertTriangle, FiArrowRight, FiCheck, FiCheckCircle, FiClock, FiCpu, FiFileText, FiGlobe,
  FiInfo, FiRefreshCw, FiSend, FiShield, FiUsers,
} from 'react-icons/fi';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Badge, { DemoBadge } from '../components/ui/Badge';
import { Card, SectionCard } from '../components/ui/Card';
import { Field, Input, Textarea, Checkbox } from '../components/ui/Field';
import FileDrop from '../components/ui/FileDrop';
import Notice from '../components/ui/Notice';
import { REPORT_CATEGORIES, REPORT_IMPACT, REPORT_STATUSES, RECENT_COMMUNITY_REPORTS } from '../data/reports';
import { normalizeUrl, validateEmail, validateFile } from '../lib/validation';
import { cn, makeId } from '../lib/utils';
import { useToast } from '../context/ToastContext';

const MAX_DESCRIPTION = 800;

function CategoryTiles({ value, onChange, error }) {
  return (
    <div>
      <p className="text-[12.5px] font-medium text-ink">
        Threat category <span className="text-critical">*</span>
      </p>
      <div className="mt-1.5 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Threat category">
        {REPORT_CATEGORIES.map((category) => {
          const active = value === category.label;
          return (
            <button
              key={category.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(category.label)}
              className={cn(
                'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all',
                active
                  ? 'border-brand/40 bg-brand/[0.07] shadow-[var(--shadow-xs)]'
                  : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2/60',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border',
                  active ? 'border-brand bg-brand text-on-brand' : 'border-line-strong bg-surface',
                )}
              >
                {active ? <FiCheck className="text-[9px]" aria-hidden="true" /> : null}
              </span>
              <span className="min-w-0">
                <span className={cn('block text-[12px] font-medium', active ? 'text-brand' : 'text-ink')}>{category.label}</span>
                <span className="mt-0.5 block text-[10.5px] leading-4 text-ink-3">{category.description}</span>
              </span>
            </button>
          );
        })}
      </div>
      {error ? <p className="mt-1.5 text-[12px] text-critical" role="alert">{error}</p> : null}
    </div>
  );
}

function StatusTracker({ activeIndex = 0 }) {
  return (
    <ol className="rail space-y-3">
      {REPORT_STATUSES.map((status, index) => {
        const complete = index < activeIndex;
        const active = index === activeIndex;
        return (
          <li key={status.id} className="relative flex gap-3">
            <span
              className={cn(
                'z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px]',
                complete && 'border-safe/35 bg-safe/15 text-safe',
                active && 'border-brand/40 bg-brand/15 text-brand',
                !complete && !active && 'border-line bg-surface text-ink-3',
              )}
            >
              {complete ? <FiCheck aria-hidden="true" /> : active ? <span className="h-1.5 w-1.5 rounded-full bg-current anim-blink" /> : index + 1}
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <p className={cn('text-[12px] font-medium', active ? 'text-ink' : complete ? 'text-ink-2' : 'text-ink-3')}>
                {status.label}
              </p>
              <p className="text-[10.5px] leading-4 text-ink-3">{status.description}</p>
            </div>
            {active ? <Badge tone={status.tone} size="sm">now</Badge> : null}
          </li>
        );
      })}
    </ol>
  );
}

export default function ReportThreat() {
  const [form, setForm] = useState({ url: '', category: '', description: '', details: '', email: '', consent: false });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const toast = useToast();

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    const parsed = normalizeUrl(form.url);
    if (!parsed.ok) next.url = parsed.error;
    if (!form.category) next.category = 'Choose the category that best matches this site.';
    if (form.description.trim().length < 20) next.description = 'Describe what happened in at least 20 characters.';
    if (form.description.length > MAX_DESCRIPTION) next.description = 'Keep the description under 800 characters.';
    if (form.email.trim()) {
      const email = validateEmail(form.email);
      if (!email.ok) next.email = email.error;
    }
    if (file) {
      const checked = validateFile(file);
      if (!checked.ok) next.file = checked.error;
    }
    if (!form.consent) next.consent = 'Confirm the report is accurate before submitting.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (event) => {
    event.preventDefault();
    if (!validate()) {
      toast.error('Check the highlighted fields', 'A few details are missing or invalid.');
      return;
    }
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      setSubmitted({
        id: makeId('RPT'),
        url: normalizeUrl(form.url).url,
        category: form.category,
        description: form.description,
        evidence: file ? file.name : null,
        submittedAt: new Date().toISOString(),
      });
      toast.success('Report submitted', 'Your submission is queued for triage.');
    }, 1100);
  };

  const reset = () => {
    setForm({ url: '', category: '', description: '', details: '', email: '', consent: false });
    setFile(null);
    setErrors({});
    setSubmitted(null);
  };

  return (
    <>
      <PageHeader
        eyebrow="Report a threat"
        title="Report a suspicious website."
        description="Your report feeds the community corpus. Include the exact URL and evidence — confirmed reports are published as indicators within hours."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Report Threat' }]}
        demo
        meta={
          <>
            <span className="inline-flex items-center gap-1.5"><FiClock className="text-[12px]" aria-hidden="true" /> Median triage 3h 20m</span>
            <span className="inline-flex items-center gap-1.5"><FiUsers className="text-[12px]" aria-hidden="true" /> 12,480 community reporters</span>
          </>
        }
        actions={<Button to="/threat-intelligence" variant="secondary" size="md" iconRight={FiArrowRight}>Threat database</Button>}
      />

      <div className="shell py-8 lg:py-10">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            {submitted ? (
              <Card className="overflow-hidden anim-fade">
                <div className="h-1 w-full bg-safe" />
                <div className="p-6 sm:p-8">
                  <span className="grid h-12 w-12 place-items-center rounded-full border border-safe/30 bg-safe/10 text-safe">
                    <FiCheckCircle className="text-xl" aria-hidden="true" />
                  </span>
                  <h2 className="mt-4 text-[22px] font-semibold tracking-[-0.03em] text-ink">Report received</h2>
                  <p className="mt-1.5 max-w-lg text-[13px] leading-6 text-ink-2">
                    Your submission is queued for triage. Keep the reference below — analysts may request additional
                    evidence before confirming the indicator.
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-line bg-surface-2/60 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-[0.08em] text-ink-3">Reference</p>
                      <p className="mt-1 font-mono text-[15px] font-semibold text-ink">{submitted.id}</p>
                    </div>
                    <div className="rounded-xl border border-line bg-surface-2/60 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-[0.08em] text-ink-3">Category</p>
                      <p className="mt-1 truncate text-[13px] font-medium text-ink">{submitted.category}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-line bg-surface p-4">
                    <p className="break-all font-mono text-[11.5px] text-ink">{submitted.url}</p>
                    <p className="mt-2 text-[11.5px] leading-5 text-ink-2">{submitted.description}</p>
                    {submitted.evidence ? (
                      <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-ink-3">
                        <FiFileText className="text-[11px]" aria-hidden="true" /> Attached: {submitted.evidence}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-6">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">Status</p>
                    <div className="mt-3">
                      <StatusTracker activeIndex={0} />
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" icon={FiRefreshCw} onClick={reset}>Report another</Button>
                    <Button size="sm" to="/dashboard" iconRight={FiArrowRight}>Open dashboard</Button>
                    <Button size="sm" variant="ghost" to={`/scan?url=${encodeURIComponent(submitted.url)}`} icon={FiShield}>Scan this URL</Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <div className="border-b border-line px-5 py-4">
                  <h2 className="text-[14px] font-semibold text-ink">Submission details</h2>
                  <p className="mt-0.5 text-[12px] text-ink-2">Fields marked with * are required.</p>
                </div>
                <form onSubmit={submit} noValidate className="space-y-5 px-5 py-5">
                  <Field
                    label="Suspicious website URL"
                    htmlFor="report-url"
                    error={errors.url}
                    hint="Paste the exact link, including any path or query parameters."
                    required
                  >
                    <Input
                      id="report-url"
                      icon={FiGlobe}
                      value={form.url}
                      onChange={(event) => update('url', event.target.value)}
                      placeholder="https://secure-login.example/verify"
                      spellCheck="false"
                      autoComplete="off"
                      invalid={Boolean(errors.url)}
                    />
                  </Field>

                  <CategoryTiles value={form.category} onChange={(value) => update('category', value)} error={errors.category} />

                  <Field
                    label="What happened?"
                    htmlFor="report-description"
                    error={errors.description}
                    action={<span className={cn('font-mono text-[10.5px] tabular', form.description.length > MAX_DESCRIPTION ? 'text-critical' : 'text-ink-3')}>{form.description.length}/{MAX_DESCRIPTION}</span>}
                    hint="Mention how you reached the site, what it asked for and any suspicious behaviour."
                    required
                  >
                    <Textarea
                      id="report-description"
                      value={form.description}
                      onChange={(event) => update('description', event.target.value.slice(0, MAX_DESCRIPTION))}
                      placeholder="I received an SMS claiming my KYC had expired. The link opened a page asking for my net-banking password and OTP…"
                      invalid={Boolean(errors.description)}
                      rows={5}
                    />
                  </Field>

                  <div>
                    <div className="flex items-baseline justify-between">
                      <p className="text-[12.5px] font-medium text-ink">Evidence screenshot</p>
                      <span className="text-[10.5px] text-ink-3">optional</span>
                    </div>
                    <FileDrop
                      file={file}
                      onFile={(next) => {
                        setFile(next);
                        setErrors((current) => ({ ...current, file: undefined }));
                      }}
                      onClear={() => setFile(null)}
                      error={errors.file}
                      className="mt-1.5"
                    />
                  </div>

                  <Field
                    label="Additional information"
                    htmlFor="report-details"
                    hint="Registrar, hosting provider, sender address, campaign name — anything that helps triage."
                  >
                    <Textarea
                      id="report-details"
                      value={form.details}
                      onChange={(event) => update('details', event.target.value)}
                      placeholder="Sender: +91-XXXXX-XXXXX · Received 08 Nov, 09:12 IST · Registrar: Hostinger"
                      rows={3}
                    />
                  </Field>

                  <Field
                    label="Contact email"
                    htmlFor="report-email"
                    error={errors.email}
                    hint="Optional. Used only if an analyst needs to follow up."
                  >
                    <Input
                      id="report-email"
                      type="email"
                      value={form.email}
                      onChange={(event) => update('email', event.target.value)}
                      placeholder="you@company.com"
                      autoComplete="email"
                      invalid={Boolean(errors.email)}
                    />
                  </Field>

                  <div className="rounded-xl border border-line bg-surface-2/50 p-3.5">
                    <Checkbox
                      label="I confirm this report is accurate to the best of my knowledge"
                      description="Submitting knowingly false reports can suspend your reporting privileges."
                      checked={form.consent}
                      onChange={(event) => update('consent', event.target.checked)}
                    />
                    {errors.consent ? <p className="mt-1.5 text-[12px] text-critical" role="alert">{errors.consent}</p> : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                    <p className="flex items-center gap-1.5 text-[10.5px] text-ink-3">
                      <FiCpu className="text-[11px]" aria-hidden="true" /> Frontend demo — nothing is transmitted
                    </p>
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" size="md" onClick={reset}>Clear</Button>
                      <Button type="submit" size="md" icon={FiSend} loading={submitting} disabled={submitting}>
                        {submitting ? 'Submitting…' : 'Submit report'}
                      </Button>
                    </div>
                  </div>
                </form>
              </Card>
            )}
          </div>

          <aside className="space-y-4">
            <SectionCard title="Report lifecycle" description="What happens after submission" icon={FiShield}>
              <StatusTracker activeIndex={submitted ? 0 : 0} />
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
                {REPORT_IMPACT.map((item) => (
                  <div key={item.label}>
                    <p className="text-[13px] font-semibold tabular text-ink">{item.value}</p>
                    <p className="mt-0.5 text-[9.5px] leading-3 text-ink-3">{item.label}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="What makes a good report" description="Improves confirmation speed" icon={FiInfo}>
              <ul className="space-y-2">
                {[
                  'The exact URL as delivered, not a screenshot of the address bar',
                  'Which channel delivered it (SMS, email, ad, social)',
                  'What the site requested: password, OTP, card, UPI PIN',
                  'A screenshot with the address bar visible',
                  'Any sender number or email address',
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-2">
                    <FiCheck className="mt-0.5 shrink-0 text-[11px] text-safe" aria-hidden="true" />
                    <span className="text-[11.5px] leading-5 text-ink-2">{tip}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Recent community reports" description="Last 12 hours" icon={FiUsers} flush>
              <ul className="divide-y divide-line/70">
                {RECENT_COMMUNITY_REPORTS.map((report) => {
                  const status = REPORT_STATUSES.find((entry) => entry.id === report.status);
                  return (
                    <li key={report.id} className="flex items-start gap-2.5 px-4 py-2.5">
                      <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', report.status === 'confirmed' ? 'bg-critical' : report.status === 'review' ? 'bg-high' : 'bg-medium')} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[10.5px] text-ink">{report.target}</p>
                        <p className="mt-0.5 text-[10px] text-ink-3">{report.category} · {report.time} · {report.reporter}</p>
                      </div>
                      <Badge tone={status?.tone || 'neutral'} size="sm">{status?.label || report.status}</Badge>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-line px-4 py-2.5">
                <Link to="/threat-intelligence" className="arrow-link inline-flex items-center gap-1 text-[11px] font-medium text-brand">
                  Browse all indicators <FiArrowRight className="arrow-link-icon text-[11px]" aria-hidden="true" />
                </Link>
              </div>
            </SectionCard>

            <Notice tone="warning" icon={FiAlertTriangle} title="Never submit live credentials">
              Do not include passwords, OTPs or full card numbers in a report. Redact them in screenshots before uploading.
            </Notice>

            <DemoBadge className="w-full justify-center" />
          </aside>
        </div>
      </div>
    </>
  );
}
