import { useState, useEffect } from 'react';
import { PresentationDocuments, requiredComplete } from './PresentationDocuments';
import { PresentationTimeline } from './PresentationTimeline';
import { Link, useLocation } from 'wouter';
import { ChevronRight, FilePenLine, FolderOpen, MapPin } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListSavedApplicationsQueryKey, useListSavedApplications, useUpdateSavedApplication,
  type SavedApplication,
} from '@workspace/api-client-react';
import { usePortalProfile } from './PortalAuth';
import './saved-applications.css';

function formattedDate(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
}

export function useOwnedSavedApplications() {
  const profile = usePortalProfile();
  const records = useListSavedApplications({
    query: {
      queryKey: [...getListSavedApplicationsQueryKey(), profile.id],
      refetchOnMount: 'always',
      refetchOnWindowFocus: 'always',
      staleTime: 15_000,
    },
  });
  return {
    ...records,
    data: records.data?.filter(record =>
      record.applicantEmail.toLowerCase() === profile.email.toLowerCase()),
  };
}

function SubmittedCard({ record }: { record: SavedApplication }) {
  const req = requiredComplete(record.documents);
  const base = `/saved-applications/${record.id}`;
  return <article className="ap-panel saved-card submitted-card" data-testid={`saved-application-${record.id}`}>
    <div className="saved-card-heading">
      <div><p className="ap-kicker">SUBMITTED APPLICATION</p><h3>{record.projectName}</h3></div>
      <span className="saved-status">{record.status}</span>
    </div>
    <p className="ap-record-meta">{record.applicationNumber}</p>
    <p className="ap-record-meta"><MapPin size={15} aria-hidden="true" /> {record.projectAddress}</p>
    <dl className="saved-facts">
      <div><dt>Application type</dt><dd>{record.applicationType}</dd></div>
      <div><dt>Current status</dt><dd>{record.status}</dd></div>
      <div><dt>Documents</dt><dd>{record.documents.length} documents received</dd></div>
      <div><dt>Required documents</dt><dd>{req.complete ? 'Required documents complete' : `${req.done} of ${req.total} received`}</dd></div>
      <div><dt>Date saved</dt><dd>{formattedDate(record.dateSaved)}</dd></div>
      <div><dt>Last updated</dt><dd>{formattedDate(record.lastUpdated)}</dd></div>
    </dl>
    <p className="ap-record-meta">Portal-only presentation record · Synthetic document metadata.</p>
    <div className="saved-actions">
      <Link href={base} className="ap-btn" data-testid={`link-view-application-${record.id}`}>View application</Link>
      <Link href={`${base}#documents`} className="ap-text-link">Documents <ChevronRight size={16} aria-hidden="true" /></Link>
      <Link href={`${base}#timeline`} className="ap-text-link">Application timeline <ChevronRight size={16} aria-hidden="true" /></Link>
    </div>
  </article>;
}

function SavedCard({ record }: { record: SavedApplication }) {
  if (record.isPresentationSubmission) return <SubmittedCard record={record} />;
  return <article className="ap-panel saved-card" data-testid={`saved-application-${record.id}`}>
    <div className="saved-card-heading">
      <div><p className="ap-kicker">SAVED APPLICATION</p><h3>{record.projectName}</h3></div>
      <span className="saved-status">{record.status}</span>
    </div>
    <p className="ap-record-meta">{record.applicationNumber}</p>
    <p className="ap-record-meta"><MapPin size={15} aria-hidden="true" /> {record.projectAddress}</p>
    <dl className="saved-facts">
      <div><dt>Application type</dt><dd>{record.applicationType}</dd></div>
      <div><dt>Current status</dt><dd>{record.status}</dd></div>
      <div><dt>Date saved</dt><dd>{formattedDate(record.dateSaved)}</dd></div>
      <div><dt>Last updated</dt><dd>{formattedDate(record.lastUpdated)}</dd></div>
    </dl>
    <div className="saved-actions">
      <Link href={`/saved-applications/${record.id}/edit`} className="ap-btn"><FilePenLine size={16} aria-hidden="true" /> Continue application</Link>
      <Link href={`/saved-applications/${record.id}`} className="ap-text-link">View details <ChevronRight size={16} aria-hidden="true" /></Link>
    </div>
  </article>;
}

export function SavedApplicationsSection() {
  const records = useOwnedSavedApplications();
  return <section className="saved-section" aria-labelledby="saved-applications-title">
    <div className="ap-section-heading"><div><h2 id="saved-applications-title">Your applications</h2><p>Manage your saved applications and continue any projects in progress.</p></div></div>
    {records.isPending && <p role="status">Loading your saved applications…</p>}
    {records.isError && <div className="ap-panel ap-content-panel" role="alert">Saved applications could not be loaded. <button className="ap-text-link" onClick={() => records.refetch()}>Retry</button></div>}
    {records.data?.length ? <div className="saved-card-grid">{records.data.map(record => <SavedCard key={record.id} record={record} />)}</div> : null}
    {records.isSuccess && !records.data?.length && <div className="ap-panel ap-content-panel"><FolderOpen aria-hidden="true" /><p>No saved applications for this account.</p><Link href="/new-application" className="ap-text-link">Start an application <ChevronRight size={16} aria-hidden="true" /></Link></div>}
  </section>;
}

export function SavedApplicationPage({ id, editing }: { id: string; editing: boolean }) {
  const profile = usePortalProfile();
  const records = useOwnedSavedApplications();
  const record = records.data?.find(item => item.id === id);
  const [, navigate] = useLocation();
  const client = useQueryClient();
  const update = useUpdateSavedApplication();
  const [form, setForm] = useState({ projectName: '', projectAddress: '', applicationType: '', description: '' });
  useEffect(() => {
    if (record) setForm({
      projectName: record.projectName, projectAddress: record.projectAddress,
      applicationType: record.applicationType, description: record.description,
    });
  }, [record?.id, editing]);

  useEffect(() => {
    if (!record?.isPresentationSubmission || editing) return;
    const hash = window.location.hash.slice(1);
    if (hash) setTimeout(() => document.getElementById(hash)?.scrollIntoView(), 50);
  }, [record?.id, editing]);

  if (records.isPending) return <main className="page applicant-page" role="status">Loading saved application…</main>;
  if (records.isError) return <main className="page applicant-page" role="alert">Unable to load your saved application. <button onClick={() => records.refetch()}>Retry</button></main>;
  if (!record) return <main className="page applicant-page" role="alert"><h1>Saved application not found</h1><p>This application is not available to your account.</p><Link href="/applications">Back to your applications</Link></main>;

  if (record.isPresentationSubmission && editing) return <main className="page applicant-page" data-testid="readonly-submitted">
    <header className="ap-hero"><div className="ap-hero-copy">
      <Link href="/applications" className="ap-text-link">← Your applications</Link>
      <p className="ap-kicker" style={{ marginTop: 22 }}>SUBMITTED APPLICATION</p>
      <h1 className="ap-heading">This application is read-only</h1>
      <p className="ap-lede">{record.projectName} · {record.status}</p>
    </div></header>
    <div className="ap-panel ap-content-panel saved-detail"><p>This submitted presentation record can no longer be edited.</p><Link href={`/saved-applications/${record.id}`} className="ap-btn">View application</Link></div>
  </main>;

  if (record.isPresentationSubmission) {
    const req = requiredComplete(record.documents);
    return <main className="page applicant-page">
      <header className="ap-hero"><div className="ap-hero-copy">
        <Link href="/applications" className="ap-text-link">← Your applications</Link>
        <p className="ap-kicker" style={{ marginTop: 22 }}>SUBMITTED APPLICATION</p>
        <h1 className="ap-heading">{record.projectName}</h1>
        <p className="ap-lede">{record.applicationNumber} · {record.status}</p>
      </div></header>
      <div className="ap-panel ap-content-panel saved-detail wide">
        <dl className="saved-facts">
          <div><dt>Account owner</dt><dd>{record.accountOwner}</dd></div>
          <div><dt>Application number</dt><dd>{record.applicationNumber}</dd></div>
          <div><dt>Address</dt><dd>{record.projectAddress}</dd></div>
          <div><dt>Application type</dt><dd>{record.applicationType}</dd></div>
          <div><dt>Current status</dt><dd>{record.status}</dd></div>
          <div><dt>Submitted</dt><dd>{record.submittedAt ? formattedDate(record.submittedAt) : 'Date unavailable'}</dd></div>
          <div><dt>Documents</dt><dd>{record.documents.length} documents received</dd></div>
          <div><dt>Required documents</dt><dd>{req.complete ? 'Required documents complete' : `${req.done} of ${req.total} received`}</dd></div>
        </dl>
        <p>{record.description}</p>
        <p className="ap-record-meta">This is a portal-only presentation record. It is not a government filing, and no permit decision has been made.</p>
        <nav className="saved-actions" aria-label="Application sections"><a href="#documents" className="ap-text-link">Documents</a><a href="#timeline" className="ap-text-link">Application timeline</a></nav>
      </div>
      <PresentationDocuments documents={record.documents} />
      <PresentationTimeline timeline={record.timeline} documents={record.documents} />
    </main>;
  }

  return <main className="page applicant-page">
    <header className="ap-hero"><div className="ap-hero-copy">
      <Link href="/applications" className="ap-text-link">← Your applications</Link>
      <p className="ap-kicker" style={{ marginTop: 22 }}>SAVED APPLICATION</p>
      <h1 className="ap-heading">{editing ? 'Continue application' : record.projectName}</h1>
      <p className="ap-lede">{record.applicationNumber} · {record.status}</p>
    </div></header>
    <div className="ap-panel ap-content-panel saved-detail">
      {editing ? <form onSubmit={async event => {
        event.preventDefault();
        try {
          const saved = await update.mutateAsync({ id: record.id, data: form });
          client.setQueryData<SavedApplication[]>(
            [...getListSavedApplicationsQueryKey(), profile.id],
            previous => previous?.map(item => item.id === saved.id ? saved : item),
          );
          await client.invalidateQueries({ queryKey: getListSavedApplicationsQueryKey() });
          navigate(`/saved-applications/${record.id}`);
        } catch { /* An inline error below retains the entered fields. */ }
      }}>
        <label>Project name<input className="input" required maxLength={180} value={form.projectName} onChange={event => setForm({ ...form, projectName: event.target.value })} /></label>
        <label>Address<input className="input" required maxLength={240} value={form.projectAddress} onChange={event => setForm({ ...form, projectAddress: event.target.value })} /></label>
        <label>Application type<input className="input" required maxLength={100} value={form.applicationType} onChange={event => setForm({ ...form, applicationType: event.target.value })} /></label>
        <label>Project details<textarea className="input" maxLength={2000} rows={4} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
        <p className="ap-record-meta">Saving changes keeps this application in progress. It does not submit a permit for review.</p>
        {update.isError && <p role="alert">Could not save changes. Please retry.</p>}
        <div className="saved-actions"><button type="submit" className="ap-btn" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save changes'}</button><Link href={`/saved-applications/${record.id}`} className="ap-text-link">Cancel</Link></div>
      </form> : <>
        <dl className="saved-facts">
          <div><dt>Account owner</dt><dd>{record.accountOwner}</dd></div>
          <div><dt>Application number</dt><dd>{record.applicationNumber}</dd></div>
          <div><dt>Address</dt><dd>{record.projectAddress}</dd></div>
          <div><dt>Application type</dt><dd>{record.applicationType}</dd></div>
          <div><dt>Current status</dt><dd>{record.status}</dd></div>
          <div><dt>Date saved</dt><dd>{formattedDate(record.dateSaved)}</dd></div>
          <div><dt>Last updated</dt><dd>{formattedDate(record.lastUpdated)}</dd></div>
        </dl>
        <p>{record.description}</p>
        <p className="ap-record-meta">This is saved work, not an officially submitted or approved permit.</p>
        <Link href={`/saved-applications/${record.id}/edit`} className="ap-btn"><FilePenLine size={16} aria-hidden="true" /> Continue application</Link>
      </>}
    </div>
  </main>;
}