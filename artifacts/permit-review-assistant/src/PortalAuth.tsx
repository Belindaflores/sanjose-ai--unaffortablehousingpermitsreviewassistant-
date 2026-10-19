import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getPortalUser, selectPortalRole, exitPortal, type PortalUser } from '@workspace/api-client-react';
import { useLocation } from 'wouter';
import { ApplicantIdentityForm, RoleChooser } from './ApplicantPortal';
import { ProfileContext, PortalSessionContext, usePortalSession } from './PortalProfile';

const PROFILE_KEY = ['portal-session-profile'];
const APPLICANT_IDENTITY_KEY = 'scc-permit-applicant-identity-v1';
type ApplicantIdentity = { name: string; email: string };

function readApplicantIdentity(): ApplicantIdentity | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(APPLICANT_IDENTITY_KEY) || 'null') as Partial<ApplicantIdentity> | null;
    if (typeof value?.name !== 'string' || !value.name.trim() ||
      typeof value.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) return null;
    return { name: value.name.trim(), email: value.email.trim().toLowerCase() };
  } catch { return null; }
}

export function PortalAuth({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [applicantIdentity, setApplicantIdentity] = useState<ApplicantIdentity | null>(readApplicantIdentity);
  const [identityRequested, setIdentityRequested] = useState(false);
  const profile = useQuery<PortalUser | null>({
    queryKey: PROFILE_KEY,
    queryFn: async () => {
      try { return await getPortalUser(); }
      catch (failure) {
        if (failure && typeof failure === 'object' && 'status' in failure && failure.status === 401) {
          // Reload restores the server-rendered passcode prompt if access expired.
          const response = await fetch('/api/app-access/session', { credentials: 'same-origin' });
          const session = await response.json();
          if (!session.unlocked) window.location.reload();
          return null;
        }
        throw failure;
      }
    },
    retry: false,
    refetchInterval: 15000,
    refetchOnWindowFocus: 'always',
  });
  useEffect(() => {
    if (/^\/sign-(in|up)(\/|$)/.test(location)) {
      setLocation(profile.data ? '/user-portal' : '/', { replace: true });
    }
  }, [location, profile.data, setLocation]);

  async function clearPortalQueries() {
    await queryClient.cancelQueries({ queryKey: PROFILE_KEY });
    const predicate = (query: { queryKey: readonly unknown[] }) => query.queryKey[0] !== PROFILE_KEY[0];
    await queryClient.cancelQueries({ predicate });
    queryClient.removeQueries({ predicate });
  }
  async function chooseRole(role: 'applicant' | 'worker') {
    if (busy) return;
    if (role === 'applicant') {
      setIdentityRequested(true);
      return;
    }
    setBusy(true); setError('');
    try {
      const selected = await selectPortalRole({ role });
      await clearPortalQueries();
      sessionStorage.removeItem(APPLICANT_IDENTITY_KEY);
      setApplicantIdentity(null);
      sessionStorage.setItem('scc-permit-demo-role-v2', role);
      queryClient.setQueryData(PROFILE_KEY, selected);
      setLocation('/user-portal');
    } catch { setError('The portal could not be opened. Please try again.'); }
    finally { setBusy(false); }
  }
  async function completeApplicantIdentity(identity: ApplicantIdentity) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const selected = profile.data?.role === 'applicant'
        ? profile.data
        : await selectPortalRole({ role: 'applicant' });
      await clearPortalQueries();
      sessionStorage.setItem('scc-permit-demo-role-v2', 'applicant');
      sessionStorage.setItem(APPLICANT_IDENTITY_KEY, JSON.stringify(identity));
      setApplicantIdentity(identity);
      setIdentityRequested(false);
      queryClient.setQueryData(PROFILE_KEY, selected);
      setLocation('/user-portal');
    } catch { setError('Your applicant details could not be saved for this session. Please try again.'); }
    finally { setBusy(false); }
  }
  async function leavePortal() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await exitPortal();
      await clearPortalQueries();
      sessionStorage.removeItem('scc-permit-demo-role-v2');
      sessionStorage.removeItem(APPLICANT_IDENTITY_KEY);
      setApplicantIdentity(null);
      queryClient.setQueryData(PROFILE_KEY, null);
      setLocation('/');
    } catch { setError('The portal could not be closed. Please try again.'); }
    finally { setBusy(false); }
  }
  if (profile.isPending) return <main className="page" role="status">Loading portal…</main>;
  if (profile.isError) return <main className="page"><div className="notice" role="alert">Your portal could not be loaded. <button onClick={() => profile.refetch()}>Retry</button></div></main>;
  const applicantNeedsIdentity = profile.data?.role === 'applicant' && !applicantIdentity;
  const effectiveProfile: PortalUser | null = profile.data
    ? profile.data.role === 'applicant' && applicantIdentity
      ? { ...profile.data, ...applicantIdentity }
      : profile.data
    : null;
  return <PortalSessionContext.Provider value={{ leavePortal, busy }}>
    {error && <div className="notice" role="alert">{error}</div>}
    {applicantNeedsIdentity || identityRequested
      ? <div aria-busy={busy} style={busy ? { pointerEvents: 'none' } : undefined}><ApplicantIdentityForm onComplete={identity => { void completeApplicantIdentity(identity); }} onCancel={() => {
        if (profile.data?.role === 'applicant') void leavePortal();
        else setIdentityRequested(false);
      }} busy={busy} /></div>
      : effectiveProfile
        ? <ProfileContext.Provider key={effectiveProfile.role} value={effectiveProfile}>{children}</ProfileContext.Provider>
        : <div aria-busy={busy} style={busy ? { pointerEvents: 'none' } : undefined}><RoleChooser onSelect={role => { void chooseRole(role); }} />{busy && <p role="status" style={{ textAlign: 'center' }}>Opening portal…</p>}</div>}
  </PortalSessionContext.Provider>;
}
export function SignOutButton() {
  const { leavePortal, busy } = usePortalSession();
  return <button className="button outline" disabled={busy} onClick={() => { void leavePortal(); }}>Exit portal</button>;
}
