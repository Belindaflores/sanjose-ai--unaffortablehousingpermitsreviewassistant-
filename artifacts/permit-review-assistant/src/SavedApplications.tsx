import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { ChevronRight, FilePenLine, FolderOpen, MapPin } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getListSavedApplicationsQueryKey, useListSavedApplications, useUpdateSavedApplication,
  type SavedApplication,
} from '@workspace/api-client-react';
import { usePortalProfile } from './PortalAuth';
import { DocumentReceiptSummary, PresentationDocuments, PresentationTimeline } from './PresentationDocuments';
import './saved-applications.css';

const portalBasePath = import.meta.env.BASE_URL.replace(/\/$/, '');
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

function SavedCard({ record }: { record: SavedApplication }) {
  return <article className="ap-panel saved-card" data-testid={`saved-application-${record.id}`}>
    <div className="saved-card-heading">
      <div><p className="ap-kicker">{record.presentationOnly ? 'SUBMITTED APPLICATION' : 'SAVED APPLICATION'}</p><h3>{record.projectName}</h3></div>
      <span className="saved-status">{record.status}</span>
    </div>
    <p className="ap-record-meta">{record.applicationNumber}</p>
    <p className="ap-record-meta"><MapPin size={15} aria-hidden="true" /> {record.projectAddress}</p>
    <dl className="saved-facts">
      <div><dt>Application type</dt><dd>{record.applicationType}</dd></div>
      <div><dt>Current status</dt><dd>{record.status}</dd></div>
      <div><dt>{record.presentationOnly ? 'Date submitted' : 'Date saved'}</dt><dd>{formattedDate(record.submittedAt ?? record.dateSaved)}</dd></div>
      <div><dt>Last updated</dt><dd>{formattedDate(record.lastUpdated)}</dd></div>
    </dl>
    <DocumentReceiptSummary documents={record.documents} />
    {record.presentationOnly && <p className="ap-record-meta">Portal presentation record · Synthetic document metadata</p>}
    <div className="saved-actions">
      <Link href={`/saved-applications/${record.id}${record.presentationOnly ? '' : '/edit'}`} className="ap-btn"><FilePenLine size={16} aria-hidden="true" /> {record.presentationOnly ? 'View application' : 'Continue application'}</Link>
      <Link href={`/saved-applications/${record.id}`} className="ap-text-link">View details <ChevronRight size={16} aria-hidden="true" /></Link>
      {record.presentationOnly && <><a href={`${portalBasePath}/saved-applications/${record.id}#documents`} className="ap-text-link">View documents</a><a href={`${portalBasePath}/saved-applications/${record.id}#timeline`} className="ap-text-link">Application timeline</a></>}
    </div>
  </article>;
}

export function SavedApplicationsSection({ submittedOnly = false }: { submittedOnly?: boolean }) {
  const records = useOwnedSavedApplications();
  const applications = records.data?.filter(record => !submittedOnly || record.presentationOnly);
  if (submittedOnly && records.isSuccess && !applications?.length) return null;
  return <section className="saved-section" aria-labelledby="saved-applications-title">
    <div className="ap-section-heading"><div><h2 id="saved-applications-title">{submittedOnly ? 'Submitted portal applications' : 'Your applications'}</h2><p>{submittedOnly ? 'View your application, received documents, and recorded timeline.' : 'Manage your saved applications and continue any projects in progress.'}</p></div></div>
    {records.isPending && <p role="status">Loading your saved applications…</p>}
    {records.isError && <div className="ap-panel ap-content-panel" role="alert">Saved applications could not be loaded. <button className="ap-text-link" onClick={() => records.refetch()}>Retry</button></div>}
    {applications?.length ? <div className="saved-card-grid">{applications.map(record => <SavedCard key={record.id} record={record} />)}</div> : null}
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
    if (!record?.presentationOnly) return;
    const section = window.location.hash.slice(1);
    if (section === 'documents' || section === 'timeline') {
      requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView());
    }
  }, [record?.id]);

  if (records.isPending) return <main className="page applicant-page" role="status">Loading saved application…</main>;
  if (records.isError) return <main className="page applicant-page" role="alert">Unable to load your saved application. <button onClick={() => records.refetch()}>Retry</button></main>;
  if (!record) return <main className="page applicant-page" role="alert"><h1>Saved application not found</h1><p>This application is not available to your account.</p><Link href="/applications">Back to your applications</Link></main>;
  const editable = editing && !record.presentationOnly;

  return <main className="page applicant-page">
    <header className="ap-hero"><div className="ap-hero-copy">
      <Link href="/applications" className="ap-text-link">← Your applications</Link>
      <p className="ap-kicker" style={{ marginTop: 22 }}>{record.presentationOnly ? 'SUBMITTED APPLICATION' : 'SAVED APPLICATION'}</p>
      <h1 className="ap-heading">{editable ? 'Continue application' : record.projectName}</h1>
      <p className="ap-lede">{record.applicationNumber} · {record.status}</p>
    </div></header>
    <div className="ap-panel ap-content-panel saved-detail">
      {editable ? <form onSubmit={async event => {
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
          {record.submittedAt && <div><dt>Date submitted</dt><dd>{formattedDate(record.submittedAt)}</dd></div>}
          <div><dt>Last updated</dt><dd>{formattedDate(record.lastUpdated)}</dd></div>
        </dl>
        <p>{record.description}</p>
        <DocumentReceiptSummary documents={record.documents} />
        <p className="ap-record-meta">{record.presentationOnly ? 'This is a submitted portal presentation record, not an official government submission or approval. Document entries are synthetic metadata only.' : 'This is saved work, not an officially submitted or approved permit.'}</p>
        {!record.presentationOnly && <Link href={`/saved-applications/${record.id}/edit`} className="ap-btn"><FilePenLine size={16} aria-hidden="true" /> Continue application</Link>}
      </>}
    </div>
    {record.presentationOnly && <div className="presentation-detail-sections">
      <PresentationDocuments documents={record.documents} />
      <PresentationTimeline id={record.id} timeline={record.timeline} />
    </div>}
  </main>;
}