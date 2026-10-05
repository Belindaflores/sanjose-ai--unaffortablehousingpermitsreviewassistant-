import { useState } from 'react';
import { useCorrectPermitClassification, useGetPermitRuleConfig, useUpdatePermitRuleConfig, type PermitApplication as ApiApplication } from '@workspace/api-client-react';
import type { PermitApplication } from './App';

export function ClassificationCorrection({ application: app, onSaved }: { application: PermitApplication; onSaved: (app: ApiApplication) => void }) {
  const correct = useCorrectPermitClassification();
  const [type, setType] = useState(app.projectType);
  const [units, setUnits] = useState(String(app.housingUnits));
  const [description, setDescription] = useState(app.description);
  const [error, setError] = useState('');
  if (!app.ruleChecks?.classificationConflicts.length) return null;
  return <section className="card card-body rule-panel" data-testid="classification-correction"><h2>Propose a classification correction</h2><p className="rule-alert">Project classification conflict — human review required. Your correction is a proposal. The application stays on hold until County staff review and resolve the conflict.</p><ul>{app.ruleChecks.classificationConflicts.map(c => <li key={c}>{c}</li>)}</ul><form onSubmit={async e => { e.preventDefault(); setError(''); try { onSaved(await correct.mutateAsync({ id: app.id, data: { projectType: type, housingUnits: Number(units), description } })); } catch { setError('The correction could not be saved. Check the values and try again.'); } }}>
    <label>Project type<select className="select" value={type} onChange={e => setType(e.target.value)}><option>Single-family residential</option><option>Accessory dwelling unit</option><option>Addition</option><option>Small multifamily housing</option><option>Multifamily housing</option><option>Commercial</option><option>Senior residential care</option></select></label>
    <label>Housing units<input className="input" type="number" min="0" step="1" required value={units} onChange={e => setUnits(e.target.value)} /></label>
    <label>Project description<textarea className="textarea" required value={description} onChange={e => setDescription(e.target.value)} /></label>
    {error && <p role="alert">{error}</p>}<button className="button teal" disabled={correct.isPending}>Submit proposed correction</button>
  </form></section>;
}
export function UnderservedConfigPanel() {
  const config = useGetPermitRuleConfig();
  const update = useUpdatePermitRuleConfig();
  const [editing, setEditing] = useState(false);
  const [zips, setZips] = useState('');
  const [tracts, setTracts] = useState('');
  const [placeholder, setPlaceholder] = useState(true);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  return <section className="card card-body rule-panel" data-testid="underserved-config"><h2>Underserved area matching configuration</h2><p>{config.data?.placeholder ? 'PLACEHOLDER DATA — not official County designations. Matches never automatically verify claims.' : 'Staff-maintained matching list. All claims still require staff verification.'}</p><p>ZIPs: {config.data?.zips.join(', ') || 'None'} · Census tracts: {config.data?.censusTracts.join(', ') || 'None'}</p>{config.isError && <p role="alert">Configuration could not be loaded.</p>}<button className="button outline" onClick={() => { if (config.data) { setZips(config.data.zips.join(', ')); setTracts(config.data.censusTracts.join(', ')); setPlaceholder(config.data.placeholder); setEditing(true); } }} disabled={!config.data}>Edit area list</button>
    {editing && <form onSubmit={async e => { e.preventDefault(); try { await update.mutateAsync({ data: { zips: zips.split(',').map(s => s.trim()).filter(Boolean), censusTracts: tracts.split(',').map(s => s.trim()).filter(Boolean), placeholder, updateNote: note.trim() } }); await config.refetch(); setEditing(false); setMessage('Configuration saved with your staff identity and update note.'); } catch { setMessage('Could not save. ZIPs must have five digits and a staff note is required.'); } }}>
      <label>ZIP codes, comma-separated<input className="input" value={zips} onChange={e => setZips(e.target.value)} /></label><label>Census tracts, comma-separated<input className="input" value={tracts} onChange={e => setTracts(e.target.value)} /></label><label className="checkbox-row"><input type="checkbox" checked={placeholder} onChange={e => setPlaceholder(e.target.checked)} /> This is placeholder data</label><label>Required update note<textarea className="textarea" required value={note} onChange={e => setNote(e.target.value)} /></label><button className="button teal" disabled={update.isPending || !note.trim()}>Save area configuration</button>
    </form>}{message && <p role="status">{message}</p>}
  </section>;
}