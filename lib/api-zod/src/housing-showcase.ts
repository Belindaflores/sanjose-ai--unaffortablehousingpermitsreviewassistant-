export const PUBLIC_HOUSING_SHOWCASE_IDS = ["2024-089733-RS", "2024-089749-RS"] as const;

type ApplicantRecord = { housingDetails?: { officialApplicant?: string } | null };

/** Only a complete pair with the same non-placeholder official applicant qualifies. */
export function getSharedOfficialApplicant(records: readonly ApplicantRecord[]): string | null {
  if (records.length !== 2) return null;
  const names = records.map(record => record.housingDetails?.officialApplicant?.trim().replace(/\s+/g, " ") ?? "");
  const first = names[0]!;
  if (!first || /^(?:none|unknown|n\/a|not reported)$/i.test(first)) return null;
  return names.every(name => name.toUpperCase() === first.toUpperCase()) ? first : null;
}