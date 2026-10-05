import type { PresentationDocument, PresentationTimelineEvent } from "@workspace/db";

// Synthetic metadata requested for the portal presentation. These entries do
// not represent uploaded file bytes, signed plans, or verified permit materials.
const uploadedAt = "2026-10-04T17:00:00.000Z";
const document = (
  id: string, name: string, fileName: string, category: string,
  required: boolean, sizeBytes: number,
): PresentationDocument => ({
  id, name, fileName, category, required, sizeBytes,
  uploadStatus: "Received", uploadedAt, fileType: "application/pdf", synthetic: true,
});

export const opalPresentationDocuments: PresentationDocument[] = [
  document("opal-architectural", "Architectural plans", "Opal_Drive_ADU_Architectural_Plans.pdf", "Architectural", true, 2457600),
  document("opal-structural", "Structural plans", "Opal_Drive_ADU_Structural_Plans.pdf", "Structural", true, 1835008),
  document("opal-site-survey", "Site plan and survey", "Opal_Drive_ADU_Site_Plan_and_Survey.pdf", "Site / survey", true, 1048576),
  document("opal-energy", "Title 24 energy forms", "Opal_Drive_ADU_Title_24_Energy_Forms.pdf", "Energy", true, 524288),
  document("opal-owner-authorization", "Owner authorization", "Opal_Drive_ADU_Owner_Authorization.pdf", "Owner authorization", true, 131072),
  document("opal-fire-life-safety", "Fire and life safety plan", "Opal_Drive_ADU_Fire_and_Life_Safety_Plan.pdf", "Fire / life safety", false, 786432),
  document("opal-planning-zoning", "Planning / zoning forms", "Opal_Drive_ADU_Planning_and_Zoning_Forms.pdf", "Planning / zoning", false, 327680),
];

export const opalPresentationTimeline: PresentationTimelineEvent[] = [
  { label: "Application submitted", date: "2026-10-04", status: "complete", documentIds: [] },
  {
    label: "Required documents received", date: "2026-10-04", status: "complete",
    documentIds: opalPresentationDocuments.map(item => item.id),
  },
  { label: "Awaiting initial review", date: "2026-10-04", status: "current", documentIds: [] },
];