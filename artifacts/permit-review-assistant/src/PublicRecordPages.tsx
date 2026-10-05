import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { AlertCircle, ChevronRight, ExternalLink, FileText, Search } from 'lucide-react';
import { OFFICIAL_DATASET_URL, usePublicRecordSamples, type PublicRecordSample } from './public-record-samples';

const NP = 'Not provided in public source';
const fmtN = (n?: number) => (typeof n === 'number' ? n.toLocaleString('en-US') : undefined);
const fmtDate = (v?: string | null) => {
  if (!v) return NP;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
};
const fmtTime = (v?: string) => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('en-US');
};
const val = (v: string | null | undefined) => v || NP;
function statusClass(s: string | null) {
  const t = (s ?? '').toLowerCase();
  if (/final|issued|complete|approved/.test(t)) return 'status-approved';
  if (/expired|void|cancel|revoke|denied/.test(t)) return 'status-issue';
  if (/review|pending|hold|plan/.test(t)) return 'status-review';
  return 'status-neutral';
}
function SourceStatus({ status }: { status: string | null }) {
  return <span className={`status ${statusClass(status)}`}>{status || 'Status not provided'}</span>;
}

function SourceLink() {
  return <a className="button outline" href={OFFICIAL_DATASET_URL} target="_blank" rel="noreferrer" data-testid="link-official-dataset">Open official dataset <ExternalLink /></a>;
}

function SourceSummary({ sourceTotal, sourceRetrievedAt, loading }: { sourceTotal?: number; sourceRetrievedAt?: string; loading: boolean }) {
  const total = fmtN(sourceTotal);
  return <div className="card public-data-overview" data-testid="source-summary">
    <div>
      <strong data-testid="text-source-total">{total ? `Public data source: ${total} total records` : loading ? 'Public data source: loading total records' : 'Public data source: total not available'}</strong>
      <p>The portal displays a realistic preview of sample records. Open the official dataset to view all public records.</p>
      {sourceRetrievedAt && <p>Retrieved {fmtTime(sourceRetrievedAt)}</p>}
    </div>
    <SourceLink />
  </div>;
}

function useSamples() { return usePublicRecordSamples(); }

function ErrorBox({ onRetry }: { onRetry: () => void }) {
  return <div className="card" role="alert" data-testid="alert-source-error"><div className="empty"><AlertCircle size={30} /><h2>Public records could not be loaded</h2><p>The official source did not respond. No substitute records are shown.</p><div className="actions" style={{ justifyContent: 'center' }}><button className="button primary" onClick={onRetry} data-testid="button-retry">Retry</button><SourceLink /></div></div></div>;
}

function Skeleton() {
  return <div aria-busy="true" aria-label="Loading records">{[0, 1, 2, 3].map(i => <div className="record-skeleton" key={i} />)}</div>;
}

function Cards({ items, kind }: { items: PublicRecordSample[]; kind: 'application' | 'record' }) {
  return <div className="record-list">{items.map(r => <Link key={r.id} href={`/applications/${r.id}`} className="card record-card" data-testid={`sample-${kind}-${r.id}`}>
    <div className="record-top"><div><span className="detail-id">{val(r.permitNumber)}</span><span className="record-source">Official public data</span><h2>{r.projectName}</h2><SourceStatus status={r.status} /></div><ChevronRight /></div>
    <div className="record-facts">
      <div><span className="info-label">Address</span><strong>{val(r.address)}</strong></div>
      <div><span className="info-label">Permit type</span><strong>{val(r.permitType)}</strong></div>
      <div><span className="info-label">Applicant</span><strong>{val(r.applicant)}</strong></div>
      <div><span className="info-label">Issue date</span><strong>{fmtDate(r.submittedDate)}</strong></div>
      <div><span className="info-label">Source</span><strong>{r.department}</strong></div>
      <div><span className="info-label">Record ID</span><strong>{r.id}</strong></div>
    </div>
  </Link>)}</div>;
}

function Heading({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lead">{desc}</p></div></div>;
}

function Listing({ kind }: { kind: 'application' | 'record' }) {
  const { publicRecordSamples, sourceTotal, sourceRetrievedAt, isLoading, isError, refetch } = useSamples();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const statuses = useMemo(() => Array.from(new Set(publicRecordSamples.map(r => r.status).filter((s): s is string => !!s))), [publicRecordSamples]);
  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    return publicRecordSamples.filter(r => (!status || r.status === status) && (!t || [r.id, r.permitNumber, r.projectName, r.address, r.permitType, r.applicant, r.status].some(v => v?.toLowerCase().includes(t))));
  }, [publicRecordSamples, q, status]);
  const isApp = kind === 'application';
  const tid = isApp ? 'input-search-applications' : 'input-search-records';
  return <main className="page">
    {isApp
      ? <Heading eyebrow="Public permit records" title="Applications" desc="Sample building permit records from the City of San José public dataset. Read-only." />
      : <Heading eyebrow="Public data" title="Application Records" desc="Sample records based on official public data." />}
    <SourceSummary sourceTotal={sourceTotal} sourceRetrievedAt={sourceRetrievedAt} loading={isLoading} />
    {isError ? <ErrorBox onRetry={() => refetch()} /> : <div className="card">
      <div className="card-header"><div><h2>{isApp ? 'Sample permit records' : 'Public Records Preview'}</h2><p className="section-note">{isApp ? 'Sample records based on official public data' : 'Sample records based on official public data'}</p></div></div>
      <div className="filters" role="search">
        <div className="search-wrap"><Search aria-hidden="true" /><input className="input" type="search" aria-label="Search sample records" placeholder="Search permit, project, address, applicant" value={q} onChange={e => setQ(e.target.value)} data-testid={tid} /></div>
        <select className="select" aria-label="Filter by source status" value={status} onChange={e => setStatus(e.target.value)} data-testid={`select-status-${kind}`}><option value="">All source statuses</option>{statuses.map(s => <option key={s} value={s}>{s}</option>)}</select>
      </div>
      <div className="card-body" aria-live="polite">
        {isLoading ? <Skeleton /> : items.length === 0 ? <div className="empty"><FileText size={30} /><h2>No sample records match</h2><p>Adjust the search or status filter.</p></div> : <Cards items={items} kind={kind} />}
      </div>
    </div>}
  </main>;
}

export function PublicSampleApplications() { return <Listing kind="application" />; }
export function PublicSampleRecords() { return <Listing kind="record" />; }

function Info({ label, children, id }: { label: string; children: ReactNode; id?: string }) {
  return <div><div className="info-label">{label}</div><div className="info-value" data-testid={id}>{children}</div></div>;
}

export function PublicSampleDetail({ id }: { id: string }) {
  const { publicRecordSamples, sourceTotal, sourceRetrievedAt, isLoading, isError, refetch } = useSamples();
  const r = publicRecordSamples.find(x => x.id === id);
  return <main className="page">
    <Link href="/applications" className="button outline" data-testid="link-back-applications">Back to Applications</Link>
    <div style={{ height: 18 }} />
    {isError ? <ErrorBox onRetry={() => refetch()} /> : isLoading ? <Skeleton /> : !r ? <div className="card" role="alert" data-testid="text-not-found"><div className="empty"><AlertCircle size={30} /><h2>Record not found</h2><p>No sample public record has ID {id}.</p><SourceLink /></div></div> : <>
      <Heading eyebrow={val(r.permitNumber)} title={r.projectName} desc="Read-only sample from official public data." />
      <div className="card" data-testid={`sample-detail-${r.id}`}>
        <div className="card-header"><div><h2>Public record details</h2><p className="section-note">{r.department}</p></div><SourceStatus status={r.status} /></div>
        <div className="card-body info-list">
          <Info label="Record ID">{r.id}</Info>
          <Info label="Permit number">{val(r.permitNumber)}</Info>
          <Info label="Project">{r.projectName}</Info>
          <Info label="Permit type">{val(r.permitType)}</Info>
          <Info label="Address">{val(r.address)}</Info>
          <Info label="Applicant">{val(r.applicant)}</Info>
          <Info label="Source status">{r.status || 'Status not provided'}</Info>
          <Info label="Issue date">{fmtDate(r.submittedDate)}</Info>
          <Info label="Last updated" id="text-last-updated">{NP}</Info>
          <Info label="Source retrieved">{fmtTime(sourceRetrievedAt) ?? NP}</Info>
        </div>
      </div>
      <div className="notice" style={{ marginTop: 20 }}>This is a sample, read-only public record. It is not a private submission and carries no prototype review decision.{fmtN(sourceTotal) ? ` The official dataset holds ${fmtN(sourceTotal)} total records.` : ''}</div>
      <div className="actions" style={{ marginTop: 16 }}><SourceLink /></div>
    </>}
  </main>;
}

export function PublicSampleDashboard() {
  const { publicRecordSamples, sourceTotal, sourceRetrievedAt, isLoading, isError, refetch } = useSamples();
  return <main className="page">
    <Heading eyebrow="Staff overview" title="Overview" desc="A read-only view of public building permit records." />
    <SourceSummary sourceTotal={sourceTotal} sourceRetrievedAt={sourceRetrievedAt} loading={isLoading} />
    <div className="actions" style={{ marginBottom: 22 }}>
      <Link href="/applications" className="button primary" data-testid="link-overview-applications">Applications <ChevronRight /></Link>
      <Link href="/records" className="button outline" data-testid="link-overview-records">Application Records</Link>
    </div>
    {isError ? <ErrorBox onRetry={() => refetch()} /> : <>
      <div className="metric-grid"><div className="card metric" data-testid="metric-applications"><FileText className="metric-icon" /><div className="metric-label">Applications (sample preview)</div><div className="metric-value">{isLoading ? '...' : Math.min(publicRecordSamples.length, 100)}</div><div className="metric-detail">Sample records loaded</div></div></div>
      <div className="card"><div className="card-header"><div><h2>Sample preview</h2><p className="section-note">Sample records based on official public data</p></div></div>
        <div className="card-body">{isLoading ? <Skeleton /> : <Cards items={publicRecordSamples.slice(0, 4)} kind="record" />}</div></div>
    </>}
  </main>;
}
