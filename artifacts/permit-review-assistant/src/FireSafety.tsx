import { useState } from 'react';
import { useRequestUploadUrl, useUploadPermitFirePlan, getListPermitApplicationsQueryKey, type PermitApplication as ApiApplication } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import type { PermitApplication } from './App';

export const FIRE_SAFETY_LABEL = 'SAFETY-CRITICAL: Fire/Life-Safety Plan Missing';

export function FireSafetyNotice({ application }: { application: PermitApplication }) {
  if (!application.ruleChecks?.safetyCriticalFlags.length) return null;
  return <section className="safety-critical" role="alert" data-testid="fire-safety-notice">
    <h2>{FIRE_SAFETY_LABEL}</h2>
    <p><strong>On Hold - Safety Review Required · Fire Marshal Review - REQUIRED</strong></p>
    <p>Please upload a fire/life-safety plan. This prototype requires it for residential projects with 20 or more units and other applicable multifamily projects, so emergency access, evacuation routes, and fire-safety provisions can be reviewed.</p>
    <p>Your application cannot move to the next review stage until the plan is uploaded or Fire Marshal-authorized staff records an override with a reason. A missing plan is never counted as complete.</p>
  </section>;
}

export function FirePlanUpload({ application, onSaved }: { application: PermitApplication; onSaved: (app: ApiApplication) => void }) {
  const requestUpload = useRequestUploadUrl();
  const attach = useUploadPermitFirePlan();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const missing = application.documents.some(d => d.label === 'Fire and life safety plan' && d.required && !(d.received && d.objectPath));
  if (!missing || ['Approved', 'Denied'].includes(application.reviewStatus)) return null;
  async function upload(file: File) {
    setBusy(true); setError(''); setMessage('');
    try {
      if (file.size < 1 || file.size > 10 * 1024 * 1024 || !['application/pdf', 'image/png', 'image/jpeg'].includes(file.type)) throw new Error('Choose a PDF, PNG, or JPEG file between 1 byte and 10 MB.');
      const contentType = file.type as 'application/pdf' | 'image/png' | 'image/jpeg';
      const target = await requestUpload.mutateAsync({ data: { name: file.name, size: file.size, contentType } });
      const result = await fetch(target.uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
      if (!result.ok) throw new Error('The plan upload failed. Your safety hold has not been cleared.');
      const saved = await attach.mutateAsync({ id: application.id, data: { objectPath: target.objectPath } });
      onSaved(saved);
      await queryClient.invalidateQueries({ queryKey: getListPermitApplicationsQueryKey() });
      setMessage('Fire/life-safety plan received. The server recalculated the safety hold; this is not approval.');
    } catch (e) { setError(e instanceof Error ? e.message : 'The plan could not be attached. Your safety hold remains in place.'); }
    finally { setBusy(false); }
  }
  return <section className="card card-body rule-panel" data-testid="fire-plan-upload">
    <h2>Upload the missing fire/life-safety plan</h2>
    <p>Attach the actual plan, not just a document-received checkbox. The server verifies the uploaded file before recalculating the hold.</p>
    <label>Fire/life-safety plan<input type="file" accept=".pdf,.png,.jpg,.jpeg" disabled={busy} data-testid="input-fire-plan" onChange={e => { const file = e.currentTarget.files?.[0]; if (file) void upload(file); e.currentTarget.value = ''; }} /></label>
    {busy && <p role="status">Uploading and checking the plan…</p>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </section>;
}