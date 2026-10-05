import type { PresentationDocumentRecord, PresentationTimelineRecord } from "@workspace/db";

// Metadata-only presentation entries. No actual plan files or personal information.
const descriptions = [
  ["architectural", "Architectural plans", "Opal_Drive_ADU_Architectural_Plans.pdf", "Architectural", true, 2457600],
  ["structural", "Structural plans", "Opal_Drive_ADU_Structural_Plans.pdf", "Structural", true, 1843200],
  ["site", "Site plan and survey", "Opal_Drive_ADU_Site_Plan_and_Survey.pdf", "Site and survey", true, 921600],
  ["energy", "Title 24 energy forms", "Opal_Drive_ADU_Title_24_Energy_Forms.pdf", "Energy compliance", true, 409600],
  ["owner", "Owner authorization", "Opal_Drive_ADU_Owner_Authorization.pdf", "Authorization", true, 153600],
  ["fire", "Fire and life safety plan", "Opal_Drive_ADU_Fire_and_Life_Safety_Plan.pdf", "Fire and life safety", false, 716800],
  ["planning", "Planning / zoning forms", "Opal_Drive_ADU_Planning_and_Zoning_Forms.pdf", "Planning and zoning", false, 307200],
] as const;

export const opalPresentationDocuments: PresentationDocumentRecord[] = descriptions.map(
  ([id, documentName, fileName, category, required, fileSizeBytes]) => ({
    id: `opal-${id}`, documentName, fileName, category, required, fileSizeBytes,
    uploadStatus: "Received", uploadDate: "2026-10-04", fileType: "application/pdf", synthetic: true,
  }),
);

export const opalPresentationTimeline: PresentationTimelineRecord[] = [
  { label: "Application submitted", date: "2026-10-04", status: "done", documentsMilestone: false },
  { label: "Required documents received", date: "2026-10-04", status: "done", documentsMilestone: true },
  { label: "Awaiting initial review", date: "2026-10-04", status: "current", documentsMilestone: false },
];