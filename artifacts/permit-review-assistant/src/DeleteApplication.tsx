import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { getListPermitApplicationsQueryKey, useDeletePermitApplication, type PermitApplication } from '@workspace/api-client-react';
import { usePortalProfile } from './PortalAuth';

/** Only saved private submissions receive this control; never public examples. */
export function DeleteApplication({ application }: { application: PermitApplication }) {
  const profile = usePortalProfile();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const deletion = useDeletePermitApplication();
  const [confirming, setConfirming] = useState(false);
  const [confirmationId, setConfirmationId] = useState('');
  const [error, setError] = useState('');
  const allowed = application.ownerUserId === profile.id || profile.role === 'worker' || profile.role === 'fire_marshal';
  if (!allowed) return null;

  const remove = async () => {
    if (deletion.isPending || confirmationId.trim() !== application.id) return;
    setError('');
    try {
      await deletion.mutateAsync({ id: application.id, data: { confirmationId: confirmationId.trim() } });
      // Evict all list variants, including other-role and email-filtered caches.
      queryClient.setQueriesData<PermitApplication[]>({ queryKey: getListPermitApplicationsQueryKey() },
        old => old?.filter(record => record.id !== application.id));
      void queryClient.invalidateQueries({ queryKey: getListPermitApplicationsQueryKey() });
      navigate('/records');
    } catch {
      setError('Deletion could not be confirmed. Your application has not been removed from this view. Retry, or refresh records if another user already deleted it.');
    }
  };

  return <section className="card card-body" style={{ margin: '20px 0' }} aria-label="Delete saved application">
    <h2>Delete application</h2>
    {!confirming ? <button type="button" className="button danger" data-testid="button-delete-application"
      onClick={() => { setConfirming(true); setConfirmationId(''); setError(''); }}>Delete application</button>
      : <div role="group" aria-label="Confirm permanent application deletion">
        <p>This permanently deletes the saved application, its notes, and its history from both the City and Permit Applicant views. Other applications, your account, and separately stored uploaded files will not be deleted.</p>
        <p style={{ overflowWrap: 'anywhere' }}><strong>Application:</strong> {application.projectName}<br /><strong>{application.id}</strong></p>
        <label htmlFor="delete-confirmation-id">Type the exact application ID to confirm</label>
        <input id="delete-confirmation-id" className="input" value={confirmationId}
          onChange={event => setConfirmationId(event.target.value)} disabled={deletion.isPending}
          autoComplete="off" data-testid="input-delete-confirmation" style={{ display: 'block', width: '100%', margin: '10px 0' }} />
        {error && <p role="alert">{error}</p>}
        <div className="actions">
          <button type="button" className="button danger" onClick={remove}
            disabled={deletion.isPending || confirmationId.trim() !== application.id} data-testid="button-confirm-delete">
            {deletion.isPending ? 'Deleting…' : 'Permanently delete application'}
          </button>
          <button type="button" className="button outline" disabled={deletion.isPending} data-testid="button-cancel-delete"
            onClick={() => { setConfirming(false); setConfirmationId(''); setError(''); }}>Cancel</button>
        </div>
      </div>}
  </section>;
}