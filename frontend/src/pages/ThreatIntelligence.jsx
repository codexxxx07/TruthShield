import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiAlertTriangle, FiArrowRight, FiClock, FiCpu, FiDatabase, FiFilter, FiGlobe,
  FiSearch, FiShield, FiTarget, FiTrendingUp, FiUsers, FiX,
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
import { AreaChart } from '../components/ui/Charts';
import { Meter } from '../components/ui/Progress';
import StatCard from '../components/ui/StatCard';
import { EMERGING_CAMPAIGNS, REPORTER_LEADERBOARD, THREAT_ACTIVITY_14D, THREAT_CATEGORIES, THREAT_RECORDS, THREAT_STATS } from '../data/threats';
import { cn, formatDate, formatNumber, timeAgo } from '../lib/utils';

const PAGE_SIZE = 8;
const SEVERITIES = ['all', 'critical', 'high', 'medium', 'low'];
const TYPES = [
  { value: 'all', label: 'All types' },
  { value: 'url', label: 'URL' },
  { value: 'domain', label: 'Domain' },
  { value: 'ip', label: 'IP address' },
];

const SPARKS = {
  total: [22, 30, 26, 38, 34, 44, 40, 52, 46, 58, 54, 66],
  campaigns: [14, 18, 16, 22, 20, 27, 24, 28, 26, 32, 30, 34],
  new: [8, 14, 10, 18, 15, 22, 19, 24, 20, 27, 25, 31],
  takedowns: [6, 9, 8, 13, 11, 16, 14, 19, 17, 21, 20, 24],
};

export default function ThreatIntelligence() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [severity, setSeverity] = useState('all');
  const [type, setType] = useState('all');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = THREAT_RECORDS.filter((record) => {
      if (needle && !`${record.indicator} ${record.category} ${record.tags.join(' ')}`.toLowerCase().includes(needle)) return false;
      if (category !== 'all' && record.category !== category) return false;
      if (severity !== 'all' && record.severity !== severity) return false;
      if (type !== 'all' && record.type !== type) return false;
      return true;
    });
    return rows.sort((a, b) => {
      if (sort === 'reports') return b.reports - a.reports;
      if (sort === 'severity') {
        const rank = { critical: 0, high: 1, medium: 2, low: 3 };
        return rank[a.severity] - rank[b.severity];
      }
      if (sort === 'oldest') return new Date(a.lastSeen) - new Date(b.lastSeen);
      return new Date(b.lastSeen) - new Date(a.lastSeen);
    });
  }, [query, category, severity, type, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetFilters = () => {
    setQuery('');
    setCategory('all');
    setSeverity('all');
    setType('all');
    setSort('recent');
    setPage(1);
  };

  const activeFilters = [query && 'search', category !== 'all' && category, severity !== 'all' && severity, type !== 'all' && type].filter(Boolean);

  const columns = [
    {
      key: 'indicator',
      header: 'Indicator',
      render: (row) => (
        <div className="min-w-0">
          <p className="max-w-[260px] truncate font-mono text-[11.5px] text-ink">{row.indicator}</p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.06em] text-ink-3">{row.type} · {row.id}</p>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (row) => <span className="text-[11.5px] text-ink-2">{row.category}</span> },
    { key: 'severity', header: 'Severity', render: (row) => <SeverityBadge severity={row.severity} size="sm" /> },
    { key: 'reports', header: 'Reports', align: 'right', render: (row) => <span className="font-mono text-[11.5px] tabular text-ink-2">{row.reports}</span> },
    { key: 'firstSeen', header: 'First seen', render: (row) => <span className="whitespace-nowrap text-[11.5px] text-ink-3">{formatDate(row.firstSeen)}</span> },
    { key: 'lastSeen', header: 'Last seen', render: (row) => <span className="whitespace-nowrap text-[11.5px] text-ink-3">{timeAgo(row.lastSeen)}</span> },
    { key: 'status', header: 'Status', render: (row) => <VerdictBadge verdict={row.status} size="sm" /> },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (row) => (
        <button type="button" className="text-[11px] font-medium text-brand" onClick={() => setSelected(row)}>
          Details
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
        demo
        meta={
          <>
            <span className="inline-flex items-center gap-1.5"><FiDatabase className="text-[12px]" aria-hidden="true" /> {formatNumber(THREAT_STATS.totalIndicators)} indicators</span>
            <span className="inline-flex items-center gap-1.5"><FiUsers className="text-[12px]" aria-hidden="true" /> {formatNumber(THREAT_STATS.reporters)} community reporters</span>
            <span className="inline-flex items-center gap-1.5"><FiCpu className="text-[12px]" aria-hidden="true" /> Demo corpus</span>
          </>
        }
        actions={<Button to="/report-threat" size="md" iconRight={FiArrowRight}>Submit a report</Button>}
      />

      <div className="shell py-8 lg:py-10">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Indicators tracked" value={THREAT_STATS.totalIndicators} hint="across all categories" icon={FiDatabase} tone="brand" spark={SPARKS.total} />
          <StatCard label="Active campaigns" value={THREAT_STATS.activeCampaigns} delta={6.2} trend="up" hint="vs. last week" icon={FiTarget} tone="critical" spark={SPARKS.campaigns} />
          <StatCard label="New in 24 hours" value={THREAT_STATS.new24h} delta={11.8} trend="up" hint="indicator additions" icon={FiTrendingUp} tone="medium" spark={SPARKS.new} />
          <StatCard label="Takedowns this week" value={THREAT_STATS.takedowns7d} delta={4.1} trend="up" hint="confirmed removals" icon={FiShield} tone="safe" spark={SPARKS.takedowns} />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            <Card className="p-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-ink-3" aria-hidden="true" />
                    <input
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setPage(1);
                      }}
                      placeholder="Search a URL, domain, IP or tag…"
                      className="h-11 w-full rounded-xl border border-line-strong bg-surface pl-10 pr-9 font-mono text-[12px] text-ink outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
                      aria-label="Search threat indicators"
                    />
                    {query ? (
                      <button type="button" onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-ink" aria-label="Clear search">
                        <FiX className="text-[13px]" />
                      </button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:w-auto">
                    <Select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} aria-label="Filter by type" className="h-11 text-[12px]">
                      {TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </Select>
                    <Select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} aria-label="Filter by category" className="h-11 text-[12px]">
                      <option value="all">All categories</option>
                      {THREAT_CATEGORIES.map((item) => <option key={item.id} value={item.label}>{item.label}</option>)}
                    </Select>
                    <Select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort results" className="h-11 text-[12px]">
                      <option value="recent">Most recent</option>
                      <option value="oldest">Oldest activity</option>
                      <option value="reports">Most reported</option>
                      <option value="severity">Severity</option>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 inline-flex items-center gap-1 text-[10.5px] uppercase tracking-[0.07em] text-ink-3">
                    <FiFilter className="text-[11px]" aria-hidden="true" /> Severity
                  </span>
                  {SEVERITIES.map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => { setSeverity(level); setPage(1); }}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize transition',
                        severity === level
                          ? 'border-brand/30 bg-brand/10 text-brand'
                          : 'border-line bg-surface-2/60 text-ink-2 hover:border-line-strong hover:text-ink',
                      )}
                    >
                      {level}
                    </button>
                  ))}
                  <span className="ml-auto text-[11px] text-ink-3">
                    {filtered.length} result{filtered.length === 1 ? '' : 's'}
                  </span>
                  {activeFilters.length ? (
                    <button type="button" onClick={resetFilters} className="text-[11px] font-medium text-brand">
                      Reset
                    </button>
                  ) : null}
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <DataTable
                columns={columns}
                rows={visible}
                rowKey={(row) => row.id}
                onRowClick={setSelected}
                minWidth={880}
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
                      <p className="min-w-0 flex-1 break-all font-mono text-[11.5px] text-ink">{row.indicator}</p>
                      <SeverityBadge severity={row.severity} size="sm" />
                    </div>
                    <p className="mt-1 text-[10.5px] text-ink-3">{row.category} · {row.reports} reports · {timeAgo(row.lastSeen)}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <VerdictBadge verdict={row.status} size="sm" />
                      <span className="text-[10.5px] font-medium text-brand">Open details</span>
                    </div>
                  </div>
                )}
              />
              <div className="border-t border-line px-4 py-3">
                <Pagination page={currentPage} pages={pages} total={filtered.length} pageSize={PAGE_SIZE} onChange={(next) => setPage(Math.min(Math.max(next, 1), pages))} />
              </div>
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

              <SectionCard title="Category coverage" description="Indicators per threat category" icon={FiDatabase} flush>
                <ul className="divide-y divide-line/70">
                  {THREAT_CATEGORIES.map((item) => {
                    const max = Math.max(...THREAT_CATEGORIES.map((entry) => entry.count));
                    return (
                      <li key={item.id} className="px-5 py-2.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-[11.5px] text-ink-2">{item.label}</span>
                          <span className="shrink-0 font-mono text-[10.5px] tabular text-ink-3">{formatNumber(item.count)}</span>
                        </div>
                        <Meter value={(item.count / max) * 100} tone={item.id === 'phishing' ? 'critical' : item.id === 'malware' ? 'high' : 'brand'} className="mt-1.5" />
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

            <Card className="p-4">
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
        title={selected?.indicator}
        description={`${selected?.category} · ${selected?.id}`}
        size="lg"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-ink-3">Last updated {selected ? timeAgo(selected.lastSeen) : ''}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setSelected(null)}>Close</Button>
              <Button size="sm" to={`/scan?url=${encodeURIComponent(selected?.type === 'ip' ? `http://${selected.indicator}` : `https://${selected.indicator}`)}`} iconRight={FiArrowRight}>
                Scan target
              </Button>
            </div>
          </div>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={selected.severity} />
              <VerdictBadge verdict={selected.status} />
              <Badge tone="neutral">{selected.type.toUpperCase()}</Badge>
              <Badge tone="brand">{selected.confidence}% confidence</Badge>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-3">Detection</h4>
                <div className="mt-1.5">
                  <DataRow label="First detected" value={formatDate(selected.firstSeen)} />
                  <DataRow label="Last reported" value={formatDate(selected.lastSeen)} />
                  <DataRow label="Community reports" value={formatNumber(selected.reports)} />
                  <DataRow label="Source" value={selected.source} />
                  <DataRow label="Origin country" value={selected.country} />
                </div>
              </div>
              <div>
                <h4 className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-ink-3">Classification</h4>
                <div className="mt-1.5">
                  <DataRow label="Category" value={selected.category} />
                  <DataRow label="Severity" value={selected.severity} />
                  <DataRow label="Status" value={selected.status} />
                  <DataRow label="Indicator ID" value={selected.id} mono />
                </div>
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

            <div className="rounded-lg border border-medium/25 bg-medium/[0.06] px-3 py-2.5">
              <p className="flex items-start gap-2 text-[11.5px] leading-5 text-ink-2">
                <FiAlertTriangle className="mt-0.5 shrink-0 text-medium" aria-hidden="true" />
                This indicator is part of the simulated demo corpus. Verify against a live feed before acting on it.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link to={`/advanced/redirect-chain?target=${encodeURIComponent(selected.indicator)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium text-ink-2 transition hover:border-brand/30 hover:text-brand">
                <FiGlobe className="text-[11px]" aria-hidden="true" /> Trace redirects
              </Link>
              <Link to="/report-threat" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium text-ink-2 transition hover:border-brand/30 hover:text-brand">
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
