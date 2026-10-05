import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { useReviewPermitChecks, type PermitApplication as ApiApplication } from '@workspace/api-client-react';
import { usePortalProfile } from './PortalAuth';
import type { PermitApplication } from './App';

export const PRIORITY_WARNING = 'Priority status is based on applicant-provided information and requires staff verification before it affects routing or review order.';
const SAFETY_FLAG = 'SAFETY-CRITICAL: Fire/Life-Safety Plan Missing';
const CONFLICT_FLAG = 'APPLICATION INFORMATION CONFLICT: Project classification does not match project description';

type ClaimItem = { key: string; label: string; status: string; note?: string; by?: string; at?: string };
const fmt = (v?: string) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(d) : '—'; };

export function claimItems(a: PermitApplication): ClaimItem[] {
  const items: ClaimItem[] = [];
  const claims = a.priorityClaims;
  if (a.claimed_affordable) items.push({ key: 'affordable', label: 'Affordable housing project', status: claims?.affordable?.status ?? 'Unverified', note: claims?.affordable?.note, by: claims?.affordable?.by, at: claims?.affordable?.at });
  if (a.claimed_underserved) items.push({ key: 'underserved', label: 'Located in an underserved community', status: claims?.underserved?.status ?? 'Unverified', note: claims?.underserved?.note, by: claims?.underserved?.by, at: claims?.underserved?.at });
  (a.claimedPriorityCategories ?? []).forEach(category => {
    const found = claims?.additional?.find(c => c.category === category);
    items.push({ key: category, label: category, status: found?.status ?? 'Unverified', note: found?.note, by: found?.by, at: found?.at });
  });
  return items;
}
const openIssues = (a: PermitApplication, type?: string) => (a.issues ?? []).filter(i => i.severity !== 'resolved' && (!type || i.type === type));
export const isSafety = (a: PermitApplication) => Boolean(a.ruleChecks?.safetyCriticalFlags?.length || a.reviewStatus.startsWith('On Hold — Safety') || openIssues(a, 'safety').length || a.flags.includes(SAFETY_FLAG));
export const isJurisdiction = (a: PermitApplication) => a.reviewStatus === 'Human jurisdiction review' || a.reviewStatus === 'Needs Jurisdiction Verification' || openIssues(a, 'jurisdiction').length > 0;
export const isConflict = (a: PermitApplication) => Boolean(a.ruleChecks?.classificationConflicts?.length || a.reviewStatus.startsWith('On Hold — Information') || openIssues(a, 'conflict').length || a.flags.includes(CONFLICT_FLAG));
export const isPriorityPending = (a: PermitApplication) => claimItems(a).some(c => c.status === 'Unverified');
const isMissingDocs = (a: PermitApplication) => a.aiStatus === 'Missing Information' || openIssues(a, 'documents').length > 0;
const isHuman = (a: PermitApplication) => isSafety(a) || isJurisdiction(a) || isConflict(a) || ['Human Review Required', 'Potential Issues Detected'].includes(a.reviewStatus) || Boolean(a.requiredReviewers?.length) || a.flags.some(f => /human review required/i.test(f));
const rank = (a: PermitApplication) => isSafety(a) ? 0 : isJurisdiction(a) ? 1 : isConflict(a) ? 2 : isPriorityPending(a) ? 3 : 4;

function sevClass(s: string) { return `sev sev-${s}`; }
const sevLabel: Record<string, string> = { critical: 'Safety-critical', review: 'Requires staff review', verification: 'Priority verification', informational: 'Informational', resolved: 'Cleared / resolved' };

export function HoldBadge({ app }: { app: PermitApplication }) {
  if (!isSafety(app)) return null;
  return <span className="sev sev-critical" data-testid={`badge-safety-${app.id}`}>Safety-critical</span>;
}

const FILTERS = ['All applications', 'Safety-critical', 'Jurisdiction review', 'Priority claim verification', 'Information conflict', 'Missing required documents', 'Human review required', 'Ready for review', 'Needs Human Review', 'Safety-Critical', 'New applications', 'Missing documents', 'Potential issues', 'Affordable housing', 'High priority', 'Additional agency review'];

export function StaffQueue({ applications }: { applications: PermitApplication[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(() => { const f = new URLSearchParams(window.location.search).get('filter'); return f === 'priority' ? 'High priority' : f === 'missing' ? 'Missing required documents' : 'All applications'; });
  const rows = useMemo(() => applications.filter(a => {
    if (!`${a.projectName} ${a.id} ${a.applicantName} ${a.companyName} ${a.projectAddress}`.toLowerCase().includes(query.toLowerCase())) return false;
    switch (filter) {
      case 'Safety-critical': case 'Safety-Critical': return isSafety(a);
      case 'Jurisdiction review': return isJurisdiction(a);
      case 'Priority claim verification': return isPriorityPending(a);
      case 'Information conflict': return isConflict(a);
      case 'Missing required documents': case 'Missing documents': return isMissingDocs(a);
      case 'Human review required': case 'Needs Human Review': return isHuman(a);
      case 'Ready for review': return a.reviewStatus === 'Ready for Review' && a.aiStatus === 'Ready for Human Review' && !isHuman(a);
      case 'New applications': return a.reviewStatus === 'New';
      case 'Potential issues': return a.aiStatus === 'Potential Issues Detected';
      case 'Affordable housing': return a.affordableHousing;
      case 'High priority': return a.priority !== 'Normal';
      case 'Additional agency review': return a.aiStatus === 'Additional Agency Review Required';
      default: return true;
    }
  }).sort((x, y) => rank(x) - rank(y)), [applications, query, filter]);
  return <section className="card" data-testid="staff-queue">
    <div className="filters"><input className="input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by project, applicant, or ID" aria-label="Search applications" data-testid="input-search-applications" />
      <select className="select" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter applications" data-testid="select-queue-filter">{FILTERS.map(f => <option key={f}>{f}</option>)}</select></div>
    <p className="section-note" style={{ padding: '0 20px' }} data-testid="staff-queue-count">Showing {rows.length} of {applications.length} accepted San José applications. Sorted: safety-critical, jurisdiction, information conflicts, priority verification, then ordinary review.</p>
    <div className="queue-list">{rows.map(a => {
      const open = openIssues(a)[0];
      const flagged = (a.issues ?? []).map(i => i.flaggedAt).filter(Boolean).sort()[0];
      const safety = isSafety(a);
      return <article key={a.id} className={`queue-item ${safety ? 'queue-critical' : ''}`} data-testid={`queue-item-${a.id}`}>
        <div className="queue-main"><strong>{a.projectName}</strong><span className="table-sub">{a.id} · {a.projectAddress}</span>
          <div className="queue-tags">{safety && <span className="sev sev-critical">Safety-critical</span>}{isJurisdiction(a) && <span className="sev sev-review">Jurisdiction review</span>}{isConflict(a) && <span className="sev sev-review">Information conflict</span>}{isPriorityPending(a) && <span className="sev sev-verification">Priority claim requires verification</span>}</div></div>
        <dl className="queue-facts"><div><dt>Project type</dt><dd>{a.projectType}</dd></div><div><dt>Affordable housing category</dt><dd>{a.housingCategory || 'Affordable housing-related project'}</dd></div><div><dt>Status</dt><dd>{a.reviewStatus}</dd></div><div><dt>Priority</dt><dd>{isPriorityPending(a) ? `${a.priority} (claim unverified)` : a.priority}</dd></div><div><dt>Required action</dt><dd>{open?.requiredAction ?? 'Standard staff review of complete application'}</dd></div><div><dt>Department</dt><dd>{open?.assignedDepartment ?? a.assignedDepartment}</dd></div><div><dt>Date flagged / submitted</dt><dd>{fmt(flagged || a.submittedAt)}</dd></div></dl>
        <Link href={`/applications/${a.id}`} className="button outline" data-testid={`link-view-details-${a.id}`}>View details</Link>
      </article>;
    })}</div>
    {!rows.length && <div className="empty" data-testid="empty-queue"><h2>No applications match</h2><p>Try a different filter or search term.</p></div>}
  </section>;
}

export function IssuesAndActions({ application: a, onSaved }: { application: PermitApplication; onSaved: (app: ApiApplication) => void }) {
  const profile = usePortalProfile();
  const review = useReviewPermitChecks();
  const isMarshal = profile.role === 'fire_marshal';
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [type, setType] = useState(a.projectType);
  const [permit, setPermit] = useState(a.permitType);
  const [units, setUnits] = useState(String(a.housingUnits));
  const [desc, setDesc] = useState(a.description);
  const issues = a.issues ?? [];
  const history = [...(a.auditHistory ?? [])].sort((x, y) => x.at.localeCompare(y.at));
  const claims = claimItems(a);
  const run = async (data: Parameters<typeof review.mutateAsync>[0]['data']) => {
    if (!note.trim()) { setError('A reason is required for every staff action.'); return; }
    setError('');
    try { onSaved(await review.mutateAsync({ id: a.id, data: { ...data, note: note.trim() } })); setNote(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'The server did not accept this action.'); }
  };
  const showConflict = isConflict(a);
  return <section className="card card-body rule-panel issues-panel" data-testid="issues-required-actions">
    <h2>Issues and Required Actions</h2>
    <div data-testid="staff-required-routing"><h3>Server-required routing</h3><ol>{a.recommendedRouting.map((route, index) => <li key={route}>{index === 0 ? <strong>{route}</strong> : route}</li>)}</ol></div>
    {a.documents.filter(d => d.received && d.objectPath).map(d => <p key={d.objectPath}><a href={`/api/storage${d.objectPath}`} target="_blank" rel="noopener noreferrer">Download {d.label}: {d.fileName}</a></p>)}
    {!issues.length && <p>No open issues recorded for this application.</p>}
    {issues.map((i, n) => <div key={n} className={`issue-row issue-${i.severity}`} data-testid={`issue-${i.type}-${n}`}>
      <div className="issue-head"><span className={sevClass(i.severity)}>{sevLabel[i.severity] ?? i.severity}</span><strong className="issue-type">{i.type}</strong><span className="issue-status">{i.status}</span></div>
      <p><b>Reason:</b> {i.reason}</p><p><b>Required action:</b> {i.requiredAction}</p><p><b>Department:</b> {i.assignedDepartment} · Flagged {fmt(i.flaggedAt)}</p>
    </div>)}
    <label className="reason-field">Reason / action taken (required for every action)<textarea className="textarea" value={note} onChange={e => setNote(e.target.value)} data-testid="textarea-action-reason" /></label>
    {error && <p className="rule-alert" role="alert" data-testid="text-action-error">{error}</p>}

    {isSafety(a) && <div className="issue-row issue-critical"><h3>Fire/life-safety review</h3>
      {isMarshal ? <><p>Describe the action taken and the reason. A waiver does not mark the missing document complete.</p><button className="button danger" disabled={review.isPending} onClick={() => run({ action: 'safety', document: 'Fire and life safety plan', note })} data-testid="button-clear-safety">Clear safety flag</button></>
        : <p data-testid="text-fire-marshal-only">Only a City Worker with Fire Marshal permissions can clear or override this flag.</p>}</div>}

    {isJurisdiction(a) && <div className="issue-row issue-review"><h3>Human jurisdiction review</h3><p>{a.ruleChecks?.jurisdictionReason ?? 'The address is incomplete, ambiguous, or near a boundary.'}</p><button className="button teal" disabled={review.isPending} onClick={() => run({ action: 'jurisdiction', note })} data-testid="button-confirm-jurisdiction">Confirm County jurisdiction</button></div>}

    {claims.length > 0 && <div className="issue-row issue-verification" data-testid="priority-claims"><h3>{isPriorityPending(a) ? 'Priority claim requires verification' : 'Priority claim decisions'}</h3><p className="priority-warning">{PRIORITY_WARNING}</p>
      {claims.map(c => <div key={c.key} className="claim-row"><p><b>Selected category:</b> {c.label}</p><p><b>Status:</b> <span data-testid={`claim-status-${c.key}`}>{c.status}</span>{c.by ? ` · ${c.by} · ${fmt(c.at)}` : ''}</p>{c.note && <p>{c.note}</p>}
        <div className="actions"><button className="button teal" disabled={review.isPending} onClick={() => run({ action: 'claim', claim: c.key, decision: 'Verified', note })} data-testid={`button-verify-claim-${c.key}`}>Verify claim</button><button className="button secondary" disabled={review.isPending} onClick={() => run({ action: 'request_documentation', claim: c.key, note })} data-testid={`button-request-docs-${c.key}`}>Request supporting documentation</button><button className="button danger" disabled={review.isPending} onClick={() => run({ action: 'claim', claim: c.key, decision: 'Rejected', note })} data-testid={`button-reject-claim-${c.key}`}>Reject claim</button></div></div>)}</div>}

    {showConflict && <div className="issue-row issue-review" data-testid="conflict-panel"><h3>Conflicting application information</h3>
      <div className="conflict-grid"><dl className="conflict-recorded"><h4>Recorded values</h4><div><dt>Project type</dt><dd>{a.projectType}</dd></div><div><dt>Permit type</dt><dd>{a.permitType}</dd></div><div><dt>Unit count</dt><dd>{a.housingUnits}</dd></div><div><dt>Description</dt><dd>{a.description}</dd></div></dl>
        <form className="conflict-form" onSubmit={e => { e.preventDefault(); void run({ action: 'conflict', projectType: type, permitType: permit, housingUnits: Number(units), description: desc, note }); }}><h4>Resolve conflict</h4>
          <label>Project type<select className="select" value={type} onChange={e => setType(e.target.value)}>{['Single-family residential', 'Accessory dwelling unit', 'Addition', 'Small multifamily housing', 'Multifamily housing', 'Commercial', 'Senior residential care'].map(o => <option key={o}>{o}</option>)}</select></label>
          <label>Permit type<input className="input" value={permit} onChange={e => setPermit(e.target.value)} /></label>
          <label>Unit count<input className="input" type="number" min="0" step="1" value={units} onChange={e => setUnits(e.target.value)} /></label>
          <label>Description<textarea className="textarea" value={desc} onChange={e => setDesc(e.target.value)} /></label>
          <button className="button teal" disabled={review.isPending} data-testid="button-resolve-conflict">Resolve conflict</button></form></div></div>}

    <h3 style={{ marginTop: 22 }}>Audit history</h3>
    {!history.length ? <p>No audit entries yet.</p> : <ol className="audit-list" data-testid="audit-history">{history.map(h => <li key={h.id}><strong>{h.action}</strong> · {h.decision}<span className="table-sub">{fmt(h.at)} · {h.workerName} ({h.workerId})</span><p>{h.reason}</p>{h.detail && <p className="table-sub">{h.detail}</p>}</li>)}</ol>}
  </section>;
}
