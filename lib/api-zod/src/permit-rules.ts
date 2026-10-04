/** Deterministic prototype safeguards. These do not establish legal permit jurisdiction. */
export const COUNTY_CITIES = ['Campbell', 'Cupertino', 'Gilroy', 'Los Altos', 'Los Altos Hills', 'Los Gatos', 'Milpitas', 'Monte Sereno', 'Morgan Hill', 'Mountain View', 'Palo Alto', 'San Jose', 'Santa Clara', 'Saratoga', 'Sunnyvale', 'Unincorporated Santa Clara County', 'Unincorporated County', 'San Martin', 'Coyote', 'Alviso', 'Stanford', 'Mount Hamilton', 'New Almaden', 'Redwood Estates', 'Holy City'];
export const COUNTY_ZIPS = new Set(['94022', '94023', '94024', '94035', '94039', '94040', '94041', '94042', '94043', '94085', '94086', '94087', '94088', '94089', '94301', '94302', '94303', '94304', '94305', '94306', '94309', '95002', '95008', '95009', '95011', '95013', '95014', '95015', '95020', '95021', '95026', '95030', '95031', '95032', '95033', '95035', '95036', '95037', '95038', '95042', '95044', '95046', '95050', '95051', '95052', '95053', '95054', '95055', '95056', '95070', '95071', '95101', '95103', '95106', '95108', '95109', '95110', '95111', '95112', '95113', '95115', '95116', '95117', '95118', '95119', '95120', '95121', '95122', '95123', '95124', '95125', '95126', '95127', '95128', '95129', '95130', '95131', '95132', '95133', '95134', '95135', '95136', '95138', '95139', '95140', '95141', '95148', '95150', '95151', '95152', '95153', '95154', '95155', '95156', '95157', '95158', '95159', '95160', '95161', '95164', '95170', '95172', '95173', '95190', '95191', '95192', '95193', '95194', '95196']);
export const OUTSIDE_COUNTY_MESSAGE = 'This address appears to be outside Santa Clara County. This portal only accepts projects within County jurisdiction. Please contact the permitting office for the city or county where your project is located.';
export const FIRE_UNIT_THRESHOLD = 20;
export const FIRE_SAFETY_FLAG = 'Safety-Critical: Missing Fire/Life-Safety Plan';
export const FIRE_SAFETY_LABEL = 'SAFETY-CRITICAL: Fire/Life-Safety Plan Missing';
export const FIRE_SAFETY_HOLD = 'On Hold - Safety Review Required';
export const FIRE_SAFETY_ROUTING = 'Fire Marshal Review - REQUIRED';
export const EVIDENCE_LABEL = 'Affordable housing supporting evidence';
export const SAFETY_CRITICAL_DOCS = [{ label: 'Fire and life safety plan', reviewer: 'Fire Marshal', message: 'Missing fire/life-safety plan — Fire Marshal review required.', applies: (input: ScreeningInput) => /multi[- ]?family/i.test(input.projectType) || input.housingUnits >= FIRE_UNIT_THRESHOLD || descriptionUnitCounts(input.description).some(n => n >= FIRE_UNIT_THRESHOLD) || /\b(?:multifamily|multi-family|apartment complex)\b/i.test(input.description) }];
export type VerificationStatus = 'Unverified' | 'Verified' | 'Rejected';
export type AuditDecision = { note: string; by: string; at: string };
export type ClaimVerification = { status: VerificationStatus; note?: string; by?: string; at?: string };
export type PriorityClaims = { affordable: ClaimVerification; underserved: ClaimVerification };
export type ReviewDecisions = { jurisdiction?: AuditDecision; safety?: (AuditDecision & { document: string; role?: 'fire_marshal' })[] };
export type RuleConfig = { zips: string[]; censusTracts: string[]; placeholder: boolean };
export const PLACEHOLDER_UNDERSERVED_CONFIG: RuleConfig = { zips: ['95116', '95122'], censusTracts: [], placeholder: true };
export type RuleChecks = { jurisdictionStatus: 'In County' | 'Needs Verification' | 'Outside County'; classificationConflicts: string[]; safetyCriticalFlags: string[]; underservedMatch: string; completenessLabel: string };
export type ScreeningInput = {
  projectAddress: string; projectType: string; housingUnits: number; description: string;
  affordableHousing: boolean; underservedCommunity: boolean; censusTract?: string;
  claimed_affordable?: boolean; claimed_underserved?: boolean; priorityClaims?: PriorityClaims;
  reviewDecisions?: ReviewDecisions; reviewStatus?: string;
  documents: { label: string; category?: string; required: boolean; received: boolean; objectPath?: string; fileName?: string }[];
};
export function checkJurisdiction(address: string): { status: RuleChecks['jurisdictionStatus']; city: string; zip: string } {
  const normalized = address.replace(/\bSan José\b/gi, 'San Jose').trim();
  const zip = normalized.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] ?? '';
  const parts = normalized.split(',').map(p => p.trim()).filter(p => p && !/^(?:USA|United States)$/i.test(p));
  const stateZip = /\b(?:[A-Z]{2}|California)\s+\d{5}(?:-\d{4})?\b.*$/i;
  const lastPart = parts[parts.length - 1] ?? '';
  const locality = stateZip.test(lastPart) && !lastPart.replace(stateZip, '').trim() ? parts[parts.length - 2] ?? '' : lastPart.replace(stateZip, '').replace(/\b\d{5}(?:-\d{4})?\b.*$/, '').trim();
  const explicitLocality = parts.length >= 2 && !/^\d+\s/.test(locality);
  const known = [...COUNTY_CITIES].sort((a, b) => b.length - a.length).find(c => explicitLocality ? c.toLowerCase() === locality.toLowerCase() : new RegExp(`(?:^|[ ,])${c}$`, 'i').test(locality));
  const city = known ?? (explicitLocality && !/^(?:TBD|Unknown|To be determined|Address pending)$/i.test(locality) ? locality : '');
  const state = normalized.match(/\b([A-Z]{2})\s+\d{5}\b/i)?.[1]?.toUpperCase();
  if ((state && state !== 'CA') || (zip && !COUNTY_ZIPS.has(zip)) || (city && !COUNTY_CITIES.some(c => c.toLowerCase() === city.toLowerCase()))) return { status: 'Outside County', city, zip };
  // Shared-border ZIPs and missing/partial address components always need human confirmation.
  if (!known || !zip || !/^\d+\s+\S+/.test(normalized) || zip === '95033' || zip === '94303') return { status: 'Needs Verification', city, zip };
  return { status: 'In County', city, zip };
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
  if (smallType && (multiDescription || input.housingUnits >= 5 || counts.some(n => n >= 5))) conflicts.push(`Selected: ${input.projectType}; Description: ${input.description}; Units: ${input.housingUnits}. Small-project classification conflicts with multifamily scale.`);
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
  const documents = input.documents.map(d => ({ ...d }));
  for (const rule of applicableSafety) {
    if (!documents.some(d => d.label === rule.label)) documents.push({ label: rule.label, category: 'Fire', required: true, received: false });
  }
  const missingSafety = applicableSafety.filter(rule => !documents.some(d => d.label === rule.label && d.received && d.objectPath));
  const safety = missingSafety.filter(rule => !input.reviewDecisions?.safety?.some(r => r.document === rule.label && r.role === 'fire_marshal' && r.by && r.note.trim() && Number.isFinite(Date.parse(r.at))));
  for (const doc of documents) {
    if (applicableSafety.some(r => r.label === doc.label)) {
      doc.required = true;
      doc.received = Boolean(doc.received && doc.objectPath);
    }
  }
  const required = documents.filter(d => d.required);
  const baseScore = required.length ? Math.round(required.filter(d => d.received).length / required.length * 100) : 0;
  const score = Math.min(baseScore, conflicts.length || missingSafety.length || jurisdiction.status !== 'In County' ? 99 : 100);
  const flags = [...safety.map(() => FIRE_SAFETY_FLAG), ...required.filter(d => !d.received).map(d => `Missing ${d.label.toLowerCase()}`)];
  if (pending) flags.push('Priority claim pending staff verification.');
  if (verification_status === 'Verified') flags.push('Housing Priority Review — staff verified');
  if (input.housingUnits >= 20) flags.push('Large development — 20+ housing units');
  flags.push(...conflicts.map(c => `Project classification conflict — human review required: ${c}`));
  const unresolvedJurisdiction = jurisdiction.status === 'Needs Verification' && !input.reviewDecisions?.jurisdiction;
  if (unresolvedJurisdiction) flags.push('Needs Jurisdiction Verification — human reviewer required.');
  const recommendedRouting = [...new Set([...(safety.length ? [FIRE_SAFETY_ROUTING] : []), ...(input.housingUnits >= 20 || conflicts.length ? ['Planning'] : []), 'Building', ...(applicableSafety.length ? applicableSafety.map(r => r.reviewer) : []), ...(unresolvedJurisdiction || conflicts.length ? ['County Intake — Human Reviewer'] : [])])];
  const requiredReviewers = [...new Set([...safety.map(r => r.reviewer), ...(unresolvedJurisdiction || conflicts.length ? ['County Intake — Human Reviewer'] : [])])];
  const blockers = [FIRE_SAFETY_HOLD, 'Needs Human Review — Data Inconsistency', 'Needs Jurisdiction Verification', 'Blocked — Safety Review Required'];
  const reviewStatus = safety.length ? blockers[0]! : conflicts.length ? blockers[1]! : unresolvedJurisdiction ? blockers[2]! : blockers.includes(input.reviewStatus ?? '') ? 'New' : input.reviewStatus ?? 'New';
  const areaMatch = config.zips.includes(jurisdiction.zip) || Boolean(input.censusTract && config.censusTracts.includes(input.censusTract));
  const underservedMatch = `${config.placeholder ? 'PLACEHOLDER DATA — not an official designation. ' : ''}${areaMatch ? 'Area matches configured list; staff verification still required.' : 'No match in configured list; staff verification required.'}`;
  const ruleChecks: RuleChecks = { jurisdictionStatus: jurisdiction.status, classificationConflicts: conflicts, safetyCriticalFlags: safety.map(() => FIRE_SAFETY_FLAG), underservedMatch, completenessLabel: safety.length ? 'Incomplete — safety review required' : conflicts.length ? 'Incomplete — needs clarification' : unresolvedJurisdiction ? 'Incomplete — jurisdiction verification required' : score === 100 ? 'Document checklist complete — human review still required' : 'Incomplete — documents missing' };
  const aiStatus = safety.length ? 'Additional Agency Review Required' as const : conflicts.length || unresolvedJurisdiction ? 'Potential Issues Detected' as const : score < 100 ? 'Missing Information' as const : 'Ready for Human Review' as const;
  const safetySummary = safety.length ? `${FIRE_SAFETY_FLAG}. Highest severity: safety-critical. Fire Marshal Review - REQUIRED. Progression is on hold until a verified plan upload or an audited Fire Marshal override. ` : '';
  const { documents: _originalDocuments, ...rest } = input;
  return { ...rest, documents, affordableHousing: claimed_affordable, underservedCommunity: claimed_underserved, claimed_affordable, claimed_underserved, priorityClaims, verification_status, priority: (verification_status === 'Verified' && jurisdiction.status !== 'Outside County' ? 'High' : 'Normal') as 'High' | 'Normal', completenessScore: score, flags, recommendedRouting, requiredReviewers, reviewStatus, aiStatus, ruleChecks, aiSummary: `${safetySummary}${ruleChecks.completenessLabel}. ${flags.join(' ')} AI recommendations are advisory only. Authorized staff make all final decisions.` };
}