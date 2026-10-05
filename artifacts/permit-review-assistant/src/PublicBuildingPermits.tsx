import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { RefreshCcw, ChevronRight } from 'lucide-react';
import { getListBuildingPermitRecordsQueryKey, useListBuildingPermitRecords } from '@workspace/api-client-react';
import './public-building-permits.css';

const value = (text: string | null) => text || 'Not provided in source';

export function PublicBuildingPermitOverview() {
  const params = { page: 1, pageSize: 25 as const, q: '' };
  const result = useListBuildingPermitRecords(params, {
    query: { queryKey: getListBuildingPermitRecordsQueryKey(params), staleTime: 60_000, refetchInterval: 60_000, retry: 1 },
  });
  return <div className="card public-data-overview" data-testid="metric-applications">
    <div><strong>Applications · official City building permits</strong>
      <p data-testid="official-building-permit-total">
        {result.isLoading ? 'Checking the official source…' : result.isError
          ? 'The official source is temporarily unavailable.'
          : `${result.data ? Math.min(result.data.datasetTotal, 100).toLocaleString() : '—'} records in Active Building Permits`}
      </p>
      <p className="section-note">City of San José Open Data · dashboard count capped at 100; all public records remain available to browse</p>
    </div>
    <Link href="/records" className="button outline" data-testid="link-county-public-records">Browse all public permits <ChevronRight /></Link>
  </div>;
}

export function PublicBuildingPermits({ search, preview = false }: { search: string; preview?: boolean }) {
  const [params, setParams] = useState<{ q: string; page: number; pageSize: 25 | 50 | 100 }>({ q: '', page: 1, pageSize: 25 });
  useEffect(() => {
    const timer = setTimeout(() => setParams(current => ({ ...current, q: search.trim(), page: 1 })), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useListBuildingPermitRecords(params, {
    query: { queryKey: getListBuildingPermitRecordsQueryKey(params), staleTime: 60_000, refetchOnMount: 'always', refetchInterval: 60_000, retry: 1 },
  });
  const data = query.data;
  const searching = search.trim() !== params.q;
  const busy = query.isFetching || searching;
  const start = data?.records.length ? (params.page - 1) * params.pageSize + 1 : 0;
  const end = data ? (params.page - 1) * params.pageSize + data.records.length : 0;
  const pagination = <div className="official-pagination">
    <span role="status" data-testid="official-page-count">
      {data && !searching ? `Showing ${start.toLocaleString()}–${(start ? end : 0).toLocaleString()} of ${data.total.toLocaleString()}${params.q ? ' matching' : ''} records` : 'Loading records…'}
    </span>
    <label>Per page <select className="select" aria-label="Official permits per page" value={params.pageSize}
      onChange={event => setParams(current => ({ ...current, page: 1, pageSize: Number(event.target.value) as 25 | 50 | 100 }))}>
      <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
    </select></label>
    <button className="button outline" disabled={busy || params.page === 1} onClick={() => setParams(current => ({ ...current, page: current.page - 1 }))}>Previous</button>
    <span>Page {params.page}</span>
    <button className="button outline" disabled={busy || !data?.nextPage} onClick={() => setParams(current => ({ ...current, page: current.page + 1 }))}>Next</button>
    <button className="button outline" disabled={busy || !data?.nextPage} onClick={() => data && setParams(current => ({ ...current, page: Math.max(1, Math.ceil(data.total / current.pageSize)) }))}>Last page</button>
  </div>;

  return <section className="card official-public-permits" aria-label="Official City building permits" data-testid="official-building-permits">
    <div className="card-header official-public-heading">
      <div><h2>{preview ? 'Official applications' : 'Active Building Permits'}</h2><p className="section-note">City of San José Open Data · authentic official source records</p>
        {!preview && data && !query.isError && <p><strong>{data.datasetTotal.toLocaleString()} total public records</strong></p>}
      </div>
      <a className="button outline" href="https://data.sanjoseca.gov/dataset/active-building-permits" target="_blank" rel="noopener noreferrer">Open official dataset</a>
    </div>
    <div className="card-body">
      <p className="section-note">These are the City's published source records, including every record type in this dataset. They are not private portal submissions or prototype review decisions. This source covers San José, not every jurisdiction in Santa Clara County.</p>
      {query.isError ? <div role="alert" className="notice">
        <strong>The official source is temporarily unavailable.</strong>
        <p>We could not load the public dataset. Saved portal applications are unaffected.</p>
        <button className="button outline" disabled={query.isFetching} onClick={() => query.refetch()}><RefreshCcw /> Retry official source</button>
      </div> : <>
        {!preview && pagination}
        {query.isLoading || searching ? <p role="status">Loading official building permits…</p> : data && <>
          {data.records.length === 0 ? <p role="status">No official building permits match this search.</p> : <div className="table-wrap">
            <table className="official-table"><thead><tr><th>Permit number</th><th>Project / source details</th><th>Address</th><th>Permit type</th><th>Source status</th><th>Issued</th></tr></thead>
              <tbody>{(preview ? data.records.slice(0, 6) : data.records).map(record => <tr key={record.sourceId} data-testid={`official-permit-${record.sourceId}`}>
                <td>{value(record.permitNumber)}</td>
                <td><strong>{value(record.projectName)}</strong>
                  <details className="official-details"><summary>View source fields</summary>
                    <dl><dt>Official applicant</dt><dd>{value(record.applicant)}</dd><dt>Project type</dt><dd>{value(record.projectType)}</dd>
                      <dt>Work description</dt><dd>{value(record.workDescription)}</dd><dt>Dwelling units</dt><dd>{value(record.dwellingUnits)}</dd>
                      <dt>Permit valuation (source)</dt><dd>{value(record.valuation)}</dd><dt>Final date (source)</dt><dd>{value(record.finalDate)}</dd>
                    </dl>
                  </details>
                </td>
                <td>{value(record.address)}</td><td>{value(record.permitType)}</td><td>{value(record.status)}</td><td>{value(record.issuedDate?.split(' ')[0] ?? null)}</td>
              </tr>)}</tbody>
            </table>
          </div>}
          {!preview && data.records.length > 0 && pagination}
          <p className="section-note">Source retrieved {new Date(data.fetchedAt).toLocaleString()}. Counts and records may change when the City updates its dataset.</p>
        </>}
      </>}
    </div>
  </section>;
}