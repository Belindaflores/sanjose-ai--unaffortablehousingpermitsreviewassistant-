import {
  getListBuildingPermitRecordsQueryKey,
  useListBuildingPermitRecords,
  type BuildingPermitRecord,
} from '@workspace/api-client-react';

// Both worker tabs and their detail route use this same bounded preview query.
// The full source total is metadata, not a count of records loaded into the portal.
export const PUBLIC_SAMPLE_LIMIT = 8;
export const PUBLIC_SAMPLE_QUERY = { page: 1, pageSize: 25 as const, q: '' };
export const OFFICIAL_DATASET_URL = 'https://data.sanjoseca.gov/dataset/active-building-permits';

export type PublicRecordSample = {
  id: string;
  permitNumber: string | null;
  projectName: string;
  permitType: string | null;
  address: string | null;
  applicant: string | null;
  status: string | null;
  submittedDate: string | null;
  updatedDate: string | null;
  department: string;
  sourceRecord: BuildingPermitRecord;
};

export function makePublicRecordSamples(records: BuildingPermitRecord[]): PublicRecordSample[] {
  return records.slice(0, PUBLIC_SAMPLE_LIMIT).map(record => ({
    id: `public-${record.sourceId}`,
    permitNumber: record.permitNumber,
    projectName: record.projectName || record.workDescription || record.permitType || 'Building permit',
    permitType: record.permitType,
    address: record.address,
    applicant: record.applicant,
    status: record.status,
    submittedDate: record.issuedDate,
    // This source does not supply a per-permit last-updated date. Never invent it.
    updatedDate: null,
    department: 'City of San José Open Data',
    sourceRecord: record,
  }));
}

export function usePublicRecordSamples() {
  const result = useListBuildingPermitRecords(PUBLIC_SAMPLE_QUERY, {
    query: {
      queryKey: getListBuildingPermitRecordsQueryKey(PUBLIC_SAMPLE_QUERY),
      staleTime: 60_000,
      refetchOnMount: 'always',
      refetchInterval: 60_000,
      retry: 1,
    },
  });
  return {
    ...result,
    publicRecordSamples: makePublicRecordSamples(result.data?.records ?? []),
    sourceTotal: result.data?.datasetTotal,
    sourceRetrievedAt: result.data?.fetchedAt,
  };
}