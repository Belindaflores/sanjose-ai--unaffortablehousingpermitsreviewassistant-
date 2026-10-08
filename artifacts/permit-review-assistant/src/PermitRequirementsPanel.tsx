import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ExternalLink,
  FileCheck2,
  FileSearch,
  LoaderCircle,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import {
  getGetPermitRequirementsEvaluationQueryKey,
  getListPermitApplicationsQueryKey,
  useGetPermitRequirementsEvaluation,
  useUpdatePermitRequirementDocument,
} from '@workspace/api-client-react';
import type {
  IntakeEvidence,
  PermitApplication,
  PermitRequirementResult,
  PermitRequirementsEvaluation,
  PotentialSb35Criterion,
} from '@workspace/api-client-react';
import './PermitRequirementsPanel.css';

type Props = {
  application: { id: string; requirementsEvaluation?: PermitRequirementsEvaluation };
  onSaved: (saved: PermitApplication) => void;
};

type StatusFilter = 'ALL' | 'PASS' | 'MISSING' | 'REVIEW' | 'NOT_APPLICABLE';

const STATUS_LABEL: Record<PermitRequirementResult['status'], string> = {
  PASS: 'Pass',
  MISSING: 'Missing',
  REVIEW: 'Staff review',
  NOT_APPLICABLE: 'Not applicable',
};

const STATUS_EXPLANATION: Record<PermitRequirementResult['status'], string> = {
  PASS: 'A required item was found with no obvious issue. PASS is unavailable in simulation-only mode.',
  MISSING: 'The simulation has no received checklist entry for this requirement.',
  REVIEW: 'Applicability or document satisfaction remains unverified and requires staff review.',
  NOT_APPLICABLE: 'The current evaluation determined this requirement does not apply to the project.',
};

function EvidenceList({ evidence, id }: { evidence: IntakeEvidence[]; id: string }) {
  if (!evidence.length) return <p className="prp-evidence-none">No supporting intake evidence was returned.</p>;
  return <div className="prp-evidence-list" data-testid={`list-requirement-evidence-${id}`}>
    {evidence.map((item, index) => <article className="prp-evidence" key={`${item.source}-${item.sourceField}-${index}`}>
      <dl>
        <div><dt>Source</dt><dd>{item.source}</dd></div>
        <div><dt>Source field</dt><dd>{item.sourceField}</dd></div>
        {item.documentName && <div><dt>Document name</dt><dd>{item.documentName}</dd></div>}
        {item.page !== null && <div><dt>Page</dt><dd>{item.page}</dd></div>}
      </dl>
      {item.quote && <blockquote>{item.quote}</blockquote>}
    </article>)}
  </div>;
}

function OfficialSource({ source }: { source: PermitRequirementResult['source'] }) {
  return <a
    className="prp-source-link"
    href={source.url}
    target="_blank"
    rel="noopener noreferrer"
    data-testid={`link-official-source-${source.section.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}
  >
    <ExternalLink size={13} aria-hidden="true" />
    <span>{source.title}{source.section ? ` · ${source.section}` : ''}</span>
  </a>;
}

function RequirementCard({
  requirement,
  pending,
  onToggle,
}: {
  requirement: PermitRequirementResult;
  pending: boolean;
  onToggle: (requirement: PermitRequirementResult, received: boolean) => void;
}) {
  const canSimulate = requirement.applicability === 'APPLIES';
  const isReceived = requirement.matched_documents.length > 0;
  const statusClass = requirement.status.toLowerCase().replace('_', '-');

  return <article className={`prp-requirement prp-status-${statusClass}`} data-testid={`requirement-card-${requirement.requirement_id}`}>
    <header className="prp-requirement-head">
      <div className="prp-requirement-title">
        <span className="prp-group">{requirement.group}</span>
        <h4>{requirement.requirement_name}</h4>
      </div>
      <span className={`prp-status-pill prp-pill-${statusClass}`} data-testid={`status-requirement-${requirement.requirement_id}`}>
        {STATUS_LABEL[requirement.status]}
      </span>
    </header>

    <div className="prp-requirement-main">
      <div className="prp-requirement-copy">
        {requirement.status === 'REVIEW' && <p className="prp-review-reason"><strong>Why staff review:</strong> {isReceived ? 'A simulated receipt is not file evidence; document satisfaction remains unverified.' : 'Applicability or local jurisdiction is unresolved; this is not a missing-document conclusion.'}</p>}
        <p className="prp-explanation">{requirement.explanation || STATUS_EXPLANATION[requirement.status]}</p>
        <div className="prp-detail-grid">
          <div className="prp-detail"><span>Required document</span><strong>{requirement.required_document}</strong></div>
          <div className="prp-detail"><span>Applicability</span><strong>{requirement.applicability === 'APPLIES' ? 'Applies' : requirement.applicability === 'UNKNOWN' ? 'Needs determination' : 'Does not apply'}</strong></div>
          <div className="prp-detail"><span>Validation method</span><strong>{requirement.validation_type}</strong></div>
        </div>
        <div className="prp-conditions">
          <span className="prp-label">When it applies</span>
          <p>{requirement.applicable_when.description || 'No additional condition description was provided.'}</p>
          {requirement.applicable_when.all.length > 0 && <ul>
            {requirement.applicable_when.all.map((condition, index) => <li key={`${requirement.requirement_id}-condition-${index}`}>{condition}</li>)}
          </ul>}
          {requirement.project_types.length > 0 && <p className="prp-project-types"><span>Project types:</span> {requirement.project_types.join(', ')}</p>}
        </div>
        {requirement.document_aliases.length > 0 && <p className="prp-aliases"><span>Recognized names:</span> {requirement.document_aliases.join(' · ')}</p>}
        {requirement.matched_documents.length > 0 && <div className="prp-matches"><span className="prp-label">Matched checklist labels</span><ul>{requirement.matched_documents.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}</ul></div>}
      </div>
      <aside className="prp-requirement-side">
        <div className="prp-sim-toggle" aria-label={`Simulated receipt for ${requirement.requirement_name}`}>
          <span className="prp-label">Checklist simulation</span>
          {canSimulate && <div className="prp-toggle-actions">
            <button type="button" className={`prp-choice ${isReceived ? 'selected' : ''}`} onClick={() => onToggle(requirement, true)} disabled={!canSimulate || pending || isReceived} data-testid={`button-simulate-received-${requirement.requirement_id}`}>
              {pending && !isReceived ? <LoaderCircle className="prp-spin" size={13} /> : <Check size={13} />} Received
            </button>
            <button type="button" className={`prp-choice ${!isReceived ? 'selected' : ''}`} onClick={() => onToggle(requirement, false)} disabled={!canSimulate || pending || !isReceived} data-testid={`button-simulate-missing-${requirement.requirement_id}`}>
              Missing
            </button>
          </div>}
          {!canSimulate && <p className="prp-toggle-help">{requirement.applicability === 'UNKNOWN' ? 'Receipt not assessed — applicability or local jurisdiction needs staff determination.' : 'This requirement is not activated for the current project information.'}</p>}
          {canSimulate && <p className="prp-toggle-help">{isReceived ? 'Received is a simulated checklist entry, not a verified file.' : 'Missing reflects simulated checklist status only.'}</p>}
        </div>
        <OfficialSource source={requirement.source} />
      </aside>
    </div>

    <details className="prp-evidence-details">
      <summary><FileSearch size={14} /> Intake evidence <span>{requirement.evidence.length}</span><ChevronDown size={14} className="prp-chevron" /></summary>
      <EvidenceList evidence={requirement.evidence} id={requirement.requirement_id} />
    </details>
  </article>;
}

function Criterion({ criterion }: { criterion: PotentialSb35Criterion }) {
  const statusLabel = criterion.status === 'OBSERVED' ? 'Observed' : criterion.status === 'ISSUE' ? 'Potential issue' : 'Unknown';
  return <article className="prp-criterion" data-testid={`sb35-criterion-${criterion.id}`}>
    <div className="prp-criterion-head">
      <h4>{criterion.label}</h4>
      <span className={`prp-criterion-status criterion-${criterion.status.toLowerCase()}`}>{statusLabel}</span>
    </div>
    <p>{criterion.explanation}</p>
    <EvidenceList evidence={criterion.evidence} id={`sb35-${criterion.id}`} />
    <OfficialSource source={criterion.source} />
  </article>;
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function PermitRequirementsPanel({ application, onSaved }: Props) {
  const queryClient = useQueryClient();
  const evaluationQuery = useGetPermitRequirementsEvaluation(application.id, {
    query: {
      enabled: Boolean(application.id),
      queryKey: getGetPermitRequirementsEvaluationQueryKey(application.id),
    },
  });
  const updateRequirement = useUpdatePermitRequirementDocument();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [saveError, setSaveError] = useState('');

  const evaluation = evaluationQuery.data ?? application.requirementsEvaluation;
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: getGetPermitRequirementsEvaluationQueryKey(application.id) });
  }, [queryClient, application.id, application.requirementsEvaluation?.evaluated_at]);
  const requirements = useMemo(() => evaluation?.requirements ?? [], [evaluation?.requirements]);
  const counts = useMemo(() => requirements.reduce((result, item) => {
    result[item.status] += 1;
    return result;
  }, { PASS: 0, MISSING: 0, REVIEW: 0, NOT_APPLICABLE: 0 }), [requirements]);
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return requirements.filter(requirement => {
      if (statusFilter !== 'ALL' && requirement.status !== statusFilter) return false;
      if (!term) return true;
      const searchable = [
        requirement.requirement_name,
        requirement.required_document,
        requirement.group,
        requirement.explanation,
        requirement.applicable_when.description,
        ...requirement.applicable_when.all,
        ...requirement.document_aliases,
        ...requirement.project_types,
        ...requirement.matched_documents,
      ].join(' ').toLocaleLowerCase();
      return searchable.includes(term);
    });
  }, [requirements, search, statusFilter]);

  const toggleReceived = async (requirement: PermitRequirementResult, received: boolean) => {
    if (updateRequirement.isPending || requirement.applicability !== 'APPLIES') return;
    setSaveError('');
    try {
      const saved = await updateRequirement.mutateAsync({
        id: application.id,
        data: { requirement_id: requirement.requirement_id, received },
      });
      onSaved(saved);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListPermitApplicationsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetPermitRequirementsEvaluationQueryKey(application.id) }),
      ]);
    } catch {
      setSaveError('The simulated checklist change could not be saved. Check the connection and try again.');
    }
  };

  if (evaluationQuery.isLoading && !evaluation) {
    return <section className="prp-panel card" aria-labelledby="prp-title" data-testid="panel-permit-requirements">
      <PanelHeader />
      <div className="prp-loading" role="status" aria-live="polite">
        <div className="prp-skeleton prp-skeleton-long" /><div className="prp-skeleton" /><div className="prp-skeleton" />
        <span>Loading requirements evaluation…</span>
      </div>
    </section>;
  }

  if (evaluationQuery.isError && !evaluation) {
    return <section className="prp-panel card" aria-labelledby="prp-title" data-testid="panel-permit-requirements">
      <PanelHeader />
      <div className="prp-query-error" role="alert">
        <AlertTriangle size={19} />
        <div><h3>Requirements could not be loaded</h3><p>Review the connection, then try loading this application’s evaluation again.</p></div>
        <button type="button" className="button outline" onClick={() => evaluationQuery.refetch()} disabled={evaluationQuery.isFetching} data-testid="button-retry-requirements">
          {evaluationQuery.isFetching ? <LoaderCircle className="prp-spin" size={15} /> : <RefreshCw size={15} />} Retry
        </button>
      </div>
    </section>;
  }

  if (!evaluation) {
    return <section className="prp-panel card" aria-labelledby="prp-title" data-testid="panel-permit-requirements">
      <PanelHeader />
      <div className="prp-no-evaluation" role="status">No requirements evaluation is available for this application yet. No requirements or eligibility results are inferred here.</div>
    </section>;
  }

  const intakeCaveat = evaluation.intake_status === 'failed'
    ? 'The server reports that intake processing failed. Displayed category and requirement results are deterministic rule output only and must be checked by staff.'
    : evaluation.intake_status === 'not-run'
      ? 'Intake processing has not run. Displayed category and requirement results are deterministic rule output only and must be checked by staff.'
      : '';

  return <section className="prp-panel card" aria-labelledby="prp-title" data-testid="panel-permit-requirements">
    <PanelHeader />
    <div className="prp-body">
      <div className="prp-simulation-notice" role="note">
        <AlertTriangle size={17} />
        <p><strong>Simulation only.</strong> “Received” and “Missing” update a simulated checklist entry; no files are uploaded or verified. A submitted item remains <strong>Staff review</strong> until staff examine the actual document. A simulated result is not an eligibility determination and must not change priority or review routing.</p>
      </div>
      {intakeCaveat && <div className="prp-intake-caveat" role="status"><AlertTriangle size={16} />{intakeCaveat}</div>}
      {evaluationQuery.isError && <div className="prp-stale-notice" role="status">Live refresh failed; showing the evaluation available on this application record. <button type="button" onClick={() => evaluationQuery.refetch()} disabled={evaluationQuery.isFetching}>Retry refresh</button></div>}

      <section className="prp-category" aria-labelledby="prp-category-title">
        <div className="prp-category-mark"><FileCheck2 size={19} /></div>
        <div className="prp-category-copy">
          <span className="prp-eyebrow">Current project category</span>
          <h3 id="prp-category-title" data-testid="text-project-category">{evaluation.project_category}</h3>
          <p>{evaluation.category_explanation}</p>
        </div>
        <div className="prp-category-meta"><span>Ruleset</span><strong>{evaluation.ruleset_version}</strong><span>Scope</span><strong>{evaluation.jurisdiction_scope}</strong></div>
      </section>
      <div className="prp-evaluation-meta"><span>Mode: {evaluation.mode}</span>{evaluation.evaluated_at && <span>Evaluated {dateLabel(evaluation.evaluated_at)}</span>}</div>
      <p className="prp-disclaimer">{evaluation.disclaimer}</p>

      <section className="prp-requirements-section" aria-labelledby="prp-requirements-title">
        <div className="prp-section-title">
          <div><span className="prp-eyebrow">Requirement review</span><h3 id="prp-requirements-title">Permit requirements</h3></div>
          <span className="prp-total-count">{requirements.length} requirements</span>
        </div>
        <div className="prp-filter-bar">
          <label className="prp-search">
            <Search size={16} aria-hidden="true" />
            <span className="prp-sr-only">Search requirements</span>
            <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search names, conditions, document aliases…" data-testid="input-search-requirements" />
          </label>
          <label className="prp-status-filter"><SlidersHorizontal size={15} aria-hidden="true" /><span className="prp-sr-only">Filter by result status</span>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)} data-testid="select-requirement-status-filter">
              <option value="ALL">All results ({requirements.length})</option>
              <option value="MISSING">Missing ({counts.MISSING})</option>
              <option value="REVIEW">Staff review ({counts.REVIEW})</option>
              <option value="PASS">Pass ({counts.PASS})</option>
              <option value="NOT_APPLICABLE">Not applicable ({counts.NOT_APPLICABLE})</option>
            </select>
          </label>
        </div>
        <div className="prp-status-legend" aria-label="Requirement result summary">
          <span><i className="prp-dot dot-missing" />{counts.MISSING} missing</span>
          <span><i className="prp-dot dot-review" />{counts.REVIEW} staff review</span>
          <span><i className="prp-dot dot-pass" />{counts.PASS} pass</span>
          <span><i className="prp-dot dot-na" />{counts.NOT_APPLICABLE} not applicable</span>
        </div>
        {requirements.length === 0
          ? <div className="prp-empty"><FileSearch size={22} /><h4>No requirements were returned</h4><p>The evaluation contains no requirement results to display.</p></div>
          : filtered.length === 0
            ? <div className="prp-empty"><Search size={21} /><h4>No matching requirements</h4><p>Try a different search or change the result filter.</p><button type="button" onClick={() => { setSearch(''); setStatusFilter('ALL'); }}>Clear filters</button></div>
            : <div className="prp-requirement-list">{filtered.map(requirement => <RequirementCard key={requirement.requirement_id} requirement={requirement} pending={updateRequirement.isPending} onToggle={toggleReceived} />)}</div>}
      </section>
      {saveError && <div className="prp-save-error" role="alert" data-testid="error-save-requirement">{saveError}</div>}

      <section className="prp-sb35" aria-labelledby="prp-sb35-title" data-testid="section-potential-sb35-screening">
        <header className="prp-sb35-header">
          <div><span className="prp-eyebrow">Separate screening · not a legal decision</span><h3 id="prp-sb35-title">Potential SB 35 screening</h3></div>
          <span className={`prp-sb35-status sb35-${evaluation.sb35_screening.status.toLowerCase().replace('_', '-')}`}>{evaluation.sb35_screening.status.replaceAll('_', ' ')}</span>
        </header>
        <p className="prp-sb35-message" data-testid="text-sb35-server-message">{evaluation.sb35_screening.message}</p>
        <p className="prp-sb35-disclaimer">{evaluation.sb35_screening.disclaimer}</p>
        {evaluation.sb35_screening.criteria.length
          ? <div className="prp-criteria-list">{evaluation.sb35_screening.criteria.map(criterion => <Criterion key={criterion.id} criterion={criterion} />)}</div>
          : <p className="prp-empty-inline">No screening criteria were returned.</p>}
      </section>
    </div>
  </section>;
}

function PanelHeader() {
  return <header className="prp-header">
    <div className="prp-header-icon"><FileCheck2 size={18} /></div>
    <div><span className="prp-eyebrow">Staff aid · requirements simulation</span><h2 id="prp-title">Permit requirements</h2></div>
  </header>;
}

export default PermitRequirementsPanel;
