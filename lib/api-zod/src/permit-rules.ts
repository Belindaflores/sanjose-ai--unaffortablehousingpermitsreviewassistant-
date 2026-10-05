/** Deterministic San José service-address screen, not parcel/GIS permitting authority. */
export const COUNTY_CITIES = ['San Jose'];
export const SAN_JOSE_ZIPS = new Set(['95002', '95110', '95111', '95112', '95113', '95116', '95117', '95118', '95119', '95120', '95121', '95122', '95123', '95124', '95125', '95126', '95127', '95128', '95129', '95130', '95131', '95132', '95133', '95134', '95135', '95136', '95138', '95139', '95148']);
export const COUNTY_ZIPS = SAN_JOSE_ZIPS;
export const OUTSIDE_COUNTY_MESSAGE = 'This address appears to be outside the service jurisdiction. This portal only accepts projects within the configured jurisdiction. Please contact the permitting office for the city or county where your project is located.';
export const FIRE_UNIT_THRESHOLD = 20;
export const FIRE_MISSING_FLAG = 'SAFETY-CRITICAL: Fire/Life-Safety Plan Missing';
export const CLASSIFICATION_CONFLICT_FLAG = 'APPLICATION INFORMATION CONFLICT: Project classification does not match project description';
export const PRIORITY_WARNING = 'Priority status is based on applicant-provided information and requires staff verification before it affects routing or review order.';
export const isFireCategory = (category: string) => /^(?:fire(?:\s*(?:\/|and|&|-)\s*life[\s-]*safety)?(?:\s+plan)?|fire\s*\/\s*life[\s-]*safety\s+plan)$/i.test(category.trim());
export const EVIDENCE_LABEL = 'Affordable housing supporting evidence';
export const SAFETY_CRITICAL_DOCS = [{ label: 'Fire and life safety plan', reviewer: 'Fire Marshal', message: FIRE_MISSING_FLAG, applies: (input: ScreeningInput) => Math.max(input.housingUnits, ...descriptionUnitCounts(input.description)) >= FIRE_UNIT_THRESHOLD && (/residential|family|apartment|housing|dwelling|\bADU\b|senior|addition/i.test(`${input.projectType} ${input.description}`) || input.housingUnits >= FIRE_UNIT_THRESHOLD) }];
export type VerificationStatus = 'Unverified' | 'Verified' | 'Rejected';
export type AuditDecision = { note: string; by: string; at: string };
export type ClaimVerification = { status: VerificationStatus; note?: string; by?: string; at?: string };
export type PriorityClaims = { affordable: ClaimVerification; underserved: ClaimVerification; additional?: (ClaimVerification & { category: string })[] };
export type ReviewDecisions = { jurisdiction?: AuditDecision; classification?: AuditDecision; safety?: (AuditDecision & { document: string })[] };
export type RuleConfig = { zips: string[]; censusTracts: string[]; placeholder: boolean };
export const PLACEHOLDER_UNDERSERVED_CONFIG: RuleConfig = { zips: ['95116', '95122'], censusTracts: [], placeholder: true };
export type RuleChecks = { jurisdictionStatus: 'In County' | 'Needs Verification' | 'Outside County'; jurisdictionReason?: string; classificationConflicts: string[]; safetyCriticalFlags: string[]; underservedMatch: string; completenessLabel: string };
export type ScreeningInput = {
  projectAddress: string; projectType: string; housingUnits: number; description: string;
  affordableHousing: boolean; underservedCommunity: boolean; censusTract?: string;
  claimed_affordable?: boolean; claimed_underserved?: boolean; priorityClaims?: PriorityClaims;
  claimedPriorityCategories?: string[]; permitType?: string;
  reviewDecisions?: ReviewDecisions; reviewStatus?: string; assignedDepartment?: string;
  documents: { category?: string; label: string; required: boolean; received: boolean; objectPath?: string; fileName?: string }[];
};
export function checkJurisdiction(address: string): { status: RuleChecks['jurisdictionStatus']; city: string; zip: string } {
  const normalized = address.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
  const zip = normalized.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] ?? '';
  const parts = normalized.split(',').map(p => p.trim()).filter(p => p && !/^(?:USA|United States)$/i.test(p));
  const stateZip = /\b(?:[A-Z]{2}|California)\s+\d{5}(?:-\d{4})?\b.*$/i;
  const lastPart = parts[parts.length - 1] ?? '';
  const locality = /^(?:[A-Z]{2}|California)$/i.test(lastPart) || (stateZip.test(lastPart) && !lastPart.replace(stateZip, '').trim()) ? parts[parts.length - 2] ?? '' : lastPart.replace(stateZip, '').replace(/\b\d{5}(?:-\d{4})?\b.*$/, '').trim();
  const explicitLocality = parts.length >= 2 && !/^\d+\s/.test(locality);
  const known = [...COUNTY_CITIES].sort((a, b) => b.length - a.length).find(c => explicitLocality ? c.toLowerCase() === locality.toLowerCase() : new RegExp(`(?:^|[ ,])${c}$`, 'i').test(locality));
  const city = known ?? (explicitLocality && !/^(?:TBD|Unknown|To be determined|Address pending|CA|California)$/i.test(locality) ? locality : '');
  const state = (normalized.match(/\b([A-Z]{2}|California)\s+\d{5}(?:-\d{4})?\b/i)?.[1] ?? (/^(?:[A-Z]{2}|California)$/i.test(lastPart) ? lastPart : undefined))?.toUpperCase();
  if ((state && state !== 'CA' && state !== 'CALIFORNIA') || (zip && !COUNTY_ZIPS.has(zip)) || (city && !COUNTY_CITIES.some(c => c.toLowerCase() === city.toLowerCase()))) return { status: 'Outside County', city, zip };
  // Street, explicit city, California, and an approved ZIP are all required.
  if (!known || !zip || !state || !/^\d+[A-Za-z]?(?:-\d+)?\s+[A-Za-z0-9][A-Za-z0-9 .'#/-]*[A-Za-z]/.test(normalized)) return { status: 'Needs Verification', city, zip };
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
  const mixedUse = /mixed[- ]use/i.test(`${input.projectType} ${input.description}`);
  if (!mixedUse && /commercial|industrial/i.test(input.projectType) && (multiDescription || input.housingUnits > 0)) conflicts.push(`Project type ${input.projectType} conflicts with residential housing units or an apartment description.`);
  if (!mixedUse && /commercial|industrial/i.test(input.permitType ?? '') && (multiDescription || input.housingUnits > 0)) conflicts.push(`Application category ${input.permitType} conflicts with residential project information.`);
  if (/multi[- ]?family/i.test(input.projectType) && input.housingUnits < 2 && counts.every(n => n < 2)) conflicts.push('Multifamily classification conflicts with a unit count below two.');
  if (smallType && (multiDescription || input.housingUnits >= 5 || counts.some(n => n >= 5))) conflicts.push(`Selected: ${input.projectType}; Description: ${input.description}; Units: ${input.housingUnits}. Small-project classification conflicts with multifamily scale.`);
  if (/single.family|\bADU\b|accessory dwelling|addition/i.test(input.permitType ?? '') && (multiDescription || input.housingUnits >= 5)) conflicts.push(`Application category ${input.permitType} conflicts with the residential scale and description.`);
  if (/\bADUs?\b|accessory dwelling|addition/i.test(input.description) && (input.housingUnits >= 20 || counts.some(n => n >= 20))) conflicts.push('Description identifies an ADU or addition but the project has 20 or more units.');
  for (const count of counts) if (count !== input.housingUnits) conflicts.push(`Description states ${count} units; housing unit field states ${input.housingUnits}.`);
  return conflicts;
}
export function screenApplication<T extends ScreeningInput>(input: T, config: RuleConfig = PLACEHOLDER_UNDERSERVED_CONFIG) {
  const jurisdiction = checkJurisdiction(input.projectAddress);
  const claimed_affordable = input.claimed_affordable ?? input.affordableHousing;
  const claimed_underserved = input.claimed_underserved ?? input.underservedCommunity;
  const priorityClaims: PriorityClaims = { affordable: { ...(input.priorityClaims?.affordable ?? { status: 'Unverified' }) }, underserved: { ...(input.priorityClaims?.underserved ?? { status: 'Unverified' }) }, additional: input.priorityClaims?.additional?.map(c => ({ ...c })) };
  const categories = [...new Set((input.claimedPriorityCategories ?? []).map(c => c.trim()).filter(Boolean))];
  priorityClaims.additional = categories.map(category => priorityClaims.additional?.find(c => c.category === category) ?? { category, status: 'Unverified' });
  const activeClaims = [claimed_affordable && priorityClaims.affordable, claimed_underserved && priorityClaims.underserved, ...priorityClaims.additional].filter(Boolean) as ClaimVerification[];
  const pending = activeClaims.some(c => c.status === 'Unverified');
  const verified = activeClaims.some(c => c.status === 'Verified');
  const verification_status: VerificationStatus = pending ? 'Unverified' : verified ? 'Verified' : activeClaims.length ? 'Rejected' : 'Unverified';
  const conflicts = [...classificationConflicts(input)];
  // An applicant correction is only a proposal; staff must record its resolution.
  if ((input.reviewStatus === 'On Hold — Information Review Required' || input.reviewStatus === 'Needs Human Review — Data Inconsistency') && !input.reviewDecisions?.classification && !conflicts.length) conflicts.push('Corrected classification awaits a City Worker resolution and reason.');
  const applicableSafety = SAFETY_CRITICAL_DOCS.filter(rule => rule.applies(input));
  const missingSafety = applicableSafety.filter(() => !input.documents.some(d => isFireCategory(d.category ?? '') && d.received));
  const safety = missingSafety.filter(rule => !input.reviewDecisions?.safety?.some(r => r.document === rule.label));
  const unresolvedJurisdiction = jurisdiction.status === 'Needs Verification' && !input.reviewDecisions?.jurisdiction;
  const documents = input.documents.map(d => ({ ...d, required: d.required || (applicableSafety.length > 0 && isFireCategory(d.category ?? '')) }));
  if (applicableSafety.length && !documents.some(d => isFireCategory(d.category ?? ''))) documents.push({ category: 'Fire / life safety', label: 'Fire and life safety plan', required: true, received: false });
  const required = documents.filter(d => d.required);
  const baseScore = required.length ? Math.round(required.filter(d => d.received).length / required.length * 100) : 0;
  const score = Math.min(baseScore, conflicts.length || missingSafety.length || unresolvedJurisdiction || jurisdiction.status === 'Outside County' ? 99 : 100);
  const flags = required.filter(d => !d.received).map(d => `Missing ${d.label.toLowerCase()}`);
  if (pending) flags.push('Priority claim requires verification');
  if (verification_status === 'Verified') flags.push('Housing Priority Review — staff verified');
  if (input.housingUnits >= 20) flags.push('Large development — 20+ housing units');
  if (conflicts.length) flags.push(CLASSIFICATION_CONFLICT_FLAG);
  flags.push(...safety.map(r => r.message));
  if (unresolvedJurisdiction) flags.push('Needs Jurisdiction Verification — human reviewer required.');
  const recommendedRouting = [...new Set([...(safety.length ? ['Fire Marshal Review — REQUIRED'] : []), ...(unresolvedJurisdiction ? ['Human jurisdiction review'] : []), ...(conflicts.length ? ['Human Review Required'] : []), ...(pending ? ['Priority claim requires verification'] : []), ...(input.housingUnits >= 20 || conflicts.length ? ['Planning'] : []), 'Building', ...(applicableSafety.length ? ['Fire Marshal'] : [])])];
  const requiredReviewers = [...new Set([...safety.map(r => r.reviewer), ...(unresolvedJurisdiction || conflicts.length ? ['County Intake — Human Reviewer'] : []), ...(pending ? ['Priority claim verifier'] : [])])];
  const blockers = ['On Hold — Safety Review Required', 'On Hold — Information Review Required', 'Human jurisdiction review', 'Blocked — Safety Review Required', 'Needs Human Review — Data Inconsistency', 'Needs Jurisdiction Verification'];
  const reviewStatus = safety.length ? blockers[0]! : unresolvedJurisdiction ? blockers[2]! : conflicts.length ? blockers[1]! : blockers.includes(input.reviewStatus ?? '') ? 'New' : input.reviewStatus === 'Ready for Review' && pending ? 'Priority Claim Requires Verification' : input.reviewStatus === 'Ready for Review' && score < 100 ? 'Missing Required Documents' : input.reviewStatus ?? 'New';
  const areaMatch = config.zips.includes(jurisdiction.zip) || Boolean(input.censusTract && config.censusTracts.includes(input.censusTract));
  const underservedMatch = `${config.placeholder ? 'PLACEHOLDER DATA — not an official designation. ' : ''}${areaMatch ? 'Area matches configured list; staff verification still required.' : 'No match in configured list; staff verification required.'}`;
  const jurisdictionReason = jurisdiction.status === 'Outside County' ? OUTSIDE_COUNTY_MESSAGE : jurisdiction.status === 'Needs Verification' ? 'Address is incomplete, ambiguous, or uses a shared-boundary ZIP; a human must confirm service jurisdiction.' : 'Address city and ZIP match the configured prototype jurisdiction.';
  const ruleChecks: RuleChecks = { jurisdictionStatus: jurisdiction.status, jurisdictionReason, classificationConflicts: conflicts, safetyCriticalFlags: safety.map(r => r.message), underservedMatch, completenessLabel: conflicts.length ? 'Incomplete — needs clarification' : missingSafety.length ? 'Incomplete — safety document missing' : unresolvedJurisdiction ? 'Incomplete — jurisdiction verification required' : score === 100 ? 'Document checklist complete — human review still required' : 'Incomplete — documents missing' };
  const aiStatus = safety.length || reviewStatus === 'Additional Agency Review' ? 'Additional Agency Review Required' as const : conflicts.length || unresolvedJurisdiction || ['Potential Issues Detected', 'Human Review Required'].includes(reviewStatus) ? 'Potential Issues Detected' as const : score < 100 ? 'Missing Information' as const : 'Ready for Human Review' as const;
  const assignedDepartment = safety.length ? 'Fire Marshal' : unresolvedJurisdiction || conflicts.length ? 'County Intake' : pending ? 'Housing Review' : input.assignedDepartment ?? 'Building';
  return { ...input, documents, assignedDepartment, claimedPriorityCategories: categories, affordableHousing: claimed_affordable, underservedCommunity: claimed_underserved, claimed_affordable, claimed_underserved, priorityClaims, verification_status, priority: (verification_status === 'Verified' && jurisdiction.status !== 'Outside County' && !safety.length && !conflicts.length && !unresolvedJurisdiction ? 'High' : 'Normal') as 'High' | 'Normal', completenessScore: score, flags, recommendedRouting, requiredReviewers, reviewStatus, aiStatus, ruleChecks, aiSummary: `${ruleChecks.completenessLabel}. ${flags.join(' ')} ${conflicts.join(' ')} AI recommendations are advisory only. Authorized staff make all final decisions.` };
}