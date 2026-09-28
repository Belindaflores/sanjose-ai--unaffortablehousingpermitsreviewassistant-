import { useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useRoute, Router as WouterRouter } from 'wouter';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { getListCountyPublicRecordsQueryKey, getListPermitApplicationsQueryKey, useCreatePermitApplication, useListCountyPublicRecords, useListPermitApplications, useUpdatePermitApplication } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { ApplicantApplicationsPage, ApplicantDashboard, ApplicantDetailPage, ApplicantHelpPage, ApplicantRecordsPage, RoleChooser, WorkerLoginPage } from './ApplicantPortal';
import { WorkerAnalytics } from './WorkerAnalytics';
import {
  Activity, AlertCircle, BarChart3, Bell, Building2, Check, CheckCircle2, ChevronRight,
  ClipboardCheck, Clock3, FileCheck2, FilePlus2, FileText, HelpCircle, Home, Info,
  LayoutDashboard, Menu, MessageSquare, Paperclip, Pencil, Plus, RefreshCcw, Search,
  Send, ShieldCheck, Siren, Sparkles, UserRound, Users, X, XCircle
} from 'lucide-react';

const queryClient = new QueryClient();
const STORE_KEY = 'scc-permit-review-applications-v1';
const APPLICANT_STORE_KEY = 'scc-permit-demo-applicant-v1';
const ROLE_KEY = 'scc-permit-demo-role-v2';
type PortalRole = 'applicant' | 'worker';
const DEMO_APPLICANT = { name: 'Demo Applicant', email: 'demo.applicant@example.com', company: 'Personal project' };

type AIStatus = 'Ready for Human Review' | 'Missing Information' | 'Potential Issues Detected' | 'Additional Agency Review Required';
type ReviewStatus = 'New' | 'In County Intake' | 'Ready for Review' | 'More Information Requested' | 'Planning Review' | 'Building Review' | 'Fire Review' | 'Environmental Review' | 'Senior Review' | 'Approved' | 'Denied' | 'Revisions Required';
type Priority = 'Normal' | 'High' | 'Urgent';
type TimelineStatus = 'completed' | 'current' | 'upcoming';
type Document = { category: string; label: string; required: boolean; received: boolean; fileName?: string; receivedAt?: string };
type TimelineEvent = { label: string; status: TimelineStatus; date: string; detail: string };
type StaffNote = { id: string; author: string; body: string; createdAt: string };
export type PermitApplication = {
  id: string; dataSource?: 'Prototype Submission' | 'Synthetic'; applicantName: string; companyName: string; email: string; projectName: string;
  projectAddress: string; permitType: string; projectType: string; housingUnits: number;
  affordableHousing: boolean; underservedCommunity: boolean; estimatedCost: number; description: string;
  submittedAt: string; aiStatus: AIStatus; priority: Priority; assignedDepartment: string;
  reviewStatus: ReviewStatus; completenessScore: number; documents: Document[]; flags: string[];
  aiSummary: string; recommendedRouting: string[]; timeline: TimelineEvent[]; notes: StaffNote[];
};

const today = new Date();
const dateAt = (daysAgo: number) => new Date(today.getTime() - daysAgo * 86400000).toISOString();
const shortDate = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
const currency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const uid = () => `SCC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 899999)}`;

const baseDocuments = (received: string[] = [], missing: string[] = []): Document[] => {
  const all = [
    ['Plans', 'Architectural plans', true], ['Engineering', 'Structural plans', true],
    ['Site', 'Site plan and survey', true], ['Safety', 'Fire and life safety plan', true],
    ['Energy', 'Title 24 energy forms', true], ['Ownership', 'Owner authorization', true],
    ['Planning', 'Planning / zoning forms', false],
  ];
  return all.map(([category, label, required]) => ({
    category: category as string, label: label as string, required: required as boolean,
    received: received.includes(label as string) && !missing.includes(label as string),
    fileName: received.includes(label as string) && !missing.includes(label as string) ? `${String(label).toLowerCase().replaceAll(' ', '-')}.pdf` : undefined,
    receivedAt: received.includes(label as string) && !missing.includes(label as string) ? dateAt(2) : undefined,
  }));
};
const timelineFor = (status: ReviewStatus, extraAgency = false): TimelineEvent[] => {
  const stages = ['Submitted', 'AI pre-screening', 'County Intake', 'Planning', 'Building'];
  const currentIndex = status === 'New' ? 1 : status === 'In County Intake' ? 2 : status === 'Planning Review' ? 3 : status === 'Building Review' ? 4 : ['Approved', 'Denied', 'Revisions Required'].includes(status) ? 6 : 2;
  const result: TimelineEvent[] = stages.map((label, i) => ({
    label, status: i < currentIndex ? 'completed' : i === currentIndex ? 'current' : 'upcoming',
    date: i <= currentIndex ? dateAt(Math.max(0, 5 - i)) : '', detail: i === 0 ? 'Application received by the Santa Clara County Permit Portal.' : i === 1 ? 'Rule-based completeness and routing suggestions generated.' : `${label} review step.`,
  }));
  if (extraAgency) result.push({ label: 'Additional agency review', status: currentIndex >= 5 ? 'current' : 'upcoming', date: '', detail: 'Potential Fire Marshal or Environmental Health review.' });
  result.push({ label: 'Final County decision', status: ['Approved', 'Denied', 'Revisions Required'].includes(status) ? 'completed' : 'upcoming', date: ['Approved', 'Denied', 'Revisions Required'].includes(status) ? dateAt(0) : '', detail: 'Authorized County personnel make the final decision.' });
  return result;
};

const seedApplications = (): PermitApplication[] => [
  {
    id: 'SCC-2025-104821', applicantName: 'Marisol Nguyen', companyName: 'Cedar & Finch Builders', email: 'marisol@cedarfinch.example',
    projectName: 'Juniper Commons Affordable Homes', projectAddress: '1265 South Bascom Avenue, San Jose, CA 95128', permitType: 'Building permit', projectType: 'Multifamily housing', housingUnits: 48, affordableHousing: true, underservedCommunity: true, estimatedCost: 12800000,
    description: 'New four-story affordable housing community with 48 homes, a community room, and a small childcare facility.', submittedAt: dateAt(1), aiStatus: 'Additional Agency Review Required', priority: 'Urgent', assignedDepartment: 'Housing & Building', reviewStatus: 'Ready for Review', completenessScore: 100,
    documents: baseDocuments(['Architectural plans', 'Structural plans', 'Site plan and survey', 'Fire and life safety plan', 'Title 24 energy forms', 'Owner authorization', 'Planning / zoning forms']),
    flags: ['Housing Priority Review', 'Large development — 20+ housing units', 'Additional agency review recommended'], aiSummary: 'Complete submission for an affordable 48-unit housing project in an underserved community. The application is complete for human review; route to Planning and Building with Fire Marshal coordination.', recommendedRouting: ['Planning', 'Building', 'Fire Marshal'], timeline: timelineFor('Ready for Review', true), notes: [{ id: 'n1', author: 'Jordan Lee', body: 'Housing priority designation confirmed from applicant narrative.', createdAt: dateAt(0) }],
  },
  {
    id: 'SCC-2025-104817', applicantName: 'Derek Alvarez', companyName: 'Alvarez Residential', email: 'derek@alvarezresidential.example',
    projectName: 'Willow Street Addition', projectAddress: '718 Willow Street, Santa Clara, CA 95050', permitType: 'Building permit', projectType: 'Single-family residential', housingUnits: 1, affordableHousing: false, underservedCommunity: false, estimatedCost: 285000, description: 'Two-story rear addition with a new bedroom, bath, and covered patio.', submittedAt: dateAt(2), aiStatus: 'Missing Information', priority: 'Normal', assignedDepartment: 'Building', reviewStatus: 'More Information Requested', completenessScore: 67,
    documents: baseDocuments(['Architectural plans', 'Site plan and survey', 'Owner authorization'], ['Structural plans']), flags: ['Missing structural plans'], aiSummary: 'The basic project description is clear, but structural plans are required before technical review can begin.', recommendedRouting: ['Building'], timeline: timelineFor('More Information Requested'), notes: [],
  },
  {
    id: 'SCC-2025-104809', applicantName: 'Priya Shah', companyName: 'Shah Urban Partners', email: 'priya@shahurban.example',
    projectName: 'Civic Terrace Apartments', projectAddress: '3010 El Camino Real, Palo Alto, CA 94306', permitType: 'Building permit', projectType: 'Multifamily housing', housingUnits: 86, affordableHousing: false, underservedCommunity: false, estimatedCost: 34700000, description: 'Six-story mixed-income apartment development over a ground-floor lobby and resident services space.', submittedAt: dateAt(4), aiStatus: 'Additional Agency Review Required', priority: 'High', assignedDepartment: 'Planning', reviewStatus: 'Planning Review', completenessScore: 100,
    documents: baseDocuments(['Architectural plans', 'Structural plans', 'Site plan and survey', 'Fire and life safety plan', 'Title 24 energy forms', 'Owner authorization', 'Planning / zoning forms']), flags: ['Large development — 20+ housing units', 'Additional agency review recommended'], aiSummary: 'Complete large development submission. Scale and occupancy suggest coordinated Planning, Building, and Fire Marshal review.', recommendedRouting: ['Planning', 'Building', 'Fire Marshal'], timeline: timelineFor('Planning Review', true), notes: [{ id: 'n2', author: 'Morgan Chen', body: 'Routing to Planning first for development standards check.', createdAt: dateAt(1) }],
  },
  {
    id: 'SCC-2025-104801', applicantName: 'Elena Rossi', companyName: 'Rossi Design Studio', email: 'elena@rossidesign.example',
    projectName: 'Monterey Road ADU', projectAddress: '1842 Monterey Road, San Jose, CA 95112', permitType: 'Building permit', projectType: 'Accessory dwelling unit', housingUnits: 1, affordableHousing: false, underservedCommunity: true, estimatedCost: 165000, description: 'Detached one-bedroom accessory dwelling unit at the rear of an existing residential lot.', submittedAt: dateAt(6), aiStatus: 'Ready for Human Review', priority: 'Normal', assignedDepartment: 'Building', reviewStatus: 'Ready for Review', completenessScore: 100,
    documents: baseDocuments(['Architectural plans', 'Structural plans', 'Site plan and survey', 'Title 24 energy forms', 'Owner authorization']), flags: [], aiSummary: 'Complete small residential submission with the required core plans and ownership authorization.', recommendedRouting: ['Building'], timeline: timelineFor('Ready for Review'), notes: [],
  },
  {
    id: 'SCC-2025-104792', applicantName: 'Thomas Reed', companyName: 'Reed & Sons Construction', email: 'thomas@reedsons.example',
    projectName: 'Almaden Community Market', projectAddress: '6550 Almaden Expressway, San Jose, CA 95120', permitType: 'Tenant improvement', projectType: 'Commercial', housingUnits: 0, affordableHousing: false, underservedCommunity: false, estimatedCost: 950000, description: 'Interior tenant improvement for a neighborhood market with commercial kitchen and assembly area.', submittedAt: dateAt(8), aiStatus: 'Potential Issues Detected', priority: 'High', assignedDepartment: 'Fire Prevention', reviewStatus: 'Fire Review', completenessScore: 83,
    documents: baseDocuments(['Architectural plans', 'Structural plans', 'Site plan and survey', 'Owner authorization'], ['Fire and life safety plan']), flags: ['Missing fire and life safety plan', 'Potential Fire Marshal review'], aiSummary: 'The assembly area and commercial kitchen create a possible fire and life safety review need. Fire documentation is missing.', recommendedRouting: ['Fire Marshal', 'Building'], timeline: timelineFor('Fire Review', true), notes: [],
  },
  {
    id: 'SCC-2025-104774', applicantName: 'Alicia Brooks', companyName: 'Brooks Housing Collaborative', email: 'alicia@brookshousing.example',
    projectName: 'Sage Court Homes', projectAddress: '1098 Story Road, San Jose, CA 95116', permitType: 'Building permit', projectType: 'Multifamily housing', housingUnits: 24, affordableHousing: true, underservedCommunity: true, estimatedCost: 7200000, description: 'Twenty-four affordable apartments with accessible ground-floor homes and shared outdoor space.', submittedAt: dateAt(12), aiStatus: 'Ready for Human Review', priority: 'Urgent', assignedDepartment: 'Housing & Building', reviewStatus: 'Senior Review', completenessScore: 100,
    documents: baseDocuments(['Architectural plans', 'Structural plans', 'Site plan and survey', 'Fire and life safety plan', 'Title 24 energy forms', 'Owner authorization', 'Planning / zoning forms']), flags: ['Housing Priority Review', 'Large development — 20+ housing units'], aiSummary: 'Complete affordable housing application. Priority routing is recommended for human review.', recommendedRouting: ['Planning', 'Building'], timeline: timelineFor('Senior Review'), notes: [{ id: 'n3', author: 'Avery Patel', body: 'Escalated for senior reviewer assignment due to housing priority and schedule.', createdAt: dateAt(3) }],
  },
  {
    id: 'SCC-2025-104765', applicantName: 'Kenji Watanabe', companyName: 'Watanabe Development', email: 'kenji@watanabedev.example',
    projectName: 'Loma Verde Fourplex', projectAddress: '440 Loma Verde Drive, Mountain View, CA 94040', permitType: 'Building permit', projectType: 'Small multifamily housing', housingUnits: 4, affordableHousing: false, underservedCommunity: false, estimatedCost: 1180000, description: 'Four-unit infill project with shared courtyard and bike storage.', submittedAt: dateAt(15), aiStatus: 'Missing Information', priority: 'Normal', assignedDepartment: 'Building', reviewStatus: 'More Information Requested', completenessScore: 50,
    documents: baseDocuments(['Site plan and survey'], ['Architectural plans', 'Structural plans', 'Fire and life safety plan']), flags: ['Missing architectural plans', 'Missing structural plans', 'Multiple required documents missing'], aiSummary: 'Several required documents are not present. Request a complete plan set before routing.', recommendedRouting: ['Building'], timeline: timelineFor('More Information Requested'), notes: [],
  },
  {
    id: 'SCC-2025-104751', applicantName: 'Nadia El-Sayed', companyName: 'Northstar Civic Works', email: 'nadia@northstarcivic.example',
    projectName: 'Berryessa Senior Living', projectAddress: '1600 Berryessa Road, San Jose, CA 95133', permitType: 'Building permit', projectType: 'Senior residential care', housingUnits: 32, affordableHousing: true, underservedCommunity: false, estimatedCost: 16400000, description: 'New senior living residence with 32 units, dining room, and community wellness suite.', submittedAt: dateAt(19), aiStatus: 'Ready for Human Review', priority: 'High', assignedDepartment: 'Building', reviewStatus: 'Approved', completenessScore: 100,
    documents: baseDocuments(['Architectural plans', 'Structural plans', 'Site plan and survey', 'Fire and life safety plan', 'Title 24 energy forms', 'Owner authorization', 'Planning / zoning forms']), flags: ['Housing Priority Review', 'Large development — 20+ housing units'], aiSummary: 'Complete application. Final approval recorded by authorized County personnel after coordinated review.', recommendedRouting: ['Planning', 'Building', 'Fire Marshal'], timeline: timelineFor('Approved', true), notes: [{ id: 'n4', author: 'Jordan Lee', body: 'Approved after Planning, Building, and Fire review were completed.', createdAt: dateAt(1) }],
  },
  {
    id: 'SCC-2025-104738', applicantName: 'Luis Martinez', companyName: 'Martinez Homeworks', email: 'luis@martinezhw.example',
    projectName: 'Hillside Retrofit', projectAddress: '2210 Hillside Avenue, Los Gatos, CA 95032', permitType: 'Building permit', projectType: 'Single-family residential', housingUnits: 1, affordableHousing: false, underservedCommunity: false, estimatedCost: 198000, description: 'Seismic retrofit and interior remodel of an existing one-story home.', submittedAt: dateAt(23), aiStatus: 'Potential Issues Detected', priority: 'Normal', assignedDepartment: 'Building', reviewStatus: 'Revisions Required', completenessScore: 83,
    documents: baseDocuments(['Architectural plans', 'Structural plans', 'Site plan and survey', 'Owner authorization'], ['Title 24 energy forms']), flags: ['Missing Title 24 energy forms'], aiSummary: 'Core plans are present, but energy documentation needs to be added before approval.', recommendedRouting: ['Building'], timeline: timelineFor('Revisions Required'), notes: [],
  },
];

function seedApplicantApplications(): PermitApplication[] {
  const examples = seedApplications();
  return [
    { ...examples[1], id: 'DEMO-APP-001', projectName: 'My Willow Street Addition', applicantName: DEMO_APPLICANT.name, companyName: DEMO_APPLICANT.company, email: DEMO_APPLICANT.email, notes: [] },
    { ...examples[3], id: 'DEMO-APP-002', projectName: 'My Monterey Road ADU', applicantName: DEMO_APPLICANT.name, companyName: DEMO_APPLICANT.company, email: DEMO_APPLICANT.email, notes: [] },
  ];
}
// These two submitted records were explicitly removed; discard copies left in older browsers.
const REMOVED_LOCAL_SUBMISSION_IDS = new Set(['SCC-2026-430034', 'SCC-2026-861117']);
const withoutRemovedLocalSubmissions = (items: PermitApplication[]) => items.filter(item => !REMOVED_LOCAL_SUBMISSION_IDS.has(item.id));
const SEEDED_DEMO_IDS = new Set([...seedApplications(), ...seedApplicantApplications()].map(application => application.id));
function readApplicantApplications(): PermitApplication[] {
  try {
    const saved = localStorage.getItem(APPLICANT_STORE_KEY);
    return saved ? withoutRemovedLocalSubmissions(JSON.parse(saved) as PermitApplication[]) : seedApplicantApplications();
  } catch { return seedApplicantApplications(); }
}
function readRole(): PortalRole | null {
  try {
    const saved = sessionStorage.getItem(ROLE_KEY);
    return saved === 'applicant' || saved === 'worker' ? saved : null;
  } catch { return null; }
}

function readApplications(): PermitApplication[] {
  try { const saved = localStorage.getItem(STORE_KEY); return saved ? withoutRemovedLocalSubmissions(JSON.parse(saved) as PermitApplication[]) : seedApplications(); } catch { return seedApplications(); }
}
function saveApplications(applications: PermitApplication[]) { localStorage.setItem(STORE_KEY, JSON.stringify(withoutRemovedLocalSubmissions(applications))); }
function statusClass(status: string) {
  if (status === 'Denied') return 'status-issue';
  if (status.includes('Missing') || status.includes('Information')) return 'status-missing';
  if (status.includes('Issue') || status.includes('Revisions')) return 'status-issue';
  if (status.includes('Ready') || status.includes('Approved')) return status.includes('Approved') ? 'status-approved' : 'status-ready';
  if (status.includes('Review')) return 'status-review';
  return 'status-neutral';
}
function computeScreening(form: Record<string, string | boolean | number>, documents: Document[]) {
  const required = documents.filter(d => d.required); const received = required.filter(d => d.received);
  const score = Math.round((received.length / required.length) * 100);
  const flags: string[] = []; const routing: string[] = [];
  if (!documents.find(d => d.label === 'Architectural plans')?.received) flags.push('Missing architectural plans');
  if (!documents.find(d => d.label === 'Structural plans')?.received) flags.push('Missing structural plans');
  if (Number(form.housingUnits) > 20) { flags.push('Large development — 20+ housing units'); routing.push('Planning'); }
  if (form.affordableHousing || form.underservedCommunity) { flags.push('Housing Priority Review'); }
  const larger = Number(form.housingUnits) > 20 || form.projectType === 'Commercial' || Number(form.estimatedCost) > 5000000;
  if (larger && !documents.find(d => d.label === 'Fire and life safety plan')?.received) { flags.push('Potential Fire Marshal review'); routing.push('Fire Marshal'); }
  if (documents.find(d => d.label === 'Fire and life safety plan')?.received && larger) routing.push('Fire Marshal');
  if (!routing.includes('Building')) routing.push('Building');
  const missing = required.length - received.length;
  const aiStatus: AIStatus = missing > 0 ? 'Missing Information' : flags.some(f => f.includes('Fire Marshal')) ? 'Additional Agency Review Required' : flags.length > 0 ? 'Potential Issues Detected' : 'Ready for Human Review';
  const priority: Priority = form.affordableHousing || form.underservedCommunity ? 'High' : Number(form.housingUnits) > 20 ? 'High' : 'Normal';
  return { score, flags: [...new Set(flags)], routing: [...new Set(routing)], aiStatus, priority, summary: missing > 0 ? `The submission is ${score}% complete. ${missing} required document${missing > 1 ? 's are' : ' is'} missing and should be requested before technical review.` : `The submission appears complete for human review. ${flags.length ? 'Additional routing considerations were identified for authorized County staff.' : 'No screening flags were identified by the rule-based pre-screen.'}` };
}

function AppShell({ children, role, onSwitch }: { children: React.ReactNode; role: PortalRole; onSwitch: () => void }) {
  const [location] = useLocation(); const [menu, setMenu] = useState(false);
  const links = [{ href: '/', label: 'Overview', icon: LayoutDashboard }, { href: '/applications', label: 'Applications', icon: ClipboardCheck }, { href: '/records', label: 'Application Records', icon: FileText }, ...(role === 'worker' ? [{ href: '/analytics', label: 'Analytics', icon: BarChart3 }] : []), { href: '/help', label: 'Help & guidance', icon: HelpCircle }];
  const current = location === '/' ? '/' : location.startsWith('/applications/') || location === '/new-application' ? '/applications' : location;
  return <div className="app-shell">
    <aside className={`side-nav ${menu ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark">SC</div><div className="brand-name">Santa Clara County Permit Portal</div><div className="brand-subtitle">Student prototype</div><div className="side-role" data-testid="label-current-role">{role === 'applicant' ? 'Permit Applicant Portal' : 'City Worker Portal'}</div></div>
      <nav className="nav-area" aria-label="Main navigation"><div className="nav-label">Workspace</div>{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMenu(false)} className={`nav-link ${current === href ? 'active' : ''}`} data-testid={`link-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon /><span>{label}</span></Link>)}</nav>
      <div className="side-footer"><div className="staff-chip"><div className="staff-avatar">{role === 'worker' ? 'JL' : 'DA'}</div><div><strong>{role === 'worker' ? 'Jordan Lee' : 'Demo Applicant'}</strong><span className="staff-role">{role === 'worker' ? 'Permit technician · Demo account' : 'Permit applicant · Demo account'}</span></div></div></div>
    </aside>
    <div className="main-column">
      <header className="topbar"><button className="mobile-menu" aria-label={menu ? 'Close navigation' : 'Open navigation'} aria-expanded={menu} data-testid="button-open-navigation" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button><div className="crumb"><Building2 size={15} /><span>County permit workspace</span><ChevronRight size={13} /><strong>{location === '/' ? 'Overview' : location.includes('new-application') ? 'New application' : location.includes('records') ? 'Application Records' : location.includes('analytics') ? role === 'worker' ? 'Analytics' : 'Page not found' : location.includes('help') ? 'Help & guidance' : 'Applications'}</strong></div><div className="portal-controls"><span className="portal-label">{role === 'applicant' ? 'Permit Applicant Portal' : 'City Worker Portal'}</span><button className="switch-role" onClick={onSwitch} data-testid="button-switch-role">Switch Role</button><div className="prototype-badge">Student Prototype — Not an Official County System</div></div></header>
      {children}
    </div>
  </div>;
}

function FooterDisclaimer() { return <div className="footer-disclaimer">AI recommendations are advisory only. All permit approvals, denials, code interpretations, and regulatory decisions remain the responsibility of authorized County personnel.</div>; }
function Metric({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: string | number; detail: string }) { return <div className="card metric" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}><Icon className="metric-icon" /><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></div>; }
function StatusBadge({ status }: { status: string }) { return <span className={`status ${statusClass(status)}`} data-testid={`status-${status.toLowerCase().replaceAll(' ', '-')}`}>{status}</span>; }
function PageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) { return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="lead">{description}</p></div>{actions && <div className="actions">{actions}</div>}</div>; }

function Dashboard({ applications }: { applications: PermitApplication[] }) {
  const countyRecords = useListCountyPublicRecords({
    query: { queryKey: getListCountyPublicRecordsQueryKey(), refetchOnMount: 'always', staleTime: 60_000 },
  });
  const missing = applications.filter(a => a.aiStatus === 'Missing Information').length;
  const priority = applications.filter(a => a.priority !== 'Normal').length;
  const ready = applications.filter(a => a.aiStatus === 'Ready for Human Review').length;
  const needingReview = applications.filter(a => !['Approved', 'Denied'].includes(a.reviewStatus)).length;
  const approved = applications.filter(a => a.reviewStatus === 'Approved').length;
  const denied = applications.filter(a => a.reviewStatus === 'Denied').length;
  const revisions = applications.filter(a => a.reviewStatus === 'Revisions Required').length;
  return <><main className="page"><PageHeading eyebrow="Staff overview" title="Good morning, Jordan." description="A clear view of the permit work that needs attention today." actions={<><Link href="/new-application" className="button teal" data-testid="link-new-application"><Plus /> New application</Link><Link href="/applications" className="button outline" data-testid="link-review-queue">Open review queue <ChevronRight /></Link></>} />
     <div className="notice" style={{ marginBottom: 22 }}><Info size={15} style={{ verticalAlign: 'middle', marginRight: 7 }} /> AI pre-screening organizes the queue and surfaces questions. It does not make permit decisions.</div>
     <div className="card public-data-overview"><div><strong>County public data</strong><p>{countyRecords.isLoading ? 'Loading records from the database…' : countyRecords.isError ? 'Public records are temporarily unavailable.' : `${countyRecords.data?.length ?? 0} records from SCC Plan Check Progress`}</p></div><Link href="/records" className="button outline" data-testid="link-county-public-records">View public records <ChevronRight /></Link></div>
    <div className="section-intro"><h2>Permit decisions at a glance</h2><p className="section-note">Current staff review outcomes across the demo queue.</p></div>
    <div className="metric-grid"><Metric icon={ClipboardCheck} label="Needing review" value={needingReview} detail="Open submissions" /><Metric icon={CheckCircle2} label="Approved permits" value={approved} detail="Human approval recorded" /><Metric icon={XCircle} label="Denied permits" value={denied} detail="Human denial recorded" /><Metric icon={RefreshCcw} label="Revision requests" value={revisions} detail="Changes requested from applicants" /></div>
    <div className="section-intro"><h2>Operational overview</h2><p className="section-note">The existing queue and screening measures.</p></div>
    <div className="metric-grid"><Metric icon={FileText} label="Open applications" value={applications.filter(a => !['Approved', 'Denied'].includes(a.reviewStatus)).length} detail="Across all review stages" /><Metric icon={Clock3} label="Needs attention" value={missing + applications.filter(a => a.aiStatus === 'Potential Issues Detected').length} detail="Missing documents or flags" /><Metric icon={ShieldCheck} label="Priority housing" value={applications.filter(a => a.affordableHousing).length} detail="Affordable housing projects" /><Metric icon={CheckCircle2} label="Ready for review" value={ready} detail={`${priority} high-priority items in queue`} /></div>
    <div className="grid-2"><div className="card"><div className="card-header"><div><h2>Priority work</h2><p className="section-note">Applications with a higher need for staff attention.</p></div><Link href="/applications?filter=priority" className="button outline" data-testid="link-priority-work">View all</Link></div><div className="table-wrap"><table><thead><tr><th>Application</th><th>Signal</th><th>Status</th><th>Age</th></tr></thead><tbody>{applications.filter(a => a.priority !== 'Normal' || a.flags.length > 1).slice(0, 5).map(a => <ApplicationRow key={a.id} application={a} compact />)}</tbody></table></div></div>
      <div className="stack"><div className="card"><div className="card-header"><div><h2>Quick actions</h2><p className="section-note">Common steps for today's intake work.</p></div></div><div className="card-body actions" style={{ display: 'grid' }}><Link href="/new-application" className="button secondary" data-testid="link-start-submission"><FilePlus2 /> Start a submission</Link><Link href="/applications?filter=missing" className="button secondary" data-testid="link-missing-documents"><AlertCircle /> See missing documents</Link><Link href="/analytics" className="button secondary" data-testid="link-view-analytics"><BarChart3 /> Review workload metrics</Link></div></div><div className="card"><div className="card-header"><div><h2>Review pulse</h2><p className="section-note">Queue mix at a glance.</p></div><Activity size={17} color="#298787" /></div><div className="card-body"><div className="score"><div className="score-num">{Math.round(applications.reduce((sum, a) => sum + a.completenessScore, 0) / applications.length)}%</div><div style={{ flex: 1 }}><div style={{ fontSize: 12, color: '#385766', marginBottom: 8 }}>Average completeness</div><div className="progress"><span style={{ width: `${Math.round(applications.reduce((sum, a) => sum + a.completenessScore, 0) / applications.length)}%` }} /></div></div></div></div></div></div>
    </div><div className="card" style={{ marginTop: 20 }}><div className="card-header"><div><h2>Recent applications</h2><p className="section-note">Most recently received submissions.</p></div><Link href="/applications" className="button outline" data-testid="link-recent-applications">Browse queue <ChevronRight /></Link></div><div className="table-wrap"><table><thead><tr><th>Application</th><th>Applicant</th><th>Submitted</th><th>Completeness</th><th>Screening result</th></tr></thead><tbody>{applications.slice().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 6).map(a => <ApplicationRow key={a.id} application={a} />)}</tbody></table></div></div>
  </main><FooterDisclaimer /></>;
}

function ApplicationRow({ application: a, compact = false }: { application: PermitApplication; compact?: boolean }) {
  const [, setLocation] = useLocation();
  return <tr onClick={() => setLocation(`/applications/${a.id}`)} data-testid={`row-application-${a.id}`}><td><span className="table-title">{a.projectName}</span><span className="table-sub">{a.id} · {a.projectType} · {a.dataSource ?? 'Prototype Submission'}</span></td>{!compact && <td><span className="table-title">{a.applicantName}</span><span className="table-sub">{a.companyName}</span></td>}<td>{compact ? <span className={`priority ${a.priority.toLowerCase()}`}>{a.priority} priority</span> : shortDate(a.submittedAt)}</td>{compact && <td><StatusBadge status={a.aiStatus} /></td>}{!compact && <><td><div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 90 }}><div className="progress" style={{ flex: 1 }}><span style={{ width: `${a.completenessScore}%` }} /></div><small>{a.completenessScore}%</small></div></td><td><StatusBadge status={a.aiStatus} /></td></>}</tr>;
}

function ApplicationsPage({ applications }: { applications: PermitApplication[] }) {
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('All applications');
  const filters = ['All applications', 'New applications', 'Missing documents', 'Potential issues', 'Affordable housing', 'High priority', 'Ready for review', 'Additional agency review'];
  const filtered = applications.filter(a => {
    const haystack = `${a.projectName} ${a.id} ${a.applicantName} ${a.companyName} ${a.projectAddress}`.toLowerCase();
    const matches = haystack.includes(query.toLowerCase());
    const byFilter = filter === 'All applications' || filter === 'New applications' && a.reviewStatus === 'New' || filter === 'Missing documents' && a.aiStatus === 'Missing Information' || filter === 'Potential issues' && a.aiStatus === 'Potential Issues Detected' || filter === 'Affordable housing' && a.affordableHousing || filter === 'High priority' && a.priority !== 'Normal' || filter === 'Ready for review' && a.aiStatus === 'Ready for Human Review' || filter === 'Additional agency review' && a.aiStatus === 'Additional Agency Review Required';
    return matches && byFilter;
  });
  return <><main className="page"><PageHeading eyebrow="Staff queue" title="Applications" description="Search, filter, and open submissions for a human review of completeness, routing, and next steps." actions={<Link href="/new-application" className="button teal" data-testid="link-new-application-queue"><Plus /> New application</Link>} /><div className="card"><div className="filters"><div className="search-wrap"><Search /><input className="input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by project, applicant, or ID" aria-label="Search applications" data-testid="input-search-applications" /></div><select className="select" value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter applications" data-testid="select-application-filter">{filters.map(item => <option key={item}>{item}</option>)}</select><span style={{ color: '#677982', fontSize: 11 }}>{filtered.length} of {applications.length} applications</span></div>{filtered.length ? <div className="table-wrap"><table><thead><tr><th>Application</th><th>Applicant</th><th>Submitted</th><th>Completeness</th><th>AI pre-screening</th></tr></thead><tbody>{filtered.map(a => <ApplicationRow key={a.id} application={a} />)}</tbody></table></div> : <div className="empty"><Search size={29} /><h2>No applications match these filters</h2><p>Try a different search term or clear the filter.</p><button className="button outline" onClick={() => { setQuery(''); setFilter('All applications'); }} data-testid="button-clear-filters">Clear filters</button></div>}</div></main><FooterDisclaimer /></>;
}

type RecordSourceFilter = 'All' | 'County Public Data' | 'Prototype Submissions';

function RecordsPage({ applications }: { applications: PermitApplication[] }) {
  const { data: records, isLoading, isError, refetch, isFetching } = useListPermitApplications();
  const countyQuery = useListCountyPublicRecords({
    query: { queryKey: getListCountyPublicRecordsQueryKey(), refetchOnMount: 'always', staleTime: 60_000 },
  });
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<RecordSourceFilter>('All');
  const savedIds = new Set((records ?? []).map(application => application.id));
  const demoRecords = applications.filter(application => SEEDED_DEMO_IDS.has(application.id) && !savedIds.has(application.id));
  const prototypeRecords = [
    ...(records ?? []).map(application => ({ application, source: 'saved' as const })),
    ...demoRecords.map(application => ({ application, source: 'demo' as const })),
  ].sort((left, right) => right.application.submittedAt.localeCompare(left.application.submittedAt));
  const search = query.trim().toLowerCase();
  const visiblePrototypes = sourceFilter === 'County Public Data' ? [] : prototypeRecords.filter(({ application: a }) => `${a.id} ${a.projectName} ${a.projectAddress} ${a.applicantName} ${a.companyName}`.toLowerCase().includes(search));
  const publicRecords = countyQuery.data ?? [];
  const visiblePublicRecords = sourceFilter === 'Prototype Submissions' ? [] : publicRecords.filter(record => `${record.sourceRecordId} ${record.businessName ?? ''} ${record.siteLocation ?? ''} ${record.city ?? ''}`.toLowerCase().includes(search));
  const filteredCount = visiblePrototypes.length + visiblePublicRecords.length;
  const totalCount = prototypeRecords.length + publicRecords.length;
  const exactDate = (value: string | Date) => {
    const dateString = value instanceof Date ? value.toISOString() : value;
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${dateString.slice(0, 10)}T12:00:00Z`));
  };
  const sourceDate = (value: string | Date | null) => value ? exactDate(value) : 'Not available in source data';
  const sourceValue = (value: string | null) => value?.trim() || 'Not available in source data';
  return <><main className="page"><PageHeading eyebrow="Staff records" title="Application Records" description="County public-source records and prototype submissions are stored and shown separately. County records include only fields in the source dataset." /><div className="card filters record-search"><div className="search-wrap"><Search /><input className="input" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search records by business, project, address, or ID" aria-label="Search application records" data-testid="input-search-records" /></div><select className="select" value={sourceFilter} onChange={e => setSourceFilter(e.target.value as RecordSourceFilter)} aria-label="Filter records by source" data-testid="select-record-source-filter"><option>All</option><option>County Public Data</option><option>Prototype Submissions</option></select><span className="section-note" data-testid="text-record-count">{filteredCount} of {totalCount} records · {publicRecords.length} County public</span></div>
    <div className="card source-attribution" data-testid="county-source-attribution"><strong>Public source</strong><p><span className="dataset-name">SCC Plan Check Progress</span> · County of Santa Clara Environmental Health plan-check progress dataset, linked from the Active Plan Check Application Tracker.</p><p>County dataset description: “This status tracker is for retail food facilities, vending machines, mobile food facilities, and recreational health facilities, and does not include permitting status of any program.”</p><p>Public records displayed in this prototype were obtained from the County of Santa Clara Open Data portal. Prototype AI analysis and user-created submissions are not official County records or decisions.</p></div>
    {isLoading && !demoRecords.length && <div className="card" role="status" aria-label="Loading application records"><div className="card-body"><div className="record-skeleton" /><div className="record-skeleton" /><div className="record-skeleton" /></div></div>}
    {isLoading && demoRecords.length > 0 && <p className="section-note" role="status">Loading saved records; demo examples are available below.</p>}
    {isError && <div className="card empty" role="alert" data-testid="error-records"><AlertCircle size={29} /><h2>Saved records are unavailable</h2><p>We could not load database records. Browser-local demo examples are still available below.</p><button className="button outline" onClick={() => refetch()} disabled={isFetching} data-testid="button-retry-records"><RefreshCcw /> Retry</button></div>}
    {countyQuery.isLoading && <div className="card" role="status" aria-label="Loading County public records"><div className="card-body"><p>Loading County public records from the database…</p></div></div>}
    {countyQuery.isError && <div className="card empty" role="alert" data-testid="error-county-records"><AlertCircle size={29} /><h2>County public records are unavailable</h2><p>Prototype submissions remain available. Try again after the API is available.</p><button className="button outline" onClick={() => countyQuery.refetch()} disabled={countyQuery.isFetching}><RefreshCcw /> Retry County data</button></div>}
    {visiblePublicRecords.length > 0 && <section aria-label="County public records" className="record-section"><div className="record-section-heading"><h2>County Public Data</h2><span className="record-source county">Public source · {visiblePublicRecords.length} records</span></div><div className="record-list">{visiblePublicRecords.map(record => <article key={record.sourceRecordId} className="card record-card county-record" data-testid={`county-record-${record.sourceRecordId}`}>
          <div className="record-top"><div><span className="detail-id">Service Request Number · {record.sourceRecordId}</span><span className="record-source county">{record.dataSource}</span><h3>{sourceValue(record.businessName)}</h3><span className="section-note">{sourceValue(record.siteLocation)} · {sourceValue(record.city)}</span></div><a className="button outline source-link" href={record.sourceUrl} target="_blank" rel="noopener noreferrer">Open County source <ChevronRight /></a></div>
          <div className="record-facts"><div><span className="info-label">Received date</span><strong>{sourceDate(record.receivedDate)}</strong></div><div><span className="info-label">Due date</span><strong>{sourceDate(record.dueDate)}</strong></div><div><span className="info-label">Revision requested</span><strong>{sourceDate(record.revisionRequestedDate)}</strong></div><div><span className="info-label">Revision submitted</span><strong>{sourceDate(record.revisionSubmittedDate)}</strong></div><div><span className="info-label">Latest revision requested</span><strong>{sourceDate(record.latestRevisionRequestedDate)}</strong></div><div><span className="info-label">Latest revision submitted</span><strong>{sourceDate(record.latestRevisionSubmittedDate)}</strong></div><div><span className="info-label">Plan approved</span><strong>{sourceDate(record.planApprovedDate)}</strong></div><div><span className="info-label">Preliminary inspection</span><strong>{sourceDate(record.preliminaryInspectionDate)}</strong></div><div><span className="info-label">Final inspection</span><strong>{sourceDate(record.finalInspectionDate)}</strong></div><div><span className="info-label">Service complete</span><strong>{sourceDate(record.serviceCompleteDate)}</strong></div></div>
          <div className="public-source-note"><strong>PUBLIC SOURCE DATA</strong><span>{record.datasetName} · Service request {record.sourceRecordId}</span><span>Source date fields are County data. No prototype AI result or County decision is assigned to this record.</span></div>
        </article>)}</div></section>}
    {visiblePrototypes.length > 0 && <section aria-label="Prototype submissions" className="record-section"><div className="record-section-heading"><h2>Prototype Submissions</h2><span className="record-source prototype">{visiblePrototypes.length} records · not official County records</span></div><div className="record-list">{visiblePrototypes.map(({ application: a, source }) => <Link key={a.id} href={`/applications/${encodeURIComponent(a.id)}`} className="card record-card" data-testid={`link-record-${a.id}`}>
          <div className="record-top"><div><span className="detail-id">{a.id}</span><span className={`record-source ${source === 'demo' ? 'demo' : 'prototype'}`}>{source === 'demo' ? 'Synthetic example' : a.dataSource ?? 'Prototype Submission'}</span><h2>{a.projectName}</h2><span className="section-note">{a.projectAddress}</span></div><ChevronRight size={18} aria-hidden="true" /></div>
          <div className="record-facts"><div><span className="info-label">Applicant</span><strong>{a.applicantName}</strong></div><div><span className="info-label">Project type</span><strong>{a.projectType}</strong></div><div><span className="info-label">Housing units</span><strong>{a.housingUnits}</strong></div><div><span className="info-label">Affordable housing</span><strong>{a.affordableHousing ? 'Yes' : 'No'}</strong></div><div><span className="info-label">Priority</span><strong className={`priority ${a.priority.toLowerCase()}`}>{a.priority}</strong></div><div><span className="info-label">Submitted</span><strong>{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(a.submittedAt))}</strong></div></div>
          <div className="record-summary"><span className="ai-prototype-label">PROTOTYPE AI ANALYSIS</span><StatusBadge status={a.aiStatus} /><p>{a.aiSummary}</p></div>
        </Link>)}</div></section>}
    {!isLoading && !countyQuery.isLoading && filteredCount === 0 && <div className="card empty" data-testid={totalCount === 0 ? 'empty-records' : 'empty-record-search'}><Search size={29} /><h2>{totalCount === 0 ? 'No records yet' : 'No matching records'}</h2><p>{totalCount === 0 ? 'Submit an application or import County public records to add the first record.' : 'Try another search term or source filter.'}</p>{search ? <button className="button outline" onClick={() => setQuery('')} data-testid="button-clear-record-search">Clear search</button> : <Link href="/new-application" className="button teal" data-testid="link-create-first-record"><Plus /> New application</Link>}</div>}
  </main><FooterDisclaimer /></>;
}

type FormState = { applicantName: string; companyName: string; email: string; projectName: string; projectAddress: string; permitType: string; projectType: string; housingUnits: string; estimatedCost: string; description: string; affordableHousing: boolean; underservedCommunity: boolean };
const defaultForm: FormState = { applicantName: '', companyName: '', email: '', projectName: '', projectAddress: '', permitType: 'Building permit', projectType: 'Single-family residential', housingUnits: '1', estimatedCost: '', description: '', affordableHousing: false, underservedCommunity: false };

function NewApplication({ onAdd, role }: { onAdd: (app: PermitApplication) => void; role: PortalRole }) {
  const createApplication = useCreatePermitApplication();
  const initialForm = () => role === 'applicant' ? { ...defaultForm, applicantName: DEMO_APPLICANT.name, email: DEMO_APPLICANT.email, companyName: DEMO_APPLICANT.company } : { ...defaultForm };
  const [form, setForm] = useState<FormState>(initialForm); const [docs, setDocs] = useState<Document[]>(baseDocuments()); const [errors, setErrors] = useState<string[]>([]); const [persistenceError, setPersistenceError] = useState(''); const [result, setResult] = useState<{ app: PermitApplication; screening: ReturnType<typeof computeScreening> } | null>(null); const [submitting, setSubmitting] = useState(false);
  const update = (key: keyof FormState, value: string | boolean) => setForm(prev => ({ ...prev, [key]: value }));
  const toggleDoc = (index: number) => setDocs(prev => prev.map((d, i) => i === index ? { ...d, received: !d.received, fileName: !d.received ? `${d.label.toLowerCase().replaceAll(' ', '-')}.pdf` : undefined, receivedAt: !d.received ? dateAt(0) : undefined } : d));
  const selectDoc = (index: number, file?: File) => {
    if (!file) return;
    setDocs(prev => prev.map((d, i) => i === index ? { ...d, received: true, fileName: file.name, receivedAt: new Date().toISOString() } : d));
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const required: (keyof FormState)[] = ['applicantName', 'companyName', 'email', 'projectName', 'projectAddress', 'estimatedCost', 'description'];
    const missing = required.filter(k => !String(form[k]).trim());
    if (missing.length || !form.email.includes('@')) { setErrors([...missing.map(k => `${String(k)} is required`), ...(form.email && !form.email.includes('@') ? ['Enter a valid email address'] : [])]); return; }
    setErrors([]); setPersistenceError(''); setSubmitting(true);
    const screening = computeScreening({ ...form, housingUnits: Number(form.housingUnits), estimatedCost: Number(form.estimatedCost) }, docs);
    const app: PermitApplication = { ...form, id: uid(), housingUnits: Number(form.housingUnits), estimatedCost: Number(form.estimatedCost), submittedAt: new Date().toISOString(), aiStatus: screening.aiStatus, priority: screening.priority, assignedDepartment: screening.routing[0] || 'County Intake', reviewStatus: 'New', completenessScore: screening.score, documents: docs, flags: screening.flags, aiSummary: screening.summary, recommendedRouting: screening.routing, timeline: timelineFor('New', screening.flags.some(f => f.includes('Fire'))), notes: [] };
    try {
      const saved = await createApplication.mutateAsync({ data: app });
      onAdd(saved);
      await queryClient.invalidateQueries({ queryKey: getListPermitApplicationsQueryKey() });
      setResult({ app: saved, screening });
    } catch {
      setPersistenceError('The application could not be saved to Application Records. No submission was completed. Please try again.');
    } finally { setSubmitting(false); }
  };
   if (result) return <main className="page"><PageHeading eyebrow="Submission received" title="Pre-screening complete" description={`Application ${result.app.id} is now in the County review queue. The result below is an advisory intake aid, not a permit decision.`} actions={<><Link href={`/applications/${result.app.id}`} className="button teal" data-testid="link-open-submitted-application">Open application <ChevronRight /></Link><button className="button outline" onClick={() => { setResult(null); setForm(initialForm()); setDocs(baseDocuments()); }} data-testid="button-submit-another">Submit another</button></>} /><div className={`result-banner ${result.screening.aiStatus === 'Missing Information' ? 'warning' : result.screening.aiStatus.includes('Issue') ? 'issue' : ''}`}><div className="eyebrow">Rule-based AI pre-screening result</div><h2>{result.screening.aiStatus}</h2><p className="section-note">{result.screening.summary}</p><div className="score" style={{ marginTop: 16 }}><div className="score-num">{result.screening.score}%</div><div style={{ flex: 1 }}><div style={{ color: '#45606c', fontSize: 11, marginBottom: 7 }}>Completeness score</div><div className="progress"><span style={{ width: `${result.screening.score}%` }} /></div></div></div></div><div className="grid-2" style={{ marginTop: 20 }}><div className="card"><div className="card-header"><div><h2>Checklist</h2><p className="section-note">Required documents detected in this submission.</p></div></div><div className="card-body"><ul className="check-list">{result.app.documents.filter(d => d.required).map(d => <li key={d.label} className={d.received ? '' : 'missing'}>{d.received ? <CheckCircle2 /> : <XCircle />} {d.label}{d.received ? '' : ' — missing'}</li>)}</ul></div></div>{role === 'worker' ? <div className="card"><div className="card-header"><div><h2>Flags and routing</h2><p className="section-note">Suggestions for authorized staff review.</p></div></div><div className="card-body">{result.screening.flags.length ? <div className="flag-list">{result.screening.flags.map(f => <div className="flag" key={f}><AlertCircle size={15} />{f}</div>)}</div> : <div className="section-note">No screening flags identified.</div>}<div style={{ marginTop: 18, fontSize: 11, color: '#60747e' }}><strong>Suggested routing:</strong> {result.screening.routing.join(' · ')}</div></div></div> : <div className="card"><div className="card-header"><div><h2>What happens next</h2></div></div><div className="card-body"><p className="section-note">Your submission is saved. You can follow its progress in Application Records. A reviewer will assess your application before any decision is made.</p><Link href="/records" className="button outline" data-testid="link-view-own-records">View my records <ChevronRight /></Link></div></div>}</div><div className="notice" style={{ marginTop: 20 }}><ShieldCheck size={15} style={{ verticalAlign: 'middle', marginRight: 7 }} /> This pre-screening is advisory only. A County employee must review the record and make all final decisions.</div></main>;
   return <main className="page"><PageHeading eyebrow="Applicant intake" title="Submit a permit application" description="Provide the project information and core documents needed for a first County intake review." actions={<Link href="/applications" className="button outline" data-testid="link-cancel-submission">{role === 'applicant' ? 'My applications' : 'View queue'}</Link>} />{errors.length > 0 && <div className="notice" style={{ borderColor: '#ddb1ac', background: '#fff3f1', color: '#7e403a', marginBottom: 18 }}><AlertCircle size={15} style={{ verticalAlign: 'middle', marginRight: 7 }} /> Please correct the highlighted required information. {errors[0]}</div>}{persistenceError && <div className="notice" role="alert" data-testid="error-persistence" style={{ borderColor: '#ddb1ac', background: '#fff3f1', color: '#7e403a', marginBottom: 18 }}><AlertCircle size={15} style={{ verticalAlign: 'middle', marginRight: 7 }} /> {persistenceError}</div>}<form onSubmit={submit} className="card">
    <section className="form-section"><div className="form-section-title"><span className="step-number">1</span><div><h2>Applicant and project</h2><p className="section-note">{role === 'applicant' ? 'This demo submits under the Demo Applicant profile. Tell the County what is being proposed.' : 'Tell the County who is submitting and what is being proposed.'}</p></div></div><div className="form-grid"><Field label="Applicant name" required value={form.applicantName} readOnly={role === 'applicant'} onChange={v => update('applicantName', v)} error={errors.some(e => e.includes('applicantName'))} testId="input-applicant-name" /><Field label="Company or organization" required value={form.companyName} readOnly={role === 'applicant'} onChange={v => update('companyName', v)} error={errors.some(e => e.includes('companyName'))} testId="input-company-name" /><Field label="Email address" required type="email" value={form.email} readOnly={role === 'applicant'} onChange={v => update('email', v)} error={errors.some(e => e.includes('email'))} testId="input-applicant-email" /><Field label="Project name" required value={form.projectName} onChange={v => update('projectName', v)} error={errors.some(e => e.includes('projectName'))} testId="input-project-name" /><Field label="Project address" required full value={form.projectAddress} onChange={v => update('projectAddress', v)} error={errors.some(e => e.includes('projectAddress'))} testId="input-project-address" /><div className="field"><label htmlFor="permit-type">Permit type <span className="required">*</span></label><select id="permit-type" className="select" value={form.permitType} onChange={e => update('permitType', e.target.value)} data-testid="select-permit-type"><option>Building permit</option><option>Tenant improvement</option><option>Planning application</option><option>Encroachment permit</option></select></div><div className="field"><label htmlFor="project-type">Project type <span className="required">*</span></label><select id="project-type" className="select" value={form.projectType} onChange={e => update('projectType', e.target.value)} data-testid="select-project-type"><option>Single-family residential</option><option>Accessory dwelling unit</option><option>Small multifamily housing</option><option>Multifamily housing</option><option>Commercial</option><option>Senior residential care</option></select></div><Field label="Housing units" type="number" value={form.housingUnits} onChange={v => update('housingUnits', v)} testId="input-housing-units" /><Field label="Estimated construction cost" type="number" value={form.estimatedCost} onChange={v => update('estimatedCost', v)} error={errors.some(e => e.includes('estimatedCost'))} testId="input-estimated-cost" prefix="$" /><div className="field full"><label htmlFor="project-description">Project description <span className="required">*</span></label><textarea id="project-description" className="textarea" value={form.description} onChange={e => update('description', e.target.value)} placeholder="Briefly describe the scope, occupancy, and proposed work." data-testid="textarea-project-description" />{errors.some(e => e.includes('description')) && <span className="error-text">Project description is required.</span>}</div><div className="field full"><label>Priority context</label><div className="grid-3"><label className="checkbox-row"><input type="checkbox" checked={form.affordableHousing} onChange={e => update('affordableHousing', e.target.checked)} data-testid="checkbox-affordable-housing" /> Affordable housing project</label><label className="checkbox-row"><input type="checkbox" checked={form.underservedCommunity} onChange={e => update('underservedCommunity', e.target.checked)} data-testid="checkbox-underserved-community" /> Located in an underserved community</label></div></div></div></section>
     <section className="form-section"><div className="form-section-title"><span className="step-number">2</span><div><h2>Documents</h2><p className="section-note">{role === 'applicant' ? 'Choose files for your demo submission. File names are recorded; file contents are not stored in this prototype.' : 'Use the controls to represent documents included with this demo submission. Uploads are simulated locally.'}</p></div></div><div className="doc-list">{docs.map((doc, i) => <div className="doc-row" key={doc.label}><div><div className="doc-label">{doc.label} {doc.required && <span className="required">*</span>}</div><span className="doc-category">{doc.category} · {doc.received ? doc.fileName : 'Not received'}</span></div>{role === 'applicant' ? <label className={`button ${doc.received ? 'secondary' : 'outline'} doc-upload`}><Paperclip /> {doc.received ? 'Change file' : 'Choose file'}<input type="file" accept=".pdf,.png,.jpg,.jpeg" aria-label={`Choose file for ${doc.label}`} onChange={e => selectDoc(i, e.target.files?.[0])} data-testid={`input-document-${doc.label.toLowerCase().replaceAll(' ', '-')}`} /></label> : <button type="button" className={`button ${doc.received ? 'secondary' : 'outline'}`} onClick={() => toggleDoc(i)} data-testid={`button-upload-${doc.label.toLowerCase().replaceAll(' ', '-')}`}>{doc.received ? <><Check /> Received</> : <><Paperclip /> Add document</>}</button>}</div>)}</div></section>
     <section className="form-section" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}><span className="section-note" style={{ marginRight: 'auto', alignSelf: 'center' }}><span className="required">*</span> Required for submission</span><button type="button" className="button outline" disabled={submitting} onClick={() => { setForm(initialForm()); setDocs(baseDocuments()); setErrors([]); setPersistenceError(''); }} data-testid="button-clear-form">Clear form</button><button type="submit" className="button teal" disabled={submitting} data-testid="button-submit-application">{submitting ? 'Saving application…' : <><Send /> Submit for AI pre-screening</>}</button></section>
  </form><FooterDisclaimer /></main>;
}

function Field({ label, required, value, onChange, error, full, type = 'text', testId, prefix, readOnly = false }: { label: string; required?: boolean; value: string; onChange: (value: string) => void; error?: boolean; full?: boolean; type?: string; testId: string; prefix?: string; readOnly?: boolean }) { return <div className={`field ${full ? 'full' : ''}`}><label htmlFor={testId}>{label} {required && <span className="required">*</span>}</label><div style={{ position: 'relative' }}>{prefix && <span style={{ position: 'absolute', left: 11, top: 11, color: '#6b7d85', fontSize: 12 }}>{prefix}</span>}<input id={testId} className="input" style={prefix ? { paddingLeft: 23 } : undefined} type={type} value={value} readOnly={readOnly} onChange={e => onChange(e.target.value)} data-testid={testId} /> </div>{error && <span className="error-text">This field is required.</span>}</div>; }

function DetailPage({ applications, updateApp }: { applications: PermitApplication[]; updateApp: (app: PermitApplication) => void }) {
  const [, params] = useRoute('/applications/:id');
  const { data: records, isLoading, isError, refetch } = useListPermitApplications();
  const updateRecord = useUpdatePermitApplication();
  const dbApp = records?.find(a => a.id === params?.id);
  const app = dbApp || applications.find(a => a.id === params?.id);
  const [note, setNote] = useState(''); const [toast, setToast] = useState(''); const [saveError, setSaveError] = useState('');
  if (isLoading) return <main className="page"><div className="card card-body" role="status">Loading application details…</div></main>;
  if (!app) return <main className="page"><div className="empty"><XCircle size={34} /><h2>Application not found</h2>{isError && <p role="alert">Saved records could not be loaded. Please retry to look up this application.</p>}{isError && <button className="button outline" onClick={() => refetch()} data-testid="button-retry-detail">Retry records</button>}<Link href="/applications" className="button outline">Return to queue</Link></div></main>;
  const recordUnavailable = isError && !dbApp && ![...seedApplications(), ...seedApplicantApplications()].some(seed => seed.id === app.id);
  const persistChange = async (next: PermitApplication, message: string, afterSuccess?: () => void) => {
    if (updateRecord.isPending || recordUnavailable) return;
    setSaveError('');
    try {
      const saved = dbApp ? await updateRecord.mutateAsync({ id: next.id, data: next }) : next;
      updateApp(saved);
      if (dbApp) await queryClient.invalidateQueries({ queryKey: getListPermitApplicationsQueryKey() });
      afterSuccess?.();
      setToast(message);
      window.setTimeout(() => setToast(''), 2600);
    } catch {
      setSaveError('The change could not be saved to Application Records. Please try again.');
    }
  };
  const action = (label: string, status: ReviewStatus, timelineStatus?: string) => {
    const finalDecision = status === 'Approved' || status === 'Denied';
    const timeline = timelineFor(status, app.flags.some(f => f.includes('Fire'))).map(event =>
      finalDecision && event.label === 'Final County decision' ? { ...event, date: new Date().toISOString() } : event
    );
    const next: PermitApplication = { ...app, reviewStatus: status, assignedDepartment: timelineStatus || app.assignedDepartment, timeline, aiStatus: status === 'Approved' ? 'Ready for Human Review' : app.aiStatus };
    void persistChange(next, `${label} recorded on the application`);
  };
  const addNote = () => { if (!note.trim()) return; void persistChange({ ...app, notes: [{ id: `n-${Date.now()}`, author: 'Jordan Lee', body: note.trim(), createdAt: new Date().toISOString() }, ...app.notes] }, 'Note added', () => setNote('')); };
  return <><main className="page"><div className="detail-header" style={{ marginBottom: 27 }}><div><Link href="/applications" className="section-note" data-testid="link-back-to-queue">Applications / review queue</Link><p className="eyebrow" style={{ marginTop: 18 }}>Application detail</p><h1 style={{ marginBottom: 6 }}>{app.projectName}</h1><div className="detail-id">{app.id} · submitted {shortDate(app.submittedAt)}</div></div><div className="actions"><StatusBadge status={app.reviewStatus} /><button className="button outline" onClick={() => action('Escalation', 'Senior Review', 'Senior Reviewer')} data-testid="button-escalate-application"><Siren /> Escalate</button></div></div>
    {(saveError || recordUnavailable) && <div className="notice" role="alert" data-testid="error-update-record" style={{ borderColor: '#ddb1ac', background: '#fff3f1', color: '#7e403a', marginBottom: 18 }}><AlertCircle size={15} style={{ verticalAlign: 'middle', marginRight: 7 }} /> {recordUnavailable ? 'Saved records are unavailable. Review actions are paused until this record can be verified in the database.' : saveError}{recordUnavailable && <button className="button outline" onClick={() => refetch()} data-testid="button-retry-record-detail" style={{ marginLeft: 12 }}>Retry</button>}</div>}
    <div className="card" style={{ marginBottom: 20 }}><div className="card-header"><div><h2>Human review actions</h2><p className="section-note">These actions update saved records for database-backed applications and the demo queue for seeded examples. Approval requires an explicit staff action.</p></div><ShieldCheck size={20} color="#1b7c7b" /></div><fieldset disabled={updateRecord.isPending || recordUnavailable} className="card-body actions action-fieldset"><button className="button teal" onClick={() => action('Ready for review', 'Ready for Review')} data-testid="button-mark-ready"><CheckCircle2 /> Mark Ready for Review</button><button className="button secondary" onClick={() => action('Information request', 'More Information Requested')} data-testid="button-request-information"><MessageSquare /> Request More Information</button><button className="button secondary" onClick={() => action('Planning routing', 'Planning Review', 'Planning')} data-testid="button-send-planning"><Building2 /> Send to Planning</button><button className="button secondary" onClick={() => action('Building routing', 'Building Review', 'Building')} data-testid="button-send-building"><ClipboardCheck /> Send to Building</button><button className="button secondary" onClick={() => action('Fire routing', 'Fire Review', 'Fire Prevention')} data-testid="button-send-fire"><Siren /> Send to Fire</button><button className="button secondary" onClick={() => action('Environmental routing', 'Environmental Review', 'Environmental Health')} data-testid="button-send-environmental"><Activity /> Send to Environmental</button><button className="button danger" onClick={() => action('Revisions request', 'Revisions Required')} data-testid="button-mark-revisions"><XCircle /> Mark Revisions Required</button><button className="button danger" onClick={() => action('Denial', 'Denied')} data-testid="button-mark-denied"><XCircle /> Mark Denied</button><button className="button primary" onClick={() => action('Approval', 'Approved')} data-testid="button-mark-approved"><ShieldCheck /> Mark Approved</button></fieldset></div>
    <div className="grid-2"><div className="stack"><div className="card"><div className="card-header"><div><h2>Applicant and project</h2><p className="section-note">Submitted information for staff verification.</p></div><Pencil size={16} color="#6b828d" /></div><div className="card-body"><div className="info-list"><InfoItem label="Applicant" value={`${app.applicantName} · ${app.companyName}`} /><InfoItem label="Contact" value={app.email} /><InfoItem label="Project address" value={app.projectAddress} /><InfoItem label="Permit / project type" value={`${app.permitType} · ${app.projectType}`} /><InfoItem label="Housing units" value={String(app.housingUnits)} /><InfoItem label="Estimated cost" value={currency(app.estimatedCost)} /><InfoItem label="Priority context" value={`${app.affordableHousing ? 'Affordable housing' : 'Market-rate'}${app.underservedCommunity ? ' · Underserved community' : ''}`} /><InfoItem label="Assigned department" value={app.assignedDepartment} /><InfoItem label="Description" value={app.description} /></div></div></div><div className="card"><div className="card-header"><div><h2>Submitted documents</h2><p className="section-note">{app.documents.filter(d => d.received).length} of {app.documents.length} document categories received.</p></div><FileCheck2 size={17} color="#2b8282" /></div><div className="card-body doc-list">{app.documents.map(d => <div className="doc-row" key={d.label}><div><div className="doc-label">{d.label} {d.required && <span className="required">*</span>}</div><span className="doc-category">{d.category} · {d.received ? d.fileName : 'Not received'}</span></div>{d.received ? <span className="status status-ready">Received</span> : <span className="status status-missing">Missing</span>}</div>)}</div></div></div>
      <div className="stack"><div className="card"><div className="card-header"><div><h2>Completeness and flags</h2><p className="section-note">Advisory screening signals.</p></div><Sparkles size={17} color="#b4752e" /></div><div className="card-body"><div className="score"><div className="score-num">{app.completenessScore}%</div><div style={{ flex: 1 }}><div className="progress"><span style={{ width: `${app.completenessScore}%` }} /></div></div></div><div style={{ marginTop: 20 }} className="flag-list">{app.flags.length ? app.flags.map(f => <div className="flag" key={f}><AlertCircle size={14} />{f}</div>) : <div className="notice"><Check size={14} style={{ verticalAlign: 'middle', marginRight: 7 }} />No screening flags.</div>}</div></div></div><div className="card"><div className="card-header"><div><h2>AI pre-screening summary</h2><p className="section-note">Not a code interpretation or County decision.</p></div></div><div className="card-body"><p className="section-note" style={{ color: '#3f5a66', fontSize: 13 }}>{app.aiSummary}</p><div style={{ marginTop: 14, fontSize: 11, color: '#60747e' }}><strong>Recommended routing:</strong> {app.recommendedRouting.join(' · ')}</div></div></div><div className="card"><div className="card-header"><div><h2>Applicant-facing timeline</h2><p className="section-note">Current progress visible to the applicant.</p></div></div><div className="card-body timeline">{app.timeline.map((item, i) => <div className={`timeline-item ${item.status}`} key={`${item.label}-${i}`}><div className="timeline-dot" /><div className="timeline-date">{item.date ? shortDate(item.date) : 'Upcoming'}</div><div><div className="timeline-label">{item.label}</div><div className="timeline-detail">{item.detail}</div></div></div>)}</div></div></div></div>
    <div className="grid-2" style={{ marginTop: 20 }}><div className="card"><div className="card-header"><div><h2>Staff notes</h2><p className="section-note">Internal notes are saved with database-backed records; seeded examples stay in the local demo queue.</p></div><MessageSquare size={17} color="#2b8282" /></div><div className="card-body"><div className="field"><label htmlFor="staff-note">Add a note</label><textarea id="staff-note" className="textarea" value={note} onChange={e => setNote(e.target.value)} placeholder="Record a concise review observation…" data-testid="textarea-staff-note" /><button className="button teal" disabled={updateRecord.isPending || recordUnavailable || !note.trim()} style={{ alignSelf: 'flex-start' }} onClick={addNote} data-testid="button-add-note"><Plus /> Add note</button></div><div style={{ display: 'grid', gap: 10, marginTop: 20 }}>{app.notes.length ? app.notes.map(n => <div className="note" key={n.id}><div className="note-meta">{n.author} · {shortDate(n.createdAt)}</div><div className="note-body">{n.body}</div></div>) : <p className="section-note">No notes have been added.</p>}</div></div></div><div className="notice" style={{ alignSelf: 'start' }}><ShieldCheck size={16} style={{ verticalAlign: 'middle', marginRight: 7 }} /><strong>Human decision checkpoint.</strong><br />This workspace can suggest routing and identify missing information, but only authorized County personnel may interpret code, approve, deny, or request revisions.</div></div>
  </main>{toast && <div className="toast" role="status">{toast}</div>}<FooterDisclaimer /></>;
}
function InfoItem({ label, value }: { label: string; value: string }) { return <div><div className="info-label">{label}</div><div className="info-value">{value}</div></div>; }

function AnalyticsPage({ applications }: { applications: PermitApplication[] }) {
  const approved = applications.filter(a => a.reviewStatus === 'Approved').length; const affordable = applications.filter(a => a.affordableHousing).length; const agency = applications.filter(a => a.aiStatus === 'Additional Agency Review Required').length; const avg = Math.round(applications.reduce((s, a) => s + Math.max(1, Math.round((Date.now() - new Date(a.submittedAt).getTime()) / 86400000)), 0) / applications.length);
  const byType = ['Multifamily', 'Single-family', 'Commercial', 'Other'].map((label, i) => ({ label, count: applications.filter(a => i === 0 ? a.projectType.includes('multifamily') || a.projectType.includes('Multifamily') : i === 1 ? a.projectType.includes('Single') || a.projectType.includes('Accessory') : i === 2 ? a.projectType === 'Commercial' : !a.projectType.includes('multifamily') && !a.projectType.includes('Multifamily') && !a.projectType.includes('Single') && !a.projectType.includes('Accessory') && a.projectType !== 'Commercial').length })); const max = Math.max(...byType.map(x => x.count), 1);
  return <><main className="page"><PageHeading eyebrow="Manager view" title="Workload analytics" description="A lightweight view of the live demo queue. Metrics update as staff actions change application records." actions={<button className="button outline" onClick={() => window.location.reload()} data-testid="button-refresh-analytics"><RefreshCcw /> Refresh view</button>} /><div className="metric-grid"><Metric icon={Activity} label="Average queue age" value={`${avg} days`} detail="Simulated from submitted dates" /><Metric icon={CheckCircle2} label="Approved" value={approved} detail="Human action recorded" /><Metric icon={Home} label="Affordable housing" value={affordable} detail={`${Math.round((affordable / applications.length) * 100)}% of applications`} /><Metric icon={Siren} label="Agency review" value={agency} detail="Additional coordination suggested" /></div><div className="grid-2"><div className="card"><div className="card-header"><div><h2>Applications by project type</h2><p className="section-note">Current queue distribution.</p></div><BarChart3 size={17} color="#2b8282" /></div><div className="card-body"><div className="chart">{byType.map(item => <div className="bar-col" key={item.label}><div style={{ fontSize: 11, color: '#365968' }}>{item.count}</div><div className="bar" style={{ height: `${(item.count / max) * 100}%` }} /><div className="bar-label">{item.label}</div></div>)}</div><div className="legend"><span><i />Applications</span></div></div></div><div className="card"><div className="card-header"><div><h2>Queue composition</h2><p className="section-note">Screening signals across all records.</p></div></div><div className="card-body"><div className="donut"><div className="donut-center">{applications.length}<small>total</small></div></div><div className="legend" style={{ display: 'grid', gap: 9 }}><span><i /> {applications.filter(a => a.aiStatus === 'Ready for Human Review').length} ready for human review</span><span><i className="gold" /> {applications.filter(a => a.aiStatus === 'Missing Information').length} missing information</span><span><i style={{ background: '#d8e3e5' }} /> {applications.filter(a => !['Ready for Human Review', 'Missing Information'].includes(a.aiStatus)).length} other signals</span></div></div></div></div><div className="card" style={{ marginTop: 20 }}><div className="card-header"><div><h2>Operational indicators</h2><p className="section-note">Useful context for a classroom demonstration.</p></div></div><div className="card-body grid-3"><InfoItem label="High / urgent priority" value={`${applications.filter(a => a.priority !== 'Normal').length} applications`} /><InfoItem label="Average completeness" value={`${Math.round(applications.reduce((s, a) => s + a.completenessScore, 0) / applications.length)}%`} /><InfoItem label="Applications in active review" value={`${applications.filter(a => !['New', 'Approved', 'More Information Requested'].includes(a.reviewStatus)).length} applications`} /></div></div></main><FooterDisclaimer /></>;
}

function WorkerGuidance() {
  return <section className="page" aria-label="Internal staff guidance" style={{ paddingBottom: 0 }}>
    <div className="section-intro"><h2>Internal review procedures and support</h2><p className="section-note">For demo staff review; official County policy always takes precedence.</p></div>
    <div className="staff-guide">
      <div className="card"><h3>Review sequence</h3><ol className="check-list"><li>Open the <Link href="/applications" data-testid="link-staff-review-queue">review queue</Link> and verify the project and document checklist.</li><li>Use the advisory screening as a starting point; confirm all findings with submitted materials.</li><li>Request missing information or route the record to the appropriate department.</li><li>Record review notes, then explicitly approve, deny, or request revisions when authorized.</li></ol></div>
      <div className="card"><h3>Staff support</h3><p className="section-note">Search saved submissions in <Link href="/records" data-testid="link-staff-records-help">Application Records</Link>. For official review procedures, policy updates, and current contact details, consult the County’s official website.</p><a href="https://www.santaclaracounty.gov/" target="_blank" rel="noopener noreferrer" className="button outline" data-testid="link-official-county-staff">Official County support</a></div>
    </div>
  </section>;
}

function HelpPage({ onReset }: { onReset: () => void }) { const [reset, setReset] = useState(false); return <><main className="page"><PageHeading eyebrow="Guidance" title="Help & guardrails" description="A short guide for demonstrating how intake, screening, and human review work together." /><div className="grid-2"><div className="stack"><div className="card"><div className="card-header"><div><h2>How to use the prototype</h2><p className="section-note">A suggested flow for applicants and County staff.</p></div><HelpCircle size={18} color="#2b8282" /></div><div className="card-body"><div className="timeline"><div className="timeline-item completed"><div className="timeline-dot" /><div className="timeline-date">Step 01</div><div><div className="timeline-label">Submit an application</div><div className="timeline-detail">Use the intake form to provide project context and toggle document categories as received.</div></div></div><div className="timeline-item completed"><div className="timeline-dot" /><div className="timeline-date">Step 02</div><div><div className="timeline-label">Review pre-screening</div><div className="timeline-detail">The local rule set calculates completeness, flags, and suggested routing. Nothing is approved automatically.</div></div></div><div className="timeline-item current"><div className="timeline-dot" /><div className="timeline-date">Step 03</div><div><div className="timeline-label">County staff triage</div><div className="timeline-detail">Open a record, inspect documents, add notes, route it to a department, or request more information.</div></div></div><div className="timeline-item upcoming"><div className="timeline-dot" /><div className="timeline-date">Step 04</div><div><div className="timeline-label">Human decision</div><div className="timeline-detail">An authorized County employee explicitly records approval or revisions required.</div></div></div></div></div></div><div className="card"><div className="card-header"><div><h2>Demo data</h2><p className="section-note">Reset the local demo queue for a clean classroom demonstration.</p></div><RefreshCcw size={17} color="#2b8282" /></div><div className="card-body"><p className="section-note">This action restores the nine seeded examples in the local queue. It does not delete database records in Application Records; saved submissions remain available after reset.</p>{reset ? <div className="actions"><button className="button danger" onClick={() => { onReset(); setReset(false); }} data-testid="button-confirm-reset">Yes, reset demo data</button><button className="button outline" onClick={() => setReset(false)} data-testid="button-cancel-reset">Cancel</button></div> : <button className="button outline" onClick={() => setReset(true)} data-testid="button-reset-demo-data"><RefreshCcw /> Reset demo data</button>}</div></div></div><div className="stack"><div className="card"><div className="card-header"><div><h2>What the AI does</h2><p className="section-note">Local, explainable intake support only.</p></div><Sparkles size={17} color="#b4752e" /></div><div className="card-body"><ul className="check-list"><li><Check /> Checks whether core document categories are present.</li><li><Check /> Highlights missing plans and possible agency coordination.</li><li><Check /> Recognizes housing priority context from submitted fields.</li><li><Check /> Suggests an initial department routing.</li></ul></div></div><div className="notice"><ShieldCheck size={16} style={{ verticalAlign: 'middle', marginRight: 7 }} /><strong>Important limitation</strong><br />This student prototype does not access official County records, interpret building codes, verify documents, or replace authorized County judgment. Saved prototype applications are not official permit records.</div></div></div></main><FooterDisclaimer /></>; }

function RouterView() {
  const [applications, setApplications] = useState<PermitApplication[]>(readApplications);
  const [applicantApplications, setApplicantApplications] = useState<PermitApplication[]>(readApplicantApplications);
  const [role, setRole] = useState<PortalRole | null>(readRole);
  const [showWorkerLogin, setShowWorkerLogin] = useState(false);
  const [, setLocation] = useLocation();
  const [, detailParams] = useRoute('/applications/:id');
  const applicantFilter = role === 'applicant' ? { applicantEmail: DEMO_APPLICANT.email } : undefined;
  const { data: savedRecords } = useListPermitApplications(applicantFilter, {
    query: {
      queryKey: getListPermitApplicationsQueryKey(applicantFilter),
      enabled: role !== null,
      refetchOnMount: 'always',
      refetchOnWindowFocus: 'always',
      refetchInterval: role === 'applicant' ? 15000 : false,
    },
  });
  const visibleApplicantApplications = useMemo(() => {
    const byId = new Map(applicantApplications.filter(application => application.email === DEMO_APPLICANT.email && !REMOVED_LOCAL_SUBMISSION_IDS.has(application.id)).map(application => [application.id, application]));
    for (const record of savedRecords ?? []) {
      if (role === 'applicant' && record.email === DEMO_APPLICANT.email) byId.set(record.id, record);
    }
    return [...byId.values()].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }, [applicantApplications, savedRecords, role]);
  const workerApplications = useMemo(() => {
    const byId = new Map(withoutRemovedLocalSubmissions([...applications, ...applicantApplications]).map(application => [application.id, application]));
    for (const record of savedRecords ?? []) byId.set(record.id, record);
    return [...byId.values()].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }, [applications, applicantApplications, savedRecords]);
  useEffect(() => saveApplications(applications), [applications]);
  useEffect(() => localStorage.setItem(APPLICANT_STORE_KEY, JSON.stringify(withoutRemovedLocalSubmissions(applicantApplications))), [applicantApplications]);
  useEffect(() => {
    const syncDemoRecords = (event: StorageEvent) => {
      if (event.key === APPLICANT_STORE_KEY) setApplicantApplications(readApplicantApplications());
      if (event.key === STORE_KEY) setApplications(readApplications());
    };
    window.addEventListener('storage', syncDemoRecords);
    return () => window.removeEventListener('storage', syncDemoRecords);
  }, []);
  const add = (application: PermitApplication) => {
    setApplications(prev => [application, ...prev.filter(item => item.id !== application.id)]);
    if (role === 'applicant') setApplicantApplications(prev => [application, ...prev.filter(item => item.id !== application.id)]);
  };
  const update = (application: PermitApplication) => {
    setApplications(prev => prev.some(item => item.id === application.id) ? prev.map(item => item.id === application.id ? application : item) : [application, ...prev]);
    setApplicantApplications(prev => prev.map(item => item.id === application.id ? application : item));
  };
  const reset = () => setApplications(seedApplications());
  const chooseRole = (selected: PortalRole) => {
    if (selected === 'worker') { setLocation('/'); setShowWorkerLogin(true); return; }
    sessionStorage.setItem(ROLE_KEY, selected); queryClient.clear(); setLocation('/'); setRole(selected);
  };
  const enterWorker = () => {
    sessionStorage.setItem(ROLE_KEY, 'worker'); queryClient.clear(); setLocation('/'); setRole('worker'); setShowWorkerLogin(false);
  };
  const switchRole = () => { sessionStorage.removeItem(ROLE_KEY); queryClient.clear(); setLocation('/'); setRole(null); setShowWorkerLogin(false); };
  if (!role) return showWorkerLogin ? <WorkerLoginPage onContinue={enterWorker} onBack={() => setShowWorkerLogin(false)} /> : <RoleChooser onSelect={chooseRole} />;
  return <AppShell role={role} onSwitch={switchRole}><Switch>
    <Route path="/">{role === 'applicant' ? <><ApplicantDashboard applications={visibleApplicantApplications} /><FooterDisclaimer /></> : <Dashboard applications={workerApplications} />}</Route>
    <Route path="/new-application"><NewApplication role={role} onAdd={add} /></Route>
    <Route path="/applications">{role === 'applicant' ? <><ApplicantApplicationsPage applications={visibleApplicantApplications} /><FooterDisclaimer /></> : <ApplicationsPage applications={workerApplications} />}</Route>
    <Route path="/records">{role === 'applicant' ? <><ApplicantRecordsPage applications={visibleApplicantApplications} /><FooterDisclaimer /></> : <RecordsPage applications={workerApplications} />}</Route>
    <Route path="/applications/:id">{role === 'applicant' ? <><ApplicantDetailPage application={visibleApplicantApplications.find(a => a.id === detailParams?.id)} /><FooterDisclaimer /></> : <DetailPage applications={workerApplications} updateApp={update} />}</Route>
    <Route path="/analytics">{role === 'worker' ? <><WorkerAnalytics applications={workerApplications} /><AnalyticsPage applications={workerApplications} /></> : <NotFound />}</Route>
    <Route path="/help">{role === 'applicant' ? <><ApplicantHelpPage /><FooterDisclaimer /></> : <><WorkerGuidance /><HelpPage onReset={reset} /></>}</Route>
    <Route component={NotFound} />
  </Switch></AppShell>;
}

function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><ErrorBoundary resetKey={location.pathname}><RouterView /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;