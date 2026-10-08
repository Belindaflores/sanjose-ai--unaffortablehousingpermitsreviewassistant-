/** Deterministic prototype safeguards. These do not establish legal permit jurisdiction. */
export const COUNTY_CITIES = ['Campbell', 'Cupertino', 'Gilroy', 'Los Altos', 'Los Altos Hills', 'Los Gatos', 'Milpitas', 'Monte Sereno', 'Morgan Hill', 'Mountain View', 'Palo Alto', 'San Jose', 'Santa Clara', 'Saratoga', 'Sunnyvale', 'Unincorporated Santa Clara County', 'Unincorporated County', 'San Martin', 'Coyote', 'Alviso', 'Stanford', 'Mount Hamilton', 'New Almaden', 'Redwood Estates', 'Holy City'];
export const COUNTY_ZIPS = new Set(['94022', '94023', '94024', '94035', '94039', '94040', '94041', '94042', '94043', '94085', '94086', '94087', '94088', '94089', '94301', '94302', '94303', '94304', '94305', '94306', '94309', '95002', '95008', '95009', '95011', '95013', '95014', '95015', '95020', '95021', '95026', '95030', '95031', '95032', '95033', '95035', '95036', '95037', '95038', '95042', '95044', '95046', '95050', '95051', '95052', '95053', '95054', '95055', '95056', '95070', '95071', '95101', '95103', '95106', '95108', '95109', '95110', '95111', '95112', '95113', '95115', '95116', '95117', '95118', '95119', '95120', '95121', '95122', '95123', '95124', '95125', '95126', '95127', '95128', '95129', '95130', '95131', '95132', '95133', '95134', '95135', '95136', '95138', '95139', '95140', '95141', '95148', '95150', '95151', '95152', '95153', '95154', '95155', '95156', '95157', '95158', '95159', '95160', '95161', '95164', '95170', '95172', '95173', '95190', '95191', '95192', '95193', '95194', '95196']);
export const OUTSIDE_COUNTY_MESSAGE = 'This address appears to be outside Santa Clara County. This portal only accepts projects within County jurisdiction. Please contact the permitting office for the city or county where your project is located.';
const COUNTIES_OUTSIDE_COVERAGE = ['Oakland', 'San Francisco', 'Sacramento', 'Fremont', 'Berkeley', 'Richmond', 'Hayward', 'Dublin', 'Pleasanton', 'Livermore', 'Concord', 'Walnut Creek', 'Antioch', 'Brentwood', 'Stockton', 'Modesto', 'Fresno', 'Los Angeles', 'San Diego', 'San Bernardino', 'Riverside', 'Santa Cruz', 'Watsonville', 'Monterey', 'Salinas', 'Marin', 'Napa', 'Vallejo', 'Santa Rosa', 'Chico', 'Eureka'];
const STATE_CODES = new Set('AL AK AZ AR CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' '));
const STATE_NAMES = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming', 'District of Columbia'];
export const FIRE_UNIT_THRESHOLD = 5;
export const EVIDENCE_LABEL = 'Affordable housing supporting evidence';
export const SAFETY_CRITICAL_DOCS = [{ label: 'Fire and life safety plan', reviewer: 'Fire Marshal', message: 'Missing fire/life-safety plan — Fire Marshal review required.', applies: (input: ScreeningInput) => /multi[- ]?family/i.test(input.projectType) || input.housingUnits >= FIRE_UNIT_THRESHOLD || descriptionUnitCounts(input.description).some(n => n >= FIRE_UNIT_THRESHOLD) || /\b(?:multifamily|multi-family|apartment complex)\b/i.test(input.description) }];
export type VerificationStatus = 'Unverified' | 'Verified' | 'Rejected';
export type AuditDecision = { note: string; by: string; at: string };
export type ClaimVerification = { status: VerificationStatus; note?: string; by?: string; at?: string };
export type PriorityClaims = { affordable: ClaimVerification; underserved: ClaimVerification };
export type ReviewDecisions = { jurisdiction?: AuditDecision; safety?: (AuditDecision & { document: string })[] };
export type RuleConfig = { zips: string[]; censusTracts: string[]; placeholder: boolean };
export const PLACEHOLDER_UNDERSERVED_CONFIG: RuleConfig = { zips: ['95116', '95122'], censusTracts: [], placeholder: true };
export type RuleChecks = { jurisdictionStatus: 'In County' | 'Needs Verification' | 'Outside County'; classificationConflicts: string[]; safetyCriticalFlags: string[]; underservedMatch: string; completenessLabel: string };
export type ScreeningInput = {
  projectAddress: string; projectType: string; housingUnits: number; description: string;
  affordableHousing: boolean; underservedCommunity: boolean; censusTract?: string;
  claimed_affordable?: boolean; claimed_underserved?: boolean; priorityClaims?: PriorityClaims;
  reviewDecisions?: ReviewDecisions; reviewStatus?: string;
  documents: { label: string; required: boolean; received: boolean; objectPath?: string; fileName?: string }[];
};
export function simulatedDocumentStatuses(documents: readonly {
  category: string; label: string; required: boolean; received: boolean;
  objectPath?: string; fileName?: string; receivedAt?: string | Date | null;
}[]) {
  return documents.map(({ category, label, required, received }) => ({ category, label, required, received }));
}
export function checkJurisdiction(address: string): { status: RuleChecks['jurisdictionStatus']; city: string; zip: string } {
  const normalized = address.replace(/\bSan José\b/gi, 'San Jose').trim();
  const zip = normalized.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] ?? '';
  const statePattern = [...STATE_NAMES, 'CA', ...STATE_CODES].sort((a, b) => b.length - a.length).join('|');
  const trailingState = normalized.match(new RegExp(`(?:^|[,\\s])(${statePattern})(?:\\s+\\d{5}(?:-\\d{4})?)?\\s*$`, 'i'));
  const stateToken = trailingState?.[1]?.toUpperCase();
  const state = stateToken === 'CALIFORNIA' ? 'CA' : stateToken;
  const withoutStateOrZip = normalized
    .replace(/\s+\d{5}(?:-\d{4})?\s*$/, '')
    .replace(new RegExp(`(?:^|[,\\s])(?:${statePattern})\\s*$`, 'i'), '')
    .trim().replace(/,+\s*$/, '');
  const commaParts = withoutStateOrZip.split(',').map(part => part.trim()).filter(Boolean);
  const localityText = commaParts.at(-1) ?? '';
  const matchCity = (cities: readonly string[], source: string) => [...cities]
    .sort((a, b) => b.length - a.length)
    .find(candidate => new RegExp(`(?:^|[\\s,])${candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(source));
  const known = matchCity(COUNTY_CITIES, localityText);
  const outsideCity = matchCity(COUNTIES_OUTSIDE_COVERAGE, localityText);
  const city = known ?? outsideCity ?? '';
  const completeStreet = /^\s*\d+\s+\S+/.test(normalized);

  if (state && state !== 'CA') return { status: 'Outside County', city, zip };
  if (zip && !COUNTY_ZIPS.has(zip)) return { status: 'Outside County', city, zip };
  if (outsideCity && !known) return { status: 'Outside County', city, zip };
  if (known && !completeStreet) return { status: 'Needs Verification', city: known, zip };
  if (known) {
    // A recognized County city is sufficient for this prototype when no ZIP
    // was entered; shared-border ZIPs remain eligible but need staff review.
    return { status: zip === '95033' || zip === '94303' ? 'Needs Verification' : 'In County', city: known, zip };
  }
  if (zip && COUNTY_ZIPS.has(zip)) return { status: 'Needs Verification', city: '', zip };
  return { status: 'Needs Verification', city: '', zip };
}
const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
export function descriptionUnitCounts(description: string): number[] {
  const numeric = [...description.matchAll(/\b(\d+)\s*[-–]?\s*(?:housing\s+)?(?:units?|homes?|apartments?|dwellings?)\b/gi)].map(m => Number(m[1]));
  const wordPattern = Object.keys(words).join('|');
  const wordMatches = [...description.toLowerCase().matchAll(new RegExp(`\\b(${wordPattern})(?:[- ](${wordPattern}))?[- ](?:units?|homes?|apartments?|dwellings?)\\b`, 'g'))];
  return [...new Set([...numeric, ...wordMatches.map(m => words[m[1]!]! + (m[2] ? words[m[2]]! : 0))])];
}
export function classificationConflicts(input: ScreeningInput): string[] {
  const counts = descriptionUnitCounts(input.description);
  const smallType = /single.family|accessory dwelling|\bADU\b|addition/i.test(input.projectType);
  const multiDescription = /apartment complex|multifamily|multi-family/i.test(input.description);
  const conflicts: string[] = [];
  if (smallType && (multiDescription || input.housingUnits >= FIRE_UNIT_THRESHOLD || counts.some(n => n >= FIRE_UNIT_THRESHOLD))) conflicts.push(`Selected: ${input.projectType}; Description: ${input.description}; Units: ${input.housingUnits}. Small-project classification conflicts with multifamily scale.`);
  if (/\bADUs?\b|accessory dwelling|addition/i.test(input.description) && (input.housingUnits >= 20 || counts.some(n => n >= 20))) conflicts.push('Description identifies an ADU or addition but the project has 20 or more units.');
  for (const count of counts) if (count !== input.housingUnits) conflicts.push(`Description states ${count} units; housing unit field states ${input.housingUnits}.`);
  return conflicts;
}
export function screenApplication<T extends ScreeningInput>(input: T, config: RuleConfig = PLACEHOLDER_UNDERSERVED_CONFIG) {
  const jurisdiction = checkJurisdiction(input.projectAddress);
  const claimed_affordable = input.claimed_affordable ?? input.affordableHousing;
  const claimed_underserved = input.claimed_underserved ?? input.underservedCommunity;
  const priorityClaims: PriorityClaims = input.priorityClaims ?? { affordable: { status: 'Unverified' }, underserved: { status: 'Unverified' } };
  const activeClaims = [claimed_affordable && priorityClaims.affordable, claimed_underserved && priorityClaims.underserved].filter(Boolean) as ClaimVerification[];
  const pending = activeClaims.some(c => c.status === 'Unverified');
  const verified = activeClaims.some(c => c.status === 'Verified');
  const verification_status: VerificationStatus = pending ? 'Unverified' : verified ? 'Verified' : activeClaims.length ? 'Rejected' : 'Unverified';
  const conflicts = classificationConflicts(input);
  const applicableSafety = SAFETY_CRITICAL_DOCS.filter(rule => rule.applies(input));
  const missingSafety = applicableSafety.filter(rule => !input.documents.some(d => d.label === rule.label && d.received));
  const safety = missingSafety.filter(rule => !input.reviewDecisions?.safety?.some(r => r.document === rule.label));
  const required = input.documents.filter(d => d.required || applicableSafety.some(rule => rule.label === d.label));
  const baseScore = required.length ? Math.round(required.filter(d => d.received).length / required.length * 100) : 0;
  const score = Math.min(baseScore, conflicts.length || missingSafety.length || jurisdiction.status !== 'In County' ? 99 : 100);
  const flags = required.filter(d => !d.received).map(d => `Missing ${d.label.toLowerCase()}`);
  if (pending) flags.push('Priority claim pending staff verification.');
  if (verification_status === 'Verified') flags.push('Housing Priority Review — staff verified');
  if (input.housingUnits >= 20) flags.push('Large development — 20+ housing units');
  flags.push(...conflicts.map(c => `Project classification conflict — human review required: ${c}`), ...safety.map(r => `Safety-Critical: ${r.message}`));
  const unresolvedJurisdiction = jurisdiction.status === 'Needs Verification' && !input.reviewDecisions?.jurisdiction;
  if (unresolvedJurisdiction) flags.push('Needs Jurisdiction Verification — human reviewer required.');
  const recommendedRouting = [...new Set([...(input.housingUnits >= 20 || conflicts.length ? ['Planning'] : []), 'Building', ...(applicableSafety.length ? applicableSafety.map(r => r.reviewer) : []), ...(unresolvedJurisdiction || conflicts.length ? ['County Intake — Human Reviewer'] : [])])];
  const requiredReviewers = [...new Set([...safety.map(r => r.reviewer), ...(unresolvedJurisdiction || conflicts.length ? ['County Intake — Human Reviewer'] : [])])];
  const blockers = ['Blocked — Safety Review Required', 'Needs Human Review — Data Inconsistency', 'Needs Jurisdiction Verification'];
  const reviewStatus = safety.length ? blockers[0]! : conflicts.length ? blockers[1]! : unresolvedJurisdiction ? blockers[2]! : blockers.includes(input.reviewStatus ?? '') ? 'New' : input.reviewStatus ?? 'New';
  const areaMatch = config.zips.includes(jurisdiction.zip) || Boolean(input.censusTract && config.censusTracts.includes(input.censusTract));
  const underservedMatch = `${config.placeholder ? 'PLACEHOLDER DATA — not an official designation. ' : ''}${areaMatch ? 'Area matches configured list; staff verification still required.' : 'No match in configured list; staff verification required.'}`;
  const ruleChecks: RuleChecks = { jurisdictionStatus: jurisdiction.status, classificationConflicts: conflicts, safetyCriticalFlags: safety.map(r => r.message), underservedMatch, completenessLabel: conflicts.length ? 'Incomplete — needs clarification' : safety.length ? 'Incomplete — safety review required' : unresolvedJurisdiction ? 'Incomplete — jurisdiction verification required' : score === 100 ? 'Document checklist complete — human review still required' : 'Incomplete — documents missing' };
  const aiStatus = safety.length ? 'Additional Agency Review Required' as const : conflicts.length || unresolvedJurisdiction ? 'Potential Issues Detected' as const : score < 100 ? 'Missing Information' as const : 'Ready for Human Review' as const;
  return { ...input, affordableHousing: claimed_affordable, underservedCommunity: claimed_underserved, claimed_affordable, claimed_underserved, priorityClaims, verification_status, priority: (verification_status === 'Verified' && jurisdiction.status !== 'Outside County' ? 'High' : 'Normal') as 'High' | 'Normal', completenessScore: score, flags, recommendedRouting, requiredReviewers, reviewStatus, aiStatus, ruleChecks, aiSummary: `${ruleChecks.completenessLabel}. ${flags.join(' ')} AI recommendations are advisory only. Authorized staff make all final decisions.` };
}