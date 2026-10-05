import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { AlertCircle, ChevronRight, RefreshCcw, Search, X } from 'lucide-react';
import { getGetPortalReviewRecordQueryKey, getListPortalReviewRecordsQueryKey, useGetPortalReviewRecord, useListPortalReviewRecords } from '@workspace/api-client-react';
import type { PortalReviewRecord } from '@workspace/api-client-react';
import { usePortalProfile } from './PortalAuth';
import { EMPTY_FILTERS, STAFF_CATEGORY_OPTIONS, UNIT_RANGES, categoryQuery, filterRecords, pageNumbers, paginate, parseStaffCategory, staffCategoryLabel, uniqueValues } from './records-model';
import type { AffordableFilter, CategoryFilter, RecordFilters, UnitRange } from './records-model';
import './records-workspace.css';

const CITY_DESCRIPTION = 'City housing permit records prioritized for housing production, affordable housing review, and permit coordination in San José.';

export function usePortalRecords() {
  const profile = usePortalProfile();
  return useListPortalReviewRecords({
    query: {
      queryKey: [...getListPortalReviewRecordsQueryKey(), profile.id],
      staleTime: 30_000,
      refetchOnMount: true,
      refetchInterval: 60_000,
    },
  });
}

const fmtDate = (v: string | null) => v ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${v.slice(0, 10)}T12:00:00Z`)) : 'Not available';
const fmtCount = (n: number) => n.toLocaleString('en-US');

function FieldList({ r }: { r: PortalReviewRecord }) {
  const rows: [string, string][] = [
    ['Record ID', r.id], ['Permit number', r.permitNumber],
    ...(staffCategoryLabel(r.recordCategory) ? [['Record category', staffCategoryLabel(r.recordCategory)!] as [string, string]] : []),
    ['Project name', r.projectName],
    ['Address', r.address], ['City', r.city], ['State', r.state], ['ZIP code', r.zipCode], ['Application type', r.applicationType],
    ['Housing type', r.housingType], ['Total housing units', String(r.totalHousingUnits)], ['Affordable housing units', String(r.affordableHousingUnits)],
    ['Affordable housing', r.affordableHousing ? 'Yes' : 'No'], ['Housing category', r.housingCategory], ['Work type', r.workType],
    ['Source status', r.sourceStatus], ['Review status', r.reviewStatus], ['Issued date', fmtDate(r.issuedDate)], ['Final date', fmtDate(r.finalDate)],
    ['Submitted date', fmtDate(r.submittedDate)], ['Data source', r.dataSource],
    ['Priority', r.priority], ['Department', r.department], ['Source type', r.sourceType],
    ['Synthetic record', r.isSynthetic ? 'Yes' : 'No'], ['Created at', r.createdAt], ['Updated at', r.updatedAt],
  ];
  return <dl className="rw-fields">
    {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd data-testid={`detail-${k.toLowerCase().replace(/\s+/g, '-')}`}>{v}</dd></div>)}
    <div className="full"><dt>Description</dt><dd>{r.description}</dd></div>
    <div className="full"><dt>Source URL</dt><dd><a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">{r.sourceUrl}</a></dd></div>
    <div className="full"><p className="notice">Synthetic educational record. It is not an actual imported official filing, contains no real applicant information, and carries no decision or action.</p></div>
  </dl>;
}

function DetailsDialog({ record, onClose }: { record: PortalReviewRecord; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus(); };
  }, []);
  return <div className="rw-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="rw-dialog" role="dialog" aria-modal="true" aria-labelledby="rw-dialog-title" tabIndex={-1} ref={ref} data-testid="dialog-record-details">
      <div className="rw-dialog-head"><div><span className="detail-id">{record.permitNumber}</span><h2 id="rw-dialog-title">{record.projectName}</h2></div><button className="button outline" onClick={onClose} aria-label="Close record details" data-testid="button-close-details"><X /> Close</button></div>
      <FieldList r={record} />
    </div>
  </div>;
}

export function RecordDetailsPage({ id }: { id: string }) {
  const profile = usePortalProfile();
  const q = useGetPortalReviewRecord(id, { query: { queryKey: [...getGetPortalReviewRecordQueryKey(id), profile.id], staleTime: 30_000, refetchOnMount: true } });
  return <main className="page" data-testid="page-record-details">
    <div className="page-heading"><div><p className="eyebrow">Application record</p><h1>{q.data?.projectName ?? 'Record details'}</h1></div><div className="actions"><Link href="/records" className="button outline" data-testid="link-back-records">Back to records</Link></div></div>
    {q.isLoading && <div className="card card-body" role="status"><div className="record-skeleton" /><div className="record-skeleton" /></div>}
    {q.isError && <div className="card empty" role="alert"><AlertCircle size={28} /><h2>Record details are unavailable</h2><p>This record could not be loaded.</p><button className="button outline" onClick={() => q.refetch()}><RefreshCcw /> Retry</button></div>}
    {q.data && <><p className="notice">Records shown in this workspace use synthetic data modeled on public City housing and permit records. They are for system demonstration and workflow testing.</p><div className="card card-body"><FieldList r={q.data} /></div></>}
  </main>;
}

function Sel({ label, value, onChange, options, testid }: { label: string; value: string; onChange: (v: string) => void; options: string[]; testid: string }) {
  return <label>{label}<select className="select" value={value} onChange={e => onChange(e.target.value)} data-testid={testid}>{['All', ...options].map(o => <option key={o} value={o}>{o === 'All' ? `All` : o}</option>)}</select></label>;
}

export function RecordsWorkspace({ applicationsPage = false }: { applicationsPage?: boolean } = {}) {
  const q = usePortalRecords();
  const search = useSearch();
  const [, navigate] = useLocation();
  const [filters, setFilters] = useState<RecordFilters>(() => ({ ...EMPTY_FILTERS, category: parseStaffCategory(new URLSearchParams(search).get('category')) }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [open, setOpen] = useState<PortalReviewRecord | null>(null);
  const urlCategory = parseStaffCategory(new URLSearchParams(search).get('category'));
  useEffect(() => { setFilters(f => f.category === urlCategory ? f : { ...f, category: urlCategory }); setPage(1); }, [urlCategory]);

  const records = useMemo(() => q.data?.records ?? [], [q.data]);
  const filtered = useMemo(() => filterRecords(records, filters), [records, filters]);
  const view = paginate(filtered, page, pageSize);
  const opts = useMemo(() => ({
    housingType: uniqueValues(records, r => r.housingType), reviewStatus: uniqueValues(records, r => r.reviewStatus),
    sourceStatus: uniqueValues(records, r => r.sourceStatus), city: uniqueValues(records, r => r.city), zipCode: uniqueValues(records, r => r.zipCode),
  }), [records]);
  const set = <K extends keyof RecordFilters>(k: K, v: RecordFilters[K]) => {
    setFilters(f => ({ ...f, [k]: v })); setPage(1);
    if (k === 'category') navigate(`${applicationsPage ? '/applications' : '/records'}${categoryQuery(search, v as CategoryFilter)}`, { replace: true });
  };
  const clearFilters = () => {
    setFilters({ ...EMPTY_FILTERS }); setPage(1);
    navigate(`${applicationsPage ? '/applications' : '/records'}${categoryQuery(search, 'All')}`, { replace: true });
  };
  const isDefault = JSON.stringify(filters) === JSON.stringify(EMPTY_FILTERS);

  const rowActions = (r: PortalReviewRecord, mobile = false) => applicationsPage
    ? <Link className="button outline" href={`/applications/${encodeURIComponent(r.id)}`} data-testid={`button-${mobile ? 'card-' : ''}view-${r.id}`} aria-label={`View details for ${r.projectName}`}>View details <ChevronRight /></Link>
    : <button className="button outline" onClick={() => setOpen(r)} data-testid={`button-${mobile ? 'card-' : ''}view-${r.id}`} aria-label={`View details for ${r.projectName}`}>View details <ChevronRight /></button>;
  const badge = (r: PortalReviewRecord) => r.affordableHousing ? <span className="rw-badge" data-testid={`badge-affordable-${r.id}`}>Affordable Housing</span> : null;

  return <main className="page" data-testid="page-records">
    <div className="page-heading"><div><p className="eyebrow">Staff records · database-backed</p><h1>{applicationsPage ? 'Applications' : 'Application Records'}</h1><p className="lead">{CITY_DESCRIPTION}</p></div></div>
    {q.isLoading && <div className="card card-body" role="status" aria-label="Loading application records"><div className="record-skeleton" /><div className="record-skeleton" /><div className="record-skeleton" /></div>}
    {q.isError && <div className="card empty" role="alert" data-testid="error-records"><AlertCircle size={29} /><h2>Application records are unavailable</h2><p>The portal review records could not be loaded.</p><button className="button outline" onClick={() => q.refetch()} disabled={q.isFetching} data-testid="button-retry-records"><RefreshCcw /> Retry</button></div>}
    {q.data && <>
      {!applicationsPage && <div className="rw-meta" data-testid="text-source-counts"><span><strong>{fmtCount(q.data.officialCitySourceCount)}</strong> records in the City source dataset</span><a href={q.data.officialCitySourceUrl} target="_blank" rel="noopener noreferrer">Open City source</a></div>}
      <p className="notice rw-note">{q.data.notice}</p>
      <section className="card" aria-label="Application records">
        <div className="rw-filters">
          <div className="search-wrap"><Search /><input className="input" value={filters.search} onChange={e => set('search', e.target.value)} placeholder="Search permit number, project, address, ZIP, application type, or category" aria-label="Search application records" data-testid="input-search-records" /></div>
          {!applicationsPage && <Sel label="Record category" value={filters.category} onChange={v => set('category', parseStaffCategory(v))} options={[...STAFF_CATEGORY_OPTIONS]} testid="select-filter-category" />}
          <Sel label="Affordable housing" value={filters.affordable} onChange={v => set('affordable', v as AffordableFilter)} options={['Affordable', 'Not affordable']} testid="select-filter-affordable" />
          <Sel label="Housing type" value={filters.housingType} onChange={v => set('housingType', v)} options={opts.housingType} testid="select-filter-housing-type" />
          <Sel label="Application status" value={filters.reviewStatus} onChange={v => set('reviewStatus', v)} options={opts.reviewStatus} testid="select-filter-review-status" />
          <Sel label="Source status" value={filters.sourceStatus} onChange={v => set('sourceStatus', v)} options={opts.sourceStatus} testid="select-filter-source-status" />
          <Sel label="Housing units" value={filters.unitRange} onChange={v => set('unitRange', v as UnitRange)} options={UNIT_RANGES.slice(1)} testid="select-filter-units" />
          <Sel label="City" value={filters.city} onChange={v => set('city', v)} options={opts.city} testid="select-filter-city" />
          <Sel label="ZIP code" value={filters.zipCode} onChange={v => set('zipCode', v)} options={opts.zipCode} testid="select-filter-zip" />
        </div>
        <div className="rw-bar">
          <span data-testid="text-record-count" role="status">{view.items.length ? `Showing ${view.from}–${view.to}` : 'No matching records'}</span>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label>Per page <select className="select" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} data-testid="select-page-size"><option value={10}>10</option><option value={20}>20</option></select></label>
            <button className="button outline" onClick={clearFilters} disabled={isDefault} data-testid="button-clear-filters">Clear filters</button>
          </span>
        </div>
        {filtered.length === 0 ? <div className="empty" data-testid="empty-record-search"><Search size={29} /><h2>No matching records</h2><p>Try another search term or clear the filters.</p><button className="button outline" onClick={clearFilters}>Clear filters</button></div> : <>
          <div className="table-wrap rw-table-wrap"><table className="rw-table" data-testid="table-records">
            <thead><tr><th>Project</th><th>Address</th><th className="num">Total units</th><th className="num">Affordable units</th><th>Housing category</th><th>Status</th><th>Issued</th><th>Details</th></tr></thead>
            <tbody>{view.items.map(r => <tr key={r.id} data-testid={`row-record-${r.id}`}>
              <td><span className="table-title">{r.projectName}</span><span className="table-sub">{r.permitNumber}</span>{staffCategoryLabel(r.recordCategory) && <span className="rw-cat">{staffCategoryLabel(r.recordCategory)}</span>}{badge(r)}</td>
              <td>{r.address}</td>
              <td className="num">{r.totalHousingUnits}</td><td className="num">{r.affordableHousingUnits}</td>
              <td>{r.housingCategory}</td>
              <td><span className="status status-review">{r.reviewStatus}</span><span className="table-sub">Source: {r.sourceStatus}</span></td>
              <td>{fmtDate(r.issuedDate)}</td><td>{rowActions(r)}</td></tr>)}</tbody>
          </table></div>
          <div className="rw-grid">{view.items.map(r => <article key={r.id} className="rw-item" data-testid={`card-record-${r.id}`}>
            <div><span className="table-title">{r.projectName}</span><span className="table-sub">{r.permitNumber}{staffCategoryLabel(r.recordCategory) ? ` · ${staffCategoryLabel(r.recordCategory)}` : ''}</span>{badge(r)}</div>
            <dl><div><dt>Address</dt><dd>{r.address}</dd></div><div><dt>Status</dt><dd>{r.reviewStatus}</dd></div><div><dt>Total units</dt><dd>{r.totalHousingUnits}</dd></div><div><dt>Affordable units</dt><dd>{r.affordableHousingUnits}</dd></div><div><dt>Category</dt><dd>{r.housingCategory}</dd></div><div><dt>Issued</dt><dd>{fmtDate(r.issuedDate)}</dd></div></dl>
            {rowActions(r, true)}</article>)}</div>
          <nav className="rw-pager" aria-label="Record pagination">
            <span>Page {view.page} of {view.pages}</span>
            <div className="rw-pages">
              <button className="button outline" onClick={() => setPage(view.page - 1)} disabled={view.page <= 1} data-testid="button-prev-page">Previous</button>
              {pageNumbers(view.page, view.pages).map((n, i) => n === null ? <span key={`e${i}`} style={{ alignSelf: 'center' }}>…</span> : <button key={n} className={`button outline${n === view.page ? ' current' : ''}`} aria-current={n === view.page ? 'page' : undefined} onClick={() => setPage(n)} data-testid={`button-page-${n}`}>{n}</button>)}
              <button className="button outline" onClick={() => setPage(view.page + 1)} disabled={view.page >= view.pages} data-testid="button-next-page">Next</button>
            </div>
          </nav>
        </>}
      </section>
    </>}
    {open && <DetailsDialog record={open} onClose={() => setOpen(null)} />}
  </main>;
}
