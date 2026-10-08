import type { IntakeAnalysis, PermitDocumentVerification, PermitRequirement, RequirementEvidence, SB35Criterion, SB35Screening } from '@workspace/api-client-react';
import { AlertTriangle, ArrowUpRight, ClipboardCheck, FileSearch, ShieldAlert } from 'lucide-react';
import './PermitRequirementsPanel.css';

type Props = {
  analysis?: IntakeAnalysis | null;
};

function safeExternalUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
}

function SourceReference({ source, testId }: { source: PermitRequirement['source']; testId: string }) {
  const href = safeExternalUrl(source.url);
  return <div className="permit-source" data-testid={testId}>
    <span className="permit-source-label">Rule source</span>
    <div className="permit-source-copy">
      <strong>{source.title}</strong>
      <span>{source.reference}</span>
    </div>
    {href && <a className="permit-source-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${source.title} in a new tab`} data-testid={`link-source-${testId}`}>
      Open source <ArrowUpRight size={13} aria-hidden="true" />
    </a>}
  </div>;
}

function StatusTag({ value, kind = 'default' }: { value: string; kind?: 'default' | 'applicability' | 'checklist' }) {
  const styleKey = value.toLowerCase().replaceAll('_', '-');
  return <span className={`permit-tag permit-tag-${kind} permit-tag-${styleKey}`}>{value.replaceAll('_', ' ')}</span>;
}

function EvidenceList({ evidence, id }: { evidence: RequirementEvidence[]; id: string }) {
  if (!evidence.length) return <p className="permit-evidence-empty" data-testid={`text-evidence-empty-${id}`}>No evidence entries were returned.</p>;
  return <div className="permit-evidence-list" data-testid={`list-evidence-${id}`}>
    {evidence.map((item, index) => <article className="permit-evidence" key={`${item.source}-${item.description}-${index}`} data-testid={`evidence-${id}-${index}`}>
      <div className="permit-evidence-meta">
        <span className="permit-evidence-origin">{item.source}</span>
        <span>{item.description}</span>
        {item.documentName !== null && <span className="permit-evidence-file">Filename: {item.documentName}</span>}
        {item.page !== null && <span className="permit-evidence-page">Page {item.page}</span>}
      </div>
      <blockquote>{item.quote}</blockquote>
    </article>)}
  </div>;
}

function RequirementCard({ requirement, index }: { requirement: PermitRequirement; index: number }) {
  const id = `${requirement.requirementId}-${index}`;
  return <article className="permit-requirement" data-testid={`requirement-${id}`}>
    <header className="permit-result-header">
      <div className="permit-result-heading">
        <span className="permit-result-id">{requirement.requirementId}</span>
        <h4>{requirement.requirementName}</h4>
      </div>
      <div className="permit-result-tags" aria-label="Requirement result">
        <StatusTag value={requirement.status} />
        <StatusTag value={requirement.applicability} kind="applicability" />
      </div>
    </header>
    <div className="permit-requirement-body">
      <p className="permit-explanation">{requirement.explanation}</p>
      <div className="permit-detail-grid">
        <div className="permit-detail">
          <span className="permit-detail-label">Applies when</span>
          <p>{requirement.applicableWhen}</p>
        </div>
        <div className="permit-detail">
          <span className="permit-detail-label">Required-document label</span>
          <p>{requirement.requiredDocument}</p>
        </div>
        <div className="permit-detail">
          <span className="permit-detail-label">Project types returned</span>
          <p>{requirement.projectTypes.length ? requirement.projectTypes.join(', ') : 'No project types returned.'}</p>
        </div>
        <div className="permit-detail">
          <span className="permit-detail-label">Validation approach</span>
          <p>{requirement.validationType}</p>
        </div>
      </div>
      <div className="permit-checklist-line">
        <span className="permit-detail-label">Document checklist signal</span>
        <StatusTag value={requirement.documentChecklistStatus} kind="checklist" />
        <span className="permit-checklist-caution">Simulated declaration only—not document verification.</span>
      </div>
      <section className="permit-evidence-section" aria-labelledby={`evidence-heading-${id}`}>
        <h5 id={`evidence-heading-${id}`}>Returned evidence</h5>
        <EvidenceList evidence={requirement.evidence} id={id} />
      </section>
      <div className="permit-recommendation">
        <span className="permit-detail-label">Staff recommendation</span>
        <p>{requirement.recommendation}</p>
      </div>
      <SourceReference source={requirement.source} testId={`source-requirement-${id}`} />
    </div>
  </article>;
}

function StringList({ title, values, testId }: { title: string; values: string[]; testId: string }) {
  return <div className="permit-string-list" data-testid={testId}>
    <span className="permit-detail-label">{title}</span>
    {values.length
      ? <ul>{values.map((value, index) => <li key={`${index}-${value}`}>{value}</li>)}</ul>
      : <p>No entries returned.</p>}
  </div>;
}

function VerificationCard({ verification, index }: { verification: PermitDocumentVerification; index: number }) {
  const id = `verification-${index}`;
  const staffReview = verification.status === 'REVIEW' || verification.checklistStatus === 'unavailable' || verification.couldNotVerify.length > 0;
  return <article className="permit-verification" data-testid={`${id}-${verification.documentLabel}`}>
    <header className="permit-result-header">
      <div className="permit-result-heading">
        <span className="permit-result-id">Document verification</span>
        <h4>{verification.documentLabel}</h4>
      </div>
      <div className="permit-result-tags">
        <StatusTag value={verification.status} />
        <StatusTag value={verification.checklistStatus} kind="checklist" />
      </div>
    </header>
    <div className="permit-requirement-body">
      <p className="permit-explanation">{verification.explanation}</p>
      <div className="permit-detail-grid permit-verification-grid">
        <StringList title="Detected (exact returned values)" values={verification.detected} testId={`list-detected-${index}`} />
        <StringList title="Could not verify (exact returned values)" values={verification.couldNotVerify} testId={`list-could-not-verify-${index}`} />
        <div className="permit-detail">
          <span className="permit-detail-label">Project match</span>
          <p>{verification.projectMatch}</p>
          <StringList title="Project-match notes (exact returned values)" values={verification.projectMatchNotes} testId={`list-project-match-notes-${index}`} />
        </div>
        <div className="permit-detail">
          <span className="permit-detail-label">AI confidence</span>
          <p>{verification.aiConfidence === null ? 'NOT ASSESSED' : `${verification.aiConfidence}% · advisory only`}</p>
        </div>
      </div>
      <div className="permit-recommendation">
        <span className="permit-detail-label">Recommendation</span>
        <p>{verification.recommendation}</p>
      </div>
      {staffReview && <div className="permit-review-request" role="note" data-testid={`notice-staff-review-${index}`}>
        <AlertTriangle size={15} aria-hidden="true" /> Staff review is requested; verification is not possible from this aid.
      </div>}
      <SourceReference source={verification.source} testId={`source-verification-${index}`} />
    </div>
  </article>;
}

function ScreeningCriterion({ criterion, index }: { criterion: SB35Criterion; index: number }) {
  const id = `criterion-${index}`;
  return <article className="permit-criterion" data-testid={`${id}-${criterion.name}`}>
    <div className="permit-criterion-heading">
      <h4>{criterion.name}</h4>
      <StatusTag value={criterion.observation} />
    </div>
    <p className="permit-explanation">{criterion.explanation}</p>
    <div className="permit-evidence-section">
      <h5>Returned evidence</h5>
      <EvidenceList evidence={criterion.evidence} id={id} />
    </div>
  </article>;
}

function ScreeningSection({ screening }: { screening: SB35Screening }) {
  return <section className="permit-screening" aria-labelledby="permit-screening-title" data-testid="section-sb35-screening">
    <header className="permit-section-heading permit-screening-heading">
      <div className="permit-section-mark screening-mark"><ShieldAlert size={18} aria-hidden="true" /></div>
      <div>
        <span className="permit-section-kicker">Separate informational screen</span>
        <h3 id="permit-screening-title">Potential SB 35 screening</h3>
        <p>This returned message and its observations are screening aid output only.</p>
      </div>
    </header>
    <div className="permit-screening-message" role="status" data-testid="status-sb35-screening-message">{screening.screeningMessage}</div>
    <p className="permit-explanation permit-screening-explanation">{screening.explanation}</p>
    <div className="permit-affordable-declaration" data-testid="status-applicant-affordable-housing">
      Applicant identifies affordable housing: <strong>{screening.applicantIdentifiesAffordableHousing ? 'Yes' : 'No'}</strong>
    </div>
    <div className="permit-criteria-list">
      {screening.criteria.length
        ? screening.criteria.map((criterion, index) => <ScreeningCriterion key={`${criterion.name}-${index}`} criterion={criterion} index={index} />)
        : <p className="permit-empty">No criteria were returned for this screening.</p>}
    </div>
    <div className="permit-screening-disclaimer" role="note">
      <AlertTriangle size={17} aria-hidden="true" />
      <div><strong>Not a final eligibility determination.</strong><p>{screening.disclaimer}</p><p>Staff must independently verify every criterion and applicable rules before making any determination.</p></div>
    </div>
    <SourceReference source={screening.source} testId="source-sb35-screening" />
  </section>;
}

export function PermitRequirementsPanel({ analysis }: Props) {
  const verifications = analysis?.documentVerifications;
  const requirements = analysis?.requirements;
  const screening = analysis?.sb35Screening;
  const hasAnyOutput = (verifications?.length ?? 0) > 0 || (requirements?.length ?? 0) > 0 || screening !== undefined;
  return <section className="permit-assistant card" aria-labelledby="permit-assistant-title" data-testid="panel-permit-requirements">
    <header className="permit-assistant-header">
      <div className="permit-title-line">
        <span className="permit-assistant-icon"><ClipboardCheck size={19} aria-hidden="true" /></span>
        <div><span className="permit-kicker">City Worker aid · sourced checklist</span><h2 id="permit-assistant-title">Document verification &amp; permit requirements</h2></div>
      </div>
      <span className="permit-staff-badge">Staff review only</span>
    </header>
    <div className="permit-assistant-body">
      <div className="permit-scope-notice" role="note" data-testid="notice-permit-assistant-scope">
        <FileSearch size={17} aria-hidden="true" />
        <p><strong>No actual files analyzed.</strong> Checklist checkmarks are simulated declarations. Documents, pages, and file content were not accessed; no content matches, code compliance, or legal requirements are verified here. This simulation-only engine does not return PASS.</p>
      </div>

      {!hasAnyOutput && <div className="permit-not-generated" role="status" data-testid="status-permit-results-not-generated">
        <span className="permit-not-generated-index">—</span>
        <div><h3>Requirements aid not generated for this saved analysis</h3><p>This record may predate these outputs. No checklist results or screening are available to display; nothing has been inferred.</p></div>
      </div>}

      <section className="permit-results-section" aria-labelledby="permit-verification-heading">
        <div className="permit-section-heading">
          <div className="permit-section-mark verification-mark"><FileSearch size={17} aria-hidden="true" /></div>
          <div><span className="permit-section-kicker">Checklist signal only</span><h3 id="permit-verification-heading">Document verification</h3><p>Returned labels and values are shown exactly; files have not been reviewed.</p></div>
          {verifications && <span className="permit-result-count" data-testid="count-document-verifications">{verifications.length} returned</span>}
        </div>
        {verifications === undefined
          ? <p className="permit-empty" data-testid="status-verifications-not-generated">No document-verification output was saved for this analysis.</p>
          : verifications.length
            ? <div className="permit-verification-list">{verifications.map((verification, index) => <VerificationCard key={`${verification.documentLabel}-${index}`} verification={verification} index={index} />)}</div>
            : <p className="permit-empty" data-testid="status-verifications-empty">The saved analysis returned no document-verification entries.</p>}
      </section>

      <section className="permit-results-section" aria-labelledby="permit-requirements-heading">
        <div className="permit-section-heading">
          <div className="permit-section-mark"><ClipboardCheck size={17} aria-hidden="true" /></div>
          <div><span className="permit-section-kicker">Rule-by-rule results</span><h3 id="permit-requirements-heading">Multifamily requirements checklist</h3><p>Applicability, returned evidence, and cited reference for each saved result.</p></div>
          {requirements && <span className="permit-result-count" data-testid="count-permit-requirements">{requirements.length} returned</span>}
        </div>
        {requirements === undefined
          ? <p className="permit-empty" data-testid="status-requirements-not-generated">No requirements output was saved for this analysis.</p>
          : requirements.length
            ? <div className="permit-requirements-list">{requirements.map((requirement, index) => <RequirementCard key={`${requirement.requirementId}-${index}`} requirement={requirement} index={index} />)}</div>
            : <p className="permit-empty" data-testid="status-requirements-empty">The saved analysis returned no requirement entries.</p>}
      </section>

      {screening
        ? <ScreeningSection screening={screening} />
        : <section className="permit-screening-not-generated" aria-labelledby="permit-screening-title" data-testid="status-sb35-not-generated">
          <div className="permit-section-heading">
            <div className="permit-section-mark screening-mark"><ShieldAlert size={17} aria-hidden="true" /></div>
            <div><span className="permit-section-kicker">Separate informational screen</span><h3 id="permit-screening-title">Potential SB 35 screening</h3><p>No screening result was saved with this analysis. No outcome has been inferred.</p></div>
          </div>
        </section>}
      <footer className="permit-audit-footer" role="note" data-testid="notice-permit-aid-boundary">
        <strong>Advisory aid only.</strong> Use the cited references to inform human review; a City source link does not establish any legal requirement beyond the cited reference. This panel cannot alter application priority, routing, or workflow.
      </footer>
    </div>
  </section>;
}

export default PermitRequirementsPanel;
