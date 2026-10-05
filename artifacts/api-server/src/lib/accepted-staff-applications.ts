import { checkJurisdiction } from "@workspace/api-zod";
import { canViewApplication, isStaff } from "../middlewares/portal-auth";

type StaffRecord = { id: string; projectName: string; projectAddress: string; permitType: string; projectType: string; housingUnits: number; staffVisible?: boolean };
export function canAccessPermit(user: { id: string; role: string; workspaceId: string }, row: StaffRecord & { workspaceId: string; ownerUserId: string | null }) {
  return canViewApplication(user, row.ownerUserId, row.workspaceId) && (!isStaff(user) || (row.staffVisible !== false && checkJurisdiction(row.projectAddress).status === "In County"));
}
const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\bcalifornia\b/g, "ca").replace(/[^a-z0-9]+/g, " ").trim();

/** Stable deduplication after workspace scoping; never admit partial or outside addresses. */
export function acceptedStaffApplications<T extends StaffRecord>(rows: T[]): T[] {
  const numbers = new Set<string>(), names = new Set<string>(), projects = new Set<string>();
  return rows.filter(row => {
    if (row.staffVisible === false || checkJurisdiction(row.projectAddress).status !== "In County") return false;
    const number = normalize(row.id), name = normalize(row.projectName);
    const project = [normalize(row.projectAddress), normalize(row.permitType), normalize(row.projectType), row.housingUnits].join("|");
    if (!number || !name || numbers.has(number) || names.has(name) || projects.has(project)) return false;
    numbers.add(number); names.add(name); projects.add(project);
    return true;
  });
}