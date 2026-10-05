import { useMemo } from 'react';
import { Link } from 'wouter';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import type { PortalReviewRecord } from '@workspace/api-client-react';
import { usePortalRecords } from './RecordsWorkspace';
import { staffCategoryLabel } from './records-model';
import './staff-data-pages.css';

const fmtDate = (v: string | null) => v ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${v.slice(0, 10)}T12:00:00Z`)) : 'Not available';
const n = (v: number) => v.toLocaleString('en-US');
const sum = (rs: PortalReviewRecord[], f: (r: PortalReviewRecord) => number) => rs.reduce((a, r) => a + f(r), 0);
const tally = (rs: PortalReviewRecord[], f: (r: PortalReviewRecord) => string) => {
  const m = new Map<string, number>();
  rs.forEach(r => m.set(f(r), (m.get(f(r)) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};
const SOURCE = 'Source: city_worker_application_records database table (synthetic demonstration data). Statuses are synthetic, not actual official decisions.';

function useData() {
  const q = usePortalRecords();
  const records = useMemo(() => q.data?.records ?? [], [q.data]);
  return { q, records };
}

function Gate({ q, label }: { q: ReturnType<typeof usePortalRecords>; label: string }) {
  if (q.isLoading) return <div className="card card-body" role="status" aria-label={`Loading ${label}`}><div className="record-skeleton" /><div className="record-skeleton" /><div className="record-skeleton" /></div>;
  if (q.isError) return <div className="card empty" role="alert" data-testid={`error-${label}`}><AlertCircle size={29} /><h2>Database records are unavailable</h2><p>The {label} could not be loaded from the database. No substitute data is shown.</p><button className="button outline" onClick={() => q.refetch()} disabled={q.isFetching}><RefreshCcw /> Retry</button></div>;
  if (q.data && q.data.records.length === 0) return <div className="card empty" data-testid={`empty-${label}`}><h2>No records in the database</h2><p>The application records table returned no rows.</p></div>;
  return null;
}

function Heading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lead">{SOURCE}</p></div></div>;
}

function Dist({ title, rows, total, testid, showCounts = true }: { title: string; rows: [string, number][]; total: number; testid: string; showCounts?: boolean }) {
  return <div className="card" data-testid={testid}><div className="card-header"><h2>{title}</h2></div><div className="table-wrap"><table><thead><tr><th>Value</th>{showCounts && <th style={{ textAlign: 'right' }}>Records</th>}<th style={{ textAlign: 'right' }}>Share</th></tr></thead><tbody>
    {rows.map(([k, c]) => <tr key={k} style={{ cursor: 'default' }}><td>{k}</td>{showCounts && <td style={{ textAlign: 'right' }}>{c}</td>}<td style={{ textAlign: 'right' }}>{total ? (c / total * 100).toFixed(1) : '0.0'}%</td></tr>)}
  </tbody></table></div></div>;
}

export function StaffDataOverview() {
  const { q, records } = useData();
  const ready = !q.isError && q.data && records.length > 0;
  const ordered = [...records].sort((a, b) => (a.recordCategory === 'City Housing Permits' ? 0 : 1) - (b.recordCategory === 'City Housing Permits' ? 0 : 1) || b.submittedDate.localeCompare(a.submittedDate));
  const metrics: [string, string, string][] = ready ? [
    ['Affordable housing', n(records.filter(r => r.affordableHousing).length), 'records flagged affordable'],
    ['Ready for Review', n(records.filter(r => r.reviewStatus === 'Ready for Review').length), 'synthetic review status'],
    ['Total housing units', n(sum(records, r => r.totalHousingUnits)), 'across all records'],
    ['Affordable units', n(sum(records, r => r.affordableHousingUnits)), 'across all records'],
    ['High or Urgent priority', n(records.filter(r => r.priority !== 'Normal').length), 'synthetic priority'],
  ] : [];
  return <main className="page" data-testid="page-staff-overview">
    <Heading eyebrow="City worker portal" title="Overview" />
    <Gate q={q} label="overview" />
    {ready && <>
      <p className="notice" style={{ marginBottom: 18 }} data-testid="text-source-note">{q.data!.notice}</p>
      <div className="metric-grid" data-testid="overview-metrics">{metrics.map(([l, v, d]) => <div className="card metric" key={l}><div className="metric-label">{l}</div><div className="metric-value">{v}</div><div className="metric-detail">{d}</div></div>)}</div>
      <div className="card"><div className="card-header"><div><h2>Current records</h2><p className="section-note">Recent applications, with housing reviews prioritized.</p></div><div className="actions"><Link href="/applications" className="button outline" data-testid="link-applications">Applications</Link><Link href="/records" className="button teal" data-testid="link-records">All records</Link><Link href="/staff-review-queue" className="button outline" data-testid="link-review-queue">Accepted intake queue</Link></div></div>
        <div className="table-wrap"><table><thead><tr><th>Project</th><th>Category</th><th>Status</th><th>Priority</th><th>Submitted</th></tr></thead><tbody>
          {ordered.slice(0, 8).map(r => <tr key={r.id} style={{ cursor: 'default' }} data-testid={`row-overview-${r.id}`}><td><Link href={`/applications/${encodeURIComponent(r.id)}`} className="table-title">{r.projectName}</Link><span className="table-sub">{r.permitNumber} · {r.address}</span></td><td>{staffCategoryLabel(r.recordCategory) ?? '—'}</td><td>{r.reviewStatus}</td><td>{r.priority}</td><td>{fmtDate(r.submittedDate)}</td></tr>)}
        </tbody></table></div></div>
    </>}
  </main>;
}

export function StaffDataAnalytics() {
  const { q, records } = useData();
  const ready = !q.isError && q.data && records.length > 0;
  const total = records.length;
  return <main className="page staff-data-analytics" data-testid="page-staff-analytics">
    <Heading eyebrow="City worker portal" title="Analytics" />
    <Gate q={q} label="analytics" />
    {ready && <div className="stack">
      <p className="notice" data-testid="text-source-note">{q.data!.notice}</p>
      <div className="card" data-testid="analytics-units"><div className="card-header"><h2>Housing units</h2></div><div className="table-wrap"><table><thead><tr><th>Measure</th><th style={{ textAlign: 'right' }}>Units</th></tr></thead><tbody>
        <tr style={{ cursor: 'default' }}><td>Total housing units</td><td style={{ textAlign: 'right' }}>{n(sum(records, r => r.totalHousingUnits))}</td></tr>
        <tr style={{ cursor: 'default' }}><td>Affordable housing units</td><td style={{ textAlign: 'right' }}>{n(sum(records, r => r.affordableHousingUnits))}</td></tr>
      </tbody></table></div></div>
      <div className="grid-3">
        <Dist title="Review status" rows={tally(records, r => r.reviewStatus)} total={total} testid="dist-status" />
        <Dist title="Housing category" rows={tally(records, r => r.housingCategory)} total={total} testid="dist-housing-category" showCounts={false} />
        <Dist title="Application type" rows={tally(records, r => r.applicationType)} total={total} testid="dist-application-type" showCounts={false} />
      </div>
    </div>}
  </main>;
}
