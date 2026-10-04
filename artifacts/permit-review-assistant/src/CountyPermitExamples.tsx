import { getListCountyPublicRecordsQueryKey, useListCountyPublicRecords, type CountyPublicRecord } from '@workspace/api-client-react';
import { ExternalLink, Info, MapPin } from 'lucide-react';
import './county-permit-examples.css';

// These are existing imported public records, not fabricated applications or
// records owned by the signed-in applicant. Never merge them into private data.
const EXAMPLE_IDS = ['2023-081161-MF', '2024-111170-RS'] as const;

function sourceDate(value: string | null) {
  if (!value) return 'Not reported in source';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Invalid source date' : new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(date);
}

function CountyRecord({ record }: { record: CountyPublicRecord }) {
  const housing = record.housingDetails;
  if (!housing) return null;
  return <article className="county-example ap-panel" data-testid={`county-example-${record.sourceRecordId}`}>
    <div className="county-example-heading">
      <div>
        <p className="ap-kicker">Authentic City housing permit · Read-only example</p>
        <h3>{record.businessName || `Public record ${record.sourceRecordId}`}</h3>
        <p className="ap-record-meta">{record.sourceRecordId} · {record.datasetName}</p>
      </div>
      <span className="ap-status review">{housing.status} · Source snapshot</span>
    </div>
    <p className="county-example-location"><MapPin size={15} aria-hidden="true" />{record.siteLocation || 'Address not reported in source'}</p>
    <p className="ap-record-meta"><strong>{housing.dwellingUnits} housing {housing.dwellingUnits === 1 ? 'unit' : 'units'}</strong> · {housing.projectType} · {housing.workDescription}</p>
    <p className="ap-record-meta">Permit issued {sourceDate(housing.issuedDate)}</p>
    <details className="county-example-details">
      <summary>View source dates and record details</summary>
      <dl>
        <div><dt>Official permit number</dt><dd>{housing.permitNumber}</dd></div>
        <div><dt>Housing type</dt><dd>{housing.projectType}</dd></div>
        <div><dt>Dwelling units reported by City</dt><dd>{housing.dwellingUnits}</dd></div>
        <div><dt>Work description</dt><dd>{housing.workDescription}</dd></div>
        <div><dt>Permit issued</dt><dd>{sourceDate(housing.issuedDate)}</dd></div>
        <div><dt>Permit final date</dt><dd>{sourceDate(housing.finalDate)}</dd></div>
        <div><dt>Permit valuation reported by City</dt><dd>{housing.permitValuation == null ? 'Not reported in source' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(housing.permitValuation)}</dd></div>
        <div><dt>Data provider</dt><dd>{record.dataSource}</dd></div>
      </dl>
       <p className="ap-record-meta">These public records are not submissions by your portal account. They are imported source snapshots, not live City status. No privately uploaded plans or AI screening results have been invented. Missing final dates do not mean construction is complete.</p>
    </details>
    <a className="ap-text-link" href={record.sourceUrl} target="_blank" rel="noopener noreferrer">
      View City housing permit dataset <ExternalLink size={14} aria-hidden="true" />
    </a>
  </article>;
}

export function CountyPermitExamples() {
  const records = useListCountyPublicRecords({ query: { queryKey: getListCountyPublicRecordsQueryKey(), staleTime: 60_000 } });
  const examples = EXAMPLE_IDS.map(id => records.data?.find(record => record.sourceRecordId === id && record.housingDetails)).filter((record): record is CountyPublicRecord => !!record);
  return <section className="county-examples" aria-label="Database-backed public housing permit examples" data-testid="county-permit-examples">
    <div className="ap-section-heading"><div>
      <h2>Public housing permit examples</h2>
      <p>Two authentic housing-construction permits stored from the City of San José’s Active Building Permits dataset.</p>
    </div><span className="ap-status review">Public source · Read-only</span></div>
    <p className="county-example-notice"><Info size={16} aria-hidden="true" /><span>These public examples are for showcasing the portal. They are not submissions by your account and do not expose another applicant’s private records.</span></p>
    {records.isLoading ? <p role="status">Loading housing permits from the database…</p>
      : records.isError ? <div role="alert">Housing examples could not be loaded. <button className="ap-text-link" onClick={() => records.refetch()}>Retry</button></div>
      : <>{examples.length !== EXAMPLE_IDS.length && <p role="alert">One or more housing showcase records are missing from the imported City dataset. No pool permits or fictional replacements have been added.</p>}
        <div className="ap-record-list">{examples.map(record => <CountyRecord key={record.sourceRecordId} record={record} />)}</div></>}
  </section>;
}