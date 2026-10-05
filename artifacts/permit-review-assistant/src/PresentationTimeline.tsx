import { useState } from 'react';
import type { PresentationDocument, PresentationTimelineEvent } from '@workspace/api-client-react';
import { DocumentPreviewDialog } from './PresentationDocuments';

export function formatEventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}

export function PresentationTimeline({ timeline, documents }: { timeline: PresentationTimelineEvent[]; documents: PresentationDocument[] }) {
  const [active, setActive] = useState<PresentationDocument | null>(null);
  return <section id="timeline" className="ap-panel ap-content-panel pres-section" aria-labelledby="pres-timeline-title" data-testid="section-timeline">
    <h2 id="pres-timeline-title">Application timeline</h2>
    <p>Recorded progress for this portal-only presentation record. This is not a government filing or permit decision.</p>
    <ol className="ap-timeline">
      {timeline.map((event, index) => {
        const linked = event.documentIds.map(id => documents.find(d => d.id === id)).filter((d): d is PresentationDocument => !!d);
        return <li className={event.status} key={`${event.label}-${index}`} data-testid={`timeline-event-${index}`}>
          <span className="ap-timeline-dot" aria-hidden="true" />
          <div><strong>{event.label}</strong><small>{formatEventDate(event.date)}</small>
            {linked.length > 0 && <ul className="pres-linked">{linked.map(d => <li key={d.id}><button type="button" className="ap-text-link" onClick={() => setActive(d)}>{d.name}</button></li>)}</ul>}
          </div>
        </li>;
      })}
    </ol>
    <DocumentPreviewDialog doc={active} onClose={() => setActive(null)} />
  </section>;
}
