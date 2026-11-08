import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiActivity, FiAlertTriangle, FiArrowRight, FiClock, FiCpu, FiDatabase, FiDownload, FiFilter,
  FiGlobe, FiRefreshCw, FiSearch, FiShield, FiTarget, FiTrendingUp, FiUsers, FiX,
} from 'react-icons/fi';

import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Badge, { DemoBadge, SeverityBadge, VerdictBadge } from '../components/ui/Badge';
import { Card, SectionCard, DataRow } from '../components/ui/Card';
import { Select } from '../components/ui/Field';
import DataTable from '../components/ui/DataTable';
import Pagination from '../components/ui/Pagination';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import CopyButton from '../components/ui/CopyButton';
import Notice from '../components/ui/Notice';
import Tabs from '../components/ui/Tabs';
import { AreaChart } from '../components/ui/Charts';
import { Meter } from '../components/ui/Progress';
import StatCard from '../components/ui/StatCard';
import { REPORT_STATUSES } from '../data/reports';
import { useThreatData } from '../lib/useWorkspaceData';
import { useToast } from '../context/ToastContext';
import { cn, formatDate, formatDateTime, formatNumber, timeAgo } from '../lib/utils';

const PAGE_SIZE = 8;

const SEVERITY_META = [
  { value: 'all', label: 'All', active: 'border-brand/30 bg-brand/10 text-brand' },
  { value: 'critical', label: 'Critical', active: 'border-critical/40 bg-critical/10 text-critical' },
  { value: 'high', label: 'High', active: 'border-high/40 bg-high/10 text-high' },
  { value: 'medium', label: 'Medium', active: 'border-medium/40 bg-medium/10 text-medium' },
  { value: 'low', label: 'Low', active: 'border-low/40 bg-low/10 text-low' },
];

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
const SEVERITY_DOT = { critical: 'bg-critical', high: 'bg-high', medium: 'bg-medium', low: 'bg-low' };

const SORT_OPTIONS = [
  { value: 'recent', label: 'Most recent' },
  { value: 'oldest', label: 'Oldest activity' },
  { value: 'reports', label: 'Most reported' },
  { value: 'severity', label: 'Severity' },
];

const TYPE_LABEL = { url: 'Malicious URL', domain: 'Suspicious domain', ip: 'Threat IP' };

const SPARKS = {
  total: [22, 30, 26, 38, 34, 44, 40, 52, 46, 58, 54, 66],
  reports: [18, 24, 21, 29, 26, 33, 30, 38, 34, 41, 39, 47],
  campaigns: [14, 18, 16, 22, 20, 27, 24, 28, 26, 32, 30, 34],
  new: [8, 14, 10, 18, 15, 22, 19, 24, 20, 27, 25, 31],
  takedowns: [6, 9, 8, 13, 11, 16, 14, 19, 17, 21, 20, 24],
};

function scanUrlFor(record) {
  if (!record) return '/scan';
  const protocol = record.type === 'ip' ? 'http' : 'https';
  return `/scan?url=${encodeURIComponent(`${protocol}://${record.indicator}`)}`;
}

function confidenceTone(value) {
  if (value >= 85) return 'safe';
  if (value >= 72) return 'brand';
  if (value >= 64) return 'medium';
  return 'high';
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export default function ThreatIntelligence() {
  const {
    EMERGING_CAMPAIGNS, RECENT_COMMUNITY_REPORTS, REPORTER_LEADERBOARD, THREAT_ACTIVITY_14D, THREAT_CATEGORIES,
    THREAT_RECORDS, THREAT_STATS, feedState, reload, live,
  } = useThreatData();
  const SEVERITY_COUNTS = THREAT_RECORDS.reduce(
    (counts, record) => ({ ...counts, [record.severity]: (counts[record.severity] || 0) + 1 }),
    { all: THREAT_RECORDS.length },
  );
  const TYPE_TABS = [
    { id: 'all', label: 'All indicators', count: THREAT_RECORDS.length },
    { id: 'url', label: 'Malicious URLs', count: THREAT_RECORDS.filter((record) => record.type === 'url').length },
    { id: 'domain', label: 'Suspicious domains', count: THREAT_RECORDS.filter((record) => record.type === 'domain').length },
    { id: 'ip', label: 'Threat IPs', count: THREAT_RECORDS.filter((record) => record.type === 'ip').length },
  ];
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [type, setType] = useState('all');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const retryFeed = reload;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = THREAT_RECORDS.filter((record) => {
      if (needle) {
        const haystack = `${record.indicator} ${record.category} ${record.type} ${record.id} ${record.country} ${record.source} ${record.tags.join(' ')}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (category !== 'all' && record.categoryId !== category) return false;
      if (severity !== 'all' && record.severity !== severity) return false;
      if (type !== 'all' && record.type !== type) return false;
      return true;
    });

    return rows.sort((a, b) => {
      if (sort === 'reports') return b.reports - a.reports;
      if (sort === 'severity') return (SEVERITY_RANK[a.severity] ?? 4) - (SEVERITY_RANK[b.severity] ?? 4);
      if (sort === 'oldest') return new Date(a.lastSeen) - new Date(b.lastSeen);
      return new Date(b.lastSeen) - new Date(a.lastSeen);
    });
  }, [THREAT_RECORDS, query, category, severity, type, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const loading = feedState === 'loading';
  const feedError = feedState === 'error';

  const recentActivity = useMemo(
    () => [...THREAT_RECORDS].sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen)).slice(0, 5),
    [THREAT_RECORDS],
  );

  const maxCategory = Math.max(1, ...THREAT_CATEGORIES.map((item) => item.count));

  const activeChips = [];
  if (query.trim()) {
    activeChips.push({
      key: 'query',
      label: `Search: ${query.trim()}`,
      onRemove: () => {
        setQuery('');
        setPage(1);
      },
    });
  }
  if (category !== 'all') {
    const label = THREAT_CATEGORIES.find((item) => item.id === category)?.label || category;
    activeChips.push({
      key: 'category',
      label,
      onRemove: () => {
        setCategory('all');
        setPage(1);
      },
    });
  }
  if (severity !== 'all') {
    activeChips.push({
      key: 'severity',
      label: `${severity.charAt(0).toUpperCase()}${severity.slice(1)} severity`,
      onRemove: () => {
        setSeverity('all');
        setPage(1);
      },
    });
  }
  if (type !== 'all') {
    activeChips.push({
      key: 'type',
      label: TYPE_TABS.find((item) => item.id === type)?.label || type,
      onRemove: () => {
        setType('all');
        setPage(1);
      },
    });
  }

  const resetFilters = () => {
    setQuery('');
    setCategory('all');
    setSeverity('all');
    setType('all');
    setSort('recent');
    setPage(1);
    toast.info('Filters reset', `Showing all ${THREAT_RECORDS.length} classified records.`);
  };

  const changeDatabase = (nextType) => {
    setType(nextType);
    setPage(1);
  };

  const changePage = (next) => setPage(Math.min(Math.max(next, 1), pages));

  const exportCsv = () => {
    if (!filtered.length) {
      toast.warning('Nothing to export', 'Adjust the search or filters to produce a CSV.');
      return;
    }
    const header = ['Indicator ID', 'Indicator', 'Type', 'Category', 'Severity', 'Status', 'Reports', 'Confidence', 'Country', 'First detected', 'Last reported', 'Source'];
    const rows = filtered.map((record) => [
      record.id, record.indicator, record.type, record.category, record.severity, record.status,
      record.reports, record.confidence, record.country, record.firstSeen, record.lastSeen, record.source,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `truthshield-threat-intelligence-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    toast.success('CSV export ready', `${filtered.length} indicator${filtered.length === 1 ? '' : 's'} written to the download.`);
  };

  const openCommunityReport = (report) => {
    const record = THREAT_RECORDS.find((item) => item.indicator === report.target);
    if (record) {
      setSelected(record);
      return;
    }
    toast.info('Report still in triage', `${report.target} has not been published to the indicator database yet.`);
  };

  const columns = [
    {
      key: 'indicator',
      header: 'Indicator',
      render: (row) => (
        <div className="min-w-0">
          <p className="max-w-[280px] truncate font-mono text-[11.5px] text-ink">{row.indicator}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.06em] text-ink-3">{row.type} · {row.id}</p>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (row) => <span className="text-[11.5px] text-ink-2">{row.category}</span> },
    { key: 'severity', header: 'Severity', render: (row) => <SeverityBadge severity={row.severity} size="sm" /> },
    {
      key: 'reports',
      header: 'Reports',
      align: 'right',
      render: (row) => <span className="font-mono text-[11.5px] tabular text-ink-2">{row.reports}</span>,
    },
    {
      key: 'firstSeen',
      header: 'First detected',
      render: (row) => <span className="whitespace-nowrap text-[11.5px] text-ink-3">{formatDate(row.firstSeen)}</span>,
    },
    {
      key: 'lastSeen',
      header: 'Last reported',
      render: (row) => <span className="whitespace-nowrap text-[11.5px] text-ink-3">{timeAgo(row.lastSeen)}</span>,
    },
    { key: 'status', header: 'Status', render: (row) => <VerdictBadge verdict={row.status} size="sm" /> },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (row) => (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-brand transition hover:text-brand-2"
          onClick={(event) => {
            event.stopPropagation();
            setSelected(row);
          }}
        >
          Details <FiArrowRight className="text-[10px]" aria-hidden="true" />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Threat intelligence"
        title="Search what the internet already knows is hostile."
        description="A searchable corpus of reported URLs, domains and IPs with categories, severity, first detection and community reporting history."
        breadcrumb={[{ label: 'Home', to: '/' }, { label: 'Threat Intelligence' }]}
        demo={!live}
        meta={
          <>
            <span className="inline-flex items-center gap-1.5"><FiDatabase className="text-[12px]" aria-hidden="true" /> {formatNumber(THREAT_STATS.totalIndicators)} indicators</span>
            <span className="inline-flex items-center gap-1.5"><FiUsers className="text-[12px]" aria-hidden="true" /> {formatNumber(THREAT_STATS.reporters)} community reporters</span>
            <span className="inline-flex items-center gap-1.5"><FiCpu className="text-[12px]" aria-hidden="true" /> {live ? 'Live database' : 'Demo corpus'}</span>
          </>
        }
        actions={<Button to="/report-threat" size="md" iconRight={FiArrowRight}>Submit a report</Button>}
      />

      <div className="shell py-8 lg:py-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Total reported threats" value={THREAT_STATS.totalIndicators} hint="confirmed indicators" icon={FiAlertTriangle} tone="critical" spark={SPARKS.total} />
          <StatCard label="Community reports" value={THREAT_STATS.totalReports} delta={8.4} trend="up" hint="vs. last week" icon={FiUsers} tone="brand" spark={SPARKS.reports} />
          <StatCard label="Active campaigns" value={THREAT_STATS.activeCampaigns} delta={6.2} trend="up" hint="vs. last week" icon={FiTarget} tone="critical" spark={SPARKS.campaigns} />
          <StatCard label="New in 24 hours" value={THREAT_STATS.new24h} delta={11.8} trend="up" hint="indicator additions" icon={FiTrendingUp} tone="medium" spark={SPARKS.new} />
          <StatCard label="Takedowns this week" value={THREAT_STATS.takedowns7d} delta={4.1} trend="up" hint="confirmed removals" icon={FiShield} tone="safe" spark={SPARKS.takedowns} />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            <Card className="top-sheen overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                    <FiDatabase className="text-[14px] text-ink-3" aria-hidden="true" /> Indicator database
                  </p>
                  <p className="mt-0.5 text-[11.5px] leading-5 text-ink-3">
                    {loading
                      ? 'Loading the demo corpus…'
                      : `${formatNumber(filtered.length)} matching of ${THREAT_RECORDS.length} classified records · ${formatNumber(THREAT_STATS.totalIndicators)} tracked corpus-wide`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={feedError ? 'critical' : loading ? 'info' : 'safe'} dot>
                    {feedError ? 'Feed error' : loading ? 'Syncing' : 'Demo sample'}
                  </Badge>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={FiDownload}
                    onClick={exportCsv}
                    disabled={loading || feedError || !filtered.length}
                  >
                    Export CSV
                  </Button>
                </div>
              </div>

              <div className="border-b border-line px-4 py-3">
                <Tabs
                  items={TYPE_TABS}
                  value={type}
                  onChange={changeDatabase}
                  variant="pill"
                  ariaLabel="Threat intelligence databases"
                  className="w-full sm:w-auto"
                />
              </div>

              <div className="space-y-3 border-b border-line p-4">
                <div className="flex flex-col gap-2 lg:flex-row">
                  <div className="relative flex-1">
                    <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-ink-3" aria-hidden="true" />
                    <input
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setPage(1);
                      }}
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Search a URL, domain, IP, tag or indicator ID…"
                      className="h-11 w-full rounded-xl border border-line-strong bg-surface pl-10 pr-9 font-mono text-[12px] text-ink outline-none transition-all duration-200 placeholder:font-sans placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand/10"
                      aria-label="Search threat indicators"
                    />
                    {query ? (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery('');
                          setPage(1);
                        }}
                        className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-ink-3 transition hover:bg-surface-3 hover:text-ink"
                        aria-label="Clear search"
                      >
                        <FiX className="text-[13px]" />
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:w-[340px]">
                    <Select
                      value={category}
                      onChange={(event) => {
                        setCategory(event.target.value);
                        setPage(1);
                      }}
                      aria-label="Filter by category"
                      className="h-11 text-[12px]"
                    >
                      <option value="all">All categories</option>
                      {THREAT_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </Select>
                    <Select
                      value={sort}
                      onChange={(event) => {
                        setSort(event.target.value);
                        setPage(1);
                      }}
                      aria-label="Sort results"
                      className="h-11 text-[12px]"
                    >
                      {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 inline-flex items-center gap-1 text-[10.5px] uppercase tracking-[0.07em] text-ink-3">
                    <FiFilter className="text-[11px]" aria-hidden="true" /> Severity
                  </span>
                  {SEVERITY_META.map((level) => {
                    const active = severity === level.value;
                    return (
                      <button
                        key={level.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setSeverity(level.value);
                          setPage(1);
                        }}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition-colors duration-200',
                          active
                            ? level.active
                            : 'border-line bg-surface-2/60 text-ink-2 hover:border-line-strong hover:text-ink',
                        )}
                      >
                        {level.label}
                        <span className={cn('text-[10px] tabular', active ? 'opacity-80' : 'text-ink-3')}>
                          {SEVERITY_COUNTS[level.value] || 0}
                        </span>
                      </button>
                    );
                  })}
                  <span className="ml-auto text-[11px] text-ink-3" aria-live="polite">
                    {loading ? 'Loading results…' : `${filtered.length} result${filtered.length === 1 ? '' : 's'}`}
                  </span>
                </div>

                {activeChips.length ? (
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                    <span className="mr-1 text-[10.5px] uppercase tracking-[0.07em] text-ink-3">Active</span>
                    {activeChips.map((chip) => (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={chip.onRemove}
                        aria-label={`Remove ${chip.label} filter`}
                        className="inline-flex max-w-full items-center gap-1 rounded-md border border-brand/25 bg-brand/[0.07] px-2 py-1 text-[10.5px] font-medium text-brand transition hover:bg-brand/[0.12]"
                      >
                        <span className="truncate">{chip.label}</span>
                        <FiX className="shrink-0 text-[10px]" aria-hidden="true" />
                      </button>
                    ))}
                    <button type="button" onClick={resetFilters} className="ml-auto text-[11px] font-medium text-brand transition hover:text-brand-2">
                      Reset all
                    </button>
                  </div>
                ) : null}
              </div>

              {feedError ? (
                <div className="p-4">
                  <Notice
                    tone="critical"
                    title="Threat feed could not be loaded"
                    action={<Button size="sm" variant="secondary" icon={FiRefreshCw} onClick={retryFeed}>Retry</Button>}
                  >
                    The local demo corpus failed validation. Retry the feed — no network request is made.
                  </Notice>
                </div>
              ) : (
                <>
                  <DataTable
                    columns={columns}
                    rows={visible}
                    rowKey={(row) => row.id}
                    onRowClick={setSelected}
                    loading={loading}
                    minWidth={940}
                    empty={
                      <EmptyState
                        icon={FiSearch}
                        title="No indicators match these filters"
                        description="Try a broader search term, or reset the category and severity filters."
                        action={<Button size="sm" variant="secondary" onClick={resetFilters}>Reset filters</Button>}
                      />
                    }
                    mobileRenderer={(row) => (
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="break-all font-mono text-[11.5px] text-ink">{row.indicator}</p>
                            <p className="mt-0.5 text-[10px] uppercase tracking-[0.06em] text-ink-3">{row.type} · {row.id}</p>
                          </div>
                          <SeverityBadge severity={row.severity} size="sm" />
                        </div>
                        <p className="mt-1.5 text-[10.5px] text-ink-3">{row.category} · {row.reports} reports</p>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                          <VerdictBadge verdict={row.status} size="sm" />
                          <span className="text-[10px] text-ink-3">First {formatDate(row.firstSeen)} · {timeAgo(row.lastSeen)}</span>
                        </div>
                      </div>
                    )}
                  />
                  <div className="border-t border-line px-4 py-3">
                    {loading ? (
                      <div className="skeleton h-8 w-44" />
                    ) : (
                      <Pagination
                        page={currentPage}
                        pages={pages}
                        total={filtered.length}
                        pageSize={PAGE_SIZE}
                        onChange={changePage}
                      />
                    )}
                  </div>
                </>
              )}
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <SectionCard title="Indicator activity · 14 days" description="Phishing vs. malware vs. impersonation" icon={FiTrendingUp}>
                <AreaChart
                  height={150}
                  labels={THREAT_ACTIVITY_14D.map((item) => new Date(item.date).getDate().toString())}
                  series={[
                    { key: 'phishing', color: 'var(--critical)', data: THREAT_ACTIVITY_14D.map((item) => item.phishing) },
                    { key: 'impersonation', color: 'var(--high)', data: THREAT_ACTIVITY_14D.map((item) => item.impersonation) },
                    { key: 'malware', color: 'var(--low)', data: THREAT_ACTIVITY_14D.map((item) => item.malware) },
                  ]}
                />
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[10.5px] text-ink-2">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-critical" /> Phishing</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-high" /> Impersonation</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-low" /> Malware</span>
                </div>
              </SectionCard>

              <SectionCard
                title="Category coverage"
                description="Click a category to filter the database"
                icon={FiDatabase}
                action={<Badge tone="neutral" size="sm">{THREAT_CATEGORIES.length} categories</Badge>}
                flush
              >
                <ul className="divide-y divide-line/70">
                  {THREAT_CATEGORIES.map((item) => {
                    const active = category === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setCategory(item.id);
                            setPage(1);
                          }}
                          aria-pressed={active}
                          className={cn(
                            'w-full px-5 py-2.5 text-left transition-colors duration-200',
                            active ? 'bg-brand/[0.07]' : 'hover:bg-surface-2/60',
                          )}
                        >
                          <span className="flex items-baseline justify-between gap-3">
                            <span className={cn('truncate text-[11.5px]', active ? 'font-medium text-brand' : 'text-ink-2')}>{item.label}</span>
                            <span className="shrink-0 font-mono text-[10.5px] tabular text-ink-3">{formatNumber(item.count)}</span>
                          </span>
                          <Meter value={(item.count / maxCategory) * 100} tone={item.tone} className="mt-1.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </SectionCard>
            </div>
          </div>

          <aside className="space-y-4">
            <SectionCard title="Emerging campaigns" description="Tracked by cluster volume" icon={FiTarget} flush>
              <ul className="divide-y divide-line/70">
                {EMERGING_CAMPAIGNS.map((campaign) => (
                  <li key={campaign.name} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-medium text-ink">{campaign.name}</p>
                        <p className="mt-0.5 text-[10.5px] text-ink-3">{campaign.category} · {campaign.hosts} hosts · {campaign.region}</p>
                      </div>
                      <Badge tone={campaign.growth > 50 ? 'critical' : campaign.growth > 0 ? 'medium' : 'safe'} size="sm">
                        {campaign.growth > 0 ? '+' : ''}{campaign.growth}%
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard title="Recent threat activity" description="Latest community signals" icon={FiActivity} flush>
              <ul className="divide-y divide-line/70">
                {recentActivity.map((record) => (
                  <li key={record.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(record)}
                      className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-surface-2/60"
                    >
                      <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', SEVERITY_DOT[record.severity] || 'bg-ink-3')} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-[10.5px] text-ink">{record.indicator}</span>
                        <span className="mt-0.5 block text-[10px] text-ink-3">{record.category} · {record.reports} reports · {timeAgo(record.lastSeen)}</span>
                      </span>
                      <FiArrowRight className="mt-1 shrink-0 text-[11px] text-ink-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard
              title="Community reports"
              description="Latest analyst submissions"
              icon={FiUsers}
              action={<Badge tone="brand" size="sm">{RECENT_COMMUNITY_REPORTS.length}</Badge>}
              flush
            >
              <ul className="divide-y divide-line/70">
                {RECENT_COMMUNITY_REPORTS.map((report) => {
                  const status = REPORT_STATUSES.find((entry) => entry.id === report.status);
                  return (
                    <li key={report.id}>
                      <button
                        type="button"
                        onClick={() => openCommunityReport(report)}
                        className="w-full px-4 py-2.5 text-left transition-colors hover:bg-surface-2/60"
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="min-w-0 truncate font-mono text-[10.5px] text-ink">{report.target}</span>
                          <Badge tone={status?.tone || 'neutral'} size="sm">{status?.label || report.status}</Badge>
                        </span>
                        <span className="mt-0.5 block text-[10px] text-ink-3">{report.category} · {report.reporter} · {report.time}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-line px-4 py-2">
                <Link to="/report-threat" className="arrow-link inline-flex items-center gap-1 text-[11px] font-medium text-brand transition hover:text-brand-2">
                  Submit your own report <FiArrowRight className="arrow-link-icon text-[11px]" aria-hidden="true" />
                </Link>
              </div>
            </SectionCard>

            <SectionCard title="Top reporters" description="Community accuracy weighted" icon={FiUsers} flush>
              <ul className="divide-y divide-line/70">
                {REPORTER_LEADERBOARD.map((reporter, index) => (
                  <li key={reporter.alias} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line bg-surface-2 font-mono text-[10px] text-ink-3">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[11px] text-ink">{reporter.alias}</p>
                      <p className="text-[10px] text-ink-3">{reporter.reports} reports · {reporter.accuracy}% accurate</p>
                    </div>
                    <Badge tone={reporter.badge === 'Platinum' ? 'brand' : reporter.badge === 'Gold' ? 'medium' : 'neutral'} size="sm">{reporter.badge}</Badge>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <Card className="top-sheen p-4">
              <p className="flex items-center gap-2 text-[11.5px] font-semibold text-ink">
                <FiAlertTriangle className="text-medium" aria-hidden="true" /> Reporting guidance
              </p>
              <p className="mt-1.5 text-[11px] leading-5 text-ink-3">
                Include the exact URL, the channel that delivered it and any screenshots. Reports with evidence are
                confirmed 3× faster.
              </p>
              <Button to="/report-threat" variant="secondary" size="sm" full className="mt-3" iconRight={FiArrowRight}>
                Report a threat
              </Button>
            </Card>

            <DemoBadge className="w-full justify-center" />
          </aside>
        </div>
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? selected.indicator : 'Threat detail'}
        description={selected ? `${selected.category} · ${selected.id}` : undefined}
        size="lg"
        footer={
          selected ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] text-ink-3">Last reported {timeAgo(selected.lastSeen)}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setSelected(null)}>Close</Button>
                <Button size="sm" to={scanUrlFor(selected)} iconRight={FiArrowRight}>Scan target</Button>
              </div>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={selected.severity} />
              <VerdictBadge verdict={selected.status} />
              <Badge tone="neutral">{TYPE_LABEL[selected.type] || selected.type}</Badge>
              <Badge tone="brand">{selected.confidence}% confidence</Badge>
              <CopyButton value={selected.indicator} label="Copy IOC" className="ml-auto" />
            </div>

            <div className="rounded-xl border border-line bg-surface-2/50 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-3">Community confidence</span>
                <span className="font-mono text-[11.5px] tabular text-ink">{selected.confidence}%</span>
              </div>
              <Meter value={selected.confidence} tone={confidenceTone(selected.confidence)} className="mt-2" />
              <p className="mt-2 text-[11px] leading-5 text-ink-3">
                {formatNumber(selected.reports)} community reports · first reported by{' '}
                <span className="font-mono text-ink-2">{selected.firstReportedBy}</span> · latest report by{' '}
                <span className="font-mono text-ink-2">{selected.lastReportedBy}</span>
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-3">Detection timeline</h4>
                <div className="mt-1.5">
                  <DataRow label="First detected" value={formatDateTime(selected.firstSeen)} />
                  <DataRow label="Last reported" value={formatDateTime(selected.lastSeen)} />
                  <DataRow label="Community reports" value={formatNumber(selected.reports)} />
                  <DataRow label="Source" value={selected.source} />
                  <DataRow label="Origin country" value={selected.country} />
                </div>
              </div>
              <div>
                <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-3">Classification</h4>
                <div className="mt-1.5">
                  <DataRow label="Category" value={selected.category} />
                  <DataRow label="Severity" value={<span className="capitalize">{selected.severity}</span>} />
                  <DataRow label="Status" value={<VerdictBadge verdict={selected.status} size="sm" />} />
                  <DataRow label="Indicator ID" value={selected.id} mono />
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-3">
                {selected.type === 'ip' ? 'Network infrastructure' : 'Registration'}
              </h4>
              <div className="mt-1.5">
                {selected.type === 'ip' ? (
                  <>
                    <DataRow label="ASN" value={selected.asn} />
                    <DataRow label="Netblock" value={selected.netblock} mono />
                  </>
                ) : (
                  <>
                    <DataRow label="Registrar" value={selected.registrar} />
                    <DataRow label="Hostname" value={selected.indicator.split('/')[0]} mono />
                  </>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-3">Tags</h4>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {selected.tags.map((tag) => (
                  <span key={tag} className="rounded-md border border-line bg-surface-2 px-2 py-1 font-mono text-[10px] text-ink-2">{tag}</span>
                ))}
              </div>
            </div>

            <Notice tone="warning">
              This indicator is part of the simulated demo corpus. Verify against a live feed before acting on it.
            </Notice>

            <div className="flex flex-wrap gap-2">
              {selected.type !== 'ip' ? (
                <Link
                  to={`/advanced/redirect-chain?target=${encodeURIComponent(selected.indicator)}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium text-ink-2 transition hover:border-brand/30 hover:text-brand"
                >
                  <FiGlobe className="text-[11px]" aria-hidden="true" /> Trace redirects
                </Link>
              ) : null}
              <Link
                to="/report-threat"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium text-ink-2 transition hover:border-brand/30 hover:text-brand"
              >
                <FiShield className="text-[11px]" aria-hidden="true" /> Add a report
              </Link>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] text-ink-3">
                <FiClock className="text-[11px]" aria-hidden="true" /> Updated {timeAgo(selected.lastSeen)}
              </span>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
