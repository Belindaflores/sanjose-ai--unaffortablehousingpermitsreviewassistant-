import { CheckCircle2, FileText, Info } from 'lucide-react';
import type { PresentationDocument, PresentationTimelineEvent } from '@workspace/api-client-react';

export function formatPresentationDate(value: string) {
  // Calendar dates must not become October 3 when viewed in Pacific time.
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(date);
}

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : `${Math.round(bytes / 1024)} KB`;
}

export function DocumentReceiptSummary({ documents }: { documents: PresentationDocument[] }) {
  if (!documents.length) return null;
  const received = documents.filter(document => document.uploadStatus === 'Received');
  const required = documents.filter(document => document.required);
  const complete = required.length > 0 && required.every(document => document.uploadStatus === 'Received');
  return <div className="presentation-receipt-summary" data-testid="document-receipt-summary">
    <strong><FileText size={16} aria-hidden="true" /> {received.length} documents received</strong>
    {complete && <span><CheckCircle2 size={16} aria-hidden="true" /> Required documents complete</span>}
  </div>;
}

export function PresentationDocuments({ documents }: { documents: PresentationDocument[] }) {
  return <section id="documents" className="ap-panel ap-content-panel presentation-documents" aria-labelledby="presentation-documents-title">
    <h2 id="presentation-documents-title">Documents</h2>
    <DocumentReceiptSummary documents={documents} />
    <p className="presentation-disclosure"><Info size={16} aria-hidden="true" /> Synthetic document metadata for presentation only. No PDF files were uploaded or verified. Receipt dates and file sizes are illustrative.</p>
    <div className="presentation-document-list">{documents.map(document => <article className="presentation-document" key={document.id} data-testid={`presentation-document-${document.id}`}>
      <div className="presentation-document-heading">
        <div><h3>{document.documentName}</h3><p>{document.fileName}</p></div>
        <span className="ap-document-state">{document.uploadStatus}</span>
      </div>
      <dl className="saved-facts">
        <div><dt>Category</dt><dd>{document.category}</dd></div>
        <div><dt>Requirement</dt><dd>{document.required ? 'Required' : 'Supporting document'}</dd></div>
        <div><dt>Upload date</dt><dd>{formatPresentationDate(document.uploadDate)}</dd></div>
        <div><dt>File type / size</dt><dd>PDF · {fileSize(document.fileSizeBytes)}</dd></div>
      </dl>
      <details className="presentation-document-preview" data-testid={`view-document-${document.id}`}>
        <summary>View document info</summary>
        <div className="presentation-metadata-preview">
          <strong>{document.documentName}</strong>
          <p>{document.fileName}</p>
          <dl className="saved-facts">
            <div><dt>Upload status</dt><dd>{document.uploadStatus}</dd></div>
            <div><dt>File type</dt><dd>{document.fileType}</dd></div>
            <div><dt>File size</dt><dd>{fileSize(document.fileSizeBytes)}</dd></div>
            <div><dt>Upload date</dt><dd>{formatPresentationDate(document.uploadDate)}</dd></div>
          </dl>
          <p>Metadata-only preview. There is no underlying PDF to view or download.</p>
        </div>
      </details>
    </article>)}</div>
  </section>;
}

export function PresentationTimeline({ id, timeline }: { id: string; timeline: PresentationTimelineEvent[] }) {
  return <section id="timeline" className="ap-panel ap-content-panel" aria-labelledby="presentation-timeline-title">
    <h2 id="presentation-timeline-title">Application timeline</h2>
    <p className="ap-record-meta">Presentation history, not an official government receipt or review decision.</p>
    <ol className="ap-timeline">{timeline.map(event => <li className={event.status} key={event.label}>
      <span className="ap-timeline-dot" aria-hidden="true" /><div>
        <strong>{event.label}</strong><small>{formatPresentationDate(event.date)}</small>
        {event.documentsMilestone && <a href="#documents" className="ap-text-link">View received documents</a>}
      </div>
    </li>)}</ol>
  </section>;
}