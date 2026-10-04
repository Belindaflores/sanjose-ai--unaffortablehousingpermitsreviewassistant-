import { createContext, useContext, useEffect, useRef } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Route, Switch, useLocation } from 'wouter';
import { useGetPortalUser, type PortalUser } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { RoleChooser } from './ApplicantPortal';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const ProfileContext = createContext<PortalUser | null>(null);
export const usePortalProfile = () => {
  const profile = useContext(ProfileContext);
  if (!profile) throw new Error('A signed-in portal profile is required.');
  return profile;
};
function ProfileGate({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const queryClient = useQueryClient();
  const previous = useRef(userId);
  const [, setLocation] = useLocation();
  const profile = useGetPortalUser({ query: { enabled: isLoaded && isSignedIn, queryKey: ['/api/portal-user', userId], refetchInterval: 15000 } });
  useEffect(() => {
    if (previous.current !== userId) {
      // Keep the current profile's active observer; clearing it leaves this gate
      // waiting on a detached query even after the server returned successfully.
      queryClient.removeQueries({ predicate: query => !(query.queryKey[0] === '/api/portal-user' && query.queryKey[1] === userId) });
      previous.current = userId;
    }
  }, [userId, queryClient]);
  if (!isLoaded) return <main className="page" role="status">Loading sign-in…</main>;
  if (!isSignedIn) return <RoleChooser onSelect={role => { sessionStorage.setItem('scc-permit-demo-role-v2', role); setLocation('/sign-in'); }} />;
  if (profile.isError) return <main className="page"><div className="notice" role="alert">Your portal profile could not be loaded. <button onClick={() => profile.refetch()}>Retry</button></div></main>;
  if (!profile.data) return <main className="page" role="status">Loading your portal permissions…</main>;
  return <ProfileContext.Provider value={profile.data}>{children}</ProfileContext.Provider>;
}
function ClerkRoutes({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => { if (isLoaded && isSignedIn && /\/sign-(?:in|up)/.test(window.location.pathname)) setLocation('/user-portal'); }, [isLoaded, isSignedIn, setLocation]);
  return <Switch>
    <Route path="/sign-in/*?"><div className="portal-auth-page"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /><p>Prototype — Not an Official County System. Staff permissions must be assigned by an administrator.</p></div></Route>
    <Route path="/sign-up/*?"><div className="portal-auth-page"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /><p>New accounts have applicant access only. AI recommendations are advisory only.</p></div></Route>
    <Route><ProfileGate>{children}</ProfileGate></Route>
  </Switch>;
}
export function PortalAuth({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const stripBase = (path: string) => basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    appearance={{ theme: shadcn, cssLayerName: 'clerk', options: { logoPlacement: 'inside', logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` }, variables: { colorPrimary: '#0067a5', colorForeground: '#153d53', colorMutedForeground: '#385766', colorDanger: '#942f27', colorBackground: '#ffffff', colorInput: '#ffffff', colorInputForeground: '#153d53', colorNeutral: '#9db5c3', fontFamily: 'Arial, sans-serif', borderRadius: '4px' }, elements: { rootBox: { maxWidth: '100%' }, cardBox: { background: '#fff', width: '440px', maxWidth: '100%' }, card: { background: 'transparent' }, footer: { background: 'transparent' }, headerTitle: { color: '#153d53' }, headerSubtitle: { color: '#385766' }, socialButtonsBlockButtonText: { color: '#153d53' }, formFieldLabel: { color: '#153d53' }, footerActionLink: { color: '#0067a5' }, footerActionText: { color: '#385766' }, dividerText: { color: '#385766' }, identityPreviewEditButton: { color: '#0067a5' }, formFieldSuccessText: { color: '#153d53' }, alertText: { color: '#942f27' } } }}
    localization={{ signIn: { start: { title: 'Welcome to the Permit Portal', subtitle: 'Sign in to your applicant or authorized staff account' } }, signUp: { start: { title: 'Create your applicant account', subtitle: 'Track only your own permit submissions' } } }}
    routerPush={to => setLocation(stripBase(to))} routerReplace={to => setLocation(stripBase(to), { replace: true })}>
    <ClerkRoutes>{children}</ClerkRoutes>
  </ClerkProvider>;
}
export function SignOutButton() {
  const { signOut } = useClerk();
  return <button className="button outline" onClick={() => signOut({ redirectUrl: basePath || '/' })}>Sign out</button>;
}