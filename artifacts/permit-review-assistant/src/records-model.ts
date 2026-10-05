import type { PortalReviewRecord } from '@workspace/api-client-react';

export const RECORD_CATEGORIES = ['City Housing Permits', 'County Public Data', 'Prototype Submissions'] as const;
export type RecordCategory = (typeof RECORD_CATEGORIES)[number];
export type CategoryFilter = 'All' | RecordCategory;
export type UnitRange = 'All' | '0' | '1-4' | '5-19' | '20-49' | '50+';
export type AffordableFilter = 'All' | 'Affordable' | 'Not affordable';

export interface RecordFilters {
  search: string;
  category: CategoryFilter;
  affordable: AffordableFilter;
  housingType: string;
  reviewStatus: string;
  sourceStatus: string;
  unitRange: UnitRange;
  city: string;
  zipCode: string;
}

export const EMPTY_FILTERS: RecordFilters = {
  search: '', category: 'All', affordable: 'All', housingType: 'All', reviewStatus: 'All',
  sourceStatus: 'All', unitRange: 'All', city: 'All', zipCode: 'All',
};

export const UNIT_RANGES: UnitRange[] = ['All', '0', '1-4', '5-19', '20-49', '50+'];

export function parseCategory(value: string | null | undefined): CategoryFilter {
  return (RECORD_CATEGORIES as readonly string[]).includes(value ?? '') ? (value as RecordCategory) : 'All';
}

export function categoryQuery(search: string, category: CategoryFilter): string {
  const params = new URLSearchParams(search);
  if (category === 'All') params.delete('category');
  else params.set('category', category);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function countByCategory(records: readonly PortalReviewRecord[]) {
  const counts: Record<RecordCategory, number> = { 'City Housing Permits': 0, 'County Public Data': 0, 'Prototype Submissions': 0 };
  for (const r of records) counts[r.recordCategory] += 1;
  return { total: records.length, counts };
}

export function inUnitRange(units: number, range: UnitRange): boolean {
  switch (range) {
    case 'All': return true;
    case '0': return units === 0;
    case '1-4': return units >= 1 && units <= 4;
    case '5-19': return units >= 5 && units <= 19;
    case '20-49': return units >= 20 && units <= 49;
    case '50+': return units >= 50;
  }
}

export function matchesSearch(r: PortalReviewRecord, search: string): boolean {
  const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
  const q = normalize(search);
  if (!q) return true;
  return [r.permitNumber, r.projectName, r.address, r.zipCode, r.applicationType, r.housingCategory, r.recordCategory]
    .some(v => normalize(v).includes(q));
}

export function filterRecords(records: readonly PortalReviewRecord[], f: RecordFilters): PortalReviewRecord[] {
  return records.filter(r =>
    matchesSearch(r, f.search) &&
    (f.category === 'All' || r.recordCategory === f.category) &&
    (f.affordable === 'All' || (f.affordable === 'Affordable') === r.affordableHousing) &&
    (f.housingType === 'All' || r.housingType === f.housingType) &&
    (f.reviewStatus === 'All' || r.reviewStatus === f.reviewStatus) &&
    (f.sourceStatus === 'All' || r.sourceStatus === f.sourceStatus) &&
    inUnitRange(r.totalHousingUnits, f.unitRange) &&
    (f.city === 'All' || r.city === f.city) &&
    (f.zipCode === 'All' || r.zipCode === f.zipCode));
}

export function uniqueValues(records: readonly PortalReviewRecord[], pick: (r: PortalReviewRecord) => string): string[] {
  return Array.from(new Set(records.map(pick).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}

export function clampPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(1, Math.floor(page) || 1), pageCount(total, pageSize));
}

export function paginate<T>(items: readonly T[], page: number, pageSize: number) {
  const current = clampPage(page, items.length, pageSize);
  const start = (current - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: current, pages: pageCount(items.length, pageSize), from: items.length ? start + 1 : 0, to: Math.min(items.length, start + pageSize) };
}

/** Compact page-number list with ellipsis markers (null). */
export function pageNumbers(current: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, current, current - 1, current + 1]);
  const nums = [...set].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  nums.forEach((n, i) => { if (i && n - nums[i - 1] > 1) out.push(null); out.push(n); });
  return out;
}
