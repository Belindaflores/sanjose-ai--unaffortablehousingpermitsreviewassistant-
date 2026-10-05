import test from 'node:test';
import assert from 'node:assert/strict';
import type { PortalReviewRecord } from '@workspace/api-client-react';
import { EMPTY_FILTERS, STAFF_CATEGORY_OPTIONS, categoryQuery, countByCategory, filterRecords, matchesSearch, paginate, parseCategory, parseStaffCategory, staffCategoryLabel, pageNumbers } from './records-model';

const base: PortalReviewRecord = {
  id: 'housing', permitNumber: 'SYN-HOUSING-001', recordCategory: 'City Housing Permits',
  projectName: 'Affordable Family Homes', address: '1000 North 4th Street, San José, CA 95112',
  city: 'San José', state: 'California', zipCode: '95112', applicationType: 'Residential building permit',
  housingType: 'Multifamily', totalHousingUnits: 64, affordableHousingUnits: 64, affordableHousing: true,
  housingCategory: 'Family affordable housing', workType: 'New construction', sourceStatus: 'Issued',
  issuedDate: '2026-06-01', finalDate: null, submittedDate: '2026-03-01', reviewStatus: 'Ready for Review',
  dataSource: 'Synthetic', description: 'Synthetic test example.', sourceUrl: 'https://data.sanjoseca.gov/',
  priority: 'Normal', department: 'Housing and Planning',
  sourceType: 'Synthetic data modeled on public records', isSynthetic: true,
  createdAt: '2026-03-01T12:00:00.000Z', updatedAt: '2026-03-01T12:00:00.000Z',
};
const records: PortalReviewRecord[] = [
  base,
  { ...base, id: 'market', permitNumber: 'SYN-MARKET-002', projectName: 'Market Apartments', totalHousingUnits: 12, affordableHousing: false, affordableHousingUnits: 0, housingCategory: 'New apartment construction', zipCode: '95116', sourceStatus: 'Application received', issuedDate: null, reviewStatus: 'Under Initial Review' },
  { ...base, id: 'county', permitNumber: 'SYN-COUNTY-003', recordCategory: 'County Public Data', projectName: 'Community Kitchen', applicationType: 'Food facility plan review', housingType: 'Non-housing', totalHousingUnits: 0, affordableHousingUnits: 0, affordableHousing: false, housingCategory: 'Not a housing record', zipCode: '95122' },
  { ...base, id: 'prototype', permitNumber: 'SYN-PROTOTYPE-004', recordCategory: 'Prototype Submissions', projectName: 'Prototype ADU', applicationType: 'ADU building permit', housingType: 'ADU', totalHousingUnits: 2, affordableHousingUnits: 0, affordableHousing: false, housingCategory: 'Accessory dwelling units', zipCode: '95125', sourceStatus: 'Portal preview — not filed' },
];
test('summary counts derive from the full input, not fixed constants, filters, or pages', () => {
  assert.deepEqual(countByCategory(records), { total: 4, counts: { 'City Housing Permits': 2, 'County Public Data': 1, 'Prototype Submissions': 1 } });
  assert.equal(filterRecords(records, { ...EMPTY_FILTERS, affordable: 'Affordable' }).length, 1);
  assert.equal(paginate(records, 1, 2).items.length, 2);
  assert.equal(countByCategory(records).total, 4);
  assert.equal(countByCategory([]).total, 0);
});
test('search covers all required fields and all three record categories, case/accent insensitive', () => {
  for (const query of ['SYN-HOUSING-001', 'Affordable Family Homes', 'North 4th Street', '95112', 'Residential building permit', 'Family affordable housing', 'SAN JOSE']) assert.ok(matchesSearch(base, query));
  assert.equal(filterRecords(records, { ...EMPTY_FILTERS, search: 'SYN-COUNTY-003' })[0]?.id, 'county');
  assert.equal(filterRecords(records, { ...EMPTY_FILTERS, search: 'SYN-PROTOTYPE-004' })[0]?.id, 'prototype');
  assert.equal(filterRecords(records, { ...EMPTY_FILTERS, search: 'Oakland' }).length, 0);
  assert.equal(filterRecords(records, { ...EMPTY_FILTERS, search: '123 H Street' }).length, 0);
});
test('all eight filters work independently and in combination', () => {
  assert.equal(filterRecords(records, { ...EMPTY_FILTERS, category: 'City Housing Permits' }).length, 2);
  assert.equal(filterRecords(records, { ...EMPTY_FILTERS, affordable: 'Affordable' }).length, 1);
  assert.equal(filterRecords(records, { ...EMPTY_FILTERS, housingType: 'ADU' })[0]?.id, 'prototype');
  assert.equal(filterRecords(records, { ...EMPTY_FILTERS, reviewStatus: 'Under Initial Review' })[0]?.id, 'market');
  assert.equal(filterRecords(records, { ...EMPTY_FILTERS, sourceStatus: 'Portal preview — not filed' })[0]?.id, 'prototype');
  assert.equal(filterRecords(records, { ...EMPTY_FILTERS, unitRange: '0' })[0]?.id, 'county');
  assert.equal(filterRecords(records, { ...EMPTY_FILTERS, unitRange: '1-4' })[0]?.id, 'prototype');
  assert.equal(filterRecords(records, { ...EMPTY_FILTERS, city: 'San José' }).length, 4);
  assert.equal(filterRecords(records, { ...EMPTY_FILTERS, zipCode: '95112' })[0]?.id, 'housing');
  assert.deepEqual(filterRecords(records, {
    search: 'Family', category: 'City Housing Permits', affordable: 'Affordable', housingType: 'Multifamily',
    reviewStatus: 'Ready for Review', sourceStatus: 'Issued', unitRange: '50+', city: 'San José', zipCode: '95112',
  }).map(r => r.id), ['housing']);
  assert.equal(parseCategory('City Housing Permits'), 'City Housing Permits');
  assert.equal(parseCategory('outside'), 'All');
});
test('112-record pagination shows only10or20, reaches every record once, clamps after filtering', () => {
  const all = Array.from({ length: 112 }, (_, i) => i);
  const result = Array.from({ length: 12 }, (_, i) => paginate(all, i + 1, 10).items).flat();
  assert.deepEqual(result, all);
  assert.equal(new Set(result).size, 112);
  assert.deepEqual(paginate(all, 12, 10), { items: [110, 111], page: 12, pages: 12, from: 111, to: 112 });
  assert.equal(paginate(all, 6, 20).items.length, 12);
  assert.equal(paginate(all, -1, 10).page, 1);
  assert.equal(paginate([base], 12, 10).page, 1);
  assert.equal(paginate([], 12, 10).from, 0);
  assert.equal(paginate([], 12, 10).to, 0);
  assert.ok(pageNumbers(6, 12).includes(1) && pageNumbers(6, 12).includes(12));
});
test('category navigation and clear filters keep reload URL consistent', () => {
  const initial = '?category=Prototype%20Submissions';
  assert.equal(categoryQuery(initial, 'All'), '');
  const next = categoryQuery(initial, 'City Housing Permits');
  assert.equal(parseCategory(new URLSearchParams(next).get('category')), 'City Housing Permits');
  const cleared = categoryQuery(next, 'All');
  assert.equal(parseCategory(new URLSearchParams(cleared).get('category')), 'All');
  assert.equal(categoryQuery('?category=County+Public+Data&other=keep', 'All'), '?other=keep');
});

test('staff presentation hides the removed category label without excluding its records', () => {
  assert.deepEqual(STAFF_CATEGORY_OPTIONS, ['City Housing Permits', 'County Public Data']);
  assert.equal(staffCategoryLabel('Prototype Submissions'), null);
  assert.equal(staffCategoryLabel('City Housing Permits'), 'City Housing Permits');
  assert.equal(parseStaffCategory('Prototype Submissions'), 'All');
  assert.equal(parseStaffCategory('County Public Data'), 'County Public Data');
  const hiddenCategoryRecord = { ...base, recordCategory: 'Prototype Submissions' as const, projectName: 'Searchable demonstration housing' };
  assert.deepEqual(filterRecords([hiddenCategoryRecord], EMPTY_FILTERS), [hiddenCategoryRecord]);
  assert.deepEqual(filterRecords([hiddenCategoryRecord], { ...EMPTY_FILTERS, search: 'Searchable demonstration housing' }), [hiddenCategoryRecord]);
});