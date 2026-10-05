import { Fragment, useState } from 'react';
import { FileText, Info } from 'lucide-react';
import type { PresentationDocument } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
export function formatStamp(value: string) {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value)) + ' UTC';
}
export function requiredComplete(docs: PresentationDocument[]) {
  const req = docs.filter(d => d.required);
  return { done: req.filter(d => d.uploadStatus === 'Received').length, total: req.length, complete: req.length > 0 && req.every(d => d.uploadStatus === 'Received') };
}

export function DocumentPreviewDialog({ doc, onClose }: { doc: PresentationDocument | null; onClose: () => void }) {
  return <Dialog open={!!doc} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="doc-dialog" data-testid="dialog-document-info">
      {doc && <>
        <DialogHeader>
          <DialogTitle>{doc.name}</DialogTitle>
          <DialogDescription>Document information for this portal-only presentation record.</DialogDescription>
        </DialogHeader>
        <dl className="saved-facts doc-dialog-facts">
          <div><dt>Document name</dt><dd>{doc.name}</dd></div>
          <div><dt>File name</dt><dd>{doc.fileName}</dd></div>
          <div><dt>Category</dt><dd>{doc.category}</dd></div>
          <div><dt>Document type</dt><dd>{doc.required ? 'Required document' : 'Supporting document'}</dd></div>
          <div><dt>Status</dt><dd>{doc.uploadStatus}</dd></div>
          <div><dt>Upload date</dt><dd>{formatStamp(doc.uploadedAt)}</dd></div>
          <div><dt>File type</dt><dd>PDF ({doc.fileType})</dd></div>
          <div><dt>File size</dt><dd>{formatBytes(doc.sizeBytes)}{doc.synthetic ? ' (synthetic)' : ''}</dd></div>
        </dl>
        <p className="doc-disclosure"><Info size={16} aria-hidden="true" /> The date, file size, and file details shown here are synthetic metadata for presentation only. No actual file was uploaded, stored, or validated, and no download is available.</p>
      </>}
    </DialogContent>
  </Dialog>;
}

export function PresentationDocuments({ documents, highlightIds = [] }: { documents: PresentationDocument[]; highlightIds?: string[] }) {
  const [active, setActive] = useState<PresentationDocument | null>(null);
  const status = requiredComplete(documents);
  return <section id="documents" className="ap-panel ap-content-panel pres-section" aria-labelledby="pres-documents-title" data-testid="section-documents">
    <h2 id="pres-documents-title">Documents</h2>
    <p>{documents.length} documents received. {status.complete ? 'Required documents complete' : `${status.done} of ${status.total} required documents received`} ({status.done} of {status.total}).</p>
    <ul className="pres-doc-list">
      {documents.map(doc => <li key={doc.id} id={`document-${doc.id}`} className={`pres-doc${highlightIds.includes(doc.id) ? ' linked' : ''}`} data-testid={`document-record-${doc.id}`}>
        <FileText size={18} aria-hidden="true" />
        <div><strong>{doc.name}</strong><small>{doc.required ? 'Required' : 'Supporting document'} · {doc.fileName.split('_').map((part, index) => <Fragment key={index}>{index > 0 && <>_<wbr /></>}{part}</Fragment>)}</small></div>
        <div className="pres-doc-actions">
          <span className="ap-document-state">{doc.uploadStatus}</span>
          <button type="button" className="ap-text-link" onClick={() => setActive(doc)} aria-label={`View information for ${doc.name}`} data-testid={`button-document-info-${doc.id}`}>View info</button>
        </div>
      </li>)}
    </ul>
    <p className="ap-record-meta">Document dates and sizes are synthetic metadata. No files were actually uploaded or validated.</p>
    <DocumentPreviewDialog doc={active} onClose={() => setActive(null)} />
  </section>;
}
