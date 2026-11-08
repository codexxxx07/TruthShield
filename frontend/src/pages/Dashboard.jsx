import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiActivity, FiAlertTriangle, FiArrowRight, FiBell, FiCalendar, FiCheckCircle, FiClock, FiCpu,
  FiDownload, FiExternalLink, FiEye, FiFileText, FiGlobe, FiGrid, FiSearch, FiShield,
  FiTarget, FiTrendingUp, FiUsers, FiZap,
} from 'react-icons/fi';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Badge, { SeverityBadge, VerdictBadge, DemoBadge } from '../components/ui/Badge';
import { Card, SectionCard, DataRow } from '../components/ui/Card';
import OpsStrip from '../components/ui/OpsStrip';
import NetworkTopology from '../components/ui/NetworkTopology';
import TerminalLog from '../components/ui/TerminalLog';
import { SearchInput, Select } from '../components/ui/Field';
import Tabs from '../components/ui/Tabs';
import StatCard from '../components/ui/StatCard';
import DataTable from '../components/ui/DataTable';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import Notice from '../components/ui/Notice';
import { AreaChart, DonutChart } from '../components/ui/Charts';
import { Gauge, ScoreRing, Meter } from '../components/ui/Progress';
import { useDashboardData } from '../lib/useWorkspaceData';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { REPORT_STATUSES } from '../data/reports';
import { normalizeUrl } from '../lib/validation';
import { cn, formatDate, formatDateTime, formatNumber, timeAgo, truncateMiddle } from '../lib/utils';


const ACTIVITY_ICON = {
  alert: FiAlertTriangle,
  report: FiFileText,
  block: FiShield,
  confirm: FiCheckCircle,
  scan: FiSearch,
  cert: FiClock,
  watch: FiEye,
};

const STATUS_TONE = { 'under review': 'high', confirmed: 'critical', triaged: 'medium', rejected: 'neutral', submitted: 'low' };

const EVENT_STREAM = [
  { time: '09:41:12', level: 'ok', text: 'tls.handshake tls1.3 · sni=paypal-secure-login.example' },
  { time: '09:41:13', level: 'info', text: 'dns.resolve a=185.220.101.4 · ttl=60 · asn=64500' },
  { time: '09:41:14', level: 'warn', text: 'domain.age 9d below policy floor (180d)' },
  { time: '09:41:15', level: 'err', text: 'brand.clone paypal 0.96 · favicon match 0.91' },
  { time: '09:41:16', level: 'err', text: 'kit.fingerprint "16shop" confidence=0.94' },
  { time: '09:41:17', level: 'ok', text: 'intel.consensus 4/5 sources malicious' },
  { time: '09:41:18', level: 'ok', text: 'verdict=malicious risk=94/100 scan=TS-9F21C4' },
];

export default function Dashboard() {
  const {
    ACTIVITY_FEED, DAILY_DETECTIONS, OVERVIEW_STATS, RECENT_REPORTS, RISK_BREAKDOWN, SCAN_HISTORY,
    THREAT_DISTRIBUTION, WATCHLIST, live,
  } = useDashboardData();
  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'scans', label: 'Scan history', count: SCAN_HISTORY.length },
    { id: 'reports', label: 'Reports', count: RECENT_REPORTS.length },
    { id: 'activity', label: 'Activity' },
  ];
  const eventLines = live
    ? SCAN_HISTORY.slice(0, 6).reverse().map((scan) => ({
        time: new Date(scan.scannedAt).toLocaleTimeString('en-GB'),
        level: scan.verdict === 'malicious' ? 'err' : scan.verdict === 'suspicious' ? 'warn' : 'ok',
        text: `verdict=${scan.verdict} risk=${scan.score}/100 scan=${scan.id} target=${scan.target}`,
      }))
    : EVENT_STREAM;
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [scanQuery, setScanQuery] = useState('');
  const [verdictFilter, setVerdictFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [quickTarget, setQuickTarget] = useState('');
  const [quickError, setQuickError] = useState('');

  const sources = useMemo(() => ['all', ...new Set(SCAN_HISTORY.map((scan) => scan.source))], [SCAN_HISTORY]);

  const filteredScans = useMemo(() => {
    const needle = scanQuery.trim().toLowerCase();
    return SCAN_HISTORY.filter((scan) => {
      if (needle && !scan.target.toLowerCase().includes(needle) && !scan.id.toLowerCase().includes(needle)) return false;
      if (verdictFilter !== 'all' && scan.verdict !== verdictFilter) return false;
      if (sourceFilter !== 'all' && scan.source !== sourceFilter) return false;
      return true;
    });
  }, [SCAN_HISTORY, scanQuery, verdictFilter, sourceFilter]);

  const pages = Math.max(1, Math.ceil(filteredScans.length / 8));
  const currentPage = Math.min(page, pages);
  const visibleScans = filteredScans.slice((currentPage - 1) * 8, currentPage * 8);

  const quickScan = (event) => {
    event.preventDefault();
    const parsed = normalizeUrl(quickTarget);
    if (!parsed.ok) {
      setQuickError(parsed.error);
      return;
    }
    setQuickError('');
    navigate(`/scan?url=${encodeURIComponent(parsed.url)}`);
  };

  const scanColumns = [
    {
      key: 'target',
      header: 'Target',
      render: (row) => (
        <div className="min-w-0">
          <p className="max-w-[260px] truncate font-mono text-[11.5px] text-ink">{row.target}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.06em] text-ink-3">{row.id} · {row.type}</p>
        </div>
      ),
    },
    { key: 'verdict', header: 'Verdict', render: (row) => <VerdictBadge verdict={row.verdict} size="sm" /> },
    { key: 'score', header: 'Risk', align: 'right', render: (row) => <span className="font-mono text-[11.5px] tabular text-ink-2">{row.score}</span> },
    { key: 'findings', header: 'Signals', align: 'right', render: (row) => <span className="font-mono text-[11.5px] tabular text-ink-3">{row.findings}</span> },
    { key: 'source', header: 'Source', render: (row) => <span className="text-[11.5px] text-ink-2">{row.source}</span> },
    { key: 'scannedAt', header: 'When', render: (row) => <span className="whitespace-nowrap text-[11.5px] text-ink-3">{timeAgo(row.scannedAt)}</span> },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (row) => (
        <button type="button" className="text-[11px] font-medium text-brand" onClick={() => setSelected(row)}>
          Inspect
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title={`Security operations, ${user ? user.name.split(' ')[0] : 'analyst'}.`}
        description={live ? 'Every scan, report and signal from your workspace in one place.' : 'Every scan, report and signal from your workspace in one place. All figures are demo data rendered from the same components used on the public pages.'}
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Dashboard' }]}
        demo={!live}
        compact
        meta={
          <>
            <span className="inline-flex items-center gap-1.5"><FiCalendar className="text-[12px]" aria-hidden="true" /> {formatDate(new Date())}</span>
            <span className="inline-flex items-center gap-1.5"><FiActivity className="text-[12px]" aria-hidden="true" /> Last sync 2 min ago</span>
            <span className="inline-flex items-center gap-1.5"><FiUsers className="text-[12px]" aria-hidden="true" /> {user ? user.org : 'Demo workspace'}</span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="md" icon={FiBell} onClick={() => toast.info('3 unread alerts', 'Certificate and campaign alerts are shown in the activity feed.')}>
              Alerts
            </Button>
            <Button to="/scan" size="md" iconRight={FiArrowRight}>New scan</Button>
          </>
        }
      />

      <div className="shell py-7 lg:py-9">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {OVERVIEW_STATS.map((stat) => (
            <StatCard
              key={stat.id}
              label={stat.label}
              value={stat.value}
              delta={stat.delta}
              trend={stat.trend}
              hint={stat.hint}
              tone={stat.tone || 'brand'}
              spark={stat.spark}
              icon={stat.id === 'scanned' ? FiSearch : stat.id === 'malicious' ? FiAlertTriangle : stat.id === 'suspicious' ? FiEye : stat.id === 'reported' ? FiFileText : FiShield}
            />
          ))}
        </div>

        <div className="mt-4">
          {!live ? <OpsStrip /> : null}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs items={TABS} value={tab} onChange={(next) => { setTab(next); setPage(1); }} variant="pill" ariaLabel="Dashboard sections" />
          <div className="flex items-center gap-2">
            <Badge tone={live ? 'safe' : 'neutral'} dot>{live ? 'Live workspace' : 'Simulated workspace'}</Badge>
            <Button
              variant="ghost"
              size="sm"
              icon={FiDownload}
              onClick={() => toast.info('Export queued', 'In a connected build this would generate a CSV of the current view.')}
            >
              Export
            </Button>
          </div>
        </div>

        {tab === 'overview' ? (
          <>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
              <Card className="top-sheen overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
                  <div>
                    <p className="text-[13px] font-semibold text-ink">Global sensor mesh</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-3">Edge nodes, hostile clusters and core routing</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="safe" dot>mesh healthy</Badge>
                    <DemoBadge />
                  </div>
                </div>
                <NetworkTopology className="px-2 py-2" />
                <div className="grid grid-cols-3 divide-x divide-line/60 border-t border-line bg-surface-2/30">
                  {[
                    { label: 'Edges online', value: '7 / 7' },
                    { label: 'Observed clusters', value: '1' },
                    { label: 'Median RTT', value: '38 ms' },
                  ].map((item) => (
                    <div key={item.label} className="px-4 py-2.5">
                      <p className="hud-label">{item.label}</p>
                      <p className="mt-1 font-mono text-[12px] text-ink">{item.value}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="top-sheen flex flex-col overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5">
                  <div>
                    <p className="text-[13px] font-semibold text-ink">Event stream</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-3">Latest pipeline trace</p>
                  </div>
                  <Badge tone="neutral" size="sm">7 events</Badge>
                </div>
                <div className="flex-1 p-3">
                  <TerminalLog
                    title="truthshield@mesh · trace"
                    lines={eventLines}
                    live
                    className="flex h-full flex-col"
                    bodyClassName="min-h-[214px] flex-1"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2/30 px-4 py-2">
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">buffer 7/512 · demo</span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-safe">stream nominal</span>
                </div>
              </Card>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-4">
              <Card className="top-sheen p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-ink">Detection volume</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-3">Last 14 days · verdicts by category</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="safe" dot>+12.4%</Badge>
                    <Badge tone="neutral">14d</Badge>
                  </div>
                </div>
                <AreaChart
                  className="mt-5"
                  height={200}
                  labels={DAILY_DETECTIONS.map((day) => day.day)}
                  series={[
                    { key: 'safe', color: 'var(--safe)', data: DAILY_DETECTIONS.map((day) => day.safe) },
                    { key: 'suspicious', color: 'var(--medium)', data: DAILY_DETECTIONS.map((day) => day.suspicious) },
                    { key: 'malicious', color: 'var(--critical)', data: DAILY_DETECTIONS.map((day) => day.malicious) },
                  ]}
                />
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3 text-[11px] text-ink-2">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-safe" /> Safe</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-medium" /> Suspicious</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-critical" /> Malicious</span>
                  <span className="ml-auto font-mono text-[10.5px] text-ink-3">peak 734 · daily</span>
                </div>
              </Card>

              <SectionCard
                title="Recent scans"
                description="Latest verdicts across all sources"
                icon={FiSearch}
                action={<button type="button" onClick={() => setTab('scans')} className="text-[11px] font-medium text-brand">View all</button>}
                flush
              >
                <ul className="divide-y divide-line/70">
                  {SCAN_HISTORY.slice(0, 6).map((scan) => (
                    <li key={scan.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(scan)}
                        className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-surface-2/60"
                      >
                        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', scan.verdict === 'malicious' ? 'bg-critical' : scan.verdict === 'suspicious' ? 'bg-medium' : 'bg-safe')} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-mono text-[11.5px] text-ink">{truncateMiddle(scan.target, 34, 10)}</span>
                          <span className="mt-0.5 block text-[10px] text-ink-3">{scan.source} · {timeAgo(scan.scannedAt)}</span>
                        </span>
                        <VerdictBadge verdict={scan.verdict} size="sm" />
                        <span className="hidden w-8 text-right font-mono text-[11px] tabular text-ink-3 sm:block">{scan.score}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </SectionCard>

              <SectionCard title="Risk-level breakdown" description="Distribution of all 18,429 scans" icon={FiGrid}>
                <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
                  <ScoreRing value={78} tone="medium" className="mx-auto h-28 w-28" stroke={8} valueClassName="text-[22px]" caption="weighted" />
                  <div className="space-y-2.5">
                    {RISK_BREAKDOWN.map((row) => (
                      <div key={row.label}>
                        <div className="flex items-baseline justify-between text-[11.5px]">
                          <span className="text-ink-2">{row.label}</span>
                          <span className="font-mono tabular text-ink-3">{formatNumber(row.value)} · {((row.value / row.total) * 100).toFixed(1)}%</span>
                        </div>
                        <Meter value={(row.value / row.total) * 100} tone={row.tone} className="mt-1.5" />
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>
            </div>

            <div className="space-y-4">
              <Card className="top-sheen p-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg border border-brand/25 bg-brand/10 text-brand">
                    <FiZap className="text-[14px]" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[12.5px] font-semibold text-ink">Quick scan</p>
                    <p className="text-[10.5px] text-ink-3">Runs the full URL pipeline</p>
                  </div>
                </div>
                <form onSubmit={quickScan} className="mt-3" noValidate>
                  <div className="flex gap-2">
                    <input
                      value={quickTarget}
                      onChange={(event) => {
                        setQuickTarget(event.target.value);
                        if (quickError) setQuickError('');
                      }}
                      placeholder="example.com"
                      aria-label="Quick scan target"
                      className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 font-mono text-[11.5px] text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
                    />
                    <Button type="submit" size="sm" className="h-10 shrink-0 px-3" icon={FiArrowRight} aria-label="Run quick scan" />
                  </div>
                  {quickError ? <p className="mt-1.5 text-[11px] text-critical" role="alert">{quickError}</p> : null}
                </form>
              </Card>

              <SectionCard title="Threat distribution" description="Confirmed indicators" icon={FiTarget}>
                <DonutChart
                  data={THREAT_DISTRIBUTION.map((item) => ({ label: item.label, value: item.value, color: item.color }))}
                  centerValue="12.9k"
                  centerLabel="total"
                  size="h-32 w-32"
                  thickness={12}
                />
              </SectionCard>

              <SectionCard title="Recent security reports" description="Community submissions" icon={FiFileText} action={<Badge tone="brand" size="sm">{RECENT_REPORTS.length}</Badge>} flush>
                <ul className="divide-y divide-line/70">
                  {RECENT_REPORTS.slice(0, 4).map((report) => (
                    <li key={report.id} className="px-4 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate font-mono text-[10.5px] text-ink">{report.target}</p>
                        <Badge tone={STATUS_TONE[report.status]} size="sm">{report.status}</Badge>
                      </div>
                      <p className="mt-0.5 text-[10px] text-ink-3">{report.category} · {report.reporter} · {timeAgo(report.submittedAt)}</p>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-line px-4 py-2">
                  <button type="button" onClick={() => setTab('reports')} className="text-[11px] font-medium text-brand">All reports</button>
                </div>
              </SectionCard>

              <SectionCard title="Activity" description="What changed recently" icon={FiActivity} flush>
                <ul className="divide-y divide-line/70">
                  {ACTIVITY_FEED.slice(0, 5).map((item) => {
                    const Icon = ACTIVITY_ICON[item.kind] || FiActivity;
                    return (
                      <li key={item.id} className="flex items-start gap-2.5 px-4 py-2.5">
                        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-line bg-surface-2 text-ink-3">
                          <Icon className="text-[11px]" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] leading-4 text-ink-2">
                            <span className="font-medium text-ink">{item.actor}</span> {item.action}{' '}
                            <span className="font-mono text-[10.5px] text-ink">{item.target}</span>
                          </p>
                          <p className="mt-0.5 text-[9.5px] text-ink-3">{timeAgo(item.time)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="border-t border-line px-4 py-2">
                  <button type="button" onClick={() => setTab('activity')} className="text-[11px] font-medium text-brand">Full activity log</button>
                </div>
              </SectionCard>
            </div>
          </div>
          </>
        ) : null}

        {tab === 'scans' ? (
          <div className="mt-4 space-y-4">
            <Card className="p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <SearchInput
                  value={scanQuery}
                  onChange={(next) => { setScanQuery(next); setPage(1); }}
                  onClear={() => setScanQuery('')}
                  placeholder="Search target or scan ID…"
                  className="flex-1"
                />
                <div className="grid grid-cols-2 gap-2 sm:w-auto">
                  <Select value={verdictFilter} onChange={(event) => { setVerdictFilter(event.target.value); setPage(1); }} aria-label="Filter by verdict" className="h-11 text-[12px]">
                    <option value="all">All verdicts</option>
                    <option value="safe">Safe</option>
                    <option value="suspicious">Suspicious</option>
                    <option value="malicious">Malicious</option>
                  </Select>
                  <Select value={sourceFilter} onChange={(event) => { setSourceFilter(event.target.value); setPage(1); }} aria-label="Filter by source" className="h-11 text-[12px]">
                    {sources.map((source) => <option key={source} value={source}>{source === 'all' ? 'All sources' : source}</option>)}
                  </Select>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3">
                <span className="text-[11px] text-ink-3">{filteredScans.length} scans · {filteredScans.filter((scan) => scan.verdict === 'malicious').length} malicious</span>
                {(scanQuery || verdictFilter !== 'all' || sourceFilter !== 'all') ? (
                  <button
                    type="button"
                    onClick={() => { setScanQuery(''); setVerdictFilter('all'); setSourceFilter('all'); }}
                    className="text-[11px] font-medium text-brand"
                  >
                    Clear filters
                  </button>
                ) : null}
                <span className="ml-auto inline-flex items-center gap-1.5 text-[10.5px] text-ink-3">
                  <FiCpu className="text-[11px]" aria-hidden="true" /> {live ? 'live records' : 'simulated records'}
                </span>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <DataTable
                columns={scanColumns}
                rows={visibleScans}
                rowKey={(row) => row.id}
                onRowClick={setSelected}
                minWidth={880}
                empty={<EmptyState icon={FiSearch} title="No scans match" description="Try a different search term or verdict filter." compact />}
                mobileRenderer={(row) => (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 break-all font-mono text-[11px] text-ink">{row.target}</p>
                      <VerdictBadge verdict={row.verdict} size="sm" />
                    </div>
                    <p className="mt-1 text-[10.5px] text-ink-3">{row.source} · {timeAgo(row.scannedAt)} · risk {row.score}</p>
                  </div>
                )}
              />
              <div className="border-t border-line px-4 py-3">
                <Pagination page={currentPage} pages={pages} total={filteredScans.length} pageSize={8} onChange={(next) => setPage(Math.min(Math.max(next, 1), pages))} />
              </div>
            </Card>
          </div>
        ) : null}

        {tab === 'reports' ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <div>
                  <p className="text-[13px] font-semibold text-ink">Submitted reports</p>
                  <p className="mt-0.5 text-[11.5px] text-ink-3">Status updates from the analyst queue</p>
                </div>
                <Button to="/report-threat" size="sm" variant="secondary" iconRight={FiArrowRight}>New report</Button>
              </div>
              <ul className="divide-y divide-line/70">
                {RECENT_REPORTS.map((report) => (
                  <li key={report.id} className="px-5 py-3.5 transition hover:bg-surface-2/50">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10.5px] text-ink-3">{report.id}</span>
                      <Badge tone={STATUS_TONE[report.status]} size="sm">{report.status}</Badge>
                      <span className="ml-auto text-[10.5px] text-ink-3">{timeAgo(report.submittedAt)}</span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[11.5px] text-ink">{report.target}</p>
                    <p className="mt-0.5 text-[10.5px] text-ink-3">{report.category} · submitted by {report.reporter}</p>
                  </li>
                ))}
              </ul>
            </Card>

            <div className="space-y-4">
              <SectionCard title="Report pipeline" description="Current queue health" icon={FiFileText}>
                <div className="space-y-3">
                  {REPORT_STATUSES.map((status, index) => {
                    const values = [42, 18, 11, 4];
                    return (
                      <div key={status.id}>
                        <div className="flex items-baseline justify-between text-[11.5px]">
                          <span className="text-ink-2">{status.label}</span>
                          <span className="font-mono tabular text-ink-3">{values[index]}</span>
                        </div>
                        <Meter value={(values[index] / 42) * 100} tone={status.tone === 'critical' ? 'critical' : status.tone} className="mt-1.5" />
                      </div>
                    );
                  })}
                </div>
              </SectionCard>

              <SectionCard title="Watchlist" description="Brands under certificate monitoring" icon={FiEye} flush>
                <ul className="divide-y divide-line/70">
                  {WATCHLIST.map((item) => (
                    <li key={item.domain} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[11px] text-ink">{item.domain}</p>
                        <p className="text-[10px] text-ink-3">{item.brand} · {item.lookalikes} lookalikes</p>
                      </div>
                      <Badge tone={item.alerts > 0 ? 'medium' : 'safe'} size="sm">{item.alerts > 0 ? `${item.alerts} alerts` : 'clear'}</Badge>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            </div>
          </div>
        ) : null}

        {tab === 'activity' ? (
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <SectionCard title="Activity log" description="Scans, alerts and report events" icon={FiActivity}>
              <ol className="rail space-y-4">
                {ACTIVITY_FEED.map((item) => {
                  const Icon = ACTIVITY_ICON[item.kind] || FiActivity;
                  return (
                    <li key={item.id} className="relative flex gap-3">
                      <span className="z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink-3">
                        <Icon className="text-[11px]" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] leading-5 text-ink-2">
                          <span className="font-medium text-ink">{item.actor}</span> {item.action}{' '}
                          <span className="font-mono text-[11px] text-ink">{item.target}</span>
                        </p>
                        <p className="mt-0.5 text-[10px] text-ink-3">{timeAgo(item.time)} · {item.kind}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </SectionCard>

            <div className="space-y-4">
              <SectionCard title="Detection statistics" description="Model behaviour (demo)" icon={FiTrendingUp}>
                <div className="space-y-3">
                  <Gauge label="Precision" value={98} tone="safe" />
                  <Gauge label="Recall" value={95} tone="brand" />
                  <Gauge label="False positives" value={1.8} tone="medium" />
                  <Gauge label="Analyst agreement" value={94} tone="safe" />
                </div>
              </SectionCard>
              <SectionCard title="Quick actions" description="Jump into a workflow" icon={FiArrowRight}>
                <div className="grid gap-2">
                  <Button to="/scan" variant="secondary" size="sm" full iconRight={FiArrowRight}>Scan a URL</Button>
                  <Button to="/report-threat" variant="secondary" size="sm" full iconRight={FiArrowRight}>Submit a report</Button>
                  <Button to="/threat-intelligence" variant="secondary" size="sm" full iconRight={FiArrowRight}>Search indicators</Button>
                  <Button to="/advanced" variant="ghost" size="sm" full iconRight={FiExternalLink}>Open detection modules</Button>
                </div>
              </SectionCard>
            </div>
          </div>
        ) : null}

        <div className="mt-5">
          <Notice tone="neutral" icon={FiCpu} title="Demo workspace">
            This dashboard is a frontend demonstration. Scan counts, reports and activity are seeded mock data; no
            account, database or scan service is connected.
          </Notice>
        </div>
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? truncateMiddle(selected.target, 40, 16) : 'Scan detail'}
        description={selected ? `${selected.id} · ${selected.source}` : undefined}
        size="md"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-ink-3">{selected ? formatDateTime(selected.scannedAt) : ''}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setSelected(null)}>Close</Button>
              <Button size="sm" to={`/scan?url=${encodeURIComponent(selected?.type === 'IP' ? `http://${selected?.target}` : `https://${selected?.target}`)}`} iconRight={FiArrowRight}>
                Re-scan target
              </Button>
            </div>
          </div>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <ScoreRing
                value={selected.score}
                className="h-24 w-24"
                stroke={7}
                valueClassName="text-[22px]"
                caption="risk"
                tone={selected.verdict === 'malicious' ? 'critical' : selected.verdict === 'suspicious' ? 'medium' : 'safe'}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <VerdictBadge verdict={selected.verdict} />
                  <Badge tone="neutral">{selected.type}</Badge>
                  <SeverityBadge severity={selected.verdict === 'malicious' ? 'critical' : selected.verdict === 'suspicious' ? 'medium' : 'safe'} />
                </div>
                <p className="mt-2 break-all font-mono text-[11.5px] text-ink">{selected.target}</p>
                <p className="mt-1.5 text-[11.5px] text-ink-3">
                  {selected.findings} contributing signal{selected.findings === 1 ? '' : 's'} · scanned {timeAgo(selected.scannedAt)}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-3">Scan metadata</h4>
                <div className="mt-1.5">
                  <DataRow label="Scan ID" value={selected.id} mono />
                  <DataRow label="Source" value={selected.source} />
                  <DataRow label="Scanned at" value={formatDateTime(selected.scannedAt)} />
                  <DataRow label="Type" value={selected.type} />
                </div>
              </div>
              <div>
                <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-3">Verdict</h4>
                <div className="mt-1.5">
                  <DataRow label="Classification" value={selected.verdict} />
                  <DataRow label="Risk score" value={`${selected.score}/100`} />
                  <DataRow label="Signals" value={selected.findings} />
                  <DataRow label="Confidence" value={`${Math.min(99, selected.score + 4)}%`} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-line bg-surface-2/60 p-3">
              <p className="flex items-start gap-2 text-[11px] leading-5 text-ink-2">
                <FiGlobe className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
                Open the full scan to review indicators, redirect hops, certificate posture and source consensus.
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
